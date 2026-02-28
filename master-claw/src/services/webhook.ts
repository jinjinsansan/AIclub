// MINARA Webhook 受信処理サービス
import { Request, Response } from 'express'
import { PaymentWebhookData, Member } from '@/types'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import { PaymentService } from './payment'
import { MinaraService } from './minara'
import { config } from '@/config'

export class WebhookService {
  private payment: PaymentService
  private minara: MinaraService

  constructor(payment: PaymentService, minara: MinaraService) {
    this.payment = payment
    this.minara = minara
  }

  // MINARA Webhook 処理メイン
  async handleMinaraPaymentWebhook(req: Request, res: Response): Promise<void> {
    const perf = new PerformanceLogger('minara-webhook-processing')
    
    try {
      // 1. 署名検証
      const signature = req.headers['x-minara-signature'] as string
      const payload = req.body.toString()

      if (!signature) {
        loggerHelpers.security.unauthorized('Missing webhook signature', {
          ip: req.ip,
          user_agent: req.get('User-Agent')
        })
        res.status(401).json({ error: 'Missing signature' })
        return
      }

      // 署名検証
      const isValidSignature = this.minara.verifyWebhookSignature(payload, signature)
      if (!isValidSignature) {
        loggerHelpers.security.suspicious('Invalid webhook signature', {
          ip: req.ip,
          signature: signature.substring(0, 20) + '...'
        })
        res.status(401).json({ error: 'Invalid signature' })
        return
      }

      // 2. ペイロードパース
      let webhookData: PaymentWebhookData
      try {
        webhookData = JSON.parse(payload)
      } catch (parseError) {
        logger.error('Webhook payload parse error', { 
          error: parseError.message,
          payload: payload.substring(0, 100) + '...' 
        })
        res.status(400).json({ error: 'Invalid JSON payload' })
        return
      }

      // 3. 必須フィールドの検証
      const validationResult = this.validateWebhookPayload(webhookData)
      if (!validationResult.valid) {
        logger.error('Webhook payload validation failed', {
          errors: validationResult.errors,
          tx_hash: webhookData.tx_hash
        })
        res.status(400).json({ 
          error: 'Invalid payload', 
          details: validationResult.errors 
        })
        return
      }

      loggerHelpers.payment.received('MINARA webhook received', {
        amount: webhookData.amount,
        currency: webhookData.currency,
        from_wallet: this.maskWallet(webhookData.from_wallet),
        to_wallet: this.maskWallet(webhookData.to_wallet),
        tx_hash: webhookData.tx_hash,
        memo: webhookData.memo ? 'present' : 'none'
      })

      // 4. 重複処理チェック
      const isDuplicate = await this.checkDuplicateTransaction(webhookData.tx_hash)
      if (isDuplicate) {
        logger.warn('Duplicate transaction webhook', {
          tx_hash: webhookData.tx_hash
        })
        res.json({ success: true, message: 'Already processed' })
        return
      }

      // 5. 支払いタイプの判定と処理
      const paymentType = this.determinePaymentType(webhookData.amount)
      let processResult = false

      switch (paymentType) {
        case 'initial':
          processResult = await this.payment.processInitialPayment(webhookData)
          break
        case 'monthly':
          processResult = await this.payment.processMonthlyPayment(webhookData)
          break
        default:
          logger.warn('Unknown payment type', {
            amount: webhookData.amount,
            tx_hash: webhookData.tx_hash
          })
          res.status(400).json({ error: 'Unknown payment type' })
          return
      }

      // 6. レスポンス
      if (processResult) {
        perf.finish({ success: true, payment_type: paymentType })
        res.json({ success: true, payment_type: paymentType })
      } else {
        perf.finishWithError(new Error('Payment processing failed'))
        res.status(500).json({ success: false, error: 'Payment processing failed' })
      }

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Webhook processing error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip
      })
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }

  // Webhook ペイロードの検証
  private validateWebhookPayload(data: PaymentWebhookData): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!data.from_wallet || typeof data.from_wallet !== 'string') {
      errors.push('Missing or invalid from_wallet')
    }

    if (!data.to_wallet || typeof data.to_wallet !== 'string') {
      errors.push('Missing or invalid to_wallet')
    }

    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
      errors.push('Missing or invalid amount')
    }

    if (!data.currency || typeof data.currency !== 'string') {
      errors.push('Missing or invalid currency')
    }

    if (!data.tx_hash || typeof data.tx_hash !== 'string') {
      errors.push('Missing or invalid tx_hash')
    }

    if (!data.timestamp || typeof data.timestamp !== 'string') {
      errors.push('Missing or invalid timestamp')
    }

    // マスターウォレット宛かどうかを確認
    if (data.to_wallet !== config.minara.masterWallet) {
      errors.push('Payment not sent to master wallet')
    }

    // サポート通貨の確認
    if (!['USDT', 'USD', 'USDC'].includes(data.currency)) {
      errors.push('Unsupported currency')
    }

    // ウォレットアドレス形式の確認
    if (data.from_wallet && !this.isValidWalletAddress(data.from_wallet)) {
      errors.push('Invalid from_wallet format')
    }

    if (data.to_wallet && !this.isValidWalletAddress(data.to_wallet)) {
      errors.push('Invalid to_wallet format')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // 支払いタイプの判定
  private determinePaymentType(amount: number): 'initial' | 'monthly' | 'unknown' {
    if (amount >= config.payment.initialFeeUsd) {
      return 'initial'
    } else if (amount >= 50) { // 月額会費の最低額（仕様書では未定）
      return 'monthly'
    } else {
      return 'unknown'
    }
  }

  // 重複トランザクションチェック
  private async checkDuplicateTransaction(txHash: string): Promise<boolean> {
    try {
      // TODO: データベースで tx_hash の存在確認
      // 現在はモック実装
      return false
    } catch (error: any) {
      logger.error('Duplicate check error', { 
        tx_hash: txHash, 
        error: error.message 
      })
      return false
    }
  }

  // ウォレットアドレス形式の検証
  private isValidWalletAddress(address: string): boolean {
    // 基本的な0xプレフィックス + 40文字の16進数
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // ウォレットアドレスのマスク（ログ用）
  private maskWallet(wallet: string): string {
    if (wallet.length < 10) return '***'
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
  }

  // Webhook 統計情報の取得
  async getWebhookStats(): Promise<{
    total_received: number
    successful_processed: number
    failed_processed: number
    duplicate_attempts: number
    last_24h_count: number
  }> {
    try {
      // TODO: データベースから統計情報を取得
      // 現在はモック値を返す
      return {
        total_received: 45,
        successful_processed: 42,
        failed_processed: 2,
        duplicate_attempts: 1,
        last_24h_count: 3
      }
    } catch (error: any) {
      logger.error('Failed to get webhook stats', { error: error.message })
      return {
        total_received: 0,
        successful_processed: 0,
        failed_processed: 0,
        duplicate_attempts: 0,
        last_24h_count: 0
      }
    }
  }

  // Webhook 受信履歴の取得
  async getWebhookHistory(limit: number = 10): Promise<{
    timestamp: string
    tx_hash: string
    amount: number
    from_wallet: string
    status: 'success' | 'failed' | 'duplicate'
    error?: string
  }[]> {
    try {
      // TODO: データベースから履歴を取得
      // 現在はモック値を返す
      return [
        {
          timestamp: '2026-02-28T00:30:00Z',
          tx_hash: '0xabc123...',
          amount: 700,
          from_wallet: '0x1234...5678',
          status: 'success'
        },
        {
          timestamp: '2026-02-27T15:45:00Z',
          tx_hash: '0xdef456...',
          amount: 700,
          from_wallet: '0x9876...4321',
          status: 'success'
        }
      ]
    } catch (error: any) {
      logger.error('Failed to get webhook history', { error: error.message })
      return []
    }
  }

  // セキュリティアラートの送信
  private async sendSecurityAlert(type: 'invalid_signature' | 'suspicious_payment' | 'multiple_failures', details: any) {
    try {
      // TODO: 通知サービス経由でアラート送信
      logger.warn(`Security alert: ${type}`, details)
    } catch (error: any) {
      logger.error('Failed to send security alert', { 
        type, 
        details, 
        error: error.message 
      })
    }
  }
}
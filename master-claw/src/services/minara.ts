import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import crypto from 'crypto'
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import { 
  MinaraApiResponse, 
  SendTransactionRequest, 
  SendTransactionResponse,
  PaymentWebhookData 
} from '@/types'

export class MinaraService {
  private client: AxiosInstance
  private readonly maxRetries = 3
  private readonly retryDelay = 1000 // ms

  constructor() {
    this.client = axios.create({
      baseURL: config.minara.apiEndpoint,
      timeout: 30000, // 30秒
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.minara.apiKey}`,
        'User-Agent': `OPENCLAW-Master/${process.env.npm_package_version || '1.0.0'}`
      }
    })

    // リクエストインターセプター
    this.client.interceptors.request.use(
      (config) => {
        loggerHelpers.minara.request('MINARA API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? 'present' : 'none'
        })
        return config
      },
      (error) => {
        loggerHelpers.minara.error('MINARA API request error', { error: error.message })
        return Promise.reject(error)
      }
    )

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        loggerHelpers.minara.response('MINARA API response', {
          status: response.status,
          url: response.config.url
        })
        return response
      },
      (error) => {
        loggerHelpers.minara.error('MINARA API response error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        })
        return Promise.reject(error)
      }
    )
  }

  // Webhookの署名検証
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', config.security.webhookSecret)
        .update(payload)
        .digest('hex')

      const providedSignature = signature.replace('sha256=', '')
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )
    } catch (error: any) {
      loggerHelpers.security.suspicious('Webhook signature verification failed', {
        error: error.message,
        signature
      })
      return false
    }
  }

  // ウォレット残高の取得
  async getWalletBalance(walletAddress?: string): Promise<number | null> {
    const perf = new PerformanceLogger('getWalletBalance', { walletAddress })
    
    try {
      const address = walletAddress || config.minara.masterWallet
      const response = await this.client.get(`/wallet/${address}/balance`)
      
      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to get wallet balance')
      }

      const balance = response.data.data.balance
      perf.finish({ balance })
      return balance
    } catch (error: any) {
      perf.finishWithError(error)
      return null
    }
  }

  // 送金処理
  async sendTransaction(
    toWallet: string, 
    amount: number, 
    memo?: string
  ): Promise<SendTransactionResponse | null> {
    const perf = new PerformanceLogger('sendTransaction', {
      toWallet: this.maskWallet(toWallet),
      amount,
      memo: memo ? 'present' : 'none'
    })

    try {
      const requestData: SendTransactionRequest = {
        from_wallet: config.minara.masterWallet,
        to_wallet: toWallet,
        amount,
        currency: 'USDT',
        memo
      }

      const response = await this.retryRequest(async () => {
        return await this.client.post('/transactions/send', requestData)
      })

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Transaction failed')
      }

      const result = response.data.data as SendTransactionResponse
      perf.finish({ tx_hash: result.tx_hash, status: result.status })
      
      return result
    } catch (error: any) {
      perf.finishWithError(error)
      return null
    }
  }

  // バッチ送金処理（月次報酬用）
  async sendBatchTransactions(transactions: Array<{
    to_wallet: string
    amount: number
    memo?: string
  }>): Promise<{
    successful: Array<{ to_wallet: string; tx_hash: string }>
    failed: Array<{ to_wallet: string; error: string }>
  }> {
    const perf = new PerformanceLogger('sendBatchTransactions', {
      count: transactions.length,
      total_amount: transactions.reduce((sum, tx) => sum + tx.amount, 0)
    })

    const successful: Array<{ to_wallet: string; tx_hash: string }> = []
    const failed: Array<{ to_wallet: string; error: string }> = []

    try {
      // 並列処理（最大5つ同時）
      const chunks = this.chunkArray(transactions, 5)
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (transaction) => {
          try {
            const result = await this.sendTransaction(
              transaction.to_wallet,
              transaction.amount,
              transaction.memo
            )

            if (result?.tx_hash) {
              successful.push({
                to_wallet: transaction.to_wallet,
                tx_hash: result.tx_hash
              })
            } else {
              failed.push({
                to_wallet: transaction.to_wallet,
                error: 'Transaction returned null result'
              })
            }
          } catch (error: any) {
            failed.push({
              to_wallet: transaction.to_wallet,
              error: error.message
            })
          }
        })

        await Promise.all(promises)
        
        // チャンク間でレート制限を避けるための待機
        if (chunks.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      perf.finish({ successful: successful.length, failed: failed.length })
      return { successful, failed }
    } catch (error: any) {
      perf.finishWithError(error)
      return { successful, failed }
    }
  }

  // トランザクション状態の確認
  async getTransactionStatus(txHash: string): Promise<{
    status: 'pending' | 'confirmed' | 'failed'
    confirmations: number
    block_height?: number
  } | null> {
    const perf = new PerformanceLogger('getTransactionStatus', { tx_hash: txHash })

    try {
      const response = await this.client.get(`/transactions/${txHash}`)

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Failed to get transaction status')
      }

      const result = response.data.data
      perf.finish({ status: result.status, confirmations: result.confirmations })
      
      return result
    } catch (error: any) {
      perf.finishWithError(error)
      return null
    }
  }

  // 自然言語トレード実行
  async executeNaturalLanguageTrade(
    walletAddress: string, 
    naturalLanguage: string,
    maxPositionSizePercent: number = 5
  ): Promise<{ success: boolean; trade_id?: string; error?: string }> {
    const perf = new PerformanceLogger('executeNaturalLanguageTrade', {
      wallet: this.maskWallet(walletAddress),
      max_position_size: maxPositionSizePercent
    })

    try {
      const requestData = {
        wallet_address: walletAddress,
        instruction: naturalLanguage,
        max_position_size_percent: maxPositionSizePercent,
        auto_execute: true
      }

      const response = await this.retryRequest(async () => {
        return await this.client.post('/trade/natural-language', requestData)
      })

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'Trade execution failed')
      }

      const result = response.data.data
      perf.finish({ trade_id: result.trade_id })
      
      return { success: true, trade_id: result.trade_id }
    } catch (error: any) {
      perf.finishWithError(error)
      return { success: false, error: error.message }
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 })
      return response.status === 200 && response.data.status === 'healthy'
    } catch (error: any) {
      logger.error('MINARA health check failed', { error: error.message })
      return false
    }
  }

  // リトライ処理
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await requestFn()
    } catch (error: any) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        logger.warn(`MINARA API request failed, retrying (${retryCount + 1}/${this.maxRetries})`, {
          error: error.message,
          status: error.response?.status
        })
        
        await new Promise(resolve => 
          setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount))
        )
        
        return this.retryRequest(requestFn, retryCount + 1)
      }
      throw error
    }
  }

  // リトライ可能なエラーかどうかを判定
  private isRetryableError(error: any): boolean {
    if (!error.response) return true // ネットワークエラー
    
    const status = error.response.status
    // 5xx系エラー、429（レート制限）、502/503/504（ゲートウェイエラー）
    return status >= 500 || status === 429 || [502, 503, 504].includes(status)
  }

  // 配列を指定サイズのチャンクに分割
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // ウォレットアドレスをマスク（ログ用）
  private maskWallet(wallet: string): string {
    if (wallet.length < 10) return '***'
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
  }

  // 現在の為替レート取得（USD/USDT）
  async getExchangeRate(from: string = 'USD', to: string = 'USDT'): Promise<number | null> {
    try {
      const response = await this.client.get(`/exchange-rate/${from}/${to}`)
      
      if (!response.data.success) {
        throw new Error('Failed to get exchange rate')
      }

      return response.data.data.rate
    } catch (error: any) {
      logger.error('Failed to get exchange rate', { from, to, error: error.message })
      return null
    }
  }
}
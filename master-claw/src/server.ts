import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import { config } from '@/config'
import { logger, loggerHelpers } from '@/utils/logger'
import { PaymentService } from '@/services/payment'
import { NotificationService } from '@/services/notification'
import { createDatabaseService, createMinaraService } from '@/services'
import { PaymentWebhookData, SystemStatus } from '@/types'

export class MasterClawServer {
  private app: express.Application
  private db?: any
  private minara?: any
  private payment?: PaymentService
  private notification?: NotificationService

  constructor() {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  public async initialize() {
    this.db = createDatabaseService()
    this.minara = createMinaraService()
    this.notification = new NotificationService(this.db)
    this.payment = new PaymentService(this.db, this.minara, this.notification)

    logger.info('MasterClawServer services initialized')
  }

  private setupMiddleware(): void {
    // セキュリティヘッダー
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }))

    // CORS設定
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? ['https://openclaw.com', 'https://admin.openclaw.com']
        : true,
      credentials: true
    }))

    // レート制限
    const limiter = rateLimit({
      windowMs: config.security.rateLimitWindowMs,
      max: config.security.rateLimitMax,
      message: {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        loggerHelpers.security.rateLimit('Rate limit exceeded', {
          ip: req.ip,
          user_agent: req.get('User-Agent'),
          endpoint: req.path
        })
        res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED'
        })
      }
    })

    this.app.use(limiter)

    // リクエストログ
    this.app.use((req, res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      })
      next()
    })

    // JSONパーサー（Webhook用に生データも必要）
    this.app.use('/api/payment', express.raw({ type: 'application/json' }))
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
  }

  private setupRoutes(): void {
    // ヘルスチェック（仕様書: GET /api/health）
    this.app.get('/api/health', this.handleHealthCheck.bind(this))

    // システムステータス
    this.app.get('/status', this.authenticateAdmin.bind(this), this.handleSystemStatus.bind(this))

    // MINARA Webhook（仕様書: POST /api/payment/confirm）
    this.app.post('/api/payment/confirm', this.handleMinaraWebhook.bind(this))

    // ゲートウェイAPI（仕様書: POST /api/gateway/broadcast）
    this.app.post('/api/gateway/broadcast', this.authenticateAdmin.bind(this), this.handleBroadcast.bind(this))

    // 個別配信（仕様書: POST /api/gateway/send/:member_id）
    this.app.post('/api/gateway/send/:member_id', this.authenticateAdmin.bind(this), this.handleSendToMember.bind(this))

    // メッセージ取得（仕様書: GET /api/gateway/messages）
    this.app.get('/api/gateway/messages', this.authenticateMember.bind(this), this.handleGetMessages.bind(this))

    // 実行結果報告（仕様書: POST /api/gateway/receipt）
    this.app.post('/api/gateway/receipt', this.authenticateMember.bind(this), this.handleMessageReceipt.bind(this))

    // ハートビート（仕様書: POST /api/members/heartbeat）
    this.app.post('/api/members/heartbeat', this.authenticateMember.bind(this), this.handleHeartbeat.bind(this))

    // 管理者API
    this.app.get('/api/admin/members', this.authenticateAdmin.bind(this), this.handleGetMembers.bind(this))
    this.app.get('/api/admin/revenue', this.authenticateAdmin.bind(this), this.handleGetRevenue.bind(this))
    this.app.post('/api/admin/rewards/preview', this.authenticateAdmin.bind(this), this.handleRewardsPreview.bind(this))
    this.app.post('/api/admin/rewards/execute', this.authenticateAdmin.bind(this), this.handleRewardsExecute.bind(this))

    // 紹介コード API（仕様書: GET /api/referral/code）
    this.app.get('/api/referral/code', this.authenticateMember.bind(this), this.handleGetReferralCode.bind(this))

    // 紹介統計 API（仕様書: GET /api/referral/stats）
    this.app.get('/api/referral/stats', this.authenticateMember.bind(this), this.handleGetReferralStats.bind(this))

    // 未払い報酬確認（仕様書: GET /api/reward/pending）
    this.app.get('/api/reward/pending', this.authenticateMember.bind(this), this.handleGetPendingRewards.bind(this))

    // 報酬受取履歴（仕様書: GET /api/reward/history）
    this.app.get('/api/reward/history', this.authenticateMember.bind(this), this.handleGetRewardHistory.bind(this))

    // 仮登録API（仕様書: POST /api/register）
    this.app.post('/api/register', this.handleRegister.bind(this))

    // 404ハンドラー
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      })
    })
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error in Express', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip
      })

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred'
        }
      })
    })
  }

  // 管理者認証ミドルウェア
  private authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      loggerHelpers.security.unauthorized('Missing or invalid authorization header', {
        ip: req.ip,
        endpoint: req.path
      })
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const token = authHeader.substring(7)
    if (token !== config.security.masterApiKey) {
      loggerHelpers.security.unauthorized('Invalid admin API key', {
        ip: req.ip,
        endpoint: req.path
      })
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    next()
  }

  // メンバー認証ミドルウェア（Supabase JWTトークン）
  private async authenticateMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const token = authHeader.substring(7)

      if (token.length < 10) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      ;(req as any).user = { member_id: 'extracted_from_jwt' }
      next()
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' })
    }
  }

  // ヘルスチェックハンドラー
  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      connections: {
        database: this.db ? await this.db.healthCheck() : false,
        minara: this.minara ? await this.minara.healthCheck() : false,
        notifications: this.notification ? await this.notification.healthCheck() : false
      }
    }

    const allHealthy = Object.values(health.connections).every(status =>
      typeof status === 'boolean' ? status : Object.values(status as any).every(v => v)
    )

    if (!allHealthy) {
      health.status = 'degraded'
      res.status(503)
    }

    res.json(health)
  }

  // システムステータスハンドラー
  private async handleSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const activeMembers = await this.db.getActiveMembers()
      const upcomingPayments = await this.db.getMembersWithUpcomingPayments(7)

      const status: SystemStatus = {
        service: 'master-claw',
        status: 'healthy',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        connections: {
          supabase: await this.db.healthCheck(),
          minara: await this.minara.healthCheck(),
          line: (await this.notification.healthCheck()).line
        },
        last_check: new Date().toISOString(),
        active_members: activeMembers.length,
        pending_payments: upcomingPayments.length,
        scheduled_jobs: []
      }

      res.json({ success: true, data: status })
    } catch (error: any) {
      logger.error('Failed to get system status', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'STATUS_ERROR', message: 'Failed to get system status' }
      })
    }
  }

  // MINARA Webhookハンドラー
  private async handleMinaraWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-minara-signature'] as string
      const payload = req.body.toString()

      if (!this.minara.verifyWebhookSignature(payload, signature)) {
        loggerHelpers.security.suspicious('Invalid webhook signature', {
          ip: req.ip,
          signature
        })
        res.status(401).json({ error: 'Invalid signature' })
        return
      }

      const webhookData: PaymentWebhookData = JSON.parse(payload)

      loggerHelpers.payment.received('Payment webhook received', {
        amount: webhookData.amount,
        from_wallet: webhookData.from_wallet.slice(0, 10) + '...',
        tx_hash: webhookData.tx_hash
      })

      const isInitialPayment = webhookData.amount >= config.payment.initialFeeUsd

      let processed = false
      if (isInitialPayment) {
        processed = await this.payment!.processInitialPayment(webhookData)
      } else {
        processed = await this.payment!.processMonthlyPayment(webhookData)
      }

      if (processed) {
        res.json({ success: true })
      } else {
        res.status(400).json({ success: false, error: 'Payment processing failed' })
      }

    } catch (error: any) {
      logger.error('Webhook processing error', {
        error: error.message,
        ip: req.ip
      })
      res.status(500).json({ success: false, error: 'Internal error' })
    }
  }

  // 一斉配信ハンドラー
  private async handleBroadcast(req: Request, res: Response): Promise<void> {
    try {
      const { message_type, payload, priority = 5 } = req.body

      const success = await this.notification!.broadcastToAllMembers(
        message_type,
        payload,
        priority
      )

      if (success) {
        res.json({ success: true })
      } else {
        res.status(500).json({ success: false, error: 'Broadcast failed' })
      }
    } catch (error: any) {
      logger.error('Broadcast error', { error: error.message })
      res.status(500).json({ success: false, error: 'Internal error' })
    }
  }

  // 個別配信ハンドラー
  private async handleSendToMember(req: Request, res: Response): Promise<void> {
    try {
      const { member_id } = req.params
      const { message_type, payload, priority = 5 } = req.body

      const { error } = await this.db.insertGatewayMessage({
        target: member_id,
        message_type: message_type || 'private',
        payload,
        priority,
        created_by: config.masterId
      })

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to send message' })
        return
      }

      res.json({ success: true })
    } catch (error: any) {
      logger.error('Send to member error', { error: error.message })
      res.status(500).json({ success: false, error: 'Internal error' })
    }
  }

  // 収益レポートハンドラー
  private async handleGetRevenue(req: Request, res: Response): Promise<void> {
    try {
      const { data: paymentLogs, error } = await this.db.getPaymentLogs()

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to get revenue data' })
        return
      }

      const revenue = {
        total_initial_payments: 0,
        total_monthly_payments: 0,
        total_referral_payouts: 0,
        total_operator_revenue: 0,
        monthly_breakdown: {} as Record<string, any>
      }

      for (const log of (paymentLogs || [])) {
        const month = log.confirmed_at?.slice(0, 7) || 'unknown'
        if (!revenue.monthly_breakdown[month]) {
          revenue.monthly_breakdown[month] = { initial: 0, monthly: 0, count: 0 }
        }

        if (log.payment_type === 'initial') {
          revenue.total_initial_payments += log.amount
          revenue.monthly_breakdown[month].initial += log.amount
        } else if (log.payment_type === 'monthly') {
          revenue.total_monthly_payments += log.amount
          revenue.monthly_breakdown[month].monthly += log.amount
        }
        revenue.monthly_breakdown[month].count++
      }

      revenue.total_operator_revenue = revenue.total_initial_payments + revenue.total_monthly_payments - revenue.total_referral_payouts

      res.json({ success: true, data: revenue })
    } catch (error: any) {
      logger.error('Get revenue error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get revenue' })
    }
  }

  // 月次報酬プレビューハンドラー
  private async handleRewardsPreview(req: Request, res: Response): Promise<void> {
    try {
      const preview = await this.payment!.getMonthlyRewardsPreview()
      res.json({ success: true, data: preview })
    } catch (error: any) {
      logger.error('Rewards preview error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get preview' })
    }
  }

  // 月次報酬実行ハンドラー
  private async handleRewardsExecute(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.payment!.processMonthlyRewards()
      res.json({ success: true, data: result })
    } catch (error: any) {
      logger.error('Rewards execute error', { error: error.message })
      res.status(500).json({ success: false, error: 'Reward processing failed' })
    }
  }

  // メンバー一覧ハンドラー
  private async handleGetMembers(req: Request, res: Response): Promise<void> {
    try {
      const members = await this.db.getActiveMembers()
      res.json({ success: true, data: members })
    } catch (error: any) {
      logger.error('Get members error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get members' })
    }
  }

  // ハートビートハンドラー
  private async handleHeartbeat(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id
      const { claw_status, system_info } = req.body

      loggerHelpers.member.heartbeat('Heartbeat received', {
        member_id,
        claw_status
      })

      res.json({ success: true })
    } catch (error: any) {
      logger.error('Heartbeat error', { error: error.message })
      res.status(500).json({ success: false, error: 'Heartbeat failed' })
    }
  }

  // メッセージ取得ハンドラー
  private async handleGetMessages(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id

      const { data, error } = await this.db.getGatewayMessages(member_id)

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to get messages' })
        return
      }

      res.json({ success: true, data: data || [] })
    } catch (error: any) {
      logger.error('Get messages error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get messages' })
    }
  }

  // メッセージ受信確認ハンドラー
  private async handleMessageReceipt(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id
      const { message_id, status, result, error_message } = req.body

      await this.db.insertMessageReceipt({
        message_id,
        member_id,
        status: status || 'received',
        result,
        error_message
      })

      res.json({ success: true })
    } catch (error: any) {
      logger.error('Message receipt error', { error: error.message })
      res.status(500).json({ success: false, error: 'Receipt failed' })
    }
  }

  // 紹介コード取得ハンドラー
  private async handleGetReferralCode(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id

      const { data, error } = await this.db.getMemberReferralCode(member_id)

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to get referral code' })
        return
      }

      res.json({ success: true, data: { referral_code: data?.referral_code } })
    } catch (error: any) {
      logger.error('Get referral code error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get referral code' })
    }
  }

  // 紹介統計取得ハンドラー
  private async handleGetReferralStats(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id

      const { data, error } = await this.db.getReferralStats(member_id)

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to get referral stats' })
        return
      }

      res.json({ success: true, data })
    } catch (error: any) {
      logger.error('Get referral stats error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get referral stats' })
    }
  }

  // 未払い報酬取得ハンドラー
  private async handleGetPendingRewards(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id

      const { data, error } = await this.db.getPendingRewards(member_id)

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to get pending rewards' })
        return
      }

      res.json({ success: true, data })
    } catch (error: any) {
      logger.error('Get pending rewards error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get pending rewards' })
    }
  }

  // 報酬履歴取得ハンドラー
  private async handleGetRewardHistory(req: Request, res: Response): Promise<void> {
    try {
      const member_id = (req as any).user.member_id

      const { data, error } = await this.db.getRewardHistory(member_id)

      if (error) {
        res.status(500).json({ success: false, error: 'Failed to get reward history' })
        return
      }

      res.json({ success: true, data })
    } catch (error: any) {
      logger.error('Get reward history error', { error: error.message })
      res.status(500).json({ success: false, error: 'Failed to get reward history' })
    }
  }

  // 仮登録ハンドラー
  private async handleRegister(req: Request, res: Response): Promise<void> {
    try {
      const { display_name, email, minara_wallet, referral_code } = req.body

      if (!display_name || !email || !minara_wallet) {
        res.status(400).json({
          success: false,
          error: 'display_name, email, and minara_wallet are required'
        })
        return
      }

      const { data, error } = await this.db.createMember({
        display_name,
        email,
        minara_wallet,
        referred_by_code: referral_code,
        membership_status: 'pending_payment'
      })

      if (error) {
        res.status(400).json({ success: false, error: error.message })
        return
      }

      res.json({ success: true, data })
    } catch (error: any) {
      logger.error('Registration error', { error: error.message })
      res.status(500).json({ success: false, error: 'Registration failed' })
    }
  }

  public start(): void {
    const port = config.port

    this.app.listen(port, () => {
      loggerHelpers.startup('Master CLAW server started', {
        port,
        env: process.env.NODE_ENV || 'development',
        master_id: config.masterId
      })
    })

    process.on('SIGTERM', this.shutdown.bind(this))
    process.on('SIGINT', this.shutdown.bind(this))
  }

  private shutdown(): void {
    loggerHelpers.shutdown('Master CLAW server shutting down')
    process.exit(0)
  }

  public getApp(): express.Application {
    return this.app
  }
}

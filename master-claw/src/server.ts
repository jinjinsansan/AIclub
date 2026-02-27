import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import { config } from '@/config'
import { logger, loggerHelpers } from '@/utils/logger'
import { DatabaseService } from '@/services/database'
import { MinaraService } from '@/services/minara'
import { PaymentService } from '@/services/payment'
import { NotificationService } from '@/services/notification'
import { PaymentWebhookData, SystemStatus } from '@/types'

export class MasterClawServer {
  private app: express.Application
  private db: DatabaseService
  private minara: MinaraService
  private payment: PaymentService
  private notification: NotificationService

  constructor() {
    this.app = express()
    this.db = new DatabaseService()
    this.minara = new MinaraService()
    this.notification = new NotificationService(this.db)
    this.payment = new PaymentService(this.db, this.minara, this.notification)

    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
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
    this.app.use('/webhook', express.raw({ type: 'application/json' }))
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
  }

  private setupRoutes(): void {
    // ヘルスチェック
    this.app.get('/health', this.handleHealthCheck.bind(this))

    // システムステータス
    this.app.get('/status', this.authenticateAdmin.bind(this), this.handleSystemStatus.bind(this))

    // MINARA Webhook
    this.app.post('/webhook/minara/payment', this.handleMinaraWebhook.bind(this))

    // 管理者API
    this.app.post('/api/admin/broadcast', this.authenticateAdmin.bind(this), this.handleBroadcast.bind(this))
    this.app.post('/api/admin/rewards/process', this.authenticateAdmin.bind(this), this.handleProcessRewards.bind(this))
    this.app.get('/api/admin/members', this.authenticateAdmin.bind(this), this.handleGetMembers.bind(this))

    // メンバーCLAW API
    this.app.post('/api/members/heartbeat', this.authenticateMember.bind(this), this.handleHeartbeat.bind(this))
    this.app.get('/api/members/messages', this.authenticateMember.bind(this), this.handleGetMessages.bind(this))
    this.app.post('/api/members/receipt', this.authenticateMember.bind(this), this.handleMessageReceipt.bind(this))

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
    // エラーハンドラー
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
      
      // Supabase JWTトークンの検証（簡易版）
      // 実際の実装ではSupabaseクライアントを使用してトークンを検証
      // const { user, error } = await supabase.auth.getUser(token)
      
      // 暫定的にトークンの存在のみチェック
      if (token.length < 10) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }

      // リクエストにユーザー情報を追加
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
        database: await this.db.healthCheck(),
        minara: await this.minara.healthCheck(),
        notifications: await this.notification.healthCheck()
      }
    }

    const allHealthy = Object.values(health.connections).every(status => 
      typeof status === 'boolean' ? status : Object.values(status).every(v => v)
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
        scheduled_jobs: [] // TODO: 実際のジョブ情報
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

      // 署名検証
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

      // 初期費用として処理（金額で判定）
      const isInitialPayment = webhookData.amount >= config.payment.initialFeeUsd

      let processed = false
      if (isInitialPayment) {
        processed = await this.payment.processInitialPayment(webhookData)
      } else {
        processed = await this.payment.processMonthlyPayment(webhookData)
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
      const { message_type, payload, priority = 5, target = 'all' } = req.body

      const success = await this.notification.broadcastToAllMembers(
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

  // 月次報酬処理ハンドラー
  private async handleProcessRewards(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.payment.processMonthlyRewards()
      res.json({ success: true, data: result })
    } catch (error: any) {
      logger.error('Reward processing error', { error: error.message })
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

      // メンバーの最終確認時刻を更新
      // TODO: 実装
      
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
      
      // TODO: メンバー向けメッセージの取得実装
      
      res.json({ success: true, data: [] })
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

      // TODO: メッセージ受信確認の記録実装

      res.json({ success: true })
    } catch (error: any) {
      logger.error('Message receipt error', { error: error.message })
      res.status(500).json({ success: false, error: 'Receipt failed' })
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

    // Graceful shutdown
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
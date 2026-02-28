// システム監視・アラートサービス
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import { DatabaseService } from './database'
import { MinaraService } from './minara'
import { NotificationService } from './notification'
import { LineNotificationService } from './line'
import axios from 'axios'

interface SystemHealth {
  database: {
    status: 'healthy' | 'warning' | 'critical'
    response_time_ms: number
    last_check: string
    error?: string
  }
  minara_api: {
    status: 'healthy' | 'warning' | 'critical'
    response_time_ms: number
    last_successful_call: string
    error?: string
  }
  webhook_receiver: {
    status: 'healthy' | 'warning' | 'critical'
    last_webhook_received: string
    pending_count: number
    failed_count_24h: number
  }
  line_bot: {
    status: 'healthy' | 'warning' | 'critical'
    last_message_sent: string
    delivery_success_rate: number
    error?: string
  }
  overall: {
    status: 'healthy' | 'warning' | 'critical'
    uptime_percentage: number
    last_health_check: string
  }
}

interface SystemMetrics {
  timestamp: string
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  active_connections: number
  error_count_1h: number
  error_count_24h: number
  webhook_success_rate: number
  payment_success_rate: number
}

interface AlertRule {
  id: string
  name: string
  condition: string
  threshold: number
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  cooldown_minutes: number
  last_triggered?: string
}

export class MonitoringService {
  private db: DatabaseService
  private minara: MinaraService
  private notification: NotificationService
  private lineNotification: LineNotificationService
  private healthCheckInterval?: NodeJS.Timeout
  private metricsCollectionInterval?: NodeJS.Timeout
  private alertRules: AlertRule[]

  constructor(
    db: DatabaseService,
    minara: MinaraService,
    notification: NotificationService,
    lineNotification: LineNotificationService
  ) {
    this.db = db
    this.minara = minara
    this.notification = notification
    this.lineNotification = lineNotification

    // デフォルトアラートルール
    this.alertRules = [
      {
        id: 'db_response_time',
        name: 'データベース応答時間',
        condition: 'database_response_time > threshold',
        threshold: 1000, // 1秒
        severity: 'warning',
        enabled: true,
        cooldown_minutes: 5
      },
      {
        id: 'webhook_failure_rate',
        name: 'Webhook失敗率',
        condition: 'webhook_failure_rate > threshold',
        threshold: 5, // 5%
        severity: 'critical',
        enabled: true,
        cooldown_minutes: 15
      },
      {
        id: 'minara_api_down',
        name: 'MINARA API障害',
        condition: 'minara_api_status == critical',
        threshold: 0,
        severity: 'critical',
        enabled: true,
        cooldown_minutes: 10
      },
      {
        id: 'system_uptime',
        name: 'システム稼働率',
        condition: 'uptime_percentage < threshold',
        threshold: 99.0, // 99%
        severity: 'warning',
        enabled: true,
        cooldown_minutes: 30
      }
    ]
  }

  // 監視サービスの開始
  async start(): Promise<void> {
    try {
      logger.info('Starting monitoring service...')

      // ヘルスチェックを5分間隔で実行
      this.healthCheckInterval = setInterval(
        () => this.performHealthCheck(),
        5 * 60 * 1000 // 5分
      )

      // メトリクス収集を1分間隔で実行
      this.metricsCollectionInterval = setInterval(
        () => this.collectMetrics(),
        60 * 1000 // 1分
      )

      // 初回実行
      await this.performHealthCheck()
      await this.collectMetrics()

      logger.info('Monitoring service started successfully')
    } catch (error: any) {
      logger.error('Failed to start monitoring service', { error: error.message })
      throw error
    }
  }

  // 監視サービスの停止
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
      this.metricsCollectionInterval = undefined
    }

    logger.info('Monitoring service stopped')
  }

  // システムヘルスチェック
  async performHealthCheck(): Promise<SystemHealth> {
    const perf = new PerformanceLogger('system-health-check')

    try {
      const healthCheck = {
        database: await this.checkDatabaseHealth(),
        minara_api: await this.checkMinaraHealth(),
        webhook_receiver: await this.checkWebhookHealth(),
        line_bot: await this.checkLineBotHealth(),
        overall: {
          status: 'healthy' as const,
          uptime_percentage: 99.97,
          last_health_check: new Date().toISOString()
        }
      }

      // 全体ステータスの決定
      const statuses = [
        healthCheck.database.status,
        healthCheck.minara_api.status,
        healthCheck.webhook_receiver.status,
        healthCheck.line_bot.status
      ]

      if (statuses.includes('critical')) {
        healthCheck.overall.status = 'critical'
      } else if (statuses.includes('warning')) {
        healthCheck.overall.status = 'warning'
      }

      // アラートルールのチェック
      await this.checkAlertRules(healthCheck)

      // ヘルスチェック結果をログ
      loggerHelpers.system.monitoring('Health check completed', {
        overall_status: healthCheck.overall.status,
        database: healthCheck.database.status,
        minara_api: healthCheck.minara_api.status,
        webhook: healthCheck.webhook_receiver.status,
        line_bot: healthCheck.line_bot.status
      })

      perf.finish({ overall_status: healthCheck.overall.status })
      return healthCheck

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Health check failed', { error: error.message })

      // 緊急アラートの送信
      await this.sendCriticalAlert(
        'システムヘルスチェック失敗',
        `ヘルスチェック処理でエラーが発生しました: ${error.message}`
      )

      throw error
    }
  }

  // データベースヘルスチェック
  private async checkDatabaseHealth(): Promise<SystemHealth['database']> {
    const startTime = Date.now()

    try {
      const isHealthy = await this.db.healthCheck()
      const responseTime = Date.now() - startTime

      return {
        status: isHealthy ? 'healthy' : 'critical',
        response_time_ms: responseTime,
        last_check: new Date().toISOString(),
        error: isHealthy ? undefined : 'Database connection failed'
      }
    } catch (error: any) {
      return {
        status: 'critical',
        response_time_ms: Date.now() - startTime,
        last_check: new Date().toISOString(),
        error: error.message
      }
    }
  }

  // MINARA APIヘルスチェック
  private async checkMinaraHealth(): Promise<SystemHealth['minara_api']> {
    const startTime = Date.now()

    try {
      const isHealthy = await this.minara.healthCheck()
      const responseTime = Date.now() - startTime

      return {
        status: isHealthy ? 'healthy' : 'critical',
        response_time_ms: responseTime,
        last_successful_call: isHealthy ? new Date().toISOString() : '',
        error: isHealthy ? undefined : 'MINARA API connection failed'
      }
    } catch (error: any) {
      return {
        status: 'critical',
        response_time_ms: Date.now() - startTime,
        last_successful_call: '',
        error: error.message
      }
    }
  }

  // Webhookヘルスチェック
  private async checkWebhookHealth(): Promise<SystemHealth['webhook_receiver']> {
    try {
      // TODO: 実際の統計データを取得
      // const webhookStats = await this.getWebhookStats()

      // モックデータ
      const lastWebhookReceived = '2026-02-28T01:45:23Z'
      const pendingCount = 0
      const failedCount24h = 1

      const timeSinceLastWebhook = Date.now() - new Date(lastWebhookReceived).getTime()
      const hoursWithoutWebhook = timeSinceLastWebhook / (1000 * 60 * 60)

      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      
      if (hoursWithoutWebhook > 24) {
        status = 'critical'
      } else if (hoursWithoutWebhook > 6 || failedCount24h > 5) {
        status = 'warning'
      }

      return {
        status,
        last_webhook_received: lastWebhookReceived,
        pending_count: pendingCount,
        failed_count_24h: failedCount24h
      }
    } catch (error: any) {
      return {
        status: 'critical',
        last_webhook_received: '',
        pending_count: 0,
        failed_count_24h: 0
      }
    }
  }

  // LINE Botヘルスチェック
  private async checkLineBotHealth(): Promise<SystemHealth['line_bot']> {
    try {
      // TODO: 実際のLINE Bot統計を取得
      // const notificationStats = await this.lineNotification.getNotificationStats()

      // モックデータ
      const stats = {
        last_message_sent: '2026-02-28T01:30:00Z',
        delivery_success_rate: 98.5,
        total_sent: 156
      }

      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      
      if (stats.delivery_success_rate < 90) {
        status = 'critical'
      } else if (stats.delivery_success_rate < 95) {
        status = 'warning'
      }

      return {
        status,
        last_message_sent: stats.last_message_sent,
        delivery_success_rate: stats.delivery_success_rate,
        error: status !== 'healthy' ? 'Low delivery success rate' : undefined
      }
    } catch (error: any) {
      return {
        status: 'critical',
        last_message_sent: '',
        delivery_success_rate: 0,
        error: error.message
      }
    }
  }

  // システムメトリクス収集
  async collectMetrics(): Promise<SystemMetrics> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        cpu_usage: await this.getCpuUsage(),
        memory_usage: await this.getMemoryUsage(),
        disk_usage: await this.getDiskUsage(),
        active_connections: await this.getActiveConnections(),
        error_count_1h: await this.getErrorCount(1),
        error_count_24h: await this.getErrorCount(24),
        webhook_success_rate: await this.getWebhookSuccessRate(),
        payment_success_rate: await this.getPaymentSuccessRate()
      }

      // メトリクスをデータベースに保存
      await this.saveMetrics(metrics)

      return metrics
    } catch (error: any) {
      logger.error('Failed to collect metrics', { error: error.message })
      throw error
    }
  }

  // アラートルールチェック
  private async checkAlertRules(healthCheck: SystemHealth): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue

      try {
        const shouldTrigger = await this.evaluateAlertRule(rule, healthCheck)
        
        if (shouldTrigger) {
          // クールダウン期間チェック
          if (rule.last_triggered) {
            const cooldownExpired = 
              Date.now() - new Date(rule.last_triggered).getTime() > 
              rule.cooldown_minutes * 60 * 1000
            
            if (!cooldownExpired) continue
          }

          await this.triggerAlert(rule, healthCheck)
          rule.last_triggered = new Date().toISOString()
        }
      } catch (error: any) {
        logger.error('Alert rule evaluation failed', {
          rule_id: rule.id,
          error: error.message
        })
      }
    }
  }

  // アラートルールの評価
  private async evaluateAlertRule(rule: AlertRule, healthCheck: SystemHealth): Promise<boolean> {
    switch (rule.id) {
      case 'db_response_time':
        return healthCheck.database.response_time_ms > rule.threshold

      case 'webhook_failure_rate':
        const failureRate = (healthCheck.webhook_receiver.failed_count_24h / 100) * 100
        return failureRate > rule.threshold

      case 'minara_api_down':
        return healthCheck.minara_api.status === 'critical'

      case 'system_uptime':
        return healthCheck.overall.uptime_percentage < rule.threshold

      default:
        return false
    }
  }

  // アラートの発行
  private async triggerAlert(rule: AlertRule, healthCheck: SystemHealth): Promise<void> {
    try {
      const alertMessage = this.buildAlertMessage(rule, healthCheck)

      // 運営チームへの通知
      await this.notification.sendSystemAlert({
        severity: rule.severity,
        title: `[${rule.severity.toUpperCase()}] ${rule.name}`,
        message: alertMessage,
        rule_id: rule.id,
        timestamp: new Date().toISOString()
      })

      // 重要なアラートはLINEでも通知
      if (rule.severity === 'critical') {
        await this.lineNotification.sendSystemAlert(
          'error',
          `システムアラート: ${rule.name}`,
          alertMessage
        )
      }

      loggerHelpers.system.alert(`Alert triggered: ${rule.name}`, {
        rule_id: rule.id,
        severity: rule.severity,
        threshold: rule.threshold
      })

    } catch (error: any) {
      logger.error('Failed to send alert', {
        rule_id: rule.id,
        error: error.message
      })
    }
  }

  // アラートメッセージの構築
  private buildAlertMessage(rule: AlertRule, healthCheck: SystemHealth): string {
    const timestamp = new Date().toLocaleString('ja-JP')
    
    switch (rule.id) {
      case 'db_response_time':
        return `データベースの応答時間が${rule.threshold}msを超えています。\n` +
               `現在の応答時間: ${healthCheck.database.response_time_ms}ms\n` +
               `時刻: ${timestamp}`

      case 'webhook_failure_rate':
        return `Webhook受信の失敗率が${rule.threshold}%を超えています。\n` +
               `24時間の失敗数: ${healthCheck.webhook_receiver.failed_count_24h}\n` +
               `時刻: ${timestamp}`

      case 'minara_api_down':
        return `MINARA APIに接続できません。\n` +
               `エラー: ${healthCheck.minara_api.error || '不明'}\n` +
               `時刻: ${timestamp}`

      case 'system_uptime':
        return `システム稼働率が${rule.threshold}%を下回りました。\n` +
               `現在の稼働率: ${healthCheck.overall.uptime_percentage}%\n` +
               `時刻: ${timestamp}`

      default:
        return `アラート: ${rule.name}\n時刻: ${timestamp}`
    }
  }

  // 緊急アラートの送信
  private async sendCriticalAlert(title: string, message: string): Promise<void> {
    try {
      await Promise.all([
        this.notification.sendSystemAlert({
          severity: 'critical',
          title: `[緊急] ${title}`,
          message,
          rule_id: 'emergency',
          timestamp: new Date().toISOString()
        }),
        this.lineNotification.sendSystemAlert('error', title, message)
      ])
    } catch (error: any) {
      // アラート送信も失敗した場合はコンソールログのみ
      console.error('CRITICAL: Failed to send emergency alert', {
        title,
        message,
        error: error.message
      })
    }
  }

  // ヘルパーメソッド（システムメトリクス取得）

  private async getCpuUsage(): Promise<number> {
    try {
      // TODO: 実際のCPU使用率取得
      return Math.random() * 30 + 10 // Mock: 10-40%
    } catch {
      return 0
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const usage = process.memoryUsage()
      return (usage.heapUsed / usage.heapTotal) * 100
    } catch {
      return 0
    }
  }

  private async getDiskUsage(): Promise<number> {
    try {
      // TODO: 実際のディスク使用率取得
      return Math.random() * 20 + 30 // Mock: 30-50%
    } catch {
      return 0
    }
  }

  private async getActiveConnections(): Promise<number> {
    try {
      // TODO: アクティブ接続数の取得
      return Math.floor(Math.random() * 50) + 10 // Mock: 10-60
    } catch {
      return 0
    }
  }

  private async getErrorCount(hours: number): Promise<number> {
    try {
      // TODO: 実際のエラーカウント取得
      return Math.floor(Math.random() * 5) // Mock: 0-4 errors
    } catch {
      return 0
    }
  }

  private async getWebhookSuccessRate(): Promise<number> {
    try {
      // TODO: Webhook成功率の取得
      return 95 + Math.random() * 5 // Mock: 95-100%
    } catch {
      return 0
    }
  }

  private async getPaymentSuccessRate(): Promise<number> {
    try {
      // TODO: 支払い成功率の取得
      return 98 + Math.random() * 2 // Mock: 98-100%
    } catch {
      return 0
    }
  }

  private async saveMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      // TODO: データベースへのメトリクス保存
      logger.debug('Metrics collected', {
        cpu: `${metrics.cpu_usage.toFixed(1)}%`,
        memory: `${metrics.memory_usage.toFixed(1)}%`,
        errors_1h: metrics.error_count_1h,
        webhook_success: `${metrics.webhook_success_rate.toFixed(1)}%`
      })
    } catch (error: any) {
      logger.error('Failed to save metrics', { error: error.message })
    }
  }
}
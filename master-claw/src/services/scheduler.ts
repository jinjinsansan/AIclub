import * as cron from 'node-cron'
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import { PaymentService } from './payment'
import { NotificationService } from './notification'
import { DatabaseService } from './database'
import { MinaraService } from './minara'
import { CronJobResult } from '@/types'

export class SchedulerService {
  private payment: PaymentService
  private notification: NotificationService
  private db: DatabaseService
  private minara: MinaraService
  private jobs: Map<string, cron.ScheduledTask> = new Map()

  constructor(
    payment: PaymentService,
    notification: NotificationService,
    db: DatabaseService,
    minara: MinaraService
  ) {
    this.payment = payment
    this.notification = notification
    this.db = db
    this.minara = minara
  }

  // スケジューラーの初期化・全ジョブの開始
  public initialize(): void {
    logger.info('Initializing scheduled jobs')

    // 1. 支払いリマインダー（毎日10:00に実行）
    this.scheduleJob('payment-reminders', '0 10 * * *', this.checkPaymentReminders.bind(this))

    // 2. 期限切れメンバーのステータス更新（毎日12:00に実行）
    this.scheduleJob('update-expired-members', '0 12 * * *', this.updateExpiredMembers.bind(this))

    // 3. 月次報酬処理（毎月末日の23:00に実行）
    this.scheduleJob('monthly-rewards', '0 23 L * *', this.processMonthlyRewards.bind(this))

    // 4. ヘルスチェック（毎時0分に実行）
    this.scheduleJob('health-check', '0 * * * *', this.performHealthCheck.bind(this))

    // 5. 期限切れメッセージのクリーンアップ（毎日2:00に実行）
    this.scheduleJob('cleanup-messages', '0 2 * * *', this.cleanupExpiredMessages.bind(this))

    // 6. システム統計の更新（毎日1:00に実行）
    this.scheduleJob('update-stats', '0 1 * * *', this.updateSystemStats.bind(this))

    logger.info('Scheduled jobs initialized', { job_count: this.jobs.size })
  }

  // ジョブのスケジューリング
  private scheduleJob(name: string, cronExpression: string, handler: () => Promise<void>): void {
    try {
      // cron表現の検証
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`)
      }

      const task = cron.schedule(cronExpression, async () => {
        await this.executeJobWithErrorHandling(name, handler)
      }, {
        scheduled: true,
        timezone: 'Asia/Tokyo'
      })

      this.jobs.set(name, task)

      logger.info('Scheduled job registered', {
        job_name: name,
        cron_expression: cronExpression
      })

    } catch (error: any) {
      logger.error('Failed to schedule job', {
        job_name: name,
        cron_expression: cronExpression,
        error: error.message
      })
    }
  }

  // エラーハンドリング付きジョブ実行
  private async executeJobWithErrorHandling(jobName: string, handler: () => Promise<void>): Promise<void> {
    const perf = new PerformanceLogger(`scheduled-job-${jobName}`)
    
    try {
      loggerHelpers.startup(`Starting scheduled job: ${jobName}`)
      await handler()
      perf.finish()
      loggerHelpers.startup(`Completed scheduled job: ${jobName}`)

      // 成功をデータベースに記録
      await this.logJobResult({
        job_name: jobName,
        status: 'success',
        processed_count: 0,
        error_count: 0,
        duration_ms: perf.finish()
      })

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error(`Scheduled job failed: ${jobName}`, {
        error: error.message,
        stack: error.stack
      })

      // 失敗をデータベースに記録
      await this.logJobResult({
        job_name: jobName,
        status: 'failed',
        processed_count: 0,
        error_count: 1,
        duration_ms: perf.finishWithError(error),
        errors: [error.message]
      })

      // 重要なジョブの場合はアラート送信
      if (['monthly-rewards', 'payment-reminders'].includes(jobName)) {
        await this.notification.sendSystemAlert(
          'ERROR',
          `Scheduled job failed: ${jobName}`,
          { error: error.message, job_name: jobName }
        )
      }
    }
  }

  // 支払いリマインダーチェック
  private async checkPaymentReminders(): Promise<void> {
    logger.info('Running payment reminders check')
    await this.payment.checkPaymentReminders()
  }

  // 期限切れメンバーの更新
  private async updateExpiredMembers(): Promise<void> {
    logger.info('Updating expired members')
    await this.payment.updateExpiredMembers()
  }

  // 月次報酬処理
  private async processMonthlyRewards(): Promise<void> {
    logger.info('Processing monthly rewards')
    
    const result = await this.payment.processMonthlyRewards()
    
    // 処理結果の管理者通知
    if (result.successful > 0 || result.failed > 0) {
      const message = `月次報酬処理完了:\n成功: ${result.successful}件\n失敗: ${result.failed}件\n総額: $${result.total_amount}`
      
      await this.notification.sendSystemAlert('INFO', message, {
        successful: result.successful,
        failed: result.failed,
        total_amount: result.total_amount
      })
    }
  }

  // システムヘルスチェック
  private async performHealthCheck(): Promise<void> {
    logger.debug('Performing system health check')

    const health = {
      database: await this.db.healthCheck(),
      minara: await this.minara.healthCheck(),
      notifications: await this.notification.healthCheck()
    }

    // 異常を検知した場合はアラート
    const unhealthyServices = Object.entries(health)
      .filter(([_, status]) => {
        if (typeof status === 'boolean') return !status
        return Object.values(status).some(v => !v)
      })
      .map(([name]) => name)

    if (unhealthyServices.length > 0) {
      await this.notification.sendSystemAlert(
        'WARN',
        `Health check detected issues: ${unhealthyServices.join(', ')}`,
        { unhealthy_services: unhealthyServices, health }
      )
    }
  }

  // 期限切れメッセージのクリーンアップ
  private async cleanupExpiredMessages(): Promise<void> {
    logger.debug('Cleaning up expired messages')

    try {
      // データベースの期限切れメッセージ削除関数を呼び出し
      const { data, error } = await this.db.supabase.rpc('cleanup_expired_messages')

      if (error) {
        throw error
      }

      const deletedCount = data || 0
      
      if (deletedCount > 0) {
        logger.info('Expired messages cleaned up', { deleted_count: deletedCount })
      }

    } catch (error: any) {
      logger.error('Failed to cleanup expired messages', { error: error.message })
    }
  }

  // システム統計の更新
  private async updateSystemStats(): Promise<void> {
    logger.debug('Updating system statistics')

    try {
      // アクティブメンバー数などの統計をシステム設定に更新
      const activeMembers = await this.db.getActiveMembers()
      const upcomingPayments = await this.db.getMembersWithUpcomingPayments(7)

      // システム設定テーブルに統計情報を更新
      const stats = {
        active_members: activeMembers.length,
        pending_payments: upcomingPayments.length,
        last_updated: new Date().toISOString()
      }

      await this.db.supabase
        .from('system_config')
        .upsert({
          key: 'system_stats',
          value: stats,
          description: 'System statistics updated by scheduler',
          category: 'statistics',
          updated_by: 'scheduler'
        })

      logger.debug('System statistics updated', stats)

    } catch (error: any) {
      logger.error('Failed to update system statistics', { error: error.message })
    }
  }

  // ジョブ実行結果のログ
  private async logJobResult(result: CronJobResult): Promise<void> {
    try {
      await this.db.logSystemEvent({
        level: result.status === 'success' ? 'INFO' : 'ERROR',
        component: 'scheduler',
        event_type: 'cron_job',
        message: `Job ${result.job_name} ${result.status}`,
        details: result
      })
    } catch (error: any) {
      // ログ記録の失敗は別途処理しない（無限ループ防止）
      console.error('Failed to log job result:', error)
    }
  }

  // ジョブの手動実行
  public async executeJob(jobName: string): Promise<boolean> {
    logger.info(`Manual execution requested for job: ${jobName}`)

    const jobHandlers: Record<string, () => Promise<void>> = {
      'payment-reminders': this.checkPaymentReminders.bind(this),
      'update-expired-members': this.updateExpiredMembers.bind(this),
      'monthly-rewards': this.processMonthlyRewards.bind(this),
      'health-check': this.performHealthCheck.bind(this),
      'cleanup-messages': this.cleanupExpiredMessages.bind(this),
      'update-stats': this.updateSystemStats.bind(this)
    }

    const handler = jobHandlers[jobName]
    if (!handler) {
      logger.error(`Job not found: ${jobName}`)
      return false
    }

    try {
      await this.executeJobWithErrorHandling(jobName, handler)
      return true
    } catch (error: any) {
      logger.error(`Manual job execution failed: ${jobName}`, { error: error.message })
      return false
    }
  }

  // ジョブの一時停止
  public pauseJob(jobName: string): boolean {
    const task = this.jobs.get(jobName)
    if (!task) {
      logger.error(`Job not found for pause: ${jobName}`)
      return false
    }

    task.stop()
    logger.info(`Job paused: ${jobName}`)
    return true
  }

  // ジョブの再開
  public resumeJob(jobName: string): boolean {
    const task = this.jobs.get(jobName)
    if (!task) {
      logger.error(`Job not found for resume: ${jobName}`)
      return false
    }

    task.start()
    logger.info(`Job resumed: ${jobName}`)
    return true
  }

  // 全ジョブの停止
  public stopAllJobs(): void {
    logger.info('Stopping all scheduled jobs')

    for (const [name, task] of this.jobs) {
      task.stop()
      logger.debug(`Stopped job: ${name}`)
    }

    this.jobs.clear()
    logger.info('All scheduled jobs stopped')
  }

  // スケジューラーの状態取得
  public getStatus(): Array<{
    name: string
    running: boolean
    cron_expression: string
    next_run?: Date
  }> {
    const status = []

    for (const [name, task] of this.jobs) {
      status.push({
        name,
        running: task.getStatus() === 'scheduled',
        cron_expression: 'unknown', // node-cronでは取得不可
        next_run: undefined // node-cronでは取得不可
      })
    }

    return status
  }

  // 緊急時の即座実行（全リマインダー・アップデート）
  public async emergencyRun(): Promise<void> {
    logger.warn('Emergency scheduler run initiated')

    const jobs = [
      'payment-reminders',
      'update-expired-members',
      'health-check'
    ]

    for (const jobName of jobs) {
      try {
        await this.executeJob(jobName)
      } catch (error: any) {
        logger.error(`Emergency job failed: ${jobName}`, { error: error.message })
      }
    }

    logger.info('Emergency scheduler run completed')
  }
}
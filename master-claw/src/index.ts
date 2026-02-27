#!/usr/bin/env node

import { config } from '@/config'
import { logger, loggerHelpers } from '@/utils/logger'
import { MasterClawServer } from '@/server'
import { DatabaseService } from '@/services/database'
import { MinaraService } from '@/services/minara'
import { PaymentService } from '@/services/payment'
import { NotificationService } from '@/services/notification'
import { SchedulerService } from '@/services/scheduler'

/**
 * OPEN CLAW マスター管理システム
 * 
 * 主な機能:
 * - MINARA Webhook受信による支払い処理
 * - 紹介制度の報酬計算・送金
 * - メンバー管理・ステータス更新
 * - トレードシグナルの配信
 * - 通知・アラートシステム
 * - 定期実行タスクの管理
 */

class MasterClawApplication {
  private server?: MasterClawServer
  private scheduler?: SchedulerService
  private isShuttingDown = false

  constructor() {
    // プロセス終了シグナルのハンドリング
    process.on('SIGTERM', this.gracefulShutdown.bind(this))
    process.on('SIGINT', this.gracefulShutdown.bind(this))
    process.on('uncaughtException', this.handleUncaughtException.bind(this))
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this))
  }

  // アプリケーションの起動
  public async start(): Promise<void> {
    try {
      loggerHelpers.startup('OPEN CLAW Master starting', {
        version: process.env.npm_package_version || '1.0.0',
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development',
        master_id: config.masterId
      })

      // 1. 設定の検証
      await this.validateConfiguration()

      // 2. 依存サービスの初期化
      const services = await this.initializeServices()

      // 3. HTTPサーバーの起動
      this.server = new MasterClawServer()
      this.server.start()

      // 4. スケジューラーの初期化・開始
      this.scheduler = new SchedulerService(
        services.payment,
        services.notification,
        services.db,
        services.minara
      )
      this.scheduler.initialize()

      // 5. 起動完了の通知
      await services.notification.sendSystemAlert(
        'INFO',
        'OPEN CLAW Master started successfully',
        {
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          master_id: config.masterId
        }
      )

      loggerHelpers.startup('OPEN CLAW Master started successfully', {
        port: config.port,
        scheduled_jobs: this.scheduler.getStatus().length
      })

    } catch (error: any) {
      logger.error('Failed to start OPEN CLAW Master', {
        error: error.message,
        stack: error.stack
      })
      process.exit(1)
    }
  }

  // 設定の検証
  private async validateConfiguration(): Promise<void> {
    logger.info('Validating configuration')

    // 必須環境変数の確認
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'MINARA_API_KEY',
      'MASTER_WALLET_ADDRESS',
      'OPERATOR_WALLET_ADDRESS',
      'WEBHOOK_SECRET',
      'MASTER_API_KEY'
    ]

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
    }

    // 数値設定の検証
    if (config.payment.initialFeeUsd <= 0) {
      throw new Error('Initial fee must be greater than 0')
    }

    if (config.payment.operatorShareUsd <= 0) {
      throw new Error('Operator share must be greater than 0')
    }

    // ポート番号の検証
    if (config.port < 1 || config.port > 65535) {
      throw new Error(`Invalid port number: ${config.port}`)
    }

    logger.info('Configuration validation completed')
  }

  // 依存サービスの初期化
  private async initializeServices(): Promise<{
    db: DatabaseService
    minara: MinaraService
    notification: NotificationService
    payment: PaymentService
  }> {
    logger.info('Initializing services')

    // データベース接続
    const db = new DatabaseService()
    const dbHealthy = await db.healthCheck()
    if (!dbHealthy) {
      throw new Error('Database connection failed')
    }
    logger.info('Database service initialized')

    // MINARA API接続
    const minara = new MinaraService()
    const minaraHealthy = await minara.healthCheck()
    if (!minaraHealthy) {
      logger.warn('MINARA API health check failed - continuing with limited functionality')
    }
    logger.info('MINARA service initialized')

    // 通知サービス
    const notification = new NotificationService(db)
    logger.info('Notification service initialized')

    // 支払い処理サービス
    const payment = new PaymentService(db, minara, notification)
    logger.info('Payment service initialized')

    return { db, minara, notification, payment }
  }

  // グレースフルシャットダウン
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Force shutdown initiated')
      process.exit(1)
    }

    this.isShuttingDown = true

    loggerHelpers.shutdown(`Received ${signal}, initiating graceful shutdown`)

    try {
      // 1. 新しいリクエストの受付停止
      // HTTPサーバーは自動的に新しい接続を拒否

      // 2. スケジューラーの停止
      if (this.scheduler) {
        this.scheduler.stopAllJobs()
        logger.info('Scheduled jobs stopped')
      }

      // 3. 進行中の処理の完了を待機（最大30秒）
      await this.waitForActiveConnections(30000)

      // 4. システム停止の通知
      // 注: 短時間で処理を完了させる必要があるため、通知は簡潔に
      logger.info('Sending shutdown notification')

      loggerHelpers.shutdown('OPEN CLAW Master shutdown completed')
      
    } catch (error: any) {
      logger.error('Error during graceful shutdown', { error: error.message })
    } finally {
      process.exit(0)
    }
  }

  // アクティブな接続の完了待機
  private async waitForActiveConnections(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('Shutdown timeout reached, forcing exit')
        resolve()
      }, timeoutMs)

      // 実際の実装では、アクティブな接続数を監視
      // ここでは簡易的に短時間待機
      setTimeout(() => {
        clearTimeout(timeout)
        resolve()
      }, 1000)
    })
  }

  // 未キャッチ例外のハンドリング
  private handleUncaughtException(error: Error): void {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack
    })

    // 致命的エラーのため、グレースフルシャットダウンを試行
    this.gracefulShutdown('UNCAUGHT_EXCEPTION')
      .catch(() => process.exit(1))
  }

  // 未処理Promise拒否のハンドリング
  private handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack
    })

    // 通常は継続するが、重要な処理での拒否の場合は終了を検討
    // ここでは警告ログのみ
  }
}

// CLI引数の処理
function parseCliArgs(): { command?: string; args: string[] } {
  const args = process.argv.slice(2)
  const command = args[0]
  
  return { command, args: args.slice(1) }
}

// メイン実行部
async function main(): Promise<void> {
  const { command, args } = parseCliArgs()

  // CLIコマンドの処理
  switch (command) {
    case 'start':
    case undefined: // デフォルトはstart
      const app = new MasterClawApplication()
      await app.start()
      break

    case 'version':
      console.log(`OPEN CLAW Master v${process.env.npm_package_version || '1.0.0'}`)
      break

    case 'config':
      console.log('Configuration:')
      console.log(`  Master ID: ${config.masterId}`)
      console.log(`  Port: ${config.port}`)
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`  Log Level: ${config.logging.level}`)
      break

    case 'test-db':
      try {
        const db = new DatabaseService()
        const healthy = await db.healthCheck()
        console.log(`Database connection: ${healthy ? 'OK' : 'FAILED'}`)
        process.exit(healthy ? 0 : 1)
      } catch (error: any) {
        console.error(`Database test failed: ${error.message}`)
        process.exit(1)
      }

    case 'test-minara':
      try {
        const minara = new MinaraService()
        const healthy = await minara.healthCheck()
        console.log(`MINARA API connection: ${healthy ? 'OK' : 'FAILED'}`)
        process.exit(healthy ? 0 : 1)
      } catch (error: any) {
        console.error(`MINARA test failed: ${error.message}`)
        process.exit(1)
      }

    case 'help':
      console.log('OPEN CLAW Master Commands:')
      console.log('  start (default)  - Start the Master CLAW system')
      console.log('  version          - Show version information')
      console.log('  config           - Show configuration summary')
      console.log('  test-db          - Test database connection')
      console.log('  test-minara      - Test MINARA API connection')
      console.log('  help             - Show this help message')
      break

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Use "help" to see available commands')
      process.exit(1)
  }
}

// アプリケーションの起動
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
// 起動テスト用スクリプト（相対パス使用）
import './config'
import { logger } from './utils/logger'
import { createDatabaseService, createMinaraService } from './services'

async function testStartup() {
  try {
    logger.info('🦞 OPEN CLAW Master - Startup Test')
    
    // 設定確認
    const config = await import('./config')
    logger.info('Configuration loaded', {
      masterId: config.config.masterId,
      port: config.config.port,
      nodeEnv: process.env.NODE_ENV
    })

    // サービス初期化テスト
    logger.info('Testing service initialization...')
    
    const db = createDatabaseService()
    const minara = createMinaraService()
    
    logger.info('Services created successfully', {
      database: db.constructor.name,
      minara: minara.constructor.name
    })

    // ヘルスチェック
    const dbHealth = await db.healthCheck()
    logger.info('Database health check', { healthy: dbHealth })

    // モックデータの状態確認（開発時のみ）
    if (db.getMockState) {
      const mockState = db.getMockState()
      logger.info('Mock database state', mockState)
    }

    logger.info('✅ Startup test completed successfully!')
    
  } catch (error: any) {
    logger.error('❌ Startup test failed', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
}

// テスト実行
if (require.main === module) {
  testStartup()
}
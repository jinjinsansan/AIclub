// サービスファクトリー - 環境に応じて実装を切り替え
import { config } from '@/config'
import { logger } from '@/utils/logger'

// 実際のサービス
import { DatabaseService } from './database'
import { MinaraService } from './minara'

// モックサービス
import { MockDatabaseService } from './database.mock'

export function createDatabaseService() {
  if (process.env.NODE_ENV === 'development' && !process.env.USE_REAL_DATABASE) {
    logger.info('Using mock database service for development')
    return new MockDatabaseService() as any // DatabaseServiceと同じインターフェース
  } else {
    logger.info('Using real database service')
    return new DatabaseService()
  }
}

export function createMinaraService() {
  // MINARAサービスは本番API使用（テストモードあり）
  return new MinaraService()
}

// 開発用: 全サービスの初期化
export async function initializeServices() {
  const db = createDatabaseService()
  const minara = createMinaraService()

  logger.info('Services initialized', {
    database: db.constructor.name,
    minara: minara.constructor.name
  })

  // ヘルスチェック
  const dbHealth = await db.healthCheck()
  const minaraHealth = await minara.healthCheck()

  logger.info('Service health check results', {
    database: dbHealth,
    minara: minaraHealth
  })

  return { db, minara }
}
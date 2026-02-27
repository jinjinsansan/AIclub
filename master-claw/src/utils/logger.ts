import winston from 'winston'
import path from 'path'
import fs from 'fs'
import { config } from '@/config'

// ログディレクトリの作成
const logDir = config.logging.directory
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// カスタムフォーマット
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, component, event_type, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`
    
    if (component) {
      log += ` [${component}]`
    }
    
    if (event_type) {
      log += ` [${event_type}]`
    }
    
    log += ` ${message}`
    
    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`
    }
    
    return log
  })
)

// ログローテーション用の日付ファイル名
const getDateString = () => {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD
}

// Winstonロガーの設定
export const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  transports: [
    // コンソール出力
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ level, message, timestamp, component, event_type }) => {
          let log = `${timestamp} ${level}`
          
          if (component) {
            log += ` [${component}]`
          }
          
          if (event_type) {
            log += ` [${event_type}]`
          }
          
          return `${log} ${message}`
        })
      )
    }),
    
    // 全ログファイル（日次ローテーション）
    new winston.transports.File({
      filename: path.join(logDir, `master-claw-${getDateString()}.log`),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30, // 30日分保持
    }),
    
    // エラーログファイル
    new winston.transports.File({
      level: 'error',
      filename: path.join(logDir, `error-${getDateString()}.log`),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 90, // 90日分保持
    })
  ],
  
  // 未処理例外のキャッチ
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log') 
    })
  ],
  
  // 未処理Promise拒否のキャッチ
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log') 
    })
  ]
})

// 開発環境では詳細ログを有効化
if (process.env.NODE_ENV === 'development') {
  logger.level = 'debug'
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        return `${timestamp} ${level} ${message} ${metaStr}`
      })
    )
  }))
}

// ログレベル別のヘルパー関数
export const loggerHelpers = {
  // システム起動・停止
  startup: (message: string, meta?: any) => {
    logger.info(message, { component: 'system', event_type: 'startup', ...meta })
  },
  
  shutdown: (message: string, meta?: any) => {
    logger.info(message, { component: 'system', event_type: 'shutdown', ...meta })
  },
  
  // 支払い関連
  payment: {
    received: (message: string, meta?: any) => {
      logger.info(message, { component: 'payment', event_type: 'received', ...meta })
    },
    
    processed: (message: string, meta?: any) => {
      logger.info(message, { component: 'payment', event_type: 'processed', ...meta })
    },
    
    failed: (message: string, meta?: any) => {
      logger.error(message, { component: 'payment', event_type: 'failed', ...meta })
    }
  },
  
  // MINARA API関連
  minara: {
    request: (message: string, meta?: any) => {
      logger.debug(message, { component: 'minara-api', event_type: 'request', ...meta })
    },
    
    response: (message: string, meta?: any) => {
      logger.debug(message, { component: 'minara-api', event_type: 'response', ...meta })
    },
    
    error: (message: string, meta?: any) => {
      logger.error(message, { component: 'minara-api', event_type: 'error', ...meta })
    }
  },
  
  // 報酬関連
  reward: {
    calculated: (message: string, meta?: any) => {
      logger.info(message, { component: 'reward', event_type: 'calculated', ...meta })
    },
    
    sent: (message: string, meta?: any) => {
      logger.info(message, { component: 'reward', event_type: 'sent', ...meta })
    },
    
    failed: (message: string, meta?: any) => {
      logger.error(message, { component: 'reward', event_type: 'failed', ...meta })
    }
  },
  
  // トレードシグナル関連
  trade: {
    signal: (message: string, meta?: any) => {
      logger.info(message, { component: 'trade', event_type: 'signal', ...meta })
    },
    
    broadcast: (message: string, meta?: any) => {
      logger.info(message, { component: 'trade', event_type: 'broadcast', ...meta })
    },
    
    executed: (message: string, meta?: any) => {
      logger.info(message, { component: 'trade', event_type: 'executed', ...meta })
    }
  },
  
  // LINE通知関連
  line: {
    sent: (message: string, meta?: any) => {
      logger.info(message, { component: 'line', event_type: 'sent', ...meta })
    },
    
    failed: (message: string, meta?: any) => {
      logger.error(message, { component: 'line', event_type: 'failed', ...meta })
    }
  },
  
  // メンバー関連
  member: {
    registered: (message: string, meta?: any) => {
      logger.info(message, { component: 'member', event_type: 'registered', ...meta })
    },
    
    activated: (message: string, meta?: any) => {
      logger.info(message, { component: 'member', event_type: 'activated', ...meta })
    },
    
    suspended: (message: string, meta?: any) => {
      logger.warn(message, { component: 'member', event_type: 'suspended', ...meta })
    },
    
    heartbeat: (message: string, meta?: any) => {
      logger.debug(message, { component: 'member', event_type: 'heartbeat', ...meta })
    }
  },
  
  // セキュリティ関連
  security: {
    unauthorized: (message: string, meta?: any) => {
      logger.warn(message, { component: 'security', event_type: 'unauthorized', ...meta })
    },
    
    suspicious: (message: string, meta?: any) => {
      logger.error(message, { component: 'security', event_type: 'suspicious', ...meta })
    },
    
    rateLimit: (message: string, meta?: any) => {
      logger.warn(message, { component: 'security', event_type: 'rate_limit', ...meta })
    }
  }
}

// パフォーマンス計測ヘルパー
export class PerformanceLogger {
  private startTime: number
  private operation: string
  private metadata: any

  constructor(operation: string, metadata?: any) {
    this.operation = operation
    this.metadata = metadata
    this.startTime = Date.now()
    
    logger.debug(`Starting ${operation}`, { 
      component: 'performance', 
      event_type: 'start',
      ...metadata 
    })
  }

  finish(additionalMeta?: any): number {
    const duration = Date.now() - this.startTime
    
    logger.debug(`Completed ${this.operation}`, {
      component: 'performance',
      event_type: 'complete',
      duration_ms: duration,
      ...this.metadata,
      ...additionalMeta
    })
    
    return duration
  }

  finishWithError(error: any, additionalMeta?: any): number {
    const duration = Date.now() - this.startTime
    
    logger.error(`Failed ${this.operation}`, {
      component: 'performance',
      event_type: 'error',
      duration_ms: duration,
      error: error.message || error,
      ...this.metadata,
      ...additionalMeta
    })
    
    return duration
  }
}

export default logger
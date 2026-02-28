import dotenv from 'dotenv'

// 環境変数を読み込み
dotenv.config()

export interface MasterConfig {
  role: 'master'
  masterId: string
  port: number
  gateway: {
    url: string
    anonKey: string
    serviceRoleKey: string
    channel: string
  }
  minara: {
    apiEndpoint: string
    apiKey: string
    masterWallet: string
    operatorWallet: string
  }
  payment: {
    initialFeeUsd: number
    operatorShareUsd: number
    referralLevel1Usd: number
    referralLevel2Usd: number
    referralLevel3Usd: number
    monthlyRewardDay: number
    reminderDaysBefore: number
  }
  line: {
    channelAccessToken?: string
    groupId?: string
    notifyToken?: string
  }
  heartbeat: {
    checkIntervalSec: number
  }
  logging: {
    level: string
    directory: string
  }
  security: {
    webhookSecret: string
    masterApiKey: string
    rateLimitMax: number
    rateLimitWindowMs: number
  }
}

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MINARA_API_KEY',
  'MASTER_WALLET_ADDRESS',
  'OPERATOR_WALLET_ADDRESS',
  'WEBHOOK_SECRET',
  'MASTER_API_KEY'
] as const

// 環境変数の存在チェック
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`)
  }
}

export const config: MasterConfig = {
  role: 'master',
  masterId: process.env.MASTER_ID || 'master_001',
  port: parseInt(process.env.PORT || '3001', 10),
  
  gateway: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    channel: 'claw_gateway'
  },
  
  minara: {
    apiEndpoint: process.env.MINARA_API_ENDPOINT || 'https://api.minara.ai/v1',
    apiKey: process.env.MINARA_API_KEY!,
    masterWallet: process.env.MASTER_WALLET_ADDRESS!,
    operatorWallet: process.env.OPERATOR_WALLET_ADDRESS!
  },
  
  payment: {
    initialFeeUsd: parseInt(process.env.INITIAL_FEE_USD || '700', 10),
    operatorShareUsd: parseInt(process.env.OPERATOR_SHARE_USD || '400', 10),
    referralLevel1Usd: parseInt(process.env.REFERRAL_L1_USD || '200', 10),
    referralLevel2Usd: parseInt(process.env.REFERRAL_L2_USD || '50', 10),
    referralLevel3Usd: parseInt(process.env.REFERRAL_L3_USD || '50', 10),
    monthlyRewardDay: parseInt(process.env.MONTHLY_REWARD_DAY || '31', 10),
    reminderDaysBefore: parseInt(process.env.REMINDER_DAYS_BEFORE || '5', 10)
  },
  
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    groupId: process.env.LINE_GROUP_ID,
    notifyToken: process.env.LINE_NOTIFY_TOKEN
  },
  
  heartbeat: {
    checkIntervalSec: parseInt(process.env.HEARTBEAT_CHECK_INTERVAL_SEC || '60', 10)
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || './logs'
  },
  
  security: {
    webhookSecret: process.env.WEBHOOK_SECRET!,
    masterApiKey: process.env.MASTER_API_KEY!,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) // 15 minutes
  }
}

export default config
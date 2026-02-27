// マスター管理CLAW 型定義

export interface Member {
  id: string
  member_id: string
  display_name: string
  email: string
  plan: string
  membership_status: 'pending_payment' | 'active' | 'suspended' | 'expired'
  minara_wallet?: string
  referral_code?: string
  referred_by_code?: string
  claw_status: 'online' | 'offline' | 'error'
  last_seen?: string
  fee_paid_until?: string
  monthly_reward_pending: number
  created_at: string
  updated_at: string
}

export interface PaymentWebhookData {
  from_wallet: string
  to_wallet: string
  amount: number
  currency: string
  tx_hash: string
  memo?: string
  timestamp: string
  signature: string
}

export interface TradeSignal {
  signal_id: string
  pair: string
  direction: 'LONG' | 'SHORT'
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  leverage: number
  position_size_pct: number
  natural_language: string
  expires_at?: string
}

export interface GatewayMessage {
  target: string // 'all' または member_id
  message_type: 'broadcast' | 'trade_signal' | 'update' | 'private' | 'reward_notify' | 'system_alert'
  payload: any
  priority: number
  expires_at?: string
  created_by: string
}

export interface RewardCalculation {
  member_id: string
  referred_member: string
  level: 1 | 2 | 3
  amount: number
  payment_month: string
}

export interface MonthlyRewardSummary {
  member_id: string
  total_amount: number
  referral_count: number
  breakdown: {
    level1: { count: number; amount: number }
    level2: { count: number; amount: number }
    level3: { count: number; amount: number }
  }
}

export interface SystemEvent {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  component: string
  event_type: string
  message: string
  details?: any
  member_id?: string
}

export interface MinaraApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface SendTransactionRequest {
  from_wallet: string
  to_wallet: string
  amount: number
  currency: string
  memo?: string
}

export interface SendTransactionResponse {
  tx_hash: string
  status: 'pending' | 'confirmed' | 'failed'
  fee: number
  estimated_confirmation_time?: number
}

export interface NotificationData {
  recipient: string
  channel: 'email' | 'line' | 'web'
  template_key: string
  variables: Record<string, any>
}

export interface LineNotificationRequest {
  message: string
  group_id?: string
  individual_id?: string
}

export interface HeartbeatData {
  member_id: string
  claw_status: 'online' | 'offline' | 'error'
  last_activity: string
  system_info?: {
    version: string
    uptime: number
    memory_usage: number
    error_count: number
  }
}

export interface CronJobResult {
  job_name: string
  status: 'success' | 'failed' | 'partial'
  processed_count: number
  error_count: number
  duration_ms: number
  errors?: string[]
  details?: any
}

// API Request/Response 型
export interface ApiRequest<T = any> {
  method: string
  endpoint: string
  data?: T
  headers?: Record<string, string>
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
}

// 設定関連
export interface ScheduledJob {
  name: string
  schedule: string // cron expression
  enabled: boolean
  last_run?: string
  next_run?: string
  handler: string
}

export interface SystemStatus {
  service: 'master-claw'
  status: 'healthy' | 'degraded' | 'down'
  uptime: number
  version: string
  connections: {
    supabase: boolean
    minara: boolean
    line: boolean
  }
  last_check: string
  active_members: number
  pending_payments: number
  scheduled_jobs: ScheduledJob[]
}
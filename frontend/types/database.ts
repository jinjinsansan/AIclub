// OPEN CLAW データベース型定義

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

export interface ReferralTree {
  id: string
  member_id: string
  ref_level1_id?: string
  ref_level2_id?: string
  ref_level3_id?: string
  referral_code: string
  registered_at: string
}

export interface RewardLog {
  id: string
  member_id: string
  referred_member: string
  level: 1 | 2 | 3
  amount: number
  status: 'pending' | 'paid' | 'failed'
  payment_month: string
  paid_at?: string
  tx_hash?: string
  failure_reason?: string
  created_at: string
  updated_at: string
}

export interface PaymentLog {
  id: string
  member_id?: string
  payment_type: 'initial' | 'monthly' | 'penalty' | 'refund'
  from_wallet: string
  to_wallet: string
  amount: number
  currency: string
  tx_hash?: string
  payment_period?: string
  memo?: string
  status: 'pending' | 'confirmed' | 'failed' | 'disputed'
  confirmed_at: string
  processed_at?: string
  created_at: string
}

export interface GatewayMessage {
  id: string
  target: string // 'all' または member_id
  message_type: 'broadcast' | 'trade_signal' | 'update' | 'private' | 'reward_notify' | 'system_alert'
  payload: any
  priority: number
  expires_at?: string
  delivered_count: number
  created_at: string
  created_by: string
}

export interface MessageReceipt {
  id: string
  message_id: string
  member_id: string
  received_at: string
  processed_at?: string
  status: 'received' | 'processing' | 'completed' | 'failed' | 'ignored'
  result?: any
  error_message?: string
  execution_time_ms?: number
}

export interface TradeSignal {
  id: string
  signal_id: string
  message_id?: string
  pair: string
  direction: 'LONG' | 'SHORT'
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  leverage: number
  position_size_pct: number
  natural_language: string
  expires_at?: string
  created_at: string
  total_members: number
  executed_members: number
  avg_execution_time_ms: number
}

export interface SystemLog {
  id: string
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  component: string
  event_type: string
  message: string
  details?: any
  member_id?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface SeminarSchedule {
  id: string
  title: string
  description?: string
  scheduled_at: string
  duration_minutes: number
  zoom_url?: string
  zoom_password?: string
  max_participants?: number
  registration_required: boolean
  status: 'scheduled' | 'cancelled' | 'completed' | 'in_progress'
  created_by: string
  created_at: string
  updated_at: string
}

export interface SeminarParticipant {
  id: string
  seminar_id: string
  member_id: string
  registered_at: string
  attended: boolean
  attendance_duration_minutes: number
}

export interface ManualContent {
  id: string
  manual_code: string
  title: string
  description?: string
  content_type: 'video' | 'pdf' | 'markdown' | 'zip' | 'config'
  file_url?: string
  file_size_bytes?: number
  access_level: 'all' | 'active' | 'premium' | 'master'
  order_index: number
  is_published: boolean
  version: string
  created_at: string
  updated_at: string
}

export interface SystemConfig {
  key: string
  value: any
  description?: string
  category: string
  is_sensitive: boolean
  updated_by: string
  updated_at: string
}

export interface NotificationTemplate {
  id: string
  template_key: string
  channel: 'email' | 'line' | 'web' | 'claw_message'
  subject?: string
  content: string
  variables?: any
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationLog {
  id: string
  template_key?: string
  channel: string
  recipient: string
  subject?: string
  content: string
  variables_used?: any
  status: 'pending' | 'sent' | 'failed' | 'bounced'
  sent_at?: string
  error_message?: string
  external_id?: string
  created_at: string
}

// Phase 5: Gateway接続管理
export interface GatewayConnection {
  id: string
  member_id: string
  connection_token: string
  gateway_session_id?: string
  status: 'offline' | 'connecting' | 'online' | 'error'
  last_ping?: string
  ip_address?: string
  user_agent?: string
  connected_at?: string
  disconnected_at?: string
  created_at: string
}

// Phase 5: CLAW間チャットログ
export interface CLAWChatLog {
  id: string
  channel_name: string
  sender_member_id: string
  sender_name?: string
  message_type: 'text' | 'file' | 'image' | 'system'
  content: string
  metadata?: any
  sent_at: string
  delivered_to?: string[]
  read_by?: Record<string, string>
}

// Phase 5: メンバーCLAW設定
export interface MemberCLAWConfig {
  id: string
  member_id: string
  claw_version?: string
  capabilities: Record<string, any>
  current_config?: any
  gateway_preferences: Record<string, any>
  last_config_update: string
  created_at: string
}

// Phase 5: CLAW接続状況 (管理画面用)
export interface CLAWStatus {
  member_id: string
  display_name: string
  membership_status: string
  status: 'online' | 'offline' | 'error'
  last_ping: string
  ip_address?: string
  connected_at?: string
  version: string
  capabilities: string[]
}

// Phase 5: チャットメッセージ (リアルタイム用)
export interface ChatMessage {
  id: string
  channel: string
  sender_member_id: string
  sender_name: string
  content: string
  sent_at: string
  message_type: 'text' | 'file' | 'system'
}

// API レスポンス型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

// フォーム型
export interface RegisterFormData {
  displayName: string
  email: string
  minaraWallet: string
  referralCode?: string
  agreedToTerms: boolean
}

export interface LoginFormData {
  email: string
  password: string
  rememberMe?: boolean
}

// 統計・サマリー型
export interface MemberStats {
  total_members: number
  active_members: number
  pending_members: number
  suspended_members: number
  online_members: number
  revenue_this_month: number
  revenue_total: number
}

export interface ReferralStats {
  direct_referrals: number
  indirect_level2: number
  indirect_level3: number
  total_network_size: number
  total_rewards_earned: number
  pending_rewards: number
}

export interface RewardSummary {
  member_id: string
  payment_month: string
  referral_count: number
  total_amount: number
  paid_amount: number
  pending_amount: number
  level1_amount: number
  level2_amount: number
  level3_amount: number
}
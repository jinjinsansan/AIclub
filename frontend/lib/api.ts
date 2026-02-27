// API通信ユーティリティ
import { supabase } from './supabase'
import type { Member, GatewayMessage, TradeSignal, RewardSummary } from '@/types/database'

export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: any) {
    super(message)
    this.name = 'ApiError'
  }
}

// 会員情報の取得
export async function getMemberProfile(): Promise<Member | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('member_id', user.id)
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Failed to get member profile:', error)
    return null
  }
}

// ダッシュボード統計の取得
export async function getDashboardStats(): Promise<{
  totalSignalsToday: number
  successfulTrades: number
  totalMembers: number
  myReferrals: number
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    // 今日のトレードシグナル数
    const today = new Date().toISOString().split('T')[0]
    const { count: signalsCount } = await supabase
      .from('trade_signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    // 自分の紹介者数
    const { count: referralCount } = await supabase
      .from('referral_tree')
      .select('*', { count: 'exact', head: true })
      .eq('ref_level1_id', user.id)

    // 総メンバー数
    const { count: totalMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('membership_status', 'active')

    return {
      totalSignalsToday: signalsCount || 0,
      successfulTrades: 12, // TODO: 実装
      totalMembers: totalMembers || 0,
      myReferrals: referralCount || 0
    }
  } catch (error: any) {
    console.error('Failed to get dashboard stats:', error)
    return {
      totalSignalsToday: 0,
      successfulTrades: 0,
      totalMembers: 0,
      myReferrals: 0
    }
  }
}

// 最新メッセージの取得
export async function getRecentMessages(limit: number = 5): Promise<Array<{
  id: string
  type: string
  content: string
  timestamp: string
  status: string
}>> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    const { data, error } = await supabase
      .from('gateway_messages')
      .select('*')
      .or(`target.eq.all,target.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data?.map(msg => ({
      id: msg.id,
      type: msg.message_type,
      content: msg.payload?.message || `${msg.message_type}メッセージ`,
      timestamp: msg.created_at,
      status: 'completed' // TODO: 実装
    })) || []
  } catch (error: any) {
    console.error('Failed to get recent messages:', error)
    return []
  }
}

// 紹介コードの取得・生成
export async function getReferralCode(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    const { data, error } = await supabase
      .from('members')
      .select('referral_code')
      .eq('member_id', user.id)
      .single()

    if (error) throw error
    return data?.referral_code || null
  } catch (error: any) {
    console.error('Failed to get referral code:', error)
    return null
  }
}

// 紹介統計の取得
export async function getReferralStats(): Promise<{
  directReferrals: number
  indirectLevel2: number
  indirectLevel3: number
  totalRewardsEarned: number
  pendingRewards: number
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    // 直接紹介者数
    const { count: directCount } = await supabase
      .from('referral_tree')
      .select('*', { count: 'exact', head: true })
      .eq('ref_level1_id', user.id)

    // 2段目紹介者数
    const { count: level2Count } = await supabase
      .from('referral_tree')
      .select('*', { count: 'exact', head: true })
      .eq('ref_level2_id', user.id)

    // 3段目紹介者数
    const { count: level3Count } = await supabase
      .from('referral_tree')
      .select('*', { count: 'exact', head: true })
      .eq('ref_level3_id', user.id)

    // 報酬統計
    const { data: rewardStats } = await supabase
      .from('reward_logs')
      .select('amount, status')
      .eq('member_id', user.id)

    const totalRewardsEarned = rewardStats
      ?.filter(r => r.status === 'paid')
      ?.reduce((sum, r) => sum + r.amount, 0) || 0

    const pendingRewards = rewardStats
      ?.filter(r => r.status === 'pending')
      ?.reduce((sum, r) => sum + r.amount, 0) || 0

    return {
      directReferrals: directCount || 0,
      indirectLevel2: level2Count || 0,
      indirectLevel3: level3Count || 0,
      totalRewardsEarned,
      pendingRewards
    }
  } catch (error: any) {
    console.error('Failed to get referral stats:', error)
    return {
      directReferrals: 0,
      indirectLevel2: 0,
      indirectLevel3: 0,
      totalRewardsEarned: 0,
      pendingRewards: 0
    }
  }
}

// 報酬履歴の取得
export async function getRewardHistory(limit: number = 10): Promise<Array<{
  id: string
  referredMember: string
  level: number
  amount: number
  status: string
  paymentMonth: string
  paidAt?: string
}>> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    const { data, error } = await supabase
      .from('reward_logs')
      .select('*')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data?.map(reward => ({
      id: reward.id,
      referredMember: reward.referred_member,
      level: reward.level,
      amount: reward.amount,
      status: reward.status,
      paymentMonth: reward.payment_month,
      paidAt: reward.paid_at
    })) || []
  } catch (error: any) {
    console.error('Failed to get reward history:', error)
    return []
  }
}

// セミナー情報の取得
export async function getUpcomingSeminars(): Promise<Array<{
  id: string
  title: string
  scheduledAt: string
  zoomUrl?: string
  description?: string
}>> {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('seminar_schedules')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(3)

    if (error) throw error

    return data?.map(seminar => ({
      id: seminar.id,
      title: seminar.title,
      scheduledAt: seminar.scheduled_at,
      zoomUrl: seminar.zoom_url,
      description: seminar.description
    })) || []
  } catch (error: any) {
    console.error('Failed to get upcoming seminars:', error)
    return []
  }
}

// マニュアル一覧の取得
export async function getManuals(): Promise<Array<{
  id: string
  manualCode: string
  title: string
  description: string
  contentType: string
  fileUrl?: string
  accessLevel: string
  orderIndex: number
  isPublished: boolean
}>> {
  try {
    const { data, error } = await supabase
      .from('manual_contents')
      .select('*')
      .eq('is_published', true)
      .order('order_index', { ascending: true })

    if (error) throw error

    return data?.map(manual => ({
      id: manual.id,
      manualCode: manual.manual_code,
      title: manual.title,
      description: manual.description || '',
      contentType: manual.content_type,
      fileUrl: manual.file_url,
      accessLevel: manual.access_level,
      orderIndex: manual.order_index,
      isPublished: manual.is_published
    })) || []
  } catch (error: any) {
    console.error('Failed to get manuals:', error)
    return []
  }
}

// CLAW接続状態の更新
export async function updateClawStatus(status: 'online' | 'offline' | 'error'): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    const { error } = await supabase
      .from('members')
      .update({
        claw_status: status,
        last_seen: new Date().toISOString()
      })
      .eq('member_id', user.id)

    if (error) throw error
    return true
  } catch (error: any) {
    console.error('Failed to update CLAW status:', error)
    return false
  }
}

// ハートビート送信
export async function sendHeartbeat(systemInfo?: {
  version: string
  uptime: number
  memoryUsage: number
  errorCount: number
}): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError('AUTH_ERROR', 'Not authenticated')

    // CLAW状態を更新
    await updateClawStatus('online')

    // システム情報があれば記録
    if (systemInfo) {
      // TODO: システム情報の記録実装
    }

    return true
  } catch (error: any) {
    console.error('Failed to send heartbeat:', error)
    return false
  }
}

// リアルタイム購読の設定
export function subscribeToMessages(
  callback: (message: any) => void
): { unsubscribe: () => void } {
  const channel = supabase
    .channel('user_messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'gateway_messages',
        filter: 'target=eq.all' // TODO: 個人宛メッセージも含める
      },
      callback
    )
    .subscribe()

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel)
    }
  }
}
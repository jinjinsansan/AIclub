import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/config'
import { Member, PaymentWebhookData, RewardCalculation, SystemEvent } from '@/types'
import { logger } from '@/utils/logger'

export class DatabaseService {
  public supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(
      config.gateway.url,
      config.gateway.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  // 会員情報の取得
  async getMember(memberId: string): Promise<Member | null> {
    try {
      const { data, error } = await this.supabase
        .from('members')
        .select('*')
        .eq('member_id', memberId)
        .single()

      if (error) {
        logger.error('Failed to get member', { memberId, error })
        return null
      }

      return data as Member
    } catch (error) {
      logger.error('Database error in getMember', { memberId, error })
      return null
    }
  }

  // ウォレットアドレスでメンバーを検索
  async getMemberByWallet(walletAddress: string): Promise<Member | null> {
    try {
      const { data, error } = await this.supabase
        .from('members')
        .select('*')
        .eq('minara_wallet', walletAddress)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null
        }
        logger.error('Failed to get member by wallet', { walletAddress, error })
        return null
      }

      return data as Member
    } catch (error) {
      logger.error('Database error in getMemberByWallet', { walletAddress, error })
      return null
    }
  }

  // 会員ステータスの更新
  async updateMemberStatus(
    memberId: string, 
    status: Member['membership_status'],
    feePaidUntil?: string
  ): Promise<boolean> {
    try {
      const updateData: Partial<Member> = {
        membership_status: status,
        updated_at: new Date().toISOString()
      }

      if (feePaidUntil) {
        updateData.fee_paid_until = feePaidUntil
      }

      const { error } = await this.supabase
        .from('members')
        .update(updateData)
        .eq('member_id', memberId)

      if (error) {
        logger.error('Failed to update member status', { memberId, status, error })
        return false
      }

      logger.info('Member status updated', { memberId, status, feePaidUntil })
      return true
    } catch (error) {
      logger.error('Database error in updateMemberStatus', { memberId, status, error })
      return false
    }
  }

  // 支払いログの記録
  async logPayment(paymentData: {
    member_id?: string
    payment_type: 'initial' | 'monthly' | 'penalty' | 'refund'
    from_wallet: string
    to_wallet: string
    amount: number
    currency: string
    tx_hash: string
    payment_period?: string
    memo?: string
  }): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('payment_logs')
        .insert(paymentData)

      if (error) {
        logger.error('Failed to log payment', { paymentData, error })
        return false
      }

      logger.info('Payment logged successfully', { tx_hash: paymentData.tx_hash })
      return true
    } catch (error) {
      logger.error('Database error in logPayment', { paymentData, error })
      return false
    }
  }

  // 紹介ツリーの取得
  async getReferralTree(memberId: string): Promise<{
    level1_id?: string
    level2_id?: string 
    level3_id?: string
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('referral_tree')
        .select('ref_level1_id, ref_level2_id, ref_level3_id')
        .eq('member_id', memberId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null
        }
        logger.error('Failed to get referral tree', { memberId, error })
        return null
      }

      return {
        level1_id: data.ref_level1_id,
        level2_id: data.ref_level2_id,
        level3_id: data.ref_level3_id
      }
    } catch (error) {
      logger.error('Database error in getReferralTree', { memberId, error })
      return null
    }
  }

  // 報酬計算の記録
  async logReward(rewardData: RewardCalculation): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('reward_logs')
        .insert({
          member_id: rewardData.member_id,
          referred_member: rewardData.referred_member,
          level: rewardData.level,
          amount: rewardData.amount,
          payment_month: rewardData.payment_month
        })

      if (error) {
        logger.error('Failed to log reward', { rewardData, error })
        return false
      }

      logger.info('Reward logged successfully', rewardData)
      return true
    } catch (error) {
      logger.error('Database error in logReward', { rewardData, error })
      return false
    }
  }

  // 月次報酬サマリーの取得
  async getMonthlyRewardSummary(paymentMonth: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('monthly_reward_summary')
        .select('*')
        .eq('payment_month', paymentMonth)
        .eq('status', 'pending')

      if (error) {
        logger.error('Failed to get monthly reward summary', { paymentMonth, error })
        return []
      }

      return data || []
    } catch (error) {
      logger.error('Database error in getMonthlyRewardSummary', { paymentMonth, error })
      return []
    }
  }

  // 報酬支払い完了の記録
  async markRewardPaid(
    memberId: string, 
    paymentMonth: string, 
    txHash: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('reward_logs')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          tx_hash: txHash
        })
        .eq('member_id', memberId)
        .eq('payment_month', paymentMonth)
        .eq('status', 'pending')

      if (error) {
        logger.error('Failed to mark reward as paid', { memberId, paymentMonth, txHash, error })
        return false
      }

      logger.info('Reward marked as paid', { memberId, paymentMonth, txHash })
      return true
    } catch (error) {
      logger.error('Database error in markRewardPaid', { memberId, paymentMonth, txHash, error })
      return false
    }
  }

  // ゲートウェイメッセージの送信
  async sendMessage(messageData: {
    target: string
    message_type: string
    payload: any
    priority?: number
    expires_at?: string
  }): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('gateway_messages')
        .insert({
          ...messageData,
          created_by: config.masterId,
          priority: messageData.priority || 5
        })

      if (error) {
        logger.error('Failed to send gateway message', { messageData, error })
        return false
      }

      logger.info('Gateway message sent successfully', { 
        target: messageData.target, 
        type: messageData.message_type 
      })
      return true
    } catch (error) {
      logger.error('Database error in sendMessage', { messageData, error })
      return false
    }
  }

  // システムログの記録
  async logSystemEvent(eventData: SystemEvent): Promise<void> {
    try {
      await this.supabase
        .from('system_logs')
        .insert({
          log_level: eventData.level,
          component: eventData.component,
          event_type: eventData.event_type,
          message: eventData.message,
          details: eventData.details,
          member_id: eventData.member_id
        })
    } catch (error) {
      // システムログのエラーはコンソールのみに出力（無限ループを防ぐため）
      console.error('Failed to log system event:', error)
    }
  }

  // アクティブメンバーの取得
  async getActiveMembers(): Promise<Member[]> {
    try {
      const { data, error } = await this.supabase
        .from('members')
        .select('*')
        .eq('membership_status', 'active')

      if (error) {
        logger.error('Failed to get active members', { error })
        return []
      }

      return data as Member[]
    } catch (error) {
      logger.error('Database error in getActiveMembers', { error })
      return []
    }
  }

  // 支払い期限チェック
  async getMembersWithUpcomingPayments(daysBefore: number): Promise<Member[]> {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + daysBefore)
      const dateString = targetDate.toISOString().split('T')[0]

      const { data, error } = await this.supabase
        .from('members')
        .select('*')
        .eq('membership_status', 'active')
        .lte('fee_paid_until', dateString)

      if (error) {
        logger.error('Failed to get members with upcoming payments', { daysBefore, error })
        return []
      }

      return data as Member[]
    } catch (error) {
      logger.error('Database error in getMembersWithUpcomingPayments', { daysBefore, error })
      return []
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('system_config')
        .select('key')
        .limit(1)

      return !error
    } catch (error) {
      logger.error('Database health check failed', { error })
      return false
    }
  }
}
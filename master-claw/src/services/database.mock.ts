// 開発環境用のモックデータベースサービス
import { Member, PaymentWebhookData, RewardCalculation, SystemEvent } from '@/types'
import { logger } from '@/utils/logger'

export class MockDatabaseService {
  // 互換性のためのダミープロパティ
  public supabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => Promise.resolve({ error: null }),
      upsert: () => Promise.resolve({ error: null }),
      rpc: () => Promise.resolve({ data: 0, error: null })
    })
  }

  private members: Member[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      member_id: 'master_001',
      display_name: 'マスター管理者',
      email: 'master@openclaw.com',
      plan: 'master',
      membership_status: 'active',
      minara_wallet: '0xMasterWallet123',
      referral_code: 'MASTER01',
      referred_by_code: undefined,
      claw_status: 'online',
      last_seen: new Date().toISOString(),
      fee_paid_until: '2026-12-31',
      monthly_reward_pending: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: new Date().toISOString()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      member_id: 'CLAW0001',
      display_name: '田中太郎',
      email: 'tanaka@example.com',
      plan: 'standard',
      membership_status: 'active',
      minara_wallet: '0xTanakaWallet456',
      referral_code: 'TANAKA01',
      referred_by_code: undefined,
      claw_status: 'offline',
      last_seen: '2026-02-27T23:00:00Z',
      fee_paid_until: '2026-03-28',
      monthly_reward_pending: 250,
      created_at: '2026-01-15T10:30:00Z',
      updated_at: '2026-02-27T23:00:00Z'
    }
  ]

  private paymentLogs: any[] = []
  private rewardLogs: any[] = []
  private gatewayMessages: any[] = []

  // ヘルスチェック（モックでは常にtrue）
  async healthCheck(): Promise<boolean> {
    logger.debug('Mock database health check - always healthy')
    return true
  }

  // 会員情報の取得
  async getMember(memberId: string): Promise<Member | null> {
    const member = this.members.find(m => m.member_id === memberId)
    if (member) {
      logger.debug('Mock getMember success', { memberId })
    } else {
      logger.debug('Mock getMember - member not found', { memberId })
    }
    return member || null
  }

  // ウォレットアドレスでメンバーを検索
  async getMemberByWallet(walletAddress: string): Promise<Member | null> {
    const member = this.members.find(m => m.minara_wallet === walletAddress)
    if (member) {
      logger.debug('Mock getMemberByWallet success', { 
        walletAddress: walletAddress.slice(0, 10) + '...', 
        memberId: member.member_id 
      })
    } else {
      logger.debug('Mock getMemberByWallet - member not found', { 
        walletAddress: walletAddress.slice(0, 10) + '...' 
      })
    }
    return member || null
  }

  // 会員ステータスの更新
  async updateMemberStatus(
    memberId: string, 
    status: Member['membership_status'],
    feePaidUntil?: string
  ): Promise<boolean> {
    const memberIndex = this.members.findIndex(m => m.member_id === memberId)
    if (memberIndex === -1) {
      logger.debug('Mock updateMemberStatus - member not found', { memberId })
      return false
    }

    this.members[memberIndex].membership_status = status
    this.members[memberIndex].updated_at = new Date().toISOString()
    
    if (feePaidUntil) {
      this.members[memberIndex].fee_paid_until = feePaidUntil
    }

    logger.info('Mock member status updated', { memberId, status, feePaidUntil })
    return true
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
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...paymentData,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    this.paymentLogs.push(logEntry)
    logger.info('Mock payment logged', { 
      tx_hash: paymentData.tx_hash,
      amount: paymentData.amount,
      type: paymentData.payment_type
    })
    return true
  }

  // 紹介ツリーの取得
  async getReferralTree(memberId: string): Promise<{
    level1_id?: string
    level2_id?: string 
    level3_id?: string
  } | null> {
    // モックデータでは簡単な紹介ツリーを返す
    if (memberId === 'CLAW0001') {
      return {
        level1_id: 'master_001',
        level2_id: undefined,
        level3_id: undefined
      }
    }
    return null
  }

  // 報酬計算の記録
  async logReward(rewardData: RewardCalculation): Promise<boolean> {
    const logEntry = {
      id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...rewardData,
      status: 'pending',
      created_at: new Date().toISOString()
    }

    this.rewardLogs.push(logEntry)
    logger.info('Mock reward logged', rewardData)
    return true
  }

  // 月次報酬サマリーの取得
  async getMonthlyRewardSummary(paymentMonth: string): Promise<any[]> {
    // モックデータ
    const mockSummary = [
      {
        member_id: 'master_001',
        minara_wallet: '0xMasterWallet123',
        total_amount: 500,
        referral_count: 2,
        payment_month: paymentMonth
      }
    ]
    
    logger.debug('Mock monthly reward summary', { paymentMonth, count: mockSummary.length })
    return mockSummary
  }

  // 報酬支払い完了の記録
  async markRewardPaid(
    memberId: string, 
    paymentMonth: string, 
    txHash: string
  ): Promise<boolean> {
    logger.info('Mock reward marked as paid', { memberId, paymentMonth, txHash })
    return true
  }

  // ゲートウェイメッセージの送信
  async sendMessage(messageData: {
    target: string
    message_type: string
    payload: any
    priority?: number
    expires_at?: string
  }): Promise<boolean> {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...messageData,
      created_by: 'master_001',
      created_at: new Date().toISOString(),
      priority: messageData.priority || 5,
      delivered_count: 0
    }

    this.gatewayMessages.push(message)
    logger.info('Mock gateway message sent', { 
      target: messageData.target, 
      type: messageData.message_type 
    })
    return true
  }

  // システムログの記録
  async logSystemEvent(eventData: SystemEvent): Promise<void> {
    logger.debug('Mock system event logged', {
      level: eventData.level,
      component: eventData.component,
      event_type: eventData.event_type,
      message: eventData.message
    })
  }

  // アクティブメンバーの取得
  async getActiveMembers(): Promise<Member[]> {
    const activeMembers = this.members.filter(m => m.membership_status === 'active')
    logger.debug('Mock getActiveMembers', { count: activeMembers.length })
    return activeMembers
  }

  // 支払い期限チェック
  async getMembersWithUpcomingPayments(daysBefore: number): Promise<Member[]> {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysBefore)
    
    const upcomingMembers = this.members.filter(m => {
      if (!m.fee_paid_until) return false
      const feeDate = new Date(m.fee_paid_until)
      return feeDate <= targetDate
    })

    logger.debug('Mock getMembersWithUpcomingPayments', { 
      daysBefore, 
      targetDate: targetDate.toISOString().split('T')[0],
      count: upcomingMembers.length 
    })
    return upcomingMembers
  }

  // 開発用: モックデータの状態確認
  getMockState() {
    return {
      members: this.members.length,
      paymentLogs: this.paymentLogs.length,
      rewardLogs: this.rewardLogs.length,
      gatewayMessages: this.gatewayMessages.length
    }
  }

  // 開発用: モックデータのリセット
  resetMockData() {
    this.paymentLogs = []
    this.rewardLogs = []
    this.gatewayMessages = []
    logger.info('Mock data reset completed')
  }
}
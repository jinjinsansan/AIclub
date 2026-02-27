// 月次報酬処理サービス
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import type { Member, RewardCalculation, RewardSummary } from '@/types'
import { DatabaseService } from './database'
import { MinaraService } from './minara'
import { NotificationService } from './notification'

export class MonthlyRewardService {
  private db: DatabaseService
  private minara: MinaraService
  private notification: NotificationService

  constructor(
    db: DatabaseService,
    minara: MinaraService,
    notification: NotificationService
  ) {
    this.db = db
    this.minara = minara
    this.notification = notification
  }

  // メイン：月次報酬処理（毎月1日実行）
  async processMonthlyRewards(targetMonth: string): Promise<{
    success: boolean
    processedCount: number
    totalAmount: number
    errors: any[]
  }> {
    const perf = new PerformanceLogger('monthly-rewards-processing')
    const errors: any[] = []
    let processedCount = 0
    let totalAmount = 0

    try {
      loggerHelpers.payment.processing(`Starting monthly rewards processing for ${targetMonth}`)

      // 1. 対象月の報酬サマリーを取得
      const rewardSummaries = await this.db.getMonthlyRewardSummary(targetMonth)
      
      if (rewardSummaries.length === 0) {
        logger.info('No rewards to process for month', { targetMonth })
        return {
          success: true,
          processedCount: 0,
          totalAmount: 0,
          errors: []
        }
      }

      loggerHelpers.payment.processing(`Found ${rewardSummaries.length} members with pending rewards`)

      // 2. 各メンバーの報酬を処理
      for (const summary of rewardSummaries) {
        try {
          const memberRewardResult = await this.processMemberReward(summary, targetMonth)
          
          if (memberRewardResult.success) {
            processedCount++
            totalAmount += summary.total_amount
          } else {
            errors.push({
              member_id: summary.member_id,
              error: memberRewardResult.error
            })
          }

          // レート制限対応（1秒間隔）
          await new Promise(resolve => setTimeout(resolve, 1000))

        } catch (error: any) {
          errors.push({
            member_id: summary.member_id,
            error: error.message
          })
          logger.error('Member reward processing error', {
            member_id: summary.member_id,
            error: error.message
          })
        }
      }

      // 3. 処理結果をログ
      const successRate = (processedCount / rewardSummaries.length) * 100
      
      loggerHelpers.payment.completed('Monthly rewards processing completed', {
        targetMonth,
        total_members: rewardSummaries.length,
        processed_count: processedCount,
        total_amount: totalAmount,
        success_rate: `${successRate.toFixed(1)}%`,
        error_count: errors.length
      })

      // 4. 運営への通知
      if (processedCount > 0) {
        await this.notification.sendRewardProcessingNotification({
          month: targetMonth,
          processed_count: processedCount,
          total_amount: totalAmount,
          error_count: errors.length
        })
      }

      perf.finish({
        processed_count: processedCount,
        total_amount: totalAmount
      })

      return {
        success: errors.length === 0,
        processedCount,
        totalAmount,
        errors
      }

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Monthly rewards processing failed', {
        targetMonth,
        error: error.message,
        stack: error.stack
      })

      return {
        success: false,
        processedCount,
        totalAmount,
        errors: [...errors, { system_error: error.message }]
      }
    }
  }

  // 個別メンバーの報酬処理
  private async processMemberReward(
    summary: RewardSummary,
    targetMonth: string
  ): Promise<{
    success: boolean
    txHash?: string
    error?: string
  }> {
    const perf = new PerformanceLogger('member-reward-processing')

    try {
      // 1. 送金前の最終確認
      const member = await this.db.getMember(summary.member_id)
      if (!member) {
        return { success: false, error: 'Member not found' }
      }

      if (!member.minara_wallet) {
        return { success: false, error: 'No MINARA wallet registered' }
      }

      if (summary.total_amount <= 0) {
        return { success: false, error: 'Invalid reward amount' }
      }

      // 2. MINARA送金実行
      logger.info('Sending reward payment', {
        member_id: summary.member_id,
        wallet: this.maskWallet(member.minara_wallet),
        amount: summary.total_amount,
        month: targetMonth
      })

      const sendResult = await this.minara.sendPayment({
        to_wallet: member.minara_wallet,
        amount: summary.total_amount,
        currency: 'USDT',
        memo: `OPEN CLAW紹介報酬 ${targetMonth} (紹介数:${summary.referral_count})`
      })

      if (!sendResult.success) {
        return {
          success: false,
          error: `Payment failed: ${sendResult.error}`
        }
      }

      // 3. データベース更新
      await this.db.markRewardPaid(
        summary.member_id,
        targetMonth,
        sendResult.tx_hash!
      )

      // 4. メンバーへの通知
      await this.notification.sendRewardPaidNotification({
        member_id: summary.member_id,
        amount: summary.total_amount,
        tx_hash: sendResult.tx_hash!,
        month: targetMonth,
        referral_count: summary.referral_count
      })

      loggerHelpers.payment.completed('Reward payment completed', {
        member_id: summary.member_id,
        amount: summary.total_amount,
        tx_hash: sendResult.tx_hash,
        month: targetMonth
      })

      perf.finish({
        amount: summary.total_amount,
        tx_hash: sendResult.tx_hash
      })

      return {
        success: true,
        txHash: sendResult.tx_hash
      }

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Member reward processing error', {
        member_id: summary.member_id,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 新規支払いに対する紹介報酬計算
  async calculateReferralRewards(
    paymentAmount: number,
    newMemberId: string
  ): Promise<RewardCalculation[]> {
    const perf = new PerformanceLogger('referral-rewards-calculation')
    const rewards: RewardCalculation[] = []

    try {
      // 1. 紹介ツリーを取得
      const referralTree = await this.db.getReferralTree(newMemberId)
      
      if (!referralTree) {
        logger.debug('No referral tree found', { member_id: newMemberId })
        perf.finish({ reward_count: 0 })
        return rewards
      }

      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM

      // 2. 1段目報酬（直接紹介者）
      if (referralTree.level1_id) {
        const level1Reward: RewardCalculation = {
          member_id: referralTree.level1_id,
          referred_member: newMemberId,
          level: 1,
          amount: config.payment.referralRewards.level1, // $200
          payment_month: currentMonth,
          created_at: new Date().toISOString()
        }
        rewards.push(level1Reward)
        await this.db.logReward(level1Reward)
      }

      // 3. 2段目報酬
      if (referralTree.level2_id) {
        const level2Reward: RewardCalculation = {
          member_id: referralTree.level2_id,
          referred_member: newMemberId,
          level: 2,
          amount: config.payment.referralRewards.level2, // $50
          payment_month: currentMonth,
          created_at: new Date().toISOString()
        }
        rewards.push(level2Reward)
        await this.db.logReward(level2Reward)
      }

      // 4. 3段目報酬
      if (referralTree.level3_id) {
        const level3Reward: RewardCalculation = {
          member_id: referralTree.level3_id,
          referred_member: newMemberId,
          level: 3,
          amount: config.payment.referralRewards.level3, // $50
          payment_month: currentMonth,
          created_at: new Date().toISOString()
        }
        rewards.push(level3Reward)
        await this.db.logReward(level3Reward)
      }

      const totalRewards = rewards.reduce((sum, r) => sum + r.amount, 0)
      
      loggerHelpers.payment.processing('Referral rewards calculated', {
        new_member: newMemberId,
        payment_amount: paymentAmount,
        total_rewards: totalRewards,
        reward_breakdown: rewards.map(r => ({
          level: r.level,
          member_id: r.member_id,
          amount: r.amount
        }))
      })

      perf.finish({
        reward_count: rewards.length,
        total_amount: totalRewards
      })

      return rewards

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Referral rewards calculation error', {
        new_member: newMemberId,
        payment_amount: paymentAmount,
        error: error.message
      })
      return rewards
    }
  }

  // 運営分の自動送金（$400）
  async distributeOperatorShare(
    paymentAmount: number,
    txHash: string,
    fromWallet: string
  ): Promise<{
    success: boolean
    txHash?: string
    error?: string
  }> {
    const perf = new PerformanceLogger('operator-share-distribution')

    try {
      const operatorShare = config.payment.operatorShare // $400
      const operatorWallets = config.minara.operatorWallets

      if (paymentAmount < config.payment.initialFeeUsd) {
        return { success: false, error: 'Payment amount too low for operator share' }
      }

      // 運営ウォレットへの分配（現在は1つのウォレット）
      const mainOperatorWallet = operatorWallets[0]

      const sendResult = await this.minara.sendPayment({
        to_wallet: mainOperatorWallet,
        amount: operatorShare,
        currency: 'USDT',
        memo: `OPEN CLAW運営分 - 元取引: ${txHash}`
      })

      if (!sendResult.success) {
        return {
          success: false,
          error: `Operator share distribution failed: ${sendResult.error}`
        }
      }

      // ログ記録
      await this.db.logPayment({
        payment_type: 'operator_share',
        from_wallet: config.minara.masterWallet,
        to_wallet: mainOperatorWallet,
        amount: operatorShare,
        currency: 'USDT',
        tx_hash: sendResult.tx_hash!,
        memo: `運営分自動分配 - 元取引: ${txHash}`
      })

      loggerHelpers.payment.completed('Operator share distributed', {
        amount: operatorShare,
        to_wallet: this.maskWallet(mainOperatorWallet),
        tx_hash: sendResult.tx_hash,
        source_tx: txHash
      })

      perf.finish({
        amount: operatorShare,
        tx_hash: sendResult.tx_hash
      })

      return {
        success: true,
        txHash: sendResult.tx_hash
      }

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Operator share distribution error', {
        payment_amount: paymentAmount,
        source_tx: txHash,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 報酬処理統計の取得
  async getRewardProcessingStats(): Promise<{
    current_month: {
      pending_rewards: number
      total_amount: number
      processed_count: number
    }
    last_processing: {
      date: string
      success_rate: number
      total_amount: number
    } | null
    all_time: {
      total_distributed: number
      total_members_rewarded: number
    }
  }> {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7)
      
      // 現在月の統計
      const currentMonthSummary = await this.db.getMonthlyRewardSummary(currentMonth)
      const pendingRewards = currentMonthSummary.length
      const totalPendingAmount = currentMonthSummary.reduce((sum, s) => sum + s.total_amount, 0)

      return {
        current_month: {
          pending_rewards: pendingRewards,
          total_amount: totalPendingAmount,
          processed_count: 0 // TODO: 実装
        },
        last_processing: null, // TODO: 実装
        all_time: {
          total_distributed: 0, // TODO: 実装
          total_members_rewarded: 0 // TODO: 実装
        }
      }
    } catch (error: any) {
      logger.error('Failed to get reward processing stats', { error: error.message })
      return {
        current_month: { pending_rewards: 0, total_amount: 0, processed_count: 0 },
        last_processing: null,
        all_time: { total_distributed: 0, total_members_rewarded: 0 }
      }
    }
  }

  // プライベートヘルパー
  private maskWallet(wallet: string): string {
    if (wallet.length < 10) return '***'
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
  }
}
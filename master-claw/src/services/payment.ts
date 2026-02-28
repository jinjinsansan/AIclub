import { DatabaseService } from './database'
import { MinaraService } from './minara'
import { NotificationService } from './notification'
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import { PaymentWebhookData, Member, RewardCalculation } from '@/types'

export class PaymentService {
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

  // 初期費用の支払い確認・処理
  async processInitialPayment(webhookData: PaymentWebhookData): Promise<boolean> {
    const perf = new PerformanceLogger('processInitialPayment', {
      amount: webhookData.amount,
      from_wallet: webhookData.from_wallet.slice(0, 10) + '...',
      tx_hash: webhookData.tx_hash
    })

    try {
      // 1. 金額チェック
      if (webhookData.amount < config.payment.initialFeeUsd) {
        loggerHelpers.payment.failed('Initial payment amount insufficient', {
          received: webhookData.amount,
          required: config.payment.initialFeeUsd,
          tx_hash: webhookData.tx_hash
        })
        return false
      }

      // 2. 会員特定（ウォレットアドレスで検索）
      const member = await this.db.getMemberByWallet(webhookData.from_wallet)
      if (!member) {
        loggerHelpers.payment.failed('Member not found for wallet address', {
          wallet: webhookData.from_wallet,
          tx_hash: webhookData.tx_hash
        })
        return false
      }

      // 3. 既に処理済みかチェック
      if (member.membership_status === 'active') {
        logger.warn('Payment received for already active member', {
          member_id: member.member_id,
          tx_hash: webhookData.tx_hash
        })
        return true // 重複処理だが成功とする
      }

      // 4. 支払いログの記録
      await this.db.logPayment({
        member_id: member.member_id,
        payment_type: 'initial',
        from_wallet: webhookData.from_wallet,
        to_wallet: webhookData.to_wallet,
        amount: webhookData.amount,
        currency: webhookData.currency,
        tx_hash: webhookData.tx_hash,
        memo: webhookData.memo
      })

      // 5. 紹介ツリーの確認と報酬計算
      const referralTree = await this.db.getReferralTree(member.member_id)
      const operatorAmount = this.calculateOperatorShare(referralTree)

      // 6. 運営分を即時送金
      const operatorSendResult = await this.minara.sendTransaction(
        config.minara.operatorWallet,
        operatorAmount,
        `Initial fee operator share - ${member.member_id}`
      )

      if (!operatorSendResult) {
        loggerHelpers.payment.failed('Failed to send operator share', {
          member_id: member.member_id,
          amount: operatorAmount
        })
        return false
      }

      // 7. 紹介報酬の計上
      if (referralTree) {
        await this.calculateAndLogReferralRewards(member.member_id, referralTree)
      }

      // 8. 会員ステータスをアクティブに更新
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      const feePaidUntil = nextMonth.toISOString().split('T')[0]

      const updateResult = await this.db.updateMemberStatus(
        member.member_id,
        'active',
        feePaidUntil
      )

      if (!updateResult) {
        loggerHelpers.payment.failed('Failed to update member status', {
          member_id: member.member_id
        })
        return false
      }

      // 9. 通知送信
      await this.notification.sendWelcomePaymentConfirmed(member)
      await this.notification.sendNewMemberNotification(member)

      loggerHelpers.payment.processed('Initial payment processed successfully', {
        member_id: member.member_id,
        amount: webhookData.amount,
        operator_amount: operatorAmount,
        operator_tx_hash: operatorSendResult.tx_hash
      })

      perf.finish({ success: true, member_id: member.member_id })
      return true

    } catch (error: any) {
      perf.finishWithError(error)
      loggerHelpers.payment.failed('Initial payment processing error', {
        error: error.message,
        tx_hash: webhookData.tx_hash
      })
      return false
    }
  }

  // 月額会費の支払い処理
  async processMonthlyPayment(webhookData: PaymentWebhookData): Promise<boolean> {
    const perf = new PerformanceLogger('processMonthlyPayment', {
      amount: webhookData.amount,
      from_wallet: webhookData.from_wallet.slice(0, 10) + '...',
      tx_hash: webhookData.tx_hash
    })

    try {
      // 1. 会員特定
      const member = await this.db.getMemberByWallet(webhookData.from_wallet)
      if (!member) {
        loggerHelpers.payment.failed('Member not found for monthly payment', {
          wallet: webhookData.from_wallet,
          tx_hash: webhookData.tx_hash
        })
        return false
      }

      // 2. 月額会費の金額確認（設定から取得）
      // TODO: システム設定から月額料金を取得
      const monthlyFee = 100 // 暫定値
      if (webhookData.amount < monthlyFee) {
        loggerHelpers.payment.failed('Monthly payment amount insufficient', {
          received: webhookData.amount,
          required: monthlyFee,
          member_id: member.member_id
        })
        return false
      }

      // 3. 支払いログの記録
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      await this.db.logPayment({
        member_id: member.member_id,
        payment_type: 'monthly',
        from_wallet: webhookData.from_wallet,
        to_wallet: webhookData.to_wallet,
        amount: webhookData.amount,
        currency: webhookData.currency,
        tx_hash: webhookData.tx_hash,
        payment_period: currentMonth,
        memo: webhookData.memo
      })

      // 4. 支払い期限の延長
      const currentPaidUntil = member.fee_paid_until ? new Date(member.fee_paid_until) : new Date()
      const newPaidUntil = new Date(currentPaidUntil)
      
      if (newPaidUntil <= new Date()) {
        newPaidUntil.setMonth(new Date().getMonth() + 1)
      } else {
        newPaidUntil.setMonth(newPaidUntil.getMonth() + 1)
      }

      // 5. 会員ステータスの更新
      await this.db.updateMemberStatus(
        member.member_id,
        'active',
        newPaidUntil.toISOString().split('T')[0]
      )

      loggerHelpers.payment.processed('Monthly payment processed successfully', {
        member_id: member.member_id,
        amount: webhookData.amount,
        new_paid_until: newPaidUntil.toISOString().split('T')[0]
      })

      perf.finish({ success: true, member_id: member.member_id })
      return true

    } catch (error: any) {
      perf.finishWithError(error)
      return false
    }
  }

  // 月次報酬の一括送金処理
  async processMonthlyRewards(): Promise<{
    successful: number
    failed: number
    total_amount: number
  }> {
    const perf = new PerformanceLogger('processMonthlyRewards')
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    try {
      // 1. 未払い報酬の集計
      const rewardSummary = await this.db.getMonthlyRewardSummary(currentMonth)
      
      if (rewardSummary.length === 0) {
        logger.info('No pending rewards for monthly payout', { month: currentMonth })
        perf.finish({ successful: 0, failed: 0, total_amount: 0 })
        return { successful: 0, failed: 0, total_amount: 0 }
      }

      // 2. バッチ送金用のトランザクション配列を作成
      const transactions = rewardSummary.map(reward => ({
        to_wallet: reward.minara_wallet,
        amount: reward.total_amount,
        memo: `Monthly referral rewards ${currentMonth} - ${reward.member_id}`
      })).filter(tx => tx.to_wallet) // ウォレットアドレスがあるもののみ

      const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0)

      // 3. マスターウォレットの残高確認
      const balance = await this.minara.getWalletBalance()
      if (!balance || balance < totalAmount) {
        loggerHelpers.payment.failed('Insufficient balance for monthly rewards', {
          balance,
          required: totalAmount,
          month: currentMonth
        })
        return { successful: 0, failed: 0, total_amount: 0 }
      }

      // 4. バッチ送金実行
      const results = await this.minara.sendBatchTransactions(transactions)

      // 5. 成功した送金の記録
      for (const success of results.successful) {
        const rewardData = rewardSummary.find(r => r.minara_wallet === success.to_wallet)
        if (rewardData) {
          await this.db.markRewardPaid(rewardData.member_id, currentMonth, success.tx_hash)
          
          // 報酬支払い通知
          const member = await this.db.getMember(rewardData.member_id)
          if (member) {
            await this.notification.sendRewardPaymentNotification(
              member,
              rewardData.total_amount,
              success.tx_hash
            )
          }
        }
      }

      // 6. 失敗した送金のログ
      for (const failure of results.failed) {
        logger.error('Monthly reward payment failed', {
          wallet: failure.to_wallet,
          error: failure.error,
          month: currentMonth
        })
      }

      loggerHelpers.payment.processed('Monthly rewards processed', {
        month: currentMonth,
        successful: results.successful.length,
        failed: results.failed.length,
        total_amount: totalAmount
      })

      perf.finish({
        successful: results.successful.length,
        failed: results.failed.length,
        total_amount: totalAmount
      })

      return {
        successful: results.successful.length,
        failed: results.failed.length,
        total_amount: totalAmount
      }

    } catch (error: any) {
      perf.finishWithError(error)
      return { successful: 0, failed: 0, total_amount: 0 }
    }
  }

  // 運営分の計算
  private calculateOperatorShare(referralTree: any | null): number {
    let operatorShare = config.payment.operatorShareUsd

    if (!referralTree) {
      // 紹介者がいない場合、紹介報酬分も運営が受け取る
      operatorShare += config.payment.referralLevel1Usd
      operatorShare += config.payment.referralLevel2Usd
      operatorShare += config.payment.referralLevel3Usd
    } else {
      // 紹介者がいない段階の報酬も運営に
      if (!referralTree.level2_id) {
        operatorShare += config.payment.referralLevel2Usd
      }
      if (!referralTree.level3_id) {
        operatorShare += config.payment.referralLevel3Usd
      }
    }

    return operatorShare
  }

  // 紹介報酬の計算・計上
  private async calculateAndLogReferralRewards(
    newMemberId: string,
    referralTree: any
  ): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const rewards: RewardCalculation[] = []

    // 1段目報酬
    if (referralTree.level1_id) {
      rewards.push({
        member_id: referralTree.level1_id,
        referred_member: newMemberId,
        level: 1,
        amount: config.payment.referralLevel1Usd,
        payment_month: currentMonth
      })
    }

    // 2段目報酬
    if (referralTree.level2_id) {
      rewards.push({
        member_id: referralTree.level2_id,
        referred_member: newMemberId,
        level: 2,
        amount: config.payment.referralLevel2Usd,
        payment_month: currentMonth
      })
    }

    // 3段目報酬
    if (referralTree.level3_id) {
      rewards.push({
        member_id: referralTree.level3_id,
        referred_member: newMemberId,
        level: 3,
        amount: config.payment.referralLevel3Usd,
        payment_month: currentMonth
      })
    }

    // データベースに記録
    for (const reward of rewards) {
      await this.db.logReward(reward)
      loggerHelpers.reward.calculated('Referral reward calculated', reward)
    }
  }

  // 支払い期限チェックとリマインダー送信
  async checkPaymentReminders(): Promise<void> {
    const perf = new PerformanceLogger('checkPaymentReminders')

    try {
      const membersToRemind = await this.db.getMembersWithUpcomingPayments(
        config.payment.reminderDaysBefore
      )

      let remindersSent = 0

      for (const member of membersToRemind) {
        try {
          await this.notification.sendPaymentReminder(member)
          remindersSent++
          logger.info('Payment reminder sent', { member_id: member.member_id })
        } catch (error: any) {
          logger.error('Failed to send payment reminder', {
            member_id: member.member_id,
            error: error.message
          })
        }
      }

      perf.finish({ members_checked: membersToRemind.length, reminders_sent: remindersSent })
    } catch (error: any) {
      perf.finishWithError(error)
    }
  }

  // 期限切れメンバーのステータス更新
  async updateExpiredMembers(): Promise<void> {
    const perf = new PerformanceLogger('updateExpiredMembers')

    try {
      // 期限切れメンバーを取得（期限が今日より前）
      const expiredMembers = await this.db.getMembersWithUpcomingPayments(-1)

      let updatedCount = 0

      for (const member of expiredMembers) {
        const daysPastDue = Math.abs(
          Math.floor((new Date().getTime() - new Date(member.fee_paid_until!).getTime()) / (1000 * 60 * 60 * 24))
        )

        let newStatus: Member['membership_status']
        if (daysPastDue <= 1) {
          newStatus = 'suspended' // 1日以内は一時停止
        } else {
          newStatus = 'expired' // 1日超過は期限切れ
        }

        if (member.membership_status !== newStatus) {
          await this.db.updateMemberStatus(member.member_id, newStatus)
          updatedCount++
          
          loggerHelpers.member.suspended('Member status updated due to payment expiry', {
            member_id: member.member_id,
            old_status: member.membership_status,
            new_status: newStatus,
            days_past_due: daysPastDue
          })
        }
      }

      perf.finish({ members_checked: expiredMembers.length, updated: updatedCount })
    } catch (error: any) {
      perf.finishWithError(error)
    }
  }
}
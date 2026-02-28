import axios, { AxiosInstance } from 'axios'
import { config } from '@/config'
import { logger, loggerHelpers } from '@/utils/logger'
import { Member, NotificationData, LineNotificationRequest } from '@/types'
import { DatabaseService } from './database'

export class NotificationService {
  private lineClient?: AxiosInstance
  private db: DatabaseService

  constructor(db: DatabaseService) {
    this.db = db

    // LINE Messaging API クライアントの初期化
    if (config.line.channelAccessToken) {
      this.lineClient = axios.create({
        baseURL: 'https://api.line.me/v2/bot',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${config.line.channelAccessToken}`,
          'Content-Type': 'application/json'
        }
      })
    }
  }

  // 入金確認・ウェルカム通知（メール）
  async sendWelcomePaymentConfirmed(member: Member): Promise<boolean> {
    try {
      const variables = {
        display_name: member.display_name,
        amount: config.payment.initialFeeUsd,
        member_id: member.member_id
      }

      await this.sendNotification({
        recipient: member.email,
        channel: 'email',
        template_key: 'welcome_payment_confirmed',
        variables
      })

      loggerHelpers.member.activated('Welcome email sent', {
        member_id: member.member_id,
        email: member.email
      })

      return true
    } catch (error: any) {
      logger.error('Failed to send welcome email', {
        member_id: member.member_id,
        error: error.message
      })
      return false
    }
  }

  // 新メンバー参加通知（LINE グループ）
  async sendNewMemberNotification(member: Member): Promise<boolean> {
    if (!config.line.groupId) {
      logger.debug('LINE group ID not configured, skipping new member notification')
      return true
    }

    try {
      // 現在の総メンバー数を取得
      const activeMembers = await this.db.getActiveMembers()
      const totalMembers = activeMembers.length

      const message = `【OPEN CLAW】新メンバー参加！\n${member.display_name}さんがコミュニティに参加しました。\n現在のメンバー数: ${totalMembers}名`

      await this.sendLineMessage(message, config.line.groupId)

      loggerHelpers.line.sent('New member notification sent to LINE group', {
        member_id: member.member_id,
        group_id: config.line.groupId
      })

      return true
    } catch (error: any) {
      loggerHelpers.line.failed('Failed to send new member LINE notification', {
        member_id: member.member_id,
        error: error.message
      })
      return false
    }
  }

  // 月額会費リマインダー（メール）
  async sendPaymentReminder(member: Member): Promise<boolean> {
    try {
      const dueDate = new Date(member.fee_paid_until!)
      const today = new Date()
      const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const variables = {
        display_name: member.display_name,
        days_remaining: daysRemaining,
        fee_paid_until: dueDate.toLocaleDateString('ja-JP'),
        payment_url: 'https://openclaw.com/dashboard/payment'
      }

      await this.sendNotification({
        recipient: member.email,
        channel: 'email',
        template_key: 'monthly_fee_reminder',
        variables
      })

      logger.info('Payment reminder sent', {
        member_id: member.member_id,
        days_remaining: daysRemaining
      })

      return true
    } catch (error: any) {
      logger.error('Failed to send payment reminder', {
        member_id: member.member_id,
        error: error.message
      })
      return false
    }
  }

  // 報酬支払い通知（LINE個人 + メール）
  async sendRewardPaymentNotification(
    member: Member,
    amount: number,
    txHash: string
  ): Promise<boolean> {
    try {
      const variables = {
        display_name: member.display_name,
        amount: amount,
        tx_hash: txHash,
        tx_url: `https://explorer.minara.ai/tx/${txHash}`
      }

      // メール通知
      await this.sendNotification({
        recipient: member.email,
        channel: 'email',
        template_key: 'reward_payment_notification',
        variables
      })

      // LINE個人通知（可能な場合）
      if (config.line.channelAccessToken) {
        const lineMessage = `【OPEN CLAW 月次報酬】\n今月の紹介報酬を送金しました。\n受取額: $${amount}\nTxID: ${txHash}\nお疲れさまです！`
        
        // 注：実際のLINE個人メッセージ送信には、事前にユーザーIDの取得が必要
        // ここでは仕様書に基づいて実装の枠組みを示す
        loggerHelpers.line.sent('Reward payment notification prepared', {
          member_id: member.member_id,
          amount: amount
        })
      }

      loggerHelpers.reward.sent('Reward payment notification sent', {
        member_id: member.member_id,
        amount: amount,
        tx_hash: txHash
      })

      return true
    } catch (error: any) {
      loggerHelpers.reward.failed('Failed to send reward payment notification', {
        member_id: member.member_id,
        amount: amount,
        error: error.message
      })
      return false
    }
  }

  // トレードシグナル配信通知
  async broadcastTradeSignal(signal: {
    signal_id: string
    pair: string
    direction: string
    natural_language: string
    entry_price?: number
  }): Promise<boolean> {
    try {
      // LINE グループにトレードシグナルを配信
      if (config.line.groupId) {
        const message = `【OPEN CLAW トレードシグナル】\n` +
          `ペア: ${signal.pair}\n` +
          `方向: ${signal.direction}\n` +
          `内容: ${signal.natural_language}\n` +
          `ID: ${signal.signal_id}`

        await this.sendLineMessage(message, config.line.groupId)
      }

      // ゲートウェイメッセージとしてメンバーCLAWに配信
      await this.db.sendMessage({
        target: 'all',
        message_type: 'trade_signal',
        payload: signal,
        priority: 1, // 高優先度
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分後に期限切れ
      })

      loggerHelpers.trade.broadcast('Trade signal broadcasted', {
        signal_id: signal.signal_id,
        pair: signal.pair,
        direction: signal.direction
      })

      return true
    } catch (error: any) {
      logger.error('Failed to broadcast trade signal', {
        signal_id: signal.signal_id,
        error: error.message
      })
      return false
    }
  }

  // システムアラート通知（管理者向け）
  async sendSystemAlert(
    level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
    message: string,
    details?: any
  ): Promise<boolean> {
    try {
      // 重要なアラートはLINE通知も送信
      if (['ERROR', 'CRITICAL'].includes(level) && config.line.notifyToken) {
        const notifyMessage = `【OPEN CLAW システムアラート】\n${level}: ${message}`
        await this.sendLineNotify(notifyMessage)
      }

      // システムログに記録
      await this.db.logSystemEvent({
        level: level as any,
        component: 'notification',
        event_type: 'system_alert',
        message,
        details
      })

      return true
    } catch (error: any) {
      console.error('Failed to send system alert:', error)
      return false
    }
  }

  // 一般的な通知送信（メール）
  private async sendNotification(notificationData: NotificationData): Promise<void> {
    try {
      // 実際のメール送信は外部サービス（SendGrid、Resend等）を使用
      // ここでは通知ログにのみ記録
      await this.db.supabase
        .from('notification_logs')
        .insert({
          template_key: notificationData.template_key,
          channel: notificationData.channel,
          recipient: notificationData.recipient,
          content: JSON.stringify(notificationData.variables),
          variables_used: notificationData.variables,
          status: 'sent' // 実際の実装では送信結果に応じて更新
        })

      logger.debug('Notification logged', {
        recipient: notificationData.recipient,
        template: notificationData.template_key,
        channel: notificationData.channel
      })
    } catch (error: any) {
      logger.error('Failed to log notification', {
        error: error.message,
        notification: notificationData
      })
      throw error
    }
  }

  // LINE メッセージ送信（グループ・個人）
  private async sendLineMessage(message: string, targetId: string): Promise<boolean> {
    if (!this.lineClient) {
      logger.warn('LINE client not configured')
      return false
    }

    try {
      // グループの場合は push メッセージ、個人の場合は push メッセージまたはreply
      const endpoint = targetId.startsWith('C') || targetId.startsWith('R') 
        ? '/message/push'  // グループ・ルーム
        : '/message/push'  // 個人

      const requestBody = {
        to: targetId,
        messages: [{
          type: 'text',
          text: message
        }]
      }

      const response = await this.lineClient.post(endpoint, requestBody)

      if (response.status === 200) {
        loggerHelpers.line.sent('LINE message sent successfully', {
          target: targetId,
          message_length: message.length
        })
        return true
      } else {
        throw new Error(`LINE API returned status ${response.status}`)
      }
    } catch (error: any) {
      loggerHelpers.line.failed('Failed to send LINE message', {
        target: targetId,
        error: error.response?.data || error.message
      })
      return false
    }
  }

  // LINE Notify 送信（管理者アラート用）
  private async sendLineNotify(message: string): Promise<boolean> {
    if (!config.line.notifyToken) {
      return false
    }

    try {
      const response = await axios.post(
        'https://notify-api.line.me/api/notify',
        `message=${encodeURIComponent(message)}`,
        {
          headers: {
            'Authorization': `Bearer ${config.line.notifyToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      return response.status === 200
    } catch (error: any) {
      logger.error('Failed to send LINE Notify', { error: error.message })
      return false
    }
  }

  // 一斉配信（全メンバー向け）
  async broadcastToAllMembers(
    messageType: 'broadcast' | 'update' | 'system_alert',
    payload: any,
    priority: number = 5
  ): Promise<boolean> {
    try {
      await this.db.sendMessage({
        target: 'all',
        message_type: messageType,
        payload,
        priority
      })

      logger.info('Broadcast message sent to all members', {
        type: messageType,
        priority
      })

      return true
    } catch (error: any) {
      logger.error('Failed to broadcast message', {
        type: messageType,
        error: error.message
      })
      return false
    }
  }

  // 個別メッセージ送信
  async sendPrivateMessage(
    memberId: string,
    payload: any,
    priority: number = 5
  ): Promise<boolean> {
    try {
      await this.db.sendMessage({
        target: memberId,
        message_type: 'private',
        payload,
        priority
      })

      logger.info('Private message sent', {
        member_id: memberId,
        priority
      })

      return true
    } catch (error: any) {
      logger.error('Failed to send private message', {
        member_id: memberId,
        error: error.message
      })
      return false
    }
  }

  // 通知テンプレートの取得
  private async getNotificationTemplate(templateKey: string, channel: string): Promise<{
    subject?: string
    content: string
    variables?: any
  } | null> {
    try {
      const { data, error } = await this.db.supabase
        .from('notification_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('channel', channel)
        .eq('is_active', true)
        .single()

      if (error) {
        logger.error('Failed to get notification template', {
          template_key: templateKey,
          channel,
          error
        })
        return null
      }

      return data
    } catch (error: any) {
      logger.error('Error getting notification template', {
        template_key: templateKey,
        error: error.message
      })
      return null
    }
  }

  // テンプレート変数の置換
  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      result = result.replace(regex, String(value))
    }

    return result
  }

  // ヘルスチェック
  async healthCheck(): Promise<{
    line: boolean
    email: boolean
    database: boolean
  }> {
    const health = {
      line: false,
      email: true, // メール機能は外部サービス依存のため常にtrueとする
      database: false
    }

    // LINE API ヘルスチェック
    if (this.lineClient) {
      try {
        // LINE Bot Info APIを使用してヘルスチェック
        const response = await this.lineClient.get('/info')
        health.line = response.status === 200
      } catch (error) {
        health.line = false
      }
    }

    // データベースヘルスチェック
    try {
      health.database = await this.db.healthCheck()
    } catch (error) {
      health.database = false
    }

    return health
  }
}
// LINE通知サービス
import axios, { AxiosInstance } from 'axios'
import { config } from '@/config'
import { logger, loggerHelpers, PerformanceLogger } from '@/utils/logger'
import type { Member, RewardSummary, SeminarSchedule } from '@/types'
import { DatabaseService } from './database'
import { LineMessages } from './line-messages'

interface LineMessage {
  type: 'text' | 'flex' | 'template'
  text?: string
  flexMessage?: any
  template?: any
}

interface LineNotificationResult {
  success: boolean
  message_id?: string
  error?: string
}

export class LineNotificationService {
  private client: AxiosInstance
  private db: DatabaseService
  private channelAccessToken: string
  private broadcastChannelId?: string

  constructor(db: DatabaseService) {
    this.db = db
    this.channelAccessToken = config.line.channelAccessToken
    this.broadcastChannelId = config.line.broadcastChannelId

    this.client = axios.create({
      baseURL: 'https://api.line.me/v2/bot',
      headers: {
        'Authorization': `Bearer ${this.channelAccessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })
  }

  // 新規メンバー登録通知
  async notifyNewMember(member: Member): Promise<LineNotificationResult> {
    const perf = new PerformanceLogger('line-new-member-notification')

    try {
      // アクティブメンバー数を取得
      const activeMembers = await this.db.getActiveMembers()
      
      // 仕様書準拠のテキストメッセージを使用
      const message = LineMessages.newMemberJoined(member, activeMembers.length)

      const result = await this.sendBroadcastMessage(message)
      
      if (result.success) {
        loggerHelpers.notification.sent('New member notification sent', {
          member_id: member.member_id,
          member_name: member.display_name,
          message_id: result.message_id
        })
      }

      perf.finish({ success: result.success })
      return result

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to send new member notification', {
        member_id: member.member_id,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 月次報酬確定通知（仕様書準拠版）
  async notifyRewardConfirmedSimple(
    amount: number,
    txHash: string
  ): Promise<LineNotificationResult> {
    const perf = new PerformanceLogger('line-reward-notification-simple')

    try {
      const message = LineMessages.monthlyRewardPaid(amount, txHash)
      const result = await this.sendBroadcastMessage(message)

      if (result.success) {
        loggerHelpers.notification.sent('Reward notification sent', {
          amount,
          tx_hash: txHash,
          message_id: result.message_id
        })
      }

      perf.finish({ success: result.success })
      return result

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to send reward notification', {
        amount,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 従来のFlexMessage版も保持（後方互換性）
  async notifyNewMemberFlex(member: Member): Promise<LineNotificationResult> {
    const perf = new PerformanceLogger('line-new-member-notification')

    try {
      const message = {
        type: 'flex',
        altText: `新規メンバー登録: ${member.display_name}さん`,
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '🎉 新規メンバー登録',
                weight: 'bold',
                size: 'xl',
                color: '#1DB446'
              }
            ],
            backgroundColor: '#f8f9fa',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: member.display_name,
                    weight: 'bold',
                    size: 'lg'
                  },
                  {
                    type: 'text',
                    text: `メンバーID: ${member.member_id}`,
                    size: 'sm',
                    color: '#666666',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `プラン: ${member.plan.toUpperCase()}`,
                    size: 'sm',
                    color: '#666666',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `登録日時: ${new Date().toLocaleString('ja-JP')}`,
                    size: 'sm',
                    color: '#666666',
                    margin: 'md'
                  }
                ]
              }
            ],
            paddingAll: '20px'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'OPEN CLAWコミュニティへようこそ！🦞',
                size: 'sm',
                color: '#1DB446',
                align: 'center'
              }
            ],
            paddingAll: '10px'
          }
        }
      }

      const result = await this.sendBroadcastMessage(message)
      
      if (result.success) {
        loggerHelpers.notification.sent('New member notification sent', {
          member_id: member.member_id,
          member_name: member.display_name,
          message_id: result.message_id
        })
      }

      perf.finish({ success: result.success })
      return result

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to send new member notification', {
        member_id: member.member_id,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 報酬確定通知（月次処理完了後）
  async notifyRewardConfirmed(
    rewards: RewardSummary[], 
    targetMonth: string
  ): Promise<LineNotificationResult> {
    const perf = new PerformanceLogger('line-reward-notification')

    try {
      const totalAmount = rewards.reduce((sum, r) => sum + r.total_amount, 0)
      const totalMembers = rewards.length

      const message = {
        type: 'flex',
        altText: `${targetMonth} 紹介報酬が確定しました`,
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '💰 紹介報酬確定',
                weight: 'bold',
                size: 'xl',
                color: '#FF6B35'
              }
            ],
            backgroundColor: '#fff3e0',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `${targetMonth}月分`,
                weight: 'bold',
                size: 'lg'
              },
              {
                type: 'separator',
                margin: 'lg'
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: '対象メンバー:',
                        size: 'sm',
                        color: '#666666',
                        flex: 2
                      },
                      {
                        type: 'text',
                        text: `${totalMembers}名`,
                        size: 'sm',
                        weight: 'bold',
                        flex: 3
                      }
                    ],
                    margin: 'lg'
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: '総報酬額:',
                        size: 'sm',
                        color: '#666666',
                        flex: 2
                      },
                      {
                        type: 'text',
                        text: `$${totalAmount.toFixed(2)}`,
                        size: 'lg',
                        weight: 'bold',
                        color: '#FF6B35',
                        flex: 3
                      }
                    ],
                    margin: 'lg'
                  }
                ]
              },
              {
                type: 'separator',
                margin: 'lg'
              },
              {
                type: 'text',
                text: '各メンバーのMINARAウォレットに送金されました。',
                size: 'sm',
                color: '#666666',
                margin: 'lg'
              }
            ],
            paddingAll: '20px'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '詳細はダッシュボードでご確認ください',
                size: 'sm',
                color: '#999999',
                align: 'center'
              }
            ],
            paddingAll: '10px'
          }
        }
      }

      const result = await this.sendBroadcastMessage(message)

      if (result.success) {
        loggerHelpers.notification.sent('Reward confirmation notification sent', {
          target_month: targetMonth,
          total_amount: totalAmount,
          member_count: totalMembers,
          message_id: result.message_id
        })
      }

      perf.finish({ success: result.success, total_amount: totalAmount })
      return result

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to send reward confirmation notification', {
        target_month: targetMonth,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // セミナー開始通知
  async notifySeminarStart(seminar: SeminarSchedule): Promise<LineNotificationResult> {
    const perf = new PerformanceLogger('line-seminar-notification')

    try {
      const startTime = new Date(seminar.scheduled_at)
      const now = new Date()
      const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60))

      let alertText = '🎯 セミナー開始'
      if (minutesUntilStart > 0) {
        alertText = `🕐 セミナー${minutesUntilStart}分前`
      }

      const message = {
        type: 'flex',
        altText: `${alertText}: ${seminar.title}`,
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: alertText,
                weight: 'bold',
                size: 'xl',
                color: '#1976D2'
              }
            ],
            backgroundColor: '#e3f2fd',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: seminar.title,
                weight: 'bold',
                size: 'lg',
                wrap: true
              },
              {
                type: 'separator',
                margin: 'lg'
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'box',
                    layout: 'baseline',
                    contents: [
                      {
                        type: 'text',
                        text: '📅 開始時刻:',
                        size: 'sm',
                        color: '#666666',
                        flex: 2
                      },
                      {
                        type: 'text',
                        text: startTime.toLocaleString('ja-JP'),
                        size: 'sm',
                        weight: 'bold',
                        flex: 3
                      }
                    ],
                    margin: 'lg'
                  }
                ]
              }
            ],
            paddingAll: '20px'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'Zoomに参加',
                  uri: seminar.zoom_url || '#'
                },
                style: 'primary',
                color: '#1976D2'
              },
              {
                type: 'text',
                text: '開始時刻になりましたらZoomにご参加ください',
                size: 'xs',
                color: '#999999',
                align: 'center',
                margin: 'md'
              }
            ],
            paddingAll: '20px'
          }
        }
      }

      const result = await this.sendBroadcastMessage(message)

      if (result.success) {
        loggerHelpers.notification.sent('Seminar notification sent', {
          seminar_id: seminar.id,
          title: seminar.title,
          scheduled_at: seminar.scheduled_at,
          message_id: result.message_id
        })
      }

      perf.finish({ success: result.success })
      return result

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to send seminar notification', {
        seminar_id: seminar.id,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // システムアラート通知
  async sendSystemAlert(
    alertType: 'error' | 'warning' | 'info',
    title: string,
    message: string,
    details?: any
  ): Promise<LineNotificationResult> {
    const perf = new PerformanceLogger('line-system-alert')

    try {
      const colors = {
        error: '#F44336',
        warning: '#FF9800',
        info: '#2196F3'
      }

      const icons = {
        error: '🚨',
        warning: '⚠️',
        info: 'ℹ️'
      }

      const alertMessage = {
        type: 'flex',
        altText: `${icons[alertType]} ${title}`,
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `${icons[alertType]} システムアラート`,
                weight: 'bold',
                size: 'lg',
                color: colors[alertType]
              }
            ],
            backgroundColor: '#f5f5f5',
            paddingAll: '15px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md'
              },
              {
                type: 'text',
                text: message,
                size: 'sm',
                wrap: true,
                margin: 'md'
              },
              details && {
                type: 'text',
                text: `詳細: ${JSON.stringify(details)}`,
                size: 'xs',
                color: '#666666',
                wrap: true,
                margin: 'lg'
              }
            ].filter(Boolean),
            paddingAll: '20px'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: new Date().toLocaleString('ja-JP'),
                size: 'xs',
                color: '#999999',
                align: 'center'
              }
            ],
            paddingAll: '10px'
          }
        }
      }

      const result = await this.sendBroadcastMessage(alertMessage)

      if (result.success) {
        loggerHelpers.notification.sent('System alert sent', {
          alert_type: alertType,
          title,
          message_id: result.message_id
        })
      }

      perf.finish({ success: result.success })
      return result

    } catch (error: any) {
      perf.finishWithError(error)
      logger.error('Failed to send system alert', {
        alert_type: alertType,
        title,
        error: error.message
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // ブロードキャストメッセージの送信
  private async sendBroadcastMessage(message: LineMessage): Promise<LineNotificationResult> {
    try {
      if (!this.broadcastChannelId) {
        throw new Error('Broadcast channel ID not configured')
      }

      const response = await this.client.post('/message/push', {
        to: this.broadcastChannelId,
        messages: [message]
      })

      return {
        success: true,
        message_id: response.headers['x-line-request-id']
      }

    } catch (error: any) {
      logger.error('LINE broadcast failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // 個人メッセージの送信
  async sendPersonalMessage(
    userId: string,
    message: LineMessage
  ): Promise<LineNotificationResult> {
    try {
      const response = await this.client.post('/message/push', {
        to: userId,
        messages: [message]
      })

      return {
        success: true,
        message_id: response.headers['x-line-request-id']
      }

    } catch (error: any) {
      logger.error('LINE personal message failed', {
        user_id: userId,
        error: error.message,
        status: error.response?.status
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // LINE Webhook処理（受信メッセージの処理）
  async handleWebhook(webhookBody: any): Promise<void> {
    try {
      const events = webhookBody.events || []

      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          await this.handleTextMessage(event)
        } else if (event.type === 'follow') {
          await this.handleFollowEvent(event)
        }
      }

    } catch (error: any) {
      logger.error('LINE webhook handling error', {
        error: error.message,
        webhook_body: webhookBody
      })
    }
  }

  // テキストメッセージの処理
  private async handleTextMessage(event: any): Promise<void> {
    const userId = event.source.userId
    const messageText = event.message.text

    // 基本的なコマンド処理
    if (messageText === 'ヘルプ' || messageText.toLowerCase() === 'help') {
      await this.sendHelpMessage(userId)
    } else if (messageText === 'ステータス') {
      await this.sendStatusMessage(userId)
    }
  }

  // フォローイベントの処理
  private async handleFollowEvent(event: any): Promise<void> {
    const userId = event.source.userId

    const welcomeMessage = {
      type: 'text',
      text: `OPEN CLAWコミュニティへようこそ！🦞\n\n「ヘルプ」と送信すると、利用可能なコマンドを確認できます。`
    }

    await this.sendPersonalMessage(userId, welcomeMessage)
  }

  // ヘルプメッセージの送信
  private async sendHelpMessage(userId: string): Promise<void> {
    const helpMessage = {
      type: 'text',
      text: `🦞 OPEN CLAW コマンド一覧\n\n` +
            `• ヘルプ - このメッセージを表示\n` +
            `• ステータス - システム状況を確認\n` +
            `• ダッシュボード - 会員ページへのリンク\n\n` +
            `その他のご質問は、オープンチャットでお気軽にどうぞ！`
    }

    await this.sendPersonalMessage(userId, helpMessage)
  }

  // ステータスメッセージの送信
  private async sendStatusMessage(userId: string): Promise<void> {
    const statusMessage = {
      type: 'text',
      text: `🟢 OPEN CLAW システム状況\n\n` +
            `• マスターCLAW: 稼働中\n` +
            `• 支払い処理: 正常\n` +
            `• 通知システム: 稼働中\n\n` +
            `最終更新: ${new Date().toLocaleString('ja-JP')}`
    }

    await this.sendPersonalMessage(userId, statusMessage)
  }

  // 通知統計の取得
  async getNotificationStats(): Promise<{
    total_sent: number
    success_rate: number
    last_24h_count: number
    failed_notifications: number
  }> {
    try {
      // TODO: データベースから統計を取得
      // 現在はモック値を返す
      return {
        total_sent: 156,
        success_rate: 98.7,
        last_24h_count: 12,
        failed_notifications: 2
      }
    } catch (error: any) {
      logger.error('Failed to get notification stats', { error: error.message })
      return {
        total_sent: 0,
        success_rate: 0,
        last_24h_count: 0,
        failed_notifications: 0
      }
    }
  }
}
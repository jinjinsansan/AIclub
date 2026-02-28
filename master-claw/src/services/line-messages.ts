// LINE通知メッセージ（仕様書v2.0準拠）
import type { Member, RewardSummary, SeminarSchedule } from '@/types'

export class LineMessages {
  // 新メンバー参加通知（仕様書準拠）
  static newMemberJoined(member: Member, totalMembers: number): any {
    return {
      type: 'text',
      text: `【OPEN CLAW】新メンバー参加！\n${member.display_name}さんがコミュニティに参加しました。\n現在のメンバー数: ${totalMembers}名`
    }
  }

  // 月次報酬通知（仕様書準拠）
  static monthlyRewardPaid(amount: number, txHash: string): any {
    return {
      type: 'text', 
      text: `【OPEN CLAW 月次報酬】\n今月の紹介報酬を送金しました。\n受取額: $${amount}\nTxID: ${txHash.slice(0, 10)}...\nお疲れさまです！`
    }
  }

  // トレードシグナル配信（仕様書準拠）
  static tradeSignal(pair: string, direction: string, price: number): any {
    return {
      type: 'text',
      text: `【OPEN CLAW トレードシグナル】\n${pair} ${direction}\nエントリー価格: ${price}\n配信時刻: ${new Date().toLocaleString('ja-JP')}`
    }
  }

  // 重要アップデート（仕様書準拠）
  static importantUpdate(title: string, message: string): any {
    return {
      type: 'text',
      text: `【OPEN CLAW 重要アップデート】\n${title}\n\n${message}\n\nマスター管理CLAW`
    }
  }

  // Zoomセミナーリマインダー（仕様書準拠）
  static seminarReminder(seminar: SeminarSchedule, hoursRemaining: number): any {
    const timeText = hoursRemaining >= 24 
      ? `${Math.floor(hoursRemaining / 24)}日前`
      : `${hoursRemaining}時間前`
      
    return {
      type: 'text',
      text: `【OPEN CLAW セミナー${timeText}】\n${seminar.title}\n開始時刻: ${new Date(seminar.scheduled_at).toLocaleString('ja-JP')}\nZoom URL: ${seminar.zoom_url}`
    }
  }

  // 会費リマインダー（個別通知）
  static paymentReminder(member: Member, daysRemaining: number): any {
    return {
      type: 'text',
      text: `【OPEN CLAW】会費リマインダー\n${member.display_name}さん\n\n月額会費のお支払い期限まで${daysRemaining}日です。\nお忘れなくお手続きください。`
    }
  }

  // システム障害通知（管理者向け）
  static systemAlert(alertType: string, message: string): any {
    return {
      type: 'text',
      text: `【OPEN CLAW システム障害】\n${alertType}\n\n${message}\n\n確認をお願いします。`
    }
  }
}
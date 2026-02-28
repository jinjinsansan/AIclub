/**
 * メッセージフィルタリング・レート制限モジュール
 *
 * 不適切コンテンツの除去、チャンネル権限チェック、
 * レート制限の適用を行う。
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class MessageFilter {
  private rateLimitMap: Map<string, RateLimitEntry> = new Map()
  private readonly messagesPerMinute: number
  private readonly forbiddenWords: string[]

  constructor(messagesPerMinute: number = 10) {
    this.messagesPerMinute = messagesPerMinute
    this.forbiddenWords = ['spam', 'scam', '詐欺', 'フィッシング']
  }

  /**
   * 不適切コンテンツのフィルタリング
   */
  filterContent(content: string): string {
    let filtered = content

    this.forbiddenWords.forEach((word) => {
      const regex = new RegExp(word, 'gi')
      filtered = filtered.replace(regex, '***')
    })

    // メッセージ長制限（2000文字）
    if (filtered.length > 2000) {
      filtered = filtered.substring(0, 2000) + '...'
    }

    return filtered
  }

  /**
   * チャンネルへの送信権限チェック
   */
  canSendToChannel(memberPermissions: string[], channel: string): boolean {
    return memberPermissions.includes(`channels:${channel}`)
  }

  /**
   * レート制限チェック
   * 1分間にmessagesPerMinuteメッセージまで
   */
  checkRateLimit(memberId: string): boolean {
    const now = Date.now()
    const entry = this.rateLimitMap.get(memberId)

    if (!entry || now >= entry.resetAt) {
      this.rateLimitMap.set(memberId, {
        count: 1,
        resetAt: now + 60000,
      })
      return true
    }

    if (entry.count >= this.messagesPerMinute) {
      return false
    }

    entry.count++
    return true
  }

  /**
   * メッセージのバリデーション
   */
  validateMessage(content: string): { valid: boolean; reason?: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, reason: 'Empty message' }
    }

    if (content.length > 5000) {
      return { valid: false, reason: 'Message too long' }
    }

    return { valid: true }
  }

  /**
   * 古いレート制限エントリのクリーンアップ
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now >= entry.resetAt) {
        this.rateLimitMap.delete(key)
      }
    }
  }
}

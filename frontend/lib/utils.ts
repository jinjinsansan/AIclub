import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// 日付フォーマット
export function formatDate(dateString: string, locale: string = 'ja-JP'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string, locale: string = 'ja-JP'): string {
  return new Date(dateString).toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 通貨フォーマット
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// 数値フォーマット（カンマ区切り）
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

// ウォレットアドレスの短縮表示
export function shortenWalletAddress(address: string, startLength: number = 6, endLength: number = 4): string {
  if (address.length <= startLength + endLength) {
    return address
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

// メンバーシップステータスの表示
export function getMembershipStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending_payment': '支払い待ち',
    'active': 'アクティブ',
    'suspended': '一時停止',
    'expired': '期限切れ',
  }
  return statusMap[status] || status
}

export function getMembershipStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'pending_payment': 'warning',
    'active': 'success',
    'suspended': 'error',
    'expired': 'error',
  }
  return colorMap[status] || 'gray'
}

// CLAWステータスの表示
export function getClawStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'online': 'オンライン',
    'offline': 'オフライン',
    'error': 'エラー',
  }
  return statusMap[status] || status
}

export function getClawStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    'online': 'success',
    'offline': 'gray',
    'error': 'error',
  }
  return colorMap[status] || 'gray'
}

// 支払い期限までの日数計算
export function getDaysUntilPayment(feesPaidUntil: string): number {
  const today = new Date()
  const paymentDate = new Date(feesPaidUntil)
  const diffTime = paymentDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// 支払い期限のステータス
export function getPaymentStatus(feesPaidUntil: string): 'safe' | 'warning' | 'critical' | 'expired' {
  const daysLeft = getDaysUntilPayment(feesPaidUntil)
  
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 7) return 'warning'
  return 'safe'
}

// エラーメッセージの取得
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return '不明なエラーが発生しました'
}

// 紹介コードの生成（フロントエンド表示用）
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 紹介URLの生成
export function generateReferralUrl(code: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://openclaw.com')
  return `${base}/register?ref=${code}`
}

// 相対時間の表示（○分前、○時間前など）
export function getRelativeTime(dateString: string, locale: string = 'ja'): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffSeconds < 60) {
    return 'たった今'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`
  } else if (diffHours < 24) {
    return `${diffHours}時間前`
  } else if (diffDays < 30) {
    return `${diffDays}日前`
  } else {
    return formatDate(dateString, locale)
  }
}

// バリデーション
export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code)
}

// ローカルストレージ操作
export function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to set localStorage:', error)
    }
  }
}

export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.warn('Failed to get localStorage:', error)
      return defaultValue
    }
  }
  return defaultValue
}

export function removeLocalStorage(key: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to remove localStorage:', error)
    }
  }
}

// クリップボードにコピー
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // フォールバック
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}
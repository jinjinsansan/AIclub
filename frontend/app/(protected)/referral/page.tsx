'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  ClipboardDocumentIcon,
  GiftIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShareIcon,
  LinkIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline'

interface ReferralStats {
  directReferrals: number
  indirectLevel2: number
  indirectLevel3: number
  totalRewardsEarned: number
  pendingRewards: number
  monthlyRewards: {
    month: string
    amount: number
    status: 'pending' | 'paid' | 'processing'
  }[]
}

interface ReferralHistory {
  id: string
  referredMember: string
  level: number
  amount: number
  status: string
  paymentMonth: string
  paidAt?: string
  createdAt: string
}

export default function ReferralsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [stats, setStats] = useState<ReferralStats>({
    directReferrals: 0,
    indirectLevel2: 0,
    indirectLevel3: 0,
    totalRewardsEarned: 0,
    pendingRewards: 0,
    monthlyRewards: []
  })
  const [history, setHistory] = useState<ReferralHistory[]>([])
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    const loadReferralData = async () => {
      try {
        // API経由でデータを取得
        const [codeData, statsData, historyData] = await Promise.all([
          import('@/lib/api').then(api => api.getReferralCode()),
          import('@/lib/api').then(api => api.getReferralStats()),
          import('@/lib/api').then(api => api.getRewardHistory())
        ])

        setReferralCode(codeData)
        setStats({
          ...statsData,
          monthlyRewards: [
            { month: '2026-02', amount: 250, status: 'pending' },
            { month: '2026-01', amount: 400, status: 'paid' },
            { month: '2025-12', amount: 200, status: 'paid' }
          ]
        })

        const normalizedHistory = (historyData || []).map((item: any) => ({
          ...item,
          createdAt: item.createdAt ?? item.paidAt ?? new Date().toISOString()
        }))

        setHistory(normalizedHistory)
      } catch (error) {
        console.error('Failed to load referral data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user?.member) {
      loadReferralData()
    } else {
      setLoading(false)
    }
  }, [user])

  const copyReferralCode = async () => {
    if (referralCode) {
      await navigator.clipboard.writeText(referralCode)
      // TODO: トーストメッセージ表示
    }
  }

  const copyReferralLink = async () => {
    if (referralCode) {
      const referralLink = `${window.location.origin}/register?ref=${referralCode}`
      await navigator.clipboard.writeText(referralLink)
      // TODO: トーストメッセージ表示
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="h-5 w-5 text-success-600" />
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-warning-600" />
      case 'processing':
        return <ArrowTrendingUpIcon className="h-5 w-5 text-secondary-600" />
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '支払い完了'
      case 'pending':
        return '支払い待ち'
      case 'processing':
        return '処理中'
      default:
        return '不明'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">紹介制度</h1>
        <p className="text-gray-600">
          OPEN CLAWの3段階紹介制度で報酬を獲得しましょう。
        </p>
      </div>

      {/* 紹介コード */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">あなたの紹介コード</h3>
          <button
            onClick={() => setShowQR(!showQR)}
            className="btn-secondary text-sm flex items-center"
          >
            <QrCodeIcon className="h-4 w-4 mr-1" />
            QRコード
          </button>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-600 mb-1">紹介コード</p>
              <p className="text-2xl font-mono font-bold text-primary-800">
                {referralCode || '取得中...'}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={copyReferralCode}
                className="btn-secondary text-sm flex items-center"
              >
                <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                コピー
              </button>
              <button
                onClick={copyReferralLink}
                className="btn-primary text-sm flex items-center"
              >
                <LinkIcon className="h-4 w-4 mr-1" />
                リンクコピー
              </button>
            </div>
          </div>
        </div>

        {showQR && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="bg-gray-100 h-32 flex items-center justify-center rounded mb-2">
              <p className="text-gray-500 text-sm">QRコード生成中...</p>
            </div>
            <p className="text-xs text-gray-500">
              紹介リンクのQRコードです。スマートフォンで読み取ってもらいましょう。
            </p>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p className="mb-1">
            💡 <strong>使い方</strong>：新規メンバーが登録時にこのコードを入力すると、あなたに紹介報酬が付与されます。
          </p>
          <p>
            🎁 <strong>報酬構造</strong>：直接紹介 $200、2段階目 $50、3段階目 $50
          </p>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">直接紹介</p>
              <p className="text-2xl font-bold text-gray-900">{stats.directReferrals}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowTrendingUpIcon className="h-8 w-8 text-secondary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">2段階目</p>
              <p className="text-2xl font-bold text-gray-900">{stats.indirectLevel2}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShareIcon className="h-8 w-8 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">3段階目</p>
              <p className="text-2xl font-bold text-gray-900">{stats.indirectLevel3}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-8 w-8 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">累計獲得</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalRewardsEarned}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 月次報酬 */}
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">月次報酬</h3>
        
        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <GiftIcon className="h-6 w-6 text-warning-600 mr-3" />
            <div>
              <p className="font-semibold text-secondary-800">今月の未払い報酬</p>
              <p className="text-2xl font-bold text-secondary-900">${stats.pendingRewards}</p>
            </div>
          </div>
          <p className="text-sm text-warning-600 mt-2">
            報酬は毎月1日にMINARAウォレットに自動送金されます。
          </p>
        </div>

        <div className="overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  月
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金額
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.monthlyRewards.map((reward, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {reward.month}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${reward.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(reward.status)}
                      <span className="ml-2 text-sm text-gray-900">
                        {getStatusText(reward.status)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 詳細履歴 */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">紹介履歴</h3>
        
        {history.length > 0 ? (
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    紹介先メンバー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    レベル
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    報酬金額
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    支払い月
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.referredMember}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.level === 1 ? 'bg-primary-100 text-primary-800' :
                        item.level === 2 ? 'bg-secondary-100 text-secondary-800' :
                        'bg-success-100 text-success-800'
                      }`}>
                        {item.level}段階目
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${item.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.paymentMonth}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(item.status)}
                        <span className="ml-2 text-sm text-gray-900">
                          {getStatusText(item.status)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">まだ紹介履歴がありません</h3>
            <p className="text-gray-500 mb-4">
              あなたの紹介コードを使って新しいメンバーを招待しましょう！
            </p>
            <button
              onClick={copyReferralLink}
              className="btn-primary inline-flex items-center"
            >
              <ShareIcon className="h-5 w-5 mr-2" />
              紹介リンクをシェア
            </button>
          </div>
        )}
      </div>

      {/* 紹介制度の説明 */}
      <div className="mt-8 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 rounded-lg p-6">
        <h4 className="font-semibold text-primary-900 mb-4">OPEN CLAW 3段階紹介制度</h4>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-primary-600">1</span>
            </div>
            <h5 className="font-semibold text-primary-900 mb-2">直接紹介</h5>
            <p className="text-sm text-primary-800 mb-1">報酬: <strong>$200</strong></p>
            <p className="text-sm text-primary-600">あなたが直接紹介した人が会員登録</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-secondary-600">2</span>
            </div>
            <h5 className="font-semibold text-secondary-900 mb-2">2段階目</h5>
            <p className="text-sm text-secondary-800 mb-1">報酬: <strong>$50</strong></p>
            <p className="text-sm text-secondary-600">あなたが紹介した人がさらに人を紹介</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-success-600">3</span>
            </div>
            <h5 className="font-semibold text-success-900 mb-2">3段階目</h5>
            <p className="text-sm text-success-800 mb-1">報酬: <strong>$50</strong></p>
            <p className="text-sm text-success-600">2段階目の人がさらに人を紹介</p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-primary-200">
          <h5 className="font-semibold text-primary-900 mb-2">支払いについて</h5>
          <ul className="text-sm text-primary-800 space-y-1">
            <li>• 報酬は毎月1日にMINARAウォレットに自動送金されます</li>
            <li>• 紹介された方の初回支払い($700)が完了した時点で報酬が確定します</li>
            <li>• 報酬はUSDTで支払われます</li>
            <li>• 送金手数料は運営が負担いたします</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
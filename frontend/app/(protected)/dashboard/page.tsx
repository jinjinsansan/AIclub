'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  BoltIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ChartBarSquareIcon,
  MegaphoneIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline'
import { formatCurrency, getDaysUntilPayment, getRelativeTime } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    member: {
      id: user?.member?.member_id || '',
      displayName: user?.member?.display_name || '',
      membershipStatus: user?.member?.membership_status || 'pending_payment' as const,
      clawStatus: user?.member?.claw_status || 'offline' as const,
      feePaidUntil: user?.member?.fee_paid_until || '',
      lastSeen: user?.member?.last_seen || '',
      pendingRewards: user?.member?.monthly_reward_pending || 0,
      totalRewardsEarned: 0
    },
    stats: {
      totalSignalsToday: 0,
      successfulTrades: 0,
      totalMembers: 0,
      myReferrals: 0
    },
    recentMessages: [] as any[],
    upcomingSeminar: null as any
  })
  const [loading, setLoading] = useState(true)
  const [masterInstructions, setMasterInstructions] = useState<any[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [statsData, messagesData, seminarsData, referralStats] = await Promise.all([
          import('@/lib/api').then(api => api.getDashboardStats()),
          import('@/lib/api').then(api => api.getRecentMessages()),
          import('@/lib/api').then(api => api.getUpcomingSeminars()),
          import('@/lib/api').then(api => api.getReferralStats())
        ])

        setDashboardData(prev => ({
          ...prev,
          stats: statsData,
          recentMessages: messagesData,
          upcomingSeminar: seminarsData[0] ? {
            title: seminarsData[0].title,
            scheduledAt: seminarsData[0].scheduledAt,
            zoomUrl: seminarsData[0].zoomUrl
          } : null,
          member: {
            ...prev.member,
            totalRewardsEarned: referralStats.totalRewardsEarned,
            pendingRewards: referralStats.pendingRewards
          }
        }))
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user?.member) {
      loadDashboardData()
      // Master CLAWからの指示を取得
      import('@/lib/api').then(api => api.getRecentMessages(10)).then(msgs => {
        setMasterInstructions(msgs.filter((m: any) => m.type === 'broadcast' || m.type === 'update' || m.type === 'trade_signal'))
      })
    } else {
      setLoading(false)
    }
  }, [user])

  const buildClawInstruction = (instruction: any) => {
    return `Master CLAWから以下の指示が届いています。内容を確認して実行してください。

【指示内容】
${instruction.content}

【実行手順】
1. 上記の指示を読んで理解してください
2. 必要に応じてGitHubリポジトリを再確認してください: https://github.com/jinjinsansan/AIclub/tree/main/member-claw
3. 指示に従って行動してください
4. 完了したら主人（私）に報告してください`
  }

  const copyInstruction = async (instruction: any) => {
    const text = buildClawInstruction(instruction)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedId(instruction.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const downloadConfigTemplate = async () => {
    try {
      if (!user?.member) return

      const configTemplate = {
        role: "member",
        member_id: user.member.member_id,
        gateway: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          channel: "claw_gateway"
        },
        minara: {
          api_endpoint: "https://api.minara.ai/v1",
          api_key: "REPLACE_WITH_YOUR_MINARA_API_KEY",
          wallet_address: "REPLACE_WITH_YOUR_WALLET_ADDRESS"
        },
        trade: {
          auto_execute: true,
          max_position_size: "10%",
          stop_loss_pct: 2.0,
          daily_trade_limit: 5,
          allowed_pairs: ["BTC/USD", "ETH/USD"]
        },
        heartbeat_interval_sec: 60
      }

      const blob = new Blob([JSON.stringify(configTemplate, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `config-${user.member.member_id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download config template:', error)
    }
  }

  const daysUntilPayment = getDaysUntilPayment(dashboardData.member.feePaidUntil)

  const getPaymentAlert = () => {
    if (daysUntilPayment < 0) {
      return { type: 'error', message: '支払い期限を過ぎています' }
    } else if (daysUntilPayment <= 3) {
      return { type: 'error', message: `支払い期限まで${daysUntilPayment}日です` }
    } else if (daysUntilPayment <= 7) {
      return { type: 'warning', message: `支払い期限まで${daysUntilPayment}日です` }
    }
    return null
  }

  const paymentAlert = getPaymentAlert()

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {paymentAlert && (
        <div className={`mb-6 rounded-md p-4 ${
          paymentAlert.type === 'error' ? 'bg-error-50 border border-error-200' : 'bg-warning-50 border border-warning-200'
        }`}>
          <div className="flex">
            <ExclamationTriangleIcon className={`h-5 w-5 ${
              paymentAlert.type === 'error' ? 'text-error-400' : 'text-warning-400'
            }`} />
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                paymentAlert.type === 'error' ? 'text-error-800' : 'text-warning-800'
              }`}>{paymentAlert.message}</p>
              <p className={`mt-1 text-sm ${
                paymentAlert.type === 'error' ? 'text-error-700' : 'text-warning-700'
              }`}>継続利用には月額会費の支払いが必要です。</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          おかえりなさい、{dashboardData.member.displayName}さん
        </h1>
        <p className="text-gray-600">
          CLAWステータス: <span className="text-success-600 font-semibold">オンライン</span>
          <span className="mx-2">&bull;</span>
          最終更新: {getRelativeTime(dashboardData.member.lastSeen)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center">
            <BoltIcon className="h-6 w-6" />
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium truncate text-primary-100">今日のシグナル</dt>
                <dd className="text-lg font-semibold">{dashboardData.stats.totalSignalsToday}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
          <div className="flex items-center">
            <ChartBarSquareIcon className="h-6 w-6" />
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium truncate text-success-100">成功トレード</dt>
                <dd className="text-lg font-semibold">{dashboardData.stats.successfulTrades}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-secondary-500 to-secondary-600 text-white">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-6 w-6" />
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium truncate text-secondary-100">未払い報酬</dt>
                <dd className="text-lg font-semibold">{formatCurrency(dashboardData.member.pendingRewards)}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-warning-500 to-warning-600 text-white">
          <div className="flex items-center">
            <UserGroupIcon className="h-6 w-6" />
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium truncate text-warning-100">私の紹介</dt>
                <dd className="text-lg font-semibold">{dashboardData.stats.myReferrals}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Master CLAWからの指示 */}
          {masterInstructions.length > 0 && (
            <div className="card border-2 border-secondary-300 bg-gradient-to-r from-secondary-50 to-primary-50">
              <div className="flex items-center mb-4">
                <MegaphoneIcon className="h-6 w-6 text-secondary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Master CLAWからの指示</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                以下の指示をコピーして、あなたのCLAWに貼り付けてください。CLAWが自動で実行します。
              </p>
              <div className="space-y-3">
                {masterInstructions.map((instruction) => (
                  <div key={instruction.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 mr-3">
                        <p className="text-sm font-medium text-gray-900">{instruction.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(instruction.timestamp).toLocaleString('ja-JP')}
                        </p>
                      </div>
                      <button
                        onClick={() => copyInstruction(instruction)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${
                          copiedId === instruction.id
                            ? 'bg-success-500 text-white'
                            : 'bg-secondary-600 text-white hover:bg-secondary-700'
                        }`}
                      >
                        {copiedId === instruction.id ? (
                          <>
                            <ClipboardDocumentCheckIcon className="h-4 w-4 mr-1" />
                            コピー済
                          </>
                        ) : (
                          <>
                            <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                            CLAWに渡す
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">最新の通知</h3>
              <Link href="/notifications" className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                すべて見る
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {dashboardData.recentMessages.map((message: any) => (
                <div key={message.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 pt-0.5">
                    {message.status === 'completed' && <CheckCircleIcon className="h-5 w-5 text-success-500" />}
                    {message.status === 'info' && <ClockIcon className="h-5 w-5 text-primary-500" />}
                    {message.status === 'success' && <CurrencyDollarIcon className="h-5 w-5 text-success-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{message.content}</p>
                    <p className="text-xs text-gray-500 mt-1">{getRelativeTime(message.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Link href="/claw-connect" className="btn-secondary text-center flex flex-col items-center py-4">
                <WifiIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">CLAW接続確認</span>
              </Link>
              <Link href="/minara" className="btn-secondary text-center flex flex-col items-center py-4">
                <ChartBarSquareIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">MINARA設定</span>
              </Link>
              <Link href="/referral" className="btn-secondary text-center flex flex-col items-center py-4">
                <UserGroupIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">紹介コード</span>
              </Link>
              <Link href="/manual" className="btn-secondary text-center flex flex-col items-center py-4">
                <CheckCircleIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">マニュアル</span>
              </Link>
              <Link href="/seminar" className="btn-secondary text-center flex flex-col items-center py-4">
                <ClockIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">セミナー</span>
              </Link>
              <button onClick={downloadConfigTemplate} className="btn-secondary text-center flex flex-col items-center py-4">
                <CurrencyDollarIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">config.json</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">アカウント情報</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">メンバーID</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono">{dashboardData.member.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">ステータス</dt>
                <dd><span className="status-badge-active">アクティブ</span></dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">次回支払い期限</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {dashboardData.member.feePaidUntil ? new Date(dashboardData.member.feePaidUntil).toLocaleDateString('ja-JP') : '-'}
                  <span className="ml-2 text-xs text-gray-500">
                    ({daysUntilPayment > 0 ? `${daysUntilPayment}日後` : '期限切れ'})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">累計報酬</dt>
                <dd className="text-sm font-medium text-success-600">{formatCurrency(dashboardData.member.totalRewardsEarned)}</dd>
              </div>
            </dl>
          </div>

          {dashboardData.upcomingSeminar && (
            <div className="card bg-gradient-to-br from-primary-50 to-secondary-50 border-primary-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">次回セミナー</h3>
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">{dashboardData.upcomingSeminar.title}</h4>
                <p className="text-sm text-gray-600">
                  {new Date(dashboardData.upcomingSeminar.scheduledAt).toLocaleString('ja-JP', {
                    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                <div className="flex space-x-2">
                  <Link href="/seminar" className="btn-primary text-sm px-3 py-1">詳細</Link>
                  <a href={dashboardData.upcomingSeminar.zoomUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm px-3 py-1">Zoom</a>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">コミュニティ</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">総メンバー数</span>
                <span className="text-sm font-medium text-gray-900">{dashboardData.stats.totalMembers}名</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

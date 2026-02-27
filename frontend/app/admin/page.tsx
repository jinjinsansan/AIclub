'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  BellIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ServerIcon,
  DocumentTextIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline'

interface AdminStats {
  members: {
    total: number
    active: number
    pending_payment: number
    suspended: number
  }
  payments: {
    total_received: number
    this_month: number
    pending_webhooks: number
    failed_transactions: number
  }
  referrals: {
    total_rewards_paid: number
    pending_rewards: number
    active_referral_chains: number
  }
  system: {
    uptime_percentage: number
    last_webhook: string
    active_claws: number
    errors_24h: number
  }
}

interface RecentActivity {
  id: string
  type: 'member_registered' | 'payment_received' | 'reward_paid' | 'system_error'
  title: string
  description: string
  timestamp: string
  status: 'success' | 'warning' | 'error' | 'info'
  amount?: number
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats>({
    members: {
      total: 0,
      active: 0,
      pending_payment: 0,
      suspended: 0
    },
    payments: {
      total_received: 0,
      this_month: 0,
      pending_webhooks: 0,
      failed_transactions: 0
    },
    referrals: {
      total_rewards_paid: 0,
      pending_rewards: 0,
      active_referral_chains: 0
    },
    system: {
      uptime_percentage: 0,
      last_webhook: '',
      active_claws: 0,
      errors_24h: 0
    }
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])

  // 管理者権限チェック
  useEffect(() => {
    if (!user) return

    if (user.member?.plan !== 'master') {
      router.push('/dashboard')
      return
    }

    loadAdminData()
  }, [user, router])

  const loadAdminData = async () => {
    try {
      // TODO: 実際のAPI呼び出し
      // 現在はモックデータを使用
      
      setStats({
        members: {
          total: 47,
          active: 42,
          pending_payment: 3,
          suspended: 2
        },
        payments: {
          total_received: 32900, // $329,00 (47 members * $700)
          this_month: 2800, // 4 new members this month
          pending_webhooks: 1,
          failed_transactions: 0
        },
        referrals: {
          total_rewards_paid: 4350, // Various referral rewards
          pending_rewards: 800,
          active_referral_chains: 15
        },
        system: {
          uptime_percentage: 99.97,
          last_webhook: '2026-02-28T01:45:23Z',
          active_claws: 38,
          errors_24h: 2
        }
      })

      setRecentActivity([
        {
          id: '1',
          type: 'member_registered',
          title: '新規メンバー登録',
          description: '田中 太郎さんが登録しました（紹介者: SATO01）',
          timestamp: '2026-02-28T01:45:00Z',
          status: 'success'
        },
        {
          id: '2',
          type: 'payment_received',
          title: '初期費用受領',
          description: 'CLAW0234からの$700支払いを確認',
          timestamp: '2026-02-28T01:30:00Z',
          status: 'success',
          amount: 700
        },
        {
          id: '3',
          type: 'reward_paid',
          title: '紹介報酬支払い',
          description: '2月分紹介報酬を15名に送金完了',
          timestamp: '2026-02-28T00:05:00Z',
          status: 'success',
          amount: 3250
        },
        {
          id: '4',
          type: 'system_error',
          title: 'MINARA API一時エラー',
          description: 'ヘルスチェックで一時的な接続エラー（復旧済み）',
          timestamp: '2026-02-27T23:15:00Z',
          status: 'warning'
        }
      ])

      setLoading(false)
    } catch (error) {
      console.error('Failed to load admin data:', error)
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string, status: string) => {
    if (status === 'error') return <XCircleIcon className="h-5 w-5 text-red-500" />
    if (status === 'warning') return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
    
    switch (type) {
      case 'member_registered':
        return <UserGroupIcon className="h-5 w-5 text-blue-500" />
      case 'payment_received':
        return <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
      case 'reward_paid':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'system_error':
        return <ServerIcon className="h-5 w-5 text-red-500" />
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (user?.member?.plan !== 'master') {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">アクセス権限がありません</h3>
        <p className="text-gray-500">この画面は管理者のみアクセス可能です。</p>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">運営管理画面</h1>
        <p className="text-gray-600">
          OPEN CLAWプラットフォームの運営状況を管理・監視します。
        </p>
      </div>

      {/* システム状態アラート */}
      <div className="mb-8">
        <div className={`border-l-4 p-4 ${
          stats.system.uptime_percentage >= 99.5 
            ? 'bg-green-50 border-green-400' 
            : 'bg-yellow-50 border-yellow-400'
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {stats.system.uptime_percentage >= 99.5 ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                stats.system.uptime_percentage >= 99.5 ? 'text-green-800' : 'text-yellow-800'
              }`}>
                システム稼働率: {stats.system.uptime_percentage}%
              </p>
              <p className={`text-sm ${
                stats.system.uptime_percentage >= 99.5 ? 'text-green-700' : 'text-yellow-700'
              }`}>
                最終Webhook受信: {new Date(stats.system.last_webhook).toLocaleString('ja-JP')}
              </p>
            </div>
          </div>
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
              <p className="text-sm text-gray-600">総メンバー数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.members.total}</p>
              <p className="text-xs text-gray-500">アクティブ: {stats.members.active}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">総売上</p>
              <p className="text-2xl font-bold text-gray-900">${stats.payments.total_received.toLocaleString()}</p>
              <p className="text-xs text-gray-500">今月: ${stats.payments.this_month.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">紹介報酬総額</p>
              <p className="text-2xl font-bold text-gray-900">${stats.referrals.total_rewards_paid.toLocaleString()}</p>
              <p className="text-xs text-gray-500">未払い: ${stats.referrals.pending_rewards}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ServerIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">アクティブCLAW</p>
              <p className="text-2xl font-bold text-gray-900">{stats.system.active_claws}</p>
              <p className="text-xs text-gray-500">24h エラー: {stats.system.errors_24h}</p>
            </div>
          </div>
        </div>
      </div>

      {/* メイン管理セクション */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 最近のアクティビティ */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">最近のアクティビティ</h3>
            
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getActivityIcon(activity.type, activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString('ja-JP')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">
                      {activity.description}
                    </p>
                    {activity.amount && (
                      <p className="text-sm font-medium text-green-600">
                        ${activity.amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">管理機能</h3>
            
            <div className="space-y-3">
              <button className="w-full btn-primary text-sm flex items-center justify-center">
                <UserGroupIcon className="h-4 w-4 mr-2" />
                メンバー管理
              </button>
              
              <Link href="/admin/rewards-preview">
                <button className="w-full btn-primary text-sm flex items-center justify-center">
                  <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                  月次報酬処理
                </button>
              </Link>
              
              <button className="w-full btn-secondary text-sm flex items-center justify-center">
                <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                支払い履歴
              </button>
              
              <button className="w-full btn-secondary text-sm flex items-center justify-center">
                <PresentationChartLineIcon className="h-4 w-4 mr-2" />
                セミナー管理
              </button>
              
              <button className="w-full btn-secondary text-sm flex items-center justify-center">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                マニュアル管理
              </button>
              
              <button className="w-full btn-secondary text-sm flex items-center justify-center">
                <BellIcon className="h-4 w-4 mr-2" />
                通知設定
              </button>
              
              <button className="w-full btn-secondary text-sm flex items-center justify-center">
                <Cog6ToothIcon className="h-4 w-4 mr-2" />
                システム設定
              </button>
            </div>
          </div>

          {/* システム監視 */}
          <div className="card mt-6">
            <h4 className="font-semibold text-gray-900 mb-3">システム監視</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">データベース</span>
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">MINARA API</span>
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">LINE Bot</span>
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Webhook受信</span>
                <ClockIcon className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'

interface RewardPreview {
  member_id: string
  display_name: string
  minara_wallet: string
  total_amount: number
  referral_count: number
  breakdown: {
    level1: number
    level2: number  
    level3: number
  }
}

export default function RewardsPreviewPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [currentMonth, setCurrentMonth] = useState('')
  const [previewData, setPreviewData] = useState<RewardPreview[]>([])
  const [totalAmount, setTotalAmount] = useState(0)

  // 管理者権限チェック
  useEffect(() => {
    if (!user) return

    if (user.member?.plan !== 'master') {
      router.push('/dashboard')
      return
    }

    loadPreviewData()
  }, [user, router])

  const loadPreviewData = async () => {
    try {
      const now = new Date()
      const monthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setCurrentMonth(monthString)

      // TODO: 実際のAPI呼び出し
      // const response = await fetch('/api/admin/rewards/preview', {
      //   headers: {
      //     'Authorization': `Bearer ${adminToken}`
      //   }
      // })
      // const data = await response.json()

      // モックデータ（仕様書準拠）
      const mockPreview: RewardPreview[] = [
        {
          member_id: 'CLAW0001',
          display_name: '田中太郎',
          minara_wallet: '0x1234567890abcdef1234567890abcdef12345678',
          total_amount: 450,
          referral_count: 3,
          breakdown: {
            level1: 400, // 2人 × $200
            level2: 50,  // 1人 × $50
            level3: 0
          }
        },
        {
          member_id: 'CLAW0002', 
          display_name: '佐藤花子',
          minara_wallet: '0xabcdef1234567890abcdef1234567890abcdef12',
          total_amount: 250,
          referral_count: 2,
          breakdown: {
            level1: 200, // 1人 × $200
            level2: 50,  // 1人 × $50
            level3: 0
          }
        },
        {
          member_id: 'CLAW0003',
          display_name: '高橋次郎',
          minara_wallet: '0x567890abcdef1234567890abcdef1234567890ab',
          total_amount: 300,
          referral_count: 4,
          breakdown: {
            level1: 200, // 1人 × $200
            level2: 50,  // 1人 × $50
            level3: 50   // 1人 × $50
          }
        }
      ]

      setPreviewData(mockPreview)
      setTotalAmount(mockPreview.reduce((sum, item) => sum + item.total_amount, 0))
      setLoading(false)

    } catch (error) {
      console.error('Failed to load preview data:', error)
      setLoading(false)
    }
  }

  const executeRewardsPayment = async () => {
    if (!confirm(`${currentMonth}月分の紹介報酬 $${totalAmount} を ${previewData.length}名に送金しますか？\n\nこの操作は取り消せません。`)) {
      return
    }

    setProcessing(true)
    
    try {
      // TODO: 実際のAPI呼び出し
      // const response = await fetch('/api/admin/rewards/execute', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${adminToken}`
      //   },
      //   body: JSON.stringify({
      //     month: currentMonth,
      //     previewed_data: previewData
      //   })
      // })

      // モック処理
      await new Promise(resolve => setTimeout(resolve, 3000))

      alert('月次報酬の送金処理が完了しました！')
      router.push('/admin')

    } catch (error) {
      console.error('Failed to execute rewards payment:', error)
      alert('送金処理でエラーが発生しました。再度お試しください。')
    } finally {
      setProcessing(false)
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
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-error-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">アクセス権限がありません</h3>
        <p className="text-gray-500">この画面は管理者のみアクセス可能です。</p>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={() => router.push('/admin')}
            className="btn-secondary text-sm flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            管理画面に戻る
          </button>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">月次報酬プレビュー</h1>
        <p className="text-gray-600">
          {currentMonth}月分の紹介報酬を確認し、一括送金を実行します。
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-r from-success-500 to-success-600 text-white">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CurrencyDollarIcon className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-success-100">総送金額</p>
              <p className="text-2xl font-bold">${totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">対象メンバー</p>
              <p className="text-2xl font-bold text-gray-900">{previewData.length}名</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-secondary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">処理月</p>
              <p className="text-lg font-bold text-gray-900">{currentMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 詳細リスト */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">送金対象一覧</h3>
          <button
            onClick={executeRewardsPayment}
            disabled={processing}
            className={`btn-primary flex items-center ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                送金処理中...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                一括送金実行
              </>
            )}
          </button>
        </div>

        <div className="overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メンバー
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ウォレットアドレス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  紹介数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  報酬内訳
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  総額
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previewData.map((item) => (
                <tr key={item.member_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.display_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.member_id}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {item.minara_wallet.slice(0, 10)}...{item.minara_wallet.slice(-8)}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.referral_count}名
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-1">
                      {item.breakdown.level1 > 0 && (
                        <div>1段: ${item.breakdown.level1}</div>
                      )}
                      {item.breakdown.level2 > 0 && (
                        <div>2段: ${item.breakdown.level2}</div>
                      )}
                      {item.breakdown.level3 > 0 && (
                        <div>3段: ${item.breakdown.level3}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${item.total_amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="bg-warning-50 border border-warning-200 rounded-lg p-6">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-warning-600 mr-3 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-warning-900 mb-2">送金実行前の確認事項</h4>
            <ul className="text-sm text-warning-800 space-y-1">
              <li>• 送金処理は取り消しできません。内容を十分に確認してください。</li>
              <li>• 各メンバーのMINARAウォレットアドレスが正確であることを確認してください。</li>
              <li>• マスターウォレットの残高が送金総額を上回っていることを確認してください。</li>
              <li>• 送金完了後、各メンバーに自動でLINE通知が送信されます。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'

export default function PaymentPage() {
  const { user, signOut } = useAuth()
  const [memberInfo, setMemberInfo] = useState({
    displayName: user?.member?.display_name || '',
    email: user?.member?.email || '',
    minaraWallet: user?.member?.minara_wallet || '',
    membershipStatus: user?.member?.membership_status || 'pending_payment',
    createdAt: user?.member?.created_at || new Date().toISOString()
  })

  const getStatusInfo = () => {
    switch (memberInfo.membershipStatus) {
      case 'pending_payment':
        return {
          icon: ClockIcon,
          title: '初期費用の支払いをお待ちしています',
          description: '仮登録が完了しました。サロンへのアクセスには初期費用 $700 の支払いが必要です。',
          color: 'warning',
          bgColor: 'bg-warning-50 border-warning-200',
          iconColor: 'text-warning-600'
        }
      case 'suspended':
        return {
          icon: ExclamationTriangleIcon,
          title: 'アカウントが一時停止中です',
          description: '月額会費の支払いが確認できていないため、アカウントが一時停止されています。',
          color: 'error',
          bgColor: 'bg-error-50 border-error-200',
          iconColor: 'text-error-600'
        }
      case 'expired':
        return {
          icon: ExclamationTriangleIcon,
          title: 'アカウントの有効期限が切れています',
          description: '長期間の未払いによりアカウントが無効化されています。再有効化には運営までお問い合わせください。',
          color: 'error',
          bgColor: 'bg-error-50 border-error-200',
          iconColor: 'text-error-600'
        }
      default:
        return {
          icon: CheckCircleIcon,
          title: 'アカウントは正常です',
          description: '',
          color: 'success',
          bgColor: 'bg-success-50 border-success-200',
          iconColor: 'text-success-600'
        }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-primary-600 hover:text-primary-700">
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            ホームに戻る
          </Link>
        </div>

        <div className="card">
          <div className={`rounded-lg p-6 mb-8 border ${statusInfo.bgColor}`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <StatusIcon className={`h-8 w-8 ${statusInfo.iconColor}`} />
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {statusInfo.title}
                </h2>
                <p className="text-gray-700">
                  {statusInfo.description}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">アカウント情報</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">表示名</dt>
                <dd className="text-sm text-gray-900">{memberInfo.displayName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
                <dd className="text-sm text-gray-900">{memberInfo.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">MINARAウォレット</dt>
                <dd className="text-sm text-gray-900 font-mono break-all">
                  {memberInfo.minaraWallet}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">登録日時</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(memberInfo.createdAt).toLocaleString('ja-JP')}
                </dd>
              </div>
            </dl>
          </div>

          {memberInfo.membershipStatus === 'pending_payment' && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
              <div className="flex items-start">
                <CurrencyDollarIcon className="h-6 w-6 text-primary-600 mt-1" />
                <div className="ml-4">
                  <h4 className="font-semibold text-primary-900 mb-3">支払い情報</h4>
                  <div className="space-y-2 text-sm text-primary-800">
                    <div className="flex justify-between">
                      <span>初期費用:</span>
                      <span className="font-mono">$700 USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>送金先:</span>
                      <span className="font-mono text-xs">0x...master_wallet</span>
                    </div>
                    <div className="flex justify-between">
                      <span>送金元:</span>
                      <span className="font-mono text-xs">{memberInfo.minaraWallet.slice(0, 10)}...</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-primary-100 rounded-md">
                    <p className="text-xs text-primary-700">
                      <strong>重要:</strong> 登録時に設定したMINARAウォレットアドレスから送金してください。
                      送金メモ（Memo）にメールアドレスを記載することをお勧めします。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">よくある質問</h3>
            <div className="space-y-4">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <span className="font-medium">支払いはいつ確認されますか？</span>
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3 text-sm text-gray-600">
                  MINARAネットワークでの送金確認後、通常5-10分以内に自動的に処理されます。
                  確認メールが送信され、ダッシュボードへのアクセスが可能になります。
                </div>
              </details>
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <span className="font-medium">支払いが反映されない場合は？</span>
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3 text-sm text-gray-600">
                  1. 送金元ウォレットアドレスが登録時と一致しているか確認<br />
                  2. 送金額が$700 USDT以上であるか確認<br />
                  3. 24時間経っても反映されない場合は、LINEオープンチャットまたはサポートにお問い合わせください。
                </div>
              </details>
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <span className="font-medium">月額会費について教えてください</span>
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3 text-sm text-gray-600">
                  月額会費は初期費用の支払い完了後にご案内いたします。
                  継続してコミュニティサービスをご利用いただくための費用です。
                </div>
              </details>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary flex-1"
            >
              支払い状況を再確認
            </button>
            <button
              onClick={signOut}
              className="btn-secondary flex-1"
            >
              ログアウト
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            お困りの場合は、
            <a href="#" className="text-primary-600 hover:text-primary-700 underline">
              LINEオープンチャット
            </a>
            または
            <a href="mailto:support@openclaw.com" className="text-primary-600 hover:text-primary-700 underline">
              サポート
            </a>
            までお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  )
}

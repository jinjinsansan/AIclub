'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

export default function MinaraPage() {
  const { user } = useAuth()
  const [walletConnected] = useState(!!user?.member?.minara_wallet)

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">MINARA連携状況</h1>
        <p className="text-gray-600">
          MINARA AIとの接続状態、ウォレット情報、トレード履歴を確認できます。
        </p>
      </div>

      {/* 接続ステータス */}
      <div className={`card mb-8 border-2 ${walletConnected ? 'border-success-200' : 'border-warning-200'}`}>
        <div className="flex items-center space-x-4">
          <div className={`p-4 rounded-full ${walletConnected ? 'bg-success-100' : 'bg-warning-100'}`}>
            {walletConnected ? (
              <CheckCircleIcon className="h-10 w-10 text-success-600" />
            ) : (
              <XCircleIcon className="h-10 w-10 text-warning-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">MINARA ウォレット</h3>
            <p className={`font-medium ${walletConnected ? 'text-success-600' : 'text-warning-600'}`}>
              {walletConnected ? '接続済み' : '未接続'}
            </p>
            {user?.member?.minara_wallet && (
              <p className="text-sm font-mono text-gray-500 mt-1">
                {user.member.minara_wallet}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* ウォレット情報 */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CurrencyDollarIcon className="h-5 w-5 mr-2 text-primary-600" />
            ウォレット情報
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">ウォレットアドレス</dt>
              <dd className="text-sm font-mono text-gray-900 break-all">
                {user?.member?.minara_wallet || '未設定'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">API接続先</dt>
              <dd className="text-sm font-mono text-gray-900">https://api.minara.ai/v1</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">対応通貨</dt>
              <dd className="text-sm text-gray-900">USDT</dd>
            </div>
          </dl>
        </div>

        {/* トレード設定 */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Cog6ToothIcon className="h-5 w-5 mr-2 text-primary-600" />
            トレード設定
          </h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">自動実行</dt>
              <dd className="text-sm font-medium text-success-600">有効</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">最大ポジションサイズ</dt>
              <dd className="text-sm font-medium text-gray-900">10%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">ストップロス</dt>
              <dd className="text-sm font-medium text-gray-900">2.0%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">1日の最大取引数</dt>
              <dd className="text-sm font-medium text-gray-900">5回</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">許可ペア</dt>
              <dd className="text-sm font-medium text-gray-900">BTC/USD, ETH/USD</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* 最新トレード履歴 */}
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2 text-primary-600" />
          最新トレード履歴
        </h3>
        <div className="text-center py-8">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">トレード履歴はシグナル受信後に表示されます。</p>
        </div>
      </div>

      {/* HyperLiquid連携 */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
        <h4 className="font-semibold text-primary-900 mb-3">MINARA AI x HyperLiquid</h4>
        <div className="text-sm text-primary-800 space-y-2">
          <p>&#x2022; MINARA AIを通じてHyperLiquidでの自動トレードが実行されます</p>
          <p>&#x2022; マスターCLAWからのシグナルは自然言語で送信され、MINARAが自動解釈します</p>
          <p>&#x2022; config.jsonのtrade設定でリスク管理パラメータを調整できます</p>
          <p>&#x2022; トレード結果は自動的にゲートウェイへフィードバックされます</p>
        </div>
      </div>
    </div>
  )
}

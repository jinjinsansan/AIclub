'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { updateClawStatus, sendHeartbeat } from '@/lib/api'
import {
  WifiIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ServerIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export default function ClawConnectPage() {
  const { user } = useAuth()
  const [clawStatus, setClawStatus] = useState(user?.member?.claw_status || 'offline')
  const [lastSeen, setLastSeen] = useState(user?.member?.last_seen || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'online':
        return {
          icon: CheckCircleIcon,
          label: 'オンライン',
          color: 'text-success-600',
          bgColor: 'bg-success-100',
          borderColor: 'border-success-200'
        }
      case 'error':
        return {
          icon: ExclamationTriangleIcon,
          label: 'エラー',
          color: 'text-error-600',
          bgColor: 'bg-error-100',
          borderColor: 'border-error-200'
        }
      default:
        return {
          icon: XCircleIcon,
          label: 'オフライン',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-200'
        }
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const success = await sendHeartbeat({
        version: '1.0.0',
        uptime: 0,
        memoryUsage: 0,
        errorCount: 0
      })

      if (success) {
        setClawStatus('online')
        setLastSeen(new Date().toISOString())
        setTestResult({ success: true, message: 'ゲートウェイとの接続に成功しました。CLAWはオンラインです。' })
      } else {
        setTestResult({ success: false, message: '接続テストに失敗しました。設定を確認してください。' })
      }
    } catch (error) {
      setTestResult({ success: false, message: 'ゲートウェイへの接続中にエラーが発生しました。' })
    } finally {
      setTesting(false)
    }
  }

  const statusInfo = getStatusInfo(clawStatus)
  const StatusIcon = statusInfo.icon

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">CLAW接続管理</h1>
        <p className="text-gray-600">
          あなたのCLAWの接続状態を確認し、ゲートウェイとの通信をテストできます。
        </p>
      </div>

      {/* 接続ステータスカード */}
      <div className={`card mb-8 border-2 ${statusInfo.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-4 rounded-full ${statusInfo.bgColor}`}>
              <StatusIcon className={`h-10 w-10 ${statusInfo.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">CLAW ステータス</h3>
              <p className={`text-xl font-bold ${statusInfo.color}`}>{statusInfo.label}</p>
              {lastSeen && (
                <p className="text-sm text-gray-500 mt-1">
                  最終確認: {new Date(lastSeen).toLocaleString('ja-JP')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-primary flex items-center disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'テスト中...' : '接続テスト'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-success-50 border border-success-200' : 'bg-error-50 border border-error-200'}`}>
            <div className="flex items-center">
              {testResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-error-500 mr-2" />
              )}
              <p className={`text-sm ${testResult.success ? 'text-success-700' : 'text-error-700'}`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 接続情報 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ServerIcon className="h-5 w-5 mr-2 text-primary-600" />
            ゲートウェイ接続情報
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">チャンネル</dt>
              <dd className="text-sm font-mono text-gray-900">claw_gateway</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">プロトコル</dt>
              <dd className="text-sm text-gray-900">Supabase Realtime (WebSocket)</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">ハートビート間隔</dt>
              <dd className="text-sm text-gray-900">60秒</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <SignalIcon className="h-5 w-5 mr-2 text-primary-600" />
            メンバー情報
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">メンバーID</dt>
              <dd className="text-sm font-mono text-gray-900">{user?.member?.member_id || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">ロール</dt>
              <dd className="text-sm text-gray-900">member</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">メッセージ受信</dt>
              <dd className="text-sm text-gray-900">broadcast + private</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* セットアップガイド */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
        <h4 className="font-semibold text-primary-900 mb-3">CLAW接続セットアップ</h4>
        <div className="text-sm text-primary-800 space-y-2">
          <p>1. ダッシュボードから <code className="bg-primary-100 px-1 rounded">config.json</code> をダウンロード</p>
          <p>2. CLAWインストールディレクトリに配置</p>
          <p>3. <code className="bg-primary-100 px-1 rounded">member_id</code> にあなたのメンバーIDを設定</p>
          <p>4. MINARA APIキーとウォレットアドレスを入力</p>
          <p>5. CLAWを起動してゲートウェイ接続を確認</p>
          <p>6. このページで「接続テスト」をクリックして確認</p>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { StudioIframe } from '@/components/claw/StudioIframe'
import { CLAWConnectionStatus } from '@/components/claw/ConnectionStatus'
import { CLAWChatPanel } from '@/components/claw/ChatPanel'

export default function CLAWStudioPage() {
  const { user } = useAuth()
  const [gatewayToken, setGatewayToken] = useState<string | null>(null)
  const [gatewayUrl, setGatewayUrl] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState('offline')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gateway Token取得
  useEffect(() => {
    async function fetchGatewayToken() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/gateway/token', {
          headers: {
            Authorization: `Bearer ${(user as any)?.access_token || ''}`,
          },
        })

        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || 'トークン取得に失敗しました')
        }

        const data = await response.json()
        setGatewayToken(data.token)
        setGatewayUrl(data.gateway_url)
        setConnectionStatus('offline')
      } catch (err: any) {
        setError(err.message)
        console.error('Gateway token fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    if (user?.member?.membership_status === 'active') {
      fetchGatewayToken()
    } else {
      setLoading(false)
    }
  }, [user])

  const handleRefreshStatus = async () => {
    setConnectionStatus('connecting')
    // 接続確認のリクエスト
    try {
      const response = await fetch('/api/gateway/token', {
        headers: {
          Authorization: `Bearer ${(user as any)?.access_token || ''}`,
        },
      })
      if (response.ok) {
        setConnectionStatus('offline')
      }
    } catch {
      setConnectionStatus('error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600">CLAW Studio 読み込み中...</span>
      </div>
    )
  }

  if (user?.member?.membership_status !== 'active') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">アクセス制限</h2>
        <p className="text-gray-600">CLAW Studioはアクティブメンバーのみ利用可能です。</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">CLAW Studio</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            再読み込み
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Studio管理パネル */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">あなたのCLAW管理</h3>

            <CLAWConnectionStatus
              memberId={user?.member?.member_id}
              status={connectionStatus}
              onRefresh={handleRefreshStatus}
            />

            {gatewayToken && gatewayUrl ? (
              <StudioIframe
                gatewayUrl={gatewayUrl}
                authToken={gatewayToken}
                memberId={user?.member?.member_id || ''}
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500 mb-4">
                  Gateway接続トークンを取得できませんでした。
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  再取得
                </button>
              </div>
            )}

            {/* Gateway情報 */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Gateway接続情報</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Gateway URL:</span>
                  <span className="ml-2 font-mono text-xs text-gray-700">
                    {gatewayUrl || '未取得'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">メンバーID:</span>
                  <span className="ml-2 font-mono text-xs text-gray-700">
                    {user?.member?.member_id || '未取得'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">トークン:</span>
                  <span className="ml-2 font-mono text-xs text-gray-700">
                    {gatewayToken ? `${gatewayToken.substring(0, 8)}...` : '未取得'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">ステータス:</span>
                  <span className="ml-2 text-gray-700">{connectionStatus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* チャットパネル */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">CLAWチャット</h3>

            {gatewayToken && gatewayUrl ? (
              <CLAWChatPanel
                gatewayUrl={gatewayUrl}
                authToken={gatewayToken}
                channels={['general', 'trading']}
              />
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 text-sm">
                Gateway接続が必要です
              </div>
            )}
          </div>

          {/* CLAW設定カード */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h4 className="font-semibold mb-3">CLAW設定</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">バージョン:</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">自動実行:</span>
                <span className="font-medium text-green-600">有効</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">参加チャンネル:</span>
                <span className="font-medium">general, trading</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

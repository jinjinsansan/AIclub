'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import type { CLAWStatus } from '@/types/database'

export default function CLAWMonitorPage() {
  const { user } = useAuth()
  const [clawStatuses, setCLAWStatuses] = useState<CLAWStatus[]>([])
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [kickLoading, setKickLoading] = useState(false)

  // 管理者権限チェック
  if (user?.member?.plan !== 'master') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">アクセス制限</h2>
        <p className="text-gray-600">管理者のみアクセス可能です。</p>
      </div>
    )
  }

  const fetchCLAWStatuses = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/gateway/connections', {
        headers: {
          Authorization: `Bearer ${(user as any)?.access_token || ''}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCLAWStatuses(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch CLAW statuses:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // リアルタイムCLAW状況取得（5秒間隔）
  useEffect(() => {
    fetchCLAWStatuses()
    const interval = setInterval(fetchCLAWStatuses, 5000)
    return () => clearInterval(interval)
  }, [fetchCLAWStatuses])

  const handleKick = async (memberId: string) => {
    if (!confirm(`メンバー ${memberId} を強制切断しますか?`)) return

    setKickLoading(true)
    try {
      const response = await fetch('/api/admin/gateway/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(user as any)?.access_token || ''}`,
        },
        body: JSON.stringify({ member_id: memberId, action: 'kick' }),
      })

      if (response.ok) {
        await fetchCLAWStatuses()
        setSelectedMember(null)
      }
    } catch (err) {
      console.error('Failed to kick member:', err)
    } finally {
      setKickLoading(false)
    }
  }

  const onlineCount = clawStatuses.filter((c) => c.status === 'online').length
  const errorCount = clawStatuses.filter((c) => c.status === 'error').length
  const selectedClaw = clawStatuses.find((c) => c.member_id === selectedMember)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">CLAW監視センター</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">総CLAW数</div>
          <div className="text-2xl font-bold text-gray-900">{clawStatuses.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">オンライン</div>
          <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">オフライン</div>
          <div className="text-2xl font-bold text-gray-600">
            {clawStatuses.length - onlineCount - errorCount}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">エラー</div>
          <div className="text-2xl font-bold text-red-600">{errorCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CLAW接続状況一覧 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                接続中CLAW一覧 ({onlineCount}台)
              </h3>
              <button
                onClick={fetchCLAWStatuses}
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                更新
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            ) : clawStatuses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                接続されたCLAWはありません
              </div>
            ) : (
              <div className="space-y-3">
                {clawStatuses.map((claw) => (
                  <div
                    key={claw.member_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedMember === claw.member_id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedMember(claw.member_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{claw.display_name}</div>
                        <div className="text-sm text-gray-500">{claw.member_id}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            claw.status === 'online'
                              ? 'bg-green-100 text-green-800'
                              : claw.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {claw.status}
                        </div>
                        {claw.last_ping && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(claw.last_ping).toLocaleTimeString('ja-JP')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                      <div>バージョン: {claw.version}</div>
                      {claw.ip_address && <div>IP: {claw.ip_address}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 選択したCLAWの詳細 */}
        <div>
          {selectedClaw ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="font-semibold mb-4">CLAW詳細情報</h4>

              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">メンバー名:</span>
                  <span className="font-medium">{selectedClaw.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">メンバーID:</span>
                  <span className="font-mono text-xs">{selectedClaw.member_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ステータス:</span>
                  <span
                    className={`font-medium ${
                      selectedClaw.status === 'online'
                        ? 'text-green-600'
                        : selectedClaw.status === 'error'
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {selectedClaw.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">バージョン:</span>
                  <span className="font-medium">{selectedClaw.version}</span>
                </div>
                {selectedClaw.ip_address && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">IPアドレス:</span>
                    <span className="font-mono text-xs">{selectedClaw.ip_address}</span>
                  </div>
                )}
                {selectedClaw.connected_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">接続開始:</span>
                    <span>
                      {new Date(selectedClaw.connected_at).toLocaleString('ja-JP')}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm py-2 px-4 rounded-lg transition-colors">
                  設定確認
                </button>
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm py-2 px-4 rounded-lg transition-colors">
                  ログ取得
                </button>
                {selectedClaw.status === 'online' && (
                  <button
                    onClick={() => handleKick(selectedClaw.member_id)}
                    disabled={kickLoading}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-700 text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {kickLoading ? '切断中...' : '強制切断'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">
              CLAWを選択すると詳細が表示されます
            </div>
          )}

          {/* チャット統計 */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h4 className="font-semibold mb-3">システム統計</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">接続CLAW数:</span>
                <span className="font-medium">{onlineCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">エラーCLAW数:</span>
                <span className="font-medium text-red-600">{errorCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">最終更新:</span>
                <span className="font-medium">
                  {new Date().toLocaleTimeString('ja-JP')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

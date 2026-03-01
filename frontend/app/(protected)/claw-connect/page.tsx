'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { sendHeartbeat } from '@/lib/api'
import {
  WifiIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ServerIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  LinkIcon
} from '@heroicons/react/24/outline'

const GITHUB_REPO_URL = 'https://github.com/jinjinsansan/AIclub/tree/main/member-claw'

export default function ClawConnectPage() {
  const { user } = useAuth()
  const [clawStatus, setClawStatus] = useState(user?.member?.claw_status || 'offline')
  const [lastSeen, setLastSeen] = useState(user?.member?.last_seen || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

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

  const copyToClipboard = async (text: string, type: 'url' | 'id') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'url') {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } else {
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      }
    } catch {
      // fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      if (type === 'url') {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } else {
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      }
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

      {/* GitHub URL セットアップ（メイン） */}
      <div className="card mb-8 border-2 border-secondary-300 bg-gradient-to-r from-secondary-50 to-primary-50">
        <div className="flex items-start space-x-3 mb-4">
          <LinkIcon className="h-6 w-6 text-secondary-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-gray-900">CLAWセットアップURL</h3>
            <p className="text-sm text-gray-600 mt-1">
              このURLをあなたのClaude（CLAW）に渡すだけでセットアップできます。
              運営がリポジトリを更新すると、次回セットアップ時に自動反映されます。
            </p>
          </div>
        </div>

        {/* GitHub URL コピー */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            GitHub リポジトリURL
          </label>
          <div className="flex items-center">
            <div className="flex-1 bg-white border border-gray-300 rounded-l-lg px-4 py-3 font-mono text-sm text-gray-800 truncate select-all">
              {GITHUB_REPO_URL}
            </div>
            <button
              onClick={() => copyToClipboard(GITHUB_REPO_URL, 'url')}
              className={`px-4 py-3 rounded-r-lg border border-l-0 transition-colors flex items-center ${
                copiedUrl
                  ? 'bg-success-100 border-success-300 text-success-700'
                  : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {copiedUrl ? (
                <>
                  <ClipboardDocumentCheckIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm">コピー済</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm">コピー</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* メンバーID コピー */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            あなたのメンバーID
          </label>
          <div className="flex items-center">
            <div className="flex-1 bg-white border border-gray-300 rounded-l-lg px-4 py-3 font-mono text-sm text-gray-800 truncate select-all">
              {user?.member?.member_id || '読み込み中...'}
            </div>
            <button
              onClick={() => copyToClipboard(user?.member?.member_id || '', 'id')}
              disabled={!user?.member?.member_id}
              className={`px-4 py-3 rounded-r-lg border border-l-0 transition-colors flex items-center disabled:opacity-50 ${
                copiedId
                  ? 'bg-success-100 border-success-300 text-success-700'
                  : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {copiedId ? (
                <>
                  <ClipboardDocumentCheckIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm">コピー済</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm">コピー</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* かんたんセットアップ手順 */}
      <div className="card mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">かんたん3ステップセットアップ</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 font-bold text-xl flex items-center justify-center mx-auto mb-3">
              1
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">URLをコピー</h4>
            <p className="text-sm text-gray-600">
              上のGitHubリポジトリURLをコピーします
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 font-bold text-xl flex items-center justify-center mx-auto mb-3">
              2
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Claudeに渡す</h4>
            <p className="text-sm text-gray-600">
              あなたのClaudeにURLを渡して
              「このリポジトリの手順に従ってCLAWをセットアップして」と伝えます
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 font-bold text-xl flex items-center justify-center mx-auto mb-3">
              3
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">メンバーIDを入力</h4>
            <p className="text-sm text-gray-600">
              Claudeに求められたらメンバーIDを伝えて、MINARA APIキーとウォレットアドレスを設定します
            </p>
          </div>
        </div>
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

      {/* 補足情報 */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
        <h4 className="font-semibold text-primary-900 mb-3">リポジトリのアップデートについて</h4>
        <div className="text-sm text-primary-800 space-y-2">
          <p>運営がGitHubリポジトリを更新すると、次回のセットアップ時に最新版が自動的に適用されます。</p>
          <p>既にセットアップ済みの場合は、Claudeに「CLAWを最新版にアップデートして」と伝えてください。</p>
          <p>Claudeが <code className="bg-primary-100 px-1 rounded">git pull</code> → <code className="bg-primary-100 px-1 rounded">npm install</code> → <code className="bg-primary-100 px-1 rounded">npm run build</code> を実行します。</p>
        </div>
      </div>
    </div>
  )
}

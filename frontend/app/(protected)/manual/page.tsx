'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { 
  BookOpenIcon, 
  PlayIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  LockClosedIcon,
  DownloadIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Manual {
  id: string
  manual_code: string
  title: string
  description: string
  content_type: 'video' | 'pdf' | 'markdown' | 'zip' | 'config'
  file_url?: string
  file_size_bytes?: number
  access_level: 'all' | 'active' | 'premium' | 'master'
  order_index: number
  is_published: boolean
  version: string
  created_at: string
  updated_at: string
}

export default function ManualPage() {
  const { user } = useAuth()
  const [manuals, setManuals] = useState<Manual[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // 仕様書に基づくマニュアル構成（モックデータ）
  useEffect(() => {
    // TODO: 実際のAPI呼び出し
    const mockManuals: Manual[] = [
      {
        id: '1',
        manual_code: 'MANUAL-001',
        title: 'OPEN CLAW インストールガイド（Windows）',
        description: 'Windows環境でのOPEN CLAWインストール手順を詳しく解説します。',
        content_type: 'video',
        file_url: '/manuals/MANUAL-001-windows.mp4',
        file_size_bytes: 45000000,
        access_level: 'active',
        order_index: 1,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-15T00:00:00Z'
      },
      {
        id: '2', 
        manual_code: 'MANUAL-002',
        title: 'OPEN CLAW インストールガイド（Mac）',
        description: 'macOS環境でのOPEN CLAWインストール手順を詳しく解説します。',
        content_type: 'video',
        file_url: '/manuals/MANUAL-002-mac.mp4',
        file_size_bytes: 42000000,
        access_level: 'active',
        order_index: 2,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-15T00:00:00Z'
      },
      {
        id: '3',
        manual_code: 'MANUAL-003',
        title: '基本設定テンプレートの適用方法',
        description: '初期設定に必要なconfig.jsonテンプレートの設定方法を説明します。',
        content_type: 'video',
        file_url: '/manuals/MANUAL-003-config.mp4',
        file_size_bytes: 25000000,
        access_level: 'active',
        order_index: 3,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-20T00:00:00Z'
      },
      {
        id: '4',
        manual_code: 'MANUAL-004',
        title: 'MINARA AIアカウント作成・接続設定',
        description: 'MINARA AIアカウントの作成からOPEN CLAWとの連携設定まで。',
        content_type: 'video',
        file_url: '/manuals/MANUAL-004-minara.mp4',
        file_size_bytes: 38000000,
        access_level: 'active',
        order_index: 4,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-25T00:00:00Z'
      },
      {
        id: '5',
        manual_code: 'MANUAL-005',
        title: '自然言語でのトレード設定方法',
        description: '直感的な自然言語を使ったトレード戦略の設定方法。',
        content_type: 'video',
        file_url: '/manuals/MANUAL-005-trading.mp4',
        file_size_bytes: 55000000,
        access_level: 'active',
        order_index: 5,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-10T00:00:00Z',
        updated_at: '2026-02-25T00:00:00Z'
      },
      {
        id: '6',
        manual_code: 'MANUAL-006',
        title: 'ゲートウェイへの接続登録手順',
        description: 'マスターCLAWとの通信に必要なゲートウェイ接続設定。',
        content_type: 'pdf',
        file_url: '/manuals/MANUAL-006-gateway.pdf',
        file_size_bytes: 8000000,
        access_level: 'active',
        order_index: 6,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-20T00:00:00Z'
      },
      {
        id: '7',
        manual_code: 'MANUAL-007',
        title: 'よくあるエラーと解決方法（FAQ）',
        description: 'トラブルシューティング・よくある質問と解決方法。',
        content_type: 'pdf',
        file_url: '/manuals/MANUAL-007-faq.pdf',
        file_size_bytes: 5000000,
        access_level: 'active',
        order_index: 7,
        is_published: true,
        version: '1.0',
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-28T00:00:00Z'
      },
      {
        id: '8',
        manual_code: 'MANUAL-008',
        title: '応用編：CLAWカスタマイズ方法',
        description: '上級者向け：OPEN CLAWの高度なカスタマイズとプラグイン開発。',
        content_type: 'video',
        file_url: '/manuals/MANUAL-008-advanced.mp4',
        file_size_bytes: 78000000,
        access_level: 'active',
        order_index: 8,
        is_published: false, // 未公開
        version: '1.0',
        created_at: '2026-02-15T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z'
      }
    ]

    setManuals(mockManuals)
    setLoading(false)
  }, [])

  const getContentIcon = (contentType: string) => {
    switch (contentType) {
      case 'video':
        return PlayIcon
      case 'pdf':
        return DocumentTextIcon
      case 'zip':
        return DownloadIcon
      default:
        return BookOpenIcon
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1000000) {
      return `${(bytes / 1000000).toFixed(1)}MB`
    }
    return `${(bytes / 1000).toFixed(0)}KB`
  }

  const canAccess = (manual: Manual) => {
    if (!user?.member) return false
    
    if (manual.access_level === 'all') return true
    if (manual.access_level === 'active' && user.member.membership_status === 'active') return true
    if (manual.access_level === 'master' && user.member.plan === 'master') return true
    
    return false
  }

  const filteredManuals = manuals
    .filter(manual => manual.is_published || user?.member?.plan === 'master')
    .filter(manual => {
      if (selectedCategory === 'all') return true
      if (selectedCategory === 'basic') return ['MANUAL-001', 'MANUAL-002', 'MANUAL-003', 'MANUAL-004'].includes(manual.manual_code)
      if (selectedCategory === 'advanced') return ['MANUAL-005', 'MANUAL-006', 'MANUAL-007', 'MANUAL-008'].includes(manual.manual_code)
      return true
    })
    .sort((a, b) => a.order_index - b.order_index)

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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">マニュアルライブラリ</h1>
        <p className="text-gray-600">
          OPEN CLAWの設定・使用方法を詳しく説明したマニュアル集です。
        </p>
      </div>

      {/* カテゴリフィルター */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              selectedCategory === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setSelectedCategory('basic')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              selectedCategory === 'basic'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            基本編（001-004）
          </button>
          <button
            onClick={() => setSelectedCategory('advanced')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              selectedCategory === 'advanced'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            応用編（005-008）
          </button>
        </div>
      </div>

      {/* マニュアル一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredManuals.map((manual) => {
          const ContentIcon = getContentIcon(manual.content_type)
          const hasAccess = canAccess(manual)

          return (
            <div
              key={manual.id}
              className={`card relative ${!hasAccess ? 'opacity-75' : ''}`}
            >
              {/* アクセス不可の場合のオーバーレイ */}
              {!hasAccess && (
                <div className="absolute inset-0 bg-gray-100 bg-opacity-75 rounded-lg flex items-center justify-center z-10">
                  <div className="text-center">
                    <LockClosedIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">アクセス権限がありません</p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-4">
                <div className={`flex-shrink-0 p-3 rounded-lg ${
                  manual.content_type === 'video' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  <ContentIcon className={`h-6 w-6 ${
                    manual.content_type === 'video' ? 'text-red-600' : 'text-blue-600'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary-100 text-primary-800">
                      {manual.manual_code}
                    </span>
                    {!manual.is_published && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-warning-100 text-warning-800">
                        未公開
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {manual.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {manual.description}
                  </p>

                  <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center">
                      <ContentIcon className="h-4 w-4 mr-1" />
                      {manual.content_type.toUpperCase()}
                    </span>
                    {manual.file_size_bytes && (
                      <span>{formatFileSize(manual.file_size_bytes)}</span>
                    )}
                    <span>v{manual.version}</span>
                    <span className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {new Date(manual.updated_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>

                  {hasAccess ? (
                    <div className="flex space-x-3">
                      <button className="btn-primary text-sm flex items-center">
                        <EyeIcon className="h-4 w-4 mr-1" />
                        {manual.content_type === 'video' ? '視聴' : '閲覧'}
                      </button>
                      {manual.file_url && (
                        <button className="btn-secondary text-sm flex items-center">
                          <DownloadIcon className="h-4 w-4 mr-1" />
                          ダウンロード
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      アクティブメンバーのみアクセス可能
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 空の状態 */}
      {filteredManuals.length === 0 && (
        <div className="text-center py-12">
          <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">マニュアルがありません</h3>
          <p className="text-gray-500">選択されたカテゴリにマニュアルが見つかりません。</p>
        </div>
      )}

      {/* ヘルプメッセージ */}
      <div className="mt-12 bg-primary-50 border border-primary-200 rounded-lg p-6">
        <h4 className="font-semibold text-primary-900 mb-2">マニュアルについて</h4>
        <div className="text-sm text-primary-800 space-y-2">
          <p>• <strong>基本編（001-004）</strong>：初回セットアップに必要な基本マニュアル</p>
          <p>• <strong>応用編（005-008）</strong>：高度な機能とカスタマイズ方法</p>
          <p>• マニュアルは随時更新されます。最新版を確認してください。</p>
          <p>• 質問や不明点は、LINEオープンチャットでお気軽にお尋ねください。</p>
        </div>
      </div>
    </div>
  )
}
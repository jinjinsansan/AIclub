'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { getRecentMessages, subscribeToMessages } from '@/lib/api'
import {
  BellIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  BoltIcon,
  MegaphoneIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Notification {
  id: string
  type: string
  content: string
  timestamp: string
  status: string
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await getRecentMessages(50)
        setNotifications(data)
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()

    const subscription = subscribeToMessages((payload: any) => {
      const newMsg = payload.new
      setNotifications(prev => [{
        id: newMsg.id,
        type: newMsg.message_type,
        content: newMsg.payload?.message || `${newMsg.message_type}メッセージ`,
        timestamp: newMsg.created_at,
        status: 'new'
      }, ...prev])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trade_signal':
        return <BoltIcon className="h-5 w-5 text-secondary-500" />
      case 'reward_notify':
        return <CurrencyDollarIcon className="h-5 w-5 text-success-500" />
      case 'broadcast':
        return <MegaphoneIcon className="h-5 w-5 text-primary-500" />
      case 'system_alert':
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning-500" />
      case 'update':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'trade_signal': return 'トレードシグナル'
      case 'reward_notify': return '報酬通知'
      case 'broadcast': return 'お知らせ'
      case 'system_alert': return 'システム'
      case 'update': return 'アップデート'
      case 'private': return 'メッセージ'
      default: return '通知'
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true
    return n.type === filter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">通知センター</h1>
        <p className="text-gray-600">
          マスターCLAWからの通知、トレードシグナル、報酬通知を確認できます。
        </p>
      </div>

      {/* フィルター */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'すべて' },
            { key: 'trade_signal', label: 'シグナル' },
            { key: 'reward_notify', label: '報酬' },
            { key: 'broadcast', label: 'お知らせ' },
            { key: 'system_alert', label: 'システム' },
            { key: 'private', label: 'メッセージ' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                filter === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 通知一覧 */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div key={notification.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 pt-0.5">
                  {getTypeIcon(notification.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {getTypeLabel(notification.type)}
                    </span>
                    {notification.status === 'new' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{notification.content}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    {new Date(notification.timestamp).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <BellIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">通知はありません</h3>
          <p className="text-gray-500">
            {filter === 'all'
              ? '新しい通知が届くとこちらに表示されます。'
              : `「${getTypeLabel(filter)}」の通知はまだありません。`}
          </p>
        </div>
      )}
    </div>
  )
}

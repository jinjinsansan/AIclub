'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import type { ChatMessage } from '@/types/database'

interface CLAWChatPanelProps {
  gatewayUrl: string
  authToken: string
  channels: string[]
}

export function CLAWChatPanel({ gatewayUrl, authToken, channels }: CLAWChatPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentChannel, setCurrentChannel] = useState(channels[0] || 'general')
  const [inputMessage, setInputMessage] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // WebSocket接続
  useEffect(() => {
    const wsUrl = gatewayUrl.replace('wss://', 'wss://').replace('ws://', 'ws://')
    const ws = new WebSocket(`${wsUrl}?token=${authToken}`)

    ws.onopen = () => {
      setConnectionStatus('connected')
      ws.send(JSON.stringify({
        type: 'join_channel',
        channel: currentChannel,
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'chat_message') {
          setMessages((prev) => [...prev, data.message])
        } else if (data.type === 'member_joined') {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              channel: data.channel,
              sender_member_id: 'system',
              sender_name: 'System',
              content: `${data.member_name} が参加しました`,
              sent_at: new Date().toISOString(),
              message_type: 'system',
            },
          ])
        } else if (data.type === 'member_left') {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              channel: data.channel,
              sender_member_id: 'system',
              sender_name: 'System',
              content: `${data.member_name} が退出しました`,
              sent_at: new Date().toISOString(),
              message_type: 'system',
            },
          ])
        } else if (data.type === 'chat_history') {
          setMessages(data.messages || [])
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
    }

    ws.onerror = () => {
      setConnectionStatus('disconnected')
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [gatewayUrl, authToken, currentChannel])

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || connectionStatus !== 'connected') return

    wsRef.current.send(
      JSON.stringify({
        type: 'send_message',
        channel: currentChannel,
        content: inputMessage,
        message_type: 'text',
      })
    )

    setInputMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const channelLabels: Record<string, string> = {
    general: '全体',
    trading: 'トレード',
    alerts: 'アラート',
  }

  return (
    <div className="claw-chat-panel h-96 flex flex-col">
      {/* チャンネル選択 */}
      <div className="flex items-center space-x-2 mb-3">
        {channels.map((channel) => (
          <button
            key={channel}
            onClick={() => {
              setCurrentChannel(channel)
              setMessages([])
            }}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              currentChannel === channel
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            #{channelLabels[channel] || channel}
          </button>
        ))}
        <div className="ml-auto">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-success-100 text-success-600'
                : connectionStatus === 'connecting'
                ? 'bg-warning-100 text-warning-600'
                : 'bg-error-100 text-error-600'
            }`}
          >
            {connectionStatus === 'connected'
              ? '接続中'
              : connectionStatus === 'connecting'
              ? '接続処理中...'
              : '切断'}
          </span>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto space-y-2 bg-gray-50 p-3 rounded">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            メッセージはまだありません
          </div>
        )}
        {messages
          .filter((msg) => msg.channel === currentChannel)
          .map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.message_type === 'system'
                  ? 'justify-center'
                  : message.sender_member_id === user?.member?.member_id
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                  message.message_type === 'system'
                    ? 'bg-gray-200 text-gray-600 text-center text-xs'
                    : message.sender_member_id === user?.member?.member_id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                }`}
              >
                {message.message_type !== 'system' && (
                  <div className="text-xs opacity-75 mb-1">{message.sender_name}</div>
                )}
                <div className="text-sm">{message.content}</div>
                <div className="text-xs opacity-50 mt-1 text-right">
                  {new Date(message.sent_at).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* メッセージ入力 */}
      <div className="flex mt-3">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          className="flex-1 px-3 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
          disabled={connectionStatus !== 'connected'}
        />
        <button
          onClick={sendMessage}
          disabled={!inputMessage.trim() || connectionStatus !== 'connected'}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-r-lg transition-colors"
        >
          送信
        </button>
      </div>
    </div>
  )
}

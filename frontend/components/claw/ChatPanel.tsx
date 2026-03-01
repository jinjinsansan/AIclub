'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

interface ChatMessage {
  id: string
  channel_name: string
  sender_member_id: string
  sender_name: string
  content: string
  sent_at: string
  message_type: 'text' | 'file' | 'image' | 'system'
}

interface CLAWChatPanelProps {
  channels: string[]
}

export function CLAWChatPanel({ channels }: CLAWChatPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentChannel, setCurrentChannel] = useState(channels[0] || 'general')
  const [inputMessage, setInputMessage] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // 過去メッセージの取得
  const fetchMessages = useCallback(async (channel: string) => {
    try {
      const { data, error } = await supabase
        .from('claw_chat_logs')
        .select('*')
        .eq('channel_name', channel)
        .order('sent_at', { ascending: true })
        .limit(100)

      if (error) {
        console.error('Failed to fetch messages:', error)
        return
      }

      const formatted: ChatMessage[] = (data || []).map((msg: any) => ({
        id: msg.id,
        channel_name: msg.channel_name,
        sender_member_id: msg.sender_member_id,
        sender_name: msg.metadata?.display_name || msg.sender_member_id.substring(0, 8),
        content: msg.content,
        sent_at: msg.sent_at,
        message_type: msg.message_type,
      }))

      setMessages(formatted)
    } catch (err) {
      console.error('Fetch messages error:', err)
    }
  }, [])

  // チャンネル切替時にメッセージ再取得
  useEffect(() => {
    fetchMessages(currentChannel)
  }, [currentChannel, fetchMessages])

  // Supabase Realtime 購読
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${currentChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'claw_chat_logs',
          filter: `channel_name=eq.${currentChannel}`,
        },
        (payload) => {
          const msg = payload.new as any
          const newMessage: ChatMessage = {
            id: msg.id,
            channel_name: msg.channel_name,
            sender_member_id: msg.sender_member_id,
            sender_name: msg.metadata?.display_name || msg.sender_member_id.substring(0, 8),
            content: msg.content,
            sent_at: msg.sent_at,
            message_type: msg.message_type,
          }
          setMessages((prev) => [...prev, newMessage])
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentChannel])

  // メッセージ送信
  const sendMessage = async () => {
    if (!inputMessage.trim() || !user?.member?.member_id || sending) return

    setSending(true)
    try {
      const { error } = await supabase.from('claw_chat_logs').insert({
        channel_name: currentChannel,
        sender_member_id: user.member.member_id,
        content: inputMessage.trim(),
        message_type: 'text',
        metadata: {
          display_name: user.member.display_name || user.email || 'Unknown',
        },
      })

      if (error) {
        console.error('Send message error:', error)
        return
      }

      setInputMessage('')
    } catch (err) {
      console.error('Send message error:', err)
    } finally {
      setSending(false)
    }
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
        {messages.map((message) => (
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
          disabled={!inputMessage.trim() || connectionStatus !== 'connected' || sending}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-r-lg transition-colors"
        >
          送信
        </button>
      </div>
    </div>
  )
}

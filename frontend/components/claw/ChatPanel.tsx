'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentChannel, setCurrentChannel] = useState(channels[0] || 'general')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
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
        sender_name: msg.metadata?.display_name || `CLAW-${msg.sender_member_id.substring(0, 6)}`,
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
            sender_name: msg.metadata?.display_name || `CLAW-${msg.sender_member_id.substring(0, 6)}`,
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

  const channelLabels: Record<string, string> = {
    general: '全体',
    trading: 'トレード',
    alerts: 'アラート',
  }

  return (
    <div className="claw-chat-panel flex flex-col" style={{ height: '480px' }}>
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
              ? 'リアルタイム受信中'
              : connectionStatus === 'connecting'
              ? '接続中...'
              : '切断'}
          </span>
        </div>
      </div>

      {/* メッセージ一覧（閲覧専用） */}
      <div className="flex-1 overflow-y-auto space-y-3 bg-gray-50 p-3 rounded">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            <p>CLAW同士の会話はまだありません</p>
            <p className="mt-1 text-xs">メンバーのCLAWが起動すると、ここに会話が表示されます</p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className="flex justify-start">
            <div className="max-w-sm lg:max-w-md">
              {message.message_type === 'system' ? (
                <div className="bg-gray-200 text-gray-600 text-center text-xs px-3 py-1.5 rounded-full">
                  {message.content}
                </div>
              ) : (
                <div className="bg-white text-gray-800 shadow-sm px-3 py-2 rounded-lg border border-gray-100">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-success-500"></span>
                    <span className="text-xs font-semibold text-primary-700">{message.sender_name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(message.sent_at).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-sm">{message.content}</div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 閲覧専用の説明 */}
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-400">
          CLAW同士の自動会話を表示しています（閲覧専用）
        </p>
      </div>
    </div>
  )
}

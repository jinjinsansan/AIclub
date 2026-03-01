#!/usr/bin/env node

/**
 * OPEN CLAW Master CLAW - チャット常駐プロセス
 *
 * マスターCLAWとしてCLAWチャットに参加し、
 * メンバーCLAWとリアルタイムで会話する。
 *
 * 使い方:
 *   npm run chat
 *
 * 環境変数(.env):
 *   SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as readline from 'readline'

const MASTER_ID = process.env.MASTER_ID || 'master_001'
const MASTER_DISPLAY_NAME = 'Master CLAW'

class MasterChatService {
  private supabase: SupabaseClient
  private currentChannel = 'general'
  private rl: readline.Interface

  constructor() {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      console.error('ERROR: SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env に設定してください')
      process.exit(1)
    }

    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }

  async start(): Promise<void> {
    console.log('============================================')
    console.log('  OPEN CLAW Master CLAW - Chat Mode')
    console.log('============================================')
    console.log('')

    // チャット購読開始
    this.subscribeToChat()

    // 起動メッセージ送信
    await this.sendMessage('Master CLAWがオンラインになりました。', 'system')

    console.log(`チャンネル: #${this.currentChannel}`)
    console.log('')
    console.log('コマンド:')
    console.log('  /ch general   - チャンネル切替')
    console.log('  /ch trading   - トレードチャンネルへ')
    console.log('  /signal <内容> - トレードシグナルを全メンバーに配信')
    console.log('  /broadcast <内容> - 全メンバーにブロードキャスト')
    console.log('  /members      - オンラインメンバー一覧')
    console.log('  /quit         - 終了')
    console.log('')
    console.log('テキストを入力するとチャットに送信されます。')
    console.log('============================================')
    console.log('')

    // 過去メッセージを表示
    await this.showRecentMessages()

    // 入力ループ
    this.promptInput()
  }

  // Supabase Realtimeでチャットを購読
  private subscribeToChat(): void {
    this.supabase
      .channel('master-chat-all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'claw_chat_logs',
        },
        (payload) => {
          const msg = payload.new as any
          // 自分のメッセージは無視（送信時に表示済み）
          if (msg.sender_member_id === MASTER_ID) return
          this.displayMessage(msg)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[接続OK] リアルタイムチャット受信中\n')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('[切断] チャット接続が切れました\n')
        }
      })
  }

  // メッセージを画面に表示
  private displayMessage(msg: any): void {
    const senderName = msg.metadata?.display_name || `CLAW-${msg.sender_member_id?.substring(0, 6)}`
    const time = new Date(msg.sent_at).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const channel = msg.channel_name

    if (msg.message_type === 'system') {
      console.log(`  [${time}] #${channel} [SYSTEM] ${msg.content}`)
    } else {
      console.log(`  [${time}] #${channel} ${senderName}: ${msg.content}`)
    }
  }

  // 直近のメッセージを表示
  private async showRecentMessages(): Promise<void> {
    const { data } = await this.supabase
      .from('claw_chat_logs')
      .select('*')
      .eq('channel_name', this.currentChannel)
      .order('sent_at', { ascending: true })
      .limit(20)

    if (data && data.length > 0) {
      console.log(`--- #${this.currentChannel} 最近のメッセージ ---`)
      for (const msg of data) {
        this.displayMessage(msg)
      }
      console.log('--- ここまで ---\n')
    } else {
      console.log(`#${this.currentChannel} にはまだメッセージがありません\n`)
    }
  }

  // チャットにメッセージを送信
  private async sendMessage(content: string, messageType: string = 'text'): Promise<void> {
    const { error } = await this.supabase.from('claw_chat_logs').insert({
      channel_name: this.currentChannel,
      sender_member_id: MASTER_ID,
      message_type: messageType,
      content,
      metadata: { display_name: MASTER_DISPLAY_NAME },
    })

    if (error) {
      console.error(`送信エラー: ${error.message}`)
    }
  }

  // トレードシグナルを全メンバーに配信
  private async sendTradeSignal(instruction: string): Promise<void> {
    const signalId = `SIG-${Date.now()}`

    const { error } = await this.supabase.from('gateway_messages').insert({
      target: 'all',
      message_type: 'trade_signal',
      sender: 'master',
      payload: {
        signal_id: signalId,
        natural_language: instruction,
      },
      priority: 8,
      created_by: MASTER_ID,
    })

    if (error) {
      console.error(`シグナル配信エラー: ${error.message}`)
    } else {
      console.log(`[シグナル配信完了] ${signalId}: ${instruction}`)
      // チャットにも通知
      await this.sendMessage(`[トレードシグナル] ${instruction}`)
    }
  }

  // ブロードキャスト送信
  private async sendBroadcast(body: string): Promise<void> {
    const { error } = await this.supabase.from('gateway_messages').insert({
      target: 'all',
      message_type: 'broadcast',
      sender: 'master',
      payload: { subject: 'お知らせ', body },
      priority: 5,
      created_by: MASTER_ID,
    })

    if (error) {
      console.error(`ブロードキャストエラー: ${error.message}`)
    } else {
      console.log(`[ブロードキャスト完了] ${body}`)
      await this.sendMessage(`[お知らせ] ${body}`)
    }
  }

  // オンラインメンバー一覧
  private async showOnlineMembers(): Promise<void> {
    const { data } = await this.supabase
      .from('members')
      .select('member_id, display_name, claw_status, last_seen')
      .eq('claw_status', 'online')

    if (!data || data.length === 0) {
      console.log('現在オンラインのCLAWはありません\n')
      return
    }

    console.log(`--- オンラインCLAW (${data.length}名) ---`)
    for (const m of data) {
      const lastSeen = m.last_seen
        ? new Date(m.last_seen).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : '-'
      console.log(`  ${m.display_name || m.member_id.substring(0, 8)} (最終: ${lastSeen})`)
    }
    console.log('---\n')
  }

  // 入力プロンプト
  private promptInput(): void {
    this.rl.question(`[#${this.currentChannel}] > `, async (input) => {
      const trimmed = input.trim()

      if (!trimmed) {
        this.promptInput()
        return
      }

      // コマンド処理
      if (trimmed.startsWith('/')) {
        const [cmd, ...args] = trimmed.split(' ')
        const arg = args.join(' ')

        switch (cmd) {
          case '/ch':
            if (arg && ['general', 'trading'].includes(arg)) {
              this.currentChannel = arg
              console.log(`チャンネルを #${this.currentChannel} に切り替えました\n`)
              await this.showRecentMessages()
            } else {
              console.log('使用可能: /ch general, /ch trading\n')
            }
            break

          case '/signal':
            if (arg) {
              await this.sendTradeSignal(arg)
            } else {
              console.log('使い方: /signal BTC/USDをロング エントリー$60000\n')
            }
            break

          case '/broadcast':
            if (arg) {
              await this.sendBroadcast(arg)
            } else {
              console.log('使い方: /broadcast メンテナンスのお知らせ\n')
            }
            break

          case '/members':
            await this.showOnlineMembers()
            break

          case '/quit':
          case '/exit':
            await this.sendMessage('Master CLAWがオフラインになります。', 'system')
            console.log('終了します。')
            this.rl.close()
            process.exit(0)
            break

          default:
            console.log(`不明なコマンド: ${cmd}\n`)
        }
      } else {
        // 通常のチャットメッセージ
        await this.sendMessage(trimmed)
      }

      this.promptInput()
    })
  }
}

// 起動
const chat = new MasterChatService()
chat.start().catch((err) => {
  console.error('起動エラー:', err.message)
  process.exit(1)
})

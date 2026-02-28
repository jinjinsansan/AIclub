import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage } from 'http'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { URL } from 'url'
import dotenv from 'dotenv'
import { GatewayAuth, AuthResult } from './auth/supabase-auth'
import { MessageFilter } from './chat/message-filter'

dotenv.config()

/**
 * OpenClaw Gateway Server
 *
 * CLAW間リアルタイム通信の中央ハブサーバー。
 * WebSocketを使用してメンバーCLAW同士のチャット、
 * ブロードキャスト、管理機能を提供する。
 */

interface ConnectedClient {
  ws: WebSocket
  memberId: string
  displayName: string
  permissions: string[]
  channels: Set<string>
  lastPing: number
}

interface ChatMessagePayload {
  id: string
  channel: string
  sender_member_id: string
  sender_name: string
  content: string
  sent_at: string
  message_type: 'text' | 'file' | 'system'
}

class GatewayServer {
  private wss: WebSocketServer | null = null
  private clients: Map<string, ConnectedClient> = new Map()
  private auth: GatewayAuth
  private filter: MessageFilter
  private supabase: SupabaseClient
  private pingInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.auth = new GatewayAuth()
    this.filter = new MessageFilter(
      parseInt(process.env.RATE_LIMIT_MESSAGES_PER_MINUTE || '10')
    )
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * サーバー起動
   */
  start(): void {
    const port = parseInt(process.env.GATEWAY_PORT || '18789')
    const host = process.env.GATEWAY_HOST || '0.0.0.0'

    const server = createServer((req, res) => {
      // ヘルスチェックエンドポイント
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          connections: this.clients.size,
          uptime: process.uptime(),
        }))
        return
      }

      // Gateway統計 (管理者用)
      if (req.url === '/gateway/admin/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          total_connections: this.clients.size,
          channels: this.getChannelStats(),
          uptime: process.uptime(),
        }))
        return
      }

      res.writeHead(404)
      res.end('Not Found')
    })

    this.wss = new WebSocketServer({ server })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req)
    })

    // 定期的なpingチェック（30秒間隔）
    this.pingInterval = setInterval(() => {
      this.checkPings()
    }, 30000)

    // レート制限のクリーンアップ（5分間隔）
    this.cleanupInterval = setInterval(() => {
      this.filter.cleanup()
    }, 300000)

    server.listen(port, host, () => {
      console.log(`[GATEWAY] OpenClaw Gateway Server started on ${host}:${port}`)
      console.log(`[GATEWAY] WebSocket endpoint: ws://${host}:${port}`)
      console.log(`[GATEWAY] Health check: http://${host}:${port}/health`)
    })

    // グレースフルシャットダウン
    process.on('SIGTERM', () => this.shutdown())
    process.on('SIGINT', () => this.shutdown())
  }

  /**
   * WebSocket接続ハンドラ
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication token required' }))
      ws.close(4001, 'No token provided')
      return
    }

    // 認証
    const authResult = await this.auth.authenticateConnection(token)

    if (!authResult.valid || !authResult.member_id) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }))
      ws.close(4003, 'Authentication failed')
      return
    }

    // 既存の接続がある場合は切断
    const existing = this.clients.get(authResult.member_id)
    if (existing) {
      existing.ws.send(JSON.stringify({
        type: 'error',
        message: 'New connection established from another location',
      }))
      existing.ws.close(4004, 'Replaced by new connection')
    }

    // クライアント登録
    const client: ConnectedClient = {
      ws,
      memberId: authResult.member_id,
      displayName: authResult.display_name || 'Unknown',
      permissions: authResult.permissions || [],
      channels: new Set(),
      lastPing: Date.now(),
    }

    this.clients.set(authResult.member_id, client)

    console.log(`[GATEWAY] Client connected: ${authResult.member_id} (${authResult.display_name})`)

    // 接続成功通知
    ws.send(JSON.stringify({
      type: 'connected',
      member_id: authResult.member_id,
      display_name: authResult.display_name,
      permissions: authResult.permissions,
      available_channels: this.getAvailableChannels(authResult.permissions || []),
    }))

    // メッセージハンドラ
    ws.on('message', (data: Buffer) => {
      this.handleMessage(client, data.toString())
    })

    // 切断ハンドラ
    ws.on('close', () => {
      this.handleDisconnect(client)
    })

    ws.on('error', (error) => {
      console.error(`[GATEWAY] WebSocket error for ${client.memberId}:`, error.message)
    })

    // pongハンドラ
    ws.on('pong', () => {
      client.lastPing = Date.now()
    })
  }

  /**
   * メッセージ受信ハンドラ
   */
  private async handleMessage(client: ConnectedClient, rawData: string): Promise<void> {
    try {
      const data = JSON.parse(rawData)

      switch (data.type) {
        case 'join_channel':
          this.handleJoinChannel(client, data.channel)
          break

        case 'leave_channel':
          this.handleLeaveChannel(client, data.channel)
          break

        case 'send_message':
          await this.handleSendMessage(client, data)
          break

        case 'ping':
          client.lastPing = Date.now()
          client.ws.send(JSON.stringify({ type: 'pong' }))
          this.auth.updatePing(client.memberId)
          break

        case 'get_members':
          this.handleGetMembers(client, data.channel)
          break

        default:
          client.ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`,
          }))
      }
    } catch (error) {
      console.error(`[GATEWAY] Message parse error from ${client.memberId}:`, error)
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
      }))
    }
  }

  /**
   * チャンネル参加
   */
  private handleJoinChannel(client: ConnectedClient, channel: string): void {
    if (!channel) return

    if (!this.filter.canSendToChannel(client.permissions, channel)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `No permission to join channel: ${channel}`,
      }))
      return
    }

    client.channels.add(channel)

    // チャンネル内の他メンバーに通知
    this.broadcastToChannel(channel, {
      type: 'member_joined',
      channel,
      member_id: client.memberId,
      member_name: client.displayName,
    }, client.memberId)

    client.ws.send(JSON.stringify({
      type: 'channel_joined',
      channel,
      members: this.getChannelMembers(channel),
    }))

    console.log(`[GATEWAY] ${client.memberId} joined channel: ${channel}`)
  }

  /**
   * チャンネル退出
   */
  private handleLeaveChannel(client: ConnectedClient, channel: string): void {
    if (!channel || !client.channels.has(channel)) return

    client.channels.delete(channel)

    this.broadcastToChannel(channel, {
      type: 'member_left',
      channel,
      member_id: client.memberId,
      member_name: client.displayName,
    }, client.memberId)

    console.log(`[GATEWAY] ${client.memberId} left channel: ${channel}`)
  }

  /**
   * メッセージ送信
   */
  private async handleSendMessage(
    client: ConnectedClient,
    data: { channel: string; content: string; message_type?: string }
  ): Promise<void> {
    const { channel, content, message_type = 'text' } = data

    // 権限チェック
    if (!client.channels.has(channel)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'You must join the channel first',
      }))
      return
    }

    if (!this.filter.canSendToChannel(client.permissions, channel)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: `No permission to send to channel: ${channel}`,
      }))
      return
    }

    // レート制限チェック
    if (!this.filter.checkRateLimit(client.memberId)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Rate limit exceeded. Please wait before sending another message.',
      }))
      return
    }

    // メッセージバリデーション
    const validation = this.filter.validateMessage(content)
    if (!validation.valid) {
      client.ws.send(JSON.stringify({
        type: 'error',
        message: validation.reason || 'Invalid message',
      }))
      return
    }

    // コンテンツフィルタリング
    const filteredContent = this.filter.filterContent(content)

    // メッセージ作成
    const messageId = crypto.randomUUID()
    const message: ChatMessagePayload = {
      id: messageId,
      channel,
      sender_member_id: client.memberId,
      sender_name: client.displayName,
      content: filteredContent,
      sent_at: new Date().toISOString(),
      message_type: message_type as 'text' | 'file' | 'system',
    }

    // チャンネル内の全メンバーに配信
    const deliveredTo = this.broadcastToChannel(channel, {
      type: 'chat_message',
      message,
    })

    // データベースに保存
    try {
      await this.supabase.from('claw_chat_logs').insert({
        id: messageId,
        channel_name: channel,
        sender_member_id: client.memberId,
        message_type,
        content: filteredContent,
        sent_at: message.sent_at,
        delivered_to: deliveredTo,
      })
    } catch (error) {
      console.error('[GATEWAY] Failed to save chat log:', error)
    }
  }

  /**
   * 接続中メンバー一覧取得
   */
  private handleGetMembers(client: ConnectedClient, channel?: string): void {
    const members = channel
      ? this.getChannelMembers(channel)
      : Array.from(this.clients.values()).map((c) => ({
          member_id: c.memberId,
          display_name: c.displayName,
          channels: Array.from(c.channels),
        }))

    client.ws.send(JSON.stringify({
      type: 'members_list',
      channel,
      members,
    }))
  }

  /**
   * 切断ハンドラ
   */
  private async handleDisconnect(client: ConnectedClient): Promise<void> {
    // 参加チャンネルに退出通知
    for (const channel of client.channels) {
      this.broadcastToChannel(channel, {
        type: 'member_left',
        channel,
        member_id: client.memberId,
        member_name: client.displayName,
      }, client.memberId)
    }

    this.clients.delete(client.memberId)
    await this.auth.handleDisconnect(client.memberId)

    console.log(`[GATEWAY] Client disconnected: ${client.memberId} (${client.displayName})`)
  }

  /**
   * チャンネル内ブロードキャスト
   */
  private broadcastToChannel(
    channel: string,
    message: any,
    excludeMemberId?: string
  ): string[] {
    const deliveredTo: string[] = []
    const payload = JSON.stringify(message)

    for (const [memberId, client] of this.clients.entries()) {
      if (memberId === excludeMemberId) continue
      if (!client.channels.has(channel)) continue

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload)
        deliveredTo.push(memberId)
      }
    }

    return deliveredTo
  }

  /**
   * 全クライアントへのブロードキャスト
   */
  private broadcastAll(message: any, excludeMemberId?: string): void {
    const payload = JSON.stringify(message)

    for (const [memberId, client] of this.clients.entries()) {
      if (memberId === excludeMemberId) continue
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload)
      }
    }
  }

  /**
   * Ping チェック（死活監視）
   */
  private checkPings(): void {
    const now = Date.now()
    const timeout = 60000 // 60秒タイムアウト

    for (const [memberId, client] of this.clients.entries()) {
      if (now - client.lastPing > timeout) {
        console.log(`[GATEWAY] Client timeout: ${memberId}`)
        client.ws.terminate()
        this.handleDisconnect(client)
      } else if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping()
      }
    }
  }

  /**
   * チャンネルメンバー一覧取得
   */
  private getChannelMembers(channel: string): Array<{
    member_id: string
    display_name: string
  }> {
    const members: Array<{ member_id: string; display_name: string }> = []

    for (const client of this.clients.values()) {
      if (client.channels.has(channel)) {
        members.push({
          member_id: client.memberId,
          display_name: client.displayName,
        })
      }
    }

    return members
  }

  /**
   * 利用可能チャンネル一覧取得
   */
  private getAvailableChannels(permissions: string[]): string[] {
    const channels: string[] = []
    if (permissions.includes('channels:general')) channels.push('general')
    if (permissions.includes('channels:trading')) channels.push('trading')
    if (permissions.includes('channels:alerts')) channels.push('alerts')
    return channels
  }

  /**
   * チャンネル統計取得
   */
  private getChannelStats(): Record<string, number> {
    const stats: Record<string, number> = {}

    for (const client of this.clients.values()) {
      for (const channel of client.channels) {
        stats[channel] = (stats[channel] || 0) + 1
      }
    }

    return stats
  }

  /**
   * グレースフルシャットダウン
   */
  private shutdown(): void {
    console.log('[GATEWAY] Shutting down...')

    if (this.pingInterval) clearInterval(this.pingInterval)
    if (this.cleanupInterval) clearInterval(this.cleanupInterval)

    // 全クライアントに通知して切断
    this.broadcastAll({
      type: 'server_shutdown',
      message: 'Gateway server is shutting down',
    })

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutdown')
    }

    if (this.wss) {
      this.wss.close(() => {
        console.log('[GATEWAY] Server stopped')
        process.exit(0)
      })
    } else {
      process.exit(0)
    }
  }
}

// サーバー起動
const gateway = new GatewayServer()
gateway.start()

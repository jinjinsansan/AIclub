import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Gateway認証・認可モジュール
 *
 * WebSocket接続時にGateway Tokenを検証し、
 * メンバーの権限を決定する。
 */
export interface AuthResult {
  valid: boolean
  member_id?: string
  display_name?: string
  permissions?: string[]
}

export class GatewayAuth {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Gateway Tokenによる接続認証
   */
  async authenticateConnection(token: string): Promise<AuthResult> {
    try {
      // Gateway Token確認
      const { data: connection, error } = await this.supabase
        .from('gateway_connections')
        .select('member_id')
        .eq('connection_token', token)
        .single()

      if (error || !connection) {
        return { valid: false }
      }

      // メンバーのアクティブ状態・プラン確認
      const { data: member } = await this.supabase
        .from('members')
        .select('member_id, display_name, membership_status, plan')
        .eq('member_id', connection.member_id)
        .eq('membership_status', 'active')
        .single()

      if (!member) {
        return { valid: false }
      }

      // 権限決定
      const permissions = this.getPermissions(member.plan)

      // 接続状態をオンラインに更新
      await this.supabase
        .from('gateway_connections')
        .update({
          status: 'online',
          connected_at: new Date().toISOString(),
          last_ping: new Date().toISOString(),
        })
        .eq('connection_token', token)

      return {
        valid: true,
        member_id: member.member_id,
        display_name: member.display_name,
        permissions,
      }
    } catch (error) {
      console.error('[AUTH] Authentication error:', error)
      return { valid: false }
    }
  }

  /**
   * 切断時のステータス更新
   */
  async handleDisconnect(memberId: string): Promise<void> {
    try {
      await this.supabase
        .from('gateway_connections')
        .update({
          status: 'offline',
          disconnected_at: new Date().toISOString(),
        })
        .eq('member_id', memberId)
        .eq('status', 'online')

      // membersテーブルも更新
      await this.supabase
        .from('members')
        .update({
          claw_status: 'offline',
          last_seen: new Date().toISOString(),
        })
        .eq('member_id', memberId)
    } catch (error) {
      console.error('[AUTH] Disconnect update error:', error)
    }
  }

  /**
   * Ping更新
   */
  async updatePing(memberId: string): Promise<void> {
    try {
      await this.supabase
        .from('gateway_connections')
        .update({ last_ping: new Date().toISOString() })
        .eq('member_id', memberId)
        .eq('status', 'online')
    } catch (error) {
      console.error('[AUTH] Ping update error:', error)
    }
  }

  /**
   * プランに基づく権限リスト生成
   */
  private getPermissions(plan: string): string[] {
    const basePermissions = [
      'chat:send',
      'chat:receive',
      'channels:general',
      'channels:trading',
    ]

    if (plan === 'master') {
      return [
        ...basePermissions,
        'chat:broadcast',
        'admin:monitor',
        'admin:kick',
        'channels:alerts',
      ]
    }

    return basePermissions
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * CLAW接続状況確認 API (管理者用)
 *
 * GET /api/admin/gateway/connections
 * 全メンバーCLAWの接続状態を取得する。
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: adminMember } = await supabase
      .from('members')
      .select('member_id, plan')
      .eq('member_id', user.id)
      .single()

    if (!adminMember || adminMember.plan !== 'master') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 全CLAW接続状況取得
    const { data: connections, error } = await supabase
      .from('gateway_connections')
      .select('member_id, status, last_ping, ip_address, connected_at, gateway_session_id')
      .order('last_ping', { ascending: false })

    if (error) {
      console.error('Failed to fetch connections:', error)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    // メンバー情報とCLAW設定を取得
    const memberIds = [...new Set(connections?.map((c) => c.member_id) || [])]

    const [membersResult, configsResult] = await Promise.all([
      supabase
        .from('members')
        .select('member_id, display_name, membership_status')
        .in('member_id', memberIds),
      supabase
        .from('member_claw_config')
        .select('member_id, claw_version, capabilities')
        .in('member_id', memberIds),
    ])

    const memberMap = new Map(
      membersResult.data?.map((m) => [m.member_id, m]) || []
    )
    const configMap = new Map(
      configsResult.data?.map((c) => [c.member_id, c]) || []
    )

    const formatted = (connections || []).map((conn) => {
      const member = memberMap.get(conn.member_id)
      const config = configMap.get(conn.member_id)
      return {
        member_id: conn.member_id,
        display_name: member?.display_name || 'Unknown',
        membership_status: member?.membership_status || 'unknown',
        status: conn.status,
        last_ping: conn.last_ping,
        ip_address: conn.ip_address,
        connected_at: conn.connected_at,
        version: config?.claw_version || 'Unknown',
        capabilities: config?.capabilities || [],
      }
    })

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
      online: formatted.filter((c) => c.status === 'online').length,
    })
  } catch (error) {
    console.error('Admin gateway connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * CLAW強制切断 API (管理者用)
 *
 * POST /api/admin/gateway/connections
 * body: { member_id: string, action: 'kick' }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // 管理者権限チェック
    const { data: adminMember } = await supabase
      .from('members')
      .select('member_id, plan')
      .eq('member_id', user.id)
      .single()

    if (!adminMember || adminMember.plan !== 'master') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { member_id: targetMemberId, action } = body

    if (action === 'kick' && targetMemberId) {
      const { error: updateError } = await supabase
        .from('gateway_connections')
        .update({
          status: 'offline',
          disconnected_at: new Date().toISOString(),
        })
        .eq('member_id', targetMemberId)
        .eq('status', 'online')

      if (updateError) {
        return NextResponse.json({ error: 'Failed to kick member' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Member ${targetMemberId} disconnected`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Admin gateway action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

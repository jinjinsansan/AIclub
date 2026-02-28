import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Gateway Token 生成・取得 API
 *
 * GET /api/gateway/token
 * 認証済みアクティブメンバーに Gateway 接続用トークンを発行する。
 * 既存の有効トークンがあればそれを返し、なければ新規生成する。
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

    // メンバー情報確認
    const { data: member } = await supabase
      .from('members')
      .select('member_id, membership_status')
      .eq('member_id', user.id)
      .single()

    if (!member || member.membership_status !== 'active') {
      return NextResponse.json({ error: 'Inactive membership' }, { status: 403 })
    }

    // 既存の有効な Gateway Token を検索
    let { data: connection } = await supabase
      .from('gateway_connections')
      .select('connection_token')
      .eq('member_id', member.member_id)
      .in('status', ['offline', 'online'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // 新規 Token 生成
    if (!connection) {
      const connectionToken = crypto.randomUUID()

      const { error: insertError } = await supabase
        .from('gateway_connections')
        .insert({
          member_id: member.member_id,
          connection_token: connectionToken,
          status: 'offline',
        })

      if (insertError) {
        console.error('Failed to create gateway connection:', insertError)
        return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
      }

      connection = { connection_token: connectionToken }
    }

    return NextResponse.json({
      success: true,
      token: connection.connection_token,
      gateway_url: process.env.GATEWAY_WSS_URL || 'wss://gateway.openclaw.community:18789',
      member_id: member.member_id,
    })
  } catch (error) {
    console.error('Gateway token generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Gateway Token 無効化 API
 *
 * DELETE /api/gateway/token
 * 現在のメンバーの Gateway Token を無効化（削除）する。
 */
export async function DELETE(request: NextRequest) {
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

    const { error: deleteError } = await supabase
      .from('gateway_connections')
      .delete()
      .eq('member_id', user.id)
      .eq('status', 'offline')

    if (deleteError) {
      console.error('Failed to revoke gateway token:', deleteError)
      return NextResponse.json({ error: 'Failed to revoke token' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Token revoked' })
  } catch (error) {
    console.error('Gateway token revocation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

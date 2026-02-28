import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * チャット履歴取得 API
 *
 * GET /api/gateway/history?channel={channel}&limit={limit}&before={timestamp}
 * 指定チャンネルのチャット履歴を取得する。
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

    // メンバーのアクティブ状態確認
    const { data: member } = await supabase
      .from('members')
      .select('member_id, membership_status')
      .eq('member_id', user.id)
      .single()

    if (!member || member.membership_status !== 'active') {
      return NextResponse.json({ error: 'Inactive membership' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'general'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const before = searchParams.get('before')

    let query = supabase
      .from('claw_chat_logs')
      .select('id, channel_name, sender_member_id, message_type, content, metadata, sent_at')
      .eq('channel_name', channel)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('sent_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error('Failed to fetch chat history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // 送信者の表示名を取得
    const senderIds = [...new Set(messages?.map((m) => m.sender_member_id) || [])]
    const { data: members } = await supabase
      .from('members')
      .select('member_id, display_name')
      .in('member_id', senderIds)

    const nameMap = new Map(members?.map((m) => [m.member_id, m.display_name]) || [])

    const enriched = (messages || []).map((msg) => ({
      ...msg,
      sender_name: nameMap.get(msg.sender_member_id) || 'Unknown',
    }))

    return NextResponse.json({
      success: true,
      data: enriched.reverse(),
      channel,
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

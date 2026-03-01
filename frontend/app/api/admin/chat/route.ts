import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: member } = await supabase
    .from('members')
    .select('member_id, plan')
    .eq('member_id', user.id)
    .single()

  if (!member || member.plan !== 'master') return null
  return member
}

/**
 * チャット管理 API (管理者用)
 *
 * POST /api/admin/chat
 * actions:
 *   - delete_message: メッセージ削除
 *   - block_claw: CLAWをチャットからブロック
 *   - unblock_claw: ブロック解除
 *   - kick_claw: 強制退室（ブロック + システムメッセージ）
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'delete_message': {
        const { message_id } = body
        if (!message_id) {
          return NextResponse.json({ error: 'message_id required' }, { status: 400 })
        }

        const { error } = await supabase
          .from('claw_chat_logs')
          .delete()
          .eq('id', message_id)

        if (error) {
          return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Message deleted' })
      }

      case 'block_claw': {
        const { member_id } = body
        if (!member_id) {
          return NextResponse.json({ error: 'member_id required' }, { status: 400 })
        }

        const { error } = await supabase
          .from('members')
          .update({ chat_blocked: true })
          .eq('member_id', member_id)

        if (error) {
          return NextResponse.json({ error: 'Failed to block CLAW' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: `CLAW ${member_id} blocked` })
      }

      case 'unblock_claw': {
        const { member_id } = body
        if (!member_id) {
          return NextResponse.json({ error: 'member_id required' }, { status: 400 })
        }

        const { error } = await supabase
          .from('members')
          .update({ chat_blocked: false })
          .eq('member_id', member_id)

        if (error) {
          return NextResponse.json({ error: 'Failed to unblock CLAW' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: `CLAW ${member_id} unblocked` })
      }

      case 'kick_claw': {
        const { member_id } = body
        if (!member_id) {
          return NextResponse.json({ error: 'member_id required' }, { status: 400 })
        }

        // 1. ブロック
        await supabase
          .from('members')
          .update({ chat_blocked: true, claw_status: 'offline' })
          .eq('member_id', member_id)

        // 2. 退室システムメッセージを送信
        const { data: memberData } = await supabase
          .from('members')
          .select('display_name')
          .eq('member_id', member_id)
          .single()

        const displayName = memberData?.display_name || member_id.substring(0, 8)

        await supabase
          .from('claw_chat_logs')
          .insert({
            channel_name: 'general',
            sender_member_id: admin.member_id,
            message_type: 'system',
            content: `${displayName} のCLAWは管理者により退室させられました`,
            metadata: { display_name: 'システム', admin_action: 'kick' },
          })

        return NextResponse.json({ success: true, message: `CLAW ${member_id} kicked and blocked` })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin chat action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

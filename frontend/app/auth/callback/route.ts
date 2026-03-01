import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  if (code) {
    // PKCE フロー: code を使ってセッションを交換
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(new URL('/payment', requestUrl.origin))
  }

  if (token_hash && type) {
    // トークンハッシュフロー: verify ページに転送して処理
    return NextResponse.redirect(
      new URL(`/verify?token=${token_hash}&type=${type}`, requestUrl.origin)
    )
  }

  // パラメータなし or エラー時は verify ページへ
  return NextResponse.redirect(new URL('/verify', requestUrl.origin))
}

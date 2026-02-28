import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { Member } from '@/types/database'

export interface AuthUser extends User {
  member?: Member
}

// 会員登録（仮登録）
export async function registerMember(data: {
  email: string
  password: string
  displayName: string
  minaraWallet: string
  referralCode?: string
}) {
  try {
    // 1. Supabase Authでユーザー作成（確認メール送信）
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.displayName,
          minara_wallet: data.minaraWallet,
          referred_by_code: data.referralCode
        }
      }
    })

    if (authError) throw authError

    // 2. 仮登録の場合、membersテーブルにレコード作成
    if (authData.user) {
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          member_id: authData.user.id,
          email: data.email,
          display_name: data.displayName,
          minara_wallet: data.minaraWallet,
          referred_by_code: data.referralCode,
          membership_status: 'pending_payment'
        })

      if (memberError) {
        console.error('Failed to create member record:', memberError)
        // Auth userは作成済みなので、ここでの失敗は後で修正可能
      }
    }

    return { success: true, user: authData.user, requiresConfirmation: !authData.session }
  } catch (error: any) {
    console.error('Registration error:', error)
    return { success: false, error: error.message }
  }
}

// ログイン
export async function loginMember(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    // 会員情報も取得
    const member = await getMemberData(data.user.id)
    
    // アクティブな会員のみログイン許可
    if (member?.membership_status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('アカウントがアクティブではありません。初期費用の支払いが完了していない可能性があります。')
    }

    return { 
      success: true, 
      user: data.user, 
      member,
      session: data.session 
    }
  } catch (error: any) {
    console.error('Login error:', error)
    return { success: false, error: error.message }
  }
}

// ログアウト
export async function logoutMember() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Logout error:', error)
    return { success: false, error: error.message }
  }
}

// 会員データの取得
export async function getMemberData(userId: string): Promise<Member | null> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('member_id', userId)
      .single()

    if (error) {
      console.error('Failed to get member data:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Get member data error:', error)
    return null
  }
}

// パスワードリセット
export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Password reset error:', error)
    return { success: false, error: error.message }
  }
}

// パスワード更新
export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Password update error:', error)
    return { success: false, error: error.message }
  }
}

// 現在のユーザーセッション取得
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const member = await getMemberData(user.id)
    
    return {
      ...user,
      member
    } as AuthUser
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

// 認証状態の変更を監視
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const member = await getMemberData(session.user.id)
      callback({
        ...session.user,
        member
      } as AuthUser)
    } else {
      callback(null)
    }
  })
}

// 会員情報の更新
export async function updateMemberProfile(updates: Partial<Member>) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('member_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Profile update error:', error)
    return { success: false, error: error.message }
  }
}

// メール認証の再送
export async function resendConfirmation(email: string) {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email
    })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Resend confirmation error:', error)
    return { success: false, error: error.message }
  }
}
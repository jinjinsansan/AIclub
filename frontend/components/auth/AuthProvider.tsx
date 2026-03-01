'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AuthUser, getCurrentUser, onAuthStateChange } from '@/lib/auth'
import { CrayfishLogo } from '@/components/icons/CrayfishLogo'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {}
})

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 初回ロード時のユーザー情報取得
    const getInitialUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Failed to get initial user:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialUser()

    // 認証状態変更の監視
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 認証が必要なページの保護
  useEffect(() => {
    if (!loading) {
      const isAuthRequired = pathname.startsWith('/dashboard')
      const isAuthPage = ['/login', '/register'].includes(pathname)

      if (isAuthRequired && !user) {
        // 認証が必要なページで未ログインの場合
        router.push('/login')
      } else if (isAuthPage && user) {
        // 認証ページで既にログイン済みの場合
        router.push('/dashboard')
      }
    }
  }, [user, loading, pathname, router])

  const signOut = async () => {
    try {
      const { logoutMember } = await import('@/lib/auth')
      await logoutMember()
      setUser(null)
      router.push('/')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const value = {
    user,
    loading,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ローディングコンポーネント
export function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="text-center">
        <CrayfishLogo variant="gradient" size={48} className="mx-auto mb-4" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-gradient-crayfish">OPEN CLAW</h2>
        <p className="text-gray-600">認証状態を確認中...</p>
      </div>
    </div>
  )
}
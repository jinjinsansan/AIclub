'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

// バリデーションスキーマ
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
  rememberMe: z.boolean().optional()
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true)
    setLoginError(null)
    
    try {
      const { loginMember } = await import('@/lib/auth')
      
      const result = await loginMember(data.email, data.password)
      
      if (!result.success) {
        throw new Error(result.error || 'ログインに失敗しました')
      }
      
      // ログイン成功時はダッシュボードへリダイレクト
      window.location.href = '/dashboard'
      
    } catch (error: any) {
      console.error('Login failed:', error)
      setLoginError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-primary-600 hover:text-primary-700">
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            ホームに戻る
          </Link>
        </div>
        
        <div className="card">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">サロンにログイン</h2>
            <p className="mt-2 text-gray-600">
              OPEN CLAWコミュニティへようこそ
            </p>
          </div>

          {loginError && (
            <div className="mb-6 bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded-lg">
              <p className="text-sm">{loginError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* メールアドレス */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="input-field"
                placeholder="example@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
              )}
            </div>

            {/* パスワード */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input-field pr-10"
                  placeholder="パスワードを入力"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>
              )}
            </div>

            {/* ログイン状態を保持 & パスワード忘れ */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('rememberMe')}
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                  ログイン状態を保持
                </label>
              </div>
              
              <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
                パスワードを忘れた方
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  ログイン中...
                </>
              ) : (
                'ログイン'
              )}
            </button>
          </form>

          {/* 注意事項 */}
          <div className="mt-6 bg-warning-50 border border-warning-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-warning-900 mb-2">ログインについて</h4>
            <p className="text-sm text-warning-800">
              ログインには初期費用 $700 の入金確認が必要です。
              未払いの場合は支払い完了後にアクセス可能になります。
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              まだアカウントをお持ちでない方は{' '}
              <Link href="/register" className="text-primary-600 hover:text-primary-700 underline">
                新規登録
              </Link>
            </p>
          </div>
        </div>

        {/* ログインできない場合の案内 */}
        <div className="mt-8 text-center">
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer hover:text-gray-800 mb-2">
              ログインできない場合
            </summary>
            <div className="text-left bg-white rounded-lg p-4 mt-2 border border-gray-200">
              <h4 className="font-semibold mb-2">よくある問題と解決方法：</h4>
              <ul className="space-y-2 text-sm">
                <li>• <strong>入金未完了：</strong> 初期費用 $700 の支払いが完了していない</li>
                <li>• <strong>メール未認証：</strong> 登録時の認証メールをクリックしていない</li>
                <li>• <strong>パスワード忘れ：</strong> 上記「パスワードを忘れた方」をクリック</li>
                <li>• <strong>アカウント停止：</strong> 月額会費の未払い等でアカウントが停止中</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                解決しない場合は、LINE オープンチャットまたはサポートまでお問い合わせください。
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
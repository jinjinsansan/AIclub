'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'
import { CrayfishLogo } from '@/components/icons/CrayfishLogo'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'waiting'>('waiting')
  const [errorMessage, setErrorMessage] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    // query params からトークンを取得（/auth/callback 経由）
    const token = searchParams.get('token')
    const type = searchParams.get('type')

    if (token && type === 'signup') {
      setStatus('verifying')
      handleEmailVerification(token)
      return
    }

    // hash fragment からエラー情報を取得（Supabase 直接リダイレクト時）
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1)
      const hashParams = new URLSearchParams(hash)
      const errorCode = hashParams.get('error_code')
      const errorDescription = hashParams.get('error_description')

      if (errorCode) {
        setStatus('error')
        setErrorMessage(
          errorDescription?.replace(/\+/g, ' ') ||
          'リンクが無効または期限切れの可能性があります。'
        )
      }
    }
  }, [searchParams])

  const handleEmailVerification = async (token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'signup'
      })

      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }

      setStatus('success')
      setTimeout(() => {
        router.push('/payment')
      }, 3000)
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err.message || '認証に失敗しました')
    }
  }

  const handleResendEmail = async () => {
    if (!email) return

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      alert('認証メールを再送信しました。メールをご確認ください。')
    } catch (err: any) {
      setErrorMessage(err.message || '再送信に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <CrayfishLogo variant="gradient" size={48} className="mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-gradient-crayfish">OPEN CLAW</h1>
          <p className="mt-2 text-gray-600">メール認証</p>
        </div>

        <div className="card">
          {status === 'waiting' && (
            <div className="text-center">
              <EnvelopeIcon className="mx-auto h-16 w-16 text-primary-400 mb-6" />
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                メール認証をお待ちしています
              </h2>
              <p className="text-gray-600 mb-6">
                登録時に入力したメールアドレスに認証リンクを送信しました。
                メールに記載されたリンクをクリックして認証を完了してください。
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  メールが届かない場合は、以下のフォームからメールアドレスを入力して再送信してください。
                </p>
              </div>
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="メールアドレスを入力"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleResendEmail}
                  disabled={!email}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  認証メールを再送信
                </button>
              </div>
            </div>
          )}

          {status === 'verifying' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                認証中です...
              </h2>
              <p className="text-gray-600">
                しばらくお待ちください。
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-success-500 mb-6" />
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                メール認証が完了しました
              </h2>
              <p className="text-gray-600 mb-6">
                支払い案内ページへ自動的に遷移します。
              </p>
              <Link href="/payment" className="btn-primary inline-flex items-center">
                支払い案内へ進む
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-error-500 mb-6" />
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                認証に失敗しました
              </h2>
              <p className="text-error-600 mb-6">
                {errorMessage || 'リンクが無効または期限切れの可能性があります。'}
              </p>
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="メールアドレスを入力"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleResendEmail}
                  disabled={!email}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  認証メールを再送信
                </button>
                <Link href="/register" className="block text-sm text-primary-600 hover:text-primary-700">
                  新規登録に戻る
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}

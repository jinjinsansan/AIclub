'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

// バリデーションスキーマ
const registerSchema = z.object({
  displayName: z.string()
    .min(2, '表示名は2文字以上で入力してください')
    .max(50, '表示名は50文字以内で入力してください'),
  email: z.string()
    .email('有効なメールアドレスを入力してください'),
  minaraWallet: z.string()
    .min(10, 'MINARAウォレットアドレスを正しく入力してください')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'ウォレットアドレスの形式が正しくありません'),
  referralCode: z.string()
    .optional()
    .refine((code) => !code || /^[A-Z0-9]{8}$/.test(code), {
      message: '紹介コードは8文字の英数字で入力してください'
    }),
  agreedToTerms: z.boolean()
    .refine((val) => val === true, {
      message: '利用規約とプライバシーポリシーに同意してください'
    })
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const referralCodeFromUrl = searchParams?.get('ref') || ''
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationStep, setRegistrationStep] = useState<'form' | 'email_sent' | 'payment_guide'>('form')
  
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      referralCode: referralCodeFromUrl
    }
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsSubmitting(true)
    
    try {
      // TODO: API呼び出し - 仮登録処理
      console.log('Registration data:', data)
      
      // 仮実装：2秒後にメール送信ステップに移行
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setRegistrationStep('email_sent')
    } catch (error) {
      console.error('Registration failed:', error)
      // TODO: エラーハンドリング
    } finally {
      setIsSubmitting(false)
    }
  }

  if (registrationStep === 'email_sent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center text-primary-600 hover:text-primary-700">
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              ホームに戻る
            </Link>
          </div>
          
          <div className="card text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-success-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              認証メールを送信しました
            </h2>
            <p className="text-gray-600 mb-6">
              ご登録いただいたメールアドレスに認証リンクを送信しました。
              メールをご確認いただき、認証を完了してください。
            </p>
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-warning-800">
                <strong>重要：</strong> メール認証完了後、初期費用 $700 の支払いが必要です。
                支払い確認後にサロンへのアクセスが可能になります。
              </p>
            </div>
            <p className="text-sm text-gray-500">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
          </div>
        </div>
      </div>
    )
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
            <h2 className="text-2xl font-bold text-gray-900">OPEN CLAW に参加</h2>
            <p className="mt-2 text-gray-600">
              新しいAIコミュニティの一員になりましょう
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 表示名 */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                表示名 <span className="text-error-500">*</span>
              </label>
              <input
                {...register('displayName')}
                type="text"
                className="input-field"
                placeholder="山田太郎"
              />
              {errors.displayName && (
                <p className="mt-1 text-sm text-error-600">{errors.displayName.message}</p>
              )}
            </div>

            {/* メールアドレス */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス <span className="text-error-500">*</span>
              </label>
              <input
                {...register('email')}
                type="email"
                className="input-field"
                placeholder="example@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
              )}
            </div>

            {/* MINARAウォレットアドレス */}
            <div>
              <label htmlFor="minaraWallet" className="block text-sm font-medium text-gray-700 mb-1">
                MINARAウォレットアドレス <span className="text-error-500">*</span>
              </label>
              <input
                {...register('minaraWallet')}
                type="text"
                className="input-field font-mono text-sm"
                placeholder="0x..."
              />
              {errors.minaraWallet && (
                <p className="mt-1 text-sm text-error-600">{errors.minaraWallet.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                初期費用の支払いに使用するMINARAウォレットのアドレスを入力してください
              </p>
            </div>

            {/* 紹介コード */}
            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">
                紹介コード（任意）
              </label>
              <input
                {...register('referralCode')}
                type="text"
                className="input-field font-mono text-sm uppercase"
                placeholder="CLAW7X2A"
                onChange={(e) => setValue('referralCode', e.target.value.toUpperCase())}
              />
              {errors.referralCode && (
                <p className="mt-1 text-sm text-error-600">{errors.referralCode.message}</p>
              )}
              {referralCodeFromUrl && (
                <p className="mt-1 text-xs text-success-600">
                  紹介コードが自動入力されました
                </p>
              )}
            </div>

            {/* 利用規約同意 */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  {...register('agreedToTerms')}
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="agreedToTerms" className="text-gray-700">
                  <Link href="/terms" className="text-primary-600 hover:text-primary-700 underline">
                    利用規約
                  </Link>
                  および
                  <Link href="/privacy" className="text-primary-600 hover:text-primary-700 underline">
                    プライバシーポリシー
                  </Link>
                  に同意します <span className="text-error-500">*</span>
                </label>
              </div>
            </div>
            {errors.agreedToTerms && (
              <p className="text-sm text-error-600">{errors.agreedToTerms.message}</p>
            )}

            {/* 料金について */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="font-semibold text-primary-900 mb-2">料金について</h4>
              <ul className="text-sm text-primary-800 space-y-1">
                <li>• 初期費用: $700 USD（一度限り）</li>
                <li>• 月額会費: 別途ご案内（継続利用の場合）</li>
                <li>• すべて先払い制・MINARAウォレット経由</li>
              </ul>
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
                  登録処理中...
                </>
              ) : (
                '仮登録を完了する'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              すでにアカウントをお持ちですか？{' '}
              <Link href="/login" className="text-primary-600 hover:text-primary-700 underline">
                ログイン
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
import Link from 'next/link'
import { ArrowRightIcon, ChatBubbleLeftRightIcon, CurrencyDollarIcon, UserGroupIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* ナビゲーションヘッダー */}
      <nav className="relative bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary-600">OPEN CLAW</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
                ログイン
              </Link>
              <Link href="/register" className="btn-primary">
                新規登録
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
              AI CLAWと共に
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600">
                新しい未来へ
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              OPEN CLAWコミュニティプラットフォームで、AIボット「CLAW」を活用した自動トレードと
              革新的な紹介制度を体験してください。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="btn-primary text-lg px-8 py-3">
                今すぐ参加する
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link href="#features" className="btn-secondary text-lg px-8 py-3">
                詳細を見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              OPEN CLAWの特徴
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              最先端のAI技術とコミュニティの力を組み合わせた、まったく新しいプラットフォーム
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI CLAWボット</h3>
              <p className="text-gray-600">
                高性能AIボットがあなたの投資戦略をサポート
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-secondary-100 rounded-full flex items-center justify-center mb-4">
                <CurrencyDollarIcon className="h-8 w-8 text-secondary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">自動トレード</h3>
              <p className="text-gray-600">
                MINARA AIとの連携による完全自動トレードシステム
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
                <UserGroupIcon className="h-8 w-8 text-success-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">紹介制度</h3>
              <p className="text-gray-600">
                3段階の紹介報酬で継続的な収益機会を提供
              </p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-warning-100 rounded-full flex items-center justify-center mb-4">
                <ShieldCheckIcon className="h-8 w-8 text-warning-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">安心・安全</h3>
              <p className="text-gray-600">
                先払い制度と透明な報酬システムで安心運用
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 料金セクション */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              シンプルな料金体系
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              明確で公正な料金設定。すべて先払い制で安心してご利用いただけます。
            </p>
          </div>
          
          <div className="max-w-lg mx-auto">
            <div className="card text-center">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">スタンダードプラン</h3>
                <div className="text-4xl font-bold text-primary-600 mb-4">
                  $700
                  <span className="text-lg text-gray-500 font-normal">/ 初回のみ</span>
                </div>
                <p className="text-gray-600">
                  すべての機能にアクセス可能
                </p>
              </div>
              
              <ul className="space-y-3 mb-8 text-left">
                <li className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-3" />
                  <span>AI CLAWボット利用権限</span>
                </li>
                <li className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-3" />
                  <span>自動トレードシステム</span>
                </li>
                <li className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-3" />
                  <span>紹介制度参加権</span>
                </li>
                <li className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-3" />
                  <span>専用ダッシュボード</span>
                </li>
                <li className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-3" />
                  <span>マニュアル・サポート</span>
                </li>
                <li className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-success-500 mr-3" />
                  <span>Zoomセミナー参加</span>
                </li>
              </ul>
              
              <Link href="/register" className="btn-primary w-full text-lg py-3">
                今すぐ始める
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">OPEN CLAW</h3>
            <p className="text-gray-400 mb-8">
              AIと共に進む、新しい時代のコミュニティプラットフォーム
            </p>
            <div className="flex justify-center space-x-6">
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
                ログイン
              </Link>
              <Link href="/register" className="text-gray-400 hover:text-white transition-colors">
                新規登録
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            <p>&copy; 2026 なみサポ協会 / OPEN CLAW. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
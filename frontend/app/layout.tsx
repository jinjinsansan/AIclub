import './globals.css'
import type { Metadata } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansJP = Noto_Sans_JP({ 
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OPEN CLAW コミュニティプラットフォーム',
  description: 'AIボット「CLAW」を使ったコミュニティプラットフォーム。MINARA AIとの連携で自動トレードと紹介制度を実現。',
  keywords: ['OPEN CLAW', 'AI', 'トレード', 'コミュニティ', 'MINARA'],
  authors: [{ name: 'なみサポ協会' }],
  creator: 'なみサポ協会',
  publisher: 'OPEN CLAW',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://openclaw.com'),
  openGraph: {
    title: 'OPEN CLAW コミュニティプラットフォーム',
    description: 'AIボット「CLAW」を使ったコミュニティプラットフォーム',
    url: '/',
    siteName: 'OPEN CLAW',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OPEN CLAW コミュニティプラットフォーム',
    description: 'AIボット「CLAW」を使ったコミュニティプラットフォーム',
    creator: '@openclaw_official',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <div id="root" className="min-h-screen bg-gray-50">
            {children}
          </div>
        </AuthProvider>
        
        {/* Toast通知用コンテナ */}
        <div id="toast-root" className="fixed top-4 right-4 z-50" />
        
        {/* モーダル用コンテナ */}
        <div id="modal-root" />
      </body>
    </html>
  )
}
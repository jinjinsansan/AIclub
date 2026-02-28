'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  HomeIcon,
  BookOpenIcon,
  VideoCameraIcon,
  CurrencyDollarIcon,
  ShareIcon,
  BellIcon,
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  WifiIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: HomeIcon },
  { name: 'マニュアル', href: '/manual', icon: BookOpenIcon },
  { name: 'セミナー', href: '/seminar', icon: VideoCameraIcon },
  { name: 'CLAW接続', href: '/claw-connect', icon: WifiIcon },
  { name: 'CLAW Studio', href: '/claw-studio', icon: CommandLineIcon },
  { name: 'MINARA連携', href: '/minara', icon: ChartBarIcon },
  { name: '紹介コード', href: '/referral', icon: ShareIcon },
  { name: '通知', href: '/notifications', icon: BellIcon },
]

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user: authUser, signOut } = useAuth()

  const user = {
    displayName: authUser?.member?.display_name || 'メンバー',
    membershipStatus: authUser?.member?.membership_status || 'pending_payment',
    clawStatus: authUser?.member?.claw_status || 'offline',
    nextPaymentDue: authUser?.member?.fee_paid_until || '',
    pendingRewards: authUser?.member?.monthly_reward_pending || 0
  }

  useEffect(() => {
    if (authUser && authUser.member?.membership_status !== 'active') {
      router.push('/payment')
    }
  }, [authUser, router])

  const handleLogout = async () => {
    await signOut()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'online':
        return 'text-success-600 bg-success-100'
      case 'offline':
        return 'text-gray-600 bg-gray-100'
      case 'suspended':
      case 'error':
        return 'text-error-600 bg-error-100'
      default:
        return 'text-warning-600 bg-warning-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">OPEN CLAW</h1>
            <button
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={cn(
                      isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 h-5 w-5'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 py-4">
          <div className="flex h-12 items-center">
            <h1 className="text-2xl font-bold text-primary-600">OPEN CLAW</h1>
          </div>

          {/* User status */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium',
                    getStatusColor(user.membershipStatus)
                  )}>
                    アクティブ
                  </span>
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium',
                    getStatusColor(user.clawStatus)
                  )}>
                    CLAW オンライン
                  </span>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 h-5 w-5'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Quick stats */}
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>次回支払い</span>
                <span className="text-warning-600">3日後</span>
              </div>
              <div className="flex justify-between">
                <span>未払い報酬</span>
                <span className="text-success-600 font-medium">${user.pendingRewards}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center px-2 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md"
          >
            <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
            ログアウト
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-4 shadow-sm lg:px-6">
          <div className="flex items-center">
            <button
              className="text-gray-500 hover:text-gray-600 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <div className="flex-1 lg:ml-0 ml-4">
              <h1 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => item.href === pathname)?.name || 'ダッシュボード'}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/notifications" className="text-gray-400 hover:text-gray-500">
                <BellIcon className="h-6 w-6" />
              </Link>

              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-primary-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          {children}
        </main>
      </div>
    </div>
  )
}

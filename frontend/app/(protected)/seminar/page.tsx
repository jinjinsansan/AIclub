'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { getUpcomingSeminars } from '@/lib/api'
import {
  VideoCameraIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'

interface Seminar {
  id: string
  title: string
  description?: string
  scheduledAt: string
  zoomUrl?: string
  status: string
  durationMinutes?: number
}

export default function SeminarPage() {
  const { user } = useAuth()
  const [seminars, setSeminars] = useState<Seminar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSeminars = async () => {
      try {
        const data = await getUpcomingSeminars()
        setSeminars(data as Seminar[])
      } catch (error) {
        console.error('Failed to load seminars:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSeminars()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Zoomセミナー</h1>
        <p className="text-gray-600">
          OPEN CLAWコミュニティの定期セミナーとイベントのスケジュールです。
        </p>
      </div>

      {seminars.length > 0 ? (
        <div className="space-y-6">
          {seminars.map((seminar) => {
            const scheduledDate = new Date(seminar.scheduledAt)
            const isUpcoming = scheduledDate > new Date()

            return (
              <div key={seminar.id} className="card">
                <div className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 p-3 rounded-lg ${isUpcoming ? 'bg-primary-100' : 'bg-gray-100'}`}>
                    <VideoCameraIcon className={`h-8 w-8 ${isUpcoming ? 'text-primary-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{seminar.title}</h3>
                      {isUpcoming && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                          開催予定
                        </span>
                      )}
                    </div>
                    {seminar.description && (
                      <p className="text-sm text-gray-600 mb-3">{seminar.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                      <span className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {scheduledDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      <span className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {scheduledDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {seminar.durationMinutes && (
                        <span>{seminar.durationMinutes}分</span>
                      )}
                    </div>
                    {isUpcoming && seminar.zoomUrl && (
                      <a
                        href={seminar.zoomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-flex items-center text-sm"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                        Zoomで参加
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <VideoCameraIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">予定されているセミナーはありません</h3>
          <p className="text-gray-500">新しいセミナーが追加されるとこちらに表示されます。</p>
        </div>
      )}

      <div className="mt-12 bg-primary-50 border border-primary-200 rounded-lg p-6">
        <h4 className="font-semibold text-primary-900 mb-2">セミナーについて</h4>
        <div className="text-sm text-primary-800 space-y-2">
          <p>&#x2022; 定期セミナーは毎週/隔週で開催予定です</p>
          <p>&#x2022; 開催1日前と1時間前にLINEで通知が届きます</p>
          <p>&#x2022; 録画は後日マニュアルページで公開されます</p>
          <p>&#x2022; 質問はZoomのチャットまたはLINEオープンチャットでお気軽にどうぞ</p>
        </div>
      </div>
    </div>
  )
}

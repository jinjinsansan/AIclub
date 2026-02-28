'use client'

import { useState, useEffect } from 'react'

interface CLAWConnectionStatusProps {
  memberId?: string
  status: string
  onRefresh?: () => void
}

export function CLAWConnectionStatus({ memberId, status, onRefresh }: CLAWConnectionStatusProps) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    online: { label: 'オンライン', color: 'text-green-800', bg: 'bg-green-100' },
    connecting: { label: '接続中...', color: 'text-yellow-800', bg: 'bg-yellow-100' },
    offline: { label: 'オフライン', color: 'text-gray-800', bg: 'bg-gray-100' },
    error: { label: 'エラー', color: 'text-red-800', bg: 'bg-red-100' },
  }

  const config = statusConfig[status] || statusConfig.offline

  return (
    <div className="flex items-center justify-between p-4 bg-white border rounded-lg mb-4">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${
          status === 'online' ? 'bg-green-500 animate-pulse' :
          status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
          status === 'error' ? 'bg-red-500' :
          'bg-gray-400'
        }`} />
        <div>
          <div className="text-sm font-medium text-gray-900">CLAW接続ステータス</div>
          <div className="text-xs text-gray-500">ID: {memberId || '未設定'}</div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
          {config.label}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            更新
          </button>
        )}
      </div>
    </div>
  )
}

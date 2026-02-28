'use client'

import { useState, useEffect } from 'react'

interface StudioIframeProps {
  gatewayUrl: string
  authToken: string
  memberId: string
  height?: string
}

export function StudioIframe({
  gatewayUrl,
  authToken,
  memberId,
  height = '600px',
}: StudioIframeProps) {
  const [studioUrl, setStudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({
      gateway_url: gatewayUrl,
      auth_token: authToken,
      member_id: memberId,
      theme: 'openclaw-community',
      embedded: 'true',
    })

    setStudioUrl(`/studio?${params.toString()}`)
    setLoading(false)
  }, [gatewayUrl, authToken, memberId])

  if (loading || !studioUrl) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-lg" style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          Studio読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <iframe
        src={studioUrl}
        className="w-full border rounded-lg shadow-sm"
        style={{ height }}
        frameBorder="0"
        allow="microphone; camera; clipboard-read; clipboard-write"
        title="OpenClaw Studio"
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ChannelManager({
  businessId,
  type,
  channelId,
  isConnected,
  oauthProvider,
}: {
  businessId: string
  type: string
  channelId: string | null
  isConnected: boolean
  supportsOAuth: boolean
  oauthProvider: 'google' | 'meta'
}) {
  const router = useRouter()
  const [showManual, setShowManual] = useState(false)
  const [externalId, setExternalId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveManual() {
    setSaving(true)
    try {
      await fetch(`/api/superadmin/businesses/${businessId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, externalId, accessToken }),
      })
      setShowManual(false)
      setExternalId('')
      setAccessToken('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!channelId) return
    await fetch(`/api/superadmin/businesses/${businessId}/channels/${channelId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2">
        <a href={`/api/oauth/${oauthProvider}/start?businessId=${businessId}`} className="btn-secondary text-xs py-1.5 px-3">
          Conectează prin OAuth
        </a>
        <button onClick={() => setShowManual((v) => !v)} className="btn-secondary text-xs py-1.5 px-3">
          Introdu cheie manual
        </button>
        {isConnected && (
          <button onClick={disconnect} className="text-xs text-red-600 px-3">
            Deconectează
          </button>
        )}
      </div>

      {showManual && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
          <Input placeholder="ID extern (phone_number_id / page_id / location_id)" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
          <Input placeholder="Access token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          <Button variant="secondary" onClick={saveManual} disabled={saving || !externalId || !accessToken}>
            {saving ? 'Se salvează...' : 'Salvează canalul'}
          </Button>
        </div>
      )}
    </div>
  )
}

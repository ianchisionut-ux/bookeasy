'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

declare global {
  interface Window {
    FB?: {
      init(options: Record<string, unknown>): void
      login(callback: (response: any) => void, options: Record<string, unknown>): void
    }
    fbAsyncInit?: () => void
  }
}

export default function MetaEmbeddedSignupV4Button({
  appId,
  configId,
  endpoint,
  label = 'Conectează WhatsApp',
}: {
  appId: string
  configId: string
  endpoint: string
  label?: string
}) {
  const router = useRouter()
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!appId || !configId) return
    const initialize = () => {
      window.FB?.init({ appId, cookie: true, xfbml: false, version: 'v21.0' })
      setSdkReady(Boolean(window.FB))
    }
    if (window.FB) {
      initialize()
      return
    }
    window.fbAsyncInit = initialize
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = 'https://connect.facebook.net/ro_RO/sdk.js'
      script.async = true
      script.defer = true
      script.onerror = () => setMessage('SDK-ul Meta nu s-a putut încărca.')
      document.body.appendChild(script)
    }
  }, [appId, configId])

  function startSignup() {
    if (!window.FB || !appId || !configId) return
    setLoading(true)
    setMessage('')

    let sessionData: { waba_id: string; phone_number_id: string } | null = null
    let authorizationCode = ''
    let completed = false

    const cleanup = () => window.removeEventListener('message', listener)
    const finish = async () => {
      if (completed || !sessionData || !authorizationCode) return
      completed = true
      cleanup()
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: authorizationCode,
            wabaId: sessionData.waba_id,
            phoneNumberId: sessionData.phone_number_id,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Conectarea WhatsApp a eșuat.')
        setMessage(`WhatsApp conectat: ${data.phone}`)
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Conectarea WhatsApp a eșuat.')
      } finally {
        setLoading(false)
      }
    }

    const listener = (event: MessageEvent) => {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          sessionData = data.data
          void finish()
        }
      } catch {}
    }

    window.addEventListener('message', listener)
    window.FB.login(
      (response: any) => {
        authorizationCode = response?.authResponse?.code ?? ''
        if (!authorizationCode) {
          cleanup()
          setMessage('Autorizarea WhatsApp a fost anulată.')
          setLoading(false)
          return
        }
        void finish()
      },
      {
        config_id: configId,
        auth_type: 'rerequest',
        response_type: 'code',
        override_default_response_type: true,
        // Embedded Signup v4 preia produsele, activele și permisiunile din
        // configurația creată în Meta. Nu mai trimitem sessionInfoVersion v3.
        extras: { setup: {} },
      }
    )
  }

  const configured = Boolean(appId && configId)
  return (
    <div>
      <Button variant="secondary" onClick={startSignup} disabled={!configured || !sdkReady || loading}>
        {loading ? 'Se deschide Meta...' : label}
      </Button>
      {!configured && <p className="mt-2 text-xs text-amber-700">Configurația Meta Embedded Signup v4 nu este încă activă.</p>}
      {configured && !sdkReady && !message && <p className="mt-2 text-xs text-gray-500">Se încarcă Meta…</p>}
      {message && <p className={`mt-2 text-xs ${message.startsWith('WhatsApp conectat') ? 'text-green-700' : 'text-red-600'}`}>{message}</p>}
    </div>
  )
}

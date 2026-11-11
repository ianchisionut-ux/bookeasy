'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function VerificationForm({ token, initialEmail, deliveryFailed = false }: { token: string; initialEmail: string; deliveryFailed?: boolean }) {
  const [email, setEmail] = useState(initialEmail)
  const [verified, setVerified] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resend, setResend] = useState(!token)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true); setError(''); setMessage('')
    try {
      const response = await fetchWithTimeout(resend ? '/api/auth/resend-verification' : '/api/auth/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resend ? { email } : { token }),
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Încearcă din nou.'); return }
      if (resend) setMessage(data.message)
      else { setVerified(true); window.history.replaceState(null, '', '/verify-email') }
    } catch { setError('Conexiunea a eșuat. Încearcă din nou.') } finally { setLoading(false) }
  }

  return <main className="public-flow-page themed-static-bg min-h-screen flex items-center justify-center px-5 py-10">
    <div className="w-full max-w-md space-y-6">
      <Link href="/" className="block"><Image src="/logo.png" width={156} height={129} alt="Bookeasy" className="mx-auto h-auto" /></Link>
      <Card>
        <h1 className="text-2xl font-semibold mb-3">{verified ? 'Email confirmat' : token && !resend ? 'Confirmă adresa de email' : 'Verifică-ți emailul'}</h1>
        {verified ? <><p className="text-sm text-gray-600 mb-5">Adresa ta este confirmată. Intră în cont pentru a continua configurarea afacerii.</p><div className="public-flow-actions"><Link href="/login" className="btn-primary">Intră în cont</Link></div></> : <>
          <p className="text-sm text-gray-600 mb-5">{token && !resend ? 'Apasă pe buton pentru a confirma că această adresă îți aparține. Linkul este valabil 24 de ore.' : deliveryFailed ? 'Contul este creat, dar emailul nu a putut fi trimis. Cere un email nou mai jos pentru a confirma adresa și a continua.' : 'La înscriere trimitem un link de confirmare. Confirmă adresa înainte de a intra în cont. Verifică și folderul Spam; poți cere un email nou mai jos.'}</p>
          <form onSubmit={submit} className="space-y-4">
            {resend && <div><label htmlFor="verification-email" className="block text-sm mb-1">Adresa de email</label><Input id="verification-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
            <div className="public-flow-actions"><Button type="submit" disabled={loading}>{loading ? 'Se procesează...' : resend ? 'Trimite un email nou' : 'Confirmă emailul'}</Button></div>
          </form>
          {!resend && <div className="public-flow-actions mt-4"><button type="button" onClick={() => { setResend(true); setError('') }} className="text-sm text-[var(--accent-hover)] underline">Link expirat? Cere unul nou</button></div>}
        </>}
      </Card>
      {!verified && <Link href="/login" className="block text-center text-sm text-[var(--accent-hover)] underline">Ai confirmat deja? Intră în cont</Link>}
    </div>
  </main>
}

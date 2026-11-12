'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accountType, setAccountType] = useState<'business' | 'customer'>('business')
  useEffect(() => { if (new URLSearchParams(window.location.search).get('type') === 'customer') setAccountType('customer') }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetchWithTimeout('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accountType }),
      })
      if (!response.ok) throw new Error('Request failed')
      setSent(true)
    } catch {
      setError('Cererea nu a putut fi trimisă. Așteaptă puțin și încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="public-flow-page themed-static-bg min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Link href="/">
          <Image src="/logo.png" alt="bookeasy.ro" width={200} height={133} priority className="w-[160px] h-auto" />
        </Link>

        <Card className="w-full">
          <h1 className="text-lg font-semibold mb-1">Am uitat parola</h1>
          <div className="my-4 flex rounded-full bg-gray-100 p-1" role="group" aria-label="Tipul contului">
            {(['customer', 'business'] as const).map(type => <button key={type} type="button" aria-pressed={accountType === type} onClick={() => { setAccountType(type); setSent(false) }} className={`min-h-10 flex-1 rounded-full px-3 text-sm font-semibold ${accountType === type ? 'bg-white text-[var(--accent-hover)] shadow-sm' : 'text-gray-600'}`}>{type === 'customer' ? 'Client' : 'Business'}</button>)}
          </div>

          {sent ? (
            <div className="mt-3 space-y-3 text-sm text-gray-600">
              <p>Dacă adresa există și emailul poate fi trimis, vei primi un link de resetare. Verifică și folderul Spam.</p>
              <p>Dacă nu ajunge, încearcă din nou mai târziu sau <Link href="/contact" className="underline">contactează-ne</Link>.</p>
              <button type="button" onClick={() => setSent(false)} className="text-[var(--accent-hover)] underline">Cere alt link</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">Introdu emailul contului tău, îți trimitem un link de resetare.</p>
              <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@exemplu.ro" />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Se trimite...' : 'Trimite link de resetare'}
                </Button>
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              </form>
            </>
          )}
        </Card>

        <Link href={accountType === 'customer' ? '/cont' : '/login'} className="text-sm text-gray-500">
          ← Înapoi la login
        </Link>
      </div>
    </main>
  )
}

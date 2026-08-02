'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error?.password?.[0] ?? data.error ?? 'A apărut o eroare.')
      setLoading(false)
      return
    }

    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Contul a fost creat, dar autentificarea automată a eșuat. Încearcă să te loghezi.')
      setLoading(false)
      return
    }

    router.push('/onboarding/step-1')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)] px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={32} height={32} />
          <span className="font-semibold text-lg">bookeasy.ro</span>
        </Link>

        <Card className="w-full">
          <h1 className="text-lg font-semibold mb-1">Creează cont</h1>
          <p className="text-sm text-gray-500 mb-4">Pornim cu contul, apoi configurăm afacerea ta.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Parolă</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Se creează contul...' : 'Creează cont'}
            </Button>
          </form>
        </Card>

        <p className="text-sm text-gray-500">
          Ai deja cont?{' '}
          <Link href="/login" className="text-[var(--accent)] font-medium">
            Intră aici
          </Link>
        </p>
      </div>
    </main>
  )
}

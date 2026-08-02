'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', { email, password, redirect: false })

    if (result?.error) {
      setError('Email sau parolă greșită.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
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
          <h1 className="text-lg font-semibold mb-4">Intră în cont</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Parolă</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Se conectează...' : 'Intră în cont'}
            </Button>
          </form>
        </Card>

        <p className="text-sm text-gray-500">
          Nu ai cont încă?{' '}
          <Link href="/signup" className="text-[var(--accent)] font-medium">
            Creează unul
          </Link>
        </p>
      </div>
    </main>
  )
}

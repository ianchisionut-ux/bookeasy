'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', { email, password, accountType: 'business', redirect: false })
      if (result?.error) {
        setError('Email sau parolă greșită.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Conexiunea a eșuat. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="flex min-h-[100svh] items-center justify-center bg-[var(--surface-muted)] px-5 py-12">
    <section className="w-full max-w-md rounded-3xl border border-[var(--border-soft)] bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-8 text-center">
        <Image src="/logo.png" alt="BookEasy" width={180} height={120} priority className="mx-auto mb-5 h-auto w-[156px]" />
        <h1 className="text-2xl font-semibold tracking-tight text-[#193b3e]">Intră în cont</h1>
        <p className="mt-2 text-sm text-gray-600">Acces pentru afaceri și Super Admin.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div><label htmlFor="login-email" className="mb-1.5 block text-sm text-gray-700">Email</label><Input id="login-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></div>
        <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="login-password" className="text-sm text-gray-700">Parolă</label><Link href="/forgot-password?type=business" className="text-xs font-medium text-[var(--accent-hover)] hover:underline">Ai uitat parola?</Link></div><Input id="login-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></div>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1 w-full">{loading ? 'Se conectează...' : 'Intră în cont'}</Button>
      </form>
      <p className="mt-7 text-center text-xs text-gray-500">Accesul la BookEasy este oferit prin invitație de Super Admin.</p>
      <p className="mt-4 text-center text-xs text-gray-400"><Link href="/termeni-si-conditii" className="hover:underline">Termeni</Link> · <Link href="/politica-de-confidentialitate" className="hover:underline">Confidențialitate</Link></p>
    </section>
  </main>
}

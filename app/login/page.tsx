'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, CalendarCheck2, Check } from 'lucide-react'

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
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.12fr_0.88fr]">
      <section className="relative isolate min-h-[260px] overflow-hidden lg:min-h-screen">
        <Image
          src="/hero-bookeasy.png"
          alt="Calendarul și mesajele BookEasy"
          fill
          priority
          sizes="(min-width: 1024px) 56vw, 100vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/60 to-transparent lg:bg-gradient-to-t lg:from-[#14142b]/75 lg:via-transparent lg:to-white/5" />

        <Link href="/" className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur sm:left-7 sm:top-7">
          <ArrowLeft size={15} /> Înapoi la site
        </Link>

        <div className="relative z-10 hidden h-full min-h-screen items-end p-10 lg:flex xl:p-14">
          <div className="max-w-xl text-white">
            <Image src="/logo.png" alt="bookeasy.ro" width={180} height={120} className="mb-6 h-auto w-[150px] rounded-2xl bg-white/90 px-3 py-1 backdrop-blur" />
            <h2 className="text-4xl font-semibold leading-tight tracking-[-0.035em]">Programările afacerii tale, mereu la îndemână.</h2>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[#b9e188]" /> Calendar unic</span>
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[#b9e188]" /> Echipă sincronizată</span>
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[#b9e188]" /> Notificări automate</span>
            </div>
          </div>
        </div>

        <div className="hero-float login-hero-float hidden xl:flex" aria-hidden="true">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef6e3] text-[#6a9c2b]"><CalendarCheck2 size={18} /></span>
          <span><strong>Programare confirmată</strong><small>Astăzi, 16:30</small></span>
        </div>
        <div className="hero-float hero-social-chat login-instagram-float hidden 2xl:block" aria-hidden="true">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#14142b]">
            <span className="social-logo social-logo-instagram"><i className="instagram-glyph" /></span>
            Instagram
          </div>
          <p className="hero-chat-in">Aveți un loc liber mâine?</p>
          <p className="hero-chat-out hero-chat-instagram">Da, la 11:30. Confirmăm?</p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[var(--surface-muted)] px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Image src="/logo.png" alt="bookeasy.ro" width={170} height={113} priority className="h-auto w-[145px]" />
          </Link>
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-hover)]">Bine ai revenit</p>
            <h1 className="text-3xl font-semibold tracking-tight">Intră în cont</h1>
            <p className="mt-2 text-sm text-gray-500">Accesează calendarul, clienții și programările echipei tale.</p>
          </div>

          <Card className="w-full p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1.5">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm text-gray-600">Parolă</label>
                  <Link href="/forgot-password" className="text-xs font-medium text-[var(--accent-hover)] hover:underline">Ai uitat parola?</Link>
                </div>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>

              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? 'Se conectează...' : 'Intră în cont'}
              </Button>
            </form>
          </Card>

          <p className="mt-6 text-center text-xs text-gray-400">
            Prin autentificare accepți <Link href="/termeni-si-conditii" className="hover:text-gray-700">Termenii</Link> și <Link href="/politica-de-confidentialitate" className="hover:text-gray-700">Politica de confidențialitate</Link>.
          </p>
        </div>
      </section>
    </main>
  )
}

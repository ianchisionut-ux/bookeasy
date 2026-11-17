'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Check } from 'lucide-react'
import MarketplaceHeroVideos from '@/components/marketplace-hero-videos'
import './login.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVideos, setShowVideos] = useState(false)
  const [accountType, setAccountType] = useState<'business' | 'customer'>('business')
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const update = () => setShowVideos(desktop.matches)
    update()
    desktop.addEventListener('change', update)
    return () => desktop.removeEventListener('change', update)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
    const result = await signIn('credentials', { email, password, accountType, redirect: false })

    if (result?.error) {
      if (result.code === 'email_not_verified') {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
        return
      }
      setError('Email sau parolă greșită.')
      setLoading(false)
      return
    }

    router.push('/cont')
    router.refresh()
    } catch {
      setError('Conexiunea a eșuat. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="public-flow-page relative grid min-h-[100svh] bg-[var(--surface-muted)] lg:grid-cols-[1.08fr_0.92fr]">
        <Link href="/" className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur sm:left-7 sm:top-7">
          <ArrowLeft size={15} /> Înapoi la site
        </Link>
      <section className="login-visual relative isolate hidden overflow-hidden lg:flex" aria-label="BookEasy pentru afacerea ta">
        {showVideos ? <MarketplaceHeroVideos /> : <div className="marketplace-hero-slideshow" aria-hidden="true" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#102e32]/95 via-[#153f43]/35 to-[#153f43]/10" />
        <div className="relative z-10 flex min-h-[100svh] w-full items-end justify-center px-10 pb-16 pt-28 xl:px-16 xl:pb-20">
          <div className="w-full max-w-xl text-center text-white">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Mai mult timp pentru ce contează</p>
            <h2 className="text-4xl font-semibold leading-tight tracking-[-0.035em]">Programările afacerii tale, mereu la îndemână.</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/85">
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[var(--brand-green)]" /> Calendar unic</span>
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[var(--brand-green)]" /> Clienți organizați</span>
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[var(--brand-green)]" /> Notificări automate</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-w-0 items-center justify-center px-5 py-20 sm:px-8 lg:px-12 lg:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link href="/" className="mx-auto mb-5 inline-block" aria-label="BookEasy · pagina principală">
              <Image src="/logo.png" alt="bookeasy.ro" width={180} height={120} priority className="h-auto w-[156px]" />
            </Link>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-hover)]">Bine ai revenit</p>
            <h1 className="text-3xl font-semibold tracking-tight">Intră în cont</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">{accountType === 'business' ? 'Accesează calendarul și programările afacerii.' : 'Gestionează programările tale din contul personal.'}</p>
          </div>

          <Card className="w-full p-5 sm:p-6">
            <div className="mb-5 flex rounded-full bg-gray-100 p-1" role="group" aria-label="Tipul contului">
              {(['customer', 'business'] as const).map(type => <button key={type} type="button" aria-pressed={accountType === type} onClick={() => { setAccountType(type); setError('') }} className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold transition ${accountType === type ? 'bg-white text-[var(--accent-hover)] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{type === 'customer' ? 'Utilizator' : 'Business'}</button>)}
            </div>
            <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-email" className="text-sm text-gray-600 block mb-1.5">Email</label>
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm text-gray-600">Parolă</label>
                  <Link href={`/forgot-password?type=${accountType}`} className="text-xs font-medium text-[var(--accent-hover)] hover:underline">Ai uitat parola?</Link>
                </div>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>

              {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? 'Se conectează...' : 'Intră în cont'}
              </Button>
            </form>
            <div className="mt-5 border-t border-[var(--border-soft)] pt-4 text-center text-sm">
              <Link href={accountType === 'customer' ? '/cont' : '/signup'} className="font-semibold text-[var(--accent-hover)] underline">{accountType === 'customer' ? 'Creează cont de utilizator sau continuă cu Google' : 'Creează cont de afacere'}</Link>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-gray-400">
            Prin autentificare accepți <Link href="/termeni-si-conditii" className="hover:text-gray-700">Termenii</Link> și <Link href="/politica-de-confidentialitate" className="hover:text-gray-700">Politica de confidențialitate</Link>.
          </p>
        </div>
      </section>
    </main>
  )
}

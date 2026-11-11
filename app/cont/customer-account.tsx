'use client'

import { useEffect, useRef, useState } from 'react'
import { authDeadline, clearNativeGoogleFlow, isNativeGoogleApp, nativeGoogleStatus, openNativeGoogle, prepareNativeGoogle, readNativeGoogleFlow, type NativeGoogleFlow } from '@/lib/native-google-client'
import { signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, UserRound } from 'lucide-react'
import ClientProfileForm from '@/components/client-profile-form'
import type { ClientProfileData } from '@/lib/client-profile'
import AccountDeletionCard from '@/components/account-deletion-card'

type Props = { email: string | null; name: string | null; googleAccount: boolean; businessSession: boolean; googleAvailable: boolean; oauthError: boolean; profile: ClientProfileData | null; returnTo?: string }

export default function CustomerAccount({ email, name, googleAccount, businessSession, googleAvailable, oauthError, profile, returnTo = '/cont' }: Props) {
  const [register, setRegister] = useState(false)
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [nativeFlow, setNativeFlow] = useState<NativeGoogleFlow | null>(null)
  const [notice, setNotice] = useState('')
  const polling = useRef(false)
  const operation = useRef(0)
  const authenticated = useRef(Boolean(email || businessSession))
  const [error, setError] = useState(oauthError ? 'Conectarea Google nu a reușit. Încearcă din nou.' : '')

  useEffect(() => {
    authenticated.current = Boolean(email || businessSession)
    let active = true
    if (!isNativeGoogleApp() || email || businessSession || !googleAvailable) return
    const saved = readNativeGoogleFlow()
    if (saved) setNativeFlow(saved)
    else void prepareNativeGoogle().then((flow) => { if (active) setNativeFlow(flow) }).catch(() => {})
    return () => { active = false }
  }, [email, businessSession, googleAvailable])

  useEffect(() => {
    let active = true
    async function resume(resetBusy = false) {
      if (document.visibilityState === 'hidden' || polling.current) return
      if (authenticated.current) { clearNativeGoogleFlow(); return }
      // iOS can restore the old page with its previous busy flag still set.
      if (resetBusy) setBusy(false)
      const flow = isNativeGoogleApp() ? readNativeGoogleFlow() : null
      if (!flow?.started || polling.current) return
      polling.current = true
      let attempt = operation.current
      try {
        const state = await nativeGoogleStatus(flow)
        if (!active || attempt !== operation.current) return
        if (state.expired) {
          clearNativeGoogleFlow(flow.id)
          setNativeFlow(null)
          setNotice('')
          setError('Conectarea Google a expirat. Încearcă din nou.')
        } else if (state.ready && readNativeGoogleFlow()?.id === flow.id) {
          attempt = ++operation.current
          setBusy(true)
          const result = await authDeadline(signIn('credentials', { nativeFlowId: flow.id, nativeVerifier: flow.verifier, accountType: 'customer', redirect: false }))
          if (!active || attempt !== operation.current) return
          if (!result || result.error) throw new Error('Conectarea Google nu a putut fi preluată. Încearcă din nou.')
          clearNativeGoogleFlow(flow.id)
          window.location.assign(returnTo)
        } else setNotice('Finalizează conectarea Google, apoi revino în aplicație.')
      } catch (error) {
        if (active && attempt === operation.current) setError(error instanceof Error ? error.message : 'Conexiunea a fost întreruptă. Încearcă din nou.')
      } finally {
        polling.current = false
        if (active && attempt === operation.current) setBusy(false)
      }
    }
    const onReturn = () => { void resume(true) }
    window.addEventListener('pageshow', onReturn)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    const timer = window.setInterval(() => { if (readNativeGoogleFlow()?.started) void resume() }, 3000)
    void resume(true)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('pageshow', onReturn)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [returnTo])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (register && password !== confirm) { setError('Parolele nu coincid.'); return }
    const attempt = ++operation.current
    clearNativeGoogleFlow()
    setNativeFlow(null)
    setNotice('')
    setBusy(true)
    try {
      if (register) {
        const response = await fetch('/api/auth/customer/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password }) })
        const data = await response.json()
        if (!response.ok) { setError(data.error || 'Contul nu a putut fi creat.'); return }
      }
      const result = await authDeadline(signIn('credentials', { email: address, password, accountType: 'customer', redirect: false }))
      if (attempt !== operation.current) return
      if (!result || result.error) {
        if (result?.code === 'email_not_verified') {
          window.location.assign(`/verify-email?email=${encodeURIComponent(address.trim().toLowerCase())}`)
          return
        }
        setError(register ? 'Contul a fost creat. Autentifică-te cu emailul și parola alese.' : 'Email sau parolă incorectă.')
        if (register) setRegister(false)
        return
      }
      setPassword('')
      setConfirm('')
      window.location.assign(returnTo === '/fitness' ? '/cont?next=/fitness' : '/cont')
    } catch {
      setError('Conexiunea a fost întreruptă. Încearcă din nou.')
    } finally { setBusy(false) }
  }

  async function googleLogin() {
    const attempt = ++operation.current
    setBusy(true)
    setError('')
    try {
      if (isNativeGoogleApp()) {
        const flow = readNativeGoogleFlow() || await prepareNativeGoogle()
        if (attempt !== operation.current) return
        if (flow.expiresAt <= Date.now()) { clearNativeGoogleFlow(); throw new Error('Conectarea a expirat. Apasă din nou pe Google.') }
        setNativeFlow({ ...flow, started: true })
        openNativeGoogle(flow)
        setNotice('Finalizează conectarea Google, apoi revino în aplicație.')
      } else {
        const result = await authDeadline(signIn('google', { callbackUrl: returnTo, redirect: false }))
        if (attempt !== operation.current) return
        if (!result?.url || result.error) throw new Error('Conectarea Google nu a putut fi pornită.')
        window.location.assign(result.url)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Conectarea Google nu a putut fi pornită.')
    } finally { if (attempt === operation.current) setBusy(false) }
  }

  if (email) return (
    <section className="card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-hover)]"><UserRound size={24} /></span>
        <div className="min-w-0"><h2 className="font-semibold">{name || 'Bine ai revenit!'}</h2><p className="break-all text-sm text-gray-600">{email}</p></div>
      </div>
      <p className="mb-5 text-sm text-gray-600">{googleAccount ? 'Ești conectat cu Google. Folosește acest cont la rezervare pentru recenzii verificate după vizită.' : 'Ești conectat cu email și parolă. Alege o afacere și rezervă serviciul dorit.'}</p>
      {profile && <ClientProfileForm profile={profile} />}
      <Link href="/descopera" className="btn-primary flex min-h-11 items-center justify-center">Descoperă și rezervă</Link>
      <button type="button" onClick={() => signOut({ callbackUrl: '/cont' })} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 text-sm text-gray-600"><LogOut size={17} /> Deconectare</button>
      <AccountDeletionCard kind="customer" accountName={email} />
    </section>
  )

  if (businessSession) return (
    <section className="card space-y-4 p-6">
      <p className="text-sm text-gray-600">Ești conectat la contul unei afaceri. Pentru a folosi contul personal, deconectează-te mai întâi.</p>
      <Link href="/dashboard" className="btn-primary flex min-h-11 w-full items-center justify-center">Deschide afacerea</Link>
      <button type="button" onClick={() => signOut({ callbackUrl: '/cont' })} className="btn-secondary min-h-11 w-full">Deconectare</button>
    </section>
  )

  return (
    <section className="card p-5 sm:p-6">
      {googleAvailable && <button type="button" disabled={busy} onClick={googleLogin} className="btn-secondary mb-5 min-h-12 w-full disabled:opacity-60">Continuă cu Google</button>}
      {notice && <div role="status" className="mb-4 text-sm text-teal-800"><p>{notice}</p>{nativeFlow && <a href={`/api/auth/native/login?flow=${encodeURIComponent(nativeFlow.id)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">Deschide Google</a>}</div>}
      <div className="mb-5 flex rounded-xl bg-gray-100 p-1" aria-label="Alege autentificare sau înregistrare">
        {[false, true].map((value) => <button key={String(value)} type="button" disabled={busy} aria-pressed={register === value} onClick={() => { setRegister(value); setError(''); setConfirm('') }} className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold ${register === value ? 'bg-white text-[var(--accent-hover)] shadow-sm' : 'text-gray-600'}`}>{value ? 'Creează cont' : 'Autentificare'}</button>)}
      </div>
      <form method="post" onSubmit={submit} className="space-y-4">
        {register && <p className="text-sm text-gray-600">Creezi un cont personal pentru programări. Pentru administrarea unei afaceri, alege „Creează un cont de afacere”.</p>}
        <div><label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="customer-email" className="input-field w-full" type="email" autoComplete="email" maxLength={254} required value={address} disabled={busy} onChange={(event) => setAddress(event.target.value)} /></div>
        <div><label htmlFor="customer-password" className="mb-1.5 block text-sm font-medium">Parolă</label><input id="customer-password" className="input-field w-full" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={72} required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />{register && <p className="mt-1 text-xs text-gray-500">Cel puțin 8 caractere.</p>}</div>
        {register && <div><label htmlFor="customer-confirm" className="mb-1.5 block text-sm font-medium">Confirmă parola</label><input id="customer-confirm" className="input-field w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirm} disabled={busy} onChange={(event) => setConfirm(event.target.value)} /></div>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary min-h-12 w-full disabled:opacity-60">{busy ? 'Se procesează...' : register ? 'Creează contul' : 'Intră în cont'}</button>
        {!register && <Link href="/forgot-password?type=customer" className="block text-center text-sm text-[var(--accent-hover)] hover:underline">Ai uitat parola?</Link>}
      </form>
      <div className="mt-5 border-t border-[var(--border-soft)] pt-4 text-center"><Link href="/signup" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--accent-hover)] underline">Creează un cont de afacere</Link></div>
      <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">Prin continuare accepți <Link href="/termeni-si-conditii" className="underline">Termenii</Link> și <Link href="/politica-de-confidentialitate" className="underline">Politica de confidențialitate</Link>.</p>
      <Link href="/stergere-cont" className="mt-3 block py-2 text-center text-xs text-gray-600 underline">Ștergerea unui cont existent și a datelor</Link>
    </section>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, UserRound } from 'lucide-react'
import ClientProfileForm from '@/components/client-profile-form'
import type { ClientProfileData } from '@/lib/client-profile'

type Props = { email: string | null; name: string | null; googleAccount: boolean; businessSession: boolean; googleAvailable: boolean; oauthError: boolean; profile: ClientProfileData | null }

export default function CustomerAccount({ email, name, googleAccount, businessSession, googleAvailable, oauthError, profile }: Props) {
  const router = useRouter()
  const [register, setRegister] = useState(false)
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(oauthError ? 'Conectarea Google nu a reușit. Încearcă din nou.' : '')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (register && password !== confirm) { setError('Parolele nu coincid.'); return }
    setBusy(true)
    try {
      if (register) {
        const response = await fetch('/api/auth/customer/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password }) })
        const data = await response.json()
        if (!response.ok) { setError(data.error || 'Contul nu a putut fi creat.'); return }
      }
      const result = await signIn('credentials', { email: address, password, accountType: 'customer', redirect: false })
      if (!result || result.error) {
        setError(register ? 'Contul a fost creat. Autentifică-te cu emailul și parola alese.' : 'Email sau parolă incorectă pentru contul de client.')
        if (register) setRegister(false)
        return
      }
      setPassword('')
      setConfirm('')
      router.refresh()
    } catch {
      setError('Conexiunea a fost întreruptă. Încearcă din nou.')
    } finally { setBusy(false) }
  }

  async function googleLogin() {
    setBusy(true)
    setError('')
    try { await signIn('google', { callbackUrl: '/cont' }) }
    catch { setError('Conectarea Google nu a putut fi pornită.'); setBusy(false) }
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
    </section>
  )

  if (businessSession) return (
    <section className="card space-y-4 p-6">
      <p className="text-sm text-gray-600">Ești conectat la contul unei afaceri. Pentru a folosi contul personal, deconectează-te mai întâi.</p>
      <Link href="/dashboard" className="btn-primary flex min-h-11 items-center justify-center">Deschide afacerea</Link>
      <button type="button" onClick={() => signOut({ callbackUrl: '/cont' })} className="btn-secondary min-h-11 w-full">Deconectare</button>
    </section>
  )

  return (
    <section className="card p-5 sm:p-6">
      {googleAvailable && <button type="button" disabled={busy} onClick={googleLogin} className="btn-secondary mb-5 min-h-12 w-full disabled:opacity-60">Continuă cu Google</button>}
      <div className="mb-5 flex rounded-xl bg-gray-100 p-1" aria-label="Alege autentificare sau înregistrare">
        {[false, true].map((value) => <button key={String(value)} type="button" disabled={busy} aria-pressed={register === value} onClick={() => { setRegister(value); setError(''); setConfirm('') }} className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold ${register === value ? 'bg-white text-[var(--accent-hover)] shadow-sm' : 'text-gray-600'}`}>{value ? 'Creează cont' : 'Autentificare'}</button>)}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="customer-email" className="input-field w-full" type="email" autoComplete="email" maxLength={254} required value={address} disabled={busy} onChange={(event) => setAddress(event.target.value)} /></div>
        <div><label htmlFor="customer-password" className="mb-1.5 block text-sm font-medium">Parolă</label><input id="customer-password" className="input-field w-full" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={72} required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />{register && <p className="mt-1 text-xs text-gray-500">Cel puțin 8 caractere.</p>}</div>
        {register && <div><label htmlFor="customer-confirm" className="mb-1.5 block text-sm font-medium">Confirmă parola</label><input id="customer-confirm" className="input-field w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirm} disabled={busy} onChange={(event) => setConfirm(event.target.value)} /></div>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary min-h-12 w-full disabled:opacity-60">{busy ? 'Se procesează...' : register ? 'Creează contul' : 'Intră în cont'}</button>
        {!register && <Link href="/forgot-password" className="block text-center text-sm text-[var(--accent-hover)] hover:underline">Ai uitat parola?</Link>}
      </form>
      <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">Prin continuare accepți <Link href="/termeni-si-conditii" className="underline">Termenii</Link> și <Link href="/politica-de-confidentialitate" className="underline">Politica de confidențialitate</Link>.</p>
      <Link href="/login" className="mt-5 block border-t border-gray-100 pt-4 text-center text-xs text-gray-500 hover:underline">Administrezi o afacere? Intră aici</Link>
    </section>
  )
}

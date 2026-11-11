'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dumbbell, ShieldCheck } from 'lucide-react'
import CustomerAccount from '@/app/cont/customer-account'
import type { ComponentProps } from 'react'
import '@/components/fitness/fitness.css'

export default function FitnessActivation({ authenticated, loginProps }: { authenticated: boolean; loginProps: ComponentProps<typeof CustomerAccount> }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  useEffect(() => {
    const value = window.location.hash.slice(1)
    setToken(/^[a-f0-9]{64}$/.test(value) ? value : '')
  }, [])
  async function activate() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/customer/fitness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', token }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Conectarea nu a reușit.')
      window.history.replaceState(null, '', '/fitness/activare')
      router.replace('/fitness'); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Verifică conexiunea și încearcă din nou.'); setBusy(false) }
  }
  return <main className="fitness-client-page max-w-lg"><p className="fitness-eyebrow"><Dumbbell size={15} />BookEasy Fitness</p><h1 className="text-3xl font-extrabold tracking-tight mt-4">Un loc pentru obiectivele tale.</h1><p className="fitness-subtitle mb-6">Conectează-te cu instructorul tău și primește antrenamentele, planul de nutriție și sarcinile zilnice.</p>{error && <p className="fitness-error" role="alert">{error}</p>}{!token ? <section className="fitness-client-section"><p className="text-sm">Deschide linkul complet primit de la instructor. Dacă a expirat, cere o invitație nouă.</p><Link href="/cont" className="fitness-text-button">Contul meu</Link></section> : authenticated ? <section className="fitness-client-section"><ShieldCheck className="text-[var(--brand-teal-dark)] mb-3" size={30} /><h2 className="font-bold">Confirmă conectarea cu instructorul</h2><p className="fitness-subtitle">Prin confirmare, acest cont personal primește acces la fișa, planurile și sarcinile asociate invitației. Folosește doar o invitație primită pentru tine.</p><button className="btn-primary w-full mt-5" disabled={busy} onClick={() => void activate()}>{busy ? 'Se conectează…' : 'Activează programul meu'}</button></section> : <CustomerAccount {...loginProps} returnTo={`/fitness/activare#${token}`} />}</main>
}

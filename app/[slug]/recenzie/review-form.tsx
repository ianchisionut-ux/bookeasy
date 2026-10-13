'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CustomerGoogleAccount from '@/components/customer-google-account'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import Link from 'next/link'
import ClientPageLinks from '@/components/client-page-links'

type EligibleBooking = { id: string; serviceName: string; date: string }

type Step = 'CHECKING' | 'PICK' | 'RATE' | 'EMPTY' | 'DONE'

export default function ReviewForm({ slug, googleEmail, googleAvailable }: { slug: string; googleEmail: string | null; googleAvailable: boolean }) {
  const [step, setStep] = useState<Step>('CHECKING')
  const [bookings, setBookings] = useState<EligibleBooking[]>([])
  const [selected, setSelected] = useState<EligibleBooking | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!googleEmail) return
    let active = true
    async function lookup() {
      try {
        const res = await fetchWithTimeout(`/api/public/reviews?slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        if (!active) return
        if (!res.ok) {
          setError(data.error ?? 'Nu am putut încărca rezervările.')
          setStep('EMPTY')
          return
        }
        const found = data.bookings as EligibleBooking[]
        setBookings(found)
        if (found.length === 0) setStep('EMPTY')
        else if (found.length === 1) {
          setSelected(found[0])
          setStep('RATE')
        } else setStep('PICK')
      } catch {
        if (active) {
          setError('Conexiune eșuată. Reîncarcă pagina și încearcă din nou.')
          setStep('EMPTY')
        }
      }
    }
    void lookup()
    return () => { active = false }
  }, [googleEmail, slug])

  async function submit() {
    if (!selected) return
    setError('')
    setLoading(true)
    try {
      const res = await fetchWithTimeout('/api/public/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selected.id, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setStep('DONE')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  if (!googleEmail) return (
    <Card>
      <p className="mb-4 text-sm leading-relaxed text-gray-600">Conectează-te cu același cont Google folosit la rezervare. Poți publica o recenzie după încheierea unei programări confirmate sau finalizate.</p>
      <CustomerGoogleAccount email={null} available={googleAvailable} returnTo={`/${slug}/recenzie`} />
    </Card>
  )

  if (step === 'DONE') return <Card><p className="text-sm text-green-700">Mulțumim! Recenzia ta verificată a fost publicată.</p><ClientPageLinks businessSlug={slug} className="mt-5" /></Card>

  return (
    <div className="space-y-4">
      <CustomerGoogleAccount email={googleEmail} available={googleAvailable} returnTo={`/${slug}/recenzie`} />
      {step === 'CHECKING' && <Card><p className="text-sm text-gray-600" role="status">Căutăm programările eligibile...</p></Card>}
      {step === 'EMPTY' && <Card>
        <p className="text-sm text-gray-700">{error || 'Nu ai încă o programare eligibilă pentru recenzie la această afacere.'}</p>
        {!error && <p className="mt-2 text-sm text-gray-500">Sunt eligibile programările create cu acest cont Google, confirmate sau finalizate, după încheierea lor. Fiecare programare poate primi o singură recenzie.</p>}
        <Link href={`/${slug}/rezerva`} className="btn-primary mt-4 inline-flex min-h-11 items-center">Fă o rezervare</Link>
      </Card>}
      {step === 'PICK' && <Card>
        <p className="mb-3 text-sm text-gray-500">Pentru care programare lași recenzia?</p>
        <div className="flex flex-col gap-2">
          {bookings.map((b) => <button key={b.id} type="button" onClick={() => { setSelected(b); setStep('RATE') }} className="card card-interactive p-3 text-left">
            <p className="font-medium">{b.serviceName}</p>
            <p className="text-xs text-gray-500">{new Date(b.date).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}</p>
          </button>)}
        </div>
      </Card>}
      {step === 'RATE' && selected && <Card>
        <p className="mb-1 text-sm text-gray-500">Recenzie pentru</p>
        <p className="mb-4 font-medium">{selected.serviceName} · {new Date(selected.date).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}</p>
        <div className="mb-4 flex gap-1" role="group" aria-label="Evaluare">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} className="min-h-11 min-w-11 text-3xl leading-none" style={{ color: n <= rating ? '#eab308' : '#d1d5db' }} aria-label={`${n} stele`} aria-pressed={rating === n}>★</button>)}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Scrie câteva cuvinte (opțional)..." className="input-field mb-3 min-h-[100px] w-full" maxLength={1000} aria-label="Comentariu" />
        {error && <p className="mb-2 text-sm text-red-600" role="alert">{error}</p>}
        <Button onClick={submit} disabled={loading}>{loading ? 'Se trimite...' : 'Trimite recenzia'}</Button>
        {bookings.length > 1 && <button type="button" disabled={loading} onClick={() => { setSelected(null); setError(''); setStep('PICK') }} className="btn-secondary mt-3 min-h-11">Alege altă programare</button>}
      </Card>}
    </div>
  )
}

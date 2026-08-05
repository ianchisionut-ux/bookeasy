'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Review = {
  id: string
  authorName: string
  rating: number
  comment: string | null
  reply: string | null
  createdAt: string
  verified: boolean
}

function ReplyBox({ review }: { review: Review }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(review.reply ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(review.reply)

  async function save() {
    setSaving(true)
    try {
      const res = await fetchWithTimeout(`/api/business/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text || null }),
      })
      if (res.ok) {
        setSaved(text || null)
        setEditing(false)
      } else {
        alert('Nu am putut salva răspunsul.')
      }
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="mt-2">
        {saved && (
          <div className="pl-3 border-l-2 border-[var(--border-soft)] mb-2">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Răspunsul tău</p>
            <p className="text-sm text-gray-600">{saved}</p>
          </div>
        )}
        <button onClick={() => setEditing(true)} className="text-xs text-[var(--accent)] font-medium">
          {saved ? 'Editează răspunsul' : '+ Răspunde'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Scrie un răspuns public..."
        className="input-field w-full min-h-[70px] text-sm mb-2"
        maxLength={1000}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-secondary text-xs py-1.5 px-3">
          {saving ? 'Se salvează...' : 'Salvează'}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500">
          Anulează
        </button>
      </div>
    </div>
  )
}

export default function ReviewsManager({
  rating,
  reviewCount,
  reviews,
}: {
  rating: number | null
  reviewCount: number
  reviews: Review[]
}) {
  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Recenzii</h1>
      <p className="text-sm text-gray-500 mb-6">
        {rating ? `★ ${rating.toFixed(1)} · ${reviewCount} recenzii` : 'Nicio recenzie încă'}
      </p>

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium">
                {r.authorName}
                {r.verified && <span className="ml-2 text-xs text-green-700 font-normal">✓ client verificat</span>}
              </p>
              <p className="text-sm" style={{ color: '#eab308' }}>
                {'★'.repeat(r.rating)}
                <span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span>
              </p>
            </div>
            {r.comment && <p className="text-sm text-gray-600 mb-1">{r.comment}</p>}
            <p className="text-xs text-gray-400">
              {new Date(r.createdAt).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}
            </p>
            <ReplyBox review={r} />
          </Card>
        ))}
        {reviews.length === 0 && <p className="text-sm text-gray-500">Nicio recenzie încă.</p>}
      </div>
    </div>
  )
}

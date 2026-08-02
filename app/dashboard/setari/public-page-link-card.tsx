'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'

export function PublicPageLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : `/${slug}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <h2 className="font-medium mb-1">Pagina ta publică</h2>
      <p className="text-sm text-gray-500 mb-3">Link-ul pe care îl trimiți clienților sau îl pui pe rețele sociale.</p>
      <div className="flex items-center gap-2">
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="input-field flex-1 truncate text-[var(--accent)]">
          bookeasy.ro/{slug}
        </a>
        <button onClick={copy} className="btn-secondary text-sm whitespace-nowrap">
          {copied ? 'Copiat!' : 'Copiază'}
        </button>
      </div>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BusinessRowActions({
  businessId,
  publicListed,
}: {
  businessId: string
  publicListed: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    try {
      await fetch(`/api/superadmin/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicListed: !publicListed }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={toggle} disabled={loading} className="text-xs text-[var(--accent)] font-medium">
      {publicListed ? 'Ascunde' : 'Afișează'}
    </button>
  )
}

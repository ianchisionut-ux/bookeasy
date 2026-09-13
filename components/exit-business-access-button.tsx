'use client'

import { useState } from 'react'

export function ExitBusinessAccessButton() {
  const [loading, setLoading] = useState(false)

  async function exit() {
    setLoading(true)
    try {
      const response = await fetch('/api/superadmin/businesses/current/access', { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      window.location.assign(response.ok ? (data.redirectTo ?? '/superadmin/afaceri') : '/superadmin')
    } finally {
      setLoading(false)
    }
  }

  return <button type="button" onClick={exit} disabled={loading} className="font-semibold underline disabled:opacity-60">{loading ? 'Se închide…' : 'Ieși din business'}</button>
}

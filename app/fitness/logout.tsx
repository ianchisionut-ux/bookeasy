'use client'
import { useState } from 'react'
export default function FitnessLogout() {
  const [error, setError] = useState('')
  return <><button className="text-sm underline" onClick={async () => {
    try { const r = await fetch('/api/fitness/session', { method: 'DELETE' }); if (!r.ok) throw new Error(); window.location.replace('/fitness') }
    catch { setError('Deconectarea a eșuat. Încearcă din nou.') }
  }}>Deconectare</button>{error && <p role="alert">{error}</p>}</>
}

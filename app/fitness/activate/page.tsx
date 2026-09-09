'use client'
import { useEffect, useState } from 'react'
export default function Activate() {
  const [token, setToken] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    setToken(window.location.hash.slice(1))
    window.history.replaceState(null, '', window.location.pathname)
  }, [])
  return <div className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-xl font-semibold">Activează accesul tău FitEasy</h1>
    <p>Linkul este personal și poate fi folosit o singură dată. Vei rămâne conectat până la 30 de zile pe acest dispozitiv. Nu activa accesul pe un dispozitiv public.</p>
    <button disabled={busy || !token} className="rounded-full bg-[#14142b] px-5 py-3 text-white disabled:opacity-50" onClick={async () => {
      setBusy(true); setError('')
      try {
        const r = await fetch('/api/fitness/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        const d = await r.json(); if (!r.ok) throw new Error(d.error)
        window.location.replace('/fitness')
      } catch (e) { setError(e instanceof Error ? e.message : 'Conectarea a eșuat.') }
      finally { setBusy(false) }
    }}>Intră în contul meu</button>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {!token && <p>Deschide linkul complet primit de la instructor.</p>}
  </div>
}

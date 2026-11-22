'use client'

import { useState } from 'react'

export default function SmsApiConnectionTest() {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ accepted: boolean; message: string } | null>(null)

  async function runTest() {
    setPending(true)
    setResult(null)
    try {
      const response = await fetch('/api/superadmin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-smsapi' }),
      })
      const data = await response.json()
      setResult({
        accepted: response.ok && data.status === 'accepted',
        message: data.message || 'Testul nu a putut fi efectuat.',
      })
    } catch {
      setResult({ accepted: false, message: 'Testul nu a putut fi efectuat.' })
    } finally {
      setPending(false)
    }
  }

  return <section className="card space-y-3 p-4 sm:p-6" aria-labelledby="smsapi-test-heading">
    <h2 id="smsapi-test-heading" className="text-lg font-semibold">Verifică SMSAPI fără trimitere</h2>
    <p className="text-sm text-gray-600">Verifică dacă SMSAPI acceptă tokenul și expeditorul configurat. Testul folosește un număr fictiv și nu consumă credite.</p>
    <button type="button" className="btn-secondary min-h-11" disabled={pending} onClick={() => void runTest()}>
      {pending ? 'Se verifică…' : 'Testează conexiunea SMSAPI'}
    </button>
    {result && <p role={result.accepted ? 'status' : 'alert'} className={result.accepted ? 'text-sm text-teal-800' : 'text-sm text-red-700'}>{result.message}</p>}
  </section>
}

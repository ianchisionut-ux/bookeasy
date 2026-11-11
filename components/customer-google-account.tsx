'use client'

import { signIn, signOut } from 'next-auth/react'

export default function CustomerGoogleAccount({ email, available, returnTo }: { email: string | null; available: boolean; returnTo: string }) {
  if (email) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
        <span>Conectat cu Google: <strong>{email}</strong></span>
        <button type="button" onClick={() => signOut({ callbackUrl: returnTo })} className="font-medium text-teal-800 underline underline-offset-2">Schimbă contul</button>
      </div>
    )
  }

  if (!available) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Conectarea Google nu este disponibilă momentan. Revino mai târziu pentru recenzii verificate.</p>

  return (
    <button type="button" onClick={() => signIn('google', { callbackUrl: returnTo })} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-gray-50">
      Continuă cu Google
    </button>
  )
}

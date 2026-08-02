'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton({ className = '' }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className={`px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-white hover:shadow-sm transition text-left ${className}`}
    >
      Deconectare
    </button>
  )
}

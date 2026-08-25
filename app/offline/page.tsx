import Link from 'next/link'
import Image from 'next/image'

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--surface-muted)]">
      <div className="card max-w-md w-full p-7 text-center">
        <Image src="/icon-192.png" width={72} height={72} alt="BookEasy" className="mx-auto rounded-2xl mb-4" />
        <h1 className="text-xl font-semibold mb-2">Nu există conexiune la internet</h1>
        <p className="text-sm text-gray-500 mb-5">BookEasy nu păstrează offline programări sau date despre clienți, pentru siguranța informațiilor. Reconectează-te și încearcă din nou.</p>
        <Link href="/dashboard" className="btn-primary inline-flex">Încearcă din nou</Link>
      </div>
    </main>
  )
}

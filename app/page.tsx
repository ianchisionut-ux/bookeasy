import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center">
      <Image src="/logo.png" alt="bookeasy.ro" width={280} height={187} priority />

      <div className="max-w-lg flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Rezervări automate pe WhatsApp, Instagram și Facebook</h1>
        <p className="text-gray-600">
          Pentru saloane și spații de evenimente. Botul preia rezervările, tu vezi totul într-un
          singur calendar.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/harta" className="btn-primary">
          Descoperă afaceri
        </Link>
        <Link href="/dashboard" className="btn-secondary">
          Intră în cont
        </Link>
      </div>
    </main>
  )
}

import Image from 'next/image'
import Link from 'next/link'
import MapClient from './harta/map-client'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 sm:gap-8 px-4 sm:px-6 text-center py-10">
        <Image src="/logo.png" alt="bookeasy.ro" width={280} height={187} priority className="w-[200px] sm:w-[280px] h-auto" />

        <div className="max-w-lg flex flex-col gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Rezervări automate pe WhatsApp, Instagram și Facebook</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Pentru saloane și spații de evenimente. Botul preia rezervările, tu vezi totul într-un
            singur calendar.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto px-6 sm:px-0">
          <Link href="/harta" className="btn-primary">
            Descoperă afaceri
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Intră în cont
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pb-10">
        <h2 className="text-lg font-semibold mb-1 text-center">Afaceri pe bookeasy.ro</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">Descoperă saloane și spații de evenimente lângă tine</p>
        <MapClient />
      </div>
    </main>
  )
}

import MapClient from './map-client'
import { PublicHeader } from '@/components/ui/public-header'

export default function HartaPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <PublicHeader />
      <div className="px-6 py-4 border-b border-[var(--border-soft)] bg-white">
        <h1 className="text-xl font-semibold">Harta afacerilor cu rezervari online</h1>
        <p className="text-sm text-gray-500">Gaseste servicii in apropiere si verifica orele disponibile.</p>
      </div>
      <MapClient />
    </main>
  )
}

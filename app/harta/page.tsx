import MapClient from './map-client'
import { PublicHeader } from '@/components/ui/public-header'
import { publicMetadata } from '@/lib/seo'

export const metadata = publicMetadata('Hartă — afaceri și servicii aproape de tine', 'Găsește saloane, clinici și alte afaceri pe hartă. Vezi profilurile, recenziile și opțiunile de rezervare online.', '/harta')

export default function HartaPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <PublicHeader />
      <div className="px-6 py-4 border-b border-[var(--border-soft)] bg-white">
        <h1 className="text-xl font-semibold">Afaceri pe bookeasy.ro</h1>
        <p className="text-sm text-gray-500">Explorează afacerile din apropiere și rezervă direct</p>
      </div>
      <MapClient />
    </main>
  )
}

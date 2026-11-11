import Link from 'next/link'
import { PublicHeader } from '@/components/ui/public-header'

export default function BusinessNotFound() {
  return <div className="themed-static-bg min-h-screen"><PublicHeader /><main className="mx-auto max-w-lg px-5 py-16"><div className="card p-6"><h1 className="text-2xl font-semibold">Pagina nu este disponibilă</h1><p className="mt-3 text-sm text-gray-500">Verifică adresa sau revino mai târziu. Dacă administrezi această afacere, intră în cont pentru a verifica publicarea paginii.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/dashboard/setari" className="btn-primary">Intră în cont</Link><Link href="/descopera" className="btn-secondary">Descoperă afaceri</Link></div></div></main></div>
}

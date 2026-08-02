import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { CardInteractive } from '@/components/ui/card'

export default async function ServiciiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const services = await prisma.service.findMany({ where: { businessId }, orderBy: { name: 'asc' } })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-1">Servicii</h1>
      <p className="text-sm text-gray-500 mb-6">{services.length} servicii active</p>

      <div className="grid grid-cols-2 gap-3 max-w-3xl">
        {services.map((s) => (
          <CardInteractive key={s.id} className="flex items-center justify-between">
            <span className="font-medium">{s.name}</span>
            <div className="text-right text-sm text-gray-500">
              <p>{s.durationMin ? `${s.durationMin} min` : '—'}</p>
              <p className="font-medium text-gray-900">{s.price ? `${s.price} lei` : '—'}</p>
            </div>
          </CardInteractive>
        ))}
      </div>
    </div>
  )
}

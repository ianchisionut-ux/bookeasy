import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export default async function ServiciiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const services = await prisma.service.findMany({ where: { businessId }, orderBy: { name: 'asc' } })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Servicii</h1>
      <div className="flex flex-col gap-2">
        {services.map((s) => (
          <div key={s.id} className="border rounded-lg px-4 py-3 flex justify-between text-sm">
            <span>{s.name}</span>
            <span className="text-gray-500">{s.durationMin ? `${s.durationMin} min` : '—'}</span>
            <span>{s.price ? `${s.price} lei` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

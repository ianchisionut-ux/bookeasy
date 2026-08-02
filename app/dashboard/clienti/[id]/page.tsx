import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CustomerNotes from './customer-notes'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: { bookings: { include: { service: true }, orderBy: { startAt: 'desc' } } },
  })

  if (!customer) notFound()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{customer.name ?? 'Fără nume'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {customer.phone} {customer.email ? `· ${customer.email}` : ''}
      </p>

      <CustomerNotes customerId={customer.id} initialNotes={customer.notes ?? ''} />

      <h2 className="text-lg font-medium mb-3 mt-8">Istoric rezervări</h2>
      <div className="flex flex-col gap-2">
        {customer.bookings.map((b) => (
          <div key={b.id} className="border rounded-lg px-4 py-3 flex justify-between text-sm">
            <span>{b.service.name}</span>
            <span className="text-gray-500">{b.startAt.toLocaleString('ro-RO')}</span>
            <span>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

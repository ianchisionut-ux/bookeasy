import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CustomerNotes from './customer-notes'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { BackLink } from '@/components/ui/back-link'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { bookings: { include: { service: true }, orderBy: { startAt: 'desc' } } },
  })

  if (!customer) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-4">
        <BackLink href="/dashboard/clienti" label="Înapoi la clienți" />
      </div>

      <h1 className="text-2xl font-semibold mb-1">{customer.name ?? 'Fără nume'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {customer.phone} {customer.email ? `· ${customer.email}` : ''}
      </p>

      <Card>
        <CustomerNotes customerId={customer.id} initialNotes={customer.notes ?? ''} />
      </Card>

      <h2 className="text-lg font-medium mb-3 mt-8">Istoric rezervări</h2>
      <div className="flex flex-col gap-2">
        {customer.bookings.map((b) => (
          <Card key={b.id} className="flex items-center justify-between py-3">
            <span className="font-medium">{b.service.name}</span>
            <span className="text-gray-500 text-sm">{b.startAt.toLocaleString('ro-RO')}</span>
            <Pill tone={b.status === 'CONFIRMED' ? 'success' : b.status === 'CANCELLED' ? 'danger' : 'neutral'}>
              {b.status}
            </Pill>
          </Card>
        ))}
        {customer.bookings.length === 0 && <p className="text-sm text-gray-500">Nicio rezervare încă.</p>}
      </div>
    </div>
  )
}

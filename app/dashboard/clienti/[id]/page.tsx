import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CustomerEditForm from './customer-edit-form'
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
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="mb-4">
        <BackLink href="/dashboard/clienti" label="Înapoi la clienți" />
      </div>

      <h1 className="text-2xl font-semibold mb-6">{customer.name ?? 'Fără nume'}</h1>

      <Card className="mb-8">
        <h2 className="font-medium mb-4">Date client</h2>
        <CustomerEditForm
          customerId={customer.id}
          initial={{
            name: customer.name ?? '',
            phone: customer.phone,
            email: customer.email ?? '',
            notes: customer.notes ?? '',
          }}
        />
      </Card>

      <h2 className="text-lg font-medium mb-3">Istoric rezervări</h2>
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

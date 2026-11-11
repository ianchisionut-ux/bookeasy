import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import AddCustomerForm from './add-customer-form'
import RestoreCustomerButton from './restore-customer-button'
import { PrintButton } from '@/components/print-button'
import { bookingTerminology, isPatientCategory } from '@/lib/business-categories'

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>
}) {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''
  const { q, archived } = await searchParams
  const query = q?.trim() ?? ''
  const showingArchived = archived === '1'

  const [customers, business] = await Promise.all([
    prisma.customer.findMany({
      where: {
        businessId,
        archivedAt: showingArchived ? { not: null } : null,
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      include: { _count: { select: { bookings: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true } }),
  ])

  const isClinic = isPatientCategory(business?.category)
  const visitLabel = bookingTerminology(business?.category).heading
  const label = isClinic ? 'Pacienți' : 'Clienți'

  return (
    <div className="dashboard-page">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-2xl font-semibold mr-1">{label}</h1>
        <span className="text-sm text-gray-500 mr-1 whitespace-nowrap">{customers.length} {label.toLowerCase()}</span>
        <Link href={showingArchived ? '/dashboard/clienti' : '/dashboard/clienti?archived=1'} className="text-sm text-[var(--accent)]">{showingArchived ? 'Înapoi la lista activă' : 'Arhivă'}</Link>
        <div className="flex items-center gap-2">
          <form method="get" className="contents">
            {showingArchived && <input type="hidden" name="archived" value="1" />}
            <Input type="text" name="q" defaultValue={query} placeholder="Caută nume, telefon, email..." className="w-52" />
          </form>
          <PrintButton />
        </div>
      </div>

      <div className="mb-5">
        <AddCustomerForm isClinic={isClinic} />
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-gray-500">
          {query ? `Niciun rezultat pentru "${query}".` : `Niciun ${isClinic ? 'pacient' : 'client'} încă.`}
        </p>
      )}

      <Card className="p-0 overflow-hidden printable">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <th className="py-3 px-5 font-medium text-gray-500">Nume</th>
              <th className="font-medium text-gray-500">Telefon</th>
              <th className="font-medium text-gray-500">Email</th>
              <th className="font-medium text-gray-500">{visitLabel}</th>
              <th className="font-medium text-gray-500">Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]">
                <td className="py-3 px-5">
                  {showingArchived ? <span className="font-medium">{c.name ?? 'Fără nume'}</span> : <Link href={`/dashboard/clienti/${c.id}`} className="text-[var(--accent)] font-medium">{c.name ?? 'Fără nume'}</Link>}
                </td>
                <td>{c.phone}</td>
                <td>{c.email ?? '—'}</td>
                <td>{c._count.bookings}</td>
                <td>{showingArchived ? <RestoreCustomerButton id={c.id} /> : <Link href={`/dashboard/clienti/${c.id}`} className="text-[var(--accent)]">Editează</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}

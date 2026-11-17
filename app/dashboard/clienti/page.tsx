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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-2xl font-semibold">{label}</h1>
        <span className="mr-1 whitespace-nowrap text-sm text-gray-500">{customers.length} {label.toLowerCase()}</span>
        <Link href={showingArchived ? '/dashboard/clienti' : '/dashboard/clienti?archived=1'} className="ml-auto inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)]">{showingArchived ? 'Lista activă' : 'Arhivă'}</Link>
        <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
          <form method="get" role="search" className="min-w-0 flex-1 md:flex-none">
            {showingArchived && <input type="hidden" name="archived" value="1" />}
            <Input type="search" name="q" aria-label={`Caută ${label.toLowerCase()}`} defaultValue={query} placeholder="Caută nume, telefon, email..." className="w-full md:w-64" />
          </form>
          <div className="hidden md:block"><PrintButton /></div>
        </div>
      </div>

      <div className="mb-4 [&>button]:w-full md:[&>button]:w-auto">
        <AddCustomerForm isClinic={isClinic} />
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-gray-500">
          {query ? `Niciun rezultat pentru "${query}".` : `Niciun ${isClinic ? 'pacient' : 'client'} încă.`}
        </p>
      )}

      <div className="space-y-2 md:hidden screen-only" aria-label={label}>
        {customers.map((customer) => (
          <Card key={customer.id} className="min-w-0 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                {showingArchived ? <h2 className="break-words font-semibold">{customer.name ?? 'Fără nume'}</h2> : <Link href={`/dashboard/clienti/${customer.id}`} className="block min-h-11 break-words py-2 font-semibold text-[var(--accent)]">{customer.name ?? 'Fără nume'}</Link>}
                <a href={`tel:${customer.phone}`} className="inline-flex min-h-10 items-center text-sm text-gray-700">{customer.phone}</a>
                {customer.email && <p className="break-all text-xs text-gray-500">{customer.email}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-gray-600">{customer._count.bookings} {visitLabel.toLowerCase()}</span>
            </div>
            <div className="mt-3 border-t border-[var(--border-soft)] pt-2">
              {showingArchived ? <RestoreCustomerButton id={customer.id} /> : <Link href={`/dashboard/clienti/${customer.id}`} className="inline-flex min-h-11 items-center font-medium text-[var(--accent)]">Vezi profilul și programează →</Link>}
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 printable md:block print:block">
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

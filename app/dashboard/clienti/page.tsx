import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      }),
    },
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Clienți</h1>

      <form method="get" className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Caută după nume, telefon sau email..."
          className="w-full max-w-sm border rounded-md px-3 py-2 text-sm"
        />
      </form>

      {customers.length === 0 && (
        <p className="text-sm text-gray-500">
          {query ? `Niciun client găsit pentru "${query}".` : 'Niciun client încă.'}
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Nume</th>
            <th>Telefon</th>
            <th>Email</th>
            <th>Rezervări</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="py-2">
                <Link href={`/dashboard/clienti/${c.id}`} className="text-blue-600">
                  {c.name ?? 'Fără nume'}
                </Link>
              </td>
              <td>{c.phone}</td>
              <td>{c.email ?? '—'}</td>
              <td>{c._count.bookings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

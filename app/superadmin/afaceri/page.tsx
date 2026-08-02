import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import Link from 'next/link'
import BusinessRowActions from './business-row-actions'
import CreateBusinessButton from './create-business-button'

export default async function SuperAdminBusinesses() {
  const businesses = await prisma.business.findMany({
    include: { subscription: { include: { plan: true } }, _count: { select: { bookings: true, users: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Afaceri</h1>
        <CreateBusinessButton />
      </div>
      <p className="text-sm text-gray-500 mb-6">{businesses.length} afaceri înregistrate</p>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <th className="py-3 px-5 font-medium text-gray-500">Nume</th>
              <th className="font-medium text-gray-500">Categorie</th>
              <th className="font-medium text-gray-500">Abonament</th>
              <th className="font-medium text-gray-500">Rezervări</th>
              <th className="font-medium text-gray-500">Public</th>
              <th className="font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-[var(--border-soft)] last:border-0">
                <td className="py-3 px-5">
                  <Link href={`/superadmin/afaceri/${b.id}`} className="font-medium text-[var(--accent)]">
                    {b.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {b.city} · /{b.slug}
                  </p>
                </td>
                <td>{b.category === 'SALON' ? 'Salon' : 'Spații evenimente'}</td>
                <td>
                  {b.subscription ? (
                    <Pill tone={b.subscription.status === 'ACTIVE' ? 'success' : b.subscription.status === 'TRIALING' ? 'accent' : 'warning'}>
                      {b.subscription.plan.displayName} · {b.subscription.status}
                    </Pill>
                  ) : (
                    <Pill tone="neutral">Fără abonament</Pill>
                  )}
                </td>
                <td>{b._count.bookings}</td>
                <td>
                  <Pill tone={b.publicListed ? 'success' : 'neutral'}>{b.publicListed ? 'Da' : 'Nu'}</Pill>
                </td>
                <td className="pr-5">
                  <BusinessRowActions businessId={b.id} publicListed={b.publicListed} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

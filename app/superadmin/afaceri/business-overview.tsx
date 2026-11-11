import {prisma} from '@/lib/prisma'

export default async function BusinessOverview(){
 const rows=await prisma.$queryRaw<Array<{totalBusinesses:bigint;totalBookingsLast30d:bigint;activeSubscriptions:bigint;totalCustomers:bigint}>>`
 SELECT
 (SELECT COUNT(*) FROM "Business") AS "totalBusinesses",
 (SELECT COUNT(*) FROM "Booking" WHERE "createdAt">=NOW()-INTERVAL '30 days') AS "totalBookingsLast30d",
 (SELECT COUNT(*) FROM "Subscription" WHERE status IN ('ACTIVE','TRIALING')) AS "activeSubscriptions",
 (SELECT COUNT(*) FROM "Customer") AS "totalCustomers"
 `
 const row=rows[0]
 const items=[['Afaceri totale',row?.totalBusinesses],['Abonamente active',row?.activeSubscriptions],['Rezervări (30 zile)',row?.totalBookingsLast30d],['Clienți finali totali',row?.totalCustomers]] as const
 return <section aria-label="Indicatori pentru întreaga platformă" className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{items.map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2.5"><span className="text-xs text-gray-500">{label}</span><strong className="text-xl font-semibold tabular-nums">{Number(value??0)}</strong></div>)}</section>
}

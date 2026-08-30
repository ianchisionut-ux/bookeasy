import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function ContSuspendatPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const billing = businessId ? await prisma.business.findUnique({ where: { id: businessId }, select: { billingSuspendedAt: true, billingAmount: true, billingInvoiceName: true } }) : null
  const suspendedForBilling = Boolean(billing?.billingSuspendedAt)
  return (
    <main className="themed-static-bg min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center flex flex-col items-center gap-4">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={40} height={40} />
        <h1 className="text-lg font-semibold">Cont temporar suspendat</h1>
        <p className="text-sm text-gray-500">
          {suspendedForBilling ? 'Contul a fost suspendat deoarece factura a rămas neachitată mai mult de 15 zile de la scadență. După înregistrarea plății, contul poate fi reactivat.' : 'Contul tău a fost dezactivat de echipa bookeasy.ro. Te rugăm să ne contactezi pentru detalii sau pentru reactivare.'}
        </p>
        {suspendedForBilling && billing?.billingInvoiceName && businessId && <a href={`/api/billing/invoice/${businessId}`} className="btn-primary">Descarcă factura</a>}
        <Link href="/" className="btn-secondary">
          Înapoi la pagina principală
        </Link>
      </div>
    </main>
  )
}

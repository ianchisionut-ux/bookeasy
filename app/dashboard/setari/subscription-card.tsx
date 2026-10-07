import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'

const STATUS_LABEL: Record<string, string> = {
  GRATUIT: 'Gratuit (cont demo)',
  NEPLATIT: 'Neplătit',
  PLATIT: 'Plătit',
  RESTANT: 'Restant',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  GRATUIT: 'neutral',
  NEPLATIT: 'warning',
  PLATIT: 'success',
  RESTANT: 'danger',
}

type Props = {
  businessId: string
  planName: string | null
  billingStatus: string
  amount: number | null
  currency: string
  dueAt: string | null
  invoiceName: string | null
  paidAt: string | null
  paymentState: string | null
  paymentError: string | null
  paymentResult?: string
}

export function SubscriptionCard({ businessId, planName, billingStatus, amount, currency, dueAt, invoiceName, paidAt, paymentState, paymentError, paymentResult }: Props) {
  const dueLabel = dueAt ? new Date(dueAt).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }) : null
  const paidLabel = paidAt ? new Date(paidAt).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }) : null
  const paymentPending = ['REGISTERING', 'REGISTERED', 'VERIFYING'].includes(paymentState || '')

  return (
    <Card className="mb-5 break-inside-avoid">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Abonament și factură</h2>
        <Pill tone={STATUS_TONE[billingStatus] ?? 'neutral'}>{STATUS_LABEL[billingStatus] ?? billingStatus}</Pill>
      </div>
      <p className="text-sm text-gray-500">{planName ? `Plan: ${planName}` : 'Niciun plan asociat momentan.'}</p>
      {(amount !== null || dueLabel) && <p className="text-sm text-gray-600 mt-2">{amount !== null ? `${amount.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : ''}{amount !== null && dueLabel ? ' · ' : ''}{dueLabel ? `Scadență: ${dueLabel}` : ''}</p>}
      {paidLabel && billingStatus === 'PLATIT' && <p className="text-xs text-green-700 mt-2">Plată înregistrată la {paidLabel}.</p>}
      {paymentResult === 'success' && <p className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">O plată inițiată anterior este în curs de verificare. Statusul se va actualiza după confirmare.</p>}
      {paymentPending && <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">O plată inițiată anterior este în curs de verificare.</p>}
      {paymentState === 'DECLINED' && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentError || 'Plata anterioară a fost refuzată.'}</p>}
      {invoiceName && <div className="mt-3"><a href={`/api/billing/invoice/${businessId}`} className="btn-secondary inline-flex text-sm">Descarcă factura</a></div>}
      {billingStatus !== 'PLATIT' && billingStatus !== 'GRATUIT' && <p className="text-xs text-gray-600 mt-3">Plata online este dezactivată. Contactează echipa BookEasy pentru achitarea facturii.</p>}
      {billingStatus !== 'PLATIT' && billingStatus !== 'GRATUIT' && dueAt && <p className="text-xs text-red-600 mt-2">Serviciul se suspendă automat dacă plata nu este înregistrată în 15 zile de la scadență.</p>}
    </Card>
  )
}

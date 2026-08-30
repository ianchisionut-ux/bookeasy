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

export function SubscriptionCard({ businessId, planName, billingStatus, amount, dueAt, invoiceName }: { businessId: string; planName: string | null; billingStatus: string; amount: number | null; dueAt: string | null; invoiceName: string | null }) {
  const dueLabel = dueAt ? new Date(dueAt).toLocaleDateString('ro-RO') : null
  return (
    <Card className="mb-5 break-inside-avoid">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Abonament</h2>
        <Pill tone={STATUS_TONE[billingStatus] ?? 'neutral'}>{STATUS_LABEL[billingStatus] ?? billingStatus}</Pill>
      </div>
      <p className="text-sm text-gray-500">
        {planName ? `Plan: ${planName}` : 'Niciun plan asociat momentan.'}
      </p>
      {(amount !== null || dueLabel) && <p className="text-sm text-gray-600 mt-2">{amount !== null ? `${amount.toLocaleString('ro-RO')} RON` : ''}{amount !== null && dueLabel ? ' · ' : ''}{dueLabel ? `Scadență: ${dueLabel}` : ''}</p>}
      {invoiceName && <a href={`/api/billing/invoice/${businessId}`} className="btn-secondary inline-flex mt-3 text-sm">Descarcă factura</a>}
      {billingStatus !== 'PLATIT' && billingStatus !== 'GRATUIT' && dueAt && <p className="text-xs text-red-600 mt-3">Serviciul se suspendă automat dacă plata nu este înregistrată în 15 zile de la scadență.</p>}
    </Card>
  )
}

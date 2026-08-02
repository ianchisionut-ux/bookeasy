import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { BackLink } from '@/components/ui/back-link'
import ChannelManager from './channel-manager'

const LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp Business',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook Messenger',
  GOOGLE_BUSINESS: 'Google Business Profile',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'danger',
  DISCONNECTED: 'neutral',
}

export default async function SuperAdminBusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const business = await prisma.business.findUnique({
    where: { id },
    include: { channels: true, subscription: { include: { plan: true } } },
  })

  if (!business) notFound()

  const allTypes = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS'] as const

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-4">
        <BackLink href="/superadmin/afaceri" label="Înapoi la afaceri" />
      </div>

      <h1 className="text-2xl font-semibold mb-1">{business.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {business.city} · {business.category === 'SALON' ? 'Salon' : 'Spații evenimente'} ·{' '}
        {business.subscription?.plan.displayName ?? 'Fără abonament'}
      </p>

      <h2 className="text-lg font-medium mb-3">Canale — conectare și chei de acces</h2>
      <div className="flex flex-col gap-3">
        {allTypes.map((type) => {
          const channel = business.channels.find((c) => c.type === type)
          return (
            <Card key={type}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{LABELS[type]}</p>
                <Pill tone={channel ? STATUS_TONE[channel.status] : 'neutral'}>
                  {channel ? channel.status : 'Neconectat'}
                </Pill>
              </div>
              {channel && (
                <p className="text-xs text-gray-500 mb-3">
                  ID extern: {channel.externalId} · owner {channel.enabledByOwner ? 'a activat' : 'a dezactivat'} canalul
                </p>
              )}
              <ChannelManager
                businessId={business.id}
                type={type}
                channelId={channel?.id ?? null}
                isConnected={!!channel && channel.status !== 'DISCONNECTED'}
                supportsOAuth={type === 'WHATSAPP' || type === 'INSTAGRAM' || type === 'FACEBOOK' || type === 'GOOGLE_BUSINESS'}
                oauthProvider={type === 'GOOGLE_BUSINESS' ? 'google' : 'meta'}
              />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

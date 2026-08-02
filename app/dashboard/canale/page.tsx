import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { CardInteractive } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import ChannelToggle from './channel-toggle'

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

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activ',
  EXPIRING_SOON: 'Expiră curând',
  EXPIRED: 'Expirat',
  DISCONNECTED: 'Deconectat',
}

export default async function CanalePage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const channels = await prisma.channel.findMany({ where: { businessId } })
  const allTypes = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS'] as const

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Canale</h1>
      <p className="text-sm text-gray-500 mb-6">
        Poți opri temporar un canal fără să pierzi conexiunea. Conectarea și cheile de acces sunt
        administrate de echipa bookeasy.ro — scrie-ne dacă vrei un canal nou conectat.
      </p>

      <div className="flex flex-col gap-3">
        {allTypes.map((type) => {
          const channel = channels.find((c) => c.type === type)
          return (
            <CardInteractive key={type} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{LABELS[type]}</p>
                <div className="mt-1.5">
                  <Pill tone={channel ? STATUS_TONE[channel.status] : 'neutral'}>
                    {channel ? STATUS_LABEL[channel.status] : 'Neconectat de admin'}
                  </Pill>
                </div>
              </div>
              {channel ? (
                <ChannelToggle channelId={channel.id} enabled={channel.enabledByOwner} />
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </CardInteractive>
          )
        })}
      </div>
    </div>
  )
}

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp Business',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook Messenger',
  GOOGLE_BUSINESS: 'Google Business Profile',
}

export default async function CanalePage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const channels = await prisma.channel.findMany({ where: { businessId } })
  const connectedTypes = new Set(channels.map((c) => c.type))
  const allTypes = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS'] as const

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Canale conectate</h1>
      <div className="flex flex-col gap-3">
        {allTypes.map((type) => {
          const channel = channels.find((c) => c.type === type)
          return (
            <div key={type} className="border rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{LABELS[type]}</p>
                <p className="text-sm text-gray-500">{channel ? channel.status : 'neconectat'}</p>
              </div>
              <a
                href={
                  type === 'GOOGLE_BUSINESS'
                    ? '/api/oauth/google/start'
                    : '/api/oauth/meta/start'
                }
                className="text-sm px-3 py-1.5 border rounded-md"
              >
                {connectedTypes.has(type) ? 'Gestionează' : 'Conectează'}
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

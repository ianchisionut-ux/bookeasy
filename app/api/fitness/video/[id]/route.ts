import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fitnessClient, fitnessJson, fitnessOwner } from '@/lib/fitness'

export const dynamic = 'force-dynamic'
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [owner, client] = await Promise.all([fitnessOwner(), fitnessClient()])
  if (!owner && !client) return fitnessJson({ error: 'Autentificare necesară.' }, 401)
  const task = await prisma.fitnessTask.findFirst({ where: { id, member: { active: true, business: { category: 'FITNESS', accountActive: true }, ...(owner ? { businessId: owner.id } : { clientProfileId: client!.id }) } }, select: { videoRoom: true, title: true } })
  if (!task?.videoRoom) return fitnessJson({ error: 'Apel indisponibil.' }, 404)
  const domain = process.env.FITNESS_JITSI_DOMAIN || 'meet.jit.si'
  if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain)) return fitnessJson({ error: 'Serverul video nu este configurat corect.' }, 503)
  return fitnessJson({ url: `https://${domain}/BookEasy${task.videoRoom}`, title: task.title, publicServer: domain === 'meet.jit.si' })
}

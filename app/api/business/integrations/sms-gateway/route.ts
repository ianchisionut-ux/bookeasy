import { privateJson } from '@/lib/private-json'
import { NextRequest } from 'next/server';
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { smsSettingsBusinessId } from '@/lib/sms-settings-target'
import { prisma } from '@/lib/prisma'
import { isPlatformSmsReady } from '@/lib/sms-routing'
export async function PATCH(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return privateJson({ error: 'Cerere invalidă.' }, { status: 403 })
  const input = z.object({ enabled: z.boolean(), businessId: z.string().optional() }).strict().safeParse(await req.json().catch(() => null))
  if (!input.success) return privateJson({ error: 'Gateway-ul se configurează exclusiv din Superadmin → SMS.' }, { status: 400 })
  const businessId = await smsSettingsBusinessId(input.data.businessId)
  if (!businessId) return privateJson({ error: 'unauthorized' }, { status: 401 })
  if (input.data.enabled && !(await isPlatformSmsReady())) return privateJson({ error: 'Serviciul SMS BookEasy nu este disponibil momentan.' }, { status: 409 })
  await prisma.business.update({ where: { id: businessId }, data: { smsGatewayEnabled: input.data.enabled } })
  return privateJson({ success: true })
}
async function centralOnly() {
  if (!(await auth())) return privateJson({ error: 'unauthorized' }, { status: 401 })
  return privateJson({ error: 'Configurarea și asocierea se fac din Superadmin → SMS.' }, { status: 410 })
}
export const POST = centralOnly
export const DELETE = centralOnly

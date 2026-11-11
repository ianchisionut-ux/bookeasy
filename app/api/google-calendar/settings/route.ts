import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncFutureBookings } from '@/lib/google-calendar'
import { z } from 'zod'
import { businessHasPlan } from '@/lib/business-plan-access'

const settingsSchema = z.object({ practitionerId: z.string().min(1), syncEnabled: z.boolean(), includeCustomerDetails: z.boolean() })
const syncSchema = z.object({ practitionerId: z.string().min(1) })

async function owned(practitionerId: string, businessId: string) {
  return prisma.googleCalendarConnection.findFirst({ where: { practitionerId, businessId } })
}
async function targetBusiness(req: NextRequest) {
  const session = await auth()
  if (!session || (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER')) return null
  const requested = req.nextUrl.searchParams.get('businessId')
  if (requested && !(session as any).isSuperAdmin && requested !== (session as any).businessId) return null
  const businessId = (session as any).isSuperAdmin && requested ? requested : (session as any).businessId
  if (!businessId) return null
  if (!(await businessHasPlan(businessId, 'STANDARD', Boolean((session as any).isSuperAdmin)))) return null
  const business = await prisma.business.findFirst({ where: { id: businessId, accountActive: true }, select: { id: true } })
  return business?.id ?? null
}
export async function PATCH(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const businessId = await targetBusiness(req)
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  const body = parsed.data; const connection = await owned(body.practitionerId, businessId)
  if (!connection) return NextResponse.json({ error: 'Conexiunea nu există.' }, { status: 404 })
  const updated = await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      syncEnabled: body.syncEnabled === true,
      includeCustomerDetails: body.includeCustomerDetails === true,
    },
  })
  // Aplicăm imediat noile preferințe și evenimentelor existente. Astfel,
  // activarea detaliilor rescrie titlurile generice, iar programările viitoare
  // care nu au ajuns încă în Google sunt recuperate fără un al doilea click.
  const count = updated.syncEnabled ? await syncFutureBookings(body.practitionerId) : 0
  return NextResponse.json({ success: true, count })
}
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const businessId = await targetBusiness(req)
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = syncSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  const { practitionerId } = parsed.data; if (!(await owned(practitionerId, businessId))) return NextResponse.json({ error: 'Conexiunea nu există.' }, { status: 404 })
  return NextResponse.json({ success: true, count: await syncFutureBookings(practitionerId) })
}
export async function DELETE(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const businessId = await targetBusiness(req)
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') ?? ''; const connection = await owned(practitionerId, businessId)
  if (!connection) return NextResponse.json({ error: 'Conexiunea nu există.' }, { status: 404 })
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { teamSize: true } })
  if (business?.teamSize && business.teamSize > 1) {
    await prisma.googleCalendarConnection.delete({ where: { id: connection.id } })
  } else {
    // În modul Individual toate conexiunile rămase de la profiluri vechi reprezintă
    // același calendar al afacerii; deconectarea trebuie să oprească tot, nu să activeze
    // accidental următoarea conexiune veche.
    await prisma.googleCalendarConnection.deleteMany({ where: { businessId } })
  }
  return NextResponse.json({ success: true })
}

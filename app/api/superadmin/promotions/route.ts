import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { adminAction } from '@/lib/admin-action'
import { prisma } from '@/lib/prisma'
import { findPromotion, listPromotions, normalizePromoCode } from '@/lib/promotion-campaigns'
import { getPlanPrices } from '@/lib/plan-pricing'
import { signupFunnelLastSevenDays } from '@/lib/signup-funnel'

const fields = {
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  freeMonths: z.number().int().min(1).max(24),
  freeUntilNotice: z.boolean(),
  regularMinor: z.number().int().min(0).max(10000000),
  enrollmentOpen: z.boolean(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
}
const campaignId = z.string().min(1).max(100)
const create = z.object(fields)
const update = z.object({ ...fields, id: campaignId, restore: z.boolean().optional() })

export async function GET(req: NextRequest) {
  const denied = await adminAction(req)
  if (denied) return denied
  const [campaigns, funnel, prices] = await Promise.all([
    listPromotions({ includeArchived: true }),
    signupFunnelLastSevenDays(),
    getPlanPrices(),
  ])
  return NextResponse.json({ campaigns, funnel, prices }, { headers: { 'Cache-Control': 'no-store' } })
}

function isCodeConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const databaseError = error as { code?: string; meta?: { code?: string } }
  return databaseError.code === '23505' || (databaseError.code === 'P2010' && databaseError.meta?.code === '23505')
}

async function duplicateCode(code: string) {
  const campaign = await findPromotion(code)
  if (campaign?.deletedAt) {
    return NextResponse.json({
      error: `Codul ${code} este în arhivă. Restaurează campania ca să folosești același cod.`,
      conflict: { id: campaign.id, archived: true },
    }, { status: 409 })
  }
  return NextResponse.json({
    error: `Codul ${code} este deja folosit. Editează campania existentă sau alege alt cod.`,
    ...(campaign ? { conflict: { id: campaign.id, archived: false } } : {}),
  }, { status: 409 })
}

async function save(req: NextRequest, editing: boolean) {
  const denied = await adminAction(req, true)
  if (denied) return denied
  const input: unknown = await req.json().catch(() => null)
  const edit = editing ? update.safeParse(input) : null
  const parsed = edit ?? create.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Verifică numele, codul, durata și prețul campaniei.' }, { status: 400 })
  }

  const d = parsed.data
  const code = normalizePromoCode(d.code)
  const starts = d.startsAt ? new Date(d.startsAt) : null
  const ends = d.endsAt ? new Date(d.endsAt) : null
  if (starts && ends && starts >= ends) {
    return NextResponse.json({ error: 'Data de final trebuie să fie după data de început.' }, { status: 400 })
  }
  const price = d.freeUntilNotice ? 0 : d.regularMinor

  try {
    if (edit?.success) {
      const { id, restore } = edit.data
      const restoring = restore === true
      const count = await prisma.$executeRaw`
        UPDATE "LaunchCampaign"
        SET "name" = ${d.name}, "code" = ${code}, "freeMonths" = ${d.freeMonths},
            "freeUntilNotice" = ${d.freeUntilNotice}, "regularMinor" = ${price},
            "enrollmentOpen" = ${d.enrollmentOpen}, "startsAt" = ${starts}, "endsAt" = ${ends},
            "deletedAt" = NULL, "updatedAt" = clock_timestamp()
        WHERE "id" = ${id} AND (
          (${restoring} AND "deletedAt" IS NOT NULL AND "code" = ${code})
          OR (NOT ${restoring} AND "deletedAt" IS NULL)
        )
      `
      if (!count) {
        return NextResponse.json({
          error: restoring ? 'Campania nu mai este în arhivă cu acest cod. Reîncarcă lista.' : 'Campania nu există sau a fost arhivată.',
        }, { status: restoring ? 409 : 404 })
      }
    } else {
      const count = await prisma.$executeRaw`
        INSERT INTO "LaunchCampaign" (
          "id", "code", "name", "freeMonths", "freeUntilNotice", "regularMinor",
          "enrollmentOpen", "startsAt", "endsAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${code}, ${d.name}, ${d.freeMonths}, ${d.freeUntilNotice}, ${price},
          ${d.enrollmentOpen}, ${starts}, ${ends}, clock_timestamp()
        )
        ON CONFLICT ("code") DO NOTHING
      `
      if (!count) return await duplicateCode(code)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isCodeConflict(error)) return duplicateCode(code)
    console.error('[promotions] Campaign save failed', error)
    return NextResponse.json({ error: 'Campania nu a putut fi salvată. Încearcă din nou.' }, { status: 500 })
  }
}

export const POST = (req: NextRequest) => save(req, false)
export const PATCH = (req: NextRequest) => save(req, true)

export async function DELETE(req: NextRequest) {
  const denied = await adminAction(req, true)
  if (denied) return denied
  const parsed = z.object({ id: campaignId, permanent: z.boolean().optional() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Campanie invalidă.' }, { status: 400 })

  if (parsed.data.permanent) {
    // Drop the public code and keep the row referenced by historical enrollments.
    const count = await prisma.$executeRaw`
      UPDATE "LaunchCampaign"
      SET "code" = NULL, "enrollmentOpen" = false, "updatedAt" = clock_timestamp()
      WHERE "id" = ${parsed.data.id} AND "deletedAt" IS NOT NULL AND "code" IS NOT NULL
    `
    return NextResponse.json(count ? { success: true } : { error: 'Campania nu mai este în arhivă. Reîncarcă lista.' }, { status: count ? 200 : 409 })
  }

  const count = await prisma.$executeRaw`
    UPDATE "LaunchCampaign"
    SET "deletedAt" = clock_timestamp(), "enrollmentOpen" = false, "updatedAt" = clock_timestamp()
    WHERE "id" = ${parsed.data.id} AND "deletedAt" IS NULL AND "code" IS NOT NULL
  `
  return NextResponse.json(count ? { success: true } : { error: 'Campania nu există.' }, { status: count ? 200 : 404 })
}

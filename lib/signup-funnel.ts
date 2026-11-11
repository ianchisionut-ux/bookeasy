import { prisma } from './prisma'

export type SignupFunnelStep = 'view' | 'start' | 'submit' | 'created'

export function signupFunnelDimension(value: unknown, fallback: string) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
    ? value.toUpperCase()
    : fallback
}

export async function recordSignupFunnel(step: SignupFunnelStep, promoCode: unknown, utmCampaign: unknown) {
  const promo = signupFunnelDimension(promoCode, 'DIRECT')
  const campaign = signupFunnelDimension(utmCampaign, 'NONE')
  await prisma.$executeRaw`
    DELETE FROM "SignupFunnelDaily"
    WHERE "day" < (clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::date - 365
  `
  await prisma.$executeRaw`
    INSERT INTO "SignupFunnelDaily" ("day", "promoCode", "utmCampaign", "step", "count")
    VALUES ((clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::date, ${promo}, ${campaign}, ${step}, 1)
    ON CONFLICT ("day", "promoCode", "utmCampaign", "step")
    DO UPDATE SET "count" = "SignupFunnelDaily"."count" + 1
  `
}

export async function signupFunnelLastSevenDays() {
  await prisma.$executeRaw`
    DELETE FROM "SignupFunnelDaily"
    WHERE "day" < (clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::date - 365
  `
  return prisma.$queryRaw<{ promoCode: string; utmCampaign: string; step: SignupFunnelStep; count: number }[]>`
    SELECT "promoCode", "utmCampaign", "step", SUM("count")::integer AS "count"
    FROM "SignupFunnelDaily"
    WHERE "day" >= (clock_timestamp() AT TIME ZONE 'Europe/Bucharest')::date - 6
    GROUP BY "promoCode", "utmCampaign", "step"
    ORDER BY "promoCode", "utmCampaign", "step"
  `
}

import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma'
import { Resend } from 'resend'
import { buildOnboardingEmail } from './onboarding-email'

export function verificationTokenKey(token: string) {
  return 'verify-email:' + createHash('sha256').update(token).digest('hex')
}

export async function sendVerificationEmail(userId: string, email: string) {
  if (!process.env.RESEND_API_KEY) throw new Error('Serviciul de email nu este configurat.')
  const token = randomBytes(32).toString('hex')
  const record = await prisma.passwordResetToken.create({ data: {
    userId, token: verificationTokenKey(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  } })
  const link = new URL('/verify-email', process.env.APP_URL || 'https://bookeasy.ro')
  link.searchParams.set('token', token)
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Bookeasy <noreply@bookeasy.ro>', replyTo: 'contact@bookeasy.ro', to: email,
      subject: 'Confirmă adresa de email — Bookeasy',
      ...buildOnboardingEmail('', link.toString(), 'verify'),
    })
    if (error) throw new Error('Emailul de confirmare nu a putut fi trimis.')
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({ where: { id: record.id } })
    throw error
  }
}

export async function confirmEmail(token: string) {
  const now = new Date()
  return prisma.$transaction(async tx => {
    const record = await tx.passwordResetToken.findUnique({ where: { token: verificationTokenKey(token) } })
    if (!record || record.usedAt || record.expiresAt <= now) return false
    // Serialize confirmations for one account before consuming any of its links.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${record.userId} FOR UPDATE`
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } })
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, token: { startsWith: 'verify-email:' }, usedAt: null }, data: { usedAt: now } })
    return true
  })
}

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { failure, fitnessActor, input, json } from '@/lib/fitness-auth'
import { clientProgress, entryEdit } from '@/lib/fitness-validation'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, owner } = await fitnessActor(req)
    const { id } = await ctx.params
    const parsed = owner ? await input(req, entryEdit) : await input(req, clientProgress)
    const { version, ...data } = parsed
    const result = await prisma.fitnessEntry.updateMany({ where: { id, clientId: client.id, version }, data: { ...data, version: { increment: 1 } } })
    if (!result.count) return json({ error: 'Planul a fost modificat între timp. Reîncarcă înainte de a salva.' }, 409)
    return json({ ok: true })
  } catch (e) { return failure(e) }
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, owner } = await fitnessActor(req)
    if (!owner) return json({ error: 'Doar instructorul poate șterge planuri.' }, 403)
    const { version } = await input(req, z.object({ version: z.number().int().positive() }).strict())
    const { id } = await ctx.params
    const result = await prisma.fitnessEntry.deleteMany({ where: { id, clientId: client.id, version } })
    return result.count ? json({ ok: true }) : json({ error: 'Planul a fost modificat. Reîncarcă lista.' }, 409)
  } catch (e) { return failure(e) }
}

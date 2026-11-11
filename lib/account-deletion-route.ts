import { after, NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { rateLimit } from './rate-limit'
import { accountHash } from './session-revocation'
import { cleanupDeletedAccountFiles, deleteAccount, deletionTarget, DeletionError, prepareDeletion, type DeletionKind } from './account-deletion'

export function accountDeletionHandlers(kind: DeletionKind) {
  async function handle(req: NextRequest, final: boolean) {
    if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Cerere invalidă. Reîncarcă pagina.' }, { status: 403 })
    try {
      const target = await deletionTarget(await auth(), kind)
      if (!target) return NextResponse.json({ error: kind === 'BUSINESS' ? 'Doar proprietarul poate șterge această afacere.' : 'Autentifică-te în contul personal pe care dorești să îl ștergi.' }, { status: 403 })
      if (!(await rateLimit(`account-delete:${accountHash(target.actorKey)}`, 12, 15 * 60 * 1000)).allowed) return NextResponse.json({ error: 'Prea multe încercări. Revino în câteva minute.' }, { status: 429 })
      const body = await req.json().catch(() => null)
      if (body?.acknowledged !== true) return NextResponse.json({ error: 'Confirmă mai întâi că ai înțeles ce se șterge.' }, { status: 400 })
      if (!final) return NextResponse.json(await prepareDeletion(target), { headers: { 'Cache-Control': 'no-store' } })
      if (typeof body.token !== 'string' || typeof body.confirmation !== 'string') return NextResponse.json({ error: 'Lipsește confirmarea finală.' }, { status: 400 })
      await deleteAccount(target, body.token, body.confirmation)
      const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
      // Clear every session chunk on this device; the revocation also blocks other devices.
      for (const cookie of req.cookies.getAll()) {
        if (/^(?:__Secure-)?(?:authjs|next-auth)\.session-token(?:\.\d+)?$/.test(cookie.name) || cookie.name === '__Secure-bookeasy-native-google') {
          response.cookies.set(cookie.name, '', { path: '/', expires: new Date(0), httpOnly: true, secure: cookie.name.startsWith('__Secure-'), sameSite: 'lax' })
        }
      }
      if (kind === 'BUSINESS') after(async () => { await cleanupDeletedAccountFiles().catch(() => console.error('[account-deletion] Cleanup retry scheduled')) })
      return response
    } catch (error) {
      if (error instanceof DeletionError) return NextResponse.json({ error: error.message }, { status: error.status })
      console.error('[account-deletion] Transaction failed; account deletion rolled back')
      return NextResponse.json({ error: 'Ștergerea nu a putut fi finalizată. Contul nu a fost șters. Încearcă din nou.' }, { status: 503 })
    }
  }
  return { POST: (req: NextRequest) => handle(req, false), DELETE: (req: NextRequest) => handle(req, true) }
}

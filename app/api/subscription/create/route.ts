import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Abonamentele SaaS noi nu mai deschid un checkout Stripe separat. SuperAdminul
// emite sau încarcă factura individuală, iar owner-ul o achită prin BT iPay din Setări.
// Păstrăm ruta pentru clienții vechi care o pot avea încă în cache, cu un răspuns clar.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  return NextResponse.json({
    error: 'Abonamentul Bookeasy se achită pe baza facturii emise. Deschide Setări → Abonament și factură.',
    billingUrl: '/dashboard/setari',
  }, { status: 409 })
}

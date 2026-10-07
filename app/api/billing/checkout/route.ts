import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Plata online este dezactivată. Contactează echipa BookEasy pentru achitarea facturii.' }, { status: 410 })
}

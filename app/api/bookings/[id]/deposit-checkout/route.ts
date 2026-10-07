import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Plata online este dezactivată.' }, { status: 410 })
}

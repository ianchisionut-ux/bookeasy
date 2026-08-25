import { NextResponse } from 'next/server'

// Dezactivat intenționat: WhatsApp este folosit numai pentru cererea manuală de reconfirmare.
export async function POST() {
  return NextResponse.json(
    { error: 'Reminder-ele WhatsApp sunt dezactivate. Folosește „Cere reconfirmare”.' },
    { status: 410 }
  )
}

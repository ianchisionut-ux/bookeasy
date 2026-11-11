import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { sendHelpMessage } from '@/lib/help-chat'
import { randomUUID } from 'node:crypto'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  subject: z.string().min(2).max(120),
  message: z.string().min(5).max(2000),
})

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tickets = await prisma.supportTicket.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ tickets })
}

export async function POST(req: NextRequest) {
  if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă'},{status:403})
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Completează subiectul și mesajul.' }, { status: 400 })

  if(!(await rateLimit(`help:${businessId}`,30,60000)).allowed)return NextResponse.json({error:'Prea multe mesaje. Așteaptă un minut.'},{status:429})
  const ticketId = await sendHelpMessage({businessId,admin:false,text:parsed.data.subject+'\n\n'+parsed.data.message,requestId:randomUUID()})
  const ticket=await prisma.supportTicket.update({where:{id:ticketId},data:{subject:parsed.data.subject}})

  return NextResponse.json({ ticket })
}

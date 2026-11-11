import { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from './auth'
import { auth as businessAuth } from './business-auth'
import { rateLimit } from './rate-limit'
import { helpThreads,helpMessages,sendHelpMessage,markHelpRead,deleteHelpThread } from './help-chat'
import { prisma } from './prisma'
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('send'),ticketId:z.string().min(1).max(100).optional(),businessId:z.string().min(1).max(100).optional(),message:z.string().trim().min(1).max(2000),requestId:z.string().uuid()}),
 z.object({action:z.literal('read'),ticketId:z.string().max(100),lastId:z.string().max(150)}),
 z.object({action:z.literal('status'),ticketId:z.string().max(100),status:z.enum(['NEW','IN_PROGRESS','RESOLVED'])}),
 z.object({action:z.literal('delete'),ticketId:z.string().min(1).max(100),confirmed:z.literal(true)}),
])
export function helpChatHandlers(admin:boolean) {
 async function identity(){const session=await(admin?auth():businessAuth());return session&&(admin?(session as any).isSuperAdmin:(session as any).businessId)?session:null}
 async function GET(req:NextRequest){
  const session=await identity();if(!session)return NextResponse.json({error:'Autentificare necesară.'},{status:401})
  if(req.nextUrl.searchParams.has('businessSearch')){
   if(!admin)return NextResponse.json({error:'Acces interzis.'},{status:403})
   const search=(req.nextUrl.searchParams.get('businessSearch')||'').trim().slice(0,150)
   const businesses=await prisma.business.findMany({where:search?{OR:[{name:{contains:search,mode:'insensitive'}},{users:{some:{role:'OWNER',email:{contains:search,mode:'insensitive'}}}}]}:{},select:{id:true,name:true,contactPhone:true,users:{where:{role:'OWNER'},select:{email:true},orderBy:{id:'asc'},take:1}},orderBy:[{name:'asc'},{id:'asc'}],take:100})
   return NextResponse.json({businesses:businesses.map(b=>({id:b.id,name:b.name,email:b.users[0]?.email??'',phone:b.contactPhone??''}))},{headers:{'Cache-Control':'no-store'}})
  }
  const businessId=admin?undefined:(session as any).businessId
  const threads=await helpThreads(businessId),id=req.nextUrl.searchParams.get('ticketId')
  const messages=id?await helpMessages(id,businessId):[]
  if(messages===null)return NextResponse.json({error:'Conversația nu există.'},{status:404})
  return NextResponse.json({threads,messages},{headers:{'Cache-Control':'no-store'}})
 }
 async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă.'},{status:403})
  const session=await identity();if(!session)return NextResponse.json({error:'Autentificare necesară.'},{status:401})
  const businessId=admin?undefined:(session as any).businessId
  const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Mesaj invalid sau prea lung (maximum 2.000 de caractere).'},{status:400})
  const data=parsed.data
  if(data.action==='send'&&data.businessId&&!admin)return NextResponse.json({error:'Acces interzis.'},{status:403})
  if(data.action==='send'&&admin&&((!data.ticketId&&!data.businessId)||(data.ticketId&&data.businessId)))return NextResponse.json({error:'Selectează afacerea sau conversația.'},{status:400})
  if(data.action==='send'&&!(await rateLimit(`help:${admin?(session as any).userId:businessId}`,30,60000)).allowed)return NextResponse.json({error:'Prea multe mesaje. Așteaptă un minut.'},{status:429})
  try {
   if(data.action==='send'){const ticketId=await sendHelpMessage({ticketId:data.ticketId,businessId:admin?data.businessId:businessId,admin,text:data.message,requestId:data.requestId});return NextResponse.json({ticketId})}
   if(data.action==='read'){if(!await markHelpRead(data.ticketId,data.lastId,admin,businessId))return NextResponse.json({error:'Conversația nu există.'},{status:404});return NextResponse.json({success:true})}
   if(!admin)return NextResponse.json({error:'Acces interzis.'},{status:403})
   if(data.action==='delete'){if(!await deleteHelpThread(data.ticketId))return NextResponse.json({error:'Conversația nu mai există.'},{status:404});return NextResponse.json({success:true})}
   await prisma.supportTicket.update({where:{id:data.ticketId},data:{status:data.status}});return NextResponse.json({success:true})
  }catch{return NextResponse.json({error:'Conversația nu a putut fi actualizată. Încearcă din nou.'},{status:400})}
 }
 return {GET,POST}
}

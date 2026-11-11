import {NextRequest,NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {auth} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {listPromotions,normalizePromoCode} from '@/lib/promotion-campaigns'
import {signupFunnelLastSevenDays} from '@/lib/signup-funnel'
const fields={name:z.string().trim().min(2).max(100),enrollmentOpen:z.boolean(),startsAt:z.string().datetime().nullable(),endsAt:z.string().datetime().nullable()}
const create=z.object({...fields,code:z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),freeMonths:z.number().int().min(1).max(24)})
const update=z.object({...fields,id:z.string().min(1).max(100)})
export async function GET(){if(!(await auth() as any)?.isSuperAdmin)return NextResponse.json({error:'Neautorizat.'},{status:401});const [campaigns,funnel]=await Promise.all([listPromotions(),signupFunnelLastSevenDays()]);return NextResponse.json({campaigns,funnel},{headers:{'Cache-Control':'no-store'}})}
async function save(req:NextRequest,editing:boolean){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă.'},{status:403})
 if(!(await auth() as any)?.isSuperAdmin)return NextResponse.json({error:'Neautorizat.'},{status:401})
 const parsed=(editing?update:create).safeParse(await req.json().catch(()=>null))
 if(!parsed.success)return NextResponse.json({error:'Verifică numele, codul (litere, cifre, - sau _) și numărul de luni gratuite (1–24).'},{status:400})
 const d=parsed.data,starts=d.startsAt?new Date(d.startsAt):null,ends=d.endsAt?new Date(d.endsAt):null
 if(starts&&ends&&starts>=ends)return NextResponse.json({error:'Data de final trebuie să fie după data de început.'},{status:400})
 try{
  if('id' in d){const count=await prisma.$executeRaw`UPDATE "LaunchCampaign" SET "name"=${d.name},"enrollmentOpen"=${d.enrollmentOpen},"startsAt"=${starts},"endsAt"=${ends},"updatedAt"=clock_timestamp() WHERE "id"=${d.id}`;if(!count)return NextResponse.json({error:'Campania nu există.'},{status:404})}
  else await prisma.$executeRaw`INSERT INTO "LaunchCampaign" ("id","code","name","freeMonths","enrollmentOpen","startsAt","endsAt","updatedAt") VALUES (${randomUUID()},${normalizePromoCode(d.code)},${d.name},${d.freeMonths},${d.enrollmentOpen},${starts},${ends},clock_timestamp())`
  return NextResponse.json({success:true})
 }catch{return NextResponse.json({error:'Codul există deja sau campania nu a putut fi salvată.'},{status:409})}
}
export const POST=(req:NextRequest)=>save(req,false)
export const PATCH=(req:NextRequest)=>save(req,true)

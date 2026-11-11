import {NextRequest,NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {adminAction} from '@/lib/admin-action'
import {prisma} from '@/lib/prisma'
import {listPromotions,normalizePromoCode} from '@/lib/promotion-campaigns'
import {getPlanPrices} from '@/lib/plan-pricing'
import {signupFunnelLastSevenDays} from '@/lib/signup-funnel'
const fields={name:z.string().trim().min(2).max(100),code:z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),freeMonths:z.number().int().min(1).max(24),freeUntilNotice:z.boolean(),regularMinor:z.number().int().min(0).max(10000000),enrollmentOpen:z.boolean(),startsAt:z.string().datetime().nullable(),endsAt:z.string().datetime().nullable()}
const create=z.object(fields),update=z.object({...fields,id:z.string().min(1).max(100)})
export async function GET(req:NextRequest){const denied=await adminAction(req);if(denied)return denied;const [campaigns,funnel]=await Promise.all([listPromotions(),signupFunnelLastSevenDays()]);return NextResponse.json({campaigns,funnel,prices:await getPlanPrices()},{headers:{'Cache-Control':'no-store'}})}
async function save(req:NextRequest,editing:boolean){
 const denied=await adminAction(req,true);if(denied)return denied
 const parsed=(editing?update:create).safeParse(await req.json().catch(()=>null))
 if(!parsed.success)return NextResponse.json({error:'Verifică numele, codul, durata și prețul campaniei.'},{status:400})
 const d=parsed.data,starts=d.startsAt?new Date(d.startsAt):null,ends=d.endsAt?new Date(d.endsAt):null
 if(starts&&ends&&starts>=ends)return NextResponse.json({error:'Data de final trebuie să fie după data de început.'},{status:400})
 const price=d.freeUntilNotice?0:d.regularMinor
 try{
  if('id' in d){const count=await prisma.$executeRaw`UPDATE "LaunchCampaign" SET "name"=${d.name},"code"=${normalizePromoCode(d.code)},"freeMonths"=${d.freeMonths},"freeUntilNotice"=${d.freeUntilNotice},"regularMinor"=${price},"enrollmentOpen"=${d.enrollmentOpen},"startsAt"=${starts},"endsAt"=${ends},"updatedAt"=clock_timestamp() WHERE "id"=${d.id} AND "deletedAt" IS NULL`;if(!count)return NextResponse.json({error:'Campania nu există.'},{status:404})}
  else await prisma.$executeRaw`INSERT INTO "LaunchCampaign" ("id","code","name","freeMonths","freeUntilNotice","regularMinor","enrollmentOpen","startsAt","endsAt","updatedAt") VALUES (${randomUUID()},${normalizePromoCode(d.code)},${d.name},${d.freeMonths},${d.freeUntilNotice},${price},${d.enrollmentOpen},${starts},${ends},clock_timestamp())`
  return NextResponse.json({success:true})
 }catch{return NextResponse.json({error:'Codul există deja (inclusiv în arhivă) sau campania nu a putut fi salvată.'},{status:409})}
}
export const POST=(req:NextRequest)=>save(req,false)
export const PATCH=(req:NextRequest)=>save(req,true)
export async function DELETE(req:NextRequest){
 const denied=await adminAction(req,true);if(denied)return denied
 const parsed=z.object({id:z.string().min(1).max(100)}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Campanie invalidă.'},{status:400})
 const count=await prisma.$executeRaw`UPDATE "LaunchCampaign" SET "deletedAt"=clock_timestamp(),"enrollmentOpen"=false,"updatedAt"=clock_timestamp() WHERE "id"=${parsed.data.id} AND "deletedAt" IS NULL`
 return NextResponse.json(count?{success:true}:{error:'Campania nu există.'},{status:count?200:404})
}

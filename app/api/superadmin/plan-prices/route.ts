import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {adminAction} from '@/lib/admin-action'
import {getPlanPrices} from '@/lib/plan-pricing'
import {prisma} from '@/lib/prisma'
export async function GET(req:NextRequest){const denied=await adminAction(req);if(denied)return denied;return NextResponse.json(await getPlanPrices(),{headers:{'Cache-Control':'no-store'}})}
export async function PATCH(req:NextRequest){
 const denied=await adminAction(req,true);if(denied)return denied
 const parsed=z.object({standardMinor:z.number().int().min(0).max(10000000),proMinor:z.number().int().min(0).max(10000000).nullable(),version:z.string().min(1).max(500)}).safeParse(await req.json().catch(()=>null))
 if(!parsed.success)return NextResponse.json({error:'Introdu prețuri valide, de maximum 100.000 lei.'},{status:400})
 const result=await prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(2026111118)`;if((await getPlanPrices(tx)).version!==parsed.data.version)return null;for(const [id,amount]of [['STANDARD',parsed.data.standardMinor],['PRO',parsed.data.proMinor]] as const)await tx.$executeRaw`UPDATE "PlatformPlanPrice" SET "amountMinor"=${amount},"updatedAt"=clock_timestamp() WHERE "id"=${id}`;return getPlanPrices(tx)})
 return result?NextResponse.json(result):NextResponse.json({error:'Prețurile au fost modificate în altă fereastră. Reîncarcă pagina.'},{status:409})
}

import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {findPromotion,promotionIsOpen,promotionVersion} from '@/lib/promotion-campaigns'
import {getClientIp,rateLimit} from '@/lib/rate-limit'
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă.'},{status:403})
 if(!(await rateLimit(`promo-check:${getClientIp(req)}`,30,60000)).allowed)return NextResponse.json({error:'Prea multe verificări. Încearcă din nou într-un minut.'},{status:429})
 const parsed=z.object({code:z.string().trim().min(1).max(64)}).safeParse(await req.json().catch(()=>null))
 if(!parsed.success)return NextResponse.json({error:'Introdu un cod valid.'},{status:400})
 const campaign=await findPromotion(parsed.data.code)
 if(!campaign||!promotionIsOpen(campaign))return NextResponse.json({error:'Codul nu este valid sau nu este disponibil în acest moment.'},{status:400})
 return NextResponse.json({freeMonths:campaign.freeMonths,regularMinor:5500,version:promotionVersion(campaign)},{headers:{'Cache-Control':'no-store'}})
}

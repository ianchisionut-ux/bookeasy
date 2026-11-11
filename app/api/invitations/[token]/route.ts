import {LaunchSignupError} from '@/lib/launch-campaign'
import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {InvitationError,invitationDetails,acceptBusinessInvitation} from '@/lib/business-invitations'
import {getClientIp,rateLimit} from '@/lib/rate-limit'
export async function GET(req:NextRequest,{params}:{params:Promise<{token:string}>}){const data=await invitationDetails((await params).token);return NextResponse.json(data?{invitation:data}:{error:'Invitația a expirat sau a fost folosită. Cere o invitație nouă.'},{status:data?200:404,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
export async function POST(req:NextRequest,{params}:{params:Promise<{token:string}>}){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă.'},{status:403})
 if(!(await rateLimit(`invite-accept:${getClientIp(req)}`,10,900000)).allowed)return NextResponse.json({error:'Prea multe încercări. Reîncearcă mai târziu.'},{status:429})
 const parsed=z.object({password:z.string().min(8).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72).optional(),acceptTerms:z.boolean().optional(),promoCode:z.string().trim().max(64).optional(),acceptPromo:z.boolean().optional(),offerVersion:z.string().max(200).optional(),planPriceVersion:z.string().max(500).optional()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Parola trebuie să aibă cel puțin 8 caractere și maximum 72 bytes.'},{status:400})
 try{return NextResponse.json({success:true,...await acceptBusinessInvitation((await params).token,parsed.data)})}catch(e){if(e instanceof InvitationError||e instanceof LaunchSignupError)return NextResponse.json({error:e.message},{status:e.status});return NextResponse.json({error:'Operațiunea nu a putut fi finalizată. Reîncearcă mai târziu.'},{status:503})}
}

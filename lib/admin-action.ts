import {NextRequest,NextResponse} from 'next/server'
import {auth} from './auth'
import {rateLimit} from './rate-limit'
export async function adminAction(req:NextRequest,mutation=false){
 if(mutation&&req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă.'},{status:403})
 const session=await auth();if(!(session as any)?.isSuperAdmin)return NextResponse.json({error:'Acces permis doar Super Admin.'},{status:401})
 if(mutation&&!(await rateLimit(`admin-action:${(session as any).userId}:${req.nextUrl.pathname}`,30,60000)).allowed)return NextResponse.json({error:'Prea multe cereri. Reîncearcă într-un minut.'},{status:429})
 return null
}

import {NextRequest,NextResponse} from 'next/server'
import {auth} from '@/lib/business-auth'
import {markGuideSeen} from '@/lib/usage-guide'
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă'},{status:403})
 const session=await auth();const id=(session as any)?.businessId;if(!id)return NextResponse.json({error:'unauthorized'},{status:401})
 const body=await req.json().catch(()=>null);if(typeof body?.version!=='string'||!await markGuideSeen(id,body.version))return NextResponse.json({error:'Versiune invalidă'},{status:400})
 return NextResponse.json({success:true})
}

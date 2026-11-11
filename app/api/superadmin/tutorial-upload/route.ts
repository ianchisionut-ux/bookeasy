import {NextRequest,NextResponse} from 'next/server'
import {handleUpload,type HandleUploadBody} from '@vercel/blob/client'
import {auth} from '@/lib/auth'
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă'},{status:403})
 if(!(await auth() as any)?.isSuperAdmin)return NextResponse.json({error:'unauthorized'},{status:401})
 try{const body=await req.json() as HandleUploadBody;return NextResponse.json(await handleUpload({body,request:req,onBeforeGenerateToken:async pathname=>{
  if(!/^tutorials\/[a-f0-9-]{36}\/(video\.mp4|captions\.vtt)$/.test(pathname))throw Error('invalid_path')
  return {allowedContentTypes:pathname.endsWith('.mp4')?['video/mp4']:['text/vtt','text/plain','application/octet-stream'],maximumSizeInBytes:pathname.endsWith('.mp4')?250*1024*1024:2*1024*1024,addRandomSuffix:true,allowOverwrite:false,validUntil:Date.now()+15*60*1000}
 }}))}catch{return NextResponse.json({error:'Încărcarea nu a putut fi autorizată.'},{status:400})}
}

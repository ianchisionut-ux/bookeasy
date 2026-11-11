import {NextRequest,NextResponse} from 'next/server'
import {get} from '@vercel/blob'
import {auth} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
export const maxDuration=60
export async function GET(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 const session=await auth();if(!session||(!(session as any).isSuperAdmin&&!(session as any).businessId))return NextResponse.json({error:'unauthorized'},{status:401})
 const path=(await params).path.join('/');if(!/^tutorials\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+\.(mp4|vtt)$/.test(path))return new NextResponse(null,{status:404})
 const url='/api/tutorials/media/'+path
 if(!(session as any).isSuperAdmin){const allowed=await prisma.$queryRaw<{id:string}[]>`SELECT "id" FROM "UsageTutorial" WHERE "published" AND ("videoUrl"=${url} OR "captionsUrl"=${url}) LIMIT 1`;if(!allowed.length)return new NextResponse(null,{status:404})}
 const range=req.headers.get('range');if(range&&!/^bytes=\d*-\d*$/.test(range))return new NextResponse(null,{status:416})
 try{const result=await get(path,{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN,headers:range?{Range:range}:undefined});if(!result||result.statusCode!==200)return new NextResponse(null,{status:404})
 const headers=new Headers({'Content-Type':path.endsWith('.vtt')?'text/vtt; charset=utf-8':'video/mp4','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'})
 for(const key of ['content-range','content-length']){const value=result.headers.get(key);if(value)headers.set(key,value)}
 return new NextResponse(result.stream,{status:headers.has('content-range')?206:200,headers})
 }catch{return new NextResponse(null,{status:502})}
}

import {NextRequest,NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {head} from '@vercel/blob'
import {auth} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {usageTutorials} from '@/lib/usage-guide'
const schema=z.object({id:z.string().max(100).optional(),title:z.string().trim().min(3).max(160),description:z.string().trim().max(1000),videoUrl:z.string().max(500),captionsUrl:z.string().max(500).nullable(),duration:z.string().trim().max(15),published:z.boolean()})
const prefix='/api/tutorials/media/'
function validURL(value:string,extension:string){return new RegExp('^/tutorials/(blocare-calendar|integrari|buton-facebook)\\.'+(extension==='mp4'?'mp4':'ro.vtt')+'$').test(value)||new RegExp('^/api/tutorials/media/tutorials/[a-f0-9-]{36}/[a-zA-Z0-9._-]+\\.'+extension+'$').test(value)}
export async function GET(){if(!(await auth() as any)?.isSuperAdmin)return NextResponse.json({error:'unauthorized'},{status:401});return NextResponse.json({tutorials:await usageTutorials(true)},{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Cerere invalidă'},{status:403})
 if(!(await auth() as any)?.isSuperAdmin)return NextResponse.json({error:'unauthorized'},{status:401})
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Completează titlul și fișierele tutorialului.'},{status:400})
 const d=parsed.data
 if(!validURL(d.videoUrl,'mp4')||d.captionsUrl&&!validURL(d.captionsUrl,'vtt')||d.published&&!d.captionsUrl)return NextResponse.json({error:'Publicarea necesită un videoclip MP4 și subtitrări VTT încărcate.'},{status:400})
 try{
  for(const url of [d.videoUrl,d.captionsUrl])if(url?.startsWith(prefix)){const file=await head(url.slice(prefix.length),{token:process.env.BLOB_READ_WRITE_TOKEN});if(!file.size)throw Error('empty')}
  const id=d.id??randomUUID(),title=d.title,description=d.description,videoUrl=d.videoUrl,captionsUrl=d.captionsUrl,duration=d.duration,published=d.published
  if(d.id){const changed=await prisma.$executeRaw`UPDATE "UsageTutorial" SET "title"=${title},"description"=${description},"videoUrl"=${videoUrl},"captionsUrl"=${captionsUrl},"duration"=${duration},"publishedAt"=CASE WHEN ${published} AND (NOT "published" OR "videoUrl"<>${videoUrl} OR "captionsUrl" IS DISTINCT FROM ${captionsUrl}) THEN clock_timestamp() ELSE "publishedAt" END,"published"=${published} WHERE "id"=${id}`;if(!changed)return NextResponse.json({error:'Tutorialul nu există.'},{status:404})}
  else await prisma.$executeRaw`INSERT INTO "UsageTutorial" ("id","title","description","videoUrl","captionsUrl","duration","published","publishedAt") VALUES (${id},${title},${description},${videoUrl},${captionsUrl},${duration},${published},clock_timestamp())`
  return NextResponse.json({success:true,id})
 }catch{return NextResponse.json({error:'Fișierele nu au putut fi validate sau tutorialul nu a putut fi salvat. Reîncearcă.'},{status:400})}
}

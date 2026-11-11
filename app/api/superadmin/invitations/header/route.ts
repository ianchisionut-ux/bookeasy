import {randomUUID} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import sharp from 'sharp'
import {adminAction} from '@/lib/admin-action'
import {publicR2Url,putR2File} from '@/lib/r2-storage'

export const runtime = 'nodejs'
const MAX_BYTES = 3 * 1024 * 1024
const ALLOWED = new Set(['image/png','image/jpeg','image/webp'])

export async function POST(req:NextRequest){
 const denied=await adminAction(req,true);if(denied)return denied
 const length=Number(req.headers.get('content-length')||0)
 if(length>MAX_BYTES+2048)return NextResponse.json({error:'Imaginea trebuie să aibă maximum 3 MB.'},{status:413})
 const form=await req.formData().catch(()=>null)
 const file=form?.get('image')
 if(!(file instanceof File)||!ALLOWED.has(file.type)||file.size>MAX_BYTES||file.size===0)return NextResponse.json({error:'Alege o imagine JPG, PNG sau WebP de maximum 3 MB.'},{status:400})
 try{
  const input=Buffer.from(await file.arrayBuffer())
  const metadata=await sharp(input,{limitInputPixels:12_000_000}).metadata()
  if(!metadata.width||!metadata.height||metadata.width<600||metadata.height<200)return NextResponse.json({error:'Imaginea trebuie să aibă cel puțin 600 × 200 px.'},{status:400})
  const bytes=await sharp(input,{limitInputPixels:12_000_000}).rotate().resize({width:1800,height:900,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85,mozjpeg:true}).toBuffer()
  const key=`public/invitation-headers/${randomUUID()}.jpg`
  await putR2File(key,new File([new Uint8Array(bytes)],'antet-invitatie.jpg',{type:'image/jpeg'}))
  return NextResponse.json({url:publicR2Url(key)})
 }catch{return NextResponse.json({error:'Imaginea nu a putut fi procesată sau salvată.'},{status:400})}
}

'use client'
import { useEffect } from 'react'
export default function GuideSeenMarker({version}:{version:string|null}) {
 useEffect(()=>{
  if(!version)return
  let done=false
  const mark=()=>{if(done||document.visibilityState!=='visible')return;done=true;void fetch('/api/business/guide/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version})}).then(r=>{if(r.ok)window.dispatchEvent(new Event('bookeasy-support-changed'))}).catch(()=>{})}
  mark();document.addEventListener('visibilitychange',mark);return()=>document.removeEventListener('visibilitychange',mark)
 },[version]);return null
}

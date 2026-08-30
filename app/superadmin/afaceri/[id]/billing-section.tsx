'use client'
import { DragEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input, Pill } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const LABEL: Record<string,string>={GRATUIT:'Gratuit (demo)',NEPLATIT:'Neplătit',PLATIT:'Plătit',RESTANT:'Restant'}
const TONE: Record<string,'success'|'warning'|'danger'|'neutral'>={GRATUIT:'neutral',NEPLATIT:'warning',PLATIT:'success',RESTANT:'danger'}
type Props={businessId:string;initialPlanName:string|null;initialStatus:string;initialNote:string|null;initialAmount:number|null;initialDueAt:string|null;invoiceName:string|null}

export default function BillingSection(p:Props){
 const router=useRouter(), inputRef=useRef<HTMLInputElement>(null)
 const [planName,setPlanName]=useState(p.initialPlanName??''),[status,setStatus]=useState(p.initialStatus),[note,setNote]=useState(p.initialNote??'')
 const [amount,setAmount]=useState(p.initialAmount?.toString()??''),[dueAt,setDueAt]=useState(p.initialDueAt?.slice(0,10)??''),[file,setFile]=useState<File|null>(null)
 const [dragging,setDragging]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 async function save(){setSaving(true);setMessage('');try{
  const res=await fetchWithTimeout(`/api/superadmin/businesses/${p.businessId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({planName:planName||null,billingStatus:status,billingNote:note||null,billingAmount:amount?Number(amount):null,billingDueAt:dueAt?new Date(`${dueAt}T12:00:00Z`).toISOString():null})});if(!res.ok)throw new Error('Datele nu au putut fi salvate.')
  if(file){const form=new FormData();form.set('file',file);const upload=await fetchWithTimeout(`/api/superadmin/businesses/${p.businessId}/invoice`,{method:'POST',body:form},30000);const data=await upload.json().catch(()=>({}));if(!upload.ok)throw new Error(data.error||'Upload eșuat.');setFile(null)}
  setMessage('Salvat. Clientul vede factura și scadența.');router.refresh()
 }catch(e:any){setMessage(e?.message||'Salvarea a eșuat.')}finally{setSaving(false)}}
 function dropped(e:DragEvent){e.preventDefault();setDragging(false);if(e.dataTransfer.files[0])setFile(e.dataTransfer.files[0])}
 return <Card>
  <div className="flex items-center justify-between mb-1"><h2 className="font-medium">Abonament și factură</h2><Pill tone={TONE[status]}>{LABEL[status]}</Pill></div>
  <p className="text-sm text-gray-500 mb-4">Clientul este notificat la scadență. Dacă factura rămâne neplătită, contul se suspendă automat după 15 zile.</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
   <div><label className="text-sm text-gray-500 block mb-1.5">Plan</label><Input placeholder="ex: Standard, Pro..." value={planName} onChange={e=>setPlanName(e.target.value)}/></div>
   <div><label className="text-sm text-gray-500 block mb-1.5">Status plată</label><select value={status} onChange={e=>setStatus(e.target.value)} className="input-field w-full">{Object.entries(LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div><label className="text-sm text-gray-500 block mb-1.5">Sumă (RON)</label><Input type="number" min="0" step="0.01" placeholder="ex: 199" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
   <div><label className="text-sm text-gray-500 block mb-1.5">Scadență</label><Input type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></div>
  </div>
  <label className="text-sm text-gray-500 block mb-1.5">Notă internă (opțional)</label><Input placeholder="ex: plătit cash august..." value={note} onChange={e=>setNote(e.target.value)} className="mb-3"/>
  <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e=>setFile(e.target.files?.[0]??null)}/>
  <button type="button" onClick={()=>inputRef.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={dropped} className={`w-full rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragging?'border-[var(--accent)] bg-[var(--accent-soft)]':'border-gray-200 bg-gray-50'}`}><span className="block text-sm font-medium">Trage factura aici sau apasă pentru upload</span><span className="block text-xs text-gray-400 mt-1">PDF, JPG sau PNG · maximum 10 MB</span>{(file||p.invoiceName)&&<span className="block text-xs text-[var(--accent)] mt-2">{file?`Fișier nou: ${file.name}`:`Factură curentă: ${p.invoiceName}`}</span>}</button>
  {p.invoiceName&&<a href={`/api/billing/invoice/${p.businessId}`} className="inline-block text-xs text-[var(--accent)] hover:underline mt-2">Descarcă factura curentă</a>}
  <div className="mt-4 flex items-center gap-3"><Button variant="secondary" onClick={save} disabled={saving}>{saving?'Se salvează...':file?'Salvează și încarcă factura':'Salvează'}</Button>{message&&<span className="text-xs text-gray-500">{message}</span>}</div>
 </Card>
}

'use client'
import {useEffect,useRef,useState} from 'react'
import {ROMANIAN_CITY_COORDINATES} from '@/lib/romanian-city-coordinates'
import {loadOsmMap,addOsmTiles,locationPin} from '@/lib/osm-map'
type Position={lat:number;lng:number}
export default function BusinessLocationPicker({value,city,onChange}:{value:Position|null;city:string;onChange:(position:Position)=>void}){
  const element=useRef<HTMLDivElement>(null),map=useRef<any>(null),marker=useRef<any>(null),library=useRef<any>(null)
  const latest=useRef({value,city,onChange});latest.current={value,city,onChange}
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading')
  function place(position:Position){
    if(!marker.current){marker.current=library.current.marker([position.lat,position.lng],{draggable:true,icon:locationPin(library.current),title:'Mută pinul la intrarea afacerii'}).addTo(map.current);marker.current.on('dragend',()=>{const p=marker.current.getLatLng();latest.current.onChange({lat:p.lat,lng:p.lng})})}
    else marker.current.setLatLng([position.lat,position.lng])
  }
  useEffect(()=>{
    let cancelled=false;let resize:ResizeObserver|undefined
    loadOsmMap().then(L=>{
      if(cancelled||!element.current)return
      library.current=L
      const current=latest.current,center=ROMANIAN_CITY_COORDINATES.find(([name])=>name===current.city)
      map.current=L.map(element.current).setView(current.value?[current.value.lat,current.value.lng]:center?[center[1],center[2]]:[45.9432,24.9668],current.value||center?14:6)
      addOsmTiles(L,map.current);if(current.value)place(current.value)
      map.current.on('click',(event:any)=>{const p={lat:event.latlng.lat,lng:event.latlng.lng};place(p);latest.current.onChange(p)})
      resize=new ResizeObserver(()=>map.current?.invalidateSize());resize.observe(element.current);setStatus('ready')
    }).catch(()=>{if(!cancelled)setStatus('error')})
    return()=>{cancelled=true;resize?.disconnect();map.current?.remove();map.current=null;marker.current=null}
  },[])
  useEffect(()=>{
    if(!map.current)return
    if(value){place(value);map.current.panTo([value.lat,value.lng])}
    else {marker.current?.remove();marker.current=null;const center=ROMANIAN_CITY_COORDINATES.find(([name])=>name===city);if(center)map.current.setView([center[1],center[2]],14)}
  },[value,city])
  return <div><div className="relative isolate z-0 mt-3 h-60 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[#e7f2ee]"><div ref={element} className="h-full w-full" aria-label="Poziția afacerii pe OpenStreetMap" />{status!=='ready'&&<div className="absolute inset-0 z-[1000] grid place-items-center bg-[#e7f2ee] px-4 text-center text-sm text-gray-600">{status==='error'?'Harta nu este disponibilă momentan. Reîncarcă pagina.':'Se încarcă harta...'}</div>}</div><p className="mt-2 text-xs text-gray-500">Apasă pe hartă sau trage pinul la intrarea afacerii, apoi salvează setările.</p>{value&&<p className="mt-1 text-xs font-medium text-[var(--accent)]">Pin: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}</div>
}

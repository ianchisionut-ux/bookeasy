'use client'
import {createPortal} from 'react-dom'
import {useEffect} from 'react'
import {X} from 'lucide-react'
import HelpChat from './help-chat'
export function SupportChatPanel({open,onClose}:{open:boolean;onClose:()=>void}) {
 useEffect(()=>{if(!open)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[open,onClose])
 if(!open)return null
 return createPortal(<div className="fixed inset-0 z-[100] flex items-end justify-end bg-black/20 p-2 pb-[calc(env(safe-area-inset-bottom)+80px)] sm:items-center sm:p-5" onClick={onClose}><div role="dialog" aria-modal="true" aria-label="Suport tehnic BookEasy" onClick={e=>e.stopPropagation()} className="flex h-[min(650px,75dvh)] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-semibold">Suport tehnic</h2><button type="button" onClick={onClose} aria-label="Închide suportul" className="p-2"><X size={19}/></button></div><HelpChat open={open}/></div></div>,document.body)
}

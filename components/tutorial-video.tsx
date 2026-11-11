'use client'

import { useRef, useState } from 'react'
import { Maximize } from 'lucide-react'

const tutorials = {
  integrari: { title: 'Conectarea Facebook, Instagram și Google', duration: '1:32' },
  'buton-facebook': { title: 'Adaugă linkul de rezervare pe Facebook', duration: '0:40' },
  'blocare-calendar': { title: 'Cum blochezi intervale în calendar', duration: '0:30' },
} as const

export default function TutorialVideo({ tutorial, entry }: { tutorial?: keyof typeof tutorials; entry?: {title:string;duration:string;videoUrl:string;captionsUrl:string|null;posterUrl:string|null} }) {
  const player = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const info = entry ?? (tutorial ? tutorials[tutorial] : null)
  if (!info) return null
  const videoUrl = entry?.videoUrl ?? `/tutorials/${tutorial}.mp4`
  const posterUrl = entry?.posterUrl ?? (tutorial ? `/tutorials/${tutorial}.jpg` : undefined)
  const captionsUrl = entry?.captionsUrl ?? (tutorial ? `/tutorials/${tutorial}.ro.vtt` : null)

  async function fullscreen() {
    const video = player.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!video) return
    setError('')
    try {
      if (video.requestFullscreen) await video.requestFullscreen()
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen()
      else setError('Folosește „Deschide separat” pentru a mări videoclipul.')
    } catch {
      setError('Folosește butonul de ecran complet din player sau deschide videoclipul separat.')
    }
  }

  return <div className="mt-auto min-w-0 screen-only print:hidden">
    <video ref={player} controls playsInline preload="none" poster={posterUrl} aria-label={info.title} className="aspect-video w-full rounded-xl bg-black object-contain">
      <source src={videoUrl} type="video/mp4" />
      {captionsUrl && <track kind="captions" src={captionsUrl} srcLang="ro" label="Română — pașii explicați" default />}
      Browserul tău nu poate reda acest videoclip.
    </video>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-gray-500">{info.duration}{captionsUrl ? ' · Subtitrări în română' : ''}</span>
      <button type="button" onClick={fullscreen} aria-label={`Ecran complet: ${info.title}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-2.5 font-medium text-[var(--accent)] hover:bg-teal-50"><Maximize size={14} aria-hidden="true"/>Ecran complet</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-gray-600">{error}</p>}
    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs text-[var(--accent)] underline">Deschide separat</a>
  </div>
}

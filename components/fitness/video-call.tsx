'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Video, X } from 'lucide-react'
import { FitnessDialog } from './widgets'

export function FitnessVideoCall({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [call, setCall] = useState<{ url: string; title: string; publicServer: boolean } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/fitness/video/${taskId}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Apel indisponibil.')
      setCall(data)
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
    return () => controller.abort()
  }, [taskId])
  return <FitnessDialog title={call?.title || 'Apel video'} onClose={onClose} wide>
    <div className="fitness-video-info"><Video size={18} /><p>{call?.publicServer ? 'Apel prin Jitsi Meet. Instructorul poate avea nevoie de un cont Google, Facebook sau GitHub pentru a porni întâlnirea.' : 'Intră în apelul cu instructorul tău.'}</p></div>
    {error && <p role="alert" className="fitness-error">{error}</p>}
    {call ? <>
      <iframe title={`Apel video: ${call.title}`} src={`${call.url}#config.prejoinConfig.enabled=true`} allow="camera; microphone; fullscreen; display-capture; autoplay" allowFullScreen referrerPolicy="no-referrer" className="fitness-video-frame" />
      <a href={call.url} target="_blank" rel="noopener noreferrer" className="fitness-text-button"><ExternalLink size={16} /> Deschide Jitsi într-o fereastră separată</a>
    </> : !error && <p role="status">Se pregătește apelul…</p>}
    <button className="btn-secondary mt-4" onClick={onClose}><X size={15} className="inline mr-2" />Închide apelul</button>
  </FitnessDialog>
}

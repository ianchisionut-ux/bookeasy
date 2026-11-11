'use client'

import { useEffect, useRef, useState } from 'react'

const clips = ['salon', 'styling', 'ingrijire-ten', 'manichiura', 'stomatologie', 'tratament-facial', 'barber']

export default function MarketplaceHeroVideos() {
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const failed = useRef(new Set<number>())
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [inView, setInView] = useState(true)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    setRunning(!preference.matches)
    const reduceMotion = () => setRunning(!preference.matches)
    preference.addEventListener('change', reduceMotion)
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    if (container.current) observer.observe(container.current)
    const visibility = () => setInView(!document.hidden && Boolean(container.current && container.current.getBoundingClientRect().bottom > 0))
    document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect()
      preference.removeEventListener('change', reduceMotion)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  useEffect(() => {
    if (!running || !inView) {
      videos.current.forEach(video => video?.pause())
      return
    }
    const video = videos.current[current]
    if (video) {
      video.muted = true
      void video.play().catch(() => setRunning(false))
    }
  }, [current, running, inView])

  useEffect(() => {
    if (!running || !inView || visible === null || visible !== current) return
    const timer = window.setTimeout(() => {
      const next = clips.map((_, offset) => (current + offset + 1) % clips.length).find(index => !failed.current.has(index))
      if (next !== undefined) setCurrent(next)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [current, visible, running, inView])

  useEffect(() => {
    const timer = window.setTimeout(() => videos.current.forEach((video, index) => {
      if (index !== visible && index !== current) video?.pause()
    }), 1000)
    return () => window.clearTimeout(timer)
  }, [visible, current])

  return (
    <div ref={container} className="marketplace-hero-slideshow">
      <div className="marketplace-hero-videos" aria-hidden="true">
        {clips.map((clip, index) => {
          return <video
            key={clip}
            ref={element => { videos.current[index] = element }}
            src={`/videos/hero/${clip}.mp4`}
            muted playsInline loop disablePictureInPicture
            preload={index === current && running ? 'auto' : index === current || index === (current + 1) % clips.length ? 'metadata' : 'none'}
            tabIndex={-1}
            className={visible === index ? 'is-visible' : ''}
            onPlaying={() => { if (index === current) setVisible(index) }}
            onError={() => {
              failed.current.add(index)
              if (index !== current) return
              const next = clips.findIndex((_, candidate) => !failed.current.has(candidate))
              if (next < 0) setRunning(false)
              else setCurrent(next)
            }}
          />
        })}
      </div>

    </div>
  )
}

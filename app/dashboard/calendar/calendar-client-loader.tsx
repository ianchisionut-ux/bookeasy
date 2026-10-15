'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps, CSSProperties } from 'react'

// Calendar date calculations depend on the browser timezone. Preserve client-only
// rendering to avoid UTC/Europe-Bucharest hydration mismatches at day boundaries.
const CalendarClient = dynamic(() => import('./calendar-client'), {
  ssr: false,
  loading: () => (
    <div className="calendar-page dashboard-page be-calendar-loading" role="status" aria-busy="true" aria-label="Se încarcă calendarul">
      <span className="sr-only">Se &#238;ncarc&#259; calendarul...</span>
      <div className="be-calendar-loading-title" aria-hidden="true" />
      <div className="be-calendar-loading-bar" aria-hidden="true" />
      <div className="be-calendar-loading-grid" aria-hidden="true" />
    </div>
  ),
})

const LEGEND = [
  { label: 'Confirmate', color: '#16a34a' },
  { label: 'În așteptare', color: '#eab308' },
  { label: 'Finalizate', color: '#6b7280' },
  { label: 'Anulate / neprezentări', color: '#ef4444' },
]

export default function CalendarClientLoader(props: ComponentProps<typeof CalendarClient>) {
  return (
    <div className="be-calendar-frame">
      <CalendarClient {...props} />
      <div className="be-calendar-legend screen-only" aria-label="Legenda statusurilor">
        {LEGEND.map(item => <span key={item.label} className="be-calendar-legend-item"><i aria-hidden="true" style={{ '--legend-color': item.color } as CSSProperties} />{item.label}</span>)}
        <span className="be-calendar-legend-note">Trage pentru reprogramare &middot; Intervale de {props.slotIntervalMinutes} minute</span>
      </div>
    </div>
  )
}

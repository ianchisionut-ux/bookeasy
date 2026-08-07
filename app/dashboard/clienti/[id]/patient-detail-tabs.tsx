'use client'

import { useState } from 'react'
import MedicalRecordForm from './medical-record-form'
import PatientDocuments from './patient-documents'

export default function PatientDetailTabs({
  simpleForm,
  customerId,
  medicalRecordInitial,
  documents,
}: {
  simpleForm: React.ReactNode
  customerId: string
  medicalRecordInitial: any
  documents: { id: string; url: string; filename: string; uploadedAt: string }[]
}) {
  const [tab, setTab] = useState<'SIMPLE' | 'MEDICAL' | 'DOCS'>('SIMPLE')

  const tabs = [
    { id: 'SIMPLE' as const, label: 'Fișă simplă' },
    { id: 'MEDICAL' as const, label: 'Fișă medicală completă' },
    { id: 'DOCS' as const, label: `Documente${documents.length > 0 ? ` (${documents.length})` : ''}` },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition"
            style={
              tab === t.id
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--surface-muted)', color: 'var(--foreground)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'SIMPLE' && <div className="card p-5">{simpleForm}</div>}
      {tab === 'MEDICAL' && <MedicalRecordForm customerId={customerId} initial={medicalRecordInitial} />}
      {tab === 'DOCS' && <PatientDocuments customerId={customerId} documents={documents} />}
    </div>
  )
}

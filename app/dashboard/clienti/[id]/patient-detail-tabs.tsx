'use client'

import { useState } from 'react'
import MedicalRecordForm from './medical-record-form'
import PatientDocuments from './patient-documents'
import MedicalLetterForm from './medical-letter-form'

export default function PatientDetailTabs({
  simpleForm,
  customerId,
  patientName,
  medicalRecordInitial,
  documents,
  letters,
}: {
  simpleForm: React.ReactNode
  customerId: string
  patientName: string
  medicalRecordInitial: any
  documents: { id: string; url: string; filename: string; uploadedAt: string }[]
  letters: Record<string, any>[]
}) {
  const [tab, setTab] = useState<'SIMPLE' | 'MEDICAL' | 'LETTER' | 'DOCS'>('SIMPLE')

  const tabs = [
    { id: 'SIMPLE' as const, label: 'Fișă simplă' },
    { id: 'MEDICAL' as const, label: 'Fișă medicală completă' },
    { id: 'LETTER' as const, label: `Scrisoare medicală${letters.length > 0 ? ` (${letters.length})` : ''}` },
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
      {tab === 'MEDICAL' && <MedicalRecordForm customerId={customerId} initial={medicalRecordInitial} patientName={patientName} />}
      {tab === 'LETTER' && <MedicalLetterForm customerId={customerId} patientName={patientName} letters={letters} />}
      {tab === 'DOCS' && <PatientDocuments customerId={customerId} documents={documents} />}
    </div>
  )
}

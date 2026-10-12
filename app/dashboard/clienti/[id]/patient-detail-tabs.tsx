'use client'

import { useState } from 'react'
import PatientRecordForm from './patient-record-form'
import PatientDocuments from './patient-documents'
import MedicalLetterForm from './medical-letter-form'
import dynamic from 'next/dynamic'

const DentalChart = dynamic(() => import('./dental-chart'), {
  ssr: false,
  loading: () => <div className="card min-h-80 animate-pulse text-sm text-gray-500">Se încarcă odontograma 3D…</div>,
})

export default function PatientDetailTabs({
  customerId,
  patientName,
  simpleInitial,
  medicalRecordInitial,
  dentalClinic,
  documents,
  letters,
}: {
  customerId: string
  patientName: string
  simpleInitial: { name: string; phone: string; email: string; notes: string; dateOfBirth: string; allergies: string; medicalNotes: string }
  medicalRecordInitial: any
  dentalClinic: boolean
  documents: { id: string; url: string; filename: string; uploadedAt: string }[]
  letters: Record<string, any>[]
}) {
  const [tab, setTab] = useState<'RECORD' | 'DENTAL' | 'LETTER' | 'DOCS'>('RECORD')

  const tabs = [
    { id: 'RECORD' as const, label: 'Fișă pacient' },
    ...(dentalClinic ? [{ id: 'DENTAL' as const, label: 'Odontogramă 3D' }] : []),
    { id: 'LETTER' as const, label: `Scrisoare medicală${letters.length > 0 ? ` (${letters.length})` : ''}` },
    { id: 'DOCS' as const, label: `Documente${documents.length > 0 ? ` (${documents.length})` : ''}` },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1 screen-only">
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

      {tab === 'RECORD' && <PatientRecordForm customerId={customerId} simpleInitial={simpleInitial} medicalInitial={medicalRecordInitial} />}
      {tab === 'DENTAL' && dentalClinic && <DentalChart customerId={customerId} patientName={patientName} initialChart={medicalRecordInitial?.dentalHistory ?? null} />}
      {tab === 'LETTER' && <MedicalLetterForm customerId={customerId} patientName={patientName} letters={letters} />}
      {tab === 'DOCS' && <PatientDocuments customerId={customerId} patientName={patientName} documents={documents} />}
    </div>
  )
}

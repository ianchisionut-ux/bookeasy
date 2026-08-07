'use client'

import { useState } from 'react'
import CustomerEditForm from './customer-edit-form'
import MedicalRecordForm from './medical-record-form'
import { exportSectionsToPdf } from '@/lib/pdf-export'

export default function PatientFileTab({
  customerId,
  patientName,
  simpleInitial,
  medicalRecordInitial,
}: {
  customerId: string
  patientName: string
  simpleInitial: {
    name: string
    phone: string
    email: string
    notes: string
    dateOfBirth: string
    allergies: string
    medicalNotes: string
  }
  medicalRecordInitial: any
}) {
  const [expanded, setExpanded] = useState(false)

  function handlePrint() {
    // dacă fișa completă e ascunsă, o arătăm întâi — la print vrem tot, nu doar partea simplă
    if (!expanded) {
      setExpanded(true)
      setTimeout(() => window.print(), 150)
    } else {
      window.print()
    }
  }

  function exportPdf() {
    const r = medicalRecordInitial ?? {}
    const allergyList = [
      r.allergyAnesthesia && 'Anestezie',
      r.allergyAntibiotics && 'Antibiotice',
      r.allergyAspirin && 'Aspirină',
      r.allergyIodine && 'Iod',
      r.allergyLatex && 'Latex',
      r.allergyNickel && 'Nichel',
      r.allergyOther,
    ]
      .filter(Boolean)
      .join(', ')

    const conditionsList = Object.entries(r.medicalConditions ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ')

    exportSectionsToPdf(`fisa-pacient-${patientName.replace(/\s+/g, '-')}.pdf`, 'Fișa pacientului', patientName, [
      {
        title: 'Date de contact',
        rows: [
          { label: 'Nume', value: simpleInitial.name },
          { label: 'Telefon', value: simpleInitial.phone },
          { label: 'Email', value: simpleInitial.email },
          { label: 'Data nașterii', value: simpleInitial.dateOfBirth },
        ],
      },
      {
        title: 'Medical (pe scurt)',
        rows: [
          { label: 'Alergii cunoscute', value: simpleInitial.allergies },
          { label: 'Istoric medical', value: simpleInitial.medicalNotes },
        ],
      },
      { title: 'Notițe interne', rows: [{ label: 'Notițe', value: simpleInitial.notes }] },
      {
        title: 'Date personale (fișă completă)',
        rows: [
          { label: 'CNP', value: r.cnp },
          { label: 'Ocupație', value: r.occupation },
          { label: 'Adresă', value: r.address },
          { label: 'Localitate/Județ', value: r.city },
        ],
      },
      {
        title: 'Contact urgență',
        rows: [
          { label: 'Nume', value: r.emergencyContactName },
          { label: 'Telefon', value: r.emergencyContactPhone },
        ],
      },
      {
        title: 'Medici anteriori',
        rows: [
          { label: 'Medic de familie', value: r.familyDoctor },
          { label: 'Medic dentist anterior', value: r.previousDentist },
        ],
      },
      { title: 'Alergii detaliate', rows: [{ label: 'Alergii', value: allergyList }] },
      { title: 'Probleme medicale cunoscute', rows: [{ label: 'Afecțiuni', value: conditionsList }] },
      { title: 'Alte mențiuni', rows: [{ label: 'Note', value: r.generalNotes }] },
    ])
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4 no-print">
        <button onClick={handlePrint} className="btn-secondary text-sm">
          🖨 Printează fișa completă
        </button>
        <button onClick={exportPdf} className="btn-secondary text-sm">
          ⬇ Export PDF complet
        </button>
      </div>

      <div className="card p-5 mb-4">
        <CustomerEditForm customerId={customerId} isClinic={true} initial={simpleInitial} />
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left card card-interactive p-4 text-sm font-medium text-[var(--accent)] no-print"
        >
          + Adaugă / completează fișa medicală detaliată (istoric, alergii, fișă stomatologică)
        </button>
      ) : (
        <>
          <button onClick={() => setExpanded(false)} className="text-sm text-gray-500 mb-3 no-print">
            ← Ascunde fișa medicală detaliată
          </button>
          <MedicalRecordForm customerId={customerId} initial={medicalRecordInitial} patientName={patientName} />
        </>
      )}
    </div>
  )
}

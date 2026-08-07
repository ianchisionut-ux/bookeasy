'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { exportSectionsToPdf } from '@/lib/pdf-export'

type Letter = Record<string, any>

const EMPTY: Letter = {
  providerName: '',
  doctorName: '',
  contractNumber: '',
  casName: '',
  patientName: '',
  patientBirthDate: '',
  patientCnp: '',
  consultationDate: '',
  hospitalizationPeriod: '',
  fileNumber: '',
  presentationReasons: '',
  oncologicalDiagnosis: false,
  diagnosis: '',
  anamnesis: '',
  riskFactors: '',
  clinicalExamGeneral: '',
  clinicalExamLocal: '',
  labNormal: '',
  labPathological: '',
  ekg: '',
  eco: '',
  rx: '',
  otherParaclinical: '',
  treatmentGiven: '',
  otherHealthInfo: '',
  recommendedTreatment: '',
  returnForHospitalization: '',
  prescriptionStatus: '',
  medicalLeaveStatus: '',
  homeCareStatus: '',
  deviceStatus: '',
  letterDate: '',
}

export default function MedicalLetterForm({
  customerId,
  patientName,
  letters,
}: {
  customerId: string
  patientName: string
  letters: Letter[]
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Letter>({ ...EMPTY, patientName })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startNew() {
    setForm({ ...EMPTY, patientName })
    setEditingId('NEW')
  }

  function startEdit(letter: Letter) {
    setForm(letter)
    setEditingId(letter.id)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const isNew = editingId === 'NEW'
      const url = isNew
        ? `/api/business/patients/${customerId}/medical-letters`
        : `/api/business/patients/${customerId}/medical-letters/${editingId}`
      const res = await fetchWithTimeout(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setEditingId(null)
      router.refresh()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteLetter(id: string) {
    if (!confirm('Ștergi această scrisoare medicală?')) return
    try {
      await fetchWithTimeout(`/api/business/patients/${customerId}/medical-letters/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  function exportPdf(letter: Letter) {
    exportSectionsToPdf(
      `scrisoare-medicala-${(letter.patientName || 'pacient').replace(/\s+/g, '-')}.pdf`,
      'Scrisoare medicală',
      `${letter.providerName ?? ''} · ${letter.doctorName ?? ''}`,
      [
        {
          title: 'Date furnizor',
          rows: [
            { label: 'Denumire furnizor', value: letter.providerName },
            { label: 'Medic', value: letter.doctorName },
            { label: 'Contract/convenție nr.', value: letter.contractNumber },
            { label: 'CAS', value: letter.casName },
          ],
        },
        {
          title: 'Date pacient',
          rows: [
            { label: 'Nume', value: letter.patientName },
            { label: 'Data nașterii', value: letter.patientBirthDate },
            { label: 'CNP', value: letter.patientCnp },
            { label: 'Data consultației', value: letter.consultationDate },
            { label: 'Perioadă internare', value: letter.hospitalizationPeriod },
            { label: 'Nr. F.O. / Registru consultații', value: letter.fileNumber },
          ],
        },
        {
          title: 'Motivul prezentării',
          rows: [
            { label: 'Motive', value: letter.presentationReasons },
            { label: 'Afecțiune oncologică', value: letter.oncologicalDiagnosis ? 'Da' : 'Nu' },
            { label: 'Diagnostic și cod', value: letter.diagnosis },
          ],
        },
        {
          title: 'Anamneză',
          rows: [
            { label: 'Anamneză', value: letter.anamnesis },
            { label: 'Factori de risc', value: letter.riskFactors },
          ],
        },
        {
          title: 'Examen clinic',
          rows: [
            { label: 'General', value: letter.clinicalExamGeneral },
            { label: 'Local', value: letter.clinicalExamLocal },
          ],
        },
        {
          title: 'Examene de laborator',
          rows: [
            { label: 'Valori normale', value: letter.labNormal },
            { label: 'Valori patologice', value: letter.labPathological },
          ],
        },
        {
          title: 'Examene paraclinice',
          rows: [
            { label: 'EKG', value: letter.ekg },
            { label: 'ECO', value: letter.eco },
            { label: 'Rx', value: letter.rx },
            { label: 'Altele', value: letter.otherParaclinical },
          ],
        },
        {
          title: 'Tratament',
          rows: [
            { label: 'Tratament efectuat', value: letter.treatmentGiven },
            { label: 'Alte informații', value: letter.otherHealthInfo },
            { label: 'Tratament recomandat', value: letter.recommendedTreatment },
          ],
        },
        {
          title: 'Concluzii',
          rows: [
            { label: 'Revenire pentru internare', value: letter.returnForHospitalization },
            { label: 'Prescripție medicală', value: letter.prescriptionStatus },
            { label: 'Concediu medical', value: letter.medicalLeaveStatus },
            { label: 'Îngrijiri la domiciliu', value: letter.homeCareStatus },
            { label: 'Dispozitive medicale', value: letter.deviceStatus },
            { label: 'Data', value: letter.letterDate },
          ],
        },
      ]
    )
  }

  if (editingId) {
    return (
      <Card>
        <h3 className="font-medium mb-4">{editingId === 'NEW' ? 'Scrisoare medicală nouă' : 'Editează scrisoarea'}</h3>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium mb-2">Date furnizor</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Denumire furnizor" value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} />
              <Input placeholder="Medic" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
              <Input placeholder="Contract/convenție nr." value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} />
              <Input placeholder="CAS" value={form.casName} onChange={(e) => setForm({ ...form, casName: e.target.value })} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Date pacient</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Nume pacient" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
              <Input placeholder="Data nașterii" value={form.patientBirthDate} onChange={(e) => setForm({ ...form, patientBirthDate: e.target.value })} />
              <Input placeholder="CNP" value={form.patientCnp} onChange={(e) => setForm({ ...form, patientCnp: e.target.value })} />
              <Input placeholder="Data consultației" value={form.consultationDate} onChange={(e) => setForm({ ...form, consultationDate: e.target.value })} />
              <Input placeholder="Perioadă internare" value={form.hospitalizationPeriod} onChange={(e) => setForm({ ...form, hospitalizationPeriod: e.target.value })} />
              <Input placeholder="Nr. F.O. / Registru consultații" value={form.fileNumber} onChange={(e) => setForm({ ...form, fileNumber: e.target.value })} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Motivul prezentării</p>
            <Textarea
              placeholder="Motivele prezentării"
              value={form.presentationReasons}
              onChange={(e) => setForm({ ...form, presentationReasons: e.target.value })}
              className="mb-2"
            />
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={!!form.oncologicalDiagnosis}
                onChange={(e) => setForm({ ...form, oncologicalDiagnosis: e.target.checked })}
              />
              Pacient diagnosticat cu afecțiune oncologică
            </label>
            <Textarea placeholder="Diagnosticul și codul de diagnostic" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Anamneză</p>
            <Textarea placeholder="Anamneză" value={form.anamnesis} onChange={(e) => setForm({ ...form, anamnesis: e.target.value })} className="mb-2" />
            <Input placeholder="Factori de risc" value={form.riskFactors} onChange={(e) => setForm({ ...form, riskFactors: e.target.value })} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Examen clinic</p>
            <Textarea placeholder="General" value={form.clinicalExamGeneral} onChange={(e) => setForm({ ...form, clinicalExamGeneral: e.target.value })} className="mb-2" />
            <Textarea placeholder="Local" value={form.clinicalExamLocal} onChange={(e) => setForm({ ...form, clinicalExamLocal: e.target.value })} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Examene de laborator</p>
            <Textarea placeholder="Cu valori normale" value={form.labNormal} onChange={(e) => setForm({ ...form, labNormal: e.target.value })} className="mb-2" />
            <Textarea placeholder="Cu valori patologice" value={form.labPathological} onChange={(e) => setForm({ ...form, labPathological: e.target.value })} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Examene paraclinice</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="EKG" value={form.ekg} onChange={(e) => setForm({ ...form, ekg: e.target.value })} />
              <Input placeholder="ECO" value={form.eco} onChange={(e) => setForm({ ...form, eco: e.target.value })} />
              <Input placeholder="Rx" value={form.rx} onChange={(e) => setForm({ ...form, rx: e.target.value })} />
              <Input placeholder="Altele" value={form.otherParaclinical} onChange={(e) => setForm({ ...form, otherParaclinical: e.target.value })} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Tratament</p>
            <Textarea placeholder="Tratament efectuat" value={form.treatmentGiven} onChange={(e) => setForm({ ...form, treatmentGiven: e.target.value })} className="mb-2" />
            <Textarea placeholder="Alte informații despre starea de sănătate" value={form.otherHealthInfo} onChange={(e) => setForm({ ...form, otherHealthInfo: e.target.value })} className="mb-2" />
            <Textarea placeholder="Tratament recomandat" value={form.recommendedTreatment} onChange={(e) => setForm({ ...form, recommendedTreatment: e.target.value })} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Concluzii</p>
            <div className="grid grid-cols-1 gap-2">
              <Input placeholder="Revenire pentru internare (da, în termen de.. / nu)" value={form.returnForHospitalization} onChange={(e) => setForm({ ...form, returnForHospitalization: e.target.value })} />
              <Input placeholder="Status prescripție medicală" value={form.prescriptionStatus} onChange={(e) => setForm({ ...form, prescriptionStatus: e.target.value })} />
              <Input placeholder="Status concediu medical" value={form.medicalLeaveStatus} onChange={(e) => setForm({ ...form, medicalLeaveStatus: e.target.value })} />
              <Input placeholder="Status îngrijiri la domiciliu" value={form.homeCareStatus} onChange={(e) => setForm({ ...form, homeCareStatus: e.target.value })} />
              <Input placeholder="Status dispozitive medicale" value={form.deviceStatus} onChange={(e) => setForm({ ...form, deviceStatus: e.target.value })} />
              <Input placeholder="Data" value={form.letterDate} onChange={(e) => setForm({ ...form, letterDate: e.target.value })} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează scrisoarea'}
            </Button>
            <Button variant="secondary" onClick={() => setEditingId(null)}>
              Anulează
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={startNew} className="self-start">
        + Scrisoare medicală nouă
      </Button>

      {letters.length === 0 ? (
        <p className="text-sm text-gray-500">Nicio scrisoare medicală încă.</p>
      ) : (
        letters.map((letter) => (
          <Card key={letter.id}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium">{letter.diagnosis || 'Scrisoare medicală'}</p>
              <span className="text-xs text-gray-400">{letter.consultationDate || ''}</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">{letter.presentationReasons}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => startEdit(letter)} className="text-xs text-[var(--accent)] font-medium">
                Editează
              </button>
              <button onClick={() => window.print()} className="text-xs text-gray-600 font-medium">
                🖨 Printează
              </button>
              <button onClick={() => exportPdf(letter)} className="text-xs text-gray-600 font-medium">
                ⬇ Export PDF
              </button>
              <button onClick={() => deleteLetter(letter.id)} className="text-xs text-red-600 font-medium">
                Șterge
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

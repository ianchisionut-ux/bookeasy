'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChecklistGrid } from '@/components/checklist-grid'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { exportSectionsToPdf } from '@/lib/pdf-export'

const MEDICAL_CONDITIONS = [
  { key: 'hipertensiune', label: 'Hipertensiune' },
  { key: 'hipotensiune', label: 'Hipotensiune' },
  { key: 'diabet', label: 'Diabet' },
  { key: 'reumatism', label: 'Reumatism' },
  { key: 'anemie', label: 'Anemie' },
  { key: 'tiroida', label: 'Probleme tiroidiene' },
  { key: 'astm', label: 'Astm' },
  { key: 'respiratorii', label: 'Probleme respiratorii' },
  { key: 'artrita', label: 'Artrită' },
  { key: 'hemofilie', label: 'Hemofilie' },
  { key: 'despicaturi', label: 'Despicături labio-maxilo-palatine' },
  { key: 'vorbit', label: 'Probleme la vorbit' },
  { key: 'auz', label: 'Probleme de auz' },
  { key: 'vaz', label: 'Probleme de văz / lentile de contact' },
  { key: 'ficat', label: 'Probleme cu ficatul' },
  { key: 'coagulare', label: 'Alte probleme de coagulare' },
  { key: 'stomac', label: 'Boli de stomac' },
  { key: 'rinichi', label: 'Boli de rinichi' },
  { key: 'hiv', label: 'HIV / SIDA' },
  { key: 'greutate', label: 'Pierderi de greutate' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'leucemie', label: 'Leucemie' },
  { key: 'epilepsie', label: 'Epilepsie (convulsii)' },
  { key: 'radioterapie', label: 'Radio / chimioterapie' },
  { key: 'crestere', label: 'Deficiențe de creștere' },
  { key: 'adhd', label: 'ADHD' },
  { key: 'osteoporoza', label: 'Osteoporoză' },
  { key: 'neurologice', label: 'Boli neurologice sau psihice' },
  { key: 'tuberculoza', label: 'Tuberculoză' },
]

const FEAR_ITEMS = [
  { key: 'dentist', label: 'Dentist' },
  { key: 'frezaZgomot', label: 'Zgomotul frezei' },
  { key: 'acSeringa', label: 'Acul de seringă' },
  { key: 'mirosSubstante', label: 'Mirosul unor substanțe' },
  { key: 'injectie', label: 'Injecție' },
  { key: 'durere', label: 'Durere' },
  { key: 'alteZgomote', label: 'Alte zgomote din cabinet' },
]

export default function MedicalRecordForm({ customerId, initial, patientName }: { customerId: string; initial: any; patientName: string }) {
  const [form, setForm] = useState({
    cnp: initial?.cnp ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    occupation: initial?.occupation ?? '',
    emergencyContactName: initial?.emergencyContactName ?? '',
    emergencyContactPhone: initial?.emergencyContactPhone ?? '',
    familyDoctor: initial?.familyDoctor ?? '',
    familyDoctorLastVisit: initial?.familyDoctorLastVisit ?? '',
    previousDentist: initial?.previousDentist ?? '',
    previousDentistLastVisit: initial?.previousDentistLastVisit ?? '',
    hospitalized: initial?.hospitalized ?? false,
    hospitalizedDetails: initial?.hospitalizedDetails ?? '',
    surgeries: initial?.surgeries ?? false,
    surgeriesDetails: initial?.surgeriesDetails ?? '',
    onMedication: initial?.onMedication ?? false,
    medicationDetails: initial?.medicationDetails ?? '',
    smoker: initial?.smoker ?? false,
    allergyAnesthesia: initial?.allergyAnesthesia ?? false,
    allergyAntibiotics: initial?.allergyAntibiotics ?? false,
    allergyAspirin: initial?.allergyAspirin ?? false,
    allergyIodine: initial?.allergyIodine ?? false,
    allergyLatex: initial?.allergyLatex ?? false,
    allergyNickel: initial?.allergyNickel ?? false,
    allergyOther: initial?.allergyOther ?? '',
    pregnant: initial?.pregnant ?? false,
    pregnantMonth: initial?.pregnantMonth ?? '',
    breastfeeding: initial?.breastfeeding ?? false,
    menstruationStarted: initial?.menstruationStarted ?? false,
    contraceptives: initial?.contraceptives ?? false,
    menopause: initial?.menopause ?? false,
    generalNotes: initial?.generalNotes ?? '',
  })
  const [conditions, setConditions] = useState<Record<string, boolean>>(initial?.medicalConditions ?? {})
  const [fears, setFears] = useState<Record<string, boolean>>(initial?.dentalHistory?.fears ?? {})
  const [dental, setDental] = useState({
    bleedingGums: initial?.dentalHistory?.bleedingGums ?? false,
    brushingFrequency: initial?.dentalHistory?.brushingFrequency ?? '',
    mouthSores: initial?.dentalHistory?.mouthSores ?? false,
    cheekBiting: initial?.dentalHistory?.cheekBiting ?? false,
    teethGrinding: initial?.dentalHistory?.teethGrinding ?? false,
    teethGrindingTime: initial?.dentalHistory?.teethGrindingTime ?? '',
    previousBraces: initial?.dentalHistory?.previousBraces ?? false,
    previousBracesWhen: initial?.dentalHistory?.previousBracesWhen ?? '',
    jawSounds: initial?.dentalHistory?.jawSounds ?? false,
    jawLocked: initial?.dentalHistory?.jawLocked ?? false,
    difficultExtractions: initial?.dentalHistory?.difficultExtractions ?? false,
    extractionProblems: initial?.dentalHistory?.extractionProblems ?? '',
    injectionReaction: initial?.dentalHistory?.injectionReaction ?? '',
    oralSurgery: initial?.dentalHistory?.oralSurgery ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout(`/api/business/patients/${customerId}/medical-record`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          medicalConditions: conditions,
          dentalHistory: { ...dental, fears },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }))
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  function exportPdf() {
    const allergyList = [
      form.allergyAnesthesia && 'Anestezie',
      form.allergyAntibiotics && 'Antibiotice',
      form.allergyAspirin && 'Aspirină',
      form.allergyIodine && 'Iod',
      form.allergyLatex && 'Latex',
      form.allergyNickel && 'Nichel',
      form.allergyOther,
    ]
      .filter(Boolean)
      .join(', ')

    const conditionsList = Object.entries(conditions)
      .filter(([, v]) => v)
      .map(([k]) => MEDICAL_CONDITIONS.find((c) => c.key === k)?.label ?? k)
      .join(', ')

    const fearsList = Object.entries(fears)
      .filter(([, v]) => v)
      .map(([k]) => FEAR_ITEMS.find((f) => f.key === k)?.label ?? k)
      .join(', ')

    exportSectionsToPdf(`fisa-medicala-${patientName.replace(/\s+/g, '-')}.pdf`, 'Fișa pacientului', patientName, [
      {
        title: 'Date personale',
        rows: [
          { label: 'CNP', value: form.cnp },
          { label: 'Ocupație', value: form.occupation },
          { label: 'Adresă', value: form.address },
          { label: 'Localitate/Județ', value: form.city },
        ],
      },
      {
        title: 'Contact urgență',
        rows: [
          { label: 'Nume', value: form.emergencyContactName },
          { label: 'Telefon', value: form.emergencyContactPhone },
        ],
      },
      {
        title: 'Medici anteriori',
        rows: [
          { label: 'Medic de familie', value: form.familyDoctor },
          { label: 'Ultima consultație', value: form.familyDoctorLastVisit },
          { label: 'Medic dentist anterior', value: form.previousDentist },
          { label: 'Ultima consultație', value: form.previousDentistLastVisit },
        ],
      },
      {
        title: 'Istoric medical',
        rows: [
          { label: 'Spitalizat', value: form.hospitalized ? form.hospitalizedDetails || 'Da' : '' },
          { label: 'Intervenții chirurgicale', value: form.surgeries ? form.surgeriesDetails || 'Da' : '' },
          { label: 'Medicație curentă', value: form.onMedication ? form.medicationDetails || 'Da' : '' },
          { label: 'Fumător', value: form.smoker ? 'Da' : '' },
        ],
      },
      { title: 'Alergii', rows: [{ label: 'Alergii cunoscute', value: allergyList }] },
      { title: 'Probleme medicale cunoscute', rows: [{ label: 'Afecțiuni', value: conditionsList }] },
      {
        title: 'Fișă stomatologică',
        rows: [
          { label: 'Frici', value: fearsList },
          { label: 'Sângerare gingii', value: dental.bleedingGums ? 'Da' : '' },
          { label: 'Frecvență periaj', value: dental.brushingFrequency },
          { label: 'Scrâșnit dinți', value: dental.teethGrinding ? dental.teethGrindingTime || 'Da' : '' },
          { label: 'Aparat dentar anterior', value: dental.previousBraces ? dental.previousBracesWhen || 'Da' : '' },
          { label: 'Extracții dificile', value: dental.difficultExtractions ? dental.extractionProblems || 'Da' : '' },
        ],
      },
      { title: 'Alte mențiuni', rows: [{ label: 'Note', value: form.generalNotes }] },
    ])
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="font-medium mb-3">Date personale</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="CNP" value={form.cnp} onChange={(e) => setForm({ ...form, cnp: e.target.value })} />
          <Input placeholder="Ocupație" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
          <Input placeholder="Adresă" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input placeholder="Localitate / Județ" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Contact în caz de urgență</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Nume" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
          <Input placeholder="Telefon" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
        </div>
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Medici anteriori</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Input placeholder="Medic de familie" value={form.familyDoctor} onChange={(e) => setForm({ ...form, familyDoctor: e.target.value })} />
          <Input
            placeholder="Data ultimei consultații"
            value={form.familyDoctorLastVisit}
            onChange={(e) => setForm({ ...form, familyDoctorLastVisit: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Medic dentist anterior" value={form.previousDentist} onChange={(e) => setForm({ ...form, previousDentist: e.target.value })} />
          <Input
            placeholder="Data ultimei consultații"
            value={form.previousDentistLastVisit}
            onChange={(e) => setForm({ ...form, previousDentistLastVisit: e.target.value })}
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Istoric medical general</h3>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={form.hospitalized} onChange={(e) => setForm({ ...form, hospitalized: e.target.checked })} />
              Ați fost spitalizat(ă)?
            </label>
            {form.hospitalized && (
              <Input
                placeholder="Anul și motivul"
                value={form.hospitalizedDetails}
                onChange={(e) => setForm({ ...form, hospitalizedDetails: e.target.value })}
              />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={form.surgeries} onChange={(e) => setForm({ ...form, surgeries: e.target.checked })} />
              Ați suferit intervenții chirurgicale?
            </label>
            {form.surgeries && (
              <Input placeholder="Anul și ce anume" value={form.surgeriesDetails} onChange={(e) => setForm({ ...form, surgeriesDetails: e.target.value })} />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={form.onMedication} onChange={(e) => setForm({ ...form, onMedication: e.target.checked })} />
              Luați medicamente în prezent?
            </label>
            {form.onMedication && (
              <Input placeholder="Ce anume și pentru ce" value={form.medicationDetails} onChange={(e) => setForm({ ...form, medicationDetails: e.target.value })} />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.smoker} onChange={(e) => setForm({ ...form, smoker: e.target.checked })} />
            Fumător
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Alergii</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
          {[
            ['allergyAnesthesia', 'Anestezie'],
            ['allergyAntibiotics', 'Antibiotice'],
            ['allergyAspirin', 'Aspirină'],
            ['allergyIodine', 'Iod'],
            ['allergyLatex', 'Latex'],
            ['allergyNickel', 'Nichel'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <Input placeholder="Alte alergii" value={form.allergyOther} onChange={(e) => setForm({ ...form, allergyOther: e.target.value })} />
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Doar pentru femei</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pregnant} onChange={(e) => setForm({ ...form, pregnant: e.target.checked })} />
              Însărcinată
            </label>
            {form.pregnant && (
              <Input
                placeholder="Luna"
                value={form.pregnantMonth}
                onChange={(e) => setForm({ ...form, pregnantMonth: e.target.value })}
                className="max-w-[120px]"
              />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.breastfeeding} onChange={(e) => setForm({ ...form, breastfeeding: e.target.checked })} />
            Alăptează
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.contraceptives}
              onChange={(e) => setForm({ ...form, contraceptives: e.target.checked })}
            />
            Folosește anticoncepționale
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.menopause} onChange={(e) => setForm({ ...form, menopause: e.target.checked })} />
            S-a instalat menopauza
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Probleme medicale cunoscute</h3>
        <ChecklistGrid items={MEDICAL_CONDITIONS} value={conditions} onChange={(k, v) => setConditions({ ...conditions, [k]: v })} />
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Fișă stomatologică</h3>
        <p className="text-sm text-gray-500 mb-2">Vă este frică de:</p>
        <ChecklistGrid items={FEAR_ITEMS} value={fears} onChange={(k, v) => setFears({ ...fears, [k]: v })} />

        <div className="flex flex-col gap-2.5 mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dental.bleedingGums} onChange={(e) => setDental({ ...dental, bleedingGums: e.target.checked })} />
            Sângerează gingiile la periaj
          </label>
          <Input
            placeholder="De câte ori vă periați pe dinți?"
            value={dental.brushingFrequency}
            onChange={(e) => setDental({ ...dental, brushingFrequency: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dental.mouthSores} onChange={(e) => setDental({ ...dental, mouthSores: e.target.checked })} />
            Inflamații sau răni în gură care durează mai mult timp
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dental.cheekBiting} onChange={(e) => setDental({ ...dental, cheekBiting: e.target.checked })} />
            Se mușcă des pe obraji sau limbă
          </label>
          <div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={dental.teethGrinding} onChange={(e) => setDental({ ...dental, teethGrinding: e.target.checked })} />
              Strânge/scrâșnește din dinți
            </label>
            {dental.teethGrinding && (
              <Input
                placeholder="Ziua sau noaptea?"
                value={dental.teethGrindingTime}
                onChange={(e) => setDental({ ...dental, teethGrindingTime: e.target.value })}
              />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input type="checkbox" checked={dental.previousBraces} onChange={(e) => setDental({ ...dental, previousBraces: e.target.checked })} />
              A purtat aparat dentar anterior
            </label>
            {dental.previousBraces && (
              <Input placeholder="Când?" value={dental.previousBracesWhen} onChange={(e) => setDental({ ...dental, previousBracesWhen: e.target.value })} />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dental.jawSounds} onChange={(e) => setDental({ ...dental, jawSounds: e.target.checked })} />
            Zgomote/scârțâituri la nivelul maxilarului
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dental.jawLocked} onChange={(e) => setDental({ ...dental, jawLocked: e.target.checked })} />
            A rămas blocat cu gura deschisă
          </label>
          <div>
            <label className="flex items-center gap-2 text-sm mb-1">
              <input
                type="checkbox"
                checked={dental.difficultExtractions}
                onChange={(e) => setDental({ ...dental, difficultExtractions: e.target.checked })}
              />
              A avut extracții dificile / probleme după extracții
            </label>
            {dental.difficultExtractions && (
              <Input
                placeholder="Descriere pe scurt"
                value={dental.extractionProblems}
                onChange={(e) => setDental({ ...dental, extractionProblems: e.target.value })}
              />
            )}
          </div>
          <Input
            placeholder="Probleme după anestezie (dacă e cazul)"
            value={dental.injectionReaction}
            onChange={(e) => setDental({ ...dental, injectionReaction: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dental.oralSurgery} onChange={(e) => setDental({ ...dental, oralSurgery: e.target.checked })} />
            A suferit intervenții chirurgicale la nivelul cavității bucale
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="font-medium mb-3">Alte mențiuni</h3>
        <Textarea
          value={form.generalNotes}
          onChange={(e) => setForm({ ...form, generalNotes: e.target.value })}
          placeholder="Orice altă problemă relevantă pentru starea de sănătate..."
          className="min-h-[80px]"
        />
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează fișa medicală'}
        </Button>
        <button onClick={() => window.print()} className="btn-secondary text-sm">
          🖨 Printează
        </button>
        <button onClick={exportPdf} className="btn-secondary text-sm">
          ⬇ Export PDF
        </button>
        {savedAt && <span className="text-xs text-gray-500">Salvat la {savedAt}</span>}
      </div>
    </div>
  )
}

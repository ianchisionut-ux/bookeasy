import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import CustomerEditForm from './customer-edit-form'
import PatientDetailTabs from './patient-detail-tabs'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { BackLink } from '@/components/ui/back-link'
import { bookingTerminology, isPatientCategory } from '@/lib/business-categories'
import Link from 'next/link'
import { Dumbbell, ArrowUpRight } from 'lucide-react'
import ArchiveCustomerButton from './archive-customer-button'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const businessId = (session as any)?.businessId

  if (!businessId) notFound()

  // Filtrăm clientul direct după businessId. Verificarea doar a autentificării nu este
  // suficientă: un ID cunoscut nu trebuie să poată expune datele altui business.
  const [customer, business] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, businessId, archivedAt: null },
      include: { bookings: { include: { service: true, practitioner: true }, orderBy: { startAt: 'desc' } } },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true, dentalClinic: true } }),
  ])

  if (!customer) notFound()

  const [medicalRecord, documents, letters] = await Promise.all([
    prisma.patientMedicalRecord.findUnique({ where: { customerId: customer.id } }),
    prisma.patientDocument.findMany({ where: { customerId: customer.id, businessId }, orderBy: { uploadedAt: 'desc' } }),
    prisma.medicalLetter.findMany({ where: { customerId: customer.id, businessId }, orderBy: { createdAt: 'desc' } }),
  ])
  const isClinic = isPatientCategory(business?.category)
  const patientName = customer.name ?? customer.phone ?? 'Fără nume'

  const simpleInitial = {
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    notes: customer.notes ?? '',
    dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.toISOString().slice(0, 10) : '',
    allergies: customer.allergies ?? '',
    medicalNotes: customer.medicalNotes ?? '',
  }

  return (
    <div className="dashboard-page">
      <div className="mb-4 screen-only">
        <BackLink href="/dashboard/clienti" label={`Înapoi la ${isClinic ? 'pacienți' : 'clienți'}`} />
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 screen-only"><h1 className="text-2xl font-semibold">{customer.name ?? 'Fără nume'}</h1><ArchiveCustomerButton id={customer.id} label={isClinic ? 'pacientul' : 'clientul'} /></div>
      {business?.category === 'FITNESS' && <Link href={`/dashboard/fitness?client=${customer.id}`} className="card mb-5 flex items-center gap-3 p-5 text-[var(--brand-teal-dark)]"><Dumbbell size={23} /><span className="flex-1"><strong className="block text-sm">Fișa de coaching</strong><span className="text-xs text-gray-500">Planuri de antrenament, nutriție, sarcini și acces PWA</span></span><ArrowUpRight size={18} /></Link>}

      {business?.category === 'CLINICA' ? (
        <PatientDetailTabs
          customerId={customer.id}
          patientName={patientName}
          simpleInitial={simpleInitial}
          medicalRecordInitial={medicalRecord}
          dentalClinic={business?.dentalClinic === true}
          documents={documents.map((d) => ({
            id: d.id,
            url: `/api/business/patients/${customer.id}/documents/${d.id}`,
            filename: d.filename,
            uploadedAt: d.uploadedAt.toISOString(),
          }))}
          letters={letters.map((l) => ({ ...l, id: l.id }))}
        />
      ) : (
        <Card className="mb-8">
          <h2 className="font-medium mb-4">Date {isClinic ? 'pacient' : 'client'}</h2>
          <CustomerEditForm customerId={customer.id} isClinic={isClinic} initial={simpleInitial} />
        </Card>
      )}

      <div className="screen-only">
        <h2 className="text-lg font-medium mb-3 mt-8">Istoric {bookingTerminology(business?.category).plural}</h2>
        <div className="flex flex-col gap-2">
          {customer.bookings.map((b) => (
            <Card key={b.id} className="flex items-center justify-between py-3">
              <span className="font-medium">
                {b.service.name}
                {b.practitioner ? ` · ${b.practitioner.name}` : ''}
              </span>
              <span className="text-gray-500 text-sm">{b.startAt.toLocaleString('ro-RO', { hour12: false, timeZone: 'Europe/Bucharest' })}</span>
              <Pill tone={b.status === 'CONFIRMED' ? 'success' : b.status === 'CANCELLED' ? 'danger' : 'neutral'}>
                {b.status}
              </Pill>
            </Card>
          ))}
          {customer.bookings.length === 0 && <p className="text-sm text-gray-500">Niciun istoric încă.</p>}
        </div>
      </div>
    </div>
  )
}

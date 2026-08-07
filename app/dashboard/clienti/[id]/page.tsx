import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import CustomerEditForm from './customer-edit-form'
import PatientDetailTabs from './patient-detail-tabs'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { BackLink } from '@/components/ui/back-link'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const businessId = (session as any)?.businessId

  const [customer, business, medicalRecord, documents, letters] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: { bookings: { include: { service: true, practitioner: true }, orderBy: { startAt: 'desc' } } },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true } }),
    prisma.patientMedicalRecord.findUnique({ where: { customerId: id } }),
    prisma.patientDocument.findMany({ where: { customerId: id }, orderBy: { uploadedAt: 'desc' } }),
    prisma.medicalLetter.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
  ])

  if (!customer) notFound()
  const isClinic = business?.category === 'CLINICA'
  const label = isClinic ? 'pacient' : 'client'
  const patientName = customer.name ?? customer.phone

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="mb-4">
        <BackLink href="/dashboard/clienti" label={`Înapoi la ${isClinic ? 'pacienți' : 'clienți'}`} />
      </div>

      <h1 className="text-2xl font-semibold mb-6">{customer.name ?? 'Fără nume'}</h1>

      {isClinic ? (
        <PatientDetailTabs
          simpleForm={
            <CustomerEditForm
              customerId={customer.id}
              isClinic={isClinic}
              initial={{
                name: customer.name ?? '',
                phone: customer.phone,
                email: customer.email ?? '',
                notes: customer.notes ?? '',
                dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.toISOString().slice(0, 10) : '',
                allergies: customer.allergies ?? '',
                medicalNotes: customer.medicalNotes ?? '',
              }}
            />
          }
          customerId={customer.id}
          patientName={patientName}
          medicalRecordInitial={medicalRecord}
          documents={documents.map((d) => ({
            id: d.id,
            url: d.url,
            filename: d.filename,
            uploadedAt: d.uploadedAt.toISOString(),
          }))}
          letters={letters.map((l) => ({ ...l, id: l.id }))}
        />
      ) : (
        <Card className="mb-8">
          <h2 className="font-medium mb-4">Date client</h2>
          <CustomerEditForm
            customerId={customer.id}
            isClinic={false}
            initial={{
              name: customer.name ?? '',
              phone: customer.phone,
              email: customer.email ?? '',
              notes: customer.notes ?? '',
              dateOfBirth: '',
              allergies: '',
              medicalNotes: '',
            }}
          />
        </Card>
      )}

      <h2 className="text-lg font-medium mb-3 mt-8">Istoric {isClinic ? 'consultații' : 'rezervări'}</h2>
      <div className="flex flex-col gap-2">
        {customer.bookings.map((b) => (
          <Card key={b.id} className="flex items-center justify-between py-3">
            <span className="font-medium">
              {b.service.name}
              {b.practitioner ? ` · ${b.practitioner.name}` : ''}
            </span>
            <span className="text-gray-500 text-sm">{b.startAt.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}</span>
            <Pill tone={b.status === 'CONFIRMED' ? 'success' : b.status === 'CANCELLED' ? 'danger' : 'neutral'}>
              {b.status}
            </Pill>
          </Card>
        ))}
        {customer.bookings.length === 0 && <p className="text-sm text-gray-500">Niciun istoric încă.</p>}
      </div>
    </div>
  )
}

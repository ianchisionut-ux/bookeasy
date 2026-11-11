import { prisma } from '@/lib/prisma'
import { canonicalCustomerPhone, duplicateCustomerGroups } from '@/lib/customer-phone'

const relations = ['booking', 'waitlistEntry', 'patientMedicalRecord', 'patientDocument', 'medicalLetter', 'fitnessMember'] as const
const include = { medicalRecord: { select: { id: true } }, fitnessMember: { select: { id: true } } } as const
const textFields = ['name', 'email', 'instagramUserId', 'facebookUserId'] as const
const noteFields = ['notes', 'allergies', 'medicalNotes'] as const

export function mergeCustomerValues(group: any[]) {
  for (const key of ['dateOfBirth', 'instagramUserId', 'facebookUserId']) {
    if (new Set(group.map(row => row[key] instanceof Date ? row[key].toISOString() : row[key]).filter(Boolean)).size > 1) throw new Error('Date de identitate diferite. Verifică manual fișele înainte de unire.')
  }
  for (const key of ['medicalRecord', 'fitnessMember']) if (group.filter(row => row[key]).length > 1) throw new Error('Mai multe fișe medicale sau profiluri fitness. Verifică manual înainte de unire.')
  const values: any = { phone: canonicalCustomerPhone(group[0].phone) }
  for (const key of textFields) values[key] = group.find(row => row[key])?.[key] || null
  values.dateOfBirth = group.find(row => row.dateOfBirth)?.dateOfBirth || null
  for (const key of noteFields) values[key] = [...new Set(group.map(row => row[key]).filter(Boolean))].join('\n\n') || null
  const alternatives = [...new Set(group.flatMap(row => [row.name && row.name !== values.name ? `Nume anterior: ${row.name}` : '', row.email && row.email !== values.email ? `Email anterior: ${row.email}` : '']).filter(Boolean))]
  if (alternatives.length) values.notes = [values.notes, ...alternatives].filter(Boolean).join('\n')
  return values
}

export async function mergeBusinessCustomers(businessId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`customer-merge:${businessId}`}))`
    const customers = await tx.customer.findMany({ where: { businessId }, include, orderBy: { createdAt: 'asc' } })
    const groups = duplicateCustomerGroups(customers)
    let merged = 0
    const skipped: string[] = []
    for (const rows of groups) {
      const group = rows
      let values: ReturnType<typeof mergeCustomerValues>
      try { values = mergeCustomerValues(group) } catch (error) { skipped.push(error instanceof Error ? error.message : 'Verificare manuală necesară.'); continue }
      const [target, ...sources] = group
      const sourceIds = sources.map(row => row.id)
      const moved: Record<string, { id: string; customerId: string }[]> = {}
      for (const model of relations) moved[model] = await (tx[model] as any).findMany({ where: { customerId: { in: sourceIds } }, select: { id: true, customerId: true } })
      const clean = ({ medicalRecord, fitnessMember, ...row }: any) => row
      // Archive before modifying anything; the whole operation commits atomically.
      await tx.customerMergeArchive.create({ data: { businessId, customerId: target.id, snapshot: JSON.parse(JSON.stringify({ target: clean(target), sources: sources.map(clean), after: { ...clean(target), ...values }, moved })) } })
      for (const model of relations) await (tx[model] as any).updateMany({ where: { customerId: { in: sourceIds } }, data: { customerId: target.id } })
      await tx.customer.deleteMany({ where: { businessId, id: { in: sourceIds } } })
      await tx.customer.update({ where: { id: target.id }, data: values })
      merged += sources.length
    }
    return { merged, skipped }
  }, { timeout: 30_000 })
}

export async function restoreCustomerMerge(businessId: string, archiveId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`customer-merge:${businessId}`}))`
    const archive = await tx.customerMergeArchive.findFirst({ where: { id: archiveId, businessId, restoredAt: null } })
    if (!archive) throw new Error('Unirea nu mai este disponibilă pentru anulare.')
    const snapshot = archive.snapshot as any
    const current = await tx.customer.findUnique({ where: { id: archive.customerId } })
    if (!current || current.businessId !== businessId) throw new Error('Fișa principală nu mai este disponibilă.')
    for (const key of [...textFields, ...noteFields, 'phone', 'dateOfBirth']) {
      const value = (current as any)[key]
      if ((value instanceof Date ? value.toISOString() : value) !== snapshot.after[key]) throw new Error('Fișa a fost modificată după unire. Restaurarea necesită verificare manuală pentru a păstra modificările.')
    }
    const dates = (row: any) => ({ ...row, createdAt: new Date(row.createdAt), dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null })
    const { id, businessId: oldBusiness, ...original } = dates(snapshot.target)
    await tx.customer.update({ where: { id }, data: original })
    for (const source of snapshot.sources) await tx.customer.create({ data: dates(source) })
    for (const model of relations) for (const row of snapshot.moved[model] || []) await (tx[model] as any).updateMany({ where: { id: row.id, customerId: archive.customerId }, data: { customerId: row.customerId } })
    await tx.customerMergeArchive.update({ where: { id: archive.id }, data: { restoredAt: new Date() } })
  }, { timeout: 30_000 })
}

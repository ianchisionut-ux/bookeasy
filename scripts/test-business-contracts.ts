import assert from 'node:assert/strict'
import type { Business } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { buildContractDocument, contractMissingFields, documentHash } from '../lib/business-contracts'

const business = {
  name: 'Clinica Exemplu', slug: 'clinica-exemplu', category: 'CLINICA',
  contactPhone: '0712345678', address: 'Str. Exemplu 1', city: 'Zalău',
  billingLegalName: 'CLINICA EXEMPLU S.R.L.', billingClientType: 'PJ', billingCif: 'RO12345678',
  billingRegCom: 'J31/123/2026', billingAddress: 'Str. Exemplu 1', billingCounty: 'Sălaj',
  billingCity: 'Zalău', billingPostalCode: '450001', billingEmail: 'office@example.ro',
  contractRepresentativeName: 'Maria Exemplu', contractRepresentativeRole: 'Administrator',
  planName: 'Pro', billingSubtotal: new Prisma.Decimal(149), billingAmount: null,
  billingVatRate: new Prisma.Decimal(21), billingCurrency: 'RON', billingStatus: 'PLATIT',
} as Business

assert.deepEqual(contractMissingFields(business, 'SERVICES'), [])
assert.deepEqual(contractMissingFields(business, 'DPA'), [])
const service = buildContractDocument(business, 'SERVICES')
const dpa = buildContractDocument(business, 'DPA')
const allText = JSON.stringify([service, dpa])
assert.match(allText, /CLINICA EXEMPLU S\.R\.L\./)
assert.match(allText, /149\.00 RON/)
assert.match(JSON.stringify(dpa), /date privind sănătatea/)
assert.doesNotMatch(allText, /Daily Menu|dailym\.ro|restaurant|livrator|SQLite/)
assert.notEqual(documentHash(service), documentHash(dpa))

// JSONB poate întoarce cheile în altă ordine; amprenta trebuie să rămână identică.
const jsonbOrderedService = {
  sections: service.sections.map((section) => ({ paragraphs: section.paragraphs, heading: section.heading })),
  customer: service.customer,
  provider: service.provider,
  subtitle: service.subtitle,
  title: service.title,
  version: service.version,
  type: service.type,
} as typeof service
assert.equal(documentHash(service), documentHash(jsonbOrderedService))

const changed = { ...business, billingSubtotal: new Prisma.Decimal(199) }
assert.notEqual(documentHash(service), documentHash(buildContractDocument(changed, 'SERVICES')))
assert.deepEqual(contractMissingFields({ ...business, billingCif: null }, 'SERVICES'), ['CUI/CIF'])
console.log('Contracte BookEasy: date, domeniu, tarif și versiune verificate.')

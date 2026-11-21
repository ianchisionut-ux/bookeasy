import type { Metadata } from 'next'
import { bookingTerminology, CATEGORY_LABEL, type BusinessCategory } from './business-categories'
import { withoutDiacritics } from './public-marketplace'

export const SITE_URL = 'https://bookeasy.ro'
export const SITE_DESCRIPTION = 'Programari online la saloane, frizerii si clinici. Pentru rezervari online, alege orasul, serviciul si ora disponibila pe BookEasy.'

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path}`
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'BookEasy', type: 'website', locale: 'ro_RO', images: [{ url: `${SITE_URL}/hero-bookeasy.png`, width: 1672, height: 941, alt: 'BookEasy - programari si rezervari online' }] },
    twitter: { card: 'summary_large_image', title, description, images: [`${SITE_URL}/hero-bookeasy.png`] },
  }
}

const localServiceNames: Partial<Record<BusinessCategory, string>> = {
  SALON: 'saloane de infrumusetare',
  COAFURA_FRIZERIE: 'saloane de coafura si frizerii',
  BARBER_SHOP: 'frizerii si barber shop-uri',
  NAILS: 'saloane de manichiura si pedichiura',
  COSMETICA: 'servicii de cosmetica si ingrijire a tenului',
  FITNESS: 'antrenamente de fitness',
  MEDICAL: 'cabinete medicale',
  CLINICA: 'clinici medicale',
  SPORT_BAZE: 'terenuri si baze sportive',
  EVENT_VENUE: 'sali si spatii pentru evenimente',
  LOC_JOACA: 'locuri de joaca',
}

function localServiceName(category: BusinessCategory) {
  return localServiceNames[category] ?? withoutDiacritics(CATEGORY_LABEL[category])
    .toLocaleLowerCase('ro-RO').replace(/ & | \/ /g, ' si ')
}

export function onlineBookingAction(category: BusinessCategory) {
  const { singular } = bookingTerminology(category)
  if (singular === 'rezervare') return 'Rezerva online'
  if (singular === 'înscriere') return 'Inscrie-te online'
  if (singular === 'ședință') return 'Rezerva o sedinta'
  return 'Programeaza-te online'
}

export function citySeo(city: string, categories: BusinessCategory[]) {
  const distinctCategories = [...new Set(categories)]
  const hasReservations = distinctCategories.some((category) => bookingTerminology(category).singular === 'rezervare')
  const hasAppointments = distinctCategories.some((category) => bookingTerminology(category).singular !== 'rezervare')
  const term = hasReservations && !hasAppointments ? 'Rezervari online' : 'Programari online'
  const heading = `${term} in ${city}`
  const names = [...new Set(distinctCategories.map(localServiceName))].slice(0, 3)
  const services = withoutDiacritics(new Intl.ListFormat('ro').format(names))
  const action = hasReservations && !hasAppointments ? 'rezerva online' : 'fa rezervari online'
  return {
    heading,
    description: `Descopera ${services} in ${city}. Verifica orele disponibile si ${action} pe BookEasy.`,
  }
}

export function businessMetadata(business: {
  name: string
  slug: string
  category: BusinessCategory
  city: string | null
  heroImageUrl: string | null
  publicListed: boolean
  accountActive: boolean
}, booking = false): Metadata {
  const name = withoutDiacritics(business.name.trim())
  const city = withoutDiacritics(business.city?.trim() ?? '')
  const location = city ? ` in ${city}` : ''
  const bookingType = withoutDiacritics(bookingTerminology(business.category).heading)
  const bookingAction = onlineBookingAction(business.category)
  const title = booking ? `${bookingAction} la ${name} | BookEasy` : `${name} | ${bookingType} online${location}`
  const description = booking
    ? `${bookingAction} la ${name}${location}. Alege serviciul, data si ora disponibile pe BookEasy.`
    : `${name}${location}. Vezi oferta pentru ${localServiceName(business.category)}, programul si recenziile. ${bookingAction} pe BookEasy.`
  const path = `/${encodeURIComponent(business.slug)}${booking ? '/rezerva' : ''}`
  const metadata = publicMetadata(title, description, path)
  if (!business.publicListed || !business.accountActive) return { ...metadata, robots: { index: false, follow: false } }
  if (business.heroImageUrl) {
    const imageUrl = business.heroImageUrl.startsWith('http') ? business.heroImageUrl : `${SITE_URL}${business.heroImageUrl}`
    metadata.openGraph = { ...metadata.openGraph, images: [{ url: imageUrl, alt: name }] }
    metadata.twitter = { ...metadata.twitter, images: [imageUrl] }
  }
  return metadata
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

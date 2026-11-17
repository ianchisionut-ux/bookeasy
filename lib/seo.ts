import type { Metadata } from 'next'

export const SITE_URL = 'https://bookeasy.ro'
export const SITE_DESCRIPTION = 'Descoperă saloane, clinici și servicii aproape de tine. Alege afacerea, verifică orele disponibile și rezervă online cu BookEasy.'

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path}`
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'BookEasy', type: 'website', locale: 'ro_RO', images: [{ url: `${SITE_URL}/hero-bookeasy.png`, width: 1672, height: 941, alt: 'BookEasy — programări și rezervări online' }] },
    twitter: { card: 'summary_large_image', title, description, images: [`${SITE_URL}/hero-bookeasy.png`] },
  }
}

export function businessMetadata(business: {
  name: string
  slug: string
  categoryLabel: string
  city: string | null
  heroImageUrl: string | null
  publicListed: boolean
  accountActive: boolean
}, booking = false): Metadata {
  const name = business.name.trim()
  const city = business.city?.trim() || null
  const title = booking ? `Rezervă online la ${name} | BookEasy` : `${name}${city ? `, ${city}` : ''} | BookEasy`
  const description = booking
    ? `Alege serviciul, data și ora pentru ${name}${city ? ` din ${city}` : ''}. Programează-te online prin BookEasy.`
    : `${name} — ${business.categoryLabel.trim().toLowerCase()}${city ? ` în ${city}` : ''}. Vezi serviciile, programul și recenziile și rezervă online prin BookEasy.`
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

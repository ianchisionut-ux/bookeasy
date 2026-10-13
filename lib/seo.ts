import type { Metadata } from 'next'

export const SITE_URL = 'https://www.bookeasy.ro'
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

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

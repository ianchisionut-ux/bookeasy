import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: ['/', '/api/storage/public/'], disallow: ['/api/'] }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL }
}

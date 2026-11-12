import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/superadmin/',
        '/onboarding/',
        '/fitness/',
        '/contracte/',
      ],
    },
    sitemap: 'https://bookeasy.ro/sitemap.xml',
  }
}

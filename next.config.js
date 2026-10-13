/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/query_compiler_bg.wasm'],
  },
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  images: {
    qualities: [75, 90, 95],
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  async headers() {
    return [
      ...['/api/:path*', '/dashboard/:path*', '/superadmin/:path*', '/onboarding/:path*', '/contracte/:path*', '/demo/:path*', '/cont', '/login', '/signup', '/forgot-password', '/reset-password', '/offline', '/cont-suspendat', '/plata-confirmata', '/plata-anulata', '/harta-test', '/:slug/rezerva', '/:slug/recenzie'].map((source) => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] })),
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      {
        source: '/bookeasy-v2.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ]
  },
}

module.exports = nextConfig

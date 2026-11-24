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
  async redirects() {
    return [{
      // Android SMS clients must reach the authenticated endpoint without a cross-host redirect.
      source: '/:path((?!api/sms-device/jobs(?:/|$)).*)',
      has: [{ type: 'host', value: 'www.bookeasy.ro' }],
      destination: 'https://bookeasy.ro/:path*',
      permanent: true,
    }, {
      source: '/aplicatii',
      destination: '/descopera',
      permanent: true,
    }]
  },
  async headers() {
    return [
      { source: '/fitness/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] },
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
        source: '/dashboard/fitness',
        headers: [{ key: 'Permissions-Policy', value: `camera=(self "https://${process.env.FITNESS_JITSI_DOMAIN || 'meet.jit.si'}"), microphone=(self "https://${process.env.FITNESS_JITSI_DOMAIN || 'meet.jit.si'}"), geolocation=(self)` }],
      },
      {
        source: '/fitness/:path*',
        headers: [{ key: 'Permissions-Policy', value: `camera=(self "https://${process.env.FITNESS_JITSI_DOMAIN || 'meet.jit.si'}"), microphone=(self "https://${process.env.FITNESS_JITSI_DOMAIN || 'meet.jit.si'}"), geolocation=(self)` }],
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

if (process.env.BOOKEASY_CLOUDFLARE_BUILD === 'true') {
  const { dirname, join } = require('node:path')
  const blobFetch = join(dirname(require.resolve('@vercel/blob')), 'undici-browser.js')
  nextConfig.webpack = (config, { isServer, webpack }) => {
    if (isServer) {
      // Blob ships a global-fetch adapter. Let Workers handle its outbound
      // HTTP while keeping Undici as-is for other dependencies.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^undici$/, resource => {
        if (/[\\/]@vercel[\\/]blob[\\/]dist$/.test(resource.context)) resource.request = blobFetch
      }))
    }
    return config
  }
}

module.exports = nextConfig

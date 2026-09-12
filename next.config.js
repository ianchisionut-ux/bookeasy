/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  // Prisma loads its query compiler at runtime. Next's file tracer otherwise
  // keeps the JS loader but omits the adjacent WASM binary from OpenNext.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/query_compiler_bg.wasm'],
  },
  images: {
    qualities: [75, 90, 95],
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  async headers() {
    return [
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
    ]
  },
}

module.exports = nextConfig

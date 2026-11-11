import type { NextRequest } from 'next/server'

export function businessOAuthOrigin(req: NextRequest) {
  const configured = new URL(process.env.APP_URL!).origin
  const requested = req.nextUrl.origin
  if (requested === configured) return configured
  const configuredHost = new URL(configured).hostname
  const requestedUrl = new URL(requested)
  if (['bookeasy.ro', 'www.bookeasy.ro'].includes(configuredHost) && requestedUrl.protocol === 'https:' && ['bookeasy.ro', 'www.bookeasy.ro'].includes(requestedUrl.hostname)) return requested
  return configured
}

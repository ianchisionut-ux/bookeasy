import { hasMarketingConsent } from './cookie-consent'

type Step = 'view' | 'start' | 'submit'

export function signupAttribution(promoCode: string) {
  const campaign = new URLSearchParams(window.location.search).get('utm_campaign') ?? ''
  return { promoCode, utmCampaign: campaign }
}

export function sendSignupFunnel(step: Step, promoCode: string) {
  const body = JSON.stringify({ step, ...signupAttribution(promoCode) })
  void fetch('/api/analytics/signup-funnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

type PixelFunction = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string }
declare global { interface Window { fbq?: PixelFunction; _fbq?: PixelFunction } }

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
let pixelStarted = false
let pixelAllowed = false

export function startSignupPixel() {
  if (!pixelId || !/^\d{8,20}$/.test(pixelId) || !hasMarketingConsent()) return
  if (!pixelStarted && !window.fbq) {
    const fbq: PixelFunction = (...args) => {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue?.push(args)
    }
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    window.fbq = fbq
    window._fbq = fbq
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }
  if (!pixelStarted) {
    window.fbq?.('init', pixelId)
    pixelStarted = true
  }
  if (!pixelAllowed) {
    window.fbq?.('consent', 'grant')
    window.fbq?.('track', 'PageView')
    pixelAllowed = true
  }
}

export function stopSignupPixel() {
  if (!pixelStarted || !pixelAllowed) return
  window.fbq?.('consent', 'revoke')
  pixelAllowed = false
}

export function completeSignupPixel() {
  if (!pixelId || !hasMarketingConsent()) return
  startSignupPixel()
  window.fbq?.('track', 'CompleteRegistration', { content_name: 'BookEasy Business' })
}

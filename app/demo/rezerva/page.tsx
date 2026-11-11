import RezervaPage from '@/app/[slug]/rezerva/page'

export const dynamic = 'force-dynamic'

// /demo/[slug] is the separate demonstration dashboard. The real business
// whose slug is "demo" must keep its public booking URL as well.
export default function DemoBusinessBookingPage() {
  return RezervaPage({ params: Promise.resolve({ slug: 'demo' }) })
}

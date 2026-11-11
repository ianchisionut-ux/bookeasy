import RecenziePage from '@/app/[slug]/recenzie/page'

export const dynamic = 'force-dynamic'

export default function DemoBusinessReviewPage() {
  return RecenziePage({ params: Promise.resolve({ slug: 'demo' }) })
}

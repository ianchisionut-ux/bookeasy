import PromotionManager from './promotion-manager'
export const metadata={title:'Coduri promoționale | BookEasy'}
export default function PromotionPage() {
  return <div className="dashboard-page">
    <h1 className="text-2xl font-semibold">Coduri promoționale</h1>
    <p className="mb-6 mt-2 text-sm text-gray-500">Poți restaura sau șterge definitiv campaniile din arhivă. Ofertele deja acceptate se păstrează.</p>
    <PromotionManager />
  </div>
}

import PromotionManager from './promotion-manager'
export const metadata={title:'Coduri promoționale | BookEasy'}
export default function PromotionPage(){return <div className="dashboard-page"><h1 className="text-2xl font-semibold">Coduri promoționale</h1><p className="mb-6 mt-2 text-sm text-gray-500">Creează, editează sau șterge campanii. Alege gratuitate fără termen stabilit ori o ofertă cu durată și tarif ulterior. Ofertele deja acceptate se păstrează.</p><PromotionManager/></div>}

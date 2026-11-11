import {getPlanPrices} from '@/lib/plan-pricing'
import PriceManager from './price-manager'
export const dynamic='force-dynamic'
export const metadata={title:'Planuri și prețuri | BookEasy'}
export default async function Page(){return <div className="dashboard-page"><h1 className="text-2xl font-semibold">Planuri și prețuri</h1><p className="mb-6 mt-2 text-sm text-gray-500">Prețuri totale în RON pentru înscrierile viitoare. Afacerile existente și condițiile campaniilor deja acceptate rămân neschimbate.</p><PriceManager initial={await getPlanPrices()}/></div>}

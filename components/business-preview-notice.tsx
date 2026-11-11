import Link from 'next/link'
import { businessSetupHref } from '@/lib/business-preview'

export default function BusinessPreviewNotice({ onboardingDone, onboardingStep, accountActive }: { onboardingDone: boolean; onboardingStep: number; accountActive: boolean }) {
  return <aside aria-label="Previzualizare privată" className="mx-auto mt-4 max-w-6xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
    <h2 className="font-semibold">Previzualizare privată</h2>
    <p className="mt-1 text-sm">Pagina nu este disponibilă clienților. {accountActive ? onboardingDone ? 'Activează vizibilitatea publică din Setări și salvează modificarea.' : 'Finalizează configurarea afacerii pentru a publica pagina și a primi programări.' : 'Contul este suspendat. Contactează BookEasy pentru reactivare.'}</p>
    {accountActive && <Link className="btn-secondary mt-3 inline-flex text-sm" href={businessSetupHref(onboardingDone, onboardingStep)}>{onboardingDone ? 'Deschide setările de vizibilitate' : 'Continuă configurarea'}</Link>}
  </aside>
}

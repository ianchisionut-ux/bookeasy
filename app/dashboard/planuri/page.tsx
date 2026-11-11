import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectiveBusinessPlan, type BusinessPlan } from '@/lib/business-plans'
import { isPatientCategory } from '@/lib/business-categories'
import { isWalletEligibleCategory } from '@/lib/wallet-eligibility'
import {
  ArrowRight, BarChart3, CalendarDays, Camera, Check, Clock3,
  CreditCard, FileHeart, Globe2, HeartHandshake, Link2, LockKeyhole,
  Mail, MapPin, MessageCircle, Palette, ShieldCheck, Star, Users,
  WalletCards,
} from 'lucide-react'

const planCards: { name: BusinessPlan; price: string; description: string; highlights: string[]; note: string }[] = [
  {
    name: 'FREE', price: '0 lei / lună',
    description: 'Baza de care ai nevoie pentru ca oamenii să te găsească și să se programeze online.',
    highlights: ['Pagină publică și link de rezervare', 'Calendar, servicii și program de lucru', 'Programări și evidența clienților'],
    note: 'Accesul gratuit se acordă după aprobarea cererii.',
  },
  {
    name: 'STANDARD', price: '55 lei / lună',
    description: 'Mai mult control pentru echipă, comunicarea cu clienții și rezultatele afacerii.',
    highlights: ['Tot ce include Free', 'Echipă, mesaje, recenzii și statistici', 'Google Calendar și alte integrări configurabile'],
    note: 'Unele canale necesită conectarea conturilor proprii.',
  },
  {
    name: 'PRO', price: 'Ofertă personalizată',
    description: 'Toate funcțiile Standard, cu opțiuni speciale stabilite împreună pentru afacerea ta.',
    highlights: ['Tot ce include Standard', 'Configurare asistată pentru nevoi speciale', 'Integrări suplimentare evaluate la cerere'],
    note: 'Prețul și funcțiile suplimentare se confirmă prin ofertă.',
  },
]

const featureGroups = [
  {
    plan: 'FREE' as const, eyebrow: 'Pornești și primești rezervări',
    intro: 'Un profil complet și instrumentele zilnice pentru a ține programările în ordine.',
    features: [
      { icon: Globe2, title: 'Pagină publică pentru afacere', detail: 'Prezinți numele, categoria, locația, datele de contact și serviciile într-o pagină pe care o poți distribui.', points: ['Link propriu către profil și rezervare', 'Vizibilitate pe harta publică, dacă o activezi'] },
      { icon: Camera, title: 'Fotografii și prezentare', detail: 'Adaugi o fotografie de copertă și o galerie, astfel încât vizitatorii să vadă spațiul și activitatea ta înainte de rezervare.', points: ['Copertă pentru profilul public', 'Galerie de fotografii'] },
      { icon: CalendarDays, title: 'Rezervări online', detail: 'Oamenii aleg serviciul și un interval disponibil din pagina ta. Orele respectă durata serviciilor și programul configurat.', points: ['Disponibilitate calculată automat', 'Link de rezervare de trimis pe site sau în social media'] },
      { icon: Clock3, title: 'Calendar și program de lucru', detail: 'Vezi programările într-un singur calendar și controlezi orele de lucru, pauzele și intervalul minim pentru rezervările noi.', points: ['Programări adăugate manual', 'Intervale blocate și schimbarea statusului'] },
      { icon: Users, title: 'Evidența clienților', detail: 'Păstrezi datele de contact și istoricul programărilor pentru fiecare persoană. Poți căuta și arhiva înregistrări.', points: ['Profil și istoric de rezervări', 'Căutare după nume, telefon sau email'] },
      { icon: Link2, title: 'Servicii și setări esențiale', detail: 'Definești serviciile oferite, durata și prețul, apoi alegi cum apare afacerea și cum se pot face rezervările.', points: ['Listă de servicii editabilă', 'Setări de disponibilitate și vizibilitate'] },
    ],
  },
  {
    plan: 'STANDARD' as const, eyebrow: 'Crești și lucrezi mai organizat',
    intro: 'Include toate funcțiile Free și instrumente pentru echipă, conversații și analiză.',
    features: [
      { icon: Users, title: 'Echipă și resurse', detail: 'Organizezi mai mulți membri ai echipei sau resurse rezervabile, acolo unde categoria afacerii folosește acest mod de lucru.', points: ['Calendar separat pe persoană', 'Disponibilitate corelată cu echipa și resursele'] },
      { icon: MessageCircle, title: 'Mesaje și conversații', detail: 'Primești și gestionezi conversațiile din canalele Meta conectate. Un operator poate prelua discuția atunci când este nevoie.', points: ['Facebook Messenger și Instagram, după conectare', 'Preluare de către operator și istoric conversații'] },
      { icon: Mail, title: 'Confirmări și reamintiri', detail: 'Poți cere reconfirmarea programărilor și folosi remindere prin canalele active pentru afacerea ta.', points: ['Reconfirmare pe Messenger, după conectare', 'SMS doar când serviciul central este configurat și funcționează'] },
      { icon: Star, title: 'Recenzii și reputație', detail: 'Urmărești recenziile primite prin BookEasy și poți conecta Google Business Profile pentru sincronizarea recenziilor disponibile.', points: ['Listă și administrare recenzii', 'Conectare Google Business Profile'] },
      { icon: BarChart3, title: 'Statistici utile', detail: 'Vezi cum evoluează activitatea: programări, grad de ocupare, servicii populare și canalele din care vin solicitările.', points: ['Indicatori și evoluție pe perioade', 'Top servicii și canale de achiziție'] },
      { icon: CalendarDays, title: 'Google Calendar', detail: 'Conectezi calendarul Google pentru sincronizarea programărilor. În modul echipă, fiecare membru își poate conecta calendarul.', points: ['Sincronizare și verificare manuală', 'Control asupra detaliilor trimise în calendar'] },
      { icon: Palette, title: 'Identitatea paginii publice', detail: 'Alegi culoarea profilului pentru ca pagina de prezentare și fluxul de rezervare să reflecte afacerea ta.', points: ['Culoare de brand', 'Aspect coerent pe pagina publică'] },
      { icon: MapPin, title: 'Canale și prezență online', detail: 'Conectezi integrările disponibile pentru categoria ta și controlezi separat starea lor din Setări.', points: ['Facebook, Instagram și Google, după autorizare', 'Starea conexiunilor vizibilă în cont'] },
    ],
  },
] as const

function FeatureSection({ group, current }: { group: (typeof featureGroups)[number]; current: BusinessPlan }) {
  const available = group.plan === 'FREE' || current !== 'FREE'
  return <section className="mt-10" aria-labelledby={`features-${group.plan.toLowerCase()}`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168d8d]">{group.plan} · {group.eyebrow}</p>
        <h2 id={`features-${group.plan.toLowerCase()}`} className="mt-1 text-2xl font-bold tracking-tight text-[#193c3e]">{group.plan === 'FREE' ? 'Tot ce îți trebuie pentru început' : 'Instrumente pentru următorul pas'}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{group.intro}</p>
      </div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${available ? 'bg-[#e8f7f4] text-[#147f83]' : 'bg-white text-gray-600 ring-1 ring-gray-200'}`}>{available ? 'Disponibil în planul tău' : 'Disponibil de la Standard'}</span>
    </div>
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {group.features.map(({ icon: Icon, title, detail, points }) => <article key={title} className="flex min-w-0 flex-col rounded-2xl border border-[#e1eae7] bg-white p-5 shadow-[0_8px_28px_#163b3310]">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f7f4] text-[#148883]"><Icon size={20} aria-hidden="true" /></span><h3 className="text-base font-semibold leading-5 text-[#193c3e]">{title}</h3></div>
        <p className="mt-4 text-sm leading-6 text-gray-600">{detail}</p>
        <ul className="mt-4 space-y-2 border-t border-[#edf2ef] pt-4 text-xs leading-5 text-[#536a65]">
          {points.map(point => <li key={point} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#168d8d]" aria-hidden="true" /><span>{point}</span></li>)}
        </ul>
      </article>)}
    </div>
  </section>
}

export default async function PlansPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  const business = businessId ? await prisma.business.findUnique({
    where: { id: businessId },
    select: { planName: true, billingStatus: true, category: true, launchEnrollment: { select: { cancelledAt: true } } },
  }) : null
  const current = business ? effectiveBusinessPlan(business, Boolean((session as any)?.isSuperAdmin)) : 'FREE'
  const patientCategory = isPatientCategory(business?.category)
  const walletCategory = isWalletEligibleCategory(business?.category)

  return <div className="dashboard-page">
    <div className="w-full min-w-0">
      <header className="rounded-[28px] bg-[#193c3e] px-6 py-8 text-white sm:px-9 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9ce2d0]">Planurile BookEasy</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">Tot ce poate face BookEasy pentru afacerea ta</h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-white/80 sm:text-base">De la prima rezervare online până la organizarea echipei și analiza rezultatelor: vezi concret ce primești în fiecare plan și ce integrări se pot configura pentru afacerea ta.</p>
        <span className="mt-6 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold">Planul tău actual: {current}</span>
      </header>

      <section className="mt-8" aria-labelledby="plans-heading">
        <div className="mb-5"><h2 id="plans-heading" className="text-2xl font-bold tracking-tight text-[#193c3e]">Alege ritmul potrivit</h2><p className="mt-2 text-sm text-gray-600">Fiecare plan include funcțiile planului precedent. PRO este cel mai înalt plan.</p></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {planCards.map(plan => <article key={plan.name} className={`flex flex-col rounded-2xl border p-6 shadow-[0_8px_28px_#163b3310] ${plan.name === current ? 'border-[#4eb5a8] bg-[#f1faf7]' : 'border-[#e1eae7] bg-white'}`}>
            <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-[#193c3e]">{plan.name}</h3>{plan.name === current && <span className="rounded-full bg-[#d9f1e9] px-3 py-1 text-xs font-bold text-[#107973]">Planul tău</span>}</div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-[#193c3e]">{plan.price}</p>
            <p className="mt-3 min-h-12 text-sm leading-6 text-gray-600">{plan.description}</p>
            <ul className="mt-5 space-y-2.5 border-t border-[#e5eeeb] pt-5 text-sm text-[#375450]">{plan.highlights.map(highlight => <li key={highlight} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-[#168d8d]" aria-hidden="true" />{highlight}</li>)}</ul>
            <p className="mt-auto pt-5 text-xs leading-5 text-gray-500">{plan.note}</p>
          </article>)}
        </div>
      </section>

      {featureGroups.map(group => <FeatureSection key={group.plan} group={group} current={current} />)}

      <section className="mt-10" aria-labelledby="special-heading">
        <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168d8d]">În funcție de activitate</p><h2 id="special-heading" className="mt-1 text-2xl font-bold tracking-tight text-[#193c3e]">Module și opțiuni specializate</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600">BookEasy adaptează instrumentele la categoria afacerii. Unele funcții cer un cont extern, activare sau configurare suplimentară.</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {patientCategory && <article className="rounded-2xl border border-[#e1eae7] bg-white p-6"><FileHeart size={24} className="text-[#168d8d]" aria-hidden="true" /><h3 className="mt-4 font-semibold text-[#193c3e]">Instrumente pentru pacienți</h3><p className="mt-2 text-sm leading-6 text-gray-600">Fișă de pacient, istoric, documente și scrisori medicale într-un profil dedicat. Pentru cabinetele stomatologice există și odontogramă.</p><span className="mt-4 inline-block text-xs font-semibold text-[#147f83]">Disponibil pentru categoriile medicale potrivite</span></article>}
          {business?.category === 'FITNESS' && <article className="rounded-2xl border border-[#e1eae7] bg-white p-6"><HeartHandshake size={24} className="text-[#168d8d]" aria-hidden="true" /><h3 className="mt-4 font-semibold text-[#193c3e]">Fitness și coaching</h3><p className="mt-2 text-sm leading-6 text-gray-600">Planuri de antrenament și nutriție, sarcini zilnice și urmărirea progresului pentru persoanele invitate de instructor.</p><span className="mt-4 inline-block text-xs font-semibold text-[#147f83]">Modul dedicat categoriei Fitness</span></article>}
          <article className="rounded-2xl border border-[#e1eae7] bg-white p-6"><CreditCard size={24} className="text-[#168d8d]" aria-hidden="true" /><h3 className="mt-4 font-semibold text-[#193c3e]">Avansuri pentru rezervări</h3><p className="mt-2 text-sm leading-6 text-gray-600">Poți solicita un avans la rezervare acolo unde este configurat procesatorul de plăți pentru afacerea ta.</p><span className="mt-4 inline-block text-xs font-semibold text-[#147f83]">Necesită configurarea plăților</span></article>
          {walletCategory && <article className="rounded-2xl border border-[#e1eae7] bg-white p-6"><WalletCards size={24} className="text-[#168d8d]" aria-hidden="true" /><h3 className="mt-4 font-semibold text-[#193c3e]">Google Wallet și cod QR</h3><p className="mt-2 text-sm leading-6 text-gray-600">Cardul de rezervare și verificarea prin QR sunt pregătite pentru categoriile eligibile, după aprobarea și activarea serviciului.</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><LockKeyhole size={13} aria-hidden="true" />În pregătire · PRO</span></article>}
          <article className="rounded-2xl border border-[#e1eae7] bg-white p-6"><ShieldCheck size={24} className="text-[#168d8d]" aria-hidden="true" /><h3 className="mt-4 font-semibold text-[#193c3e]">Control și administrare</h3><p className="mt-2 text-sm leading-6 text-gray-600">Gestionezi setările afacerii, notificările, datele de facturare și documentele contractuale din propriul dashboard.</p><span className="mt-4 inline-block text-xs font-semibold text-[#147f83]">În contul afacerii</span></article>
        </div>
      </section>

      <section className="mt-10 grid gap-5 rounded-[28px] border border-[#bde3da] bg-[#f1faf7] p-6 lg:grid-cols-[1.3fr_1fr] lg:p-8" aria-labelledby="pro-heading">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168d8d]">PRO · planul maxim</p><h2 id="pro-heading" className="mt-2 text-2xl font-bold tracking-tight text-[#193c3e]">Ai nevoie de o configurare specială?</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-[#536a65]">PRO include funcțiile Standard. Pentru integrări sau fluxuri suplimentare, analizăm cerința și îți confirmăm ce se poate activa, în ce condiții și la ce cost. Aceste opțiuni se stabilesc individual.</p></div>
        <div className="flex flex-col justify-center rounded-2xl bg-white p-5"><p className="text-sm font-semibold text-[#193c3e]">Clar de la început</p><p className="mt-2 text-sm leading-6 text-gray-600">SMS, WhatsApp, procesatorii de plată și alte servicii externe pot avea costuri și aprobări proprii. Google Wallet rămâne în pregătire până la activarea serviciului.</p></div>
      </section>

      {current !== 'PRO' ? <div className="mt-10 rounded-[28px] bg-[#193c3e] p-6 text-white sm:p-8"><h2 className="text-xl font-bold">Vrei să activezi mai multe funcții?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Spune-ne cum lucrează afacerea ta. Îți confirmăm planul potrivit, funcțiile disponibile și pașii de activare.</p><Link href="/pentru-afaceri#cere-acces" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#147f83]">Solicită upgrade <ArrowRight size={16} aria-hidden="true" /></Link></div> : <div className="mt-10 rounded-[28px] bg-[#193c3e] p-6 text-white sm:p-8"><h2 className="text-xl font-bold">Planul PRO este activ</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Poți folosi funcțiile disponibile pentru afacerea ta din meniu și din Setări. Pentru o integrare specială, ne poți scrie prin suportul din cont.</p><Link href="/dashboard/setari" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#147f83]">Deschide Setările <ArrowRight size={16} aria-hidden="true" /></Link></div>}
    </div>
  </div>
}

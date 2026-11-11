import Image from 'next/image'
import Link from 'next/link'
import AccessRequestForm from '@/components/access-request-form'
import { PublicFooter } from '@/components/ui/public-footer'
import { publicMetadata } from '@/lib/seo'
import MarketplaceHeroVideos from '@/components/marketplace-hero-videos'
import BusinessInteractiveDemo from './business-interactive-demo'
import './business-page.css'
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

export const metadata = publicMetadata(
  'BookEasy pentru afaceri | Programări și planuri',
  'Rezervări online, calendar, echipă și comunicare cu clienții. Vezi funcțiile BookEasy și planurile Free, Standard și Pro.',
  '/pentru-afaceri',
)

const capabilities = [
  {
    icon: CalendarDays,
    title: 'Rezervări și calendar',
    description: 'Pagină publică de rezervare, disponibilitate calculată după program și servicii, calendar pentru echipă.',
  },
  {
    icon: Users,
    title: 'Clienți și echipă',
    description: 'Fișe de client, servicii, membri ai echipei, resurse și statistici pentru activitatea zilnică.',
  },
  {
    icon: BellRing,
    title: 'Confirmări și reamintiri',
    description: 'Mesaje de confirmare, cereri de reconfirmare și remindere prin canalele configurate.',
  },
  {
    icon: MessageCircle,
    title: 'Mesaje într-un singur loc',
    description: 'Conversații și automatizări pentru canalele Meta conectate, cu preluare de către operator.',
  },
  {
    icon: CreditCard,
    title: 'Plăți și avansuri',
    description: 'Opțiuni de avans pentru rezervări prin procesatorul de plăți configurat de afacere.',
  },
  {
    icon: ShieldCheck,
    title: 'Controlul afacerii',
    description: 'Setări, recenzii, integrare Google Calendar și funcții dedicate anumitor categorii.',
  },
]

const plans = [
  {
    name: 'FREE',
    eyebrow: 'Acces aprobat',
    price: '0',
    suffix: 'lei / lună',
    description: 'O variantă simplă pentru afacerile cărora le acordăm acces gratuit.',
    features: [
      'Pagină publică de prezentare și rezervare',
      'Servicii și program de lucru',
      'Calendar și evidența programărilor',
      'Administrarea clienților',
    ],
    note: 'Accesul gratuit este acordat manual, după evaluarea cererii.',
    action: 'Solicită acces',
    href: '#cere-acces',
    featured: false,
  },
  {
    name: 'STANDARD',
    eyebrow: 'Disponibil acum',
    price: '55',
    suffix: 'lei / lună',
    description: 'Pentru afaceri care vor să gestioneze programările și comunicarea într-un singur loc.',
    features: [
      'Tot ce include Free',
      'Echipă, servicii și resurse',
      'Confirmări și reamintiri automate',
      'Mesaje din canalele conectate',
      'Statistici și recenzii',
      'Conectare Google Calendar',
    ],
    note: 'Fără debitare automată. Oferta de 2 luni gratuite se aplică doar cu un cod promoțional valid.',
    action: 'Creează contul afacerii',
    href: '/signup',
    featured: true,
  },
  {
    name: 'PRO',
    eyebrow: 'Configurare asistată',
    price: 'La cerere',
    suffix: '',
    description: 'Pentru fluxuri avansate și integrări adaptate modului în care lucrează afacerea.',
    features: [
      'Tot ce include Standard',
      'Fluxuri și automatizări personalizate',
      'Integrări speciale, configurate la cerere',
      'Funcții dedicate categoriei de afacere',
      'Asistență la configurarea fluxurilor',
    ],
    note: 'Prețul și integrările se stabilesc prin ofertă. Planul Pro nu se activează automat la înscriere.',
    action: 'Discută cu noi',
    href: '#cere-acces',
    featured: false,
  },
] as const

export default function ForBusinessesPage() {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#193c3e]">
      <header className="sticky top-0 z-30 border-b border-[#e2eae8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/descopera" className="flex items-center gap-2.5" aria-label="BookEasy - Descoperă afaceri">
            <Image src="/logo-mark-square.png" alt="" width={34} height={34} />
            <span className="text-base font-bold tracking-tight">bookeasy.ro</span>
          </Link>
          <nav className="hidden items-center gap-2 lg:flex" aria-label="Navigare pentru afaceri">
            <a href="#functionalitati" className="rounded-full px-4 py-2 text-sm font-semibold text-[#526365] hover:bg-[#eef7f5] hover:text-[#147f83]">Funcționalități</a>
            <a href="#platforma" className="rounded-full px-4 py-2 text-sm font-semibold text-[#526365] hover:bg-[#eef7f5] hover:text-[#147f83]">Vezi platforma</a>
            <a href="#planuri" className="rounded-full px-4 py-2 text-sm font-semibold text-[#526365] hover:bg-[#eef7f5] hover:text-[#147f83]">Planuri</a>
            <a href="#intrebari" className="rounded-full px-4 py-2 text-sm font-semibold text-[#526365] hover:bg-[#eef7f5] hover:text-[#147f83]">Întrebări</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-[#526365] hover:text-[#147f83] md:inline-flex">Intră în cont</Link>
            <Link href="/signup" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#168b8b] px-4 text-xs font-bold text-white shadow-[0_7px_15px_#0a6e7022] transition hover:bg-[#0e7476] sm:text-sm">
              Creează afacerea <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="business-hero relative overflow-hidden bg-[#eaf5f1] px-5 py-16 sm:px-8 sm:py-24">
        <MarketplaceHeroVideos />
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#b8e7df]/60 blur-3xl" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#cce8df] bg-white/75 px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#168588]">
              <Sparkles size={14} /> BookEasy pentru afaceri
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-[-.055em] sm:text-5xl lg:text-[3.7rem]">
              Programările tale, <span className="text-[#138f8e]"><span className="whitespace-nowrap">într-un</span> singur loc.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#607474] sm:text-lg">
              Clienții rezervă online, echipa vede disponibilitatea reală, iar tu urmărești programările și mesajele dintr-un singur panou.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#planuri" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#168d8d] px-5 text-sm font-bold text-white transition hover:bg-[#0c7174]">
                Vezi planurile <ArrowRight size={17} />
              </a>
              <a href="#functionalitati" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#bcded5] bg-white px-5 text-sm font-bold text-[#247975] transition hover:bg-[#f2faf8]">
                Ce include BookEasy <ChevronRight size={17} />
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#58736e]">
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-[#168d8d]" /> Rezervări din browser</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-[#168d8d]" /> Calendar pentru echipă</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-[#168d8d]" /> Configurare pe categorie</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-lg rounded-[28px] border border-[#d5e6e1] bg-white p-5 shadow-[0_25px_65px_#17383a1c] sm:p-7" aria-label="Exemplu de calendar BookEasy">
            <div className="flex items-center justify-between border-b border-[#e5efeb] pb-5">
              <div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#168d8d]">Astăzi în BookEasy</p><p className="mt-1 text-xl font-extrabold">Programul echipei</p></div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e8f7f4] text-[#168d8d]"><CalendarDays size={21} /></span>
            </div>
            {[
              { time: '09:00', name: 'Prima programare', service: 'Serviciu rezervat', color: 'bg-[#dff3ee]' },
              { time: '11:30', name: 'Programare confirmată', service: 'Client notificat', color: 'bg-[#edf4de]' },
              { time: '15:00', name: 'Următoarea rezervare', service: 'Disponibilitate actualizată', color: 'bg-[#e6f0f8]' },
            ].map((item) => (
              <div key={item.time} className="mt-3 flex items-center gap-4 rounded-2xl border border-[#e5efeb] bg-[#fbfdfc] p-4">
                <span className="text-sm font-extrabold text-[#168d8d]">{item.time}</span>
                <span className={`h-10 w-1 rounded-full ${item.color}`} />
                <span><strong className="block text-sm">{item.name}</strong><small className="mt-1 block text-xs text-[#78908b]">{item.service}</small></span>
                <Check size={17} className="ml-auto text-[#48a88f]" />
              </div>
            ))}
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#eaf5f1] p-4 text-sm font-semibold text-[#247975]">
              <Clock3 size={19} /> Mai puțin timp cu administrarea, mai mult timp cu clienții.
            </div>
          </div>
        </div>
      </section>

      <section id="functionalitati" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#14908d]">Ce poți face în BookEasy</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Funcțiile de care ai nevoie zi de zi.</h2>
            <p className="max-w-md text-sm leading-7 text-[#6f8580]">Unele integrări necesită conectarea conturilor proprii și configurare pentru categoria afacerii.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-[22px] border border-[#dceae6] bg-white p-6 shadow-[0_7px_25px_#17383a0b]">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e8f7f4] text-[#168d8d]"><Icon size={21} /></span>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#6f8580]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="platforma" className="scroll-mt-24 border-t border-[#dceae6] bg-[#edf6f3] px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1580px]">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#14908d]">BookEasy în practică</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Vezi cum arată platforma.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#607474]">Explorează un cont demonstrativ cu date fictive. Poți răsfoi calendarul, programările, statisticile și setările, fără să trimiți mesaje sau să modifici o afacere reală.</p>
            </div>
            <a href="#planuri" className="inline-flex items-center gap-2 text-sm font-bold text-[#16817f] hover:text-[#0c7174]">Compară planurile <ArrowRight size={16} /></a>
          </div>
          <BusinessInteractiveDemo />
        </div>
      </section>

      <section id="planuri" className="scroll-mt-24 border-y border-[#dceae6] bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#14908d]">Planuri BookEasy</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Alege cum începi.</h2>
            <p className="mt-4 text-sm leading-7 text-[#6f8580]">Free este acordat după aprobare, Standard se poate activa la înscriere, iar pentru Pro stabilim împreună oferta și integrările.</p>
          </div>
          <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={`flex flex-col rounded-[26px] border p-6 sm:p-7 ${plan.featured ? 'border-[#4eb5a8] bg-[#f4fbf9] shadow-[0_18px_45px_#128b8620]' : 'border-[#dceae6] bg-white shadow-[0_7px_25px_#17383a0b]'}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold tracking-[.13em]">{plan.name}</h3>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${plan.featured ? 'bg-[#d9f1e9] text-[#107973]' : 'bg-[#edf3f0] text-[#57736c]'}`}>{plan.eyebrow}</span>
                </div>
                <div className="mt-6 flex min-h-16 items-end gap-2"><strong className={`font-extrabold tracking-[-.055em] ${plan.price === 'La cerere' ? 'text-4xl' : 'text-5xl'}`}>{plan.price}</strong>{plan.suffix && <span className="pb-1 text-sm font-semibold text-[#718681]">{plan.suffix}</span>}</div>
                <p className="mt-5 min-h-16 text-sm leading-7 text-[#607474]">{plan.description}</p>
                <div className="my-6 h-px bg-[#e2eae8]" />
                <ul className="flex-1 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-6"><Check size={18} className="mt-0.5 shrink-0 text-[#2d9e8e]" /><span>{feature}</span></li>
                  ))}
                </ul>
                <p className="mt-7 min-h-16 text-xs leading-6 text-[#718681]">{plan.note}</p>
                <Link href={plan.href} className={`mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition ${plan.featured ? 'bg-[#168d8d] text-white hover:bg-[#0c7174]' : 'border border-[#a8d7ce] bg-white text-[#16817f] hover:bg-[#eef8f5]'}`}>
                  {plan.action} <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-6 text-[#718681]">Prețul Standard este total în RON. SMS, WhatsApp, procesatorii de plată și alte servicii externe pot avea costuri proprii. Limitele și funcțiile fiecărui cont sunt confirmate la activare.</p>
        </div>
      </section>

      <section id="intrebari" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#14908d]">Răspunsuri rapide</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-.045em]">Întrebări frecvente.</h2></div>
          <div className="space-y-3">
            {[
              ['Pot începe fără card?', 'Da. Înscrierea Standard nu presupune debitare automată. Condițiile de plată sunt prezentate la activarea afacerii.'],
              ['Primesc automat două luni gratuite?', 'Nu. Oferta de două luni se aplică doar dacă introduci un cod promoțional valid înainte de activarea afacerii.'],
              ['Google Wallet și codurile QR sunt incluse?', 'Integrarea Google Wallet este în pregătire și nu este inclusă în planurile active. Nu publicăm o dată de lansare până la configurarea și aprobarea serviciului.'],
              ['Pot conecta mesageria și plățile?', 'Da, acolo unde integrarea este disponibilă pentru afacerea ta. Sunt necesare conturile și aprobările furnizorilor respectivi.'],
            ].map(([question, answer]) => (
              <details key={question} className="group rounded-2xl border border-[#dceae6] bg-white p-5">
                <summary className="cursor-pointer list-none pr-6 text-sm font-bold marker:hidden">{question}<span className="float-right text-[#168d8d] group-open:rotate-90">›</span></summary>
                <p className="mt-3 text-sm leading-7 text-[#6f8580]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="cere-acces" className="scroll-mt-24 bg-[#193c3e] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#79d1bc]">Hai să discutăm</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Spune-ne cum lucrează afacerea ta.</h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/70">Te ajutăm să alegi configurarea potrivită, inclusiv dacă ai nevoie de acces Free sau de o ofertă Pro.</p>
            <Link href="/signup" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#9ce2d0] hover:text-white">Preferi să începi cu Standard? Creează contul <ArrowRight size={16} /></Link>
          </div>
          <div className="rounded-[26px] bg-white p-4 text-[#193c3e] sm:p-6"><AccessRequestForm /></div>
        </div>
      </section>
      <PublicFooter />
    </main>
  )
}

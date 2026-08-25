import Image from 'next/image'
import Link from 'next/link'
import MapClient from './harta/map-client'
import AccessRequestForm from '@/components/access-request-form'
import { PublicFooter } from '@/components/ui/public-footer'
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarCheck2,
  Check,
  Clock3,
  Globe,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react'

const STEPS = [
  {
    icon: MessageCircle,
    number: '01',
    title: 'Clientul trimite un mesaj',
    desc: 'Pe WhatsApp, Instagram, Facebook sau direct din pagina ta de rezervare.',
  },
  {
    icon: Bot,
    number: '02',
    title: 'BookEasy găsește ora potrivită',
    desc: 'Înțelege serviciul dorit, verifică programul echipei și propune orele disponibile.',
  },
  {
    icon: CalendarCheck2,
    number: '03',
    title: 'Programarea este confirmată',
    desc: 'Intră automat în calendar, iar clientul primește confirmări și reamintiri.',
  },
]

const FEATURES = [
  { icon: Bell, title: 'Mai puține neprezentări', desc: 'Reamintiri automate înaintea programării.' },
  { icon: Users, title: 'Echipă sincronizată', desc: 'Program separat pentru fiecare medic sau membru.' },
  { icon: Clock3, title: 'Disponibilitate reală', desc: 'Ore calculate după program și durata serviciului.' },
]

const AUDIENCES = ['Clinici', 'Saloane', 'Cabinete', 'Spații de evenimente']

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--surface-muted)]">
      <header className="absolute inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm backdrop-blur-xl sm:px-5">
          <Link href="/" className="flex items-center gap-2" aria-label="BookEasy - pagina principală">
            <Image src="/logo-mark-square.png" alt="" width={30} height={30} />
            <span className="hidden text-sm font-semibold min-[380px]:inline sm:text-base">bookeasy.ro</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-600 md:flex" aria-label="Navigare principală">
            <a href="#cum-functioneaza" className="transition hover:text-gray-950">Cum funcționează</a>
            <a href="#beneficii" className="transition hover:text-gray-950">Beneficii</a>
            <a href="#afaceri" className="transition hover:text-gray-950">Descoperă afaceri</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/login" className="whitespace-nowrap px-2 py-2 text-xs font-semibold text-gray-700 transition hover:text-gray-950 sm:px-3 sm:text-sm">
              <span className="sm:hidden">Intră</span><span className="hidden sm:inline">Intră în cont</span>
            </Link>
            <a href="#cere-acces" className="whitespace-nowrap rounded-full bg-[#14142b] px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg sm:px-4 sm:text-sm">
              Cere acces
            </a>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[680px] overflow-hidden bg-white sm:min-h-[720px]">
        <Image
          src="/hero-bookeasy.png"
          alt="Calendar de programări BookEasy conectat cu mesageria de pe telefon"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/20 sm:via-white/75" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent" />

        <div className="relative mx-auto flex min-h-[680px] max-w-6xl items-center px-5 pb-14 pt-28 sm:min-h-[720px] sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dcebc9] bg-[#f5faee]/90 px-3 py-1.5 text-xs font-semibold text-[#5f8d27] backdrop-blur">
              <Sparkles size={14} /> Asistentul tău pentru programări, disponibil 24/7
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-[#14142b] sm:text-5xl lg:text-6xl">
              Transformă fiecare mesaj într-o <span className="text-[#70a832]">programare.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
              BookEasy răspunde clienților, găsește orele libere și organizează întreaga echipă într-un singur calendar — chiar și când tu ești ocupat.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#cere-acces" className="btn-primary group inline-flex items-center justify-center gap-2 px-6 py-3">
                Începe cu BookEasy <ArrowRight size={17} className="transition group-hover:translate-x-1" />
              </a>
              <Link href="/harta" className="btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3">
                <Globe size={17} /> Vezi afacerile
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600 sm:text-sm">
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[#70a832]" /> Fără aplicație pentru clienți</span>
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[#70a832]" /> Configurare asistată</span>
              <span className="flex items-center gap-1.5"><Check size={15} className="text-[#70a832]" /> Potrivit pentru echipe</span>
            </div>
          </div>
        </div>

        <div className="hero-float hero-float-one hidden lg:flex" aria-hidden="true">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef6e3] text-[#6a9c2b]"><CalendarCheck2 size={18} /></span>
          <span><strong>Programare confirmată</strong><small>Mâine, 10:30</small></span>
        </div>
        <div className="hero-float hero-float-two hidden xl:flex" aria-hidden="true">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef6e3] text-[#6a9c2b]"><Bell size={18} /></span>
          <span><strong>Reminder trimis</strong><small>Client notificat automat</small></span>
        </div>
        <div className="hero-float hero-chat hero-float-three hidden 2xl:block" aria-hidden="true">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#14142b]">
            <span className="social-logo social-logo-whatsapp !h-7 !w-7"><MessageCircle size={15} /></span>
            Conversație WhatsApp
          </div>
          <p className="hero-chat-in">Bună! Aveți un loc liber azi?</p>
          <p className="hero-chat-out">Da, la 16:30. Îl rezervăm?</p>
        </div>
        <div className="hero-float hero-float-four hidden 2xl:flex" aria-hidden="true">
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[#14142b] text-white">
            <Bell size={17} /><i className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#7eb735]" />
          </span>
          <span><strong>Programare nouă</strong><small>Maria · Consultație · 16:30</small></span>
        </div>
        <div className="hero-float hero-social-chat hero-float-five hidden 2xl:block" aria-hidden="true">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#14142b]">
            <span className="social-logo social-logo-messenger"><MessageCircle size={15} /></span>
            Messenger
          </div>
          <p className="hero-chat-in">Bună! Când aveți prima oră liberă?</p>
          <p className="hero-chat-out hero-chat-messenger">Astăzi la 18:00. Confirmăm?</p>
        </div>
        <div className="hero-float hero-social-chat hero-float-six hidden 2xl:block" aria-hidden="true">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#14142b]">
            <span className="social-logo social-logo-instagram"><i className="instagram-glyph" /></span>
            Instagram
          </div>
          <p className="hero-chat-in">Aș dori o programare pentru mâine.</p>
          <p className="hero-chat-out hero-chat-instagram">Sigur! Avem disponibil la 11:30.</p>
        </div>
      </section>

      <section id="cum-functioneaza" className="border-y border-[var(--border-soft)] bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-hover)]">Un singur flux</p>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Simplu pentru client. Automat pentru tine.</h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">Fără aplicații noi și fără introducere manuală. BookEasy leagă mesajele, disponibilitatea și calendarul într-un proces continuu.</p>
              <a href="#cere-acces" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-hover)] transition hover:gap-3">
                Vreau să automatizez programările <ArrowRight size={16} />
              </a>
            </div>
            <div className="relative grid gap-7 md:grid-cols-3 md:gap-5">
              <div className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-transparent via-[#b8d993] to-transparent md:block" />
            {STEPS.map((step) => (
              <article key={step.number} className="relative">
                <div className="relative z-10 grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-[var(--accent-soft)] text-[var(--accent-hover)] shadow-sm">
                  <step.icon size={21} />
                </div>
                <span className="mt-4 block text-[10px] font-bold tracking-[0.16em] text-gray-400">PASUL {step.number}</span>
                <h3 className="mt-1 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.desc}</p>
              </article>
            ))}
            </div>
          </div>

          <div id="beneficii" className="relative mt-14 overflow-hidden rounded-[30px] bg-[#14142b] px-6 py-9 text-white sm:px-10 sm:py-11">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#7eb735]/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#a9d476]">Tot ce contează</p>
                <h3 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Mai puțină administrare. Mai mult timp pentru clienți.</h3>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">Tu stabilești programul și regulile. BookEasy se ocupă de rutina dintre mesaj și programarea confirmată.</p>
              </div>
              <div className="divide-y divide-white/10 border-y border-white/10">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="grid grid-cols-[auto_1fr] gap-3 py-4">
                <feature.icon size={19} className="mt-0.5 text-[#a9d476]" />
                <div><h4 className="text-sm font-semibold">{feature.title}</h4><p className="mt-1 text-xs text-white/55">{feature.desc}</p></div>
              </div>
            ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cere-acces" className="border-y border-[var(--border-soft)] bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <AccessRequestForm />
            <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-hover)]">Începe simplu</p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">Spune-ne cum lucrezi. Noi te ajutăm să pornești.</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              Completează formularul și revenim cu o configurare adaptată afacerii tale, fără să pierzi timp cu setări complicate.
            </p>
            <div className="mt-6 space-y-3 text-sm text-gray-700">
              <p className="flex items-center gap-2"><Check size={16} className="text-[#70a832]" /> Discutăm fluxul actual de programări</p>
              <p className="flex items-center gap-2"><Check size={16} className="text-[#70a832]" /> Configurăm serviciile și echipa</p>
              <p className="flex items-center gap-2"><Check size={16} className="text-[#70a832]" /> Te ajutăm să conectezi canalele</p>
            </div>
          </div>
        </div>
      </section>

      <section id="afaceri" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-hover)]">Pentru clienți</p>
            <h2 className="text-xl font-semibold">Descoperă afaceri pe BookEasy</h2>
          </div>
          <p className="max-w-md text-sm text-gray-500">Găsește saloane, clinici și spații de evenimente și rezervă direct.</p>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-white shadow-[var(--shadow-card)]">
          <MapClient />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Creat pentru</span>
          {AUDIENCES.map((audience) => <span key={audience} className="font-medium text-gray-700">{audience}</span>)}
        </div>
      </section>

      <PublicFooter />
    </main>
  )
}

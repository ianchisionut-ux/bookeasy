'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { addDays, addWeeks, format } from 'date-fns'
import { ro } from 'date-fns/locale'
import {
  ArrowRight, BarChart3, BookOpen, CalendarDays, ChevronLeft, ChevronRight,
  ClipboardList, ExternalLink, LockKeyhole, MessageCircle, Plus,
  Settings2, Star, Store, Users, X,
} from 'lucide-react'

type View = 'Prezentare' | 'Calendar' | 'Programări' | 'Mesaje' | 'Clienți' | 'Recenzii' | 'Statistici' | 'Setări' | 'Planuri' | 'Pagina publică' | 'Ghid'
type BookingStatus = 'În așteptare' | 'Confirmată' | 'Anulată'
type Booking = { id: string; customer: string; service: string; date: string; time: string; duration: number; status: BookingStatus; source: string }

const initialBookings: Booking[] = [
  { id: '1', customer: 'Ana Demo', service: 'Consultare inițială', date: '2026-11-02', time: '10:00', duration: 60, status: 'Confirmată', source: 'Site' },
  { id: '2', customer: 'Mara Exemplu', service: 'Control', date: '2026-11-02', time: '12:00', duration: 30, status: 'În așteptare', source: 'Site' },
  { id: '3', customer: 'Paul Demo', service: 'Consultare inițială', date: '2026-11-03', time: '11:00', duration: 60, status: 'Confirmată', source: 'Manual' },
  { id: '4', customer: 'Daria Exemplu', service: 'Control', date: '2026-11-04', time: '15:00', duration: 45, status: 'În așteptare', source: 'Facebook' },
  { id: '5', customer: 'Radu Demo', service: 'Consultare inițială', date: '2026-11-05', time: '09:30', duration: 60, status: 'Confirmată', source: 'Instagram' },
  { id: '6', customer: 'Ioana Exemplu', service: 'Control', date: '2026-11-06', time: '13:00', duration: 30, status: 'Confirmată', source: 'Site' },
]

const navigation = [
  { name: 'Prezentare', icon: Store }, { name: 'Calendar', icon: CalendarDays },
  { name: 'Programări', icon: ClipboardList }, { name: 'Mesaje', icon: MessageCircle },
  { name: 'Clienți', icon: Users }, { name: 'Recenzii', icon: Star },
  { name: 'Statistici', icon: BarChart3 }, { name: 'Setări', icon: Settings2 },
  { name: 'Planuri', icon: LockKeyhole }, { name: 'Pagina publică', icon: ExternalLink },
  { name: 'Ghid', icon: BookOpen },
] as const

const demoMonday = new Date(2026, 10, 2)
const services = [
  { name: 'Consultare inițială', duration: '60 min', price: '150 lei' },
  { name: 'Control', duration: '30 min', price: '80 lei' },
  { name: 'Evaluare', duration: '45 min', price: '120 lei' },
]

function statusColor(status: BookingStatus) {
  if (status === 'Confirmată') return 'bg-[#e1f4e8] text-[#1d8650] border-[#bfe8ce]'
  if (status === 'Anulată') return 'bg-[#fce9e9] text-[#c94e54] border-[#f5cfd1]'
  return 'bg-[#fff3d9] text-[#aa7917] border-[#f6e4b7]'
}

export default function BusinessInteractiveDemo() {
  const [view, setView] = useState<View>('Prezentare')
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Toate statusurile')
  const [period, setPeriod] = useState('30 zile')
  const [publicVisible, setPublicVisible] = useState(true)
  const [conversation, setConversation] = useState('Ana Demo')
  const [reply, setReply] = useState('')
  const [sentReplies, setSentReplies] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const selected = bookings.find((booking) => booking.id === selectedId)
  const monday = addWeeks(demoMonday, weekOffset)
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
  const filteredBookings = bookings.filter((booking) =>
    `${booking.customer} ${booking.service}`.toLocaleLowerCase('ro').includes(query.toLocaleLowerCase('ro'))
    && (statusFilter === 'Toate statusurile' || booking.status === statusFilter))

  function addDemoBooking() {
    const booking: Booking = {
      id: `demo-${Date.now()}`,
      customer: 'Vizitator demo', service: 'Evaluare', date: format(monday, 'yyyy-MM-dd'),
      time: '16:00', duration: 45, status: 'În așteptare', source: 'Demo',
    }
    setBookings((current) => [...current, booking])
    setSelectedId(booking.id)
    setNotice('Programarea a fost adăugată doar în această simulare.')
  }

  function sendDemoReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reply.trim()) return
    setSentReplies((current) => [...current, reply.trim()])
    setReply('')
    setNotice('Mesajul este vizibil doar în acest demo; nu a fost trimis nimănui.')
  }

  return (
    <div className="relative flex h-[690px] flex-col overflow-hidden rounded-[24px] border border-[#d8e8e2] bg-white shadow-[0_14px_45px_#17383a12]" aria-label="Cont demonstrativ BookEasy">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#dceae6] bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4f5f1] text-[#168d8d]"><CalendarDays size={21} /></span>
          <div><strong className="block text-sm">Studio Demo</strong><span className="text-xs text-[#758985]">Cont demonstrativ · date fictive</span></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-[#fff3d9] px-3 py-1.5 text-[11px] font-bold text-[#9c7014] sm:inline">Acțiunile nu se salvează</span>
          <Link href="/signup" className="inline-flex items-center gap-1 rounded-full bg-[#168d8d] px-3 py-2 text-xs font-bold text-white hover:bg-[#0c7174]">Creează cont <ArrowRight size={14} /></Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[178px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#e3ece9] bg-[#f4f8f6] p-3 md:flex" aria-label="Secțiuni cont demo">
          {navigation.map(({ name, icon: Icon }) => (
            <button key={name} type="button" onClick={() => { setView(name); setNotice(''); setSelectedId(null) }} aria-current={view === name ? 'page' : undefined} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold transition ${view === name ? 'bg-[#168d8d] text-white' : 'text-[#536a67] hover:bg-white hover:text-[#168d8d]'}`}>
              <Icon size={16} />{name}
            </button>
          ))}
          <p className="mt-auto px-2 pt-4 text-[11px] leading-5 text-[#8a9b97]">SMS, plățile și integrările externe sunt indisponibile în demo.</p>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#e3ece9] bg-[#f4f8f6] px-3 py-2 md:hidden" aria-label="Secțiuni cont demo pe mobil">
            {navigation.map(({ name }) => <button key={name} type="button" onClick={() => { setView(name); setNotice(''); setSelectedId(null) }} aria-current={view === name ? 'page' : undefined} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${view === name ? 'bg-[#168d8d] text-white' : 'text-[#536a67]'}`}>{name}</button>)}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f9f7] p-4 sm:p-6">
            {notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#bfe8dd] bg-[#e8f7f2] px-4 py-2 text-xs text-[#25746e]">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Închide mesajul"><X size={15} /></button></div>}

            {view === 'Prezentare' && <>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#168d8d]">Bine ai venit în demo</p><h3 className="mt-1 text-2xl font-extrabold">Așa arată contul afacerii tale</h3><p className="mt-2 text-sm text-[#6f8580]">Explorează fiecare secțiune din meniu. Tot ce modifici aici rămâne doar pe această pagină.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
                ['Programări', bookings.length, 'Vezi lista și detaliile'], ['Clienți', 5, 'Fișe și istoric'],
                ['Mesaje', 2, 'Conversații simulate'], ['Grad de ocupare', '68%', 'Statistici de exemplu'],
              ].map(([title, value, detail]) => <div key={title} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs text-[#758985]">{title}</p><strong className="mt-2 block text-3xl">{value}</strong><span className="text-xs text-[#758985]">{detail}</span></div>)}</div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2"><button type="button" onClick={() => setView('Calendar')} className="rounded-2xl bg-[#e1f3ee] p-6 text-left hover:bg-[#d4eee6]"><CalendarDays className="text-[#168d8d]" /><strong className="mt-3 block">Deschide calendarul</strong><span className="mt-1 block text-sm text-[#607474]">Vezi cum sunt așezate programările și deschide detaliile lor.</span></button><button type="button" onClick={() => setView('Pagina publică')} className="rounded-2xl bg-[#e9f1fb] p-6 text-left hover:bg-[#dfeafa]"><Store className="text-[#3971aa]" /><strong className="mt-3 block">Explorează pagina publică</strong><span className="mt-1 block text-sm text-[#607474]">Simulează felul în care un vizitator descoperă și rezervă un serviciu.</span></button></div>
            </>}

            {view === 'Calendar' && <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">Calendar programări</h3><p className="text-xs text-[#758985]">Săptămâna demonstrativă · {format(monday, 'd MMM', { locale: ro })} – {format(addDays(monday, 6), 'd MMM yyyy', { locale: ro })}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setWeekOffset((n) => n - 1)} aria-label="Săptămâna anterioară" className="demo-icon-button"><ChevronLeft size={17} /></button><button type="button" onClick={() => setWeekOffset(0)} className="demo-small-button">Săptămâna demo</button><button type="button" onClick={() => setWeekOffset((n) => n + 1)} aria-label="Săptămâna următoare" className="demo-icon-button"><ChevronRight size={17} /></button><button type="button" onClick={addDemoBooking} className="demo-primary-button"><Plus size={15} /> Adaugă demo</button></div></div>
              <div className="overflow-x-auto rounded-2xl border border-[#e0eae7] bg-white"><div className="grid min-w-[980px] grid-cols-[54px_repeat(7,minmax(130px,1fr))]"><div className="border-b border-r border-[#e6edeb]" />{days.map((day) => <div key={day.toISOString()} className="border-b border-r border-[#e6edeb] py-3 text-center text-xs font-bold">{format(day, 'dd EEE', { locale: ro })}</div>)}<div className="relative h-[504px] border-r border-[#e6edeb]">{Array.from({ length: 9 }, (_, i) => <div key={i} className="absolute left-0 w-full border-t border-[#edf1ef] pl-2 text-[11px] text-[#8a9996]" style={{ top: i * 56 }}>{String(i + 9).padStart(2, '0')}:00</div>)}</div>{days.map((day) => { const date = format(day, 'yyyy-MM-dd'); return <div key={date} className="relative h-[504px] border-r border-[#e6edeb] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_55px,#edf1ef_55px,#edf1ef_56px)]">{bookings.filter((booking) => booking.date === date && booking.status !== 'Anulată').map((booking) => { const [hour, minute] = booking.time.split(':').map(Number); return <button key={booking.id} type="button" onClick={() => setSelectedId(booking.id)} className={`absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] leading-tight shadow-sm ${statusColor(booking.status)}`} style={{ top: (hour - 9 + minute / 60) * 56, height: Math.max(40, booking.duration / 60 * 56) }}><strong>{booking.time}</strong><span className="block truncate">{booking.customer}</span><span className="block truncate opacity-80">{booking.service}</span></button> })}</div> })}</div></div>
            </>}

            {view === 'Programări' && <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">Programări</h3><p className="text-xs text-[#758985]">{filteredBookings.length} programări de exemplu</p></div><button type="button" onClick={addDemoBooking} className="demo-primary-button"><Plus size={15} /> Adaugă demo</button></div><div className="mb-4 flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută client sau serviciu..." aria-label="Caută programări" className="demo-input max-w-xs" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrează după status" className="demo-input max-w-48"><option>Toate statusurile</option><option>În așteptare</option><option>Confirmată</option><option>Anulată</option></select></div><div className="overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b text-[#758985]"><tr><th className="p-4">Client</th><th className="p-4">Serviciu</th><th className="p-4">Data</th><th className="p-4">Canal</th><th className="p-4">Status</th></tr></thead><tbody>{filteredBookings.map((booking) => <tr key={booking.id} onClick={() => setSelectedId(booking.id)} className="cursor-pointer border-b border-[#eef2f0] hover:bg-[#f6faf8]"><td className="p-4 font-semibold text-[#168d8d]">{booking.customer}</td><td className="p-4">{booking.service}</td><td className="p-4">{booking.date} · {booking.time}</td><td className="p-4">{booking.source}</td><td className="p-4"><span className={`rounded-full border px-2 py-1 ${statusColor(booking.status)}`}>{booking.status}</span></td></tr>)}</tbody></table>{filteredBookings.length === 0 && <p className="p-6 text-sm text-[#758985]">Nu există programări pentru acest filtru.</p>}</div></>}

            {view === 'Mesaje' && <><h3 className="mb-1 text-xl font-extrabold">Mesaje</h3><p className="mb-4 text-xs text-[#758985]">Conversații fictive. Niciun mesaj nu părăsește browserul.</p><div className="grid min-h-[450px] overflow-hidden rounded-2xl bg-white shadow-sm sm:grid-cols-[190px_1fr]"><div className="border-b border-r-[#e6edeb] sm:border-b-0 sm:border-r">{['Ana Demo', 'Mara Exemplu'].map((name) => <button key={name} type="button" onClick={() => { setConversation(name); setSentReplies([]) }} className={`block w-full border-b border-[#e6edeb] px-4 py-4 text-left text-sm ${conversation === name ? 'bg-[#e8f7f3] font-bold text-[#168d8d]' : ''}`}>{name}<span className="mt-1 block text-xs font-normal text-[#8a9996]">Întrebare despre programare</span></button>)}</div><div className="flex min-h-[330px] flex-col"><div className="border-b px-4 py-3 text-sm font-bold">{conversation} · conversație demo</div><div className="flex-1 space-y-3 p-4"><div className="w-fit max-w-[80%] rounded-2xl bg-[#eef3f1] px-4 py-3 text-sm">Bună! Aș dori să aflu când aveți locuri disponibile.</div><div className="ml-auto w-fit max-w-[80%] rounded-2xl bg-[#168d8d] px-4 py-3 text-sm text-white">Bună! Poți verifica disponibilitatea direct în calendar.</div>{sentReplies.map((message, index) => <div key={index} className="ml-auto w-fit max-w-[80%] rounded-2xl bg-[#168d8d] px-4 py-3 text-sm text-white">{message}</div>)}</div><form onSubmit={sendDemoReply} className="flex gap-2 border-t p-3"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Scrie un răspuns de probă..." aria-label="Răspuns demo" className="demo-input" /><button type="submit" className="demo-primary-button">Trimite demo</button></form></div></div></>}

            {view === 'Clienți' && <><h3 className="mb-1 text-xl font-extrabold">Clienți</h3><p className="mb-4 text-xs text-[#758985]">Fișe de exemplu, fără date personale reale.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{['Ana Demo', 'Mara Exemplu', 'Paul Demo', 'Daria Exemplu', 'Radu Demo', 'Ioana Exemplu'].map((name, index) => <button key={name} type="button" onClick={() => { setQuery(name); setView('Programări') }} className="rounded-2xl bg-white p-5 text-left shadow-sm hover:ring-2 hover:ring-[#8dd3c4]"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#e3f5f0] font-bold text-[#168d8d]">{name[0]}</span><strong className="mt-3 block text-sm">{name}</strong><span className="mt-1 block text-xs text-[#758985]">{index % 2 ? 'Client revenit' : 'Client nou'} · Vezi programările →</span></button>)}</div></>}

            {view === 'Recenzii' && <><h3 className="mb-1 text-xl font-extrabold">Recenzii</h3><p className="mb-4 text-xs text-[#758985]">Exemple pentru prezentarea modului în care apar opiniile clienților.</p><div className="grid gap-4 lg:grid-cols-2">{[['Ana Demo', 'Serviciu foarte bine organizat. Am găsit rapid un interval liber.'], ['Paul Demo', 'Programarea online a fost simplă, iar confirmarea a venit imediat.']].map(([name, review]) => <article key={name} className="rounded-2xl bg-white p-6 shadow-sm"><div className="text-[#f0b54b]">★★★★★</div><p className="mt-3 text-sm leading-6">„{review}”</p><p className="mt-4 text-xs font-bold text-[#758985]">{name} · recenzie fictivă</p></article>)}</div></>}

            {view === 'Statistici' && <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">Statistici</h3><p className="text-xs text-[#758985]">Cifre ilustrative pentru un cont demo</p></div><div className="flex rounded-xl bg-white p-1">{['7 zile', '30 zile', '90 zile'].map((item) => <button key={item} type="button" onClick={() => setPeriod(item)} className={`rounded-lg px-3 py-2 text-xs ${period === item ? 'bg-[#168d8d] font-bold text-white' : 'text-[#758985]'}`}>{item}</button>)}</div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Programări', period === '7 zile' ? '6' : period === '90 zile' ? '54' : '18'], ['Clienți unici', period === '7 zile' ? '4' : period === '90 zile' ? '31' : '12'], ['Grad de ocupare', '68%'], ['Confirmate', '76%']].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs text-[#758985]">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>)}</div><div className="mt-4 rounded-2xl bg-white p-6 shadow-sm"><h4 className="text-sm font-bold">Evoluția programărilor</h4><div className="mt-6 flex h-52 items-end gap-3 border-b border-[#dceae6]">{[32, 48, 38, 72, 54, 86, 66, 94, 70, 82, 58, 98].map((height, index) => <div key={index} className="flex-1 rounded-t-md bg-[#22a7a4]" style={{ height: `${height}%` }} title={`${height} — valoare demonstrativă`} />)}</div><p className="mt-3 text-xs text-[#8a9996]">Datele sunt fictive și nu reprezintă performanța unei afaceri reale.</p></div></>}

            {view === 'Setări' && <><h3 className="mb-1 text-xl font-extrabold">Setări</h3><p className="mb-4 text-xs text-[#758985]">Exemplu de configurare pentru o afacere.</p><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm"><h4 className="font-bold">Servicii</h4>{services.map((service) => <div key={service.name} className="flex justify-between gap-3 border-b border-[#edf1ef] py-4 text-sm"><span>{service.name}</span><span className="text-[#758985]">{service.duration} · {service.price}</span></div>)}<button type="button" onClick={() => setNotice('Adăugarea serviciilor este disponibilă după crearea contului.')} className="mt-4 text-xs font-bold text-[#168d8d]">+ Adaugă serviciu</button></div><div className="space-y-4"><div className="rounded-2xl bg-white p-5 shadow-sm"><h4 className="font-bold">Program de lucru</h4><p className="mt-3 text-sm text-[#607474]">Luni – Vineri · 09:00 – 18:00</p><p className="mt-2 text-sm text-[#607474]">Pauză · 14:00 – 15:00</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><h4 className="font-bold">Vizibilitatea paginii publice</h4><button type="button" onClick={() => { setPublicVisible((value) => !value); setNotice('Vizibilitatea s-a schimbat numai în simulare.') }} aria-pressed={publicVisible} className={`mt-3 rounded-full px-4 py-2 text-xs font-bold ${publicVisible ? 'bg-[#dff3eb] text-[#1d8650]' : 'bg-[#eef1ef] text-[#758985]'}`}>{publicVisible ? 'Vizibilă în demo' : 'Ascunsă în demo'}</button></div><div className="rounded-2xl border border-dashed border-[#dceae6] bg-white p-5"><LockKeyhole size={18} className="text-[#8a9996]" /><p className="mt-2 text-sm font-bold">Integrări și notificări</p><p className="mt-1 text-xs text-[#758985]">Conectarea Meta, Google Calendar și trimiterea SMS sunt disponibile doar într-un cont real, după configurare.</p></div></div></div></>}

            {view === 'Planuri' && <><h3 className="mb-1 text-xl font-extrabold">Planuri și upgrade</h3><p className="mb-4 text-xs text-[#758985]">Vezi opțiunile; demo-ul nu activează abonamente.</p><div className="grid gap-3 lg:grid-cols-3">{[['FREE', '0 lei / lună', 'Pagină publică, rezervări și administrare de bază.'], ['STANDARD', '55 lei / lună', 'Echipă, mesaje, statistici și integrări configurabile.'], ['PRO', 'La cerere', 'Fluxuri și integrări adaptate afacerii.']].map(([name, price, detail]) => <div key={name} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-extrabold tracking-wider text-[#168d8d]">{name}</p><strong className="mt-4 block text-xl">{price}</strong><p className="mt-3 text-xs leading-6 text-[#758985]">{detail}</p></div>)}</div><a href="#planuri" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#168d8d]">Compară planurile complete <ArrowRight size={16} /></a></>}

            {view === 'Pagina publică' && <><div className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="bg-gradient-to-r from-[#d4efe7] via-[#eaf7f2] to-[#d8ecea] p-7 sm:p-10"><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[#168d8d]">Profil public · demonstrație</span><h3 className="mt-5 text-3xl font-extrabold">Studio Demo</h3><p className="mt-2 max-w-xl text-sm text-[#607474]">Servicii locale și rezervări online într-un singur loc. Profilul prezentat aici este fictiv.</p></div><div className="p-6"><h4 className="font-bold">Alege un serviciu</h4><div className="mt-4 grid gap-3 md:grid-cols-3">{services.map((service) => <div key={service.name} className="rounded-xl border border-[#dceae6] p-4"><strong className="block text-sm">{service.name}</strong><p className="mt-1 text-xs text-[#758985]">{service.duration} · {service.price}</p><button type="button" onClick={() => { addDemoBooking(); setView('Programări') }} className="mt-4 text-xs font-bold text-[#168d8d]">Rezervă în demo →</button></div>)}</div><Link href="/descopera" target="_blank" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#168d8d]">Explorează site-ul public BookEasy <ExternalLink size={14} /></Link></div></div></>}

            {view === 'Ghid' && <><h3 className="mb-1 text-xl font-extrabold">Ghid de utilizare</h3><p className="mb-4 text-xs text-[#758985]">Câțiva pași pentru a explora simularea.</p><div className="space-y-3">{[['1', 'Privește calendarul', 'Deschide o programare și schimbă-i statusul doar în demo.', 'Calendar'], ['2', 'Testează lista', 'Caută un nume fictiv și filtrează după status.', 'Programări'], ['3', 'Vizitează pagina publică', 'Vezi cum ar arăta serviciile pentru un vizitator.', 'Pagina publică'], ['4', 'Privește statisticile', 'Schimbă perioada și compară exemplele.', 'Statistici']].map(([step, title, detail, destination]) => <button key={step} type="button" onClick={() => setView(destination as View)} className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm hover:ring-2 hover:ring-[#8dd3c4]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e3f5f0] font-bold text-[#168d8d]">{step}</span><span><strong className="block text-sm">{title}</strong><small className="mt-1 block text-xs text-[#758985]">{detail}</small></span><ArrowRight size={16} className="ml-auto shrink-0 text-[#168d8d]" /></button>)}</div></>}
          </div>
        </div>
      </div>

      {selected && <div className="absolute inset-0 z-10 flex justify-end bg-[#193c3e]/35" onClick={() => setSelectedId(null)}><aside role="dialog" aria-modal="true" aria-label="Detalii programare demo" onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-sm flex-col bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#8a9996]">Detalii programare · demo</p><h3 className="mt-1 text-xl font-extrabold">{selected.service}</h3></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Închide detaliile" className="demo-icon-button"><X size={18} /></button></div><div className="mt-8 rounded-2xl bg-[#f4f8f6] p-5"><strong>{selected.customer}</strong><p className="mt-1 text-sm text-[#758985]">{selected.date} · {selected.time} · {selected.duration} min</p><p className="mt-2 text-xs text-[#758985]">Canal: {selected.source}</p></div><label className="mt-7 text-xs font-bold text-[#607474]" htmlFor="demo-booking-status">Status</label><select id="demo-booking-status" value={selected.status} onChange={(event) => { const status = event.target.value as BookingStatus; setBookings((current) => current.map((booking) => booking.id === selected.id ? { ...booking, status } : booking)); setNotice('Statusul s-a schimbat doar în simulare.') }} className="demo-input mt-2"><option>În așteptare</option><option>Confirmată</option><option>Anulată</option></select><div className="mt-6 rounded-xl border border-dashed border-[#dceae6] p-4 text-xs leading-5 text-[#758985]"><LockKeyhole size={16} className="mb-2" />Reconfirmarea prin SMS, notificările reale și alte acțiuni externe sunt dezactivate în acest demo.</div><button type="button" onClick={() => setSelectedId(null)} className="demo-primary-button mt-auto justify-center">Închide</button></aside></div>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  BarChart3, CalendarDays, ClipboardList, Eye, Menu, MessageSquare,
  Settings, Star, Stethoscope, Tag, Users, X,
} from 'lucide-react'

type Section = 'calendar' | 'messages' | 'bookings' | 'customers' | 'services' | 'reviews' | 'stats' | 'settings'

const ICONS = {
  calendar: CalendarDays, messages: MessageSquare, bookings: ClipboardList,
  customers: Users, services: Tag, reviews: Star, stats: BarChart3, settings: Settings,
}

const SAMPLE_BOOKINGS = [
  { time: '09:00', name: 'Maria Popescu', service: 'Consultație inițială', status: 'Confirmată', tone: 'green' },
  { time: '10:30', name: 'Andrei Ionescu', service: 'Control', status: 'În așteptare', tone: 'amber' },
  { time: '12:00', name: 'Elena Dumitru', service: 'Consultație', status: 'Confirmată', tone: 'green' },
  { time: '15:30', name: 'Radu Matei', service: 'Control periodic', status: 'Confirmată', tone: 'green' },
]

function DemoButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} title="Simulare — nu salvează date" className="rounded-xl bg-[#14142b] px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:shadow-lg">{children}</button>
}

function Status({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone === 'green' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{label}</span>
}

export default function DemoDashboard({ businessName, category, accentColor, teamSize }: {
  businessName: string
  category: string
  accentColor: string
  teamSize: number
}) {
  const [section, setSection] = useState<Section>('calendar')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const isClinic = category === 'CLINICA'
  const isVenue = category === 'EVENT_VENUE'
  const customerLabel = isClinic ? 'Pacienți' : 'Clienți'
  const bookingLabel = isVenue ? 'Rezervări' : 'Programări'
  const serviceLabel = isVenue ? 'Săli' : 'Servicii'
  const nav: { id: Section; label: string; badge?: number }[] = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'messages', label: 'Mesaje', badge: 2 },
    { id: 'bookings', label: bookingLabel, badge: 3 },
    { id: 'customers', label: customerLabel },
    { id: 'services', label: serviceLabel },
    { id: 'reviews', label: 'Recenzii' },
    { id: 'stats', label: 'Statistici' },
    { id: 'settings', label: 'Setări' },
  ]

  function choose(next: Section) {
    setSection(next)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-[#17172d]" style={{ '--demo-accent': accentColor } as React.CSSProperties}>
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-12 py-2 text-center text-xs text-amber-950 sm:text-sm">
        <Eye size={16} className="shrink-0" />
        <strong>Mod demonstrație</strong><span className="hidden sm:inline">— datele sunt fictive, iar modificările sunt dezactivate.</span>
        <a href="https://www.bookeasy.ro" className="ml-2 underline">Află mai multe</a>
      </div>

      <header className="flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2"><Image src="/logo-mark-square.png" alt="BookEasy" width={28} height={28} /><strong>{businessName}</strong></div>
        <button onClick={() => setMobileOpen(true)} aria-label="Deschide meniul"><Menu /></button>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-[60] bg-black/25 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed bottom-0 left-0 top-0 z-[70] w-[220px] border-r bg-white p-4 transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button className="absolute right-3 top-3 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Închide meniul"><X size={20} /></button>
        <div className="mb-7 flex items-center gap-2 pt-2">
          <Image src="/logo-mark-square.png" alt="BookEasy" width={34} height={34} />
          <span className="text-lg font-semibold">bookeasy.ro</span>
        </div>
        <p className="mb-1 truncate font-semibold">{businessName}</p>
        <p className="mb-6 text-xs text-gray-500">Cont demonstrativ</p>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = ICONS[item.id]
            const active = item.id === section
            return <button key={item.id} onClick={() => choose(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-[#14142b] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon size={17} /><span>{item.label}</span>{item.badge && <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] text-white">{item.badge}</span>}
            </button>
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
          <div className="mb-1 flex items-center gap-2 font-medium text-gray-700"><Eye size={14} /> Doar vizualizare</div>
          Nu poți salva sau modifica date.
        </div>
      </aside>

      <main className="min-h-screen p-4 sm:p-7 lg:ml-[220px] lg:p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div><h1 className="text-2xl font-semibold">{nav.find((item) => item.id === section)?.label}</h1><p className="mt-1 text-sm text-gray-500">Previzualizare pentru {businessName}</p></div>
          <button onClick={() => setMobileOpen(true)} className="rounded-xl border bg-white p-2 lg:hidden" aria-label="Meniu"><Menu size={20} /></button>
        </div>

        {section === 'calendar' && <CalendarPreview accent={accentColor} onPreview={setPreview} />}
        {section === 'messages' && <MessagesPreview onPreview={setPreview} />}
        {section === 'bookings' && <BookingsPreview label={bookingLabel} onPreview={setPreview} />}
        {section === 'customers' && <CustomersPreview label={customerLabel} isClinic={isClinic} onPreview={setPreview} />}
        {section === 'services' && <ServicesPreview label={serviceLabel} isVenue={isVenue} onPreview={setPreview} />}
        {section === 'reviews' && <ReviewsPreview />}
        {section === 'stats' && <StatsPreview />}
        {section === 'settings' && <SettingsPreview name={businessName} teamSize={teamSize} onPreview={setPreview} />}
      </main>
      {preview && <FeaturePreview title={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(25,25,45,.06)] ${className}`}>{children}</section>
}

function CalendarPreview({ accent, onPreview }: { accent: string; onPreview: (title: string) => void }) {
  const days = ['Luni 14', 'Marți 15', 'Miercuri 16', 'Joi 17', 'Vineri 18']
  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button onClick={() => onPreview('Navigare calendar')} className="rounded-xl border bg-white px-3 py-2 text-sm">Astăzi</button><button onClick={() => onPreview('Săptămâna precedentă')} className="rounded-xl border bg-white px-3 py-2 text-sm">‹</button><button onClick={() => onPreview('Săptămâna următoare')} className="rounded-xl border bg-white px-3 py-2 text-sm">›</button></div><DemoButton onClick={() => onPreview('Programare nouă')}>+ Adaugă programare</DemoButton></div>
    <Panel className="overflow-x-auto p-0">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[62px_repeat(5,1fr)] border-b bg-gray-50"><div />{days.map(d => <div key={d} className="border-l p-3 text-center text-sm font-medium">{d}</div>)}</div>
        <div className="relative grid h-[500px] grid-cols-[62px_repeat(5,1fr)]">
          {['08:00','10:00','12:00','14:00','16:00','18:00'].map((time, i) => <div key={time} className="contents"><div className="border-b pr-2 pt-2 text-right text-xs text-gray-400">{time}</div>{days.map(day => <div key={day} className="border-b border-l" />)}</div>)}
          <button onClick={() => onPreview('Detalii programare · Maria Popescu')} className="absolute left-[calc(62px+2%)] top-12 w-[16%] rounded-lg border-l-4 bg-green-50 p-2 text-left text-xs hover:shadow-md" style={{ borderColor: accent }}><strong>Maria Popescu</strong><br />Consultație inițială<br /><span className="text-gray-500">09:00 – 10:00</span></button>
          <button onClick={() => onPreview('Detalii programare · Andrei Ionescu')} className="absolute left-[calc(62px+21%)] top-36 w-[16%] rounded-lg border-l-4 border-amber-400 bg-amber-50 p-2 text-left text-xs hover:shadow-md"><strong>Andrei Ionescu</strong><br />Control<br /><span className="text-gray-500">11:00 – 11:30</span></button>
          <button onClick={() => onPreview('Detalii programare · Elena Dumitru')} className="absolute left-[calc(62px+61%)] top-60 w-[16%] rounded-lg border-l-4 bg-blue-50 p-2 text-left text-xs hover:shadow-md" style={{ borderColor: accent }}><strong>Elena Dumitru</strong><br />Consultație<br /><span className="text-gray-500">13:30 – 14:30</span></button>
        </div>
      </div>
    </Panel>
  </>
}

function MessagesPreview({ onPreview }: { onPreview: (title: string) => void }) {
  return <Panel className="grid min-h-[590px] overflow-hidden p-0 md:grid-cols-[280px_1fr]">
    <div className="border-r"><div className="border-b p-4"><input disabled value="" placeholder="Caută conversații..." className="w-full rounded-xl border px-3 py-2 text-sm" /></div>{['Maria Popescu','Andrei Ionescu','Elena Dumitru'].map((n,i)=><div key={n} className={`border-b p-4 ${i===0?'bg-amber-50':''}`}><strong className="text-sm">{n}</strong><p className="mt-1 truncate text-xs text-gray-500">{i===0?'Mulțumesc, confirm programarea.':'Bună ziua, aș dori o programare.'}</p></div>)}</div>
    <div className="flex flex-col"><div className="border-b p-4"><strong>Maria Popescu</strong><p className="text-xs text-gray-500">Messenger</p></div><div className="flex-1 space-y-4 bg-gray-50 p-5"><div className="max-w-sm rounded-2xl bg-white p-3 text-sm shadow-sm">Bună ziua! Mai este disponibilă programarea de marți?</div><div className="ml-auto max-w-sm rounded-2xl bg-[#14142b] p-3 text-sm text-white">Bună ziua! Da, vă așteptăm marți la ora 09:00.</div><div className="max-w-sm rounded-2xl bg-white p-3 text-sm shadow-sm">Mulțumesc, confirm programarea.</div></div><div className="flex gap-2 border-t p-4"><input readOnly placeholder="Scrie un răspuns demonstrativ..." className="flex-1 rounded-xl border px-3" /><DemoButton onClick={() => onPreview('Trimitere mesaj')}>Trimite</DemoButton></div></div>
  </Panel>
}

function BookingsPreview({ label, onPreview }: { label: string; onPreview: (title: string) => void }) {
  return <><div className="mb-4 flex justify-end"><DemoButton onClick={() => onPreview('Programare nouă')}>+ Adaugă {label.toLowerCase().replace(/ări$/, 'are')}</DemoButton></div><Panel className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-gray-500"><tr><th className="pb-3">Ora</th><th>Client</th><th>Serviciu</th><th>Canal</th><th>Status</th></tr></thead><tbody>{SAMPLE_BOOKINGS.map((b,i)=><tr key={b.time} className="border-t"><td className="py-4">{b.time}</td><td className="font-medium">{b.name}</td><td>{b.service}</td><td>{i%2?'WhatsApp':'Site'}</td><td><Status label={b.status} tone={b.tone} /></td></tr>)}</tbody></table></Panel></>
}

function CustomersPreview({ label, isClinic, onPreview }: { label: string; isClinic: boolean; onPreview: (title: string) => void }) {
  return <><div className="mb-4 flex justify-end"><DemoButton onClick={() => onPreview(isClinic ? 'Pacient nou' : 'Client nou')}>+ Adaugă {isClinic ? 'pacient' : 'client'}</DemoButton></div><Panel><div className="mb-4 grid gap-3 sm:grid-cols-3"><input readOnly placeholder={`Caută în ${label.toLowerCase()}...`} className="rounded-xl border px-3 py-2 sm:col-span-2" /><div className="rounded-xl bg-green-50 p-2 text-center text-sm text-green-700">128 {label.toLowerCase()} activi</div></div>{['Maria Popescu','Andrei Ionescu','Elena Dumitru','Radu Matei'].map((n,i)=><button onClick={() => onPreview(`${isClinic ? 'Fișă pacient' : 'Fișă client'} · ${n}`)} key={n} className="grid w-full grid-cols-[1fr_auto] gap-3 border-t py-4 text-left hover:bg-gray-50 sm:grid-cols-3"><div><strong className="text-sm">{n}</strong><p className="text-xs text-gray-500">07•• ••• {42+i}</p></div><span className="hidden text-sm text-gray-500 sm:block">{2+i} programări</span><span className="text-xs text-gray-400">Activ</span></button>)}</Panel></>
}

function ServicesPreview({ label, isVenue, onPreview }: { label: string; isVenue: boolean; onPreview: (title: string) => void }) {
  const items = isVenue ? [['Sala Magnolia','250 persoane','3.500 lei'],['Salon Garden','100 persoane','2.100 lei'],['Sala Crystal','180 persoane','2.900 lei']] : [['Consultație inițială','60 min','250 lei'],['Control','30 min','150 lei'],['Consultație online','45 min','180 lei']]
  return <><div className="mb-4 flex justify-end"><DemoButton onClick={() => onPreview(isVenue ? 'Sală nouă' : 'Serviciu nou')}>+ Adaugă {isVenue ? 'sală' : 'serviciu'}</DemoButton></div><div className="grid gap-4 md:grid-cols-3">{items.map(([name,duration,price])=><button key={name} onClick={() => onPreview(`Detalii · ${name}`)} className="text-left"><Panel className="h-full transition hover:-translate-y-1 hover:shadow-lg"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50" style={{color:'var(--demo-accent)'}}><Tag size={19}/></div><h2 className="font-semibold">{name}</h2><p className="mt-2 text-sm text-gray-500">{duration}</p><p className="mt-4 text-lg font-semibold">{price}</p><span className="mt-4 inline-block rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">Activ</span></Panel></button>)}</div></>
}

function ReviewsPreview() {
  return <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><Panel><p className="text-sm text-gray-500">Evaluare medie</p><p className="my-2 text-4xl font-semibold">4,9</p><div className="text-amber-400">★★★★★</div><p className="mt-2 text-xs text-gray-500">din 86 de recenzii</p></Panel><Panel>{[['Maria P.','Servicii excelente și personal foarte atent.'],['Andrei I.','Programarea online a fost simplă și rapidă.'],['Elena D.','Recomand cu încredere!']].map(([n,t])=><div key={n} className="border-b py-4 last:border-0"><div className="flex justify-between"><strong className="text-sm">{n}</strong><span className="text-amber-400">★★★★★</span></div><p className="mt-2 text-sm text-gray-600">{t}</p></div>)}</Panel></div>
}

function StatsPreview() {
  const bars=[42,68,55,81,72,94,76]
  return <><div className="mb-4 grid gap-4 sm:grid-cols-3"><Panel><p className="text-sm text-gray-500">Programări luna aceasta</p><p className="mt-2 text-3xl font-semibold">146</p><p className="mt-1 text-xs text-green-600">↑ 18% față de luna trecută</p></Panel><Panel><p className="text-sm text-gray-500">Clienți noi</p><p className="mt-2 text-3xl font-semibold">32</p><p className="mt-1 text-xs text-green-600">↑ 9% luna aceasta</p></Panel><Panel><p className="text-sm text-gray-500">Rată de confirmare</p><p className="mt-2 text-3xl font-semibold">91%</p><p className="mt-1 text-xs text-gray-500">prin mesaje automate</p></Panel></div><Panel><h2 className="mb-6 font-semibold">Programări în ultimele 7 zile</h2><div className="flex h-64 items-end gap-3">{bars.map((h,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-lg" style={{height:`${h}%`,background:'var(--demo-accent)',opacity:.8}}/><span className="text-xs text-gray-400">{['L','M','M','J','V','S','D'][i]}</span></div>)}</div></Panel></>
}

function SettingsPreview({ name, teamSize, onPreview }: { name: string; teamSize: number; onPreview: (title: string) => void }) {
  return <div className="max-w-3xl space-y-4"><Panel><h2 className="mb-4 font-semibold">Profil business</h2><label className="text-sm text-gray-500">Nume</label><input readOnly value={name} className="mt-1 w-full rounded-xl border bg-gray-50 px-3 py-2.5" /><label className="mt-4 block text-sm text-gray-500">Mod de lucru</label><input readOnly value={teamSize > 1 ? 'Echipă' : 'Individual'} className="mt-1 w-full rounded-xl border bg-gray-50 px-3 py-2.5" /></Panel><Panel><h2 className="mb-2 font-semibold">Integrări</h2><div className="flex items-center justify-between border-b py-3"><span>Google Calendar</span><Status label="Conectat" tone="green" /></div><div className="flex items-center justify-between py-3"><span>Mesaje automate</span><Status label="Activ" tone="green" /></div></Panel><DemoButton onClick={() => onPreview('Salvare setări')}>Salvează modificările</DemoButton></div>
}

function FeaturePreview({ title, onClose }: { title: string; onClose: () => void }) {
  const isBooking = title.includes('Programare') || title.includes('programare')
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" onMouseDown={onClose}>
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Închide"><X size={20} /></button></div>
      {isBooking ? <div className="space-y-3"><input readOnly value="Maria Popescu" className="w-full rounded-xl border bg-gray-50 px-3 py-2.5" /><input readOnly value="Consultație inițială" className="w-full rounded-xl border bg-gray-50 px-3 py-2.5" /><div className="grid grid-cols-2 gap-3"><input readOnly value="16.09.2026" className="rounded-xl border bg-gray-50 px-3 py-2.5" /><input readOnly value="09:00" className="rounded-xl border bg-gray-50 px-3 py-2.5" /></div></div> : <p className="text-sm leading-6 text-gray-600">În contul real, această funcție este activă. Aici vezi fluxul fără ca vreo informație să fie trimisă sau salvată.</p>}
      <div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><strong>Simulare:</strong> nicio acțiune din această fereastră nu modifică date.</div>
      <button onClick={onClose} className="mt-4 w-full rounded-xl bg-[#14142b] px-4 py-2.5 text-sm font-medium text-white">Am înțeles</button>
    </div>
  </div>
}

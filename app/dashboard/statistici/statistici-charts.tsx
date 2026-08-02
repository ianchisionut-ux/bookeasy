'use client'

import { Card } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type Daily = { date: string; bookings: number; revenue: number }
type Summary = {
  totalBookings: number
  revenue: number
  avgBookingValue: number
  cancelledCount: number
  cancellationRate: number
  noShowCount: number
  byChannel: { channel: string; count: number; revenue: number }[]
  byHour: { hour: number; count: number }[]
  peakHour: { hour: number; count: number }
  byDayOfWeek: { dow: number; label: string; count: number }[]
  peakDayOfWeek: { dow: number; label: string; count: number }
  topServices: { name: string; count: number; revenue: number }[]
  topStaff: { name: string; count: number }[]
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  GOOGLE_BUSINESS: 'Google',
}

export default function StatisticiCharts({ daily, summary }: { daily: Daily[]; summary: Summary }) {
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-xl lg:text-2xl font-semibold mb-1">Statistici</h1>
      <p className="text-sm text-gray-500 mb-6">Ultimele 30 de zile</p>

      {/* ── carduri sumar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Rezervări</p>
          <p className="text-xl lg:text-2xl font-semibold">{summary.totalBookings}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Venit estimat</p>
          <p className="text-xl lg:text-2xl font-semibold">{summary.revenue.toLocaleString('ro-RO')} lei</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Valoare medie</p>
          <p className="text-xl lg:text-2xl font-semibold">{summary.avgBookingValue.toFixed(0)} lei</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Rată anulare</p>
          <p className="text-xl lg:text-2xl font-semibold">{(summary.cancellationRate * 100).toFixed(0)}%</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Neprezentări</p>
          <p className="text-xl lg:text-2xl font-semibold">{summary.noShowCount}</p>
        </Card>
      </div>

      {/* ── trend zilnic ── */}
      <Card className="mb-6">
        <h2 className="font-medium mb-3">Rezervări pe zi</h2>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="bookings" stroke="var(--accent)" strokeWidth={2} dot={false} name="Rezervări" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* ── pe oră, cu ora de vârf evidențiată ── */}
        <Card>
          <h2 className="font-medium mb-1">Distribuție pe oră</h2>
          <p className="text-xs text-gray-500 mb-3">
            Ora de vârf: <strong>{summary.peakHour.hour}:00</strong> ({summary.peakHour.count} rezervări)
          </p>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={summary.byHour}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#5DCAA5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── pe zi a săptămânii ── */}
        <Card>
          <h2 className="font-medium mb-1">Distribuție pe zi a săptămânii</h2>
          <p className="text-xs text-gray-500 mb-3">
            Cea mai aglomerată: <strong>{summary.peakDayOfWeek.label}</strong> ({summary.peakDayOfWeek.count} rezervări)
          </p>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={summary.byDayOfWeek}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(l) => l.slice(0, 3)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6d5ffd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── pe canal ── */}
        <Card>
          <h2 className="font-medium mb-3">Pe canal</h2>
          <ul className="text-sm flex flex-col gap-2">
            {summary.byChannel.map((c) => (
              <li key={c.channel} className="flex justify-between">
                <span className="text-gray-500">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                <span className="font-medium">
                  {c.count} · {c.revenue.toLocaleString('ro-RO')} lei
                </span>
              </li>
            ))}
            {summary.byChannel.length === 0 && <p className="text-gray-400">Fără date încă.</p>}
          </ul>
        </Card>

        {/* ── top servicii ── */}
        <Card>
          <h2 className="font-medium mb-3">Top servicii</h2>
          <ul className="text-sm flex flex-col gap-2">
            {summary.topServices.map((s) => (
              <li key={s.name} className="flex justify-between">
                <span className="text-gray-500 truncate pr-2">{s.name}</span>
                <span className="font-medium whitespace-nowrap">{s.count}×</span>
              </li>
            ))}
            {summary.topServices.length === 0 && <p className="text-gray-400">Fără date încă.</p>}
          </ul>
        </Card>

        {/* ── top angajați (gol la spații evenimente) ── */}
        {summary.topStaff.length > 0 && (
          <Card>
            <h2 className="font-medium mb-3">Top angajați</h2>
            <ul className="text-sm flex flex-col gap-2">
              {summary.topStaff.map((s) => (
                <li key={s.name} className="flex justify-between">
                  <span className="text-gray-500">{s.name}</span>
                  <span className="font-medium">{s.count} rezervări</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

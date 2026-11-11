export default function Loading() {
  return <div className="dashboard-page" role="status"><div className="h-9 w-64 rounded-xl bg-gray-200 animate-pulse mb-6" /><div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}</div><p className="text-sm text-gray-500 mt-6">Se încarcă spațiul de coaching…</p></div>
}

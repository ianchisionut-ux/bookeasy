'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      aria-label="Printează"
      title="Printează"
      className="btn-secondary text-sm w-9 h-9 flex items-center justify-center p-0"
    >
      🖨
    </button>
  )
}

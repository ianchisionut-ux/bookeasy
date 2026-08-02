import { SignOutButton } from './sign-out-button'

export function SidebarUserBlock({ label, status = 'Activ' }: { label: string; status?: string }) {
  return (
    <div className="mt-auto pt-2">
      <div className="h-px bg-[var(--border-soft)] mb-3" />
      <div className="flex items-center gap-2.5 px-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-sm">
          👤
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {status}
          </p>
        </div>
      </div>
      <SignOutButton className="w-full" />
    </div>
  )
}

import { DashboardPlanGate } from '@/components/dashboard-plan-gate'
import { walletAvailable } from '@/lib/google-wallet'
import { redirect } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!walletAvailable()) redirect('/dashboard/calendar')
  return <DashboardPlanGate required="PRO" title="Check-in cu Google Wallet" description="Verifică rezervările salvate de clienți în Google Wallet, pentru categoriile eligibile.">{children}</DashboardPlanGate>
}

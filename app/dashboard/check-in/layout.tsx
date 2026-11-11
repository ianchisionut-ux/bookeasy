import { DashboardPlanGate } from '@/components/dashboard-plan-gate'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardPlanGate required="PRO" title="Check-in cu Google Wallet" description="Verifică rezervările salvate de clienți în Google Wallet, pentru categoriile eligibile.">{children}</DashboardPlanGate>
}

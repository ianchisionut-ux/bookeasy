import { DashboardPlanGate } from '@/components/dashboard-plan-gate'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardPlanGate required="STANDARD" title="Recenzii" description="Urmărești și administrezi feedbackul clienților într-un singur loc.">{children}</DashboardPlanGate>
}

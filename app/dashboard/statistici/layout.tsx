import { DashboardPlanGate } from '@/components/dashboard-plan-gate'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardPlanGate required="STANDARD" title="Statistici" description="Vezi evoluția programărilor și activitatea afacerii.">{children}</DashboardPlanGate>
}

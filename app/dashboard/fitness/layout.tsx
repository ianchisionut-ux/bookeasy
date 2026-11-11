import { DashboardPlanGate } from '@/components/dashboard-plan-gate'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardPlanGate required="STANDARD" title="Fitness & coaching" description="Planuri, sarcini și urmărirea progresului clienților pentru afacerile Fitness.">{children}</DashboardPlanGate>
}

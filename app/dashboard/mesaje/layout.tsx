import { DashboardPlanGate } from '@/components/dashboard-plan-gate'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardPlanGate required="STANDARD" title="Mesaje și conversații" description="Primești conversațiile din canalele conectate și poți răspunde clienților din dashboard.">{children}</DashboardPlanGate>
}

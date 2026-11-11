import { DashboardPlanGate } from '@/components/dashboard-plan-gate'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardPlanGate required="STANDARD" title="Echipa" description="Configurezi programul fiecărui membru și distribui rezervările în echipă.">{children}</DashboardPlanGate>
}

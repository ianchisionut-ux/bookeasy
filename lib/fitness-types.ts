export type FitnessMemberData = {
  id: string; customerId: string; name: string; email: string; phone: string
  goal: string; coachNotes?: string; active: boolean
  instructorName: string; connected: boolean
}
export type FitnessPlanData = { id: string; memberId: string; kind: 'WORKOUT' | 'NUTRITION'; title: string; details: string }
export type FitnessTaskData = {
  id: string; memberId: string; planId: string | null; kind: 'WORKOUT' | 'NUTRITION' | 'HABIT'
  title: string; details: string; day: string; time: string; durationMin: number
  completed: boolean; hasVideo: boolean; feedback: string; version: number
}
export type FitnessProgressData = { id: string; memberId: string; day: string; weightKg: number | null; note: string }
export type FitnessData = {
  members: FitnessMemberData[]; plans: FitnessPlanData[]; tasks: FitnessTaskData[]; progress: FitnessProgressData[]
  customers?: { id: string; name: string | null; phone: string }[]
  bookings?: { id: string; title: string; startAt: string; endAt: string; customerId: string }[]
  timezone: string; businessName?: string
}

import { z } from 'zod'

export const fitnessKind = z.enum(['WORKOUT', 'NUTRITION', 'HABIT'])
export const fitnessDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data nu este validă.')
export const memberSchema = z.object({
  customerId: z.string().min(1),
  goal: z.string().trim().max(1000).default(''),
  coachNotes: z.string().trim().max(5000).default(''),
  active: z.boolean().default(true),
}).strict()
export const planSchema = z.object({
  memberId: z.string().min(1),
  kind: z.enum(['WORKOUT', 'NUTRITION']),
  title: z.string().trim().min(2).max(150),
  details: z.string().trim().min(1).max(15000),
})
export const taskSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().nullish(),
  kind: fitnessKind,
  title: z.string().trim().min(2).max(150),
  details: z.string().trim().max(5000).default(''),
  day: fitnessDay,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.number().int().min(5).max(240).default(45),
  video: z.boolean().default(false),
})
export const progressSchema = z.object({
  memberId: z.string().min(1),
  day: fitnessDay,
  weightKg: z.number().min(20).max(500).nullable(),
  note: z.string().trim().max(2000).default(''),
})

export function fitnessDate(now = new Date(), timezone = 'Europe/Bucharest') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function moveFitnessDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

import { z } from 'zod'

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}, 'Data nu este validă.')
export const entryPlan = z.object({
  kind: z.enum(['NUTRITION', 'WORKOUT']), date: calendarDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: z.string().trim().min(1).max(150), details: z.string().trim().max(8000),
}).strict()
export const clientProgress = z.object({
  completed: z.boolean(), feedback: z.string().trim().max(2000), version: z.number().int().positive(),
}).strict()
export const entryEdit = entryPlan.extend({ version: z.number().int().positive() }).strict()
export const messageInput = z.object({ text: z.string().trim().min(1).max(4000) }).strict()

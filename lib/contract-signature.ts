import { z } from 'zod'

export const signatureRequest = z.object({
  type: z.enum(['SERVICES', 'DPA']).optional(),
  documentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  signerName: z.string().trim().min(3).max(120),
  signature: z.string().max(180_000),
  confirmed: z.literal(true),
})

export function validSignaturePng(value: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) return false
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length < 100 || bytes.length > 130_000) return false
  return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.readUInt32BE(16) === 600 && bytes.readUInt32BE(20) === 220
}

export function signingMetadata(request: Request) {
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) || null,
    userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
  }
}

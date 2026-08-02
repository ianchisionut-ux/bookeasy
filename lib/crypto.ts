import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes, hex-encoded in .env

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, 'base64')
  const iv = buffer.subarray(0, 12)
  const authTag = buffer.subarray(12, 28)
  const encrypted = buffer.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

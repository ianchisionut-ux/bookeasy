// UUID v4 keeps all 122 random bits when represented as 22 base64url characters.
export function compactConfirmationToken(token: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) throw new Error('Linkul de confirmare nu a putut fi pregătit.')
  return Buffer.from(token.replace(/-/g, ''), 'hex').toString('base64url')
}

export function expandConfirmationToken(value: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(value)) return null
  const bytes = Buffer.from(value, 'base64url')
  if (bytes.length !== 16 || bytes.toString('base64url') !== value) return null
  const hex = bytes.toString('hex')
  const token = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token) ? token : null
}

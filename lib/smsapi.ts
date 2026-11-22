const smsEndpoint = 'https://api.smsapi.ro/sms.do'

export function usesSmsApi() {
  return process.env.BOOKEASY_SMS_PROVIDER === 'smsapi'
}

export function smsApiDailyLimit() {
  const raw = process.env.SMSAPI_DAILY_LIMIT?.trim() ?? ''
  const value = Number(raw)
  return /^\d+$/.test(raw) && Number.isSafeInteger(value) ? value : 30
}

export function smsApiConfig() {
  const token = process.env.SMSAPI_TOKEN?.trim()
  const sender = process.env.SMSAPI_SENDER?.trim()
  return token && sender ? { token, sender } : null
}

type Result = { status: 'SENT' | 'FAILED' | 'UNKNOWN'; error: string | null }

export async function submitSmsApi(
  config: NonNullable<ReturnType<typeof smsApiConfig>>,
  message: { id: string; recipient: string; message: string },
): Promise<Result> {
  const unconfirmed: Result = {
    status: 'UNKNOWN',
    error: 'SMSAPI nu a confirmat preluarea. Verifică istoricul furnizorului înainte de a trimite din nou.',
  }
  try {
    const response = await fetch(smsEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' },
      body: new URLSearchParams({
        to: message.recipient.slice(1),
        from: config.sender,
        message: message.message.replace(/[\r\n]+/g, ' '),
        format: 'json',
        idx: message.id,
        check_idx: '1',
        max_parts: '1',
      }),
      signal: AbortSignal.timeout(8_000),
      redirect: 'error',
      cache: 'no-store',
    })
    if (response.status >= 500 || response.status === 408) return unconfirmed
    const data = await response.json().catch(() => null)
    const item = data?.list?.[0]
    const code = data?.error ?? item?.error
    if (String(code) === '53') return unconfirmed
    if (!response.ok || code || ['ERROR', 'FAILED', 'EXPIRED', 'REJECTED', 'UNDELIVERED', 'STOP'].includes(item?.status)) {
      const diagnostic = /^\d{1,4}$/.test(String(code)) ? `cod ${code}` : `HTTP ${response.status}`
      return { status: 'FAILED', error: `SMSAPI a respins mesajul (${diagnostic}).` }
    }
    if (data?.count !== 1 || typeof item?.id !== 'string' || !item.id
      || !['QUEUE', 'ACCEPTED', 'SENT', 'DELIVERED'].includes(item.status)) return unconfirmed
    return { status: 'SENT', error: null }
  } catch {
    return unconfirmed
  }
}

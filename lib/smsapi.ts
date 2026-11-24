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

export function smsApiAvailability() {
  if (!usesSmsApi()) return { online: false, lastError: 'Trimiterea prin SMSAPI este dezactivată.' }
  if (!smsApiConfig()) return { online: false, lastError: 'SMSAPI nu este configurat complet.' }
  return { online: true, lastError: null }
}

type Result = { status: 'SENT' | 'FAILED' | 'UNKNOWN'; error: string | null }
type SmsApiConfig = NonNullable<ReturnType<typeof smsApiConfig>>

function requestSmsApi(config: SmsApiConfig, parameters: Record<string, string>) {
  return fetch(smsEndpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' },
    body: new URLSearchParams({ ...parameters, from: config.sender, format: 'json', max_parts: '1' }),
    signal: AbortSignal.timeout(8_000),
    redirect: 'error',
    cache: 'no-store',
  })
}

export async function submitSmsApi(
  config: SmsApiConfig,
  message: { id: string; recipient: string; message: string },
): Promise<Result> {
  const unconfirmed: Result = {
    status: 'UNKNOWN',
    error: 'SMSAPI nu a confirmat preluarea. Verifică istoricul furnizorului înainte de a trimite din nou.',
  }
  try {
    const response = await requestSmsApi(config, {
      to: message.recipient.slice(1),
      message: message.message.replace(/[\r\n]+/g, ' '),
      idx: message.id,
      check_idx: '1',
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

const testRejectionDetails: Record<string, string> = {
  '13': 'Furnizorul nu a acceptat numărul fictiv folosit în test.',
  '14': 'Verifică dacă expeditorul este aprobat în portalul SMSAPI și dacă numele coincide cu SMSAPI_SENDER.',
  '94': 'SMSAPI nu permite trimiterea mesajelor cu link din această configurație. Cere furnizorului să activeze trimiterea mesajelor cu link.',
  '98': 'Contul poate trimite doar către numărul folosit la înregistrare.',
  '101': 'Verifică tokenul configurat în SMSAPI_TOKEN.',
  '102': 'Verifică tokenul configurat în SMSAPI_TOKEN.',
  '103': 'Contul nu are suficiente credite.',
  '105': 'Verifică restricția de IP a tokenului SMSAPI.',
  '112': 'Contul nu acceptă țara numărului fictiv folosit în test.',
  '401': 'Verifică permisiunea SMS a tokenului.',
}

async function checkSmsApiMessage(config: SmsApiConfig, type: 'reminder' | 'reconfirmare', message: string) {
  const unavailable = {
    status: 'unavailable',
    message: `SMSAPI nu a confirmat testul pentru ${type}. Încearcă din nou.`,
  } as const

  try {
    const response = await requestSmsApi(config, {
      // SMSAPI uses this fictitious number in its dry-run examples.
      to: '48500000000',
      message,
      test: '1',
    })
    if (response.status >= 500 || response.status === 408 || response.status === 429) return unavailable

    const data = await response.json().catch(() => null)
    const item = Array.isArray(data?.list) ? data.list[0] : null
    const code = data?.error ?? item?.error
    if (!response.ok || code || ['ERROR', 'FAILED', 'EXPIRED', 'REJECTED', 'UNDELIVERED', 'STOP'].includes(item?.status)) {
      const providerCode = /^\d{1,4}$/.test(String(code)) ? String(code) : null
      const diagnostic = providerCode ? `cod ${providerCode}` : `HTTP ${response.status}`
      const detail = providerCode && testRejectionDetails[providerCode]
      return {
        status: 'rejected',
        message: `SMSAPI a respins testul pentru ${type} (${diagnostic}).${detail ? ` ${detail}` : ''}`,
      } as const
    }

    if (data?.count !== 1 || data.list?.length !== 1 || !item || typeof item !== 'object'
      || ['UNKNOWN', 'NOT_FOUND'].includes(item.status)) return unavailable
    return { status: 'accepted' } as const
  } catch {
    return unavailable
  }
}

export async function testSmsApiConnection() {
  const config = smsApiConfig()
  if (!config) return {
    status: 'unconfigured',
    message: 'Configurează SMSAPI_TOKEN și SMSAPI_SENDER în variabilele de mediu ale aplicației.',
  } as const

  const reminder = await checkSmsApiMessage(config, 'reminder', 'Salon Demo: programare 25.11, 14:30.')
  if (reminder.status !== 'accepted') return reminder
  const reconfirmation = await checkSmsApiMessage(
    config,
    'reconfirmare',
    'Salon Demo Programare 25.11.2026, 14:30 Pentru confirmare, accesati linkul de mai jos: https://bookeasy.ro/confirmare/TEST-verificare-smsapi',
  )
  if (reconfirmation.status !== 'accepted') return reconfirmation
  return {
    status: 'accepted',
    message: 'SMSAPI a acceptat reminderul și reconfirmarea cu link în modul de test. Nu a fost trimis niciun SMS. Trimiterea către clienți necesită un cont aprobat de SMSAPI.',
  } as const
}

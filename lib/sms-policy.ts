// SMS only. Templates are GSM-7 and fit one segment; links are never truncated.
export function smsPlainText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/€/g, ' EUR ').replace(/[^\x20-\x7e\n\r]/g, '').trim()
}

export function smsUnits(value: string): number {
  return [...value].reduce((total, char) => total + ('^{}\\[~]|'.includes(char) ? 2 : 1), 0)
}

export function singleSms(value: string): string {
  const text = smsPlainText(value)
  if (!text || smsUnits(text) > 160) throw new Error('Mesajul depășește un SMS text. Scurtează-l înainte de trimitere; nu folosim MMS sau segmente suplimentare.')
  return text
}

function fit(value: string, units: number): string {
  let result = ''
  for (const char of smsPlainText(value)) { if (smsUnits(result + char) > units) break; result += char }
  return result.trim()
}

export function confirmationSms(brand: string, dateTime: string, link: string, service = 'Programare'): string {
  const suffix = `\n${smsPlainText(dateTime)}\nPentru confirmare, accesati linkul de mai jos:\n${link}`
  const available = 160 - smsUnits(suffix) - 1 // separator between business and service
  if (available < 12) throw new Error('Detaliile și linkul de confirmare nu încap într-un singur SMS. Nu a fost trimis.')
  const business = smsPlainText(brand) || 'BookEasy', appointment = smsPlainText(service) || 'Programare'
  const businessBudget = Math.min(smsUnits(business), Math.max(6, available - Math.min(smsUnits(appointment), Math.ceil(available * .6))))
  function compact(value: string, budget: number) { return smsUnits(value) <= budget ? value : `${fit(value, budget - 3)}...` }
  const businessText = compact(business, businessBudget)
  const serviceText = compact(appointment, available - smsUnits(businessText))
  return singleSms(`${businessText}\n${serviceText}${suffix}`)
}

export function reminderSms(brand: string, dateTime: string, service: string): string {
  const prefix = `${fit(brand || 'BookEasy', 28)}: reminder ${smsPlainText(dateTime)}.`
  const detail = fit(service, 160 - smsUnits(prefix) - 1)
  return singleSms(`${prefix}${detail ? ` ${detail}` : ''}`)
}

export function matchesSmsSim(configured: string | null, detected: string | null): boolean {
  function phone(value: string | null) {
    let digits = (value || '').replace(/[^0-9]/g, '')
    if (digits.startsWith('00')) digits = digits.slice(2)
    if (/^0\d{9}$/.test(digits)) digits = `40${digits.slice(1)}`
    return digits.length >= 8 && digits.length <= 15 ? digits : null
  }
  const expected = phone(configured), actual = phone(detected)
  return Boolean(expected && actual && expected === actual)
}

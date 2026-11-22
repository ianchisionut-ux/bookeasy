export function smsJobMessage(status?: string, error?: string | null, senderKey?: string | null): string {
  if (senderKey === 'smsapi') {
    if (status === 'SENT') return 'SMS acceptat de SMSAPI. Confirmarea livrării se vede în portalul furnizorului.'
    if (status === 'DISPATCHED') return 'SMSAPI procesează cererea de trimitere.'
    if (status === 'UNKNOWN') return error || 'SMSAPI nu a confirmat preluarea. Verifică istoricul furnizorului înainte de a trimite din nou.'
    if (status === 'PENDING') return 'SMS în așteptarea preluării de către SMSAPI.'
  }
  if (status === 'SENT') return 'Telefonul a predat SMS-ul operatorului. Acesta nu este un raport de livrare la client.'
  if (status === 'DISPATCHED') return 'SMS preluat de telefon. Așteptăm rezultatul trimiterii.'
  if (status === 'FAILED') return error || 'SMS-ul nu a putut fi trimis.'
  if (status === 'EXPIRED') return error || 'SMS expirat: programarea sau linkul nu mai este valabil.'
  if (status === 'UNKNOWN') return 'Telefonul a preluat SMS-ul, dar nu a raportat rezultatul. Nu retrimitem automat, pentru a evita dublurile.'
  return 'SMS adăugat în coadă. Nu este încă trimis; așteaptă preluarea de către telefonul gateway.'
}

export function visibleSmsStatus(job: { status: string; dispatchedAt: Date | string | null }, now = Date.now()) {
  return job.status === 'DISPATCHED' && job.dispatchedAt && now - new Date(job.dispatchedAt).getTime() > 180_000 ? 'UNKNOWN' : job.status
}

export function smsJobMessage(status?: string, error?: string | null): string {
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

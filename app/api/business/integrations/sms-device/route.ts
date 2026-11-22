import { privateJson } from '@/lib/private-json'
import { auth } from '@/lib/auth'

async function centralOnly() {
  if (!(await auth())) return privateJson({ error: 'unauthorized' }, { status: 401 })
  return privateJson({ error: 'Asocierea unui telefon pentru SMS a fost retrasă. Mesajele sunt disponibile prin SMSAPI.' }, { status: 410 })
}
export const POST = centralOnly
export const DELETE = centralOnly

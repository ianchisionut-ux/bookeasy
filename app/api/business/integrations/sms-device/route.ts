import { privateJson } from '@/lib/private-json'
import { auth } from '@/lib/auth'

async function centralOnly() {
  if (!(await auth())) return privateJson({ error: 'unauthorized' }, { status: 401 })
  return privateJson({ error: 'Se folosește exclusiv gateway-ul SMS central. Asocierea se face din Superadmin → SMS.' }, { status: 410 })
}
export const POST = centralOnly
export const DELETE = centralOnly

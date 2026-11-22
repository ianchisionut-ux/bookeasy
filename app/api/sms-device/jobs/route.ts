import { privateJson } from '@/lib/private-json'

function gatewayRetired() {
  return privateJson({ error: 'Gateway-ul Android pentru SMS a fost retras. Mesajele sunt disponibile prin SMSAPI.' }, { status: 410 })
}

export const GET = gatewayRetired
export const POST = gatewayRetired

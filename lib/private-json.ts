import { NextResponse } from 'next/server'
export function privateJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'private, no-store')
  return NextResponse.json(data, { ...init, headers })
}

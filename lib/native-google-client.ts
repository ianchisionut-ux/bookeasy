export type NativeGoogleFlow = { id: string; verifier: string; expiresAt: number; started: boolean }
const KEY = 'bookeasy-native-google-flow-v1'
let memory: NativeGoogleFlow | null = null
let preparing: Promise<NativeGoogleFlow> | null = null
export function isNativeGoogleApp() {
  return Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
}
export function readNativeGoogleFlow(): NativeGoogleFlow | null {
  try { memory = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { /* Retain memory if storage is unavailable. */ }
  if (!memory || !/^[a-f0-9]{48}$/.test(memory.id) || !/^[a-f0-9]{64}$/.test(memory.verifier) || !Number.isFinite(memory.expiresAt) || memory.expiresAt <= Date.now()) {
    clearNativeGoogleFlow()
    return null
  }
  return memory
}
function save(flow: NativeGoogleFlow) {
  memory = flow
  try { localStorage.setItem(KEY, JSON.stringify(flow)) } catch { /* Keep only the short-lived proof in memory. */ }
}
export function clearNativeGoogleFlow(id?: string) {
  if (id && memory?.id !== id) return
  memory = null
  try { localStorage.removeItem(KEY) } catch { /* Storage may be disabled. */ }
}
export async function authDeadline<T>(operation: Promise<T>, timeout = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Conectarea durează prea mult. Încearcă din nou.')), timeout) })])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}
async function post(path: string, body: unknown) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({ error: 'Conectarea nu este disponibilă momentan.' }))
    if (!response.ok) throw new Error(data.error || 'Conectarea nu a putut fi finalizată.')
    return data
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Conectarea durează prea mult. Încearcă din nou.')
    if (error instanceof TypeError) throw new Error('Conexiunea a fost întreruptă. Încearcă din nou.')
    throw error
  } finally { clearTimeout(timeout) }
}
export function prepareNativeGoogle(): Promise<NativeGoogleFlow> {
  const existing = readNativeGoogleFlow()
  if (existing) return Promise.resolve(existing)
  if (preparing) return preparing
  preparing = (async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    const challenge = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    const data = await post('/api/auth/native/start', { challenge })
    if (typeof data.id !== 'string' || !/^[a-f0-9]{48}$/.test(data.id) || !Number.isFinite(data.expiresAt)) throw new Error('Răspuns invalid la conectare.')
    const flow = { id: data.id, verifier, expiresAt: data.expiresAt, started: false }
    save(flow)
    return flow
  })().finally(() => { preparing = null })
  return preparing
}
export function openNativeGoogle(flow: NativeGoogleFlow) {
  save({ ...flow, started: true })
  // Capacitor opens a new window in Safari. OAuth state and PKCE are created there,
  // and only the one-time, verifier-bound result is redeemed inside the app.
  window.open(`/api/auth/native/login?flow=${encodeURIComponent(flow.id)}`, '_blank')
}
export async function nativeGoogleStatus(flow: NativeGoogleFlow): Promise<{ ready: boolean; expired: boolean }> {
  return post('/api/auth/native/status', { id: flow.id, verifier: flow.verifier })
}

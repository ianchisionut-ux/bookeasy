export const CLIENT_INSTALL_DISMISSED_KEY = 'bookeasy-client-install-dismissed-v1'
export const CLIENT_INSTALLED_KEY = 'bookeasy-client-installed-v1'
const INSTALL_SEEN_KEY = 'bookeasy-install-seen-v1'
export const INSTALL_PREFERENCE_EVENT = 'bookeasy-install-preference-changed'
const memory = new Set<string>()

function readFlag(key: string) {
  try { return memory.has(key) || localStorage.getItem(key) === '1' } catch { return memory.has(key) }
}
function writeFlag(key: string) {
  memory.add(key)
  try { localStorage.setItem(key, '1') } catch { /* Retain the preference for this page. */ }
}

export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    || Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
}

export function installWasDismissed() {
  // Honour the preference from the previous implementation too.
  let previous = false
  try { previous = sessionStorage.getItem('bookeasy-install-dismissed') === '1' } catch { /* Storage may be disabled. */ }
  if (previous) writeFlag(CLIENT_INSTALL_DISMISSED_KEY)
  return readFlag(CLIENT_INSTALL_DISMISSED_KEY) || readFlag(CLIENT_INSTALLED_KEY)
}

export function claimInstallSuggestion() {
  if (isStandaloneApp() || installWasDismissed() || readFlag(INSTALL_SEEN_KEY)) return false
  writeFlag(INSTALL_SEEN_KEY)
  return true
}

export function dismissInstallSuggestion() {
  writeFlag(CLIENT_INSTALL_DISMISSED_KEY)
  window.dispatchEvent(new Event(INSTALL_PREFERENCE_EVENT))
}

export function markAppInstalled() {
  writeFlag(CLIENT_INSTALLED_KEY)
  window.dispatchEvent(new Event(INSTALL_PREFERENCE_EVENT))
}

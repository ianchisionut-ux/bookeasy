export const CLIENT_INSTALL_DISMISSED_KEY = 'bookeasy-client-install-dismissed-v1'
export const CLIENT_INSTALLED_KEY = 'bookeasy-client-installed-v1'

export function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

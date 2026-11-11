// Public Meta identifiers. This configuration uses a USER token and only the
// six approved Page/Instagram permissions, independently of WhatsApp signup.
const BOOKEASY_APP_ID = '2147297066137440'
const BOOKEASY_USER_CONFIG_ID = '1118442484164958'

export function facebookLoginConfiguration() {
  const override = process.env.META_FACEBOOK_LOGIN_CONFIG_ID?.trim()
  const configId = override || (process.env.META_APP_ID === BOOKEASY_APP_ID ? BOOKEASY_USER_CONFIG_ID : '')
  return /^\d+$/.test(configId) ? configId : null
}

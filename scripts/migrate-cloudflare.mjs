import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// This command is intentionally separate from the Cloudflare build. The legacy
// preparation scripts still use VERCEL_ENV as their execution gate, so only
// their child processes receive that value after the checks below pass.
if (process.argv.length !== 2) {
  throw new Error('migrate:cloudflare does not accept build or Preview arguments.')
}
if (process.env.BOOKEASY_CLOUDFLARE_PRODUCTION_MIGRATION !== 'true') {
  throw new Error('Set BOOKEASY_CLOUDFLARE_PRODUCTION_MIGRATION=true to run the production database migration explicitly.')
}
if (
  process.env.BOOKEASY_CLOUDFLARE_PREVIEW === 'true' ||
  process.env.BOOKEASY_CLOUDFLARE_PREVIEW_BUILD === 'true' ||
  process.env.VERCEL_ENV === 'preview'
) {
  throw new Error('Database migrations are disabled in Preview.')
}

let databaseUrl
try {
  databaseUrl = new URL(process.env.DATABASE_URL)
} catch {
  throw new Error('Set DATABASE_URL to the intended production PostgreSQL database before migrating.')
}
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !databaseUrl.hostname || !databaseUrl.pathname || databaseUrl.pathname === '/') {
  throw new Error('DATABASE_URL must identify the intended production PostgreSQL database.')
}

const scripts = [
  'prepare-launch-offer.mjs',
  'prepare-business-categories.mjs',
  'apply-reconfirmation-settings.mjs',
  'apply-customer-archive.mjs',
  'prepare-native-google.mjs',
  'prepare-enrollment.mjs',
  'prepare-meta-page-selection.mjs',
  'prepare-account-deletion.mjs',
  'prepare-guides-help.mjs',
  'prepare-promotion-campaigns.mjs',
  'prepare-business-invitations.mjs',
  'prepare-invitation-plan.mjs',
  'prepare-dual-accounts.mjs',
  'prepare-signup-funnel.mjs',
  'prepare-campaign-management.mjs',
  'prepare-central-sms.mjs',
  'prepare-sms-limits.mjs',
  'prepare-service-prices.mjs',
  'ensure-billing-mode-history.mjs',
  'prepare-recurring-bookings.mjs',
  'prepare-business-map-location.mjs',
  'prepare-booking-sequences.mjs',
]

const cwd = fileURLToPath(new URL('../', import.meta.url))
const env = { ...process.env, VERCEL_ENV: 'production' }
for (const script of scripts) {
  console.log(`Preparing database: ${script}`)
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
    cwd,
    env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

# BookEasy on Cloudflare Workers

## Current deployment and production builds

Production runs on Cloudflare Workers with Neon and the `BOOKEASY_FILES` R2 bucket. The November 2026 migration started from Vercel revision `175fa19`; its Blob objects and database references have been transferred to R2. The Worker no longer needs a Vercel Blob token.

- Use `wrangler.preview.jsonc` for the isolated `bookeasy-preview` Worker and its separate R2 bucket. Set `BOOKEASY_PREVIEW_DATABASE_URL` as a secret on that Worker with a separate Neon database. Preview database access fails closed if the secret is missing or equals `DATABASE_URL`. Its responses are marked `noindex`.
- Keep the production Neon database and the matching `AUTH_SECRET` and `ENCRYPTION_KEY`. Provision the current provider secrets directly in Cloudflare, including SMSAPI credentials. Configure client-side `NEXT_PUBLIC_` variables when building.
- Before a release that needs schema changes, run `npm run migrate:cloudflare` separately with the intended production `DATABASE_URL` and `BOOKEASY_CLOUDFLARE_PRODUCTION_MIGRATION=true` supplied only to that command. It checks both values, rejects Preview markers, and then runs the existing preparation scripts in order. Check the database target before running it.
- Keep `BOOKEASY_CLOUDFLARE_PRODUCTION_MIGRATION` and the legacy `VERCEL_ENV=production` setting out of automatic Workers Builds and Preview. Both `npm run build` and `npm run build:cloudflare` only compile the app; the Cloudflare wrapper also strips `VERCEL_ENV` as a safeguard.
- Before a deployment, verify TLS and authenticated booking, calendar, media, and integration flows. Keep scheduled jobs aligned with the application deployment.
- BT iPay pays only BookEasy's issued subscription invoices to businesses. Configure `PLATFORM_IPAY_USERNAME`, `PLATFORM_IPAY_PASSWORD`, `PLATFORM_IPAY_IS_LIVE` and `PLATFORM_IPAY_ENABLED` as Worker secrets. Keep the last flag `false` until the bank confirms the merchant credentials, the correct environment, **1-phase (automatic deposit)** for subscription payments, and any Cloudflare egress IP requirements. Test and live credentials differ. The checkout button appears only for an unpaid RON invoice and a Business owner. Bank status, order number, currency and exact minor-unit amount must match before BookEasy marks an invoice paid. Existing orders continue to reconcile if new checkouts are disabled. The `*/5 * * * *` production Cron Trigger handles this; Preview has no billing Cron Trigger.

## Historical migration from September 2026

Worker: `https://bookeasy.ianchisionut.workers.dev`

Branch: `cloudflare-migration`. On 2026-09-05 the Cloudflare zone became active and Worker routes were installed for `bookeasy.ro/*` and `www.bookeasy.ro/*`. HTTPS tests using the authoritative Cloudflare address returned HTTP 200 and `x-opennext: 1` on both hostnames. Some recursive DNS caches still returned Vercel addresses during cutover.

The existing proxied web DNS records remain as fallback origins; Worker routes serve application traffic. Custom Domain attachment was blocked by those records and is not used. Email DNS records were not changed. Vercel project crons were disabled via its API and Cloudflare cron execution enabled. Cron dispatch calls the OpenNext handler internally, rather than making same-zone network requests to the legacy origin.

## Runtime

- Next.js is packaged with OpenNext; all managed uploads and downloads use the `BOOKEASY_FILES` R2 binding.
- Prisma clients are cached per Cloudflare execution context, not globally or per model access. This preserves client identity for transactions and isolates WebSocket I/O between requests.
- Auth.js trusts the deployment proxy. Preserve the production `AUTH_SECRET` and `ENCRYPTION_KEY`; replacing these arbitrarily invalidates sessions or existing integration tokens.
- Runtime secrets must contain real values. Vercel sensitive variables cannot be recovered using `env pull`; never bulk-import redacted placeholders.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is required at build time as well as runtime. Never use a full secret environment file to populate public build variables.

## Remaining cutover

1. Confirm remaining recursive DNS caches have picked up the Cloudflare delegation. Authoritative nameservers are `chad.ns.cloudflare.com` and `nola.ns.cloudflare.com`.
2. Keep the persisted Worker routes active; removing them sends traffic to the fallback DNS origin.
4. Verify authenticated dashboard access, Google Calendar and Meta callbacks, email, and file upload/download on the production hostname. Public HTTP 200 checks do not validate these integrations.
5. Observe the next scheduled executions. Configuration was verified; jobs were not manually run because they send notifications and may suspend overdue accounts.
6. Validate Workers Builds deployments. Use build command `npm run build:cloudflare`, deploy command `npx wrangler deploy --config wrangler.jsonc`, root `/`, and configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` at build time. Run the separate production database migration step before deploying a release that needs it.

## File migration completed on 2026-09-05

The legacy clinic cover was copied from public Vercel Blob to `BOOKEASY_FILES` R2. Source and destination SHA-256 matched, and the database URL was updated with a compare-and-set guard. A local backup and rollback manifest are under `.wrangler/cover-migration-6bpNML/`. The original Blob was not deleted.

The cutover audit scanned every public-schema text column after the update and found no remaining Vercel references. R2 public URLs bypass the Next image optimizer because its local API image lookup returned 404; the R2 endpoint itself returned 200 image/jpeg. The one-time Blob copy and audit scripts were removed after their results were recorded.

Local DNS now resolves both Cloudflare IPv4 addresses. The production Worker routes and R2 do not require the Vercel project. The existing A-record origin addresses are only fallbacks when Worker routes are absent; keep the Worker routes in place. Delete only the Vercel BookEasy project, not the independently used Neon database or any external integration account. Authenticated happy-path and external message/email/calendar tests remain unverified and are separate from removal of the Vercel file dependency.

## Checks

`npm run build:cloudflare` builds and checks types without preparing the database. `npx tsx scripts/test-prisma-request-scope.ts` tests request isolation and client identity without executing the WASM database engine. It does not test database transactions end to end.

`node scripts/check-cloudflare-source.cjs <local-env-file>` is a narrow, read-only database audit that prints selected record counts and decryptability results, never token values. The source checked on 2026-09-05 contained zero invoice/document/photo records, zero channel records, and one Google Calendar connection whose token could be decrypted with the source encryption key. A separate live audit checked all 432 text/JSON columns and found zero Blob references; the source-check script does not repeat that global audit. Public business slugs matched the Vercel API; this is not a complete database identity or integration audit.

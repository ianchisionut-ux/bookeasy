# BookEasy migration status

Worker: `https://bookeasy.ianchisionut.workers.dev`

Branch: `cloudflare-migration`. On 2026-09-05 the Cloudflare zone became active and Worker routes were installed for `bookeasy.ro/*` and `www.bookeasy.ro/*`. HTTPS tests using the authoritative Cloudflare address returned HTTP 200 and `x-opennext: 1` on both hostnames. Some recursive DNS caches still returned Vercel addresses during cutover.

The existing proxied web DNS records remain as fallback origins; Worker routes serve application traffic. Custom Domain attachment was blocked by those records and is not used. Email DNS records were not changed. Vercel project crons were disabled via its API and Cloudflare cron execution enabled. Cron dispatch calls the OpenNext handler internally, rather than making same-zone network requests to the legacy origin.

## Runtime

- Next.js is packaged with OpenNext; uploads use the private `BOOKEASY_FILES` R2 binding.
- Prisma clients are cached per Cloudflare execution context, not globally or per model access. This preserves client identity for transactions and isolates WebSocket I/O between requests.
- Auth.js trusts the deployment proxy. Preserve the production `AUTH_SECRET` and `ENCRYPTION_KEY`; replacing these arbitrarily invalidates sessions or existing integration tokens.
- Runtime secrets must contain real values. Vercel sensitive variables cannot be recovered using `env pull`; never bulk-import redacted placeholders.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is required at build time as well as runtime. Never use a full secret environment file to populate public build variables.

## Remaining cutover

1. Confirm remaining recursive DNS caches have picked up the Cloudflare delegation. Authoritative nameservers are `chad.ns.cloudflare.com` and `nola.ns.cloudflare.com`.
2. Keep the persisted Worker routes active; removing them sends traffic to the fallback DNS origin.
4. Verify authenticated dashboard access, Google Calendar and Meta callbacks, email, and file upload/download on the production hostname. Public HTTP 200 checks do not validate these integrations.
5. Observe the next scheduled executions. Configuration was verified; jobs were not manually run because they send notifications and may suspend overdue accounts.
6. Configure a reproducible Cloudflare build/deploy from GitHub with the public build variable, then merge the migration branch without triggering an incompatible Vercel production build.

Keep the Vercel deployment available for rollback until the migration is verified.

## Checks

`npm run build:cloudflare` builds and checks types. `npx tsx scripts/test-prisma-request-scope.ts` tests request isolation and client identity without executing the WASM database engine. It does not test database transactions end to end.

`node scripts/check-cloudflare-source.cjs <local-env-file>` is a read-only database audit that prints counts and decryptability results, never token values. The source checked on 2026-09-05 contained zero invoice/document/photo records, zero channel records, and one Google Calendar connection whose token could be decrypted with the source encryption key. Public business slugs matched the Vercel API; this is not a complete database identity or integration audit.

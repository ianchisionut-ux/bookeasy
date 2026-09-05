# BookEasy migration status

Worker: `https://bookeasy.ianchisionut.workers.dev`

Branch: `cloudflare-migration`. Production DNS still points to Vercel as of 2026-09-05.

## Runtime

- Next.js is packaged with OpenNext; uploads use the private `BOOKEASY_FILES` R2 binding.
- Prisma clients are cached per Cloudflare execution context, not globally or per model access. This preserves client identity for transactions and isolates WebSocket I/O between requests.
- Auth.js trusts the deployment proxy. Preserve the production `AUTH_SECRET` and `ENCRYPTION_KEY`; replacing these arbitrarily invalidates sessions or existing integration tokens.
- Runtime secrets must contain real values. Vercel sensitive variables cannot be recovered using `env pull`; never bulk-import redacted placeholders.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is required at build time as well as runtime. Never use a full secret environment file to populate public build variables.

## Remaining cutover

1. Add `bookeasy.ro` as a Cloudflare DNS zone; copy all current DNS records, including email records. Check DNSSEC at the registrar before changing delegation.
2. Change the registrar nameservers to those assigned to this exact zone; wait for the zone to become active.
3. Attach `bookeasy.ro` and `www.bookeasy.ro` to the `bookeasy` Worker and persist these custom domains in Wrangler configuration.
4. Verify authenticated dashboard access, Google Calendar and Meta callbacks, email, and file upload/download on the production hostname. Public HTTP 200 checks do not validate these integrations.
5. Disable the old Vercel cron schedules before setting `ENABLE_CRON_TRIGGERS=true` on Cloudflare. Keep only one scheduler active.
6. Configure a reproducible Cloudflare build/deploy from GitHub with the public build variable, then merge the migration branch without triggering an incompatible Vercel production build.

Keep the Vercel deployment available for rollback until the migration is verified.

## Checks

`npm run build:cloudflare` builds and checks types. `npx tsx scripts/test-prisma-request-scope.ts` tests request isolation and client identity without executing the WASM database engine. It does not test database transactions end to end.

`node scripts/check-cloudflare-source.cjs <local-env-file>` is a read-only database audit that prints counts and decryptability results, never token values. The source checked on 2026-09-05 contained zero invoice/document/photo records, zero channel records, and one Google Calendar connection whose token could be decrypted with the source encryption key. Public business slugs matched the Vercel API; this is not a complete database identity or integration audit.

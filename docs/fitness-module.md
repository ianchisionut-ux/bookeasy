# FitEasy — Fitness module

Only FITNESS businesses expose `/dashboard/fitness`. The instructor is the business OWNER; STAFF access to private plans is deliberately not enabled. Existing appointment calendars stay unchanged except for treating FITNESS as appointment-based.

## Access and roles

- Add customers in the existing customer manager, then activate a portal in Planuri Fitness.
- An instructor generates a 24-hour single-use bearer invitation. Share it privately with the intended customer. It grants access to sensitive personal plans.
- The token travels in the URL fragment, is explicitly redeemed by POST, is stored hashed, and is removed from browser history before redemption. Redemption is conditional and transactional.
- The client receives an independent HttpOnly, SameSite=Strict cookie, valid for 30 days. It is NOT a dashboard User or NextAuth session. A new device/expired session requires a fresh instructor invitation.
- Revocation disables the client and deletes all sessions; existing plans remain.
- Client APIs derive the client ID exclusively from the verified session. Instructor APIs scope the customer lookup to the owner's current business, checked against the database.
- Clients may change only completed/feedback. Strict input validation rejects plan fields and actor identifiers. Optimistic versions prevent overwriting concurrent edits.

## Calendars / communication

Nutrition and workout plans are weekly, with date/time/title/free-text details. Appointments are read from existing bookings for the same customer. Plan dates are local business calendar dates; booking timestamps are displayed in the configured business timezone.

Synchronization polls every 20 seconds while visible/online, also on focus visibility and reconnection. Offline writes are not queued; no personal data is stored in localStorage or service-worker caches. This is online synchronization, not background push or WebSocket delivery. Messages have bounded history pagination.

Video invitations create an unguessable Jitsi room link in the private conversation. The external service loads only after clicking the link. The instructor must authenticate at meet.jit.si to start the room, and should enable a lobby/password. No guarantee of free SLA, room-level BookEasy authorization or native in-app calling is claimed. No names or plan contents are placed in the video URL.

## Branding / PWA

Official supplied FitEasy logo: `public/fiteasy-logo.png`. Non-Fitness categories retain BookEasy. Separate manifests have distinct IDs and start paths for instructor and client, and use a PNG icon rendered from the supplied logo. Instructor login is the existing shared BookEasy login; brand is resolved after authentication. No DNS/domain move to fiteasy.ro is included.

## Release requirements

1. Generate Prisma client and apply the additive `20260909100000_fitness_portal` migration to a test database first, then production only as part of the release.
2. Run `npx tsx scripts/test-fitness.ts`, `npx tsc --noEmit`, and the Cloudflare build.
3. On a disposable FITNESS business, verify two customers cannot see each other's plans/messages; verify a SALON owner and STAFF are denied. Check expired/reused invites, revocation, parallel edits, and migration rollback strategy (do not drop real client data).
4. Verify both PWA installs on Android/iOS, message synchronization on two devices, the icon route, and a two-party Jitsi call. No push notifications are implemented.
5. Review customer-facing privacy disclosures before real client nutrition data is entered.

## Release verification (2026-09-09)

- Prisma client generation, TypeScript checking and OpenNext Cloudflare build passed.
- `scripts/test-fitness.ts`: validation and structural regression checks passed (compiled with tsc then run with Node; tsx hit a sandbox OS userInfo error).
- `node scripts/test-fitness-routes.cjs`: actual API handlers with mocked DB passed tenant isolation, strict client writes, optimistic version conflict, CSRF, single-use invite and revocation checks. This does not replace a real database integration test.
- Existing service-worker regression test passed.
- Local browser: unauthenticated portal has FitEasy title/logo, logo loaded, no console errors. PNG icon endpoint returned HTTP 200.
- Production migration `20260909100000_fitness_portal` was dry-run, applied transactionally, verified, and recorded in Prisma migration history.
- Cloudflare Worker deployment `e1ffdbc5-9dd7-44e7-af07-f9bd394a8baa` serves `bookeasy.ro` and `www.bookeasy.ro`.
- Production checks passed for `/fitness`, the official logo, the generated PWA icon, the client manifest, Cloudflare routing, and unauthenticated API rejection. The browser rendered the portal with no console warnings or errors.
- An authenticated two-device calendar/message test and a real video call still require a disposable FITNESS business and two client devices; they were not simulated against real customer data.

-- Temporary, encrypted OAuth choices. Existing connections are not modified.
CREATE TABLE IF NOT EXISTS "PendingMetaConnection" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "redirectTo" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "PendingMetaConnection_expiresAt_idx" ON "PendingMetaConnection" ("expiresAt");

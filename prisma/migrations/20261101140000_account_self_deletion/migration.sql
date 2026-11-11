CREATE TABLE IF NOT EXISTS "AccountRevocation" (
  "ownerHash" TEXT PRIMARY KEY,
  "revokedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AccountDeletionChallenge" (
  "tokenHash" TEXT PRIMARY KEY,
  "actorHash" TEXT NOT NULL,
  "targetHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "AccountDeletionChallenge_expiresAt_idx" ON "AccountDeletionChallenge" ("expiresAt");
CREATE TABLE IF NOT EXISTS "ClosedBusinessRecord" (
  "businessHash" TEXT PRIMARY KEY,
  "records" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AccountFileDeletion" (
  "id" TEXT PRIMARY KEY,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

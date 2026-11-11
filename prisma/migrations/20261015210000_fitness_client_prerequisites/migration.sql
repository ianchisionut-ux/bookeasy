-- Shared signup/login limits and the existing connection selection model.
-- This release does not install unrelated booking triggers or rewrite identities.
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket" ("resetAt");
CREATE TABLE IF NOT EXISTS "PendingGoogleConnection" (
  id TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "redirectTo" TEXT NOT NULL, locations JSONB NOT NULL,
  "accessToken" TEXT NOT NULL, "refreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "PendingGoogleConnection_expiresAt_idx" ON "PendingGoogleConnection" ("expiresAt");

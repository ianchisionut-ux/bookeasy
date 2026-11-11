CREATE TABLE IF NOT EXISTS "NativeGoogleFlow" (
  "id" TEXT PRIMARY KEY,
  "challenge" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NativeGoogleFlow_expiresAt_idx" ON "NativeGoogleFlow" ("expiresAt");

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "smsSenderMode" TEXT NOT NULL DEFAULT 'CENTRAL';
ALTER TABLE "SmsJob" ADD COLUMN IF NOT EXISTS "senderKey" TEXT;
CREATE TABLE IF NOT EXISTS "PlatformSmsGateway" ("id" TEXT PRIMARY KEY DEFAULT 'central', "phone" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT false, "tokenHash" TEXT, "lastSeenAt" TIMESTAMP(3), "lastError" TEXT);
CREATE INDEX IF NOT EXISTS "SmsJob_senderKey_status_createdAt_idx" ON "SmsJob"("senderKey", "status", "createdAt");
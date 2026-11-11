ALTER TABLE "SmsJob" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
ALTER TABLE "SmsJob" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "SmsJob" ADD COLUMN IF NOT EXISTS "senderPhone" TEXT;
ALTER TABLE "SmsJob" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SmsJob_businessId_bookingId_idx" ON "SmsJob"("businessId","bookingId");
CREATE INDEX IF NOT EXISTS "SmsJob_senderPhone_dispatchedAt_idx" ON "SmsJob"("senderPhone","dispatchedAt");
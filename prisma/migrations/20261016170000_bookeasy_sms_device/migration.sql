ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "smsGatewayMode" TEXT NOT NULL DEFAULT 'EXTERNAL',
  ADD COLUMN IF NOT EXISTS "smsDeviceTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "smsDeviceLastSeenAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SmsJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "error" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "SmsJob_businessId_idempotencyKey_key" ON "SmsJob"("businessId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "SmsJob_businessId_status_createdAt_idx" ON "SmsJob"("businessId", "status", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmsJob_businessId_fkey') THEN
    ALTER TABLE "SmsJob" ADD CONSTRAINT "SmsJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

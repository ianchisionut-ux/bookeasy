CREATE TABLE IF NOT EXISTS "ClientProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerKey" TEXT NOT NULL,
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClientProfile_ownerKey_key" ON "ClientProfile"("ownerKey");
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "clientProfileId" TEXT;
CREATE INDEX IF NOT EXISTS "Booking_clientProfileId_startAt_idx" ON "Booking"("clientProfileId", "startAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_clientProfileId_fkey') THEN
    ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

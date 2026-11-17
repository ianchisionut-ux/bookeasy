DO $$ BEGIN
  CREATE TYPE "BookingSeriesFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BookingSeries" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "practitionerId" TEXT,
  "frequency" "BookingSeriesFrequency" NOT NULL,
  "firstStartAt" TIMESTAMP(3) NOT NULL,
  "untilDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP(3),
  CONSTRAINT "BookingSeries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingSeries_businessId_customerId_createdAt_idx" ON "BookingSeries"("businessId", "customerId", "createdAt");
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
CREATE INDEX IF NOT EXISTS "Booking_seriesId_startAt_idx" ON "Booking"("seriesId", "startAt");
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

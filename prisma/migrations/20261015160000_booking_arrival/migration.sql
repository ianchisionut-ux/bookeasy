ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "arrivalTokenHash" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "arrivalCandidateAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "arrivalLastSeenAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "arrivalSamples" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_businessId_arrivedAt_idx" ON "Booking"("businessId", "arrivedAt");

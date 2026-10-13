ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewerGoogleSub" TEXT;
CREATE INDEX IF NOT EXISTS "Booking_reviewerGoogleSub_endAt_idx" ON "Booking"("reviewerGoogleSub", "endAt");
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "verifiedByGoogle" BOOLEAN NOT NULL DEFAULT false;

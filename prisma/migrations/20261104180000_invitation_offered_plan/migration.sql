ALTER TABLE "BusinessInvitation"
ADD COLUMN IF NOT EXISTS "offeredPlan" TEXT NOT NULL DEFAULT 'STANDARD';

UPDATE "BusinessInvitation"
SET "offeredPlan" = 'CAMPAIGN'
WHERE "promoCode" IS NOT NULL AND "offeredPlan" = 'STANDARD';

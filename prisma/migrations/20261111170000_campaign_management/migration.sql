ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "freeUntilNotice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "regularMinor" INTEGER NOT NULL DEFAULT 5500;
ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "LaunchEnrollment" ADD COLUMN IF NOT EXISTS "freeUntilNotice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LaunchEnrollment" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "BusinessInvitation" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "LaunchEnrollment" DROP CONSTRAINT IF EXISTS "LaunchEnrollment_terms_check";
ALTER TABLE "LaunchEnrollment" ADD CONSTRAINT "LaunchEnrollment_terms_check" CHECK (
 ("freeUntilNotice" AND "regularMinor"=0 AND "promoMinor"=0 AND "promoMonths"=0)
 OR (NOT "freeUntilNotice" AND "freeMonths" BETWEEN 1 AND 24 AND "promoMonths">=0 AND "promoMinor">=0 AND "regularMinor">=0)
);
CREATE TABLE IF NOT EXISTS "PlatformPlanPrice" (
 "id" TEXT PRIMARY KEY CHECK ("id" IN ('STANDARD','PRO')),
 "amountMinor" INTEGER CHECK ("amountMinor" IS NULL OR "amountMinor" BETWEEN 0 AND 10000000),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "PlatformPlanPrice" ("id","amountMinor") VALUES ('STANDARD',5500),('PRO',NULL) ON CONFLICT ("id") DO NOTHING;

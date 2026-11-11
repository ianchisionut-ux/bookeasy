ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Campanie promoțională';
ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "freeMonths" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "LaunchCampaign" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
UPDATE "LaunchCampaign" SET "code"='LANSARE2',"name"='Lansare BookEasy' WHERE "id"='bookeasy-launch-2026' AND "code" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "LaunchCampaign_code_key" ON "LaunchCampaign" ("code");

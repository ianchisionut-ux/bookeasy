-- Drop fitness portal tables (children first, due to FK constraints).
DROP TABLE IF EXISTS "FitnessMessage";
DROP TABLE IF EXISTS "FitnessEntry";
DROP TABLE IF EXISTS "FitnessSession";
DROP TABLE IF EXISTS "FitnessClient";

-- A FITNESS business belongs to the separate FitEasy product and must be
-- removed explicitly before this migration, never disguised as a salon.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Business" WHERE "category" = 'FITNESS') THEN
    RAISE EXCEPTION 'Remove FITNESS businesses before applying this migration';
  END IF;
END $$;
DELETE FROM "AccessRequest" WHERE "category" = 'FITNESS';

-- Recreate BusinessType without FITNESS (Postgres has no ALTER TYPE ... DROP VALUE).
ALTER TYPE "BusinessType" RENAME TO "BusinessType_old";
CREATE TYPE "BusinessType" AS ENUM ('SALON', 'EVENT_VENUE', 'HOTEL', 'PENSIUNE', 'CLINICA');
ALTER TABLE "Business" ALTER COLUMN "category" TYPE "BusinessType" USING ("category"::text::"BusinessType");
ALTER TABLE "AccessRequest" ALTER COLUMN "category" TYPE "BusinessType" USING ("category"::text::"BusinessType");
DROP TYPE "BusinessType_old";

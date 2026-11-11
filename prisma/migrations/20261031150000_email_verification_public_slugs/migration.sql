SELECT pg_advisory_xact_lock(21420261031::bigint);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "BusinessSlugAlias" (
  "slug" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BusinessSlugAlias_businessId_idx" ON "BusinessSlugAlias"("businessId");

-- Reserve both current and historical links across concurrent writes.
CREATE OR REPLACE FUNCTION bookeasy_guard_business_slug() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(21420261031::bigint);
  IF EXISTS (SELECT 1 FROM "BusinessSlugAlias" WHERE "slug" = NEW."slug" AND "businessId" <> NEW."id") THEN
    RAISE EXCEPTION 'Public link already reserved' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS bookeasy_guard_business_slug ON "Business";
CREATE TRIGGER bookeasy_guard_business_slug BEFORE INSERT OR UPDATE OF "slug" ON "Business" FOR EACH ROW EXECUTE FUNCTION bookeasy_guard_business_slug();

CREATE OR REPLACE FUNCTION bookeasy_guard_slug_alias() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(21420261031::bigint);
  IF EXISTS (SELECT 1 FROM "Business" WHERE "slug" = NEW."slug" AND "id" <> NEW."businessId") THEN
    RAISE EXCEPTION 'Public link already reserved' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS bookeasy_guard_slug_alias ON "BusinessSlugAlias";
CREATE TRIGGER bookeasy_guard_slug_alias BEFORE INSERT OR UPDATE ON "BusinessSlugAlias" FOR EACH ROW EXECUTE FUNCTION bookeasy_guard_slug_alias();


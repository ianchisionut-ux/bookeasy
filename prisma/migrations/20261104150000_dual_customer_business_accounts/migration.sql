ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountKind" TEXT NOT NULL DEFAULT 'BUSINESS';
UPDATE "User" SET "accountKind" = 'CUSTOMER' WHERE "role" = 'CUSTOMER' AND "accountKind" <> 'CUSTOMER';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_accountKind_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_accountKind_check" CHECK ("accountKind" IN ('BUSINESS', 'CUSTOMER'));
  END IF;
END $$;
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_accountKind_key" ON "User"("email", "accountKind");

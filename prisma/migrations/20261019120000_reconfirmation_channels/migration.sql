ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "smsReconfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "messengerReconfirmationEnabled" BOOLEAN NOT NULL DEFAULT true;

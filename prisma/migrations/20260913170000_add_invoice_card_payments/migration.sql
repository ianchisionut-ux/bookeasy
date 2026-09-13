ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "billingStripeCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingStripePaymentIntentId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingPaidAt" TIMESTAMP(3);

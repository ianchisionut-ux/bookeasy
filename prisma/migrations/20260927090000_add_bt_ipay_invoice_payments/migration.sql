ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "billingIpayOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingIpayOrderNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "billingIpayPaymentState" TEXT,
  ADD COLUMN IF NOT EXISTS "billingIpayPaymentError" TEXT,
  ADD COLUMN IF NOT EXISTS "billingIpayStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingIpayAmountMinor" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingIpayCurrency" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingIpayInvoiceReference" TEXT;

CREATE INDEX IF NOT EXISTS "Business_billingIpayPaymentState_idx"
  ON "Business" ("billingIpayPaymentState");

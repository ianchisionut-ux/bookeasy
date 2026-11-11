CREATE TABLE IF NOT EXISTS "BillingModeChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "fromMode" TEXT NOT NULL,
  "toMode" TEXT NOT NULL,
  "fromCampaignId" TEXT,
  "toCampaignId" TEXT,
  "previousPlanName" TEXT,
  "previousBillingStatus" "BillingStatus" NOT NULL,
  "previousAmount" DECIMAL(65,30),
  "previousDueAt" TIMESTAMP(3),
  "previousInvoiceUrl" TEXT,
  "previousInvoiceName" TEXT,
  "previousInvoiceExternalId" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingModeChange_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BillingModeChange_businessId_changedAt_idx" ON "BillingModeChange"("businessId", "changedAt");

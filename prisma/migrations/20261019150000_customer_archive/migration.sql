ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Customer_businessId_archivedAt_idx" ON "Customer"("businessId", "archivedAt");

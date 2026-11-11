CREATE TABLE IF NOT EXISTS "CustomerMergeArchive" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "CustomerMergeArchive_businessId_createdAt_idx" ON "CustomerMergeArchive" ("businessId", "createdAt");

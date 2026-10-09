ALTER TABLE "Business"
  ADD COLUMN "contractRepresentativeName" TEXT,
  ADD COLUMN "contractRepresentativeRole" TEXT;

CREATE TYPE "ContractDocumentType" AS ENUM ('SERVICES', 'DPA');

CREATE TABLE "ContractSignature" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type" "ContractDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "document" JSONB NOT NULL,
  "documentHash" TEXT NOT NULL,
  "customerSignature" TEXT NOT NULL,
  "customerSignerName" TEXT NOT NULL,
  "customerUserId" TEXT NOT NULL,
  "customerEmail" TEXT,
  "customerSignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "customerIp" TEXT,
  "customerUserAgent" TEXT,
  "providerSignature" TEXT,
  "providerSignerName" TEXT,
  "providerUserId" TEXT,
  "providerEmail" TEXT,
  "providerSignedAt" TIMESTAMP(3),
  "providerIp" TEXT,
  "providerUserAgent" TEXT,
  CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractSignature_businessId_type_customerSignedAt_idx"
  ON "ContractSignature"("businessId", "type", "customerSignedAt");

CREATE UNIQUE INDEX "ContractSignature_businessId_type_documentHash_key"
  ON "ContractSignature"("businessId", "type", "documentHash");

ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

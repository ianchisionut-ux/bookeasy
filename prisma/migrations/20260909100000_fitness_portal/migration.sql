ALTER TYPE "BusinessType" ADD VALUE 'FITNESS';

CREATE TABLE "FitnessClient" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "inviteHash" TEXT,
  "inviteExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FitnessClient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FitnessClient_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FitnessClient_customerId_key" ON "FitnessClient"("customerId");
CREATE UNIQUE INDEX "FitnessClient_inviteHash_key" ON "FitnessClient"("inviteHash");
CREATE INDEX "FitnessClient_businessId_idx" ON "FitnessClient"("businessId");

CREATE TABLE "FitnessSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FitnessSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "FitnessClient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FitnessSession_tokenHash_key" ON "FitnessSession"("tokenHash");
CREATE INDEX "FitnessSession_clientId_idx" ON "FitnessSession"("clientId");

CREATE TABLE "FitnessEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "feedback" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FitnessEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "FitnessClient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FitnessEntry_clientId_date_idx" ON "FitnessEntry"("clientId", "date");

CREATE TABLE "FitnessMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FitnessMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "FitnessClient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FitnessMessage_clientId_createdAt_idx" ON "FitnessMessage"("clientId", "createdAt");

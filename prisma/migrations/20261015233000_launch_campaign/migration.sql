-- CreateTable
CREATE TABLE "LaunchCampaign" (
    "id" TEXT NOT NULL,
    "enrollmentOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchEnrollment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "freeEndsAt" TIMESTAMP(3),
    "promoEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "billingCycle" INTEGER,
    "nextSyncAt" TIMESTAMP(3),
    "freeMonths" INTEGER NOT NULL DEFAULT 1,
    "promoMonths" INTEGER NOT NULL DEFAULT 2,
    "promoMinor" INTEGER NOT NULL DEFAULT 2800,
    "regularMinor" INTEGER NOT NULL DEFAULT 5500,

    CONSTRAINT "LaunchEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchBillingPeriod" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "invoiceName" TEXT,
    "invoiceExternalId" TEXT,

    CONSTRAINT "LaunchBillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchEnrollment_businessId_key" ON "LaunchEnrollment"("businessId");

-- CreateIndex
CREATE INDEX "LaunchEnrollment_cancelledAt_businessId_idx" ON "LaunchEnrollment"("cancelledAt", "businessId");

-- CreateIndex
CREATE INDEX "LaunchEnrollment_cancelledAt_nextSyncAt_idx" ON "LaunchEnrollment"("cancelledAt", "nextSyncAt");

-- CreateIndex
CREATE INDEX "LaunchEnrollment_cancelledAt_freeEndsAt_idx" ON "LaunchEnrollment"("cancelledAt", "freeEndsAt");

-- CreateIndex
CREATE INDEX "LaunchEnrollment_cancelledAt_promoEndsAt_idx" ON "LaunchEnrollment"("cancelledAt", "promoEndsAt");

-- CreateIndex
CREATE INDEX "LaunchBillingPeriod_enrollmentId_paidAt_startsAt_idx" ON "LaunchBillingPeriod"("enrollmentId", "paidAt", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchBillingPeriod_enrollmentId_cycle_key" ON "LaunchBillingPeriod"("enrollmentId", "cycle");

-- CreateIndex
CREATE INDEX "Business_createdAt_id_idx" ON "Business"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Business_onboardingDone_createdAt_idx" ON "Business"("onboardingDone", "createdAt");

-- CreateIndex
CREATE INDEX "Business_billingStatus_createdAt_idx" ON "Business"("billingStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "LaunchEnrollment" ADD CONSTRAINT "LaunchEnrollment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchEnrollment" ADD CONSTRAINT "LaunchEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "LaunchCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchBillingPeriod" ADD CONSTRAINT "LaunchBillingPeriod_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LaunchEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LaunchBillingPeriod" ADD CONSTRAINT "LaunchBillingPeriod_valid_period_check"
  CHECK ("cycle" >= 0 AND "amountMinor" >= 0 AND "endsAt" > "startsAt");
ALTER TABLE "LaunchEnrollment" ADD CONSTRAINT "LaunchEnrollment_terms_check"
  CHECK ("freeMonths" = 1 AND "promoMonths" = 2 AND "promoMinor" = 2800 AND "regularMinor" = 5500);

-- Only new signups participate; existing businesses are never enrolled retroactively.
INSERT INTO "LaunchCampaign" ("id", "enrollmentOpen", "updatedAt")
VALUES ('bookeasy-launch-2026', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

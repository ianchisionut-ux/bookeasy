-- AlterTable
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- Fitness is one instructor per business. The three calendars belong to that instructor.
UPDATE "Business" SET "teamSize" = 1 WHERE "category"::text = 'FITNESS' AND "teamSize" <> 1;
ALTER TABLE "Business" ADD CONSTRAINT "Business_fitness_single_instructor_check"
  CHECK ("category"::text <> 'FITNESS' OR "teamSize" = 1);

-- CreateTable
CREATE TABLE "FitnessMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "clientProfileId" TEXT,
    "goal" TEXT NOT NULL DEFAULT '',
    "coachNotes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inviteHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitnessMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessPlan" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessTask" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "day" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 45,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT NOT NULL DEFAULT '',
    "videoRoom" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessProgress" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FitnessProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMember_customerId_key" ON "FitnessMember"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMember_inviteHash_key" ON "FitnessMember"("inviteHash");

-- CreateIndex
CREATE INDEX "FitnessMember_businessId_active_idx" ON "FitnessMember"("businessId", "active");

-- CreateIndex
CREATE INDEX "FitnessMember_clientProfileId_idx" ON "FitnessMember"("clientProfileId");

-- CreateIndex
CREATE INDEX "FitnessPlan_memberId_kind_idx" ON "FitnessPlan"("memberId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTask_videoRoom_key" ON "FitnessTask"("videoRoom");

-- CreateIndex
CREATE INDEX "FitnessTask_memberId_day_idx" ON "FitnessTask"("memberId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessProgress_memberId_day_key" ON "FitnessProgress"("memberId", "day");

-- AddForeignKey
ALTER TABLE "FitnessMember" ADD CONSTRAINT "FitnessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessMember" ADD CONSTRAINT "FitnessMember_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessMember" ADD CONSTRAINT "FitnessMember_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessPlan" ADD CONSTRAINT "FitnessPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FitnessMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTask" ADD CONSTRAINT "FitnessTask_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FitnessMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessTask" ADD CONSTRAINT "FitnessTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FitnessPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessProgress" ADD CONSTRAINT "FitnessProgress_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FitnessMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

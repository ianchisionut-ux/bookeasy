ALTER TABLE "Business" ADD COLUMN "categoryLocked" BOOLEAN NOT NULL DEFAULT false;

-- Existing accounts created by superadmin have a configured business name,
-- while self-registered accounts retain the onboarding placeholder.
UPDATE "Business" SET "categoryLocked" = true
WHERE "onboardingStep" = 1 AND "onboardingDone" = false AND "name" <> 'Afacerea mea';

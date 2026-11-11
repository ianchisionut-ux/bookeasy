-- Defaults apply only to future enrollments. Existing accepted terms and payments stay intact.
ALTER TABLE "LaunchEnrollment" ALTER COLUMN "freeMonths" SET DEFAULT 2;
ALTER TABLE "LaunchEnrollment" ALTER COLUMN "promoMonths" SET DEFAULT 0;
ALTER TABLE "LaunchEnrollment" ALTER COLUMN "promoMinor" SET DEFAULT 0;

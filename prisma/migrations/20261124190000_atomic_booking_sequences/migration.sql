-- Booking numbers belong to the month in which the booking was created in
-- Bucharest. The trigger handles old and new app versions during a rollout.
-- Existing bookings, including historical duplicate numbers, are untouched.
CREATE TABLE IF NOT EXISTS "BookingSequence" (
  "businessId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL,
  CONSTRAINT "BookingSequence_pkey" PRIMARY KEY ("businessId", "month"),
  CONSTRAINT "BookingSequence_businessId_fkey" FOREIGN KEY ("businessId")
    REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION bookeasy_assign_booking_sequence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  local_created_at TIMESTAMP;
  booking_month TEXT;
  month_start_utc TIMESTAMP;
  month_end_utc TIMESTAMP;
  allocated INTEGER;
BEGIN
  -- Prisma stores DateTime as a UTC timestamp without a time zone.
  local_created_at := (NEW."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Bucharest';
  booking_month := to_char(local_created_at, 'YYYY-MM');

  -- Existing counters take a single locked row update. Historical bookings
  -- only need to be scanned for the first booking in a business/month.
  UPDATE "BookingSequence"
    SET "lastNumber" = "lastNumber" + 1
    WHERE "businessId" = NEW."businessId" AND "month" = booking_month
    RETURNING "lastNumber" INTO allocated;

  IF FOUND THEN
    NEW."sequenceNumber" := allocated;
    RETURN NEW;
  END IF;

  month_start_utc := (date_trunc('month', local_created_at) AT TIME ZONE 'Europe/Bucharest') AT TIME ZONE 'UTC';
  month_end_utc := ((date_trunc('month', local_created_at) + INTERVAL '1 month') AT TIME ZONE 'Europe/Bucharest') AT TIME ZONE 'UTC';

  INSERT INTO "BookingSequence" ("businessId", "month", "lastNumber")
  VALUES (
    NEW."businessId",
    booking_month,
    (SELECT GREATEST(COALESCE(MAX("sequenceNumber"), 0), COUNT(*)::INTEGER) + 1
      FROM "Booking"
      WHERE "businessId" = NEW."businessId"
        AND "createdAt" >= month_start_utc AND "createdAt" < month_end_utc)
  )
  ON CONFLICT ("businessId", "month") DO UPDATE
    SET "lastNumber" = "BookingSequence"."lastNumber" + 1
  RETURNING "lastNumber" INTO allocated;

  NEW."sequenceNumber" := allocated;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'bookeasy_assign_booking_sequence'
      AND tgrelid = '"Booking"'::regclass
  ) THEN
    CREATE TRIGGER bookeasy_assign_booking_sequence
      BEFORE INSERT ON "Booking"
      FOR EACH ROW EXECUTE FUNCTION bookeasy_assign_booking_sequence();
  END IF;
END;
$$;

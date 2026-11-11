-- Keep accepted historical terms readable while allowing the current two-month offer.
ALTER TABLE "LaunchEnrollment" DROP CONSTRAINT IF EXISTS "LaunchEnrollment_terms_check";
ALTER TABLE "LaunchEnrollment" ADD CONSTRAINT "LaunchEnrollment_terms_check" CHECK (
 ("freeMonths"=2 AND "promoMonths"=0 AND "promoMinor"=0 AND "regularMinor"=5500)
 OR ("freeMonths"=1 AND "promoMonths"=2 AND "promoMinor"=2800 AND "regularMinor"=5500)
);

-- Align only active launch enrollments still within the new free window and with no
-- charge, invoice or payment history. Preserve the original activation anniversary.
WITH eligible AS (
 SELECT e.id, e."businessId"
 FROM "LaunchEnrollment" e JOIN "Business" b ON b.id=e."businessId"
 WHERE e."campaignId"='bookeasy-launch-2026' AND e."cancelledAt" IS NULL
 AND (e."freeMonths"<>2 OR e."promoMonths"<>0 OR e."promoMinor"<>0)
 AND (e."activatedAt" IS NULL OR e."activatedAt" + interval '2 months' > CURRENT_TIMESTAMP)
 AND COALESCE(b."billingAmount",0)=0
 AND b."billingInvoiceUrl" IS NULL AND b."billingInvoiceExternalId" IS NULL
 AND NOT EXISTS (SELECT 1 FROM "LaunchBillingPeriod" p WHERE p."enrollmentId"=e.id
   AND (p."amountMinor">0 OR p."invoiceUrl" IS NOT NULL OR p."invoiceExternalId" IS NOT NULL))
), aligned AS (
 UPDATE "LaunchEnrollment" e SET "freeMonths"=2,"promoMonths"=0,"promoMinor"=0,"regularMinor"=5500,
 "freeEndsAt"=e."activatedAt" + interval '2 months',
 "promoEndsAt"=e."activatedAt" + interval '2 months',
 "nextSyncAt"=CASE WHEN e."activatedAt" IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END
 FROM eligible WHERE e.id=eligible.id RETURNING e."businessId"
)
UPDATE "Business" b SET "planName"='Lansare · Gratuit',"billingStatus"='GRATUIT',
 "billingAmount"=0,"billingSubtotal"=0,"billingDueAt"=NULL,"billingDueNotifiedAt"=NULL
 FROM aligned WHERE b.id=aligned."businessId";

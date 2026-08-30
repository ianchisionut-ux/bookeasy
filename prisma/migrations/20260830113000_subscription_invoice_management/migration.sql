ALTER TABLE "Business"
ADD COLUMN "billingAmount" DECIMAL(10,2),
ADD COLUMN "billingCurrency" TEXT NOT NULL DEFAULT 'RON',
ADD COLUMN "billingDueAt" TIMESTAMP(3),
ADD COLUMN "billingInvoiceUrl" TEXT,
ADD COLUMN "billingInvoiceName" TEXT,
ADD COLUMN "billingInvoiceUploadedAt" TIMESTAMP(3),
ADD COLUMN "billingDueNotifiedAt" TIMESTAMP(3),
ADD COLUMN "billingSuspendedAt" TIMESTAMP(3);

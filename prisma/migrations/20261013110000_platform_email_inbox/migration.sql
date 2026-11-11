CREATE TABLE IF NOT EXISTS "PlatformEmail" (
  "id" TEXT NOT NULL,
  "providerEmailId" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "direction" TEXT NOT NULL,
  "folder" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddresses" JSONB NOT NULL,
  "replyTo" TEXT,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL DEFAULT '',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "threadKey" TEXT,
  "receivedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEmail_providerEmailId_key" ON "PlatformEmail"("providerEmailId");
CREATE INDEX IF NOT EXISTS "PlatformEmail_folder_receivedAt_idx" ON "PlatformEmail"("folder", "receivedAt");
CREATE INDEX IF NOT EXISTS "PlatformEmail_folder_sentAt_idx" ON "PlatformEmail"("folder", "sentAt");

CREATE TABLE IF NOT EXISTS "PlatformEmailAttachment" (
  "id" TEXT NOT NULL,
  "emailId" TEXT NOT NULL,
  "providerAttachmentId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER,
  "storageKey" TEXT,
  CONSTRAINT "PlatformEmailAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEmailAttachment_emailId_providerAttachmentId_key" ON "PlatformEmailAttachment"("emailId", "providerAttachmentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformEmailAttachment_emailId_fkey') THEN
    ALTER TABLE "PlatformEmailAttachment" ADD CONSTRAINT "PlatformEmailAttachment_emailId_fkey"
      FOREIGN KEY ("emailId") REFERENCES "PlatformEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

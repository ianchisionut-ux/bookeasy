ALTER TABLE "PlatformEmail" ADD COLUMN IF NOT EXISTS "bodyHtml" TEXT;
ALTER TABLE "PlatformEmailAttachment" ADD COLUMN IF NOT EXISTS "contentId" TEXT;

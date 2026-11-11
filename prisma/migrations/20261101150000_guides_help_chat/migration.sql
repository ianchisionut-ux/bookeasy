CREATE TABLE IF NOT EXISTS "UsageTutorial" (
 "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
 "videoUrl" TEXT NOT NULL, "captionsUrl" TEXT, "posterUrl" TEXT, "duration" TEXT NOT NULL DEFAULT '',
 "published" BOOLEAN NOT NULL DEFAULT false, "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "GuideSeen" (
 "businessId" TEXT PRIMARY KEY REFERENCES "Business"("id") ON DELETE CASCADE,
 "seenAt" TIMESTAMPTZ(3) NOT NULL
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SupportTicket' AND column_name='businessUnread') THEN
  ALTER TABLE "SupportTicket" ADD COLUMN "businessUnread" BOOLEAN NOT NULL DEFAULT false;
  UPDATE "SupportTicket" SET "businessUnread"=("reply" IS NOT NULL AND "reply"<>'');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='SupportTicket' AND column_name='adminUnread') THEN
  ALTER TABLE "SupportTicket" ADD COLUMN "adminUnread" BOOLEAN NOT NULL DEFAULT true;
  UPDATE "SupportTicket" SET "adminUnread"=("status"='NEW');
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS "SupportChatMessage" (
 "id" TEXT PRIMARY KEY, "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
 "sender" TEXT NOT NULL CHECK ("sender" IN ('BUSINESS','ADMIN')), "text" TEXT NOT NULL,
 "requestId" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("ticketId", "requestId")
);
CREATE INDEX IF NOT EXISTS "SupportChatMessage_ticketId_createdAt_idx" ON "SupportChatMessage"("ticketId", "createdAt");
INSERT INTO "UsageTutorial" ("id","title","description","videoUrl","captionsUrl","posterUrl","duration","published") VALUES
 ('blocare-calendar','Cum blochezi intervale în calendar','Calendar și disponibilitate','/tutorials/blocare-calendar.mp4','/tutorials/blocare-calendar.ro.vtt','/tutorials/blocare-calendar.jpg','0:30',true),
 ('integrari','Conectarea Facebook, Instagram și Google','Configurarea integrărilor','/tutorials/integrari.mp4','/tutorials/integrari.ro.vtt','/tutorials/integrari.jpg','1:32',true),
 ('buton-facebook','Adaugă linkul de rezervare pe Facebook','Pagina publică și rețelele sociale','/tutorials/buton-facebook.mp4','/tutorials/buton-facebook.ro.vtt','/tutorials/buton-facebook.jpg','0:40',true)
 ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SupportChatMessage" ("id","ticketId","sender","text","requestId","createdAt")
 SELECT 'legacy-question-'||t."id", t."id", 'BUSINESS', t."message", 'legacy-question', t."createdAt" FROM "SupportTicket" t WHERE NOT EXISTS (SELECT 1 FROM "SupportChatMessage" m WHERE m."ticketId"=t."id")
 ON CONFLICT ("ticketId","requestId") DO NOTHING;
INSERT INTO "SupportChatMessage" ("id","ticketId","sender","text","requestId","createdAt")
 SELECT 'legacy-answer-'||t."id", t."id", 'ADMIN', t."reply", 'legacy-answer', COALESCE(t."repliedAt",t."createdAt") FROM "SupportTicket" t WHERE t."reply" IS NOT NULL AND t."reply" <> '' AND EXISTS (SELECT 1 FROM "SupportChatMessage" m WHERE m."ticketId"=t."id" AND m."requestId"='legacy-question') AND NOT EXISTS (SELECT 1 FROM "SupportChatMessage" m WHERE m."ticketId"=t."id" AND m."sender"='ADMIN')
 ON CONFLICT ("ticketId","requestId") DO NOTHING;

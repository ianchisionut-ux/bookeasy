-- Conversațiile ajung în inbox numai după o apăsare explicită pe „Operator”.
-- Curățăm marcajele create de vechiul comportament, care escalada automat orice
-- mesaj atunci când botul Messenger/Instagram era oprit.
UPDATE "Conversation" AS conversation
SET
  "needsOperator" = false,
  "operatorRequestedAt" = NULL
WHERE conversation."operatorRequestedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ChatMessage" AS message
    WHERE message."businessId" = conversation."businessId"
      AND message."channel" = conversation."channel"
      AND message."externalUserId" = conversation."externalUserId"
      AND message."direction" = 'IN'
      AND message."text" IN (
        '[a apăsat: Vorbește cu un operator]',
        '[a apăsat: Operator]'
      )
      AND message."createdAt" BETWEEN
        conversation."operatorRequestedAt" - INTERVAL '1 minute'
        AND conversation."operatorRequestedAt" + INTERVAL '1 minute'
  );

-- Durable outbound-email queue (see EmailOutbox in schema.prisma).
--
-- Mail was previously sent inline, inside the request that triggered it: a
-- ~16s SMTP handshake against a serverless timeout loses the message while the
-- user is told to check their inbox. Rows here are the message's durable home
-- until a transport has accepted it, and the scheduler retries what failed.
CREATE TABLE IF NOT EXISTS "EmailOutbox" (
  "id"            TEXT         NOT NULL,
  "to"            TEXT         NOT NULL,
  "template"      TEXT         NOT NULL,
  "params"        JSONB,
  "userId"        TEXT,
  "tenantId"      TEXT,
  "locale"        TEXT,
  "status"        TEXT         NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER      NOT NULL DEFAULT 0,
  "maxAttempts"   INTEGER      NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt"     TIMESTAMP(3),
  "sentAt"        TIMESTAMP(3),
  "transport"     TEXT,
  "lastError"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "EmailOutbox_userId_template_idx" ON "EmailOutbox"("userId", "template");
CREATE INDEX IF NOT EXISTS "EmailOutbox_createdAt_idx" ON "EmailOutbox"("createdAt");

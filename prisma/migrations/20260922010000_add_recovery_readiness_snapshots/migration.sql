-- One day's recovery-readiness verdict per user: the series behind the
-- Security Center's 30-day sparkline and the "your account dropped" alert.
CREATE TABLE "RecoveryReadinessSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "availableCount" INTEGER NOT NULL DEFAULT 0,
    "codesLow" BOOLEAN NOT NULL DEFAULT false,
    "paths" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecoveryReadinessSnapshot_userId_day_key" ON "RecoveryReadinessSnapshot"("userId", "day");

CREATE INDEX "RecoveryReadinessSnapshot_userId_day_idx" ON "RecoveryReadinessSnapshot"("userId", "day");

ALTER TABLE "RecoveryReadinessSnapshot"
    ADD CONSTRAINT "RecoveryReadinessSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

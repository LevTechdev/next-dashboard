-- Account recovery: a single-use, emailed link for a user who lost BOTH the
-- authenticator and every backup recovery code.
--
-- Only the SHA-256 of the token is stored, the row is single-use (usedAt) and
-- time-boxed (expiresAt), and the whole row disappears with the user.

-- CreateTable
CREATE TABLE "AccountRecoveryToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRecoveryToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountRecoveryToken_tokenHash_key" ON "AccountRecoveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountRecoveryToken_userId_idx" ON "AccountRecoveryToken"("userId");

-- AddForeignKey
ALTER TABLE "AccountRecoveryToken" ADD CONSTRAINT "AccountRecoveryToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

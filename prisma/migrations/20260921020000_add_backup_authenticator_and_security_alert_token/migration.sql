-- Two additions that both exist to make losing a phone survivable:
--
--   BackupAuthenticator  — a SECOND enrolled authenticator app, accepted at the
--                          same TOTP step as User.totpSecret. Losing one device
--                          then never escalates to an emailed account recovery.
--   SecurityAlertToken   — single-use token behind the "this wasn't me" link in
--                          the alert email sent when a recovery turns 2FA off.
--                          Only the SHA-256 is stored; the row is single-use
--                          (usedAt) and time-boxed (expiresAt).

-- CreateTable
CREATE TABLE "BackupAuthenticator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupAuthenticator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one backup authenticator per user (a phone + a spare is enough;
-- a third copy of the same factor adds risk without adding recovery value).
CREATE UNIQUE INDEX "BackupAuthenticator_userId_key" ON "BackupAuthenticator"("userId");

-- CreateTable
CREATE TABLE "SecurityAlertToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAlertToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAlertToken_tokenHash_key" ON "SecurityAlertToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SecurityAlertToken_userId_idx" ON "SecurityAlertToken"("userId");

-- The "this wasn't me" revoke closes sign-in until the password is replaced:
-- whoever else was in the account knows the old one, so kicking their sessions
-- out is not enough on its own.
ALTER TABLE "User" ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "BackupAuthenticator" ADD CONSTRAINT "BackupAuthenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlertToken" ADD CONSTRAINT "SecurityAlertToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

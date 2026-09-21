-- RFC 6238 §5.2 replay protection.
--
-- A TOTP code is valid for its whole 30-second time step, so anything that can
-- observe a code (a shoulder, a log, a phishing relay, a compromised proxy) can
-- replay it for the remainder of that step. The RFC's answer is to remember the
-- last time step a verifier accepted and refuse anything at or below it.
--
-- The counter is stored per SECRET, not per user:
--   User.totpLastUsedStep        — the primary authenticator (User.totpSecret)
--   BackupAuthenticator.lastUsedStep — the spare device's own secret
--
-- A shared counter would be wrong: signing in with the spare would otherwise
-- invalidate the primary's next code, and vice versa. Both reset to NULL when
-- the secret they belong to is replaced, since a new secret starts a fresh
-- step sequence.
ALTER TABLE "User" ADD COLUMN "totpLastUsedStep" INTEGER;

ALTER TABLE "BackupAuthenticator" ADD COLUMN "lastUsedStep" INTEGER;

-- Durable "stay signed in" grant, stamped on the refresh-token family.
-- One grant per device: dies with the family (logout / theft revocation /
-- password change) and never outlives a refresh token that could use it.
ALTER TABLE "RefreshToken" ADD COLUMN "stayLoginUntil" TIMESTAMP(3);

-- The sentinel asks "does this family hold a live grant?" on mount and before
-- any sign-out; keep that lookup cheap.
CREATE INDEX "RefreshToken_familyId_stayLoginUntil_idx" ON "RefreshToken"("familyId", "stayLoginUntil");

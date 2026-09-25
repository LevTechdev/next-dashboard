-- Self-serve plan changes need to know WHICH rate a subscription is billed at:
-- Plan.price (monthly) or Plan.yearlyPrice (yearly). Existing rows were all
-- created through the monthly checkout path, so MONTHLY is the correct backfill.
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'MONTHLY';

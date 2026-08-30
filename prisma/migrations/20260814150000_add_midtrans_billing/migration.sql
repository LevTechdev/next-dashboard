-- Add local (Midtrans) payment support to subscriptions.
-- gateway defaults to "stripe" so existing rows keep their current provider;
-- midtransOrderId tracks the Snap transaction for a pending/paid local payment.
ALTER TABLE "Subscription" ADD COLUMN "gateway" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "Subscription" ADD COLUMN "midtransOrderId" TEXT;

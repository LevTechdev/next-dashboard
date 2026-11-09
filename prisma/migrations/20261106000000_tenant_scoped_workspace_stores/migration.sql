-- Tenant scoping for the operational stores that previously wrote data/*.json.
-- Columns stay nullable so legacy singleton rows survive; every store query
-- filters on tenantId and every new write includes it.

ALTER TABLE "QrisLedgerBalance" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "QrisTransaction" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "QrisDisbursement" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "InventorySnapshot" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Beneficiary" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WebhookDlqEntry" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WebhookDlqEntry" ADD COLUMN "transient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatChannel" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ChatAlertRule" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ChatDeliveryLog" ADD COLUMN "tenantId" TEXT;

-- Uniqueness moves from global to per-workspace.
DROP INDEX IF EXISTS "Beneficiary_accountNumber_key";
DROP INDEX IF EXISTS "InventorySnapshot_date_key";
DROP INDEX IF EXISTS "PurchaseOrder_poNumber_key";

CREATE UNIQUE INDEX "Beneficiary_tenantId_accountNumber_key" ON "Beneficiary"("tenantId", "accountNumber");
CREATE UNIQUE INDEX "InventorySnapshot_tenantId_date_key" ON "InventorySnapshot"("tenantId", "date");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder"("tenantId", "poNumber");
CREATE UNIQUE INDEX "QrisLedgerBalance_tenantId_key" ON "QrisLedgerBalance"("tenantId");
CREATE UNIQUE INDEX "ChatAlertRule_tenantId_key" ON "ChatAlertRule"("tenantId");

CREATE INDEX "QrisLedgerBalance_tenantId_idx" ON "QrisLedgerBalance"("tenantId");
CREATE INDEX "QrisTransaction_tenantId_idx" ON "QrisTransaction"("tenantId");
CREATE INDEX "QrisDisbursement_tenantId_idx" ON "QrisDisbursement"("tenantId");
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");
CREATE INDEX "InventorySnapshot_tenantId_idx" ON "InventorySnapshot"("tenantId");
CREATE INDEX "Beneficiary_tenantId_idx" ON "Beneficiary"("tenantId");
CREATE INDEX "WebhookDlqEntry_tenantId_status_idx" ON "WebhookDlqEntry"("tenantId", "status");
CREATE INDEX "ChatChannel_tenantId_idx" ON "ChatChannel"("tenantId");
CREATE INDEX "ChatDeliveryLog_tenantId_createdAt_idx" ON "ChatDeliveryLog"("tenantId", "createdAt");

CREATE TABLE "ReportSchedule" (
  "tenantId" TEXT NOT NULL,
  "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
  "recipients" TEXT[],
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "lastSentAt" TIMESTAMP(3),
  "timeOfDay" TEXT NOT NULL DEFAULT '08:00',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("tenantId")
);

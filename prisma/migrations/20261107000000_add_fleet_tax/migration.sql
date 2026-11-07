-- Database-backed logistics fleet and tax-nexus data. Every row is scoped to
-- a workspace; the old static arrays lived in src/lib and were shared globally.

CREATE TABLE "FleetShipment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "carrierLogoKey" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "destinationCity" TEXT NOT NULL,
  "destinationCountry" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
  "progressPct" INTEGER NOT NULL DEFAULT 0,
  "modality" TEXT NOT NULL,
  "distanceKm" INTEGER NOT NULL DEFAULT 0,
  "co2Grams" INTEGER NOT NULL DEFAULT 0,
  "isCarbonNeutral" BOOLEAN NOT NULL DEFAULT false,
  "estimatedDelivery" TIMESTAMP(3) NOT NULL,
  "deliveredAt" TIMESTAMP(3),
  "exceptionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FleetShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FleetWaypoint" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "location" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "FleetWaypoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxJurisdiction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "flag" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "thresholdAmount" DOUBLE PRECISION NOT NULL,
  "currentAmount" DOUBLE PRECISION NOT NULL,
  "thresholdTransactions" INTEGER,
  "currentTransactions" INTEGER,
  "standardTaxRate" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SAFE',
  "hasRegistration" BOOLEAN NOT NULL DEFAULT false,
  "registrationNumber" TEXT,
  "daysRemainingToFiling" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxJurisdiction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxFiling" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "quarter" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "grossRevenue" DOUBLE PRECISION NOT NULL,
  "taxCollected" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "jurisdictionCount" INTEGER NOT NULL,
  "filingDeadline" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxFiling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FleetShipment_tenantId_trackingNumber_key" ON "FleetShipment"("tenantId", "trackingNumber");
CREATE INDEX "FleetShipment_tenantId_status_idx" ON "FleetShipment"("tenantId", "status");
CREATE INDEX "FleetShipment_tenantId_createdAt_idx" ON "FleetShipment"("tenantId", "createdAt");
CREATE INDEX "FleetWaypoint_shipmentId_sortOrder_idx" ON "FleetWaypoint"("shipmentId", "sortOrder");
CREATE UNIQUE INDEX "TaxJurisdiction_tenantId_key_key" ON "TaxJurisdiction"("tenantId", "key");
CREATE INDEX "TaxJurisdiction_tenantId_status_idx" ON "TaxJurisdiction"("tenantId", "status");
CREATE UNIQUE INDEX "TaxFiling_tenantId_quarter_key" ON "TaxFiling"("tenantId", "quarter");
CREATE INDEX "TaxFiling_tenantId_status_idx" ON "TaxFiling"("tenantId", "status");

ALTER TABLE "FleetShipment" ADD CONSTRAINT "FleetShipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FleetWaypoint" ADD CONSTRAINT "FleetWaypoint_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "FleetShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxJurisdiction" ADD CONSTRAINT "TaxJurisdiction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

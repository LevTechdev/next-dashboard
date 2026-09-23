-- Daily mid-market FX rate snapshots (see schema.prisma FxRateSnapshot).
CREATE TABLE "FxRateSnapshot" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "prevRate" DECIMAL(18,6),
    "movePct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRateSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FxRateSnapshot_base_quote_day_key" ON "FxRateSnapshot"("base", "quote", "day");
CREATE INDEX "FxRateSnapshot_base_quote_day_idx" ON "FxRateSnapshot"("base", "quote", "day");

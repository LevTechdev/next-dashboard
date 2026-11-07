import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getFleetTelemetrySummary,
  type FleetShipment,
  type ShipmentWaypoint,
} from "@/lib/logistics-fleet";
import type { QuarterlyFiling, TaxJurisdiction } from "@/lib/tax-nexus";

type ShipmentRow = Prisma.FleetShipmentGetPayload<{ include: { waypoints: true } }>;
type JurisdictionRow = Prisma.TaxJurisdictionGetPayload<Record<string, never>>;
type FilingRow = Prisma.TaxFilingGetPayload<Record<string, never>>;

export type FleetExceptionAction = "RESCHEDULE" | "REROUTE_LOCKER" | "SEND_ALERT";

function mapWaypoint(row: ShipmentRow["waypoints"][number]): ShipmentWaypoint {
  return {
    location: row.location,
    timestamp: row.timestamp,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    completed: row.completed,
  };
}

function mapShipment(row: ShipmentRow): FleetShipment {
  return {
    id: row.id,
    trackingNumber: row.trackingNumber,
    orderNumber: row.orderNumber,
    carrier: row.carrier as FleetShipment["carrier"],
    carrierLogoKey: row.carrierLogoKey,
    recipientName: row.recipientName,
    destinationCity: row.destinationCity,
    destinationCountry: row.destinationCountry,
    status: row.status as FleetShipment["status"],
    progressPct: row.progressPct,
    modality: row.modality as FleetShipment["modality"],
    distanceKm: row.distanceKm,
    co2Grams: row.co2Grams,
    isCarbonNeutral: row.isCarbonNeutral,
    estimatedDelivery: row.estimatedDelivery.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    ...(row.exceptionReason ? { exceptionReason: row.exceptionReason } : {}),
    waypoints: row.waypoints.map(mapWaypoint),
  };
}

export async function getFleetOverview(tenantId: string) {
  const rows = await prisma.fleetShipment.findMany({
    where: { tenantId },
    include: { waypoints: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const shipments = rows.map(mapShipment);

  return {
    summary: getFleetTelemetrySummary(shipments),
    shipments,
  };
}

export async function resolveFleetException(
  tenantId: string,
  shipmentId: string,
  action: FleetExceptionAction,
): Promise<FleetShipment | null> {
  const existing = await prisma.fleetShipment.findFirst({
    where: { id: shipmentId, tenantId },
    include: { waypoints: { orderBy: { sortOrder: "asc" } } },
  });
  if (!existing) return null;

  const lastWaypoint = existing.waypoints.at(-1);
  const resolvesException = action !== "SEND_ALERT";
  const updated = await prisma.fleetShipment.update({
    where: { id: existing.id },
    data: {
      ...(resolvesException
        ? {
            status: "IN_TRANSIT",
            exceptionReason: null,
            progressPct: Math.max(existing.progressPct, 55),
          }
        : {}),
      waypoints: {
        create: {
          sortOrder: existing.waypoints.length,
          location: lastWaypoint?.location ?? "Carrier hub",
          timestamp: "Just now",
          status: `Exception action dispatched: ${action.replaceAll("_", " ").toLowerCase()}`,
          lat: lastWaypoint?.lat ?? 0,
          lng: lastWaypoint?.lng ?? 0,
          completed: true,
        },
      },
    },
    include: { waypoints: { orderBy: { sortOrder: "asc" } } },
  });

  return mapShipment(updated);
}

function mapJurisdiction(row: JurisdictionRow): TaxJurisdiction {
  return {
    id: row.id,
    region: row.region,
    name: row.name,
    flag: row.flag,
    currency: row.currency,
    thresholdAmount: row.thresholdAmount,
    currentAmount: row.currentAmount,
    ...(row.thresholdTransactions === null
      ? {}
      : { thresholdTransactions: row.thresholdTransactions }),
    ...(row.currentTransactions === null ? {} : { currentTransactions: row.currentTransactions }),
    standardTaxRate: row.standardTaxRate,
    status: row.status as TaxJurisdiction["status"],
    hasRegistration: row.hasRegistration,
    ...(row.registrationNumber === null ? {} : { registrationNumber: row.registrationNumber }),
    ...(row.daysRemainingToFiling === null
      ? {}
      : { daysRemainingToFiling: row.daysRemainingToFiling }),
  };
}

function mapFiling(row: FilingRow): QuarterlyFiling {
  return {
    quarter: row.quarter,
    period: row.period,
    grossRevenue: row.grossRevenue,
    taxCollected: row.taxCollected,
    currency: row.currency,
    jurisdictionCount: row.jurisdictionCount,
    filingDeadline: row.filingDeadline,
    status: row.status as QuarterlyFiling["status"],
  };
}

export async function getTaxOverview(tenantId: string) {
  const [jurisdictions, latestFiling] = await Promise.all([
    prisma.taxJurisdiction.findMany({
      where: { tenantId },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    }),
    prisma.taxFiling.findFirst({
      where: { tenantId },
      orderBy: { quarter: "desc" },
    }),
  ]);
  const mapped = jurisdictions.map(mapJurisdiction);

  return {
    summary: {
      activeNexusCount: mapped.filter((j) => j.status === "NEXUS_REACHED").length,
      approachingCount: mapped.filter((j) => j.status === "APPROACHING").length,
      totalJurisdictionsMonitored: mapped.length,
      estimatedQuarterlyLiabilityUsd: latestFiling?.taxCollected ?? 0,
    },
    jurisdictions: mapped,
  };
}

export async function getTaxFilings(tenantId: string): Promise<QuarterlyFiling[]> {
  const rows = await prisma.taxFiling.findMany({
    where: { tenantId },
    orderBy: { quarter: "desc" },
  });
  return rows.map(mapFiling);
}

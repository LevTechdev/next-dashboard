/**
 * Fleet shipment types and telemetry aggregation. Data is loaded from Prisma
 * by the API; this module stays side-effect free and client-safe.
 */

export type DeliveryStatus =
  "READY_FOR_PICKUP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION";

export type CarrierName =
  | "DHL Express"
  | "FedEx Logistics"
  | "J&T Express"
  | "SiCepat Cargo"
  | "Pos Indonesia"
  | "GoSend Instant";

export type TransportModality = "AIR_FREIGHT" | "DIESEL_VAN" | "EV_FLEET" | "SCOOTER_COURIER";

export interface ShipmentWaypoint {
  location: string;
  timestamp: string;
  status: string;
  lat: number;
  lng: number;
  completed: boolean;
}

export interface FleetShipment {
  id: string;
  trackingNumber: string;
  orderNumber: string;
  carrier: CarrierName;
  carrierLogoKey: string;
  recipientName: string;
  destinationCity: string;
  destinationCountry: string;
  status: DeliveryStatus;
  progressPct: number;
  modality: TransportModality;
  distanceKm: number;
  co2Grams: number;
  isCarbonNeutral: boolean;
  estimatedDelivery: string;
  deliveredAt?: string | null;
  createdAt?: string;
  exceptionReason?: string;
  waypoints: ShipmentWaypoint[];
}

export interface FleetTelemetrySummary {
  activeShipmentsCount: number;
  inTransitCount: number;
  outForDeliveryCount: number;
  deliveredTodayCount: number;
  exceptionsCount: number;
  fleetEfficiencyScore: number; // 0-100
  totalCo2SavedKg: number;
  avgDeliveryHours: number;
}

export function getFleetTelemetrySummary(shipments: FleetShipment[]): FleetTelemetrySummary {
  const activeCount = shipments.filter((s) => s.status !== "DELIVERED").length;
  const inTransitCount = shipments.filter((s) => s.status === "IN_TRANSIT").length;
  const outForDeliveryCount = shipments.filter((s) => s.status === "OUT_FOR_DELIVERY").length;
  const deliveredTodayCount = shipments.filter((s) => s.status === "DELIVERED").length;
  const exceptionsCount = shipments.filter((s) => s.status === "EXCEPTION").length;
  const neutralCount = shipments.filter((s) => s.isCarbonNeutral).length;

  const totalCo2SavedKg = Number(
    shipments.reduce((acc, s) => acc + (s.isCarbonNeutral ? s.co2Grams / 1000 : 0), 0).toFixed(1),
  );

  const deliveryDurations = shipments
    .filter((s) => s.deliveredAt && s.createdAt)
    .map(
      (s) =>
        (new Date(s.deliveredAt as string).getTime() - new Date(s.createdAt as string).getTime()) /
        3_600_000,
    )
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  const avgDeliveryHours = deliveryDurations.length
    ? Number(
        (
          deliveryDurations.reduce((sum, hours) => sum + hours, 0) / deliveryDurations.length
        ).toFixed(1),
      )
    : 0;

  const healthyShare = shipments.length
    ? (shipments.length - exceptionsCount) / shipments.length
    : 1;
  const neutralShare = shipments.length ? neutralCount / shipments.length : 1;

  return {
    activeShipmentsCount: activeCount,
    inTransitCount,
    outForDeliveryCount,
    deliveredTodayCount,
    exceptionsCount,
    fleetEfficiencyScore: Math.round((healthyShare * 0.7 + neutralShare * 0.3) * 100),
    totalCo2SavedKg,
    avgDeliveryHours,
  };
}

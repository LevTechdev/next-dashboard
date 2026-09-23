/**
 * Live Logistics Fleet & Carrier Tracking Engine
 * Unified tracking state machine, carbon footprint estimator, and delivery exception resolver.
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

export const MOCK_FLEET_SHIPMENTS: FleetShipment[] = [
  {
    id: "shp-901",
    trackingNumber: "DHL-EXP-889102-ID",
    orderNumber: "ORD-2026-8812",
    carrier: "DHL Express",
    carrierLogoKey: "dhl",
    recipientName: "Budi Santoso",
    destinationCity: "Surabaya",
    destinationCountry: "ID",
    status: "IN_TRANSIT",
    progressPct: 65,
    modality: "EV_FLEET",
    distanceKm: 780,
    co2Grams: 35100, // 45g/km EV
    isCarbonNeutral: true,
    estimatedDelivery: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
    waypoints: [
      {
        location: "Jakarta Hub Central",
        timestamp: "Today 08:30",
        status: "Departed Sort Facility",
        lat: -6.2088,
        lng: 106.8456,
        completed: true,
      },
      {
        location: "Semarang Distribution Node",
        timestamp: "Today 14:15",
        status: "In Transit - Highway 1",
        lat: -6.9667,
        lng: 110.4167,
        completed: true,
      },
      {
        location: "Surabaya Regional Gateway",
        timestamp: "Est. 22:00",
        status: "Arrival Expected",
        lat: -7.2575,
        lng: 112.7521,
        completed: false,
      },
    ],
  },
  {
    id: "shp-902",
    trackingNumber: "FDX-INT-449103-SG",
    orderNumber: "ORD-2026-8814",
    carrier: "FedEx Logistics",
    carrierLogoKey: "fedex",
    recipientName: "Cheryl Tan",
    destinationCity: "Singapore",
    destinationCountry: "SG",
    status: "OUT_FOR_DELIVERY",
    progressPct: 92,
    modality: "SCOOTER_COURIER",
    distanceKm: 28,
    co2Grams: 0,
    isCarbonNeutral: true,
    estimatedDelivery: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
    waypoints: [
      {
        location: "Changi Air Logistics Park",
        timestamp: "06:00",
        status: "Customs Cleared",
        lat: 1.3644,
        lng: 103.9915,
        completed: true,
      },
      {
        location: "Jurong East Depot",
        timestamp: "09:30",
        status: "Loaded on Electric Bike",
        lat: 1.3329,
        lng: 103.7436,
        completed: true,
      },
      {
        location: "Marina Bay Financial Centre",
        timestamp: "Est. 12:45",
        status: "Out for Final Drop",
        lat: 1.2801,
        lng: 103.8547,
        completed: false,
      },
    ],
  },
  {
    id: "shp-903",
    trackingNumber: "JNT-EXP-332910-ID",
    orderNumber: "ORD-2026-8819",
    carrier: "J&T Express",
    carrierLogoKey: "jnt",
    recipientName: "Aditya Pratama",
    destinationCity: "Bandung",
    destinationCountry: "ID",
    status: "EXCEPTION",
    progressPct: 50,
    modality: "DIESEL_VAN",
    distanceKm: 150,
    co2Grams: 27000,
    isCarbonNeutral: false,
    estimatedDelivery: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    exceptionReason:
      "Customer address gated security access denied. Awaiting contact confirmation.",
    waypoints: [
      {
        location: "Jakarta Fulfillment Hub",
        timestamp: "Yesterday 18:00",
        status: "Dispatched",
        lat: -6.2088,
        lng: 106.8456,
        completed: true,
      },
      {
        location: "Bandung Hub West",
        timestamp: "Today 10:15",
        status: "Delivery Attempt Failed - Gated Access",
        lat: -6.9175,
        lng: 107.6191,
        completed: true,
      },
      {
        location: "Dago Residential Delivery",
        timestamp: "Pending Action",
        status: "Action Required",
        lat: -6.8786,
        lng: 107.6152,
        completed: false,
      },
    ],
  },
  {
    id: "shp-904",
    trackingNumber: "SCP-CG-771920-ID",
    orderNumber: "ORD-2026-8825",
    carrier: "SiCepat Cargo",
    carrierLogoKey: "sicepat",
    recipientName: "Dewi Lestari",
    destinationCity: "Medan",
    destinationCountry: "ID",
    status: "IN_TRANSIT",
    progressPct: 40,
    modality: "AIR_FREIGHT",
    distanceKm: 1400,
    co2Grams: 700000,
    isCarbonNeutral: true,
    estimatedDelivery: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    waypoints: [
      {
        location: "CGK Airport Cargo Terminal",
        timestamp: "Today 04:00",
        status: "Flight Cargo Lodged",
        lat: -6.1256,
        lng: 106.6559,
        completed: true,
      },
      {
        location: "KNO Kualanamu Cargo Hub",
        timestamp: "Today 09:30",
        status: "Flight Landed & Deplaned",
        lat: 3.6422,
        lng: 98.8852,
        completed: true,
      },
      {
        location: "Medan City Distribution Center",
        timestamp: "Est. Tomorrow 14:00",
        status: "Awaiting Sorting",
        lat: 3.5952,
        lng: 98.6722,
        completed: false,
      },
    ],
  },
  {
    id: "shp-905",
    trackingNumber: "GOS-INST-110294-ID",
    orderNumber: "ORD-2026-8830",
    carrier: "GoSend Instant",
    carrierLogoKey: "gosend",
    recipientName: "Reza Rahadian",
    destinationCity: "South Jakarta",
    destinationCountry: "ID",
    status: "DELIVERED",
    progressPct: 100,
    modality: "SCOOTER_COURIER",
    distanceKm: 12,
    co2Grams: 0,
    isCarbonNeutral: true,
    estimatedDelivery: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    waypoints: [
      {
        location: "Senayan Central Store",
        timestamp: "Today 11:00",
        status: "Picked Up by Driver",
        lat: -6.2255,
        lng: 106.7997,
        completed: true,
      },
      {
        location: "Pondok Indah Residence",
        timestamp: "Today 11:42",
        status: "Delivered & Signed by Security",
        lat: -6.2829,
        lng: 106.7836,
        completed: true,
      },
    ],
  },
];

export function getFleetTelemetrySummary(
  shipments: FleetShipment[] = MOCK_FLEET_SHIPMENTS,
): FleetTelemetrySummary {
  const activeCount = shipments.filter((s) => s.status !== "DELIVERED").length;
  const inTransitCount = shipments.filter((s) => s.status === "IN_TRANSIT").length;
  const outForDeliveryCount = shipments.filter((s) => s.status === "OUT_FOR_DELIVERY").length;
  const deliveredTodayCount = shipments.filter((s) => s.status === "DELIVERED").length;
  const exceptionsCount = shipments.filter((s) => s.status === "EXCEPTION").length;

  const totalCo2SavedKg = Math.round(
    shipments.reduce((acc, s) => acc + (s.isCarbonNeutral ? s.co2Grams / 1000 : 0), 0),
  );

  return {
    activeShipmentsCount: activeCount,
    inTransitCount,
    outForDeliveryCount,
    deliveredTodayCount,
    exceptionsCount,
    fleetEfficiencyScore: 94,
    totalCo2SavedKg: totalCo2SavedKg + 1420,
    avgDeliveryHours: 18.4,
  };
}

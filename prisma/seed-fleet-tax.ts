import { prisma } from "../src/lib/db";
import type { FleetShipment, ShipmentWaypoint } from "../src/lib/logistics-fleet";
import type { QuarterlyFiling, TaxJurisdiction } from "../src/lib/tax-nexus";

type FleetSeed = Omit<
  FleetShipment,
  "id" | "estimatedDelivery" | "waypoints" | "deliveredAt" | "createdAt"
> & {
  estimatedInHours: number;
  deliveredHoursAgo?: number;
  createdHoursAgo: number;
  waypoints: ShipmentWaypoint[];
};

type JurisdictionSeed = Omit<TaxJurisdiction, "id"> & { key: string };
type FilingSeed = QuarterlyFiling;

const FLEET_SEED: FleetSeed[] = [
  {
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
    co2Grams: 35_100,
    isCarbonNeutral: true,
    createdHoursAgo: 19,
    estimatedInHours: 14,
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
    createdHoursAgo: 8,
    estimatedInHours: 2,
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
    co2Grams: 27_000,
    isCarbonNeutral: false,
    createdHoursAgo: 22,
    estimatedInHours: 24,
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
    co2Grams: 700_000,
    isCarbonNeutral: true,
    createdHoursAgo: 30,
    estimatedInHours: 36,
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
    createdHoursAgo: 19,
    deliveredHoursAgo: 1,
    estimatedInHours: -1,
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

const JURISDICTIONS: JurisdictionSeed[] = [
  {
    key: "us-ca",
    region: "North America",
    name: "California, US",
    flag: "🇺🇸",
    currency: "USD",
    thresholdAmount: 500_000,
    currentAmount: 462_000,
    thresholdTransactions: 200,
    currentTransactions: 184,
    standardTaxRate: 7.25,
    status: "APPROACHING",
    hasRegistration: true,
    registrationNumber: "CA-CDTFA-8891024",
    daysRemainingToFiling: 18,
  },
  {
    key: "us-ny",
    region: "North America",
    name: "New York, US",
    flag: "🇺🇸",
    currency: "USD",
    thresholdAmount: 500_000,
    currentAmount: 518_000,
    thresholdTransactions: 100,
    currentTransactions: 122,
    standardTaxRate: 8.875,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "NY-DTF-4401923",
    daysRemainingToFiling: 8,
  },
  {
    key: "eu-oss",
    region: "European Union",
    name: "EU One-Stop Shop (OSS)",
    flag: "🇪🇺",
    currency: "EUR",
    thresholdAmount: 10_000,
    currentAmount: 84_500,
    standardTaxRate: 20,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "EU-OSS-DE3391029",
    daysRemainingToFiling: 22,
  },
  {
    key: "gb-vat",
    region: "United Kingdom",
    name: "United Kingdom HMRC",
    flag: "🇬🇧",
    currency: "GBP",
    thresholdAmount: 85_000,
    currentAmount: 64_200,
    standardTaxRate: 20,
    status: "APPROACHING",
    hasRegistration: true,
    registrationNumber: "GB-VAT-9921045",
    daysRemainingToFiling: 34,
  },
  {
    key: "id-ppn",
    region: "Southeast Asia",
    name: "Indonesia (PPN 11%)",
    flag: "🇮🇩",
    currency: "IDR",
    thresholdAmount: 600_000_000,
    currentAmount: 845_000_000,
    standardTaxRate: 11,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "NPWP 01.482.910.4-021.000",
    daysRemainingToFiling: 14,
  },
  {
    key: "sg-gst",
    region: "Southeast Asia",
    name: "Singapore (GST 9% OVR)",
    flag: "🇸🇬",
    currency: "SGD",
    thresholdAmount: 100_000,
    currentAmount: 48_000,
    standardTaxRate: 9,
    status: "SAFE",
    hasRegistration: false,
    daysRemainingToFiling: 45,
  },
  {
    key: "jp-jct",
    region: "East Asia",
    name: "Japan (JCT 10%)",
    flag: "🇯🇵",
    currency: "JPY",
    thresholdAmount: 10_000_000,
    currentAmount: 12_400_000,
    standardTaxRate: 10,
    status: "NEXUS_REACHED",
    hasRegistration: true,
    registrationNumber: "T1010001029345",
    daysRemainingToFiling: 26,
  },
];

const FILINGS: FilingSeed[] = [
  {
    quarter: "Q3 2026",
    period: "Jul 1 - Sep 30, 2026",
    grossRevenue: 842_500,
    taxCollected: 89_400,
    currency: "USD",
    jurisdictionCount: 5,
    filingDeadline: "Oct 31, 2026",
    status: "READY_TO_FILE",
  },
  {
    quarter: "Q2 2026",
    period: "Apr 1 - Jun 30, 2026",
    grossRevenue: 720_000,
    taxCollected: 76_200,
    currency: "USD",
    jurisdictionCount: 4,
    filingDeadline: "Jul 31, 2026",
    status: "REMITTED",
  },
  {
    quarter: "Q1 2026",
    period: "Jan 1 - Mar 31, 2026",
    grossRevenue: 640_000,
    taxCollected: 68_100,
    currency: "USD",
    jurisdictionCount: 4,
    filingDeadline: "Apr 30, 2026",
    status: "REMITTED",
  },
];

/** Replace the workspace's fleet and tax fixtures with fresh demo rows. */
export async function seedFleetTax(tenantId: string): Promise<void> {
  await prisma.fleetShipment.deleteMany({ where: { tenantId } });
  await prisma.taxJurisdiction.deleteMany({ where: { tenantId } });
  await prisma.taxFiling.deleteMany({ where: { tenantId } });

  const now = Date.now();
  const hoursFromNow = (hours: number) => new Date(now + hours * 60 * 60 * 1000);

  for (const seed of FLEET_SEED) {
    const { estimatedInHours, deliveredHoursAgo, createdHoursAgo, waypoints, ...shipment } = seed;
    await prisma.fleetShipment.create({
      data: {
        ...shipment,
        tenantId,
        estimatedDelivery: hoursFromNow(estimatedInHours),
        deliveredAt: deliveredHoursAgo === undefined ? null : hoursFromNow(-deliveredHoursAgo),
        createdAt: hoursFromNow(-createdHoursAgo),
        waypoints: {
          create: waypoints.map((waypoint, index) => ({
            ...waypoint,
            sortOrder: index,
          })),
        },
      },
    });
  }

  await prisma.taxJurisdiction.createMany({
    data: JURISDICTIONS.map((jurisdiction) => ({ ...jurisdiction, tenantId })),
  });
  await prisma.taxFiling.createMany({
    data: FILINGS.map((filing) => ({ ...filing, tenantId })),
  });
}

// Local/manual seeding helper: `npx tsx --tsconfig scripts/tsconfig.e2e.json prisma/seed-fleet-tax.ts`
if (process.argv[1]?.includes("seed-fleet-tax")) {
  prisma.tenant
    .findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, slug: true } })
    .then(async (tenant) => {
      if (!tenant) throw new Error("No workspace found; run npm run db:seed first.");
      await seedFleetTax(tenant.id);
      console.log(`Fleet and tax fixtures seeded for ${tenant.slug}.`);
    })
    .finally(() => prisma.$disconnect());
}

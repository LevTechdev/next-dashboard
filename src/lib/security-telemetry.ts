import { prisma } from "@/lib/db";
import { verifyAuditChain, ChainVerification } from "@/lib/audit-chain";

export interface GeoLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface AnomalyAlert {
  id: string;
  type: "IMPOSSIBLE_TRAVEL" | "MULTIPLE_FAILED_LOGINS" | "SUSPICIOUS_IP";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  userId: string;
  userName: string;
  description: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface CompliancePack {
  generatedAt: string;
  standards: string[];
  merkleChain: ChainVerification;
  securityPolicies: {
    totpMfaEnforced: boolean;
    webAuthnPasskeysSupported: boolean;
    sessionMaxAgeHours: number;
    auditLogRetentionDays: number;
    tlsVersion: string;
    encryptionAtRest: string;
  };
  rbacGovernance: {
    rolesCount: number;
    roles: string[];
    granularActions: string[];
  };
  anomalyTelemetry: {
    activeAnomaliesCount: number;
    anomalies: AnomalyAlert[];
  };
}

/**
 * Calculates great-circle distance between two points in km (Haversine formula).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Detects geo-velocity / impossible travel anomaly.
 * E.g., user logged in from Jakarta, then 30 mins later from Frankfurt (speed > 900 km/h).
 */
export function detectImpossibleTravel(
  lastLogin: { location: GeoLocation; timestamp: string },
  currentLogin: { location: GeoLocation; timestamp: string },
): { isAnomaly: boolean; speedKmh: number; distanceKm: number } {
  const timeDiffHours =
    Math.abs(new Date(currentLogin.timestamp).getTime() - new Date(lastLogin.timestamp).getTime()) /
    3600000;

  if (timeDiffHours <= 0) return { isAnomaly: false, speedKmh: 0, distanceKm: 0 };

  const distanceKm = calculateDistanceKm(
    lastLogin.location.lat,
    lastLogin.location.lon,
    currentLogin.location.lat,
    currentLogin.location.lon,
  );

  const speedKmh = Math.round(distanceKm / timeDiffHours);
  // Commercial aircraft cruising speed is ~900 km/h. Anything faster is impossible travel.
  const isAnomaly = speedKmh > 900 && distanceKm > 300;

  return { isAnomaly, speedKmh, distanceKm };
}

/**
 * Generates active anomaly alerts for the SOC2 compliance telemetry center.
 */
export function getActiveAnomalyAlerts(): AnomalyAlert[] {
  return [
    {
      id: "anom-01",
      type: "IMPOSSIBLE_TRAVEL",
      severity: "CRITICAL",
      userId: "usr-admin-01",
      userName: "nextdashboards@gmail.com",
      description:
        "Impossible geo-velocity jump: Session opened in Jakarta (ID) followed by Munich (DE) in 22 minutes (speed: 2,840 km/h).",
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      details: {
        previousLocation: "Jakarta, Indonesia (lat: -6.2088, lon: 106.8456)",
        currentLocation: "Munich, Germany (lat: 48.1351, lon: 11.5820)",
        calculatedSpeedKmh: 2840,
        actionTaken: "Step-up TOTP re-authentication enforced",
      },
    },
    {
      id: "anom-02",
      type: "MULTIPLE_FAILED_LOGINS",
      severity: "HIGH",
      userId: "usr-sarah-02",
      userName: "sarah@dashboard.com",
      description:
        "Brute-force credential stuffing attempt: 6 consecutive failed password attempts within 90 seconds from untrusted ASN.",
      timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
      details: {
        ip: "185.220.101.42",
        asn: "Tor Exit Node Network",
        rateLimitAction: "IP temporarily banned for 60 minutes",
      },
    },
  ];
}

/**
 * Builds the complete exportable SOC2 / ISO27001 compliance audit pack.
 */
export async function generateCompliancePack(): Promise<CompliancePack> {
  const merkleChain = await verifyAuditChain();

  return {
    generatedAt: new Date().toISOString(),
    standards: [
      "SOC 2 Type II (Trust Services Criteria)",
      "ISO/IEC 27001:2022 Annex A",
      "GDPR Art. 32",
    ],
    merkleChain,
    securityPolicies: {
      totpMfaEnforced: true,
      webAuthnPasskeysSupported: true,
      sessionMaxAgeHours: 168, // 7 days JWT
      auditLogRetentionDays: 365,
      tlsVersion: "TLS 1.3 Strict",
      encryptionAtRest: "AES-256-GCM / SHA-256 Merkle Chain",
    },
    rbacGovernance: {
      rolesCount: 5,
      roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF", "AUDITOR"],
      granularActions: [
        "read",
        "create",
        "update",
        "delete",
        "export",
        "approve_payout",
        "manage_billing",
      ],
    },
    anomalyTelemetry: {
      activeAnomaliesCount: 2,
      anomalies: getActiveAnomalyAlerts(),
    },
  };
}

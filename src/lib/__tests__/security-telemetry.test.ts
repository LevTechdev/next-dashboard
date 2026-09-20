import { describe, it, expect, vi } from "vitest";
import {
  calculateDistanceKm,
  detectImpossibleTravel,
  getActiveAnomalyAlerts,
  generateCompliancePack,
} from "@/lib/security-telemetry";
import { canPerformGranularAction } from "@/lib/permissions";

vi.mock("@/lib/audit-chain", () => ({
  verifyAuditChain: vi.fn().mockResolvedValue({
    ok: true,
    total: 120,
    verified: 120,
    firstBreakSeq: null,
    breaks: [],
  }),
}));

describe("Security Telemetry & Compliance Engine", () => {
  it("calculates great-circle distance accurately", () => {
    // Jakarta to Singapore: ~900 km
    const distance = calculateDistanceKm(-6.2088, 106.8456, 1.3521, 103.8198);
    expect(distance).toBeGreaterThan(800);
    expect(distance).toBeLessThan(1000);
  });

  it("detects impossible travel anomalies based on geo-velocity", () => {
    const lastLogin = {
      location: { city: "Jakarta", country: "ID", lat: -6.2088, lon: 106.8456 },
      timestamp: new Date("2026-09-07T10:00:00Z").toISOString(),
    };
    // 30 minutes later in Frankfurt: distance > 11,000 km -> speed > 22,000 km/h
    const currentLogin = {
      location: { city: "Frankfurt", country: "DE", lat: 50.1109, lon: 8.6821 },
      timestamp: new Date("2026-09-07T10:30:00Z").toISOString(),
    };

    const result = detectImpossibleTravel(lastLogin, currentLogin);
    expect(result.isAnomaly).toBe(true);
    expect(result.speedKmh).toBeGreaterThan(10000);

    // Normal commute: Jakarta to Bogor (50km in 1 hour -> 50 km/h)
    const normalLogin = {
      location: { city: "Bogor", country: "ID", lat: -6.5971, lon: 106.806 },
      timestamp: new Date("2026-09-07T11:00:00Z").toISOString(),
    };
    const normalResult = detectImpossibleTravel(lastLogin, normalLogin);
    expect(normalResult.isAnomaly).toBe(false);
  });

  it("generates structured SOC2 / ISO27001 compliance pack", async () => {
    const pack = await generateCompliancePack();
    expect(pack.standards.length).toBeGreaterThan(0);
    expect(pack.merkleChain.ok).toBe(true);
    expect(pack.rbacGovernance.rolesCount).toBe(5);
    expect(pack.securityPolicies.tlsVersion).toBe("TLS 1.3 Strict");
  });

  it("governs granular RBAC actions across all roles", () => {
    expect(canPerformGranularAction("ADMIN", "manage_billing")).toBe(true);
    expect(canPerformGranularAction("ADMIN", "approve_payout")).toBe(true);
    expect(canPerformGranularAction("STAFF", "approve_payout")).toBe(false);
    expect(canPerformGranularAction("AUDITOR", "export")).toBe(true);
    expect(canPerformGranularAction("AUDITOR", "update")).toBe(false);
  });
});

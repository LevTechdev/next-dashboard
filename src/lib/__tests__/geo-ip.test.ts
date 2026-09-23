import { describe, expect, it } from "vitest";

/**
 * geo-ip.ts — precise sign-in geography unit tests.
 *
 * The parts worth pinning are the pure ones: the offset-derived WIB/WITA/WIT
 * mapping (derived from the IANA zone's own UTC offset, not hardcoded region
 * lists) and the single-zone timestamp format the security email now shows
 * ("14:05 WIB" — one zone, never the three-zone listing).
 */
import { formatSingleZoneTime, indonesianZoneLabel } from "@/lib/geo-ip";

describe("indonesianZoneLabel", () => {
  it("maps the three Indonesian offsets to their civil labels", () => {
    expect(indonesianZoneLabel("Asia/Jakarta")).toBe("WIB"); // UTC+7
    expect(indonesianZoneLabel("Asia/Makassar")).toBe("WITA"); // UTC+8
    expect(indonesianZoneLabel("Asia/Jayapura")).toBe("WIT"); // UTC+9
  });

  it("derives the label from the offset, not the region name", () => {
    // A zone that is UTC+7 but not in Indonesia still maps to WIB — the rule
    // is the offset, so new province splits need no code change.
    expect(indonesianZoneLabel("Asia/Bangkok")).toBe("WIB"); // UTC+7
    expect(indonesianZoneLabel("Asia/Singapore")).toBe("WITA"); // UTC+8
    expect(indonesianZoneLabel("Asia/Tokyo")).toBe("WIT"); // UTC+9
  });

  it("rejects zones outside the UTC+7..+9 band and invalid ids", () => {
    expect(indonesianZoneLabel("Asia/Kolkata")).toBeNull(); // UTC+5:30
    expect(indonesianZoneLabel("Europe/London")).toBeNull();
    expect(indonesianZoneLabel("Not/AZone")).toBeNull();
    expect(indonesianZoneLabel("UTC")).toBeNull();
  });
});

describe("formatSingleZoneTime", () => {
  // A fixed instant: 2026-09-15 14:05 UTC+7 (WIB).
  const instant = new Date("2026-09-15T07:05:00.000Z");

  it("renders exactly one zone stamp — 'HH:mm LABEL'", () => {
    expect(formatSingleZoneTime(instant, "WIB")).toBe("14:05 WIB");
    expect(formatSingleZoneTime(instant, "WITA")).toBe("15:05 WITA");
    expect(formatSingleZoneTime(instant, "WIT")).toBe("16:05 WIT");
  });

  it("never emits the three-zone dot-joined listing", () => {
    const text = formatSingleZoneTime(instant, "WIB");
    expect(text).not.toMatch(/·/);
    expect(text.match(/WIB|WITA|WIT/g)).toHaveLength(1);
  });
});

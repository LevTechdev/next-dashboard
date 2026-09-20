import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * device-recognition.ts — the new-sign-in alert gate.
 *
 * The alert fires only when the sign-in's device profile (OS + browser pair)
 * or IP is absent from the user's 90-day session history; the pure WIB/WITA/
 * WIT formatter is pinned here too.
 */

const prismaMock = vi.hoisted(() => ({
  session: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("server-only", () => ({}));

import { recognizeSessionContext, RECOGNITION_WINDOW_DAYS } from "@/lib/device-recognition";
import { formatIndonesianTimestamps, formatJakartaTime } from "@/lib/wib-time";

function req(
  ip: string,
  ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
): Request {
  return new Request("http://localhost:3010/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "user-agent": ua },
  });
}

describe("recognizeSessionContext", () => {
  beforeEach(() => {
    prismaMock.session.findFirst.mockReset();
  });

  it("is silent when both device and IP are already known", async () => {
    prismaMock.session.findFirst.mockImplementation(({ where }) => {
      const ipKnown = "ip" in where;
      return ipKnown ? Promise.resolve({ id: "s1" }) : Promise.resolve({ id: "s2" });
    });
    const res = await recognizeSessionContext("u1", {
      ip: "36.72.10.5",
      browser: "Chrome",
      device: "Windows",
    });
    expect(res).toEqual({ shouldAlert: false, outcome: "known" });
  });

  it("alerts on a brand-new device even from a known IP", async () => {
    prismaMock.session.findFirst.mockImplementation(({ where }) =>
      "ip" in where ? Promise.resolve({ id: "s1" }) : Promise.resolve(null),
    );
    const res = await recognizeSessionContext("u1", {
      ip: "36.72.10.5",
      browser: "Firefox",
      device: "Linux",
    });
    expect(res).toEqual({ shouldAlert: true, outcome: "new_device" });
  });

  it("alerts on a known device from a new IP", async () => {
    prismaMock.session.findFirst.mockImplementation(({ where }) =>
      "ip" in where ? Promise.resolve(null) : Promise.resolve({ id: "s3" }),
    );
    const res = await recognizeSessionContext("u1", {
      ip: "10.99.99.99",
      browser: "Chrome",
      device: "Windows",
    });
    expect(res).toEqual({ shouldAlert: true, outcome: "new_ip" });
  });

  it("alerts when neither device nor IP are known", async () => {
    prismaMock.session.findFirst.mockResolvedValue(null);
    const res = await recognizeSessionContext("u1", {
      ip: "10.99.99.99",
      browser: "Safari",
      device: "iOS",
    });
    expect(res).toEqual({ shouldAlert: true, outcome: "new_device_and_ip" });
  });

  it("only looks inside the recognition window", async () => {
    prismaMock.session.findFirst.mockResolvedValue(null);
    await recognizeSessionContext("u1", { ip: "1.2.3.4", browser: "Chrome", device: "macOS" });
    const where = prismaMock.session.findFirst.mock.calls[0][0].where;
    expect(where.createdAt.gte.getTime()).toBeGreaterThan(
      Date.now() - (RECOGNITION_WINDOW_DAYS + 1) * 86_400_000,
    );
    expect(where.createdAt.gte.getTime()).toBeLessThanOrEqual(
      Date.now() - (RECOGNITION_WINDOW_DAYS - 1) * 86_400_000,
    );
  });
});

describe("formatIndonesianTimestamps", () => {
  // 2026-09-15 06:30 UTC → 13:30 WIB / 14:30 WITA / 15:30 WIT
  const instant = new Date("2026-09-15T06:30:00Z");

  it("renders all three Indonesian zones around the same instant", () => {
    const text = formatIndonesianTimestamps(instant);
    expect(text).toContain("15/09/2026");
    expect(text).toContain("13:30 WIB");
    expect(text).toContain("14:30 WITA");
    expect(text).toContain("15:30 WIT");
    expect(text.split("·").length).toBe(3);
  });

  it("renders compact single-zone Jakarta time", () => {
    expect(formatJakartaTime(instant)).toMatch(/15 Sep(t)?,? 13:30/);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * trusted-devices.ts — the 30-day "skip 2FA on this device" store.
 *
 * A trust cookie is honored only when the row is un-revoked, un-expired, and
 * the current device+browser profile matches the row (a stolen cookie is
 * useless on any other machine). IP is deliberately not matched — laptops
 * move between networks — and the new-sign-in alert covers the stolen-
 * cookie-at-a-new-location case independently.
 */

const prismaMock = vi.hoisted(() => ({
  trustedDevice: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("server-only", () => ({}));

import {
  findTrustedDevice,
  issueTrustToken,
  revokeTrustedDevice,
  revokeAllTrustedDevices,
  listTrustedDevices,
  readTrustCookie,
  TRUST_TTL_DAYS,
} from "@/lib/trusted-devices";

const UA_WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
const UA_MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15";

function req(ip: string, ua = UA_WINDOWS_CHROME): Request {
  return new Request("http://localhost:3010/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "user-agent": ua },
  });
}

const FUTURE = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 1000);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev1",
    userId: "u1",
    device: "Windows",
    browser: "Chrome",
    label: "Windows · Chrome",
    expiresAt: FUTURE,
    revokedAt: null,
    ...overrides,
  };
}

describe("trusted devices", () => {
  beforeEach(() => {
    for (const fn of Object.values(prismaMock.trustedDevice)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  });

  it("issueTrustToken stores a hashed token with the parsed device profile", async () => {
    prismaMock.trustedDevice.create.mockResolvedValue({});
    const { token, expiresAt, label } = await issueTrustToken("u1", req("203.0.113.9"));

    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(label).toBe("Windows · Chrome");
    const created = prismaMock.trustedDevice.create.mock.calls[0][0];
    expect(created.data.userId).toBe("u1");
    expect(created.data.device).toBe("Windows");
    expect(created.data.browser).toBe("Chrome");
    expect(created.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.data.tokenHash).not.toContain(token);
    expect(created.data.ipHash).toMatch(/^[a-f0-9]{64}$/);
    // ~30 days out (±5s of assertion time).
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(TRUST_TTL_DAYS * 86_400_000 - 5_000);
  });

  it("findTrustedDevice honors a matching, live row and touches lastUsedAt", async () => {
    prismaMock.trustedDevice.findUnique.mockResolvedValue(row());
    prismaMock.trustedDevice.update.mockResolvedValue({});

    const token = "tok";
    const r = req("203.0.113.9");
    Object.defineProperty(r, "headers", {
      value: new Headers({
        "x-forwarded-for": "203.0.113.9",
        "user-agent": UA_WINDOWS_CHROME,
        cookie: `trusted_device=${token}`,
      }),
    });

    const decision = await findTrustedDevice(r, "u1");
    expect(decision?.device.id).toBe("dev1");
    expect(prismaMock.trustedDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dev1" } }),
    );
  });

  it("rejects a cookie whose device profile no longer matches", async () => {
    prismaMock.trustedDevice.findUnique.mockResolvedValue(row());
    const r = req("203.0.113.9", UA_MAC_SAFARI); // same cookie, other machine
    Object.defineProperty(r, "headers", {
      value: new Headers({
        "x-forwarded-for": "203.0.113.9",
        "user-agent": UA_MAC_SAFARI,
        cookie: "trusted_device=tok",
      }),
    });

    expect(await findTrustedDevice(r, "u1")).toBeNull();
  });

  it("rejects rows of another user, revoked rows, and expired rows", async () => {
    const r = req("203.0.113.9");
    Object.defineProperty(r, "headers", {
      value: new Headers({ cookie: "trusted_device=tok", "user-agent": UA_WINDOWS_CHROME }),
    });

    prismaMock.trustedDevice.findUnique.mockResolvedValue(row({ userId: "someone-else" }));
    expect(await findTrustedDevice(r, "u1")).toBeNull();

    prismaMock.trustedDevice.findUnique.mockResolvedValue(row({ revokedAt: PAST }));
    expect(await findTrustedDevice(r, "u1")).toBeNull();

    prismaMock.trustedDevice.findUnique.mockResolvedValue(row({ expiresAt: PAST }));
    expect(await findTrustedDevice(r, "u1")).toBeNull();
  });

  it("readTrustCookie parses the cookie the issuer sets", () => {
    const r = req("203.0.113.9");
    Object.defineProperty(r, "headers", {
      value: new Headers({
        cookie: "token=abc; trusted_device=hello%20world; other=1",
      }),
    });
    expect(readTrustCookie(r)).toBe("hello world");
  });

  it("revoke helpers scope strictly to the owning user", async () => {
    prismaMock.trustedDevice.updateMany.mockResolvedValue({ count: 1 });
    expect(await revokeTrustedDevice("dev1", "u1")).toBe(true);
    expect(prismaMock.trustedDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "dev1", userId: "u1" }) }),
    );

    prismaMock.trustedDevice.updateMany.mockResolvedValue({ count: 3 });
    expect(await revokeAllTrustedDevices("u1")).toBe(3);

    prismaMock.trustedDevice.updateMany.mockResolvedValue({ count: 0 });
    expect(await revokeTrustedDevice("devX", "u1")).toBe(false);
  });

  it("listTrustedDevices only returns live rows for the user", async () => {
    prismaMock.trustedDevice.findMany.mockResolvedValue([]);
    await listTrustedDevices("u1");
    expect(prismaMock.trustedDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u1", revokedAt: null }),
      }),
    );
  });
});

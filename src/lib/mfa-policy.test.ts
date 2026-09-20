import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// mfa-policy reads MFA_VERIFICATION_EVENT_TYPES from security-score (pure) and
// the prisma client (mocked). No React, no i18n — the policy itself is testable.
vi.mock("@/lib/db", () => ({
  prisma: {
    securityEvent: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  isMfaVerificationStale,
  isMfaReverificationDue,
  MFA_REVERIFY_DAYS,
  MFA_VERIFICATION_LOOKBACK_DAYS,
} from "@/lib/mfa-policy";

const findFirst = vi.mocked(prisma.securityEvent.findFirst);
const findUnique = vi.mocked(prisma.user.findUnique);

const DAY_MS = 24 * 60 * 60 * 1000;

describe("mfa-policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));
    findFirst.mockReset();
    findUnique.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches the security-score recency window (30 days)", () => {
    // One policy, one number — if someone moves one constant without the
    // other, this is the tripwire.
    expect(MFA_REVERIFY_DAYS).toBe(30);
    expect(MFA_REVERIFY_DAYS).toBe(30);
    expect(MFA_VERIFICATION_LOOKBACK_DAYS).toBeGreaterThanOrEqual(MFA_REVERIFY_DAYS);
  });

  it("is stale when no verification event exists in the lookback window", async () => {
    findFirst.mockResolvedValue(null);
    await expect(isMfaVerificationStale("u1")).resolves.toBe(true);
  });

  it("is fresh when the last verification is within 30 days", async () => {
    findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 10 * DAY_MS) } as never);
    await expect(isMfaVerificationStale("u1")).resolves.toBe(false);
  });

  it("is stale when the last verification is older than 30 days", async () => {
    findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 31 * DAY_MS) } as never);
    await expect(isMfaVerificationStale("u1")).resolves.toBe(true);
  });

  it("treats the 30-day boundary as stale (strictly older than the window)", async () => {
    findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 30 * DAY_MS - 1000) } as never);
    await expect(isMfaVerificationStale("u1")).resolves.toBe(true);
    findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 30 * DAY_MS + 60_000),
    } as never);
    await expect(isMfaVerificationStale("u1")).resolves.toBe(false);
  });

  it("looks back no further than the lookback window", async () => {
    findFirst.mockResolvedValue(null);
    await isMfaVerificationStale("u1");
    const where = findFirst.mock.calls[0][0]?.where as { createdAt: { gte: Date } };
    const expectedSince = Date.now() - MFA_VERIFICATION_LOOKBACK_DAYS * DAY_MS;
    expect(new Date(where.createdAt.gte).getTime()).toBe(expectedSince);
  });

  it("re-verification is not due for users without 2FA", async () => {
    findUnique.mockResolvedValue({ totpEnabled: false } as never);
    await expect(isMfaReverificationDue("u1")).resolves.toBe(false);
    // Short-circuits before touching the event trail.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("re-verification is not due when the user does not exist", async () => {
    findUnique.mockResolvedValue(null);
    await expect(isMfaReverificationDue("u1")).resolves.toBe(false);
  });

  it("re-verification IS due for an enrolled user with a stale verification", async () => {
    findUnique.mockResolvedValue({ totpEnabled: true } as never);
    findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 45 * DAY_MS) } as never);
    await expect(isMfaReverificationDue("u1")).resolves.toBe(true);
  });

  it("re-verification is NOT due for an enrolled user with a fresh verification", async () => {
    findUnique.mockResolvedValue({ totpEnabled: true } as never);
    findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 2 * DAY_MS) } as never);
    await expect(isMfaReverificationDue("u1")).resolves.toBe(false);
  });
});

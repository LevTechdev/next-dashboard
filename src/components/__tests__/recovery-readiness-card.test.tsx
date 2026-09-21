import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { RecoveryReadinessCard } from "@/components/security/recovery-readiness-card";
import type { SecurityData } from "@/components/security/use-security-data";

/**
 * Recovery readiness.
 *
 * The panel exists to answer the question the other cards only imply: whether
 * the account survives its owner losing a device. Two failure modes matter more
 * than the happy path — claiming safety while data is still loading, and
 * handing over a checklist instead of one action.
 */
function renderCard(over: Partial<SecurityData> = {}, loading = false) {
  const data = {
    totpEnabled: true,
    backupAuthenticator: { enrolled: false, label: null, createdAt: null, lastUsedAt: null },
    backupRemaining: 10,
    passkeys: [],
    sessions: [],
    events: [],
    trustedDevices: [],
    emailVerified: "2026-09-01T00:00:00.000Z",
    mfaVerifiedRecently: true,
    mfaLastVerifiedAt: null,
    mfaDaysSince: 0,
    loading,
    refresh: vi.fn(),
    ...over,
  } as unknown as SecurityData;
  return render(<RecoveryReadinessCard data={data} />);
}

const pathState = (id: string) =>
  screen.getByTestId(`recovery-path-${id}`).getAttribute("data-state");

describe("RecoveryReadinessCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says Covered once a spare is enrolled, and asks for nothing", () => {
    renderCard({
      backupAuthenticator: { enrolled: true, label: "iPad", createdAt: null, lastUsedAt: null },
    });

    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Covered");
    expect(screen.getByTestId("recovery-summary")).toHaveTextContent(
      /the spare signs you in normally/i,
    );
    // The whole point of a spare: no downgrade, so nothing to fix.
    expect(screen.getByTestId("recovery-no-action")).toBeInTheDocument();
    expect(screen.queryByTestId("recovery-next-action")).not.toBeInTheDocument();
  });

  it("calls a weaker-but-real route Fragile and names the spare as the fix", () => {
    renderCard();

    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Fragile");
    expect(screen.getByTestId("recovery-next-detail")).toHaveTextContent(
      /never turns two-factor authentication off/i,
    );
    expect(screen.getByTestId("recovery-next-action")).toHaveTextContent("Add spare device");
  });

  it("escalates to Locked out when nothing at all works", () => {
    renderCard({ backupRemaining: 0, emailVerified: null });

    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Locked out");
    expect(screen.getByTestId("recovery-summary")).toHaveTextContent(
      /no way back into this account/i,
    );
    // With no verified email, even the last-resort recovery cannot reach them.
    expect(screen.getByTestId("recovery-next-action")).toHaveTextContent("Verify email");
    expect(pathState("email")).toBe("missing");
  });

  it("sends a locked-out account with a verified email to the spare device", () => {
    renderCard({ backupRemaining: 0, passkeys: [] });
    // The inbox still works, so it is fragile rather than locked out.
    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Fragile");
    expect(screen.getByTestId("recovery-next-action")).toHaveTextContent("Add spare device");
  });

  it("points at two-factor itself when it is off", () => {
    renderCard({ totpEnabled: false });

    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Not protected");
    expect(screen.getByTestId("recovery-next-action")).toHaveTextContent("Set up 2FA");
    // Being "locked out" of an account with no second factor is meaningless.
    expect(screen.queryByTestId("recovery-codes-low")).not.toBeInTheDocument();
  });

  it("claims nothing while the data is still arriving", () => {
    // Mirrors the real hook's initial state: totpEnabled is null until the
    // profile fetch lands. A protected account must not be told it is locked
    // out for the half second before that happens.
    renderCard(
      { totpEnabled: null, backupRemaining: null, backupAuthenticator: null, passkeys: [] },
      true,
    );

    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Checking");
    expect(screen.queryByTestId("recovery-next-action")).not.toBeInTheDocument();
    expect(pathState("recoveryCodes")).toBe("unknown");
    expect(pathState("spareAuthenticator")).toBe("unknown");
  });

  it("reports each path's real state so the verdict can be audited", () => {
    renderCard({
      backupAuthenticator: { enrolled: true, label: null, createdAt: null, lastUsedAt: null },
      backupRemaining: 4,
      passkeys: [{ id: "p1", deviceName: null, createdAt: "", lastUsedAt: null }],
    });

    for (const id of ["spareAuthenticator", "recoveryCodes", "passkey", "email"]) {
      expect(pathState(id), id).toBe("available");
    }
    // The count is shown, so "Ready" means a number the user can act on.
    expect(screen.getByTestId("recovery-path-recoveryCodes")).toHaveTextContent("4 left");
  });

  it("flags a nearly-spent code set without downgrading the verdict", () => {
    renderCard({
      backupAuthenticator: { enrolled: true, label: null, createdAt: null, lastUsedAt: null },
      backupRemaining: 2,
    });

    expect(screen.getByTestId("recovery-level")).toHaveTextContent("Covered");
    expect(screen.getByTestId("recovery-codes-low")).toHaveTextContent(
      /running low on recovery codes/i,
    );
  });

  it("nudges a covered account whose codes are gone", () => {
    renderCard({
      backupAuthenticator: { enrolled: true, label: null, createdAt: null, lastUsedAt: null },
      backupRemaining: 0,
    });
    expect(screen.getByTestId("recovery-next-action")).toHaveTextContent("Generate codes");
  });
});

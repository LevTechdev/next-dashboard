import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BackupAuthenticatorCard } from "@/components/security/backup-authenticator-card";
import type { SecurityData } from "@/components/security/use-security-data";

/**
 * The spare authenticator.
 *
 * Its whole reason for existing is that losing the phone holding the primary
 * secret should NOT force an account recovery (which turns 2FA off). The card
 * therefore has to be honest about when a spare is useful at all — with 2FA off
 * it guards nothing — and must never imply a spare exists when the status is
 * still unknown.
 *
 * Enrollment state now comes from the shared security payload rather than the
 * card's own fetch, so the Recovery readiness panel and this card can never
 * disagree about whether a spare exists.
 */
type Spare = SecurityData["backupAuthenticator"];

function renderCard(totpEnabled: boolean | null, spare: Spare, over: Partial<SecurityData> = {}) {
  const data = {
    totpEnabled,
    backupAuthenticator: spare,
    refresh: vi.fn(),
    // A well-covered account by default, so only the tests that make the spare
    // the last path back in see the acknowledgement gate.
    backupRemaining: 10,
    passkeys: [],
    loading: false,
    emailVerified: "2026-09-01T00:00:00.000Z",
    ...over,
  } as unknown as SecurityData;
  return render(<BackupAuthenticatorCard data={data} />);
}

const ENROLLED: Spare = {
  enrolled: true,
  label: "office iPad",
  createdAt: "2026-09-01T00:00:00.000Z",
  lastUsedAt: null,
};

describe("BackupAuthenticatorCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for 2FA first when two-factor is off, and offers nothing", () => {
    renderCard(false, null);

    expect(screen.getByTestId("backup-authenticator-card")).toHaveTextContent(
      /Turn on two-factor authentication first/i,
    );
    expect(screen.queryByRole("button", { name: /Add spare device/ })).not.toBeInTheDocument();
  });

  it("offers enrollment when 2FA is on and no spare exists", () => {
    renderCard(true, { enrolled: false, label: null, createdAt: null, lastUsedAt: null });

    expect(screen.getByRole("button", { name: /Add spare device/ })).toBeInTheDocument();
    expect(screen.getByTestId("backup-authenticator-card")).toHaveTextContent(
      /If you lose this phone, the spare still signs you in/i,
    );
  });

  it("shows the enrolled spare, its name, and that it has not been used", () => {
    renderCard(true, {
      enrolled: true,
      label: "office iPad",
      createdAt: "2026-09-01T00:00:00.000Z",
      lastUsedAt: null,
    });

    expect(screen.getByText("office iPad")).toBeInTheDocument();
    expect(screen.getByText(/not used for a sign-in yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove spare device/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add spare device/ })).not.toBeInTheDocument();
  });

  it("falls back to a generic name and shows a used-at label once it has signed someone in", () => {
    const used = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    renderCard(true, { enrolled: true, label: null, createdAt: used, lastUsedAt: used });

    expect(screen.getByText("Spare device")).toBeInTheDocument();
    // timeAgo() renders a compact age — the point is that it is shown at all.
    expect(screen.getByText(/Last used 3d ago/i)).toBeInTheDocument();
  });

  it("waits for the status before deciding, rather than flashing the wrong state", () => {
    // totpEnabled is null until the profile fetch lands, and the card must not
    // offer an enrollment it may have to retract (or hide one that exists).
    renderCard(null, null);
    expect(screen.getByTestId("backup-authenticator-card")).toHaveTextContent(
      /Turn on two-factor authentication first/i,
    );
  });

  it("does not claim a spare exists when the shared status is still unknown", () => {
    // 2FA is on but the spare status has not arrived: offering the add flow is
    // honest (the server upserts), inventing an enrolled device is not.
    renderCard(true, null);
    expect(screen.queryByRole("button", { name: /Remove spare device/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/not used for a sign-in yet/i)).not.toBeInTheDocument();
  });

  /**
   * Removing the spare is the one action that can turn "I might lose access"
   * into "I have lost access". When nothing else can get the owner back in, the
   * dialog has to say so and the confirm button has to wait for an ack.
   */
  describe("acknowledgement gate", () => {
    const openRemove = async () => {
      await userEvent.click(screen.getByRole("button", { name: /Remove spare device/ }));
      return screen.getByRole("button", { name: /^Remove spare device$/ });
    };

    it("warns and blocks when the spare is the last way back in", async () => {
      renderCard(true, ENROLLED, {
        backupRemaining: 0,
        passkeys: [],
        emailVerified: null,
      });

      await openRemove();

      expect(screen.getByTestId("recovery-guard")).toHaveTextContent(/last way back in/i);
      // The panel's own verdict is quoted, so the warning cannot disagree with
      // the readiness card sitting above it.
      expect(screen.getByTestId("recovery-guard-after")).toHaveTextContent(/Locked out/i);

      const confirm = screen.getByRole("button", { name: /^Remove spare device$/ });
      expect(confirm).toBeDisabled();
      expect(screen.getByTestId("recovery-guard-ack")).not.toBeChecked();
    });

    it("unblocks once the acknowledgement is ticked", async () => {
      renderCard(true, ENROLLED, {
        backupRemaining: 0,
        passkeys: [],
        emailVerified: null,
      });

      await openRemove();
      expect(screen.getByRole("button", { name: /^Remove spare device$/ })).toBeDisabled();

      await userEvent.click(screen.getByTestId("recovery-guard-ack"));

      expect(screen.getByRole("button", { name: /^Remove spare device$/ })).toBeEnabled();
    });

    it("does not lecture a user whose codes still cover them", async () => {
      // Fresh recovery codes in hand: deleting the spare downgrades the ladder
      // from "ready" to "thin", which the readiness panel already reports. An
      // acknowledgement nobody needs is one everybody learns to click through.
      renderCard(true, ENROLLED, { backupRemaining: 8 });

      await openRemove();

      expect(screen.queryByTestId("recovery-guard")).not.toBeInTheDocument();
      expect(screen.queryByTestId("recovery-guard-ack")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Remove spare device$/ })).toBeEnabled();
    });
  });
});

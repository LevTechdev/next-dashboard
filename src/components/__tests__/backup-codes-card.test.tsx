import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Regenerating asks for confirmation through the app-wide provider, which is
// mounted by the dashboard layout rather than by this card.
const confirm = vi.fn().mockResolvedValue(true);
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => confirm }));

import { BackupCodesCard } from "@/components/security/backup-codes-card";
import type { SecurityData } from "@/components/security/use-security-data";
import { BACKUP_CODE_LOW_THRESHOLD } from "@/lib/backup-code-status";

/**
 * The Backup Codes card is the last line of defense before a user loses the
 * account: with the codes gone AND the authenticator lost, there is no way
 * back in. These tests pin the three postures — placeholder, low, exhausted —
 * so the warning can't be quietly dropped.
 *
 * `data` is a live SecurityData payload; only the two fields the card reads
 * are supplied here.
 */
function renderCard(backupRemaining: number | null) {
  const data = { backupRemaining, refresh: vi.fn() } as unknown as SecurityData;
  return render(<BackupCodesCard data={data} />);
}

describe("BackupCodesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the plain count with no warning while codes are healthy", () => {
    renderCard(10);
    expect(screen.getByText("10 unused code(s) remaining")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("No recovery codes left")).not.toBeInTheDocument();
  });

  it("warns once the set drops into the low band", () => {
    renderCard(BACKUP_CODE_LOW_THRESHOLD);
    const warning = screen.getByRole("status");
    expect(warning).toHaveTextContent(`Only ${BACKUP_CODE_LOW_THRESHOLD} recovery code(s) left`);
    // The nudge is actionable: it says WHY, not just that the number is small.
    expect(warning).toHaveTextContent(/losing your authenticator locks you out/i);
    // With codes still on hand the button stays "Regenerate".
    expect(screen.getByRole("button", { name: /Regenerate/ })).toBeInTheDocument();
  });

  it("escalates to a hard warning when there are no codes", () => {
    renderCard(0);
    // Zero covers two real states — never generated, and all consumed — so the
    // copy must not claim the codes "were used".
    expect(screen.getByRole("status")).toHaveTextContent("You have no backup recovery codes");
    expect(screen.getByRole("status")).toHaveTextContent(
      /losing your authenticator locks you out/i,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(/every code has been used/i);
    // Nothing to regenerate → the primary action is generating a fresh set.
    expect(screen.getByRole("button", { name: /Generate codes/ })).toBeInTheDocument();
  });

  it("renders a placeholder — not a warning — while the count is loading", () => {
    renderCard(null);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
  });
});

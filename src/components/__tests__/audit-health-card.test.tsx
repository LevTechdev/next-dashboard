import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { AuditHealthCard } from "@/components/admin/audit-health-card";

/**
 * Audit-health card (admin panel).
 *
 * The card is the human surface for the CI gate in scripts/check-audit-chain.ts
 * plus the Phase-2 mail outbox. These tests pin the three things a platform
 * admin acts on:
 *   1. a broken chain or broken attribution turns the badge red with counts,
 *   2. a full outbox is a warning, a failed outbox is red,
 *   3. the verdicts are also exposed as data-state for tooling.
 */
const HEALTHY = {
  chain: { ok: true, total: 42, verified: 42, firstBreakSeq: null, breaks: [] },
  attribution: { missingTenant: 0, orphanTenant: 0, nullHash: 0 },
  mail: { pending: 0, sending: 0, sent: 12, failed: 0, stuck: 0, oldestPendingAt: null },
  checkedAt: "2026-09-25T10:00:00.000Z",
};

function stubFetch(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => payload })),
  );
}

describe("AuditHealthCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFetch(HEALTHY);
  });

  it("renders a fully healthy report with green badges and counts", async () => {
    render(<AuditHealthCard />);

    await waitFor(() => {
      expect(screen.getAllByText("Healthy")).toHaveLength(3);
    });
    expect(screen.getByTestId("audit-chain-health")).toHaveAttribute("data-state", "ok");
    expect(screen.getByTestId("audit-attribution-health")).toHaveAttribute("data-state", "ok");
    expect(screen.getByTestId("audit-mail-health")).toHaveAttribute("data-state", "ok");
    expect(screen.getByText("42/42")).toBeInTheDocument();
  });

  it("turns attribution red when events are missing a tenant", async () => {
    stubFetch({
      ...HEALTHY,
      attribution: { missingTenant: 3, orphanTenant: 0, nullHash: 0 },
    });
    render(<AuditHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-attribution-health")).toHaveAttribute("data-state", "bad");
    });
    // The count is visible so the admin knows the blast radius.
    expect(screen.getByTestId("audit-attribution-health")).toHaveTextContent("3");
    // Chain and mail are untouched — red is specific, not contagious.
    expect(screen.getByTestId("audit-chain-health")).toHaveAttribute("data-state", "ok");
  });

  it("marks a queued-but-unsent outbox as Backlog and a failed one as red", async () => {
    stubFetch({
      ...HEALTHY,
      mail: { pending: 4, sending: 0, sent: 12, failed: 0, stuck: 0, oldestPendingAt: null },
    });
    const { unmount } = render(<AuditHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-mail-health")).toHaveAttribute("data-state", "warn");
    });
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    unmount();

    stubFetch({
      ...HEALTHY,
      mail: { pending: 0, sending: 0, sent: 12, failed: 2, stuck: 2, oldestPendingAt: null },
    });
    render(<AuditHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-mail-health")).toHaveAttribute("data-state", "bad");
    });
    expect(screen.getByText("Attention")).toBeInTheDocument();
  });

  it("surfaces the first break seq when the chain is broken", async () => {
    stubFetch({
      ...HEALTHY,
      chain: {
        ok: false,
        total: 42,
        verified: 40,
        firstBreakSeq: 17,
        breaks: [{ seq: 17, id: "evt", reason: "prevHash mismatch" }],
      },
    });
    render(<AuditHealthCard />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-chain-health")).toHaveAttribute("data-state", "bad");
    });
    expect(screen.getByText(/first break at event #17/i)).toBeInTheDocument();
    expect(screen.getByText("40/42")).toBeInTheDocument();
  });
});

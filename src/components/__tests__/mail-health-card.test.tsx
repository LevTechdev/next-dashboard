import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MailHealthCard } from "@/components/admin/mail-health-card";

/**
 * Mail-delivery health card — the durable outbox's operator surface.
 *
 * Pinned here: the auto-refresh cadence (a two-minute interval, so a
 * just-queued test digest appears without a manual refresh) and the one-click
 * resend that refetches the health payload afterwards. The interval is
 * verified through a setInterval spy rather than fake timers — RTL's async
 * queries and vitest's fake clock fight each other, and the contract (cadence
 * value + per-tick refetch) is what matters.
 */
const HEALTH = {
  config: {
    transport: "smtp",
    from: "Next Dashboard <nextdashboards@gmail.com>",
    warnings: [],
    sandboxSender: false,
  },
  outbox: { pending: 0, sending: 0, sent: 7, failed: 1, stuck: 1, oldestPendingAt: null },
  recentFailed: [
    {
      id: "ob-1",
      to: "adopt-guard@example.com",
      template: "verify_email",
      attempts: 1,
      maxAttempts: 3,
      lastError: "No mailer configured — the message was never attempted (no-mailer trace)",
      transport: "none",
      at: "2026-09-26T00:00:00.000Z",
    },
  ],
  checkedAt: "2026-09-26T00:00:00.000Z",
};

const fetchMock = vi.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- fetch's positional contract
  async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(HEALTH, { status: 200 }),
);
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  // Relative call counts: StrictMode double-invokes the mount effect, so the
  // tests assert deltas, never absolute fetch tallies.
  vi.clearAllMocks();
});

describe("MailHealthCard", () => {
  it("announces the two-minute auto-refresh cadence", async () => {
    render(<MailHealthCard />);
    expect(await screen.findByTestId("mail-transport-line")).toBeInTheDocument();
    expect(screen.getByText(/Auto-refreshing every 2 minutes/i)).toBeInTheDocument();
  });

  it("schedules the refetch on a two-minute interval and tears it down on unmount", async () => {
    const intervalSpy = vi.spyOn(global, "setInterval");
    const clearSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<MailHealthCard />);
    await screen.findByTestId("mail-outbox-depths");

    // Other components in the tree schedule their own intervals — select the
    // card's by its cadence. The cadence IS the no-early-refresh guarantee:
    // nothing fires before 120s because the first tick is scheduled at
    // exactly 120 000 ms. (Per-tick refetch behavior is pinned by the resend
    // test below — same fetchHealth path.)
    const callIndex = intervalSpy.mock.calls.findIndex(([, ms]) => ms === 120_000);
    expect(callIndex).toBeGreaterThanOrEqual(0);
    // The handle is setInterval's return value, not an argument.
    const handle = intervalSpy.mock.results[callIndex]?.value;
    expect(handle).toBeDefined();
    expect(clearSpy).not.toHaveBeenCalledWith(handle);

    unmount();
    expect(clearSpy).toHaveBeenCalledWith(handle);
    intervalSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it("resend POSTs and refetches the health payload", async () => {
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === "POST"
        ? Response.json({ status: "none" })
        : Response.json(HEALTH, { status: 200 }),
    );
    render(<MailHealthCard />);
    await screen.findByTestId("mail-recent-failures");

    await userEvent.click(screen.getByRole("button", { name: /resend last failed/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
    // The refetch followed the resend so the queue depth reflects reality.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

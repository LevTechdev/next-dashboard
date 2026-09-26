import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeafOrphansCard } from "@/components/admin/leaf-orphans-card";

/**
 * Leaf-orphans health card (admin panel) — the ops signal so reconciliation
 * does not depend on opening the scheduler card in Settings.
 *
 * Pinned here:
 *   1. the three verdicts render as badge text AND data-state (tooling),
 *   2. the report names tables and sample refs so the admin can act,
 *   3. "Run sync" POSTs the guarded trigger and refetches.
 */
let mockPayload: unknown;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  Response.json(
    init?.method === "POST"
      ? { ok: true }
      : ((mockPayload as object) ?? { error: "no payload stubbed" }),
    { status: 200 },
  ),
);

function stubReport(payload: unknown) {
  mockPayload = payload;
}

vi.stubGlobal("fetch", fetchMock);

const CLEAN = {
  state: "ok",
  total: 0,
  unacknowledgedSamples: 0,
  tables: {},
  checkedAt: "2026-09-26T00:00:00.000Z",
};

const NAMED = {
  state: "bad",
  total: 2947,
  unacknowledgedSamples: 2,
  tables: {
    Session: { count: 97, samples: ["cmuS1 [userId=cmuU1]"] },
    SecurityEvent: { count: 2850, samples: ["cmuE1 [tenantId=cmuT1]"] },
  },
  checkedAt: "2026-09-26T00:00:00.000Z",
};

const ALL_ACKED = {
  state: "warn",
  total: 13,
  unacknowledgedSamples: 0,
  tables: { Session: { count: 3 }, FxRateSnapshot: { count: 10 } },
  checkedAt: "2026-09-26T00:00:00.000Z",
};

describe("LeafOrphansCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubReport(CLEAN);
  });

  it("renders the clean verdict when nothing is unsyncable", async () => {
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Clean");
    });
    expect(screen.getByTestId("leaf-orphans-card")).toHaveAttribute("data-state", "ok");
    expect(screen.getByText(/mirror is complete/i)).toBeInTheDocument();
  });

  it("names the unsyncable tables and sample refs in the bad state", async () => {
    stubReport(NAMED);
    render(<LeafOrphansCard />);

    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Needs reconciliation");
    });
    expect(screen.getByTestId("leaf-orphans-card")).toHaveAttribute("data-state", "bad");
    expect(screen.getByTestId("leaf-orphans-total")).toHaveTextContent(
      "2947 unsyncable rows across 2 tables",
    );
    // The exact refs an operator retires with the ack CLI.
    expect(screen.getByText("cmuS1 [userId=cmuU1]")).toBeInTheDocument();
    expect(screen.getByText("cmuE1 [tenantId=cmuT1]")).toBeInTheDocument();
  });

  it("hints that every sampled ref is acknowledged in the warn state", async () => {
    stubReport(ALL_ACKED);
    render(<LeafOrphansCard />);

    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Acknowledged");
    });
    expect(screen.getByTestId("leaf-orphans-card")).toHaveAttribute("data-state", "warn");
    expect(screen.getByText(/Every sampled ref is acknowledged/i)).toBeInTheDocument();
  });

  it("run-now POSTs the trigger and refetches the report", async () => {
    stubReport(NAMED);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("leaf-orphans-run"));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post?.[0]).toBe("/api/admin/leaf-orphans");
    });
    // A refetch followed the successful trigger.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

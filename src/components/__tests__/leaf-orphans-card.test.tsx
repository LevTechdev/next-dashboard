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
/** One-shot failure injection for the next POST (ack error path). */
let failNextPost = false;
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "POST") {
    if (failNextPost) {
      failNextPost = false;
      return Response.json({ ok: false, error: "ledger read-only" }, { status: 200 });
    }
    // test-digest returns the queued count; the ack/sync actions just ok.
    const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
    if (body.action === "test-digest") {
      return Response.json({ ok: true, emailQueued: 1, mailMisconfigured: false });
    }
    return Response.json({ ok: true }, { status: 200 });
  }
  // After a POST the refetch must see the CURRENT report — serve the most
  // recently stubbed payload instead of freezing the first one.
  return Response.json((mockPayload as object) ?? { error: "no payload stubbed" }, { status: 200 });
});

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

  it("hides the acknowledge control when nothing is named anymore", async () => {
    stubReport(ALL_ACKED);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Acknowledged");
    });
    expect(screen.queryByTestId("leaf-orphans-ack")).not.toBeInTheDocument();
  });

  it("acknowledges all named refs through the ack action and refetches", async () => {
    stubReport(NAMED);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Needs reconciliation");
    });

    // Two-step confirm: the first click only arms the action.
    await userEvent.click(screen.getByTestId("leaf-orphans-ack"));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);

    await userEvent.click(screen.getByTestId("leaf-orphans-ack-confirm"));

    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
      expect(posts).toHaveLength(1);
      const body = JSON.parse(String(posts[0][1]?.body));
      expect(body.action).toBe("ack");
      // Exactly what the report named — the sampled fingerprints, nothing else.
      expect(body.refs).toEqual(["cmuS1 [userId=cmuU1]", "cmuE1 [tenantId=cmuT1]"]);
    });
    // A refetch followed the acknowledgement.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces an ack failure as an error instead of a success toast", async () => {
    stubReport(NAMED);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-ack")).toBeInTheDocument();
    });

    failNextPost = true;
    await userEvent.click(screen.getByTestId("leaf-orphans-ack"));
    await userEvent.click(screen.getByTestId("leaf-orphans-ack-confirm"));

    // The confirm step stays armed: a failed acknowledgement never pretends
    // to have succeeded (no success toast, no dismiss, no silent reset).
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-ack-cancel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("leaf-orphans-ack-confirm")).toBeInTheDocument();
  });

  it("send test digest POSTs the test-digest action through the outbox route", async () => {
    stubReport(NAMED);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-test-digest")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("leaf-orphans-test-digest"));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => {
        if (init?.method !== "POST") return false;
        const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
        return body.action === "test-digest";
      });
      expect(post).toBeDefined();
    });
  });

  it("hides the test-digest button when the report is clean", async () => {
    stubReport(CLEAN);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Clean");
    });
    expect(screen.queryByTestId("leaf-orphans-test-digest")).not.toBeInTheDocument();
  });

  it("keeps the test-digest button available in the warn state (a preview, not an alarm)", async () => {
    stubReport(ALL_ACKED);
    render(<LeafOrphansCard />);
    await waitFor(() => {
      expect(screen.getByTestId("leaf-orphans-badge")).toHaveTextContent("Acknowledged");
    });
    expect(screen.getByTestId("leaf-orphans-test-digest")).toBeInTheDocument();
  });
});

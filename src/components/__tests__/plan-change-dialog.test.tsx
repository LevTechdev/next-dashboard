import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanChangeDialog } from "@/components/billing/plan-change-dialog";

/**
 * The plan-change dialog is the only place a customer sees what a switch will
 * cost BEFORE it happens. These tests pin the three things that matter:
 *
 *   1. the figures shown are the server's proration (the same engine the apply
 *      route uses) — not a client-side guess;
 *   2. a switch that costs money cannot be confirmed while the preview is still
 *      loading or failed;
 *   3. confirming posts `confirm: true` — the flag the API requires so a change
 *      can never be applied without this step.
 */

const PREVIEW = {
  kind: "UPGRADE",
  changeable: true,
  currentRate: 29,
  nextRate: 79,
  remainingFraction: 0.5,
  credit: 14.5,
  charge: 39.5,
  dueToday: 25,
  effectiveAt: "2026-09-23T00:00:00.000Z",
  nextPeriodEnd: "2026-10-23T00:00:00.000Z",
};

function mockFetch(preview: unknown = PREVIEW, ok = true) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (!init || init.method === undefined) {
      return Promise.resolve({
        ok,
        json: () => Promise.resolve({ preview, current: { planName: "Starter" } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("PlanChangeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the server's proration figures", async () => {
    mockFetch();
    render(
      <PlanChangeDialog
        open
        onOpenChange={() => {}}
        planId="plan-pro"
        planName="Professional"
        billingInterval="MONTHLY"
        currentInterval="MONTHLY"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("plan-change-lines")).toBeInTheDocument());
    expect(screen.getByTestId("plan-change-credit")).toHaveTextContent("14.50");
    expect(screen.getByTestId("plan-change-charge")).toHaveTextContent("39.50");
    expect(screen.getByTestId("plan-change-due")).toHaveTextContent("25.00");
    // The "from" line names the plan the workspace is on today.
    expect(screen.getByText(/Starter/)).toBeInTheDocument();
  });

  it("keeps confirm disabled until the preview lands, then posts confirm:true", async () => {
    const fetchMock = mockFetch();
    const onApplied = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <PlanChangeDialog
        open
        onOpenChange={onOpenChange}
        planId="plan-pro"
        planName="Professional"
        billingInterval="MONTHLY"
        onApplied={onApplied}
      />,
    );

    const confirm = screen.getByTestId("plan-change-confirm");
    // Before the preview resolves the button is disabled — the customer can
    // never confirm an amount they have not seen.
    expect(confirm).toBeDisabled();

    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      planId: "plan-pro",
      billingInterval: "MONTHLY",
      confirm: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays unusable when the preview cannot be loaded", async () => {
    mockFetch(undefined, false);
    render(
      <PlanChangeDialog
        open
        onOpenChange={() => {}}
        planId="plan-pro"
        planName="Professional"
        billingInterval="MONTHLY"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("plan-change-failed")).toBeInTheDocument());
    expect(screen.getByTestId("plan-change-confirm")).toBeDisabled();
  });

  it("shows the credit-note note when unused time covers the change", async () => {
    mockFetch({ ...PREVIEW, kind: "DOWNGRADE", credit: 99.5, charge: 14.5, dueToday: -85 });
    render(
      <PlanChangeDialog
        open
        onOpenChange={() => {}}
        planId="plan-starter"
        planName="Starter"
        billingInterval="MONTHLY"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("plan-change-lines")).toBeInTheDocument());
    // Negative net: formatted as "-$85.00" by Intl — assert the magnitude, not
    // the sign placement, which is locale/ICU dependent.
    expect(screen.getByTestId("plan-change-due")).toHaveTextContent(/85\.00/);
    expect(screen.getByText(/next invoice/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SchedulerStatusCard } from "@/components/settings/scheduler-status-card";

/**
 * SchedulerStatusCard — the leaf-sync orphan report.
 *
 * The leaf-sync job's run result can carry an operator-facing orphan report
 * (local rows that can never sync because their FK targets — dev-seed users
 * and tenants — don't exist on the remote). The card must surface it under
 * the job row, with sample fingerprints, so the accounted-for tally becomes a
 * signal; without a report the job row stays unchanged.
 */

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const dict: Record<string, string> = {
      leafOrphans: "{table}: {n} local rows cannot sync (FK target missing remotely)",
      never: "Never",
    };
    // Minimal {placeholder} interpolation — the real formatter is next-intl's.
    return (key: string, values?: Record<string, unknown>) =>
      (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) =>
        values && name in values ? String(values[name]) : `{${name}}`,
      );
  },
}));

vi.mock("@/hooks/use-now", () => ({ useNow: () => Date.now() }));

let mockStatus: {
  enabled: boolean;
  tickMs: number;
  jobs: Record<string, { at: string; ok: boolean; result?: unknown } | null>;
} | null = null;

vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string) => {
    if (String(url).includes("/api/scheduler/status")) {
      return mockStatus
        ? new Response(JSON.stringify(mockStatus), { status: 200 })
        : new Response("{}", { status: 500 });
    }
    // Rollback snapshots endpoint — empty list keeps that section quiet.
    return new Response(JSON.stringify({ snapshots: [] }), { status: 200 });
  }),
);

afterEach(() => {
  mockStatus = null;
  vi.clearAllMocks();
});

function jobRun(result: unknown) {
  return { at: new Date().toISOString(), ok: true, result };
}

describe("SchedulerStatusCard — leaf-sync orphan report", () => {
  it("shows the per-table orphan report with samples under the leaf-sync job", async () => {
    mockStatus = {
      enabled: true,
      tickMs: 300_000,
      jobs: {
        "supabase-leaf-sync": jobRun({
          job: "supabase-leaf-sync",
          output: "OK — leaf tables in sync",
          orphanReport: {
            SecurityEvent: {
              count: 2837,
              samples: [
                "cmueaifvl043eu5p0qh48rldw [tenantId=cmueaifuc0434u5p0hj2xp7qi]",
                "cmuakixo30018u58s61q2qth5 [tenantId=cmuakiczj0000u58sg82frt3s]",
              ],
            },
            Session: {
              count: 94,
              samples: ["cmuh2bfdp01fqu558apnfgdys [userId=cmuh2be5r0002u558f4gyyf0a]"],
            },
          },
        }),
        "usage-digest": null,
      },
    };

    render(<SchedulerStatusCard />);

    const panel = await screen.findByTestId("leaf-sync-orphans");
    // Per-table counts, formatted through the localized template.
    expect(panel).toHaveTextContent("SecurityEvent: 2837 local rows cannot sync");
    expect(panel).toHaveTextContent("Session: 94 local rows cannot sync");
    // Sample fingerprints are visible so the refs can actually be reconciled.
    expect(panel).toHaveTextContent("[tenantId=cmueaifuc0434u5p0hj2xp7qi]");
    expect(panel).toHaveTextContent("[userId=cmuh2be5r0002u558f4gyyf0a]");
  });

  it("renders the leaf-sync job unchanged when no report is present", async () => {
    mockStatus = {
      enabled: true,
      tickMs: 300_000,
      jobs: {
        "supabase-leaf-sync": jobRun({
          job: "supabase-leaf-sync",
          output: "OK — leaf tables in sync",
        }),
        "usage-digest": null,
      },
    };

    render(<SchedulerStatusCard />);

    await waitFor(() => expect(screen.getByTestId("scheduler-status")).toBeInTheDocument());
    expect(screen.queryByTestId("leaf-sync-orphans")).not.toBeInTheDocument();
  });

  it("ignores malformed or empty reports instead of rendering a broken panel", async () => {
    mockStatus = {
      enabled: true,
      tickMs: 300_000,
      jobs: {
        "supabase-leaf-sync": jobRun({
          job: "supabase-leaf-sync",
          orphanReport: { SecurityEvent: { samples: ["no count"] } },
        }),
      },
    };

    render(<SchedulerStatusCard />);

    await waitFor(() => expect(screen.getByTestId("scheduler-status")).toBeInTheDocument());
    expect(screen.queryByTestId("leaf-sync-orphans")).not.toBeInTheDocument();
  });
});

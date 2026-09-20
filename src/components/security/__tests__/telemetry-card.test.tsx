import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TelemetryCard } from "../telemetry-card";
import type { SecurityData, SecurityEventRow } from "../use-security-data";

/**
 * The live throttle-window gauge reconstructs the limiter's sliding window
 * from the persisted RATE_LIMITED rows (each carries its own limit /
 * windowSeconds). These tests pin that replay: which rows are in-window, which
 * IP wins, the blocked flag, and the 1 Hz countdown.
 */
const NOW = new Date("2026-09-20T12:00:00.000Z").getTime();
const secsAgo = (s: number) => new Date(NOW - s * 1000).toISOString();

const rateLimited = (
  over: Partial<SecurityEventRow> & { createdAt: string; ip: string },
): SecurityEventRow => ({
  id: `evt-${over.ip}-${over.createdAt}`,
  type: "RATE_LIMITED",
  ...over,
});

const attempt = (ip: string, agoSeconds: number, blocked = false, limit = 10): SecurityEventRow =>
  rateLimited({
    ip,
    createdAt: secsAgo(agoSeconds),
    metadata: { endpoint: "login", limit, windowSeconds: 120, blocked },
  });

const baseData = (overrides: Partial<SecurityData> = {}): SecurityData => ({
  sessions: [],
  events: [],
  backupRemaining: null,
  passkeys: [],
  trustedDevices: [],
  totpEnabled: null,
  emailVerified: null,
  mfaVerifiedRecently: false,
  mfaLastVerifiedAt: null,
  mfaDaysSince: null,
  loading: false,
  refresh: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("TelemetryCard — live throttle window", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no gauge when nothing is in the current window", () => {
    render(<TelemetryCard data={baseData()} />);
    expect(screen.queryByTestId("telemetry-throttle-window")).not.toBeInTheDocument();
  });

  it("replays an open window as used / limit with the busiest IP", () => {
    render(
      <TelemetryCard
        data={baseData({
          events: [
            attempt("203.0.113.7", 5),
            attempt("203.0.113.7", 20),
            attempt("203.0.113.7", 30),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("telemetry-throttle-count")).toHaveTextContent("3 of 10 attempts");
    // Oldest attempt entered 30s ago in a 120s window → 90s until it slides out.
    expect(screen.getByTestId("telemetry-throttle-state")).toHaveTextContent(
      "Allowance refreshes in 90s",
    );
    expect(screen.getByTestId("telemetry-throttle-window")).toHaveTextContent("203.0.113.7");
  });

  it("flags a blocked window and switches to the blocked copy", () => {
    render(
      <TelemetryCard
        data={baseData({
          events: [attempt("198.51.100.9", 4, true), attempt("198.51.100.9", 12, false)],
        })}
      />,
    );
    const state = screen.getByTestId("telemetry-throttle-state");
    expect(state).toHaveTextContent(/^Blocked/);
    expect(state).toHaveTextContent("clears in 108s");
    expect(state.className).toContain("text-amber-600");
  });

  it("picks the busiest IP when several windows are open", () => {
    render(
      <TelemetryCard
        data={baseData({
          events: [
            attempt("203.0.113.7", 10),
            attempt("203.0.113.7", 40),
            attempt("198.51.100.9", 5),
            attempt("198.51.100.9", 15),
            attempt("198.51.100.9", 25),
            attempt("198.51.100.9", 35),
            attempt("198.51.100.9", 45),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("telemetry-throttle-count")).toHaveTextContent("5 of 10 attempts");
    expect(screen.getByTestId("telemetry-throttle-window")).toHaveTextContent("198.51.100.9");
  });

  it("ignores attempts that already slid out of the window", () => {
    render(
      <TelemetryCard
        data={baseData({
          events: [
            attempt("203.0.113.7", 10),
            attempt("203.0.113.7", 60),
            // Outside the 120s window — must not be counted.
            attempt("203.0.113.7", 200),
            attempt("203.0.113.7", 600),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("telemetry-throttle-count")).toHaveTextContent("2 of 10 attempts");
  });

  it("drops the gauge entirely once the last attempt leaves the window", () => {
    render(<TelemetryCard data={baseData({ events: [attempt("203.0.113.7", 119)] })} />);
    expect(screen.getByTestId("telemetry-throttle-window")).toBeInTheDocument();

    // 119s elapsed + 2s → the sole attempt has slid out; no tick may leak on.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("telemetry-throttle-window")).not.toBeInTheDocument();
  });

  it("counts down once per second while the window is open", () => {
    render(<TelemetryCard data={baseData({ events: [attempt("203.0.113.7", 10)] })} />);
    expect(screen.getByTestId("telemetry-throttle-state")).toHaveTextContent(
      "Allowance refreshes in 110s",
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("telemetry-throttle-state")).toHaveTextContent(
      "Allowance refreshes in 109s",
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByTestId("telemetry-throttle-state")).toHaveTextContent(
      "Allowance refreshes in 105s",
    );
  });
});

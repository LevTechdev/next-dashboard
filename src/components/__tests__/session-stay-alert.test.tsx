import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { SessionStayAlert } from "@/components/session/session-stay-alert";

/**
 * The dashboard's stay-login sentinel, after the two fixes:
 *
 *  1. VISIBILITY-AWARE COUNTDOWN — hidden-tab (and sleep) time no longer burns
 *     the window. The old wall-clock countdown signed users out the moment a
 *     background tab throttled its way past 0:00, even though they never saw
 *     the alert. The pure math lives in src/lib/stay-countdown.ts and is
 *     unit-tested separately; these tests pin the component's WIRING.
 *  2. THE STAY CTA RECORDS A SERVER GRANT — clicking "Stay signed in" rotates
 *     the access token AND stamps a durable grant on the refresh-token family,
 *     so the extension survives a lost localStorage flag.
 *
 * Real timers with the startRemainingMs prop keep these tests sub-second
 * (fake timers + the never-clearing 1s interval hang userEvent and waitFor).
 */

const assign = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

let stayLoginGranted = false;

beforeEach(() => {
  stayLoginGranted = false;
  vi.stubGlobal("location", {
    pathname: "/en/dashboard",
    origin: "http://localhost:3000",
    search: "",
    assign,
  });
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/auth/stay-login")) {
        if ((init?.method ?? "GET") === "POST") {
          stayLoginGranted = true;
          return jsonResponse(200, { success: true, until: new Date().toISOString() });
        }
        return jsonResponse(200, { granted: stayLoginGranted, until: null });
      }
      if (url.includes("/api/auth/refresh")) {
        return jsonResponse(200, { success: true });
      }
      return jsonResponse(200, {});
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Just above 0:00, well under the 3:00 warning threshold. */
const NEARLY_DONE = 5_000;

function renderArmed(props = {}) {
  return render(<SessionStayAlert startRemainingMs={NEARLY_DONE} {...props} />);
}

describe("SessionStayAlert (component wiring)", () => {
  it("shows the warning card when the window dips below the threshold", async () => {
    renderArmed();

    expect(await screen.findByTestId("stay-signed-in-btn")).toBeEnabled();
  });

  it("does not sign out while the tab is hidden", async () => {
    renderArmed();

    // Hide the tab and let the clock run past 0:00 — the pre-fix countdown
    // would have fired signOut() here.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/logout", expect.anything());
    expect(assign).not.toHaveBeenCalled();
  });

  it("Stay records the server grant, mirrors the flag, and never signs out", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    renderArmed();

    const btn = await screen.findByTestId("stay-signed-in-btn");
    await act(async () => {
      btn.click();
    });

    const fetchMock = vi.mocked(fetch);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/stay-login",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(window.localStorage.getItem("session_stay_signed_in")).toBe("1");
    expect(stayLoginGranted).toBe(true);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/logout", expect.anything());
  });

  it("adopts an existing server grant on mount instead of re-arming the alert", async () => {
    stayLoginGranted = true;
    render(<SessionStayAlert startRemainingMs={NEARLY_DONE} />);

    // Small settle so the mount-time reconciliation resolves before we look.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(screen.queryByTestId("stay-signed-in-btn")).not.toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/logout", expect.anything());
  });

  it("re-arms instead of signing out when the rotation fails transiently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/auth/refresh") && (init?.method ?? "GET") === "POST") {
          return jsonResponse(503, {});
        }
        if (url.includes("/api/auth/stay-login")) {
          return jsonResponse(200, { granted: false, until: null });
        }
        return jsonResponse(200, {});
      }),
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    renderArmed();

    const btn = await screen.findByTestId("stay-signed-in-btn");
    await act(async () => {
      btn.click();
    });

    await vi.waitFor(() => {
      // Ambiguous outcome → keep the session, re-arm, never sign out.
      expect(window.localStorage.getItem("session_stay_signed_in")).toBeNull();
    });
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/logout", expect.anything());
  });
});

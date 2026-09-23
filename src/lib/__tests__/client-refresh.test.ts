import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Client-side refresh integration: the two paths that END a session.
 *
 * `forceLoginRedirect` is the app's kill switch — it full-navigates to the
 * login form so no half-authenticated shell can linger. Because it is called
 * from every 401-recovery path (fetch wrapper, pollers, the stay-signed-in
 * alert), it must be idempotent: a burst of concurrent 401s has to produce
 * exactly ONE navigation, and a call from an auth screen must be ignored
 * entirely or it would fight the login flow's own routing. That idempotence is
 * module-level state (`redirectingToLogin`), so every test loads a fresh
 * module instance rather than sharing one.
 *
 * `singleFlightRefresh` decides WHEN the session is truly gone. A 401 alone is
 * not enough — anonymous visitors on public pages hit that constantly. Only a
 * terminal rotation code (expired / reused / account unavailable) may
 * force-close the app; anything else must leave the caller to handle its own
 * 401.
 */

type ClientRefresh = typeof import("@/lib/client-refresh");

const AUTH_SCREENS = [
  "/en/login",
  "/en/register",
  "/en/forgot-password",
  "/en/reset-password",
  "/id/login",
  "/en/login/reset",
];

/** Fresh module per test — `redirectingToLogin` and `inFlight` are module state. */
async function loadModule(): Promise<ClientRefresh> {
  vi.resetModules();
  return (await import("@/lib/client-refresh")) as ClientRefresh;
}

/** jsdom navigation stub: capture the target instead of actually navigating. */
const assign = vi.fn();

function setPathname(pathname: string) {
  vi.stubGlobal("location", { pathname, assign });
}

/** A 401 refresh response carrying a machine-readable `code`. */
function refreshResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  assign.mockReset();
  setPathname("/en/dashboard");
  // A present CSRF cookie keeps ensureCsrfToken() from spending a request on
  // /api/auth/csrf, so each test's fetch counts only the rotation itself.
  document.cookie = "csrf_token=test-token";
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("forceLoginRedirect loop guard", () => {
  it("navigates to the locale's login form with the reason", async () => {
    const { forceLoginRedirect } = await loadModule();
    window.localStorage.setItem("session_stay_signed_in", "1");

    forceLoginRedirect("expired");

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/en/login?reason=expired");
  });

  it("keeps the caller's locale instead of assuming en", async () => {
    setPathname("/id/dashboard");
    const { forceLoginRedirect } = await loadModule();

    forceLoginRedirect("expired");

    expect(assign).toHaveBeenCalledWith("/id/login?reason=expired");
  });

  it("carries the session-changed reason through", async () => {
    const { forceLoginRedirect } = await loadModule();

    forceLoginRedirect("session-changed");

    expect(assign).toHaveBeenCalledWith("/en/login?reason=session-changed");
  });

  it("navigates only once across repeated calls (the loop guard)", async () => {
    const { forceLoginRedirect } = await loadModule();

    forceLoginRedirect("expired");
    forceLoginRedirect("expired");
    forceLoginRedirect("session-changed");

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/en/login?reason=expired");
  });

  it("drops the granted stay-signed-in window with the dead session", async () => {
    const { forceLoginRedirect } = await loadModule();
    window.localStorage.setItem("session_stay_signed_in", "1");

    forceLoginRedirect("expired");

    // A stay window must not outlive the session it extended, or the next
    // login would start in the extended rhythm.
    expect(window.localStorage.getItem("session_stay_signed_in")).toBeNull();
  });

  it.each(AUTH_SCREENS)("is a no-op on the auth screen %s", async (pathname) => {
    setPathname(pathname);
    const { forceLoginRedirect } = await loadModule();

    forceLoginRedirect("expired");

    expect(assign).not.toHaveBeenCalled();
  });

  it("does not consume the guard when skipped on an auth screen", async () => {
    setPathname("/en/login");
    const { forceLoginRedirect } = await loadModule();

    forceLoginRedirect("expired");
    // A skipped call must leave the guard available — otherwise a later
    // genuine session loss would navigate nowhere.
    setPathname("/en/dashboard");
    forceLoginRedirect("expired");

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/en/login?reason=expired");
  });

  it("is a no-op without a window (server render)", async () => {
    const { forceLoginRedirect } = await loadModule();
    vi.stubGlobal("window", undefined);

    expect(() => forceLoginRedirect("expired")).not.toThrow();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("terminal refresh-code handling", () => {
  const TERMINAL_CODES = ["SESSION_EXPIRED", "REFRESH_REUSE", "ACCOUNT_UNAVAILABLE"];

  it.each(TERMINAL_CODES)("force-closes the app on %s", async (code) => {
    const fetchMock = vi.fn(async () => refreshResponse(401, { code }));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessTokenDetailed, forceLoginRedirect } = await loadModule();
    void forceLoginRedirect; // loaded for its side effect only

    const result = await refreshAccessTokenDetailed();

    expect(result).toEqual({ ok: false, status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/en/login?reason=expired");
  });

  it("leaves an anonymous 401 alone when the code is not terminal", async () => {
    const fetchMock = vi.fn(async () => refreshResponse(401, { code: "NO_SESSION" }));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessTokenDetailed } = await loadModule();

    const result = await refreshAccessTokenDetailed();

    expect(result).toEqual({ ok: false, status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not force-close when a 401 body has no code at all", async () => {
    const fetchMock = vi.fn(async () => refreshResponse(401, {}));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessTokenDetailed } = await loadModule();

    await refreshAccessTokenDetailed();

    expect(assign).not.toHaveBeenCalled();
  });

  it("does not force-close on a non-JSON 401 body", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>gateway</html>", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessTokenDetailed } = await loadModule();

    const result = await refreshAccessTokenDetailed();

    expect(result).toEqual({ ok: false, status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not force-close on a server error", async () => {
    const fetchMock = vi.fn(async () => refreshResponse(500, { code: "SESSION_EXPIRED" }));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessTokenDetailed } = await loadModule();

    const result = await refreshAccessTokenDetailed();

    expect(result).toEqual({ ok: false, status: 500 });
    expect(assign).not.toHaveBeenCalled();
  });

  it("reports success without navigating when the rotation succeeds", async () => {
    const fetchMock = vi.fn(async () => refreshResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessToken } = await loadModule();

    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it("collapses concurrent rotations into a single request", async () => {
    // A second in-flight POST would present the just-consumed refresh token
    // and trip reuse detection — a surprise sign-out.
    const fetchMock = vi.fn(async () => refreshResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { refreshAccessTokenDetailed } = await loadModule();

    const [a, b] = await Promise.all([refreshAccessTokenDetailed(), refreshAccessTokenDetailed()]);

    expect(a).toEqual({ ok: true, status: 200 });
    expect(b).toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

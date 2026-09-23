import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { PWARegister } from "@/components/pwa-register";

/**
 * The service worker is a PRODUCTION feature. In development it is a hazard:
 * public/sw.js serves scripts/styles/images cache-first, and dev chunk URLs are
 * stable across edits, so after a change the browser keeps executing the
 * PREVIOUS build until Cache Storage is cleared by hand.
 *
 * That has already cost real debugging time here — a "MISSING_MESSAGE" that was
 * actually a stale chunk, and a login step that looked unimplemented while the
 * code was on disk — so the dev guard is pinned rather than trusted.
 */

const register = vi.fn();
const unregister = vi.fn();
const getRegistrations = vi.fn();
const cacheDelete = vi.fn();
const cacheKeys = vi.fn();

function installServiceWorkerApi() {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register, getRegistrations },
    configurable: true,
  });
  Object.defineProperty(window, "caches", {
    value: { keys: cacheKeys, delete: cacheDelete },
    configurable: true,
  });
}

describe("PWARegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    register.mockResolvedValue({ addEventListener: vi.fn() });
    unregister.mockResolvedValue(true);
    getRegistrations.mockResolvedValue([{ unregister }]);
    cacheKeys.mockResolvedValue(["next-dashboard-v2"]);
    cacheDelete.mockResolvedValue(true);
    installServiceWorkerApi();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does NOT register a worker in development, and heals a stale one", async () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<PWARegister />);

    // The worker that a previous dev session left behind is removed...
    await waitFor(() => expect(getRegistrations).toHaveBeenCalled());
    await waitFor(() => expect(unregister).toHaveBeenCalled());
    // ...its cache goes with it, so the next load gets fresh chunks...
    await waitFor(() => expect(cacheDelete).toHaveBeenCalledWith("next-dashboard-v2"));
    // ...and no new worker is registered to serve stale code again.
    expect(register).not.toHaveBeenCalled();
  });

  it("registers the worker outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");

    render(<PWARegister />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
    expect(getRegistrations).not.toHaveBeenCalled();
  });
});

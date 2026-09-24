import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  return mod.createTranslationsMock({
    verificationSuccess: {
      emailVerified: "Email verified successfully — your account is now fully secured.",
      emailVerifyFailed: "That verification link is invalid or has expired. Request a new code.",
      twoFactorEnabled: "Two-factor authentication enabled.",
      twoFactorDisabled: "Two-factor authentication disabled.",
      passwordChanged: "Password changed successfully.",
    },
  });
});

import { toast } from "sonner";
import { VerificationSuccessToaster } from "../verification-success-toaster";

/** jsdom: drive window.location.search through history like a real navigation. */
function setQuery(query: string) {
  window.history.replaceState({}, "", `/${query ? `?${query}` : ""}`);
}

/**
 * Pins the toast-ownership contract that once produced duplicate toasts:
 * the profile page and Security Center own ?verified=... (and fire their own
 * page-local toast); this global watcher handles redirect-only markers. Its
 * strip must be synchronous, so an effect re-run (StrictMode double-invoke,
 * provider identity churn) can never see the marker again and replay a toast.
 */
describe("VerificationSuccessToaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setQuery("");
  });
  afterEach(() => setQuery(""));

  it("does NOT fire the page-owned ?verified markers", async () => {
    setQuery("verified=invalid");
    render(<VerificationSuccessToaster />);
    await act(async () => {});

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("fires a redirect-only marker once and strips it synchronously", async () => {
    setQuery("password=changed");
    const { rerender } = render(<VerificationSuccessToaster />);
    await act(async () => {});

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Password changed successfully.", expect.anything());
    expect(window.location.search).toBe("");

    // Identity churn / StrictMode re-invokes the effect — the marker is gone,
    // so nothing replays.
    rerender(<VerificationSuccessToaster />);
    await act(async () => {});
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("fires the 2FA markers once and strips them", async () => {
    setQuery("2fa=enabled");
    render(<VerificationSuccessToaster />);
    await act(async () => {});

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Two-factor authentication enabled.",
      expect.anything(),
    );
    expect(window.location.search).toBe("");
  });

  it("keeps ?verification=success as its own single-owner marker", async () => {
    setQuery("verification=success");
    render(<VerificationSuccessToaster />);
    await act(async () => {});

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Email verified successfully — your account is now fully secured.",
      expect.anything(),
    );
    expect(window.location.search).toBe("");
  });

  it("does not fire anything when the URL carries no markers", async () => {
    render(<VerificationSuccessToaster />);
    await act(async () => {});

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

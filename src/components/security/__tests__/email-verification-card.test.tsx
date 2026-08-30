import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EmailVerificationCard } from "../email-verification-card";
import type { SecurityData } from "../use-security-data";

const COOLDOWN_KEY = "email-verify-cooldown-until";

const baseData = (overrides: Partial<SecurityData> = {}): SecurityData => ({
  sessions: [],
  events: [],
  backupRemaining: null,
  passkeys: [],
  totpEnabled: null,
  emailVerified: null,
  mfaVerifiedRecently: false,
  loading: false,
  refresh: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe("EmailVerificationCard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the send action while the email is unverified", () => {
    render(<EmailVerificationCard data={baseData()} />);
    expect(screen.getByText("Email Not Verified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Verification Email/i })).toBeInTheDocument();
  });

  it("renders the verified state (no send action) once the email is verified", () => {
    render(<EmailVerificationCard data={baseData({ emailVerified: new Date().toISOString() })} />);
    expect(screen.getByText("Email verified")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Send Verification Email/i }),
    ).not.toBeInTheDocument();
  });

  it("starts a 60s resend cooldown after a successful send and persists it", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    global.fetch = vi.fn().mockImplementation(() =>
      okJson({
        success: true,
        verificationUrl: "http://localhost:3010/api/auth/verify-email/confirm?token=abc&locale=en",
      }),
    );

    render(<EmailVerificationCard data={baseData({ refresh })} />);
    fireEvent.click(screen.getByRole("button", { name: /Send Verification Email/i }));
    await act(async () => {}); // flush the async send handler

    // Sent with the current locale; dev-mode link rendered.
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/verify-email/send", expect.any(Object));
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    // The card forwards from: "security" so the confirm link returns here.
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      locale: "en",
      from: "security",
    });
    expect(screen.getByText(/\/api\/auth\/verify-email\/confirm\?token=/)).toBeInTheDocument();

    // Button is now disabled with a countdown, and the cooldown is persisted.
    const resendBtn = screen.getByRole("button", { name: /Resend in/i });
    expect(resendBtn).toBeDisabled();
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeTruthy();

    // Countdown ticks down over time.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: /Resend in/i })).toBeDisabled();

    // After the full cooldown, the send action is re-enabled and cleaned up.
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByRole("button", { name: /Resend Email/i })).toBeEnabled();
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it("restores an in-progress cooldown from localStorage on remount", async () => {
    vi.useFakeTimers();
    const future = Date.now() + 30_000;
    localStorage.setItem(COOLDOWN_KEY, String(future));

    render(<EmailVerificationCard data={baseData()} />);

    const resendBtn = screen.getByRole("button", { name: /Resend in/i });
    expect(resendBtn).toBeDisabled();

    // Ticks once per second until the persisted deadline passes.
    await act(async () => {
      vi.advanceTimersByTime(29_000);
    });
    expect(screen.getByRole("button", { name: /Resend in/i })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // No link has been shown in this test, so the button reverts to its
    // initial label once the restored cooldown elapses.
    expect(screen.getByRole("button", { name: /Send Verification Email/i })).toBeEnabled();
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeNull();
  });

  it("does not start a cooldown when the account is already verified", async () => {
    vi.useFakeTimers();
    global.fetch = vi
      .fn()
      .mockImplementation(() => okJson({ success: true, alreadyVerified: true }));

    render(<EmailVerificationCard data={baseData()} />);
    fireEvent.click(screen.getByRole("button", { name: /Send Verification Email/i }));
    await act(async () => {});

    // No countdown: the send button returns to its normal (enabled) state.
    expect(screen.getByRole("button", { name: /Send Verification Email/i })).toBeEnabled();
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeNull();
  });

  it("keeps the send button enabled when localStorage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage access denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage quota exceeded");
    });

    render(<EmailVerificationCard data={baseData()} />);
    expect(screen.getByRole("button", { name: /Send Verification Email/i })).toBeEnabled();
  });

  it("shows the OTP entry when the email is unverified", () => {
    render(<EmailVerificationCard data={baseData()} />);
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("6-digit code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Email/i })).toBeInTheDocument();
  });

  it("auto-submits the verification on the 6th digit and refreshes the data", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/verify-email/otp") return okJson({ success: true });
      return okJson({ success: true });
    });

    render(<EmailVerificationCard data={baseData({ refresh })} />);
    // Filling the 6th digit fires verification directly — no click on Verify.
    fireEvent.change(screen.getByPlaceholderText("6-digit code"), {
      target: { value: "123456" },
    });
    await act(async () => {}); // flush the async verify handler

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/verify-email/otp", expect.any(Object));
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "/api/auth/verify-email/otp",
    ) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ code: "123456" });
    expect(refresh).toHaveBeenCalled();
  });

  it("ignores a click on Verify racing the in-flight auto-submit", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    let resolveFetch: (v: Response) => void = () => {};
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/verify-email/otp")
        return new Promise<Response>((r) => {
          resolveFetch = r;
        });
      return okJson({ success: true });
    });

    render(<EmailVerificationCard data={baseData({ refresh })} />);
    // Capture the Verify button BEFORE the code lands — the 6th digit flips it
    // to its disabled "Verifying…" state, so re-querying by name would fail.
    const verifyBtn = screen.getByRole("button", { name: /Verify Email/i });
    fireEvent.change(screen.getByPlaceholderText("6-digit code"), {
      target: { value: "123456" },
    });
    // A click racing the in-flight auto-submit must never fire a second
    // request (otpSubmittingRef guard).
    fireEvent.click(verifyBtn);
    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve({ success: true }) } as Response);
    });

    const otpCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === "/api/auth/verify-email/otp",
    );
    expect(otpCalls).toHaveLength(1);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the attempts-left error for an invalid OTP", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/verify-email/otp")
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "OTP_INVALID", attemptsLeft: 3 }),
        } as Response);
      return okJson({ success: true });
    });

    render(<EmailVerificationCard data={baseData()} />);
    // The 6th digit auto-submits — no click needed to trigger the request.
    fireEvent.change(screen.getByPlaceholderText("6-digit code"), {
      target: { value: "000000" },
    });
    await act(async () => {});

    expect(screen.getByText(/3 attempt\(s\) left/i)).toBeInTheDocument();
  });

  it("shows the expired-code error for an expired OTP", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/verify-email/otp")
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "OTP_EXPIRED" }),
        } as Response);
      return okJson({ success: true });
    });

    render(<EmailVerificationCard data={baseData()} />);
    // The 6th digit auto-submits — no click needed to trigger the request.
    fireEvent.change(screen.getByPlaceholderText("6-digit code"), {
      target: { value: "123456" },
    });
    await act(async () => {});

    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
  });

  it("surfaces the dev-mode OTP code after a send", async () => {
    global.fetch = vi.fn().mockImplementation(() => okJson({ success: true, devOtp: "482913" }));

    render(<EmailVerificationCard data={baseData()} />);
    fireEvent.click(screen.getByRole("button", { name: /Send Verification Email/i }));
    await act(async () => {});

    expect(screen.getByTestId("dev-otp")).toHaveTextContent("482913");
  });
});

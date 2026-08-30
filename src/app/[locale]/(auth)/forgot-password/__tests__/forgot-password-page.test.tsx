import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ForgotPasswordPage, { FORGOT_PASSWORD_COOLDOWN_KEY } from "../page";

// Spy on toast so we can assert errors without a Toaster.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from "sonner";

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

const fillEmail = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value },
  });

describe("Forgot Password Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the reset link, shows the sent state, and starts the resend cooldown", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      okJson({
        success: true,
        resetUrl: "http://localhost:3010/en/reset-password?token=abc",
      }),
    );

    render(<ForgotPasswordPage />);
    await screen.findByRole("button", { name: /Send Reset Link/i });
    fillEmail("user@example.com");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));
    await act(async () => {}); // flush the async send handler

    // Sent state: the heading + success box both use the same translated text.
    // Synchronous query: findBy* polls via timers, which are faked here.
    expect(screen.getAllByText(/reset link sent/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/reset-password\?token=abc/i),
    ).toBeInTheDocument();
    // The initial submit shows the sent view instead of a toast; only resends
    // surface a toast. Nothing was toasted here.
    expect(toast.success).not.toHaveBeenCalled();

    // Request was sent with the email + current locale.
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.any(Object),
    );
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "user@example.com",
      locale: "en",
    });

    // Cooldown persisted under the forgot-password key; countdown label shows.
    expect(localStorage.getItem(FORGOT_PASSWORD_COOLDOWN_KEY)).toBeTruthy();
    expect(screen.getByText(/Resend in \d+s/i)).toBeInTheDocument();
  });

  it("re-enables the resend link after the cooldown elapses", async () => {
    global.fetch = vi.fn().mockImplementation(() => okJson({ success: true }));

    render(<ForgotPasswordPage />);
    await screen.findByRole("button", { name: /Send Reset Link/i });
    fillEmail("user@example.com");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));
    await act(async () => {});

    // During the cooldown there is no resend action.
    expect(screen.queryByRole("button", { name: /Resend Link/i })).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(localStorage.getItem(FORGOT_PASSWORD_COOLDOWN_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /Resend/i })).toBeEnabled();
  });

  it("resends the link from the sent state and restarts the cooldown", async () => {
    let call = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      call += 1;
      return okJson({
        success: true,
        resetUrl: `http://localhost:3010/en/reset-password?token=${call === 1 ? "abc" : "def"}`,
      });
    });

    render(<ForgotPasswordPage />);
    await screen.findByRole("button", { name: /Send Reset Link/i });
    fillEmail("user@example.com");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));
    await act(async () => {});

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    // Second send from the sent view issues a new request + fresh cooldown.
    fireEvent.click(screen.getByRole("button", { name: /Resend/i }));
    await act(async () => {});

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(FORGOT_PASSWORD_COOLDOWN_KEY)).toBeTruthy();
    expect(toast.success).toHaveBeenLastCalledWith("Reset Link Sent");
    expect(screen.getByText(/reset-password\?token=def/i)).toBeInTheDocument();
  });

  it("restores an in-progress cooldown on mount and blocks resubmit", async () => {
    vi.useFakeTimers();
    const future = Date.now() + 30_000;
    localStorage.setItem(FORGOT_PASSWORD_COOLDOWN_KEY, String(future));

    render(<ForgotPasswordPage />);
    fillEmail("user@example.com");
    await act(async () => {});

    // The form's submit button is disabled while the restored cooldown runs.
    expect(screen.getByRole("button", { name: /Send Reset Link/i })).toBeDisabled();
    expect(screen.getByText(/Resend in \d+s/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(localStorage.getItem(FORGOT_PASSWORD_COOLDOWN_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /Send Reset Link/i })).toBeEnabled();
  });

  it("shows an error toast when the request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Something went wrong" }),
    } as Response);

    render(<ForgotPasswordPage />);
    fillEmail("user@example.com");
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));
    await act(async () => {});

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    // Still on the form (not the sent state).
    expect(screen.queryAllByText(/reset link sent/i)).toHaveLength(0);
    expect(localStorage.getItem(FORGOT_PASSWORD_COOLDOWN_KEY)).toBeNull();
  });
});

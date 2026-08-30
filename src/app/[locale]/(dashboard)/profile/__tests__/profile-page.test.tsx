import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProfilePage from "../page";

// Ensure real implementations are used for icon modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Spy on toast so we can assert the ?verified=invalid error without a Toaster.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from "sonner";

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/profile",
  useParams: () => ({ locale: "en" }),
  useSearchParams: () => new URLSearchParams(),
}));

// ProfilePage uses useConfirm for destructive actions; provide a no-op confirm
// so the page renders standalone without the DashboardLayout's ConfirmProvider.
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(true)),
}));

import { useAuth } from "@/hooks/use-auth";

const mockUser = {
  user: { user: { name: "Test User", email: "test@example.com", role: "ADMIN" } },
  isLoading: false,
  error: null,
  isAuthenticated: true,
};

const mockProfileData = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  phone: "+1-555-0000",
  position: "Admin",
  avatar: null,
  role: "ADMIN",
  totpEnabled: false,
  emailVerified: null,
  createdAt: "2024-01-15T00:00:00.000Z",
};

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe("Profile Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useRealTimers();
    (useAuth as any).mockReturnValue(mockUser);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the page heading", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("My Profile")).toBeInTheDocument();
    expect(screen.getByText("Manage your personal information")).toBeInTheDocument();
  });

  it("renders personal information section", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("Personal Information")).toBeInTheDocument();
  });

  it("renders change password section", async () => {
    render(<ProfilePage />);
    const elements = await screen.findAllByText("Change Password");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Danger Zone section", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("Danger Zone")).toBeInTheDocument();
    expect(await screen.findByText("Delete Account")).toBeInTheDocument();
  });

  it("renders Two-Factor Authentication section", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("Two-Factor Authentication")).toBeInTheDocument();
  });

  it("renders Email Verification section", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("Email Verification")).toBeInTheDocument();
  });

  it("sends the verification email with the current locale and starts the resend cooldown", async () => {
    const sendCall = vi.fn().mockImplementation(() =>
      okJson({
        success: true,
        verificationUrl: "http://localhost:3010/api/auth/verify-email/confirm?token=abc&locale=en",
      }),
    );
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/verify-email/send") return sendCall();
      return okJson(mockProfileData);
    });

    render(<ProfilePage />);
    // Find the button with real timers (findBy* hangs under fake timers).
    const sendBtn = await screen.findByRole("button", { name: /Send Verification Email/i });
    vi.useFakeTimers();
    fireEvent.click(sendBtn);
    await act(async () => {}); // flush the async send handler

    // Sent with the current locale in the body; dev-mode link rendered.
    expect(sendCall).toHaveBeenCalledWith();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/verify-email/send", expect.any(Object));
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "/api/auth/verify-email/send",
    ) as [string, RequestInit];
    // The profile page forwards from: "profile" so the confirm link returns here.
    expect(JSON.parse(init.body as string)).toEqual({ locale: "en", from: "profile" });
    expect(screen.getByText(/\/api\/auth\/verify-email\/confirm\?token=/)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Verification email sent!");

    // Button disabled with a countdown, cooldown persisted.
    expect(screen.getByRole("button", { name: /Resend in/i })).toBeDisabled();
    expect(localStorage.getItem("email-verify-cooldown-until")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(61000);
    });
    // A link was shown, so the button now reads "Resend Email" (enabled).
    expect(screen.getByRole("button", { name: /Resend Email/i })).toBeEnabled();
    expect(localStorage.getItem("email-verify-cooldown-until")).toBeNull();
  });

  it("does not start a cooldown when the email is already verified", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/verify-email/send")
        return okJson({ success: true, alreadyVerified: true });
      return okJson(mockProfileData);
    });

    render(<ProfilePage />);
    const sendBtn = await screen.findByRole("button", { name: /Send Verification Email/i });
    fireEvent.click(sendBtn);
    await act(async () => {});

    expect(screen.getByRole("button", { name: /Send Verification Email/i })).toBeEnabled();
    expect(localStorage.getItem("email-verify-cooldown-until")).toBeNull();
  });

  it("restores an in-progress cooldown on mount", async () => {
    vi.useFakeTimers();
    const future = Date.now() + 30_000;
    localStorage.setItem("email-verify-cooldown-until", String(future));

    render(<ProfilePage />);
    await act(async () => {}); // flush the profile fetch

    // Synchronous queries: findBy* polls via timers which are faked here.
    const resendBtn = screen.getByRole("button", { name: /Resend in/i });
    expect(resendBtn).toBeDisabled();
    expect(
      screen.getByText(/A verification email was sent. You can request a new one in/),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(61000);
    });
    expect(screen.getByRole("button", { name: /Send Verification Email/i })).toBeEnabled();
    expect(localStorage.getItem("email-verify-cooldown-until")).toBeNull();
  });

  it("shows an error toast when returning from an invalid verification link", async () => {
    // Simulate arriving with ?verified=invalid in the URL.
    window.history.replaceState({}, "", "/en/profile?verified=invalid");

    render(<ProfilePage />);
    await act(async () => {});

    expect(toast.error).toHaveBeenCalledWith("This verification link is invalid or has expired.");
  });

  it("shows the email with an unverified badge in the profile header", async () => {
    render(<ProfilePage />);

    // Header shows the email address next to the user's name.
    expect(await screen.findByText("test@example.com")).toBeInTheDocument();
    // Amber "Unverified" badge (also shown in the avatar card status row).
    expect(screen.getAllByText("Unverified").length).toBeGreaterThanOrEqual(1);
    // No verified-on timestamp while unverified.
    expect(screen.queryByText(/Verified on/i)).not.toBeInTheDocument();
  });

  it("shows a verified badge with the verified-on date in the profile header", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ ...mockProfileData, emailVerified: "2024-06-01T00:00:00.000Z" }),
    } as Response);

    render(<ProfilePage />);

    expect(await screen.findByText("test@example.com")).toBeInTheDocument();
    // Green "Verified" badge (header + email-status row + email card).
    expect(screen.getAllByText("Verified").length).toBeGreaterThanOrEqual(1);
    // "Verified on {date}" appears in the header and the email card.
    expect(screen.getAllByText(/Verified on/i).length).toBeGreaterThanOrEqual(1);
  });
});

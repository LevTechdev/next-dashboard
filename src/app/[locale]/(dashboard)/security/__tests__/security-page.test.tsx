import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SecurityPage from "../page";

// Ensure real implementations are used for icon modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/security",
  useParams: () => ({ locale: "en" }),
}));

// SecurityCenter uses useConfirm for destructive actions; provide a no-op confirm
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(true)),
}));

const now = new Date().toISOString();

const mockSessions = [
  {
    id: "s1",
    ip: "103.10.10.1",
    browser: "Chrome",
    device: "Windows",
    location: "Jakarta",
    lastActiveAt: now,
    createdAt: now,
    current: true,
  },
  {
    id: "s2",
    ip: "203.0.113.7",
    browser: "Safari",
    device: "iPhone",
    location: "Singapore",
    lastActiveAt: now,
    createdAt: now,
    current: false,
  },
];

const mockEvents = [
  { id: "e1", type: "LOGIN", ip: "103.10.10.1", createdAt: now },
  { id: "e2", type: "PASSKEY_ADDED", ip: "103.10.10.1", createdAt: now },
  { id: "e3", type: "MFA_VERIFIED", ip: "103.10.10.1", createdAt: now },
];

const mockPasskeys = [{ id: "p1", deviceName: "MacBook Pro", createdAt: now, lastUsedAt: now }];

const mockProfile = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  totpEnabled: true,
  emailVerified: now,
};

describe("Security Center Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((input: unknown) => {
      const url = typeof input === "string" ? input : "";
      if (url.includes("/api/auth/sessions")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSessions) } as Response);
      }
      if (url.includes("/api/auth/security-events")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEvents) } as Response);
      }
      if (url.includes("/api/auth/backup-codes")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ remaining: 6 }),
        } as Response);
      }
      if (url.includes("/api/auth/webauthn/credentials")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPasskeys) } as Response);
      }
      if (url.includes("/api/profile")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    }) as unknown as typeof fetch;
  });

  it("renders the page heading and subtitle", async () => {
    render(<SecurityPage />);
    expect(screen.getByText("Security Center")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your sign-in methods, active sessions, and security activity."),
    ).toBeInTheDocument();
  });

  it("renders the security score banner", async () => {
    render(<SecurityPage />);
    expect(screen.getByText("Security score")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Your account is strongly protected.")).toBeInTheDocument();
    });
  });

  it("renders the unverified-email alert when the email is not verified", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((input: unknown) => {
      const url = typeof input === "string" ? input : "";
      if (url.includes("/api/profile")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockProfile, emailVerified: null }),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });

    render(<SecurityPage />);
    await waitFor(() => {
      expect(screen.getByText("Your email is not verified")).toBeInTheDocument();
    });
    // The alert links down to the email-verification card.
    const verifyNow = screen.getByText("Verify now");
    expect(verifyNow.closest("a")).toHaveAttribute("href", "#email-verification");
  });

  it("does not render the unverified-email alert once the email is verified", async () => {
    render(<SecurityPage />);
    await waitFor(() => {
      expect(screen.getByText("Email verified")).toBeInTheDocument();
    });
    expect(screen.queryByText("Your email is not verified")).not.toBeInTheDocument();
  });

  it("renders stat tiles from loaded data", async () => {
    render(<SecurityPage />);
    expect(screen.getByText("Two-Factor Auth")).toBeInTheDocument();
    expect(screen.getAllByText("Passkeys").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Active Sessions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Events · 7 days")).toBeInTheDocument();
    // Stat values derived from the mocked data (populate after fetch resolves)
    await waitFor(() => {
      expect(screen.getByText("Enabled")).toBeInTheDocument();
    });
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the two-factor authentication card", async () => {
    render(<SecurityPage />);
    expect(screen.getAllByText("Two-Factor Authentication").length).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(screen.getByText("Two-factor authentication is active")).toBeInTheDocument();
      expect(screen.getByText("Disable 2FA")).toBeInTheDocument();
    });
  });

  it("renders passkeys and backup code sections", async () => {
    render(<SecurityPage />);
    expect(screen.getByText("Add a passkey")).toBeInTheDocument();
    expect(screen.getByText("Backup Recovery Codes")).toBeInTheDocument();
    // backupRemaining > 0 renders the regenerate action (after fetch resolves)
    await waitFor(() => {
      expect(screen.getByText("Regenerate")).toBeInTheDocument();
    });
  });

  it("renders session rows with a revoke action for other devices", async () => {
    render(<SecurityPage />);
    await waitFor(() => {
      expect(screen.getByText("This device")).toBeInTheDocument();
    });
    // Non-current sessions show a revoke action (current one does not)
    expect(screen.getAllByText("Revoke").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Revoke all other sessions")).toBeInTheDocument();
  });

  it("renders the security activity feed", async () => {
    render(<SecurityPage />);
    await waitFor(() => {
      expect(screen.getByText("Signed in")).toBeInTheDocument();
      expect(screen.getByText("Passkey added")).toBeInTheDocument();
    });
  });

  it("revokes a session when the revoke button is clicked", async () => {
    render(<SecurityPage />);
    const revokeButton = await screen.findAllByText("Revoke");
    const deleteMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (input: unknown, init?: { method?: string }) => {
        const url = typeof input === "string" ? input : "";
        if (url.includes("/api/auth/sessions/s2") && init?.method === "DELETE") {
          return deleteMock();
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
      },
    );
    fireEvent.click(revokeButton[0]);
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
  });
});

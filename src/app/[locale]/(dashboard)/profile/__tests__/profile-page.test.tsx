import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfilePage from "../page";

// Ensure real implementations are used for icon modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

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

describe("Profile Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue(mockUser);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);
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
});

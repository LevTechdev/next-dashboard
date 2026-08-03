import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TeamPage from "../page";

// Ensure real implementations are used for icon/ui modules
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

// Mock confirm provider (page uses useConfirm for confirm dialogs)
vi.mock("@/components/ui/confirm-provider", () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
  ConfirmProvider: ({ children }: { children: any }) => <>{children}</>,
}));

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/team",
  useParams: () => ({ locale: "en" }),
}));

import { useAuth } from "@/hooks/use-auth";

const mockUser = {
  user: { name: "Admin User", email: "admin@test.com", role: "ADMIN" },
  isLoading: false,
  error: null,
  isAuthenticated: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  (useAuth as any).mockReturnValue(mockUser);
  // Mock fetch for team data
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve([
        {
          id: "1",
          name: "Alice",
          email: "alice@test.com",
          role: "ADMIN",
          position: "CEO",
          isActive: true,
          createdAt: "2024-01-15",
        },
        {
          id: "2",
          name: "Bob",
          email: "bob@test.com",
          role: "MANAGER",
          position: "Team Lead",
          isActive: true,
          createdAt: "2024-03-20",
        },
        {
          id: "3",
          name: "Charlie",
          email: "charlie@test.com",
          role: "STAFF",
          position: "Developer",
          isActive: false,
          createdAt: "2024-06-10",
        },
      ]),
  } as Response);
});

describe("Team Page", () => {
  it("renders the page heading", async () => {
    render(<TeamPage />);
    await waitFor(() => {});
    expect(screen.getByText("Team Management")).toBeInTheDocument();
    expect(screen.getByText("Manage your team members and their roles")).toBeInTheDocument();
  });

  it("renders the Add Member button", async () => {
    render(<TeamPage />);
    await waitFor(() => {});
    expect(screen.getByText("Add Member")).toBeInTheDocument();
  });

  it("renders the search input", async () => {
    render(<TeamPage />);
    await waitFor(() => {});
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    render(<TeamPage />);
    await waitFor(() => {});
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });
});

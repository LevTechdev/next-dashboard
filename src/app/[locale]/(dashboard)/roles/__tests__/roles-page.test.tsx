import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RolesPage from "../page";

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
  usePathname: () => "/en/roles",
  useParams: () => ({ locale: "en" }),
}));

import { useAuth } from "@/hooks/use-auth";

const mockUser = {
  user: { user: { name: "Admin", email: "admin@test.com", role: "ADMIN" } },
  isLoading: false,
  error: null,
  isAuthenticated: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  (useAuth as any).mockReturnValue(mockUser);
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        roleSettings: [],
        users: [
          { id: "1", name: "Alice", email: "alice@test.com", role: "ADMIN", isActive: true },
          { id: "2", name: "Bob", email: "bob@test.com", role: "MANAGER", isActive: true },
        ],
      }),
  } as Response);
});

describe("Roles Page", () => {
  it("renders the page heading", async () => {
    render(<RolesPage />);
    expect(
      await screen.findByText("Manage role-based access control across all resources"),
    ).toBeInTheDocument();
  });

  it("renders role overview cards", async () => {
    render(<RolesPage />);
    const adminElements = await screen.findAllByText("ADMIN");
    expect(adminElements.length).toBeGreaterThanOrEqual(1);
    const managerElements = await screen.findAllByText("MANAGER");
    expect(managerElements.length).toBeGreaterThanOrEqual(1);
    const staffElements = await screen.findAllByText("STAFF");
    expect(staffElements.length).toBeGreaterThanOrEqual(1);
  });
  it("renders tab navigation", async () => {
    render(<RolesPage />);
    expect(await screen.findByText("Permission Matrix")).toBeInTheDocument();
    expect(screen.getByText("Role Assignments")).toBeInTheDocument();
  });
});

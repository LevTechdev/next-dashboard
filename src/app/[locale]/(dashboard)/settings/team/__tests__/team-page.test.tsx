import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
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
import { ALL_ROLES, type Role } from "@/lib/permissions";

const ROLE_LABELS = ["Admin", "Manager", "Staff", "Auditor", "Client", "Client (Enterprise)"];

// Written independently of PAGE_ACCESS: if the route policy and this table
// disagree, the test should fail rather than repeat the implementation.
const EXPECTED_PAGE_ACCESS = {
  dashboard: {
    ADMIN: true,
    MANAGER: true,
    STAFF: true,
    AUDITOR: true,
    CLIENT: true,
    CLIENT_ENTERPRISE: true,
  },
  orders: {
    ADMIN: true,
    MANAGER: true,
    STAFF: true,
    AUDITOR: true,
    CLIENT: true,
    CLIENT_ENTERPRISE: true,
  },
  products: {
    ADMIN: true,
    MANAGER: true,
    STAFF: false,
    AUDITOR: true,
    CLIENT: false,
    CLIENT_ENTERPRISE: false,
  },
  customers: {
    ADMIN: true,
    MANAGER: true,
    STAFF: false,
    AUDITOR: true,
    CLIENT: false,
    CLIENT_ENTERPRISE: false,
  },
  team: {
    ADMIN: true,
    MANAGER: false,
    STAFF: false,
    AUDITOR: true,
    CLIENT: false,
    CLIENT_ENTERPRISE: false,
  },
  settings: {
    ADMIN: true,
    MANAGER: false,
    STAFF: false,
    AUDITOR: true,
    CLIENT: false,
    CLIENT_ENTERPRISE: false,
  },
  billing: {
    ADMIN: true,
    MANAGER: true,
    STAFF: false,
    AUDITOR: true,
    CLIENT: true,
    CLIENT_ENTERPRISE: true,
  },
  "audit-log": {
    ADMIN: true,
    MANAGER: false,
    STAFF: false,
    AUDITOR: true,
    CLIENT: false,
    CLIENT_ENTERPRISE: false,
  },
} satisfies Record<string, Record<Role, boolean>>;

async function expectCanonicalRoleOptions(dialog: HTMLElement) {
  // Some dialogs also have an expiry select; the role picker is first.
  const trigger = within(dialog).getAllByRole("combobox")[0];
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);

  const options = await screen.findAllByRole("option");
  expect(options.map((option) => option.textContent?.trim())).toEqual(ROLE_LABELS);
}

const mockUser = {
  user: { name: "Admin User", email: "admin@test.com", role: "ADMIN" },
  isLoading: false,
  error: null,
  isAuthenticated: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Radix Select relies on pointer capture and scrollIntoView in the browser;
  // jsdom does not implement either.
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.scrollIntoView = vi.fn();
  (useAuth as any).mockReturnValue(mockUser);
  // Mock fetch for team data and invitations
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/team/invitations")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            invitations: [
              {
                id: "inv-901",
                email: "alex.dev@partner.com",
                role: "MANAGER",
                allowedChannels: ["Online Store", "Instagram"],
                invitedBy: "Admin",
                token: "tok_901_alpha",
                status: "pending",
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
                createdAt: new Date().toISOString(),
              },
            ],
          }),
      } as Response);
    }
    return Promise.resolve({
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
    // "Name" now appears twice (sort dropdown + table header) — assert on
    // the header cell specifically.
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Joined")).toBeInTheDocument();
  });

  it("renders the complete canonical permission matrix", async () => {
    render(<TeamPage />);
    await waitFor(() => {});

    fireEvent.mouseDown(screen.getByRole("tab", { name: /permissions/i }));
    await waitFor(() => {
      expect(screen.getByTestId("permission-dashboard-ADMIN")).toBeInTheDocument();
    });

    for (const [page, expected] of Object.entries(EXPECTED_PAGE_ACCESS)) {
      for (const role of ALL_ROLES) {
        expect(
          screen.getByTestId(`permission-${page}-${role}`),
          `${page} × ${role}`,
        ).toHaveAttribute("data-allowed", String(expected[role]));
      }
    }
  });

  it("offers every canonical role in the add-member picker", async () => {
    render(<TeamPage />);
    await waitFor(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Add Member" }));
    const dialog = await screen.findByRole("dialog");
    await expectCanonicalRoleOptions(dialog);
  });

  it("offers every canonical role in the invitation picker", async () => {
    render(<TeamPage />);
    await waitFor(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Invite Member" }));
    const dialog = await screen.findByRole("dialog");
    await expectCanonicalRoleOptions(dialog);
  });

  it("offers every canonical role in the edit-invitation picker", async () => {
    render(<TeamPage />);
    await waitFor(() => {});

    fireEvent.mouseDown(screen.getByRole("tab", { name: /invitations/i }));
    await waitFor(() => {
      expect(screen.getByText("alex.dev@partner.com")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const dialog = await screen.findByRole("dialog");
    await expectCanonicalRoleOptions(dialog);
  });

  it("renders invitations tab and displays edit & remove actions for pending invites", async () => {
    render(<TeamPage />);
    await waitFor(() => {});

    // Find and click the Invitations tab (Radix Tabs activate on mouseDown)
    const inviteTab = screen.getByRole("tab", { name: /invitations/i });
    expect(inviteTab).toBeInTheDocument();
    fireEvent.mouseDown(inviteTab);

    await waitFor(() => {
      expect(screen.getByText("alex.dev@partner.com")).toBeInTheDocument();
    });

    // Check for Edit button
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    // Check for Remove button
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });
});

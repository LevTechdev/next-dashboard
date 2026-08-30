import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../sidebar";

// Mock next-intl using shared helper (async import avoids vitest hoisting issues)
vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  return mod.createTranslationsMock(
    mod.mergeMessages(
      mod.navMessages,
      mod.appMessages,
      mod.salesMessages,
      mod.commonMessages,
      mod.dashboardMessages,
    ),
  );
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
  useParams: () => ({ locale: "en" }),
}));

// Mock useAuth
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: { user: { name: "Admin User", email: "admin@test.com", role: "ADMIN" } },
    isLoading: false,
    error: null,
    isAuthenticated: true,
  })),
}));

describe("Sidebar", () => {
  const defaultProps = {
    collapsed: false,
    onToggle: vi.fn(),
  };

  it("renders the sidebar with brand name", () => {
    render(<Sidebar {...defaultProps} />);
    // "Dashboard" appears twice: as the brand name and as a nav item
    const dashboardTexts = screen.getAllByText("Dashboard");
    expect(dashboardTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Management System")).toBeInTheDocument();
  });

  it("renders main navigation items", () => {
    render(<Sidebar {...defaultProps} />);
    // "Dashboard" appears both as brand name and nav item
    const dashboardTexts = screen.getAllByText("Dashboard");
    expect(dashboardTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("renders management section items", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Discounts")).toBeInTheDocument();
  });

  it("renders insights section items", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("renders account section items", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders admin section items", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
  });

  it("renders collapse button", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("renders in collapsed mode without text labels", () => {
    const { container } = render(<Sidebar collapsed={true} onToggle={vi.fn()} />);
    // Should not show text labels in collapsed mode
    expect(screen.queryByText("Management System")).not.toBeInTheDocument();
    expect(screen.queryByText("Collapse")).not.toBeInTheDocument();
  });

  it("renders sales channels section when not collapsed", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("Sales Channels")).toBeInTheDocument();
    expect(screen.getByText("Online Store")).toBeInTheDocument();
    expect(screen.getByText("Facebook")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText("Shopify")).toBeInTheDocument();
  });
});

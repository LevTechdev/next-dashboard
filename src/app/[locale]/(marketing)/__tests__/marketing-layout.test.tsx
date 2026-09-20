import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketingLayout from "../layout";

// Signed-out, fully-loaded session so the header renders its auth CTAs
// (the real hook defaults to isLoading=true, which shows a skeleton).
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isLoading: false,
    error: null,
    isAuthenticated: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    updateUser: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Helper to render the layout with mock children
function renderLayout() {
  return render(
    <MarketingLayout>
      <div data-testid="child-content">Page Content</div>
    </MarketingLayout>,
  );
}

describe("Marketing Layout", () => {
  it("renders the logo and brand name with accessible home link", () => {
    renderLayout();
    // "Dashboard" appears in both the header and footer brand lockups
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(2);

    // Logo links point to the locale root
    const logoLink = screen.getAllByText("Dashboard")[0].closest("a");
    expect(logoLink).toHaveAttribute("href");
    expect(logoLink?.getAttribute("href")).toBe("/en");
  });

  it("renders all desktop nav links with proper hrefs", () => {
    renderLayout();
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Integrations").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pricing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Changelog").length).toBeGreaterThanOrEqual(1);

    const featuresLink = screen.getAllByText("Features")[0].closest("a");
    expect(featuresLink).toHaveAttribute("href", "/en/features");

    const integrationsLink = screen.getAllByText("Integrations")[0].closest("a");
    expect(integrationsLink).toHaveAttribute("href", "/en/integrations-overview");

    const pricingLink = screen.getAllByText("Pricing")[0].closest("a");
    expect(pricingLink).toHaveAttribute("href", "/en/pricing");

    const changelogLink = screen.getAllByText("Changelog")[0].closest("a");
    expect(changelogLink).toHaveAttribute("href", "/en/changelog");
  });

  it("renders auth CTAs for signed-out visitors", () => {
    renderLayout();
    const signIn = screen.getByText("Sign in");
    expect(signIn.closest("a")).toHaveAttribute("href", "/en/login");

    const signUp = screen.getByText("Sign up");
    expect(signUp.closest("a")).toHaveAttribute("href", "/en/register");
  });

  it("renders mobile menu button with proper aria-label", () => {
    renderLayout();
    const menuButton = screen.getByLabelText("Toggle menu");
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-label", "Toggle menu");
  });

  it("renders child content in the main area", () => {
    renderLayout();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("renders footer description", () => {
    renderLayout();
    expect(
      screen.getByText(/Empowering businesses with reliable, scalable, and innovative solutions/),
    ).toBeInTheDocument();
  });

  it("renders footer Product links with proper hrefs", () => {
    renderLayout();
    expect(screen.getByText("Solutions")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Integrations").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Changelog").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pricing").length).toBeGreaterThanOrEqual(1);

    const featuresLinks = document.querySelectorAll('a[href="/en/features"]');
    expect(featuresLinks.length).toBeGreaterThanOrEqual(1);
    const integrationsLinks = document.querySelectorAll('a[href="/en/integrations-overview"]');
    expect(integrationsLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders footer Company section with links", () => {
    renderLayout();
    expect(screen.getByText("Company")).toBeInTheDocument();

    const aboutLink = document.querySelector('a[href="/en/about"]');
    expect(aboutLink).toBeInTheDocument();

    // Careers is a real page now, not a placeholder.
    const careersLink = [...document.querySelectorAll("a")].find(
      (a) => a.textContent === "Careers",
    );
    expect(careersLink).toHaveAttribute("href", "/en/careers");
  });

  it("renders copyright notice with current year", () => {
    renderLayout();
    const currentYear = new Date().getFullYear().toString();
    expect(
      screen.getByText(new RegExp(`© ${currentYear} Next Dashboard\\. All rights reserved\\.`)),
    ).toBeInTheDocument();
  });
});

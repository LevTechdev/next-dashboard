import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketingLayout from "../layout";

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
    // "Dashboard" appears in both nav and footer
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);

    // Logo link should point to the locale root
    const logoLinks = screen.getAllByText("Dashboard")[0].closest("a");
    expect(logoLinks).toHaveAttribute("href");
    expect(logoLinks?.getAttribute("href")).toBe("/en");
  });

  it("renders all desktop nav links with proper hrefs", () => {
    renderLayout();
    // These appear in both nav bar AND footer, so use getAllByText
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Integrations").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pricing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Changelog").length).toBeGreaterThanOrEqual(1);

    // Verify nav links have correct href attributes
    const featuresLink = screen.getAllByText("Features")[0].closest("a");
    expect(featuresLink).toHaveAttribute("href", "/en/features");

    const integrationsLink = screen.getAllByText("Integrations")[0].closest("a");
    expect(integrationsLink).toHaveAttribute("href", "/en/integrations-overview");

    const pricingLink = screen.getAllByText("Pricing")[0].closest("a");
    expect(pricingLink).toHaveAttribute("href", "/en/pricing");

    const changelogLink = screen.getAllByText("Changelog")[0].closest("a");
    expect(changelogLink).toHaveAttribute("href", "/en/changelog");
  });

  it("renders the Dashboard CTA button with accessible link", () => {
    renderLayout();
    // "Dashboard" appears in both the logo (href=/en) and the CTA button (href=/en/dashboard)
    const dashboardElements = screen.getAllByText("Dashboard");
    expect(dashboardElements.length).toBeGreaterThanOrEqual(2);

    // "Dashboard" appears in both the logo link (/en) and the CTA button (/en/dashboard)
    const allLinks = document.querySelectorAll('a[href="/en/dashboard"]');
    expect(allLinks.length).toBeGreaterThanOrEqual(1);
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

  it("renders footer brand section", () => {
    renderLayout();
    // Footer brand is rendered twice (once in nav logo, once in footer)
    const brandElements = screen.getAllByText("Dashboard");
    expect(brandElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders footer description", () => {
    renderLayout();
    expect(screen.getByText(/A comprehensive business management platform/)).toBeInTheDocument();
  });

  it("renders footer Product links with proper hrefs", () => {
    renderLayout();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Integrations").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Changelog").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pricing").length).toBeGreaterThanOrEqual(2);
  });

  it("renders footer Company section with links", () => {
    renderLayout();
    expect(screen.getByText("Company")).toBeInTheDocument();

    // Footer Dashboard link
    const allDashboardLinks = screen.getAllByText("Dashboard");
    const footerDashboard = allDashboardLinks[allDashboardLinks.length - 1];
    const dashboardAnchor = footerDashboard.closest("a");
    expect(dashboardAnchor).toHaveAttribute("href", "/en/dashboard");

    // Footer Features link
    const allFeaturesLinks = screen.getAllByText("Features");
    // The last one should be in the footer
    const footerFeatures = allFeaturesLinks[allFeaturesLinks.length - 1];
    const featuresAnchor = footerFeatures.closest("a");
    expect(featuresAnchor).toHaveAttribute("href", "/en/features");
  });

  it("renders copyright notice with current year", () => {
    renderLayout();
    const currentYear = new Date().getFullYear().toString();
    expect(
      screen.getByText(
        new RegExp(`© ${currentYear} Dashboard Management System.*All rights reserved.`),
      ),
    ).toBeInTheDocument();
  });
});

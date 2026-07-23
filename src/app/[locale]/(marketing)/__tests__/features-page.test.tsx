import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FeaturesPage from "../features/page";

beforeEach(() => {
  render(<FeaturesPage />);
});

describe("Features Page", () => {
  it("renders the cinematic header", () => {
    expect(screen.getByText("Powerful Capabilities")).toBeInTheDocument();
    // The h1 renders "Everything You Need to " + FlipFadeText cycling through words
    expect(screen.getByText("Everything You Need to")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    // TextAnimate renders the text twice (sr-only + animated), so use getAllByText
    const descriptions = screen.getAllByText(
      /From real-time analytics to team collaboration/
    );
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
  });

  it("renders feature group titles", () => {
    expect(screen.getByText("Analytics & Insights")).toBeInTheDocument();
    expect(screen.getByText("Order & Customer Management")).toBeInTheDocument();
    expect(screen.getByText("Marketing & Growth")).toBeInTheDocument();
    expect(screen.getByText("Team & Security")).toBeInTheDocument();
  });

  it("renders all feature items across groups", () => {
    // Analytics group
    expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Revenue Analytics")).toBeInTheDocument();
    expect(screen.getByText("Sales Reports")).toBeInTheDocument();
    expect(screen.getByText("Channel Analytics")).toBeInTheDocument();

    // Orders group
    expect(screen.getByText("Multi-Channel Orders")).toBeInTheDocument();
    expect(screen.getByText("Customer Profiles")).toBeInTheDocument();
    expect(screen.getByText("Inventory Tracking")).toBeInTheDocument();
    expect(screen.getByText("Order Tracking")).toBeInTheDocument();

    // Marketing group
    expect(screen.getByText("Campaign Management")).toBeInTheDocument();
    expect(screen.getByText("Discount Engine")).toBeInTheDocument();
    expect(screen.getByText("Growth Analytics")).toBeInTheDocument();
    expect(screen.getByText("Data Export")).toBeInTheDocument();

    // Security group
    expect(screen.getByText("Role-Based Access")).toBeInTheDocument();
    expect(screen.getByText("Team Management")).toBeInTheDocument();
    expect(screen.getByText("Real-Time Updates")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("renders feature icons with semantic identifiers", () => {
    // Feature icons provide visual semantics for each card
    // Clock and RefreshCw appear twice each (in feature items + performance highlights)
    const duplicateIcons = [
      "icon-clock",
      "icon-refreshcw",
    ];

    const iconTestIds = [
      "icon-layoutdashboard",
      "icon-barchart3",
      "icon-filetext",
      "icon-piechart",
      "icon-shoppingcart",
      "icon-users",
      "icon-package",
      "icon-megaphone",
      "icon-tag",
      "icon-trendingup",
      "icon-download",
      "icon-shield",
      "icon-usercheck",
      "icon-checkcircle",
    ];
    for (const id of iconTestIds) {
      const elements = screen.getAllByTestId(id);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
    // Verify duplicated icons appear the expected number of times
    for (const id of duplicateIcons) {
      expect(screen.getAllByTestId(id).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("renders performance highlights section", () => {
    expect(screen.getByText("Built for performance")).toBeInTheDocument();
    expect(screen.getByText("Sub-second Response Times")).toBeInTheDocument();
    expect(screen.getByText("99.9% Uptime Guarantee")).toBeInTheDocument();
    expect(screen.getByText("Real-Time Data Sync")).toBeInTheDocument();
  });

  it("renders CTA with accessible link", () => {
    expect(screen.getByText("Ready to Get Started?")).toBeInTheDocument();

    const ctaButton = screen.getByText("Go to Dashboard");
    expect(ctaButton).toBeInTheDocument();

    // Verify the CTA link has a proper href
    const anchor = ctaButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/dashboard");
  });
});

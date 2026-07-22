import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PricingPage from "../pricing/page";

beforeEach(() => {
  render(<PricingPage />);
});

describe("Pricing Page", () => {
  it("renders the header section", () => {
    expect(screen.getByText("Simple Pricing")).toBeInTheDocument();
    expect(screen.getByText("Scale With You")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(
      screen.getByText(/Choose the perfect plan/)
    ).toBeInTheDocument();
  });

  it("renders all 3 pricing tiers", () => {
    // Tier names appear in both pricing cards and comparison table headers
    expect(screen.getAllByText("Starter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Professional").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Enterprise").length).toBeGreaterThanOrEqual(1);
  });

  it("renders pricing values", () => {
    expect(screen.getByText("$29")).toBeInTheDocument();
    expect(screen.getByText("$79")).toBeInTheDocument();
    expect(screen.getByText("$199")).toBeInTheDocument();
  });

  it("renders Most Popular badge on Professional", () => {
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("renders CTA buttons with accessible links for each plan", () => {
    const goToDashboardButtons = screen.getAllByText("Go to Dashboard");
    expect(goToDashboardButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Contact Sales")).toBeInTheDocument();

    // Verify each CTA link has a proper href
    for (const button of goToDashboardButtons) {
      const anchor = button.closest("a");
      expect(anchor).toHaveAttribute("href");
      expect(anchor?.getAttribute("href")).toContain("/dashboard");
    }

    const contactSales = screen.getByText("Contact Sales");
    const contactAnchor = contactSales.closest("a");
    expect(contactAnchor).toHaveAttribute("href");
    expect(contactAnchor?.getAttribute("href")).toContain("/dashboard");
  });

  it("renders feature lists", () => {
    expect(screen.getByText("Up to 500 orders/month")).toBeInTheDocument();
    expect(screen.getByText("Up to 5,000 orders/month")).toBeInTheDocument();
    expect(screen.getByText("Unlimited orders")).toBeInTheDocument();
    expect(screen.getByText("3 team members")).toBeInTheDocument();
    expect(screen.getByText("10 team members")).toBeInTheDocument();
    expect(screen.getByText("Unlimited team members")).toBeInTheDocument();
  });

  it("renders the comparison table with semantic table structure", () => {
    expect(screen.getByText("Compare plans")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();

    // Verify table has proper accessible structure
    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute("class");

    // Table headers render tier names
    const starterHeaders = screen.getAllByText("Starter");
    expect(starterHeaders.length).toBeGreaterThanOrEqual(2); // card + table header
  });

  it("renders FAQ section with semantic details elements", () => {
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();

    // Verify FAQ uses semantic HTML5 <details>/<summary> elements
    const faqQuestions = [
      "Can I upgrade or downgrade my plan at any time?",
      "Is there a free trial available?",
      "What payment methods do you accept?",
      "Can I cancel my subscription?",
    ];

    for (const question of faqQuestions) {
      expect(screen.getByText(question)).toBeInTheDocument();

      // Each FAQ question should be wrapped in a <summary> inside <details>
      const summary = screen.getByText(question).closest("summary");
      expect(summary).toBeInTheDocument();
      const details = summary?.closest("details");
      expect(details).toBeInTheDocument();
    }
  });

  it("renders FAQ answers with accessible content", () => {
    expect(
      screen.getByText(/Yes, you can change your plan at any time/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Yes! All plans come with a 14-day free trial/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We accept all major credit cards/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Yes, you can cancel anytime/)
    ).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Not Sure Which Plan?")).toBeInTheDocument();

    const trialTexts = screen.getAllByText(/14-day free trial/);
    expect(trialTexts.length).toBeGreaterThanOrEqual(1);

    // Bottom CTA button
    const ctaButtons = screen.getAllByText("Go to Dashboard");
    const bottomCta = ctaButtons[ctaButtons.length - 1];
    const anchor = bottomCta.closest("a");
    expect(anchor).toHaveAttribute("href");
  });
});

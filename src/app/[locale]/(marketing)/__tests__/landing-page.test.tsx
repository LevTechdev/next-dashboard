import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "../page";

const params = { status: "fulfilled", value: { locale: "en" }, then: () => {} } as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<LandingPage params={params} />);
});

describe("Marketing Landing Page", () => {
  it("renders the hero section with headline", () => {
    expect(screen.getByText("Business Management Platform")).toBeInTheDocument();
    expect(screen.getByText("Your Business,")).toBeInTheDocument();
    expect(screen.getByText("Fully Unified")).toBeInTheDocument();
  });

  it("renders the hero description", () => {
    expect(screen.getByText(/One platform to manage orders, customers, products, payments/)).toBeInTheDocument();
  });

  it("renders CTA buttons with accessible links", () => {
    const freeButtons = screen.getAllByText("Get Started Free");
    expect(freeButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Live Demo")).toBeInTheDocument();

    // Verify CTA links have proper href attributes
    for (const button of freeButtons) {
      const anchor = button.closest("a");
      expect(anchor).toHaveAttribute("href");
      expect(anchor?.getAttribute("href")).toContain("/register");
    }

    const demoLink = screen.getByText("Live Demo").closest("a");
    expect(demoLink).toHaveAttribute("href");
    expect(demoLink?.getAttribute("href")).toContain("/login");
  });

  it("renders trust badges", () => {
    expect(screen.getByText("No credit card required")).toBeInTheDocument();
    expect(screen.getByText("Deploy in minutes")).toBeInTheDocument();
    expect(screen.getByText("Multi-tenant ready")).toBeInTheDocument();
    expect(screen.getByText("SOC 2 compliant")).toBeInTheDocument();
  });

  it("renders the dashboard preview stats strip", () => {
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
  });

  it("renders the bento grid platform features section", () => {
    expect(screen.getByText("Platform Features")).toBeInTheDocument();
    expect(screen.getByText(/Everything You Need/)).toBeInTheDocument();
    expect(screen.getByText(/From order management to enterprise security/)).toBeInTheDocument();
  });

  it("renders bento grid feature cards", () => {
    expect(screen.getByText("Revenue Overview")).toBeInTheDocument();
    expect(screen.getByText("Multi-Channel Commerce")).toBeInTheDocument();
    expect(screen.getByText("Recent Orders")).toBeInTheDocument();
    expect(screen.getByText("Top Products")).toBeInTheDocument();
    expect(screen.getByText("Dual Payment Gateway")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Security")).toBeInTheDocument();
    expect(screen.getByText("AI Business Assistant")).toBeInTheDocument();
    expect(screen.getByText("Platform Integrations")).toBeInTheDocument();
    expect(screen.getByText("REST API & Webhooks")).toBeInTheDocument();
    expect(screen.getByText("Live Dashboard Updates")).toBeInTheDocument();
  });

  it("renders the why teams choose us section", () => {
    expect(screen.getByText("Why Teams Choose Us")).toBeInTheDocument();
    // Text is split by <br /> tag
    expect(screen.getByText(/Built for Modern/)).toBeInTheDocument();
    expect(screen.getByText(/Commerce Teams/)).toBeInTheDocument();
    expect(screen.getByText("Multi-Channel Order Management")).toBeInTheDocument();
    expect(screen.getByText("Advanced Analytics & Reports")).toBeInTheDocument();
    expect(screen.getByText("Role-Based Access Control")).toBeInTheDocument();
    expect(screen.getByText("Smart Notifications")).toBeInTheDocument();
  });

  it("renders the stats grid", () => {
    expect(screen.getByText("1.8M+")).toBeInTheDocument();
    expect(screen.getByText("$48M+")).toBeInTheDocument();
    expect(screen.getByText("<200ms")).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
  });

  it("renders the pricing section", () => {
    expect(screen.getByText("Simple, Transparent Pricing")).toBeInTheDocument();
    expect(screen.getByText("Start free, scale when you need to.")).toBeInTheDocument();
    expect(screen.getAllByText("Starter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
  });

  it("renders testimonials", () => {
    expect(screen.getByText("Ahmad Rizki")).toBeInTheDocument();
    expect(screen.getByText("CEO, TokoBaju.id")).toBeInTheDocument();
    expect(screen.getByText("Jessica Wu")).toBeInTheDocument();
    expect(screen.getByText("Head of Growth, NexCommerce")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("CTO, Startup Accelerator")).toBeInTheDocument();
  });

  it("renders the bottom CTA section", () => {
    expect(screen.getByText(/Join thousands of businesses/)).toBeInTheDocument();
  });
});

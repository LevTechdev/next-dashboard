import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FeaturesPage from "../features/page";

const params = {
  status: "fulfilled",
  value: { locale: "en" },
  then: () => {},
} as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<FeaturesPage params={params} />);
});

describe("Features Page", () => {
  it("renders the hero badge and headline", () => {
    expect(screen.getByText("Platform Features")).toBeInTheDocument();
    expect(screen.getByText("Everything you need,")).toBeInTheDocument();
    expect(screen.getByText("built right in.")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(
      screen.getByText(/A comprehensive suite of tools designed to help you manage orders/),
    ).toBeInTheDocument();
  });

  it("renders all 6 feature cards", () => {
    expect(screen.getByText("Unified Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Order Management")).toBeInTheDocument();
    expect(screen.getByText("Advanced Analytics")).toBeInTheDocument();
    expect(screen.getByText("Inventory Control")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Security")).toBeInTheDocument();
    expect(screen.getByText("Global Commerce")).toBeInTheDocument();
  });

  it("renders feature card descriptions", () => {
    expect(screen.getByText(/bird's-eye view of your entire business/)).toBeInTheDocument();
    expect(screen.getByText(/Process orders faster with automated workflows/)).toBeInTheDocument();
    expect(
      screen.getByText(/Make data-driven decisions with detailed reports/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Never run out of stock/)).toBeInTheDocument();
    expect(screen.getByText(/bank-grade encryption/)).toBeInTheDocument();
    expect(screen.getByText(/Sell anywhere in the world/)).toBeInTheDocument();
  });

  it("renders performance highlights section", () => {
    expect(screen.getByText("Built for Performance")).toBeInTheDocument();
    expect(screen.getByText("Sub-200ms API")).toBeInTheDocument();
    expect(screen.getByText("99.9% Uptime")).toBeInTheDocument();
    expect(screen.getByText("Real-time Sync")).toBeInTheDocument();
  });

  it("renders performance descriptions", () => {
    expect(screen.getByText(/incredibly fast load times/)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise-grade reliability/)).toBeInTheDocument();
    expect(screen.getByText(/Data syncs instantly across all devices/)).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Ready to upgrade your workflow?")).toBeInTheDocument();
    expect(screen.getByText(/Join thousands of businesses/)).toBeInTheDocument();

    const ctaButton = screen.getByText("Get Started Free");
    expect(ctaButton).toBeInTheDocument();

    const anchor = ctaButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/register");
  });
});

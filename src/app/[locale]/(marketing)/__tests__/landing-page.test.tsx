import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "../page";

const params = { status: "fulfilled", value: { locale: "en" }, then: () => {} } as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<LandingPage params={params} />);
});

describe("Marketing Landing Page", () => {
  it("renders the hero section with headline", () => {
    expect(screen.getByText("Operate with")).toBeInTheDocument();
    // "Trusted by" appears in both subtext and section heading
    expect(screen.getAllByText(/Trusted by/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the beta badge", () => {
    expect(screen.getByText("Now in Public Beta")).toBeInTheDocument();
  });

  it("renders the hero description", () => {
    expect(screen.getByText(/Stop wrestling with fragmented data/)).toBeInTheDocument();
  });

  it("renders CTA buttons with accessible links", () => {
    expect(screen.getByText("Enter Dashboard")).toBeInTheDocument();
    expect(screen.getByText("View Documentation")).toBeInTheDocument();

    // Verify CTA links have proper href attributes
    const ctaLinks = screen.getAllByText("Enter Dashboard");
    for (const link of ctaLinks) {
      const anchor = link.closest("a");
      expect(anchor).toHaveAttribute("href");
      expect(anchor?.getAttribute("href")).toContain("/dashboard");
    }

    const docsLink = screen.getByText("View Documentation").closest("a");
    expect(docsLink).toHaveAttribute("href");
    expect(docsLink?.getAttribute("href")).toContain("/features");
  });

  it("renders trust metric with business count", () => {
    // "Trusted by" appears in both subtext and section heading
    expect(screen.getAllByText(/Trusted by/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2,000\+/)).toBeInTheDocument();
  });

  it("renders the Platform Capabilities section", () => {
    expect(screen.getByText("Platform Capabilities")).toBeInTheDocument();
  });

  it("renders all 4 feature cards", () => {
    expect(screen.getByText("Real-Time Analytics")).toBeInTheDocument();
    expect(screen.getByText("Multi-Channel Orders")).toBeInTheDocument();
    expect(screen.getByText("Customer Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Role-Based Security")).toBeInTheDocument();
  });

  it("renders the metrics strip with 4 stats", () => {
    // Some values appear in both hero dashboard mockup AND metrics strip
    expect(screen.getAllByText("12.4K").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("99.9%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2,847").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("15s").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Orders Processed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Uptime SLA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Active Users").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Data Refresh").length).toBeGreaterThanOrEqual(1);
  });

  it("renders both testimonials", () => {
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText("Operations Director, Pixelcraft")).toBeInTheDocument();
    expect(screen.getByText("Marcus Rivera")).toBeInTheDocument();
    expect(screen.getByText("CTO, Studio Nine")).toBeInTheDocument();
  });

  it("renders icons for feature cards", () => {
    // Lucide icons render as SVG elements (mocked with data-testid in setup)
    const iconElements = document.querySelectorAll("svg");
    expect(iconElements.length).toBeGreaterThan(0);
  });

  it("renders the bottom CTA section", () => {
    expect(screen.getByText("Ready for scale.")).toBeInTheDocument();
    expect(screen.getByText(/Deploy Dashboard in minutes/)).toBeInTheDocument();
  });
});

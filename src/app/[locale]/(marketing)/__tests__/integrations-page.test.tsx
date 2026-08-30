import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import IntegrationsOverviewPage from "../integrations-overview/page";

const params = { status: "fulfilled", value: { locale: "en" }, then: () => {} } as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<IntegrationsOverviewPage params={params} />);
});

describe("Integrations Overview Page", () => {
  it("renders the header section", () => {
    // Badge text is "Seamless Integrations"
    expect(screen.getByText("Seamless Integrations")).toBeInTheDocument();
    // The h1 renders "Connect Your " + FlipFadeText cycling through words
    expect(screen.getByText("Connect Your")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(
      screen.getByText(/Seamlessly connect with the tools you already use/),
    ).toBeInTheDocument();
  });

  it("renders all integration cards", () => {
    // Stripe appears in both cards grid and status mockup
    expect(screen.getAllByText("Stripe").length).toBeGreaterThanOrEqual(1);
    // Shopify appears in both cards grid and status mockup
    expect(screen.getAllByText("Shopify").length).toBeGreaterThanOrEqual(1);
    // SendGrid, Slack, and Zapier appear in both cards grid and status mockup
    expect(screen.getAllByText("SendGrid").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("AWS")).toBeInTheDocument();
    expect(screen.getByText("Google Analytics")).toBeInTheDocument();
    expect(screen.getAllByText("Zapier").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Facebook & Instagram")).toBeInTheDocument();
  });

  it("shows Popular badge on popular integrations", () => {
    const popularBadges = screen.getAllByText("Popular");
    expect(popularBadges.length).toBeGreaterThanOrEqual(4);
  });

  it("renders categories section", () => {
    expect(screen.getByText("Explore by Category")).toBeInTheDocument();
    expect(screen.getByText("E-commerce & POS")).toBeInTheDocument();
    expect(screen.getByText("Payments & Billing")).toBeInTheDocument();
    // "Communication" appears as both a category name and Slack's category label
    expect(screen.getAllByText("Communication").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Data & Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Marketing & Analytics")).toBeInTheDocument();
    expect(screen.getByText("Automation & Workflows")).toBeInTheDocument();
  });

  it("renders category counts", () => {
    expect(screen.getByText("12 integrations")).toBeInTheDocument();
    expect(screen.getByText("8 integrations")).toBeInTheDocument();
    expect(screen.getByText("6 integrations")).toBeInTheDocument();
    expect(screen.getByText("14 integrations")).toBeInTheDocument();
    expect(screen.getByText("10 integrations")).toBeInTheDocument();
    expect(screen.getByText("20+ integrations")).toBeInTheDocument();
  });

  it("renders features highlights section", () => {
    expect(screen.getByText("Built for Seamless Connections")).toBeInTheDocument();
    expect(
      screen.getByText(/Every integration is built with reliability and developer/),
    ).toBeInTheDocument();
  });

  it("renders integration feature points", () => {
    expect(screen.getByText("Real-time bidirectional data sync")).toBeInTheDocument();
    expect(screen.getByText("OAuth 2.0 secure authentication")).toBeInTheDocument();
    expect(screen.getByText("Automatic retry with exponential backoff")).toBeInTheDocument();
    expect(screen.getByText("Webhook support for event-driven updates")).toBeInTheDocument();
    expect(screen.getByText("Rate limiting and quota management")).toBeInTheDocument();
    expect(screen.getByText("Detailed sync logs and audit trail")).toBeInTheDocument();
  });

  it("renders the status mockup with integration names", () => {
    // Stripe and Connected appear in multiple places
    expect(screen.getAllByText("Stripe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Connected").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("renders API section with accessible CTA", () => {
    expect(screen.getByText("Build Your Own Integration")).toBeInTheDocument();

    const apiButton = screen.getByText("View API Docs");
    expect(apiButton).toBeInTheDocument();

    // Verify the API docs link has a proper href
    const anchor = apiButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/dashboard");
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Start Connecting Today")).toBeInTheDocument();
    expect(screen.getByText(/No credit card required/)).toBeInTheDocument();

    const ctaButton = screen.getByText("Go to Dashboard");
    expect(ctaButton).toBeInTheDocument();

    // Verify CTA link has a proper href
    const anchor = ctaButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/dashboard");
  });

  describe("Integration Stats Section", () => {
    it("renders all 4 integration stat labels", () => {
      expect(screen.getByText("Total Integrations")).toBeInTheDocument();
      expect(screen.getByText("Active Connections")).toBeInTheDocument();
      expect(screen.getByText("API Requests/mo")).toBeInTheDocument();
      expect(screen.getByText("Platforms")).toBeInTheDocument();
    });

    it("renders integration stat values with suffixes", async () => {
      expect(await screen.findByText("70+")).toBeInTheDocument();
      expect(await screen.findByText("6+")).toBeInTheDocument();
    });

    it("renders integration stat formatted values", async () => {
      expect(await screen.findByText("12.4K")).toBeInTheDocument();
      expect(await screen.findByText("2.5M")).toBeInTheDocument();
    });

    it("renders integration stat icons", () => {
      // Plug/BarChart3 are static lucide-react; ZapIcon/EarthIcon are animated
      const plugIcon = document.querySelector('[data-testid="icon-plug"]');
      const chartIcon = document.querySelector('[data-testid="icon-barchart3"]');
      const zapIcon = document.querySelector('[data-testid="icon-zapicon"]');
      const globeIcon = document.querySelector('[data-testid="icon-earthicon"]');
      expect(plugIcon).toBeInTheDocument();
      expect(chartIcon).toBeInTheDocument();
      expect(zapIcon).toBeInTheDocument();
      expect(globeIcon).toBeInTheDocument();
    });
  });
});

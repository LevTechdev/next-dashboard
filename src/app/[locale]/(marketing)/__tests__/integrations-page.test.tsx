import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import IntegrationsOverviewPage from "../integrations-overview/page";

const params = { status: "fulfilled", value: { locale: "en" }, then: () => {} } as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<IntegrationsOverviewPage params={params} />);
});

describe("Integrations Overview Page", () => {
  it("renders the header section", () => {
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Connect your favorite tools")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(
      screen.getByText(/Sync data, automate workflows, and bring all your business tools together/),
    ).toBeInTheDocument();
  });

  it("renders all 9 integration cards", () => {
    expect(screen.getAllByText("Stripe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Shopify").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("SendGrid").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("AWS")).toBeInTheDocument();
    expect(screen.getByText("Google Analytics")).toBeInTheDocument();
    expect(screen.getAllByText("Zapier").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Instagram & Facebook")).toBeInTheDocument();
  });

  it("renders integration card descriptions", () => {
    expect(screen.getByText(/Process payments, manage subscriptions/)).toBeInTheDocument();
    expect(screen.getByText(/Sync orders, products, and inventory/)).toBeInTheDocument();
    expect(screen.getByText(/Send transactional emails/)).toBeInTheDocument();
    expect(screen.getByText(/real-time alerts, order updates/)).toBeInTheDocument();
    expect(screen.getByText(/Connect your existing database/)).toBeInTheDocument();
    expect(screen.getByText(/Deploy and scale your infrastructure/)).toBeInTheDocument();
    expect(screen.getByText(/Track traffic, user behavior/)).toBeInTheDocument();
    expect(screen.getByText(/Connect 3,000\+ apps/)).toBeInTheDocument();
    expect(screen.getByText(/Manage orders and ads from your social commerce/)).toBeInTheDocument();
  });

  it("shows Popular badge on popular integrations", () => {
    const popularBadges = screen.getAllByText("Popular");
    expect(popularBadges.length).toBe(4);
  });

  it("renders integration categories", () => {
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByText("E-commerce")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Automation")).toBeInTheDocument();
    expect(screen.getByText("Social")).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Don't see your tool?")).toBeInTheDocument();
    expect(screen.getByText(/We're constantly adding new integrations/)).toBeInTheDocument();

    const apiButton = screen.getByText("View API Docs");
    expect(apiButton).toBeInTheDocument();

    const anchor = apiButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/register");
  });
});

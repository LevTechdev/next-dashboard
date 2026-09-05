import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import IntegrationsOverviewPage from "../integrations-overview/page";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
      p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
      h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
      h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
      h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
    },
  };
});

vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  const en = await import("../../../../i18n/locales/en.json");
  return mod.createTranslationsMock({ integrationsPage: (en as any).default.integrationsPage });
});

const params = {
  status: "fulfilled",
  value: { locale: "en" },
  then: () => {},
} as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<IntegrationsOverviewPage params={params} />);
});

describe("Integrations Overview Page", () => {
  it("renders the header section", () => {
    expect(screen.getByText("Seamless Connections")).toBeInTheDocument();
    expect(screen.getByText("Connect with")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(
      screen.getByText(/Next Dashboard comes pre-configured with the industry/),
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

  it("renders a Connect link on each card", () => {
    const connectLinks = screen.getAllByText("Connect");
    expect(connectLinks.length).toBe(9);
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Build your own integration")).toBeInTheDocument();
    expect(screen.getByText(/Need something specific/)).toBeInTheDocument();

    const apiButton = screen.getByText("View API Docs");
    expect(apiButton).toBeInTheDocument();

    const anchor = apiButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/register");
  });
});

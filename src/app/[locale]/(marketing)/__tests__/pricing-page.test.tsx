import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import PricingPage from "../pricing/page";

const params = {
  status: "fulfilled",
  value: { locale: "en" },
  then: () => {},
} as unknown as Promise<{ locale: string }>;

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return actual;
});

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
      button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
  };
});

vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  const en = await import("../../../../i18n/locales/en.json");
  return mod.createTranslationsMock({ pricingPage: (en as any).default.pricingPage });
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-analytics", () => ({
  useAnalytics: () => ({ trackCTA: vi.fn() }),
}));

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  render(<PricingPage params={params} />);
});

describe("Pricing Page", () => {
  it("renders the header section with badge and title", () => {
    expect(screen.getByText("Simple Pricing")).toBeInTheDocument();
    // The hero prefix renders as per-word animated spans (AnimatedHeading),
    // so the exact string is only reachable via the aria-label.
    expect(screen.getByLabelText("Pricing that")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(screen.getByText(/Start for free, upgrade when you need to/)).toBeInTheDocument();
  });

  it("renders billing period toggle", () => {
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getByText("Save 20%")).toBeInTheDocument();
  });

  it("renders all 3 pricing tiers", () => {
    expect(screen.getAllByText("Starter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Professional").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Enterprise").length).toBeGreaterThanOrEqual(1);
  });

  it("renders pricing values (monthly by default)", () => {
    expect(screen.getAllByText("$29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$79").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$199").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("/month").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Most Popular badge on Professional", () => {
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("renders plan descriptions", () => {
    expect(screen.getByText("Perfect for small businesses getting started.")).toBeInTheDocument();
    expect(screen.getByText("For growing teams who need full power.")).toBeInTheDocument();
    expect(screen.getByText("Custom solutions for high-volume businesses.")).toBeInTheDocument();
  });

  it("renders feature lists", () => {
    expect(screen.getByText("Up to 100 orders/month")).toBeInTheDocument();
    expect(screen.getByText("Up to 3 team members")).toBeInTheDocument();
    expect(screen.getByText("Basic analytics")).toBeInTheDocument();
    expect(screen.getByText("Email support")).toBeInTheDocument();
    expect(screen.getByText("Up to 1,000 orders/month")).toBeInTheDocument();
    expect(screen.getByText("Up to 10 team members")).toBeInTheDocument();
    expect(screen.getByText("Unlimited orders")).toBeInTheDocument();
    expect(screen.getByText("Unlimited team members")).toBeInTheDocument();
  });

  it("renders the comparison table with semantic table structure", () => {
    // FAQ now uses the homepage's Stratus design: dual-tone split heading
    expect(screen.getByText("Frequently")).toBeInTheDocument();
    expect(screen.getByText("Asked Questions")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();

    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();

    const starterHeaders = screen.getAllByText("Starter");
    expect(starterHeaders.length).toBeGreaterThanOrEqual(2); // card + table header
  });

  it("renders comparison table rows", () => {
    expect(screen.getByText("Monthly Orders")).toBeInTheDocument();
    expect(screen.getByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("API Access")).toBeInTheDocument();
    expect(screen.getByText("Custom Exports")).toBeInTheDocument();
    expect(screen.getByText("RBAC")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Ready to start building?")).toBeInTheDocument();
    expect(screen.getByText(/Join thousands of developers shipping faster/)).toBeInTheDocument();

    const ctaLink = screen.getByText("Start your free trial");
    const anchor = ctaLink.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/register");
  });
});

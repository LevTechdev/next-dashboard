import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PricingPage from "../pricing/page";

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
      button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
  };
});

vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  return mod.createTranslationsMock({
    pricing: {
      badge: "Simple Pricing",
      title: "Plans That",
      subtitle:
        "Choose the perfect plan for your business. No hidden fees, no surprises. Start with a 14-day free trial.",
      monthly: "Monthly",
      yearly: "Yearly",
      savePercent: "Save 20%",
      billedMonthly: "Billed monthly",
      billedYearly: "Billed yearly",
      includes: "Includes",
      cta: "Start Free Trial",
      ctaContact: "Contact Sales",
      popular: "Most Popular",
      compareTitle: "Compare plans",
      compareSubtitle: "Every plan includes a 14-day free trial. No credit card required.",
      faqTitle: "Frequently Asked Questions",
      faqQ1: "Can I upgrade or downgrade my plan at any time?",
      faqA1:
        "Yes, you can change your plan at any time. When upgrading, you'll be billed the prorated difference. When downgrading, the new rate applies at the start of your next billing cycle.",
      faqQ2: "Is there a free trial available?",
      faqA2:
        "Yes! All plans come with a 14-day free trial. No credit card required. You can explore all features of your chosen plan during the trial period.",
      faqQ3: "What payment methods do you accept?",
      faqA3:
        "We accept all major credit cards, PayPal, and bank transfers for annual plans. All payments are processed securely through Stripe.",
      faqQ4: "Can I cancel my subscription?",
      faqA4:
        "Yes, you can cancel anytime. Your access will continue until the end of your current billing period.",
      trustBusinesses: "Businesses Served",
      trustOrders: "Orders Processed",
      trustUsers: "Active Users",
      trustCountries: "Countries",
      bottomTitle: "Not Sure Which Plan?",
      bottomSubtitle: "Start with a 14-day free trial on any plan. No credit card required.",
      bottomButton: "Go to Dashboard",
      featureOrders: "orders/month",
      featureTeam: "team members",
      featureAnalytics: "Basic analytics dashboard",
      featureExport: "CSV export",
      featureSupport: "Email support",
      featureMultiChannel: "Multi-channel orders",
      featureReports: "Advanced reports",
      featureRbac: "Role-based access",
      featureApi: "API access",
      featureAdvancedAnalytics: "Advanced analytics & charts",
      featurePrioritySupport: "Priority email & chat support",
      featureReportsInsights: "Advanced reports & insights",
      featureRbacAll: "Role-based access (Admin/Manager/Staff)",
      featureUnlimited: "Unlimited",
      featureTeamUnlimited: "Unlimited team members",
      featureCustomExports: "Custom exports",
      featureDedicatedSupport: "24/7 dedicated support",
      featureAllRoles: "Role-based access (all roles)",
      featureFullApi: "Full API access & webhooks",
      planStarter: "Starter",
      planProfessional: "Professional",
      planEnterprise: "Enterprise",
      descStarter: "Perfect for small businesses getting started.",
      descProfessional: "Best for growing businesses with multiple channels.",
      descEnterprise: "For large organizations with advanced needs.",
      perMonth: "/month",
      perYear: "/year",
      starterOrders: "Up to 500",
      starterTeam: "3",
      proOrders: "Up to 5,000",
      proTeam: "10",
      enterpriseOrders: "Unlimited",
      enterpriseTeam: "Unlimited",
    },
  });
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
}));

vi.mock("@/hooks/use-analytics", () => ({
  useAnalytics: () => ({ trackCTA: vi.fn() }),
}));

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  render(<PricingPage />);
});

describe("Pricing Page", () => {
  it("renders the header section with badge and title", () => {
    expect(screen.getByText("Simple Pricing")).toBeInTheDocument();
    expect(screen.getByText("Plans That")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(screen.getByText(/Choose the perfect plan/)).toBeInTheDocument();
  });

  it("renders billing period toggle", () => {
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getByText("Save 20%")).toBeInTheDocument();
  });

  it("renders all 3 pricing tiers", () => {
    // Tier names appear in both pricing cards and comparison table headers
    expect(screen.getAllByText("Starter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Professional").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Enterprise").length).toBeGreaterThanOrEqual(1);
  });

  it("renders pricing values (monthly by default)", () => {
    // Prices appear in both pricing cards AND the comparison table
    expect(screen.getAllByText("$29").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$79").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$199").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("/month").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Most Popular badge on Professional", () => {
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("renders CTA buttons with accessible links for each plan", () => {
    const trialButtons = screen.getAllByText("Start Free Trial");
    expect(trialButtons.length).toBe(2);
    expect(screen.getByText("Contact Sales")).toBeInTheDocument();

    // Starter and Professional CTAs link to dashboard
    for (const button of trialButtons) {
      const anchor = button.closest("a");
      expect(anchor).toHaveAttribute("href");
      expect(anchor?.getAttribute("href")).toContain("dashboard");
    }

    // Enterprise CTA
    const contactSales = screen.getByText("Contact Sales");
    const contactAnchor = contactSales.closest("a");
    expect(contactAnchor).toHaveAttribute("href");
    expect(contactAnchor?.getAttribute("href")).toContain("dashboard");
  });

  it("renders feature lists with composed translation strings", () => {
    expect(screen.getByText("Up to 500 orders/month")).toBeInTheDocument();
    expect(screen.getByText("Up to 5,000 orders/month")).toBeInTheDocument();
    // "Unlimited" appears in enterprise card features AND comparison table
    expect(screen.getAllByText("Unlimited").length).toBeGreaterThanOrEqual(1);
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

  it("renders FAQ section with accessible accordion buttons", () => {
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();

    // Verify FAQ renders questions
    const faqQuestions = [
      "Can I upgrade or downgrade my plan at any time?",
      "Is there a free trial available?",
      "What payment methods do you accept?",
      "Can I cancel my subscription?",
    ];

    for (const question of faqQuestions) {
      const button = screen.getByText(question).closest("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-expanded");
    }
  });

  it("renders FAQ answers with accessible content", () => {
    expect(screen.getByText(/Yes, you can change your plan at any time/)).toBeInTheDocument();
    expect(screen.getByText(/All plans come with a 14-day free trial/)).toBeInTheDocument();
    expect(screen.getByText(/We accept all major credit cards/)).toBeInTheDocument();
    expect(screen.getByText(/Yes, you can cancel anytime/)).toBeInTheDocument();
  });

  it("renders trust metrics section", () => {
    expect(screen.getByText("Businesses Served")).toBeInTheDocument();
    expect(screen.getByText("Orders Processed")).toBeInTheDocument();
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Countries")).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Not Sure Which Plan?")).toBeInTheDocument();

    const trialTexts = screen.getAllByText(/14-day free trial/);
    expect(trialTexts.length).toBeGreaterThanOrEqual(1);

    // Bottom CTA button
    const dashboardButtons = screen.getAllByText("Go to Dashboard");
    expect(dashboardButtons.length).toBeGreaterThanOrEqual(1);
    const bottomCta = dashboardButtons[dashboardButtons.length - 1];
    const anchor = bottomCta.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("dashboard");
  });
});

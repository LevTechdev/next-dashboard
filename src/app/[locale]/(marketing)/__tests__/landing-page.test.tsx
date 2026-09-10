import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "../page";

const params = {
  status: "fulfilled",
  value: { locale: "en" },
  then: () => {},
} as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<LandingPage params={params} />);
});

describe("Marketing Landing Page", () => {
  it("renders the cinematic preloader", () => {
    expect(screen.getByText("Initializing secure workspace")).toBeInTheDocument();
    expect(screen.getByText("Booting LevTech Unified Engine")).toBeInTheDocument();
  });

  it("renders the hero section with headline", () => {
    expect(screen.getByText(/Your Business,/)).toBeInTheDocument();
    expect(screen.getByText("The Complete Next.js SaaS Starter Kit")).toBeInTheDocument();
    expect(screen.getByText(/Everything you need to build a modern SaaS/)).toBeInTheDocument();
  });

  it("renders hero trust metrics", () => {
    expect(screen.getByText("99.98% Uptime SLA")).toBeInTheDocument();
    expect(screen.getByText("4.8/5 Customer Score")).toBeInTheDocument();
    expect(screen.getByText("14 Edge Regions")).toBeInTheDocument();
  });

  it("renders CTA buttons with accessible links", () => {
    const accessButton = screen.getByText("Access Workspace");
    expect(accessButton.closest("a")).toHaveAttribute("href");
    expect(accessButton.closest("a")?.getAttribute("href")).toContain("/register");

    const demoLink = screen.getByText("Live Demo").closest("a");
    expect(demoLink).toHaveAttribute("href");
    expect(demoLink?.getAttribute("href")).toContain("/login");
  });

  it("renders the hero Signal Strip hub with anchors to every page section", () => {
    // The hub is a <nav> labelled by the hero.hub.label key; each chip anchors
    // to a section that exists on the page (#preview, #story, #features, #pricing).
    const hub = screen.getByRole("navigation", { name: "Jump straight to a section" });
    expect(hub).toBeInTheDocument();
    const hrefs = Array.from(hub.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["#preview", "#story", "#features", "#pricing"]);
    // Localized chip labels render inside the hub.
    expect(screen.getByText("Live Preview")).toBeInTheDocument();
    expect(screen.getByText("Product Journey")).toBeInTheDocument();
    expect(screen.getByText("Feature Tour")).toBeInTheDocument();
    expect(screen.getByText("Plans & Pricing")).toBeInTheDocument();
  });

  it("renders the integration marquee", () => {
    expect(screen.getByText("Connect with the tools you already use")).toBeInTheDocument();
    // The marquee renders two copies; brand names also repeat in the bento grid,
    // so assert presence rather than uniqueness.
    expect(screen.getAllByText("Stripe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("OpenAI").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the dashboard preview section header", () => {
    expect(screen.getByText("Product Tour")).toBeInTheDocument();
    expect(screen.getByText("Your Entire Business, in One View")).toBeInTheDocument();
  });

  it("renders the scroll-driven product story", () => {
    expect(screen.getByText("The Journey")).toBeInTheDocument();
    expect(screen.getAllByText("From Cosmos,").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("to Control Room").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Four systems working as one constellation/)).toBeInTheDocument();
    expect(screen.getByText("Orders that never drift")).toBeInTheDocument();
    expect(screen.getByText("Payments in any orbit")).toBeInTheDocument();
    expect(screen.getByText("Analytics with gravity")).toBeInTheDocument();
    expect(screen.getByText("Workflows that run themselves")).toBeInTheDocument();
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
    // Also listed as an Enterprise plan feature — assert presence not uniqueness.
    expect(screen.getAllByText("Role-Based Access Control").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Smart Notifications")).toBeInTheDocument();
  });

  it("renders the stats grid", () => {
    expect(screen.getByText("1.8M+")).toBeInTheDocument();
    expect(screen.getByText("$48M+")).toBeInTheDocument();
    expect(screen.getByText("<200ms")).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
  });

  it("renders the pricing section with three plans", () => {
    expect(screen.getByText("Simple, Transparent Pricing")).toBeInTheDocument();
    expect(screen.getByText("Start free, scale when you need to.")).toBeInTheDocument();
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("renders testimonials", () => {
    // The marquee renders two copies of each card.
    expect(screen.getAllByText("Ahmad Rizki").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CEO, TokoBaju.id").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Jessica Wu").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Head of Growth, NexCommerce").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Budi Santoso").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("CTO, Startup Accelerator").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the bottom CTA section", () => {
    expect(screen.getByText("Ready for scale.")).toBeInTheDocument();
    expect(screen.getAllByText("Get Started Free").length).toBeGreaterThanOrEqual(2);
  });
});

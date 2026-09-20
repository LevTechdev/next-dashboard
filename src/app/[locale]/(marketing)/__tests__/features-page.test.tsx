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
    expect(screen.getByText("Powerful Capabilities")).toBeInTheDocument();
    // The hero prefix renders as per-word animated spans (AnimatedHeading),
    // so the exact string is only reachable via the aria-label.
    expect(screen.getByLabelText("Everything you need,")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(screen.getByText(/Stop wasting weeks on boilerplate/)).toBeInTheDocument();
  });

  it("renders all 6 feature cards", () => {
    expect(screen.getByText("Beautiful Admin Dashboards")).toBeInTheDocument();
    expect(screen.getByText("Enterprise-grade Authentication")).toBeInTheDocument();
    expect(screen.getByText("First-class Internationalization")).toBeInTheDocument();
    expect(screen.getByText("Dark Mode Support")).toBeInTheDocument();
    expect(screen.getByText("Role-Based Access")).toBeInTheDocument();
    expect(screen.getByText("API Routes")).toBeInTheDocument();
  });

  it("renders feature card descriptions", () => {
    expect(screen.getByText(/Pre-built, responsive admin interfaces/)).toBeInTheDocument();
    expect(screen.getByText(/Complete identity management/)).toBeInTheDocument();
    expect(screen.getByText(/Ship to global markets instantly/)).toBeInTheDocument();
    expect(screen.getByText(/Flawless dark mode out of the box/)).toBeInTheDocument();
    expect(screen.getByText(/Fine-grained permissions for users/)).toBeInTheDocument();
    expect(screen.getByText(/Secure, rate-limited API endpoints/)).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Ready to ship faster?")).toBeInTheDocument();
    expect(screen.getByText(/Join thousands of developers/)).toBeInTheDocument();

    const ctaButton = screen.getByText("Get Started Today");
    expect(ctaButton).toBeInTheDocument();

    const anchor = ctaButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/register");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ChangelogPage from "../changelog/page";

beforeEach(() => {
  render(<ChangelogPage />);
});

describe("Changelog Page", () => {
  it("renders the header section", () => {
    expect(screen.getByText("Release Notes")).toBeInTheDocument();
    // The h1 renders "What's " + FlipFadeText cycling through words like "new.", "shipping.", etc.
    expect(screen.getByText("What's")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(
      screen.getByText(/Stay up to date with the latest/)
    ).toBeInTheDocument();
  });

  it("renders the latest version badge", () => {
    expect(screen.getByText("2.5.0")).toBeInTheDocument();
    expect(screen.getByText("Latest version:")).toBeInTheDocument();
    expect(screen.getByText("Released April 14, 2026")).toBeInTheDocument();
  });

  it("renders all version entries in the timeline", () => {
    expect(screen.getByText("v2.5.0")).toBeInTheDocument();
    expect(screen.getByText("v2.4.0")).toBeInTheDocument();
    expect(screen.getByText("v2.3.0")).toBeInTheDocument();
    expect(screen.getByText("v2.2.0")).toBeInTheDocument();
    expect(screen.getByText("v2.1.0")).toBeInTheDocument();
    expect(screen.getByText("v2.0.0")).toBeInTheDocument();
  });

  it("renders version tags", () => {
    expect(screen.getByText("Latest Release")).toBeInTheDocument();
    // "Feature Release" appears on v2.4.0 and v2.2.0
    expect(screen.getAllByText("Feature Release").length).toBeGreaterThanOrEqual(2);
    // "Improvement" appears as tag on v2.3.0 and v2.1.0
    expect(screen.getAllByText("Improvement").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Major Release")).toBeInTheDocument();
  });

  it("renders changelog items from version 2.5.0", () => {
    expect(
      screen.getByText(
        "Real-time dashboard auto-refresh with Server-Sent Events"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Role-based access control with Admin, Manager, and Staff roles"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Redesigned analytics charts with interactive tooltips")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fixed pagination issues on order list exceeding 1000 records"
      )
    ).toBeInTheDocument();
  });

  it("renders changelog items from version 2.0.0", () => {
    expect(
      screen.getByText("Complete dashboard redesign with real-time analytics")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Team management with role-based permissions")
    ).toBeInTheDocument();
    expect(
      screen.getByText("REST API with webhook support for custom integrations")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Progressive Web App with offline support")
    ).toBeInTheDocument();
  });

  it("renders subscribe section with accessible email input", () => {
    expect(screen.getByText("Stay Updated")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Get notified about new releases, features, and updates/
      )
    ).toBeInTheDocument();

    // Verify email input has proper accessibility attributes
    const emailInput = screen.getByPlaceholderText("Enter your email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("placeholder", "Enter your email");

    // Subscribe button
    expect(screen.getByText("Subscribe")).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Ready to Get Started?")).toBeInTheDocument();
    expect(
      screen.getByText(/Join thousands of businesses already using Dashboard/)
    ).toBeInTheDocument();

    const ctaButton = screen.getByText("Go to Dashboard");
    expect(ctaButton).toBeInTheDocument();

    // Verify CTA link has a proper href
    const anchor = ctaButton.closest("a");
    expect(anchor).toHaveAttribute("href");
    expect(anchor?.getAttribute("href")).toContain("/dashboard");
  });

  describe("Release Stats Section", () => {
    it("renders all 4 release stat labels", () => {
      expect(screen.getByText("Total Releases")).toBeInTheDocument();
      expect(screen.getByText("New Features")).toBeInTheDocument();
      expect(screen.getByText("Improvements")).toBeInTheDocument();
      expect(screen.getByText("Bug Fixes")).toBeInTheDocument();
    });

    it("renders release stat suffixed values", async () => {
      expect(await screen.findByText("24+")).toBeInTheDocument();
      expect(await screen.findByText("42+")).toBeInTheDocument();
      expect(await screen.findByText("128+")).toBeInTheDocument();
      expect(await screen.findByText("56+")).toBeInTheDocument();
    });

    it("renders release stat icons", () => {
      const commitIcon = document.querySelector('[data-testid="icon-gitcommit"]');
      const sparklesIcon = document.querySelector('[data-testid="icon-sparkles"]');
      const rocketIcon = document.querySelector('[data-testid="icon-rocket"]');
      const bugIcon = document.querySelector('[data-testid="icon-bug"]');
      expect(commitIcon).toBeInTheDocument();
      expect(sparklesIcon).toBeInTheDocument();
      expect(rocketIcon).toBeInTheDocument();
      expect(bugIcon).toBeInTheDocument();
    });

    it("uses tabular-nums for stat values", () => {
      const valueElements = document.querySelectorAll(".tabular-nums");
      // Each stat card has a tabular-nums class on the value container
      expect(valueElements.length).toBeGreaterThanOrEqual(4);
    });
  });
});

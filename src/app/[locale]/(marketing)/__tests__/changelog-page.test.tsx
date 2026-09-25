import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import ChangelogPage from "../changelog/page";
import { APP_VERSION } from "@/lib/app-version";

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
    },
  };
});

vi.mock("next-intl", async () => {
  const mod = await import("@/test-utils/i18n-mock");
  const en = await import("../../../../i18n/locales/en.json");
  return mod.createTranslationsMock({ changelogPage: (en as any).default.changelogPage });
});

const mockParams = Promise.resolve({ locale: "en" });
(mockParams as any).status = "fulfilled";
(mockParams as any).value = { locale: "en" };

beforeEach(() => {
  render(<ChangelogPage params={mockParams as any} />);
});

describe("Changelog Page", () => {
  it("renders the header section", () => {
    expect(screen.getByText("Release Notes")).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
  });

  it("renders the header description", () => {
    expect(screen.getByText(/Stay up to date with the latest/)).toBeInTheDocument();
  });

  it("renders the latest version badge from the release source, not from the copy", () => {
    // The badge reports the version the build was tagged with
    // (NEXT_PUBLIC_APP_VERSION -> git tag). It must NOT be hand-written copy: a
    // hardcoded string here is how the page ended up claiming a version no tag
    // had ever been cut for.
    expect(screen.getByTestId("release-version")).toHaveTextContent(APP_VERSION);
    expect(screen.getByText("Latest version:")).toBeInTheDocument();
    // The date appears in the badge and on the timeline entry
    expect(screen.getAllByText("September 22, 2026").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all version entries in the timeline, on the released line", () => {
    // Timeline versions are the release line itself — the newest entry always
    // carries the version the badge reports (asserted against APP_VERSION
    // below), so the page and the git tags cannot disagree.
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
    for (const version of ["v1.0.0", "v0.9.0", "v0.8.0", "v0.7.0", "v0.6.0", "v0.5.0", "v0.4.0"]) {
      expect(screen.getByText(version)).toBeInTheDocument();
    }
  });

  it("names the release the timeline's newest entry describes", () => {
    // One source of truth: badge version === newest entry version.
    expect(screen.getByTestId("release-version")).toHaveTextContent(APP_VERSION);
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it("renders version tags", () => {
    expect(screen.getAllByText("Security & Pricing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Latest Release").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Feature Release").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Improvement").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Major Release")).toBeInTheDocument();
  });

  it("renders changelog items from version 2.5.0", () => {
    expect(
      screen.getByText("Real-time dashboard auto-refresh with Server-Sent Events"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Role-based access control with Admin, Manager, and Staff roles"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Redesigned analytics charts with interactive tooltips"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fixed pagination issues on order list exceeding 1000 records"),
    ).toBeInTheDocument();
  });

  it("renders changelog items from version 2.0.0", () => {
    expect(
      screen.getByText("Complete dashboard redesign with real-time analytics"),
    ).toBeInTheDocument();
    expect(screen.getByText("Team management with role-based permissions")).toBeInTheDocument();
    expect(
      screen.getByText("REST API with webhook support for custom integrations"),
    ).toBeInTheDocument();
    expect(screen.getByText("Progressive Web App with offline support")).toBeInTheDocument();
  });

  it("renders subscribe section with accessible email input", () => {
    expect(screen.getByText("Stay Updated")).toBeInTheDocument();
    expect(
      screen.getByText(/Get notified about new releases, features, and updates/),
    ).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText("Enter your email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("placeholder", "Enter your email");

    expect(screen.getByText("Subscribe")).toBeInTheDocument();
  });

  it("renders bottom CTA with accessible link", () => {
    expect(screen.getByText("Ready to Get Started?")).toBeInTheDocument();
    expect(
      screen.getByText(/Join thousands of businesses already using Dashboard/),
    ).toBeInTheDocument();

    const ctaButton = screen.getByText("Go to Dashboard");
    expect(ctaButton).toBeInTheDocument();

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

    it("uses tabular-nums for stat values", () => {
      const valueElements = document.querySelectorAll(".tabular-nums");
      expect(valueElements.length).toBeGreaterThanOrEqual(4);
    });
  });
});

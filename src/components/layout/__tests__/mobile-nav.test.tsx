import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNav } from "../mobile-nav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
  useParams: () => ({ locale: "en" }),
}));

describe("MobileNav", () => {
  it("renders the dock navigation items", () => {
    render(<MobileNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  it("keeps the language switcher inside the More menu", () => {
    render(<MobileNav />);
    // The dock itself no longer shows the locale label — it moved to the More sheet.
    expect(screen.queryByText("EN")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("More"));
    // Language section header + all 4 languages are available in the sheet.
    // "EN" appears twice: the section's active-locale chip and the button label.
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getAllByText("EN").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("中文")).toBeInTheDocument();
    // 日本語 is both the label and the locale name
    expect(screen.getAllByText("日本語").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation links with correct hrefs", () => {
    render(<MobileNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/en/dashboard");

    const ordersLink = screen.getByText("Orders").closest("a");
    expect(ordersLink).toHaveAttribute("href", "/en/orders");
  });

  it("highlights the active route", () => {
    render(<MobileNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink?.className).toContain("text-primary");
  });

  it("renders an icon for each dock item", () => {
    const { container } = render(<MobileNav />);
    // 5 dock slots: Home, Orders, Customers, Products, More (no language globe in the
    // bar). Counted via the dock's icon wrappers so invisible helper SVGs (e.g. the
    // liquid-glass displacement filter) don't break the count.
    const dockIcons = container.querySelectorAll("a svg, button svg");
    expect(dockIcons.length).toBe(5);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SalesChannelBadge, SalesChannelIcon, getChannelConfig } from "../brand-icons";

/**
 * Regression guard for the Runtime TypeError
 * "Cannot read properties of null (reading 'slug')" — order.channel is an
 * optional Prisma include and typeof null === "object", so the badge used to
 * dereference .slug on it. A missing channel must render a muted placeholder
 * instead of crashing the whole orders table.
 */
describe("SalesChannelBadge null-safety", () => {
  it("renders a muted placeholder when channel is null", () => {
    render(<SalesChannelBadge channel={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a muted placeholder when channel is undefined", () => {
    render(<SalesChannelBadge />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("does not fall back to the Online Store label for a missing channel", () => {
    render(<SalesChannelBadge channel={null} />);
    expect(screen.queryByText("Online Store")).not.toBeInTheDocument();
  });

  it("resolves a channel object with slug", () => {
    render(<SalesChannelBadge channel={{ slug: "shopify", name: "Shopify" }} />);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
  });

  it("resolves a channel object with only a name", () => {
    render(<SalesChannelBadge channel={{ name: "Online Store" }} />);
    expect(screen.getByText("Online Store")).toBeInTheDocument();
  });

  it("resolves a plain string channel", () => {
    // "tiktok" resolves to the TikTok config (zinc badge styling proves it).
    render(<SalesChannelBadge channel="tiktok" />);
    const badge = screen.getByText("tiktok").parentElement!;
    expect(badge.className).toContain("bg-zinc-100");
  });

  it("SalesChannelIcon tolerates a missing name", () => {
    const { container } = render(<SalesChannelIcon name={undefined} />);
    expect(container.querySelector("[data-thesvg-icon], svg")).toBeTruthy();
  });

  it("getChannelConfig falls back to online-store for junk keys", () => {
    expect(getChannelConfig(undefined)).toBe(getChannelConfig("online-store"));
    expect(getChannelConfig("not-a-channel")).toBe(getChannelConfig("online-store"));
  });
});

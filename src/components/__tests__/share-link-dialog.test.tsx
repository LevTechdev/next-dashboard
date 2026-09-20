import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShareLinkDialog } from "@/components/share-link-dialog";

/**
 * The share modal used to break with a long affiliate link: the URL sat in a
 * `flex` row that also carried `truncate`. `truncate` (overflow hidden +
 * text-overflow ellipsis) has no effect on a flex container, and the anonymous
 * text item it creates refuses to shrink below its content width — so a long
 * URL widened the row and pushed the copy button out of the dialog.
 *
 * jsdom does not lay anything out, so these assertions pin the structure that
 * makes truncation possible rather than the pixels.
 */

const LONG_URL =
  "https://next-dashboard-levtechdevs-projects.vercel.app/en/store/ambassador-program/summer-launch-2026?ref=AMB-SUPER-LONG-AFFILIATE-CODE-0001&utm_source=affiliate&utm_medium=share&utm_campaign=q3-promo&utm_content=sidebar-widget";

describe("ShareLinkDialog", () => {
  it("keeps a long link inside the dialog instead of widening it", () => {
    render(<ShareLinkDialog open onClose={() => {}} url={LONG_URL} />);

    // The link text is rendered in full — truncation is visual only.
    const link = screen.getByText(LONG_URL);
    expect(link.textContent).toBe(LONG_URL);

    // ...and the truncation lives on that leaf element, not on a flex row.
    expect(link.className).toContain("truncate");
    const box = link.parentElement as HTMLElement;
    // `flex-1` is fine (it sizes the box); the bug was a *container*
    // (`flex` / `inline-flex`) also carrying `truncate`.
    const boxClasses = box.className.split(/\s+/);
    expect(boxClasses).not.toContain("flex");
    expect(boxClasses).not.toContain("inline-flex");
    expect(box.className).toContain("min-w-0");
    expect(box.className).toContain("overflow-hidden");
    // The full value stays reachable on hover.
    expect(box.getAttribute("title")).toBe(LONG_URL);
  });

  it("stops the copy button from being squeezed out by the link", () => {
    render(<ShareLinkDialog open onClose={() => {}} url={LONG_URL} />);

    const buttons = Array.from(document.querySelectorAll("button"));
    const copyButton = buttons.find((b) => b.className.includes("shrink-0"));
    expect(copyButton, "copy button should refuse to shrink").toBeTruthy();
  });

  it("truncates a long product name too", () => {
    render(
      <ShareLinkDialog
        open
        onClose={() => {}}
        url={LONG_URL}
        productName={"Extremely Long Product Title ".repeat(4)}
      />,
    );

    const name = screen.getByText(/Extremely Long Product Title/);
    expect(name.className).toContain("truncate");
  });

  it("falls back to the shimmer placeholder while the QR code is pending", () => {
    // qrcode is imported lazily in an effect; before it resolves (or if it
    // fails in this environment) the block must not collapse the layout.
    const spy = vi.spyOn(document, "createElement");
    render(<ShareLinkDialog open onClose={() => {}} url={LONG_URL} />);
    expect(document.querySelector(".shimmer")).toBeTruthy();
    spy.mockRestore();
  });
});

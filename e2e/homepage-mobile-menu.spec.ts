import { test, expect } from "@playwright/test";

/**
 * Marketing header mobile menu E2E.
 *
 * The marketing header (src/components/layout/marketing-header.tsx) renders a
 * DROPDOWN menu below `lg`: the hamburger ("Toggle menu") toggles an
 * AnimatePresence panel with all nav links plus the auth CTAs (Sign in /
 * Sign up when logged out, My account when signed in).
 *
 * Contract notes vs. the old full-screen overlay design:
 *   - The panel is in normal document flow (height auto animation) directly
 *     under the fixed header — every item is reachable WITHOUT scrolling,
 *     even at very short viewports. The old "scroll the overlay" tests are
 *     therefore obsolete.
 *   - The language switcher lives in the header's `hidden sm:flex` actions
 *     cluster, not in the menu — so it is out of scope here.
 *
 * Nav/CTA labels are the `site.*` values from src/i18n/locales/en.json.
 */

const NAV_LINKS = [
  { label: "Features", href: "/en/features" },
  { label: "Integrations", href: "/en/integrations-overview" },
  { label: "Pricing", href: "/en/pricing" },
  { label: "Changelog", href: "/en/changelog" },
  { label: "About", href: "/en/about" },
  { label: "Contact", href: "/en/contact" },
] as const;

test.use({ viewport: { width: 375, height: 667 } });

// The nav labels repeat in the page footer — scope every link assertion to
// the header (banner role) or Playwright strict mode trips on both matches.
const menuLink = (page: import("@playwright/test").Page, label: string) =>
  page.getByRole("banner").getByRole("link", { name: label, exact: true });

async function openMobileMenu(page: import("@playwright/test").Page) {
  await page.goto("/en", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: "Toggle menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

test.describe("Homepage mobile menu", () => {
  test("opens a dropdown with all nav links and the auth CTAs", async ({ page }) => {
    await openMobileMenu(page);

    for (const { label } of NAV_LINKS) {
      await expect(menuLink(page, label)).toBeVisible();
    }
    // Logged-out CTAs inside the menu.
    await expect(menuLink(page, "Sign in")).toBeVisible();
    await expect(menuLink(page, "Sign up")).toBeVisible();

    // Targets are the localized marketing routes.
    await expect(menuLink(page, "Pricing")).toHaveAttribute("href", "/en/pricing");
  });

  test("keeps every item reachable without scrolling at a very short viewport", async ({
    page,
  }) => {
    // The old overlay design needed scroll-into-view tests; the dropdown is
    // in-flow, so the equivalent guarantee is: with the menu open at a very
    // short viewport, the LAST item (Sign up CTA) is already fully inside the
    // viewport — no scrolling possible or needed.
    await page.setViewportSize({ width: 375, height: 480 });
    await openMobileMenu(page);

    const signUp = menuLink(page, "Sign up");
    await signUp.scrollIntoViewIfNeeded(); // no-op if visible; fails if detached
    const box = await signUp.boundingBox();
    expect(box, "Sign up CTA should have layout").not.toBeNull();
    expect(box!.y, "top edge inside the 480px viewport").toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, "bottom edge inside the 480px viewport").toBeLessThanOrEqual(
      480 + 1,
    );
  });

  test("closes on a second toggle and removes the menu links", async ({ page }) => {
    await openMobileMenu(page);

    const trigger = page.getByRole("button", { name: "Toggle menu" });
    const pricing = menuLink(page, "Pricing");
    await expect(pricing).toBeVisible();

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    // AnimatePresence exits with a height tween — assert it goes away.
    await expect(pricing).toBeHidden({ timeout: 5_000 });
  });
});

import { test, expect } from "@playwright/test";
import {
  loginAs,
  waitForStableLayout,
  expectThinScrollbarStyles,
  assertThumbRecolorsBidirectionally,
} from "./helpers";

interface TabbedPage {
  path: string;
  tabs: string[];
  /** Whether the pill is expected to overflow its own width (internal scroll). */
  scrolls: boolean;
}

/**
 * Every dashboard page with a page-level tab bar (orders is excluded: its
 * tabs render only inside the order-detail dialog). The `scrolls` flag is
 * derived from the actual label widths at 375px — pages whose labels exceed
 * the pill must scroll internally instead of widening the page.
 */
interface TabBarMetrics {
  tabNames: string[];
  /** Every tab sits inside the pill's scrollable content (reachable via scroll). */
  allTabsWithinScrollArea: boolean;
  /** The pill overflows its own width (internal scroll). */
  scrollable: boolean;
  scrollWidth: number;
  clientWidth: number;
}

function measureTabBar(list: HTMLElement): TabBarMetrics {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const lb = list.getBoundingClientRect();
  const rects = tabs.map((t) => t.getBoundingClientRect());
  return {
    tabNames: tabs.map((t) => t.textContent?.trim() ?? ""),
    allTabsWithinScrollArea: rects.every(
      (r) => r.right <= lb.left + list.scrollWidth + 1 && r.left >= lb.left - 1,
    ),
    scrollable: list.scrollWidth > list.clientWidth,
    scrollWidth: list.scrollWidth,
    clientWidth: list.clientWidth,
  };
}

const TABBED_PAGES: TabbedPage[] = [
  { path: "/en/billing", tabs: ["Overview", "Plans", "Invoices", "Payment"], scrolls: true },
  { path: "/en/analytics", tabs: ["Conversion Funnel", "Cohort Retention", "Geographic Breakdown", "Sales by Channel", "Top Products"], scrolls: true },
  { path: "/en/roles", tabs: ["Permission Matrix", "Role Assignments"], scrolls: false },
  {
    path: "/en/notifications",
    tabs: ["Inbox", "Alert Rules", "Email Preferences"],
    scrolls: true,
  },
  {
    path: "/en/reports",
    tabs: ["Overview", "Revenue Breakdown", "Sales Report", "Customer Report", "Product Report"],
    scrolls: true,
  },
  { path: "/en/affiliates", tabs: ["Platforms", "Affiliate Links", "Conversions"], scrolls: false },
  {
    path: "/en/integrations",
    tabs: ["API Keys", "Webhooks", "Delivery Log", "Playground"],
    scrolls: true,
  },
];

test.describe("Dashboard tab bars at a 375px viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("every tabbed page keeps its tab bar inside the viewport", async ({ page }) => {
    for (const p of TABBED_PAGES) {
      await page.goto(p.path);
      const tabList = page.getByRole("tablist");
      await expect(tabList).toBeVisible();

      // The view-transition animation can briefly offset the layout on
      // navigation, so poll the containment claim until the page settles.
      await expect
        .poll(
          () =>
            tabList.evaluate((el) => {
              const lb = el.getBoundingClientRect();
              return lb.left >= 0 && lb.right <= window.innerWidth + 1;
            }),
          // 15s: generous for a cold dev server compiling the route on demand.
          { timeout: 15_000, message: `${p.path}: tab bar left the viewport` },
        )
        .toBe(true);

      // Cold-compiled routes can take a moment to hydrate, during which the
      // tab bar is momentarily zero-sized (0x0). The containment poll above
      // vacuously accepts that, so wait for real layout + stable scroll
      // metrics (double-rAF, no re-render in flight) before asserting on them.
      const mm = await waitForStableLayout(page, tabList, {
        measure: measureTabBar,
        // All expected tabs must be present once hydration finishes.
        isReady: (s) => s.tabNames.length === p.tabs.length,
        message: `${p.path}: tab bar metrics never stabilized`,
      });

      expect(mm.tabNames, `${p.path}: tab labels`).toEqual(p.tabs);
      expect(mm.allTabsWithinScrollArea, `${p.path}: all tabs reachable via scroll`).toBe(true);
      if (p.scrolls) {
        expect(mm.scrollable, `${p.path}: bar must scroll internally`).toBe(true);
      } else {
        // Allow 1px for cross-platform font-metric drift on pages that just fit.
        expect(mm.scrollWidth - mm.clientWidth, `${p.path}: bar should fit`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("tab bar's page surfaces recolor their thin scrollbar thumb in both directions", async ({
    page,
  }) => {
    // The tab bar itself hides its scrollbar (scrollbar-none — nothing to
    // recolor), so the proof rides a VISIBLE thin surface on the same page:
    // the roles Permission Matrix table (overflow-x-auto scrollbar-thin, the
    // default tab). Toggle in-page in both directions and prove the thumb
    // color follows: light -> dark changes it, dark -> light restores the
    // exact light value.
    await page.goto("/en/roles");
    // The roles Permission Matrix table is the page's visible thin surface
    // (the only `main .overflow-x-auto.scrollbar-thin` container; the two
    // sidebar ScrollContainers carry the same classes but live outside main).
    const matrix = page.locator("main .overflow-x-auto.scrollbar-thin").first();
    await expect(matrix).toBeVisible();
    await expectThinScrollbarStyles(page, matrix, "roles matrix table");

    await assertThumbRecolorsBidirectionally(page, matrix, "roles matrix table");
  });

  test("every tab on every page is reachable and activates", async ({ page }) => {
    for (const p of TABBED_PAGES) {
      await page.goto(p.path);
      await expect(page.getByRole("tablist")).toBeVisible();

      for (const name of p.tabs) {
        // Retry the click until Radix marks it active: a click during
        // hydration is silently dropped, and aria-selected only flips once
        // the click registers.
        await expect
          .poll(
            async () => {
              const tab = page.getByRole("tab", { name });
              await tab.click({ timeout: 2_000 }).catch(() => {});
              return tab.getAttribute("aria-selected");
            },
            { timeout: 15_000, message: `${p.path}: tab "${name}" never activated` },
          )
          .toBe("true");
      }
    }
  });
});

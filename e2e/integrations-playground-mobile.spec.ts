import { test, expect } from "@playwright/test";
import { createApiKey, loginAs } from "./helpers";

/**
 * Integrations Playground tab on a 375px (phone) viewport.
 *
 * The Playground tab (API request builder + response viewer + quick-start
 * reference) renders below the shared 4-tab bar. This spec pins that its
 * content — not just the tab itself — stays inside the phone viewport:
 *   1. Switching to the tab activates it (retry-safe against hydration).
 *   2. The request builder (endpoint, API-key input, Send request, response
 *      card) and the quick-start reference render with no horizontal overflow.
 *   3. A real whoami request with a freshly created key renders the JSON
 *      response card inside the viewport.
 *   4. The sibling Delivery Log tab's content (filter + deliveries) also
 *      stays within the viewport.
 */

test.describe("Integrations Playground tab on mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/integrations");
    // The API Keys tab's toolbar only renders after hydration + the initial
    // fetch resolves; waiting on it gates that tab clicks are not dropped.
    await expect(
      page.getByRole("button", { name: "Create API Key", exact: true }).first(),
    ).toBeVisible();
  });

  test("Playground content renders within the 375px viewport", async ({ page }) => {
    // Retry the click until Radix marks the tab active: a click during
    // hydration is silently dropped.
    await expect
      .poll(
        async () => {
          const tab = page.getByRole("tab", { name: "Playground" });
          await tab.click({ timeout: 2_000 }).catch(() => {});
          return tab.getAttribute("aria-selected");
        },
        { timeout: 15_000, message: "Playground tab never activated" },
      )
      .toBe("true");

    // The request-builder markers: heading, endpoint code, API-key input,
    // send button, and the response card's empty state.
    await expect(page.getByRole("heading", { name: "API Playground" })).toBeVisible();
    await expect(page.getByText("GET /api/v1/whoami", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("dash_…")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send request", exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Run a request to see the response here.")).toBeVisible();

    // The quick-start reference card.
    await expect(page.getByRole("heading", { name: "Quick start" })).toBeVisible();

    // Every key content node stays inside the viewport (no page-level
    // horizontal overflow from the grid or the code samples).
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const keys = [
      page.getByRole("heading", { name: "API Playground" }),
      page.getByText("GET /api/v1/whoami", { exact: true }),
      page.getByPlaceholder("dash_…"),
      page.getByRole("button", { name: "Send request", exact: true }).first(),
      page.getByRole("heading", { name: "Quick start" }),
    ];
    for (const locator of keys) {
      await expect
        .poll(
          async () => {
            const box = await locator.boundingBox();
            return box ? box.x >= 0 && box.x + box.width <= viewportWidth + 1 : false;
          },
          { timeout: 10_000, message: "Playground content left the viewport" },
        )
        .toBe(true);
    }
  });

  test("a whoami request with a real key renders the JSON response in viewport", async ({
    page,
  }) => {
    // The beforeEach already waited for the API Keys toolbar, so a fresh key
    // can be created right away; the raw key is revealed exactly once.
    const rawKey = await createApiKey(page, `e2e-play-${Date.now()}`);
    expect(rawKey).toMatch(/^dash_[0-9a-f]{64}$/);

    await expect
      .poll(
        async () => {
          const tab = page.getByRole("tab", { name: "Playground" });
          await tab.click({ timeout: 2_000 }).catch(() => {});
          return tab.getAttribute("aria-selected");
        },
        { timeout: 15_000, message: "Playground tab never activated" },
      )
      .toBe("true");

    await page.getByPlaceholder("dash_…").fill(rawKey);
    // Ride the response so the assertion outlives a cold-route compile.
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/v1/whoami") && r.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Send request", exact: true }).first().click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // The response card renders the whoami JSON (same markers as the desktop
    // integrations spec: authenticated + scopes).
    await expect(page.getByText("Status: 200")).toBeVisible();
    const json = page.locator("pre").filter({ hasText: '"authenticated": true' });
    await expect(json).toBeVisible();
    await expect(page.locator("pre").filter({ hasText: '"scopes": "read"' })).toBeVisible();

    // ...and the JSON stays within the 375px viewport: the pre scrolls
    // internally (overflow-auto) rather than pushing the page wider.
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    await expect
      .poll(
        async () => {
          const box = await json.boundingBox();
          return box ? box.x >= 0 && box.x + box.width <= viewportWidth + 1 : false;
        },
        { timeout: 10_000, message: "whoami JSON left the viewport" },
      )
      .toBe(true);
  });

  test("Delivery Log content renders within the 375px viewport", async ({ page }) => {
    await expect
      .poll(
        async () => {
          const tab = page.getByRole("tab", { name: "Delivery Log" });
          await tab.click({ timeout: 2_000 }).catch(() => {});
          return tab.getAttribute("aria-selected");
        },
        { timeout: 15_000, message: "Delivery Log tab never activated" },
      )
      .toBe("true");

    const tabpanel = page.getByRole("tabpanel", { name: "Delivery Log" });
    await expect(tabpanel).toBeVisible();

    // The DeliveriesTab returns early with a spinner while its fetch is in
    // flight (slow on a cold route compile), so the filter controls appearing
    // is the gate that loading finished. The body is data-dependent: a fresh
    // account shows the empty state, the seeded DB shows delivery cards (each
    // an expandable row button, so >1 button = Refresh + at least one row).
    await expect
      .poll(
        async () => {
          const filterVisible = await tabpanel
            .getByText("All Endpoints", { exact: true })
            .isVisible()
            .catch(() => false);
          const hasRows = (await tabpanel.getByRole("button").count()) > 1;
          return (
            filterVisible &&
            (hasRows ||
              (await tabpanel
                .getByText("No deliveries yet", { exact: true })
                .isVisible()
                .catch(() => false)))
          );
        },
        { timeout: 15_000, message: "deliveries never finished loading" },
      )
      .toBe(true);

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    for (const locator of [
      tabpanel.getByText("All Endpoints", { exact: true }),
      tabpanel.getByRole("button", { name: "Refresh", exact: true }),
      tabpanel,
    ]) {
      await expect
        .poll(
          async () => {
            const box = await locator.boundingBox();
            return box ? box.x >= 0 && box.x + box.width <= viewportWidth + 1 : false;
          },
          { timeout: 10_000, message: "Delivery Log content left the viewport" },
        )
        .toBe(true);
    }
  });
});

test.describe("Integrations Playground at a 1280px desktop viewport", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/integrations");
    // Same hydration gate as the mobile spec: the API Keys toolbar only
    // renders after the initial fetch resolves.
    await expect(
      page.getByRole("button", { name: "Create API Key", exact: true }).first(),
    ).toBeVisible();
  });

  test("the 5-column grid lays the builder and quick-start out side by side", async ({ page }) => {
    await expect
      .poll(
        async () => {
          const tab = page.getByRole("tab", { name: "Playground" });
          await tab.click({ timeout: 2_000 }).catch(() => {});
          return tab.getAttribute("aria-selected");
        },
        { timeout: 15_000, message: "Playground tab never activated" },
      )
      .toBe("true");

    await expect(page.getByRole("heading", { name: "API Playground" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick start" })).toBeVisible();

    // The grid is grid-cols-1 lg:grid-cols-5: the builder spans 3 columns
    // (left) and the quick-start reference 2 (right), with a gap-6 gutter.
    const builder = page
      .locator("main .dashboard-card")
      .filter({ has: page.getByRole("heading", { name: "API Playground" }) });
    const quickStart = page
      .locator("main .dashboard-card")
      .filter({ has: page.getByRole("heading", { name: "Quick start" }) });

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    await expect
      .poll(
        async () => {
          const b = await builder.boundingBox();
          const q = await quickStart.boundingBox();
          if (!b || !q) return false;
          // Both cards fully inside the viewport…
          const inViewport =
            b.x >= 0 &&
            b.x + b.width <= viewportWidth + 1 &&
            q.x >= 0 &&
            q.x + q.width <= viewportWidth + 1;
          // …top-aligned (items-start, same grid row)…
          const sameRow = Math.abs(b.y - q.y) < 60;
          // …and the builder's right edge meets the quick-start's left edge
          // (the 24px gap-6 gutter sits between them).
          const sideBySide = b.x + b.width <= q.x + 4;
          return inViewport && sameRow && sideBySide;
        },
        { timeout: 10_000, message: "Playground grid never laid out side by side" },
      )
      .toBe(true);
  });
});

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Comprehensive SaaS User Journey & Regression Suite", () => {
  test("1. Landing page, 3D Hero, and BackToTop floating button", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    // Verify 3D interactive hero section exists
    // Hero was redesigned — its aria-label now comes from
    // homepage.hero.ariaLabel ("Interactive Platform Overview").
    const heroSection = page.locator('section[aria-label="Interactive Platform Overview"]');
    await expect(heroSection).toBeVisible();

    // The hero's day/night scene toggle was removed — the marketing header owns
    // the single global theme control (see HeroOverview's comment), so this
    // spec no longer asserts a second control inside the hero.

    // Scroll down to activate Back-to-Top button
    await page.evaluate(() => window.scrollTo(0, 1000));
    const backToTopBtn = page.locator('button[aria-label="Back to top"]');
    await expect(backToTopBtn).toBeVisible({ timeout: 5000 });

    // Click Back-to-Top and check scroll position
    await backToTopBtn.click();
    await page.waitForTimeout(500);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(400);
  });

  test("2. Authenticate and verify Custom Dashboard Widgets", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/en\/dashboard/);

    // Custom widgets on the redesigned dashboard (the Performance Marketing
    // engine widget was removed in the Control-Room Signal Hub redesign).
    await expect(page.locator("text=Global Live Telemetry").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Conversion Funnel").first()).toBeVisible();
  });

  test("3. QRIS payment webhook simulator & real-time reactions", async ({ page }) => {
    // The dashboard-header Event Simulator was removed in the redesign; the
    // gateway simulator now lives inside the billing page's QRIS tab, which is
    // not the default tab.
    await loginAs(page);
    await page.goto("/en/billing");
    await page.locator('[role="tab"]:has-text("QRIS & Withdraw")').click();
    const simTrigger = page.locator('button:has-text("Simulate Gateway Webhook")').first();
    await expect(simTrigger).toBeVisible({ timeout: 20000 });
    await simTrigger.click();

    // Verify Dialog content opens
    await expect(page.locator("text=Simulate & Dispatch Webhook").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("4. Affiliate & Referral Hub with Payouts & Disbursements", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/affiliates");
    await page.waitForLoadState("domcontentloaded");

    // Verify Tabs exist
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Platforms")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Affiliate Links")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Conversions")')).toBeVisible();

    // Switch to Payouts tab
    const payoutsTab = page.locator('[role="tab"]:has-text("Payouts")');
    await expect(payoutsTab).toBeVisible();
    await payoutsTab.click();

    // Verify Payout metric cards and table
    await expect(page.locator("text=Total Paid Out").first()).toBeVisible();
    await expect(page.locator("text=Available commission").first()).toBeVisible();

    // Open Request Payout Dialog
    const requestPayoutBtn = page.getByRole("button", { name: "Request Payout" });
    await expect(requestPayoutBtn).toBeVisible();
    await requestPayoutBtn.click();

    // Check Dialog contents
    await expect(page.locator("text=Request Commission Payout").first()).toBeVisible();
    await expect(page.locator("text=Select Payment Method").first()).toBeVisible();
  });

  test("5. Automated Scheduled Reports & Multi-Format Export (/reports)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/reports");
    await page.waitForLoadState("domcontentloaded");

    // Verify Scheduled Reports Button
    const scheduleBtn = page.locator('button:has-text("Scheduled Reports")').first();
    await expect(scheduleBtn).toBeVisible({ timeout: 10000 });
    await scheduleBtn.click();

    // Verify Scheduled Reports Dialog opens
    await expect(page.locator("text=Automated Scheduled Reports").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=Send Test Report Now").first()).toBeVisible();

    // Close Dialog
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible()) await cancelBtn.click();

    // Verify Export Menu dropdown
    const exportDropdown = page.locator('button:has-text("Export Report")').first();
    await expect(exportDropdown).toBeVisible();
  });

  test("6. Smart Inventory Replenishment & Supplier Purchase Orders (/inventory)", async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto("/en/inventory");
    await page.waitForLoadState("domcontentloaded");

    // Verify Tabs exist
    await expect(page.locator('[role="tab"]:has-text("Stock Overview")')).toBeVisible();
    const replenishmentTab = page.locator('[role="tab"]:has-text("Smart Replenishment")');
    await expect(replenishmentTab).toBeVisible();

    // Switch to Smart Replenishment tab
    await replenishmentTab.click();
    await expect(page.locator("text=Sales Velocity & Smart Reorder Engine").first()).toBeVisible({
      timeout: 8000,
    });
    await expect(page.locator("text=Days Left (DOI)").first()).toBeVisible();

    // Switch to Purchase Orders tab
    const poTab = page.locator('[role="tab"]:has-text("Purchase Orders")');
    await expect(poTab).toBeVisible();
    await poTab.click();
    await expect(page.locator("text=Supplier Purchase Orders (POs)").first()).toBeVisible({
      timeout: 5000,
    });

    // Open New Purchase Order Dialog
    const createPoBtn = page
      .locator('button:has-text("New Purchase Order"), button:has-text("Create Purchase Order")')
      .first();
    await expect(createPoBtn).toBeVisible();
    await createPoBtn.click();

    await expect(page.locator("text=PO Line Items").first()).toBeVisible({ timeout: 5000 });
    // Scope to the open dialog: the PO table also renders small "Cancel" row
    // chips, and an unscoped `.first()` matched one of those (behind the modal,
    // whose overlay then swallowed every click).
    const poDialog = page.getByRole("dialog");
    const cancelPoBtn = poDialog.getByRole("button", { name: "Cancel", exact: true });
    if (await cancelPoBtn.isVisible()) await cancelPoBtn.click();

    // Switch to Warehouses & Channels tab
    const whTab = page.locator('[role="tab"]:has-text("Warehouses & Channels")');
    await expect(whTab).toBeVisible();
    await whTab.click();
    await expect(page.locator("text=Jakarta Central Fulfillment Center").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=Channel Stock Allocation").first()).toBeVisible();

    // Verify Indonesian locale (/id/inventory) renders without missing message error
    await page.goto("/id/inventory");
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.locator('input[placeholder="Cari produk berdasarkan nama atau SKU..."]').first(),
    ).toBeVisible();
    await expect(page.locator("text=Distribusi Kategori").first()).toBeVisible();
  });

  test("7. Multi-Tenant White-Labeling, Custom Branding & Organization Switcher (/settings)", async ({
    page,
  }) => {
    await loginAs(page);

    // Verify Organization Switcher in header
    const orgSwitcher = page
      .locator(
        'button:has-text("Default"), button:has-text("Workspace"), button:has-text("Organization")',
      )
      .first();
    await expect(orgSwitcher).toBeVisible({ timeout: 10000 });

    // Navigate to Settings
    await page.goto("/en/settings");
    await page.waitForLoadState("domcontentloaded");

    // Verify White-Labeling & Branding card
    await expect(page.locator("text=White-Labeling & Brand Customization").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Custom Domain Routing").first()).toBeVisible();
    await expect(page.locator("text=Theme Accent Color").first()).toBeVisible();
    await expect(page.locator("text=Custom Invoice & Receipt Templates").first()).toBeVisible();

    // Verify DNS CNAME target badge
    await expect(page.locator("text=cname.next-dashboard.com").first()).toBeVisible();
  });

  test("8. Performance & Core Web Vitals Benchmark", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // Measure client performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType("paint");
      const fcp = paintEntries.find((e) => e.name === "first-contentful-paint");

      return {
        dnsLookupMs: navigation ? navigation.domainLookupEnd - navigation.domainLookupStart : 0,
        tcpHandshakeMs: navigation ? navigation.connectEnd - navigation.connectStart : 0,
        domContentLoadedMs: navigation
          ? navigation.domContentLoadedEventEnd - navigation.startTime
          : 0,
        loadCompleteMs: navigation ? navigation.loadEventEnd - navigation.startTime : 0,
        firstContentfulPaintMs: fcp ? fcp.startTime : 0,
      };
    });

    console.log("Core Performance & Web Vitals Benchmark:", metrics);
    // Assert page loaded within reasonable threshold (< 12 seconds in dev/test environment)
    expect(metrics.domContentLoadedMs).toBeGreaterThan(0);
    expect(metrics.domContentLoadedMs).toBeLessThan(12000);
  });

  test("9. Customer Cohort Retention & LTV:CAC Heatmap Engine (/analytics)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/analytics");
    await page.waitForLoadState("domcontentloaded");

    // Click Retention Tab (localized label "Cohort Retention")
    const retentionTab = page
      .locator('button[role="tab"]:has-text("Retention"), button:has-text("Retention")')
      .first();
    await retentionTab.click();
    await page.waitForTimeout(1000);

    // Verify Cohort Heatmap & Metrics. The cohort API is a PRO+ feature — the
    // seed admin sits on the Starter (REGULAR) plan, so the panel renders its
    // gated empty state with an upgrade CTA instead of the matrix data.
    await expect(page.locator("text=12-Month Cohort Retention Matrix").first()).toBeVisible({
      timeout: 10000,
    });
    const gated = page.getByText(/upgrade|Unlock|Retry/i).first();
    const champions = page.locator("text=Champions").first();
    const hasData = await champions.isVisible().catch(() => false);
    if (!hasData) {
      await expect(gated).toBeVisible();
    }
  });

  test("10. Team Chat Alert Hub for Slack & Discord (/integrations)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/integrations");
    await page.waitForLoadState("domcontentloaded");

    // Click Team Chat Tab
    const chatTab = page
      .locator('button[role="tab"]:has-text("Team Chat"), button:has-text("Team Chat")')
      .first();
    await chatTab.click();
    await page.waitForTimeout(1000);

    // Verify Hub and Connectors
    await expect(page.locator("text=Team Chat Alert Hub").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Slack Operations & Logistics").first()).toBeVisible();
    await expect(page.locator("text=Discord Finance & Growth").first()).toBeVisible();
    await expect(page.locator("text=Alert Trigger Rules").first()).toBeVisible();
    await expect(page.locator("text=Webhook Dispatch Audit Trail").first()).toBeVisible();
  });

  test("11. Global Multi-Currency & Real-Time FX Conversion Engine", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Verify currency switcher button in header
    const currencyBtn = page.locator('button[title*="currency" i], button:has-text("USD")').first();
    await expect(currencyBtn).toBeVisible({ timeout: 10000 });
    await currencyBtn.click();

    // Select IDR
    const idrOption = page
      .locator('div[role="menuitem"]:has-text("IDR"), button:has-text("IDR")')
      .first();
    await expect(idrOption).toBeVisible({ timeout: 5000 });
    await idrOption.click();

    // Verify currency switched to IDR
    await expect(page.locator("header").locator("text=IDR").first()).toBeVisible({ timeout: 5000 });
  });

  test("12. Production Health Check & Telemetry API (/api/health)", async ({ request }) => {
    const res = await request.get("/api/health?deep=true");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.database.status).toBe("connected");
    expect(body.system.nodeVersion).toBeDefined();
    expect(body.system.memory.heapUsedMb).toBeGreaterThan(0);
    expect(body.dataCounts.orders).toBeGreaterThan(0);
  });

  test("13. Autonomous AI Executive Copilot & 1-Click Action Execution", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Open Copilot via floating button
    const copilotFab = page.locator('button[aria-label*="Copilot" i]').first();
    await expect(copilotFab).toBeVisible({ timeout: 10000 });
    await copilotFab.click();
    await page.waitForTimeout(1000);

    // Verify Copilot textarea
    const input = page.locator("textarea").first();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Ask about at-risk VIP customers
    await input.fill("Who are our top 5 at-risk VIP customers?");
    await input.press("Enter");

    // Wait for response and Action Proposal Card
    await expect(page.locator("text=At-Risk VIP Customer Analysis").first()).toBeVisible({
      timeout: 15000,
    });
    const actionCard = page.locator("text=Launch 15% VIP Win-Back Discount").first();
    await expect(actionCard).toBeVisible({ timeout: 10000 });

    // Execute 1-click action
    const executeBtn = page.locator('button:has-text("Execute Action")').first();
    await expect(executeBtn).toBeVisible();
    await executeBtn.click();

    // Verify executed status
    await expect(page.locator("text=Executed").first()).toBeVisible({ timeout: 10000 });
  });

  test("14. Omnichannel Inbound Webhook Sync & DLQ Replay (/integrations)", async ({ page }) => {
    await loginAs(page);
    await page.goto("/en/integrations");
    await page.waitForLoadState("domcontentloaded");

    // Click Omnichannel Sync Tab
    const tab = page
      .locator('button[role="tab"]:has-text("Omnichannel"), button:has-text("Omnichannel")')
      .first();
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    await page.waitForTimeout(1000);

    // Verify Hub and Platforms
    await expect(page.locator("text=Omnichannel Inbound Webhook Sync").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Shopify Store").first()).toBeVisible();
    await expect(page.locator("text=TikTok Shop").first()).toBeVisible();
    await expect(page.locator("text=Dead-Letter Queue (DLQ)").first()).toBeVisible();

    // Test simulator dispatch
    const dispatchBtn = page.locator('button:has-text("Dispatch Test Webhook")').first();
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();
    await page.waitForTimeout(1000);
  });

  test("15. Granular RBAC Matrix & SOC2 Compliance Pack (/security)", async ({ page }) => {
    await loginAs(page);

    // 1. Verify compliance pack API
    const res = await page.request.get("/api/security/audit/compliance-pack");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.pack.merkleChain.ok).toBe(true);
    expect(body.pack.rbacGovernance.rolesCount).toBe(5);

    // 2. Verify Security Center UI
    await page.goto("/en/security");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=SOC 2 & ISO 27001 Compliance Center").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Merkle Chain Integrity").first()).toBeVisible();
    await expect(page.locator("text=Active Session Anomaly Telemetry").first()).toBeVisible();
  });

  test("16. Production Deployment Smoke Test & Security Headers", async ({ request }) => {
    // 1. Inbound rejection security check (401 without signature)
    const webhookRes = await request.post("/api/webhooks/inbound/shopify", {
      data: { test: true },
    });
    expect(webhookRes.status()).toBe(401);
    const dlqBody = await webhookRes.json();
    expect(dlqBody.dlqId).toBeDefined();

    // 2. Health telemetry check
    const healthRes = await request.get("/api/health?deep=true");
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe("healthy");
    expect(health.database.status).toBe("connected");
  });
});

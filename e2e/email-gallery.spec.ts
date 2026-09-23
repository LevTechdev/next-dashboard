import { test, expect } from "@playwright/test";

/**
 * Email template gallery (/emails) — design-review surface.
 *
 * Every transactional template renders through /api/emails/{slug}?locale=xx
 * with static sample data; the gallery embeds each one in a sandboxed iframe.
 * Coverage: all five template sections render, and every template × locale
 * combination answers 200 with the shared branded layout.
 */

const TEMPLATES = ["verify-email", "reset-password", "new-sign-in", "welcome", "invoice"];

const LOCALES = ["en", "id", "ja", "zh"];

test.describe("Email template gallery", () => {
  test("renders all five template sections with live preview iframes", async ({ page }) => {
    await page.goto(`/en/emails`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Transactional email templates" }),
    ).toBeVisible();

    for (const tpl of TEMPLATES) {
      const iframe = page
        .locator(`iframe[title*="${tpl.replaceAll("-", " ")}"], iframe[src*="/api/emails/${tpl}"]`)
        .first();
      await expect(iframe).toHaveCount(1);
      // src must carry the locale param
      const src = await iframe.getAttribute("src");
      expect(src).toContain(`/api/emails/${tpl}?locale=`);
    }

    // Raw-HTML links present per template
    const rawLinks = page.locator('a[href^="/api/emails/"]');
    await expect(rawLinks.first()).toBeVisible();

    // Locale switch is server-rendered: ?locale=id must re-render every
    // iframe src with the Indonesian sample data.
    await page.goto(`/en/emails?locale=id`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('iframe[src*="locale=id"]').first()).toBeVisible();
    const idSrcs = await page
      .locator("iframe")
      .evaluateAll((els) => els.map((el) => (el as HTMLIFrameElement).getAttribute("src")));
    expect(idSrcs.filter((s) => s?.includes("locale=id"))).toHaveLength(TEMPLATES.length);
  });

  for (const locale of LOCALES) {
    test(`all template previews answer 200 in locale=${locale}`, async ({ request }) => {
      for (const tpl of TEMPLATES) {
        const res = await request.get(`/api/emails/${tpl}?locale=${locale}`);
        expect(res.status()).toBe(200);
        const html = await res.text();
        // Shared branded shell markers
        expect(html).toContain("Next Dashboards");
        // Sample data — never real secrets
        expect(html).not.toContain("dash_");
      }
    });
  }

  test("unknown template returns a helpful 404", async ({ request }) => {
    const res = await request.get("/api/emails/not-a-template");
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.available).toContain("verify-email");
  });

  test("sample OTP in verify-email is static, not a real hash", async ({ request }) => {
    const res = await request.get("/api/emails/verify-email");
    const html = await res.text();
    expect(html).toContain("482913"); // documented sample code
  });
});

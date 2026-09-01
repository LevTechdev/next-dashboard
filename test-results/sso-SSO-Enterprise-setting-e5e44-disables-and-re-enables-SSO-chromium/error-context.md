# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sso.spec.ts >> SSO / Enterprise settings >> authenticated >> disables and re-enables SSO
- Location: e2e\sso.spec.ts:53:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Disabled').first()
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for getByText('Disabled').first()

```

```yaml
- region "Notifications alt+T"
- complementary:
  - link "Dashboard Pro Business Management Platform":
    - /url: /en/dashboard
    - img
    - text: Dashboard Pro Business Management Platform
  - paragraph: Management
  - link "Dashboard":
    - /url: /en/dashboard
    - img
    - text: Dashboard
  - link "Analytics":
    - /url: /en/analytics
    - img
    - text: Analytics
  - link "Sales":
    - /url: /en/sales
    - img
    - text: Sales
  - link "Orders":
    - /url: /en/orders
    - img
    - text: Orders
  - paragraph: Management
  - link "Customers":
    - /url: /en/customers
    - img
    - text: Customers
  - link "Products":
    - /url: /en/products
    - img
    - text: Products
  - link "Inventory":
    - /url: /en/inventory
    - img
    - text: Inventory
  - link "Marketing":
    - /url: /en/marketing
    - img
    - text: Marketing
  - link "Affiliates":
    - /url: /en/affiliates
    - img
    - text: Affiliates
  - link "Discounts & Coupons":
    - /url: /en/discounts
    - img
    - text: Discounts & Coupons
  - paragraph: Insights
  - link "Reports":
    - /url: /en/reports
    - img
    - text: Reports
  - link "Audit Log":
    - /url: /en/audit-log
    - img
    - text: Audit Log
  - paragraph: Account
  - link "Team":
    - /url: /en/team
    - img
    - text: Team
  - link "Billing":
    - /url: /en/billing
    - img
    - text: Billing
  - link "Notifications":
    - /url: /en/notifications
    - img
    - text: Notifications
  - link "Security":
    - /url: /en/security
    - img
    - text: Security
  - link "Settings":
    - /url: /en/settings
    - img
    - text: Settings
  - link "Profile":
    - /url: /en/profile
    - img
    - text: Profile
  - paragraph: Admin
  - link "Roles & Permissions":
    - /url: /en/roles
    - img
    - text: Roles & Permissions
  - link "Integrations":
    - /url: /en/integrations
    - img
    - text: Integrations
  - link "SSO / Enterprise":
    - /url: /en/sso
    - img
    - text: SSO / Enterprise
  - paragraph: Sales Channels
  - link "Online Store":
    - /url: /en/sales?channel=online-store
  - link "Facebook":
    - /url: /en/sales?channel=facebook
  - link "Facebook Shop":
    - /url: /en/sales?channel=facebook-shop
  - link "Instagram":
    - /url: /en/sales?channel=instagram
  - link "TikTok":
    - /url: /en/sales?channel=tiktok
  - link "Shopify":
    - /url: /en/sales?channel=shopify
  - button "Collapse":
    - img
    - text: Collapse
- banner:
  - button "Search... K":
    - img
    - text: Search...
    - img
    - text: K
  - button "Connected":
    - img
    - text: Connected
  - button "Appearance":
    - img
  - button "Switch language":
    - text: 🇬🇧
    - img
  - button "Notifications":
    - img
  - button "A Admin admin"
- main:
  - heading "SSO / Enterprise" [level=1]
  - paragraph: Manage SAML single sign-on for your workspace
  - img
  - paragraph: Okta
  - text: Enabled Certificate configured
  - paragraph: SSO is enabled for this workspace.
  - button "Edit":
    - img
    - text: Edit
  - button "Disable SSO" [disabled]:
    - img
    - text: Disable SSO
  - button "Remove connection":
    - img
    - text: Remove connection
  - img
  - heading "Connection details" [level=3]
  - text: Your SAML identity provider configuration.
  - paragraph: Provider
  - paragraph: Okta
  - paragraph: Email domain (optional)
  - paragraph: —
  - paragraph: IdP SSO URL
  - code: https://acme.okta.com/app/next-dashboard/sso/saml
  - paragraph: SP entity ID
  - code: next-dashboard
  - paragraph: Enable SSO
  - paragraph: When enabled, users can sign in through your identity provider.
  - switch "Enable SSO" [checked] [disabled]
  - img
  - heading "Service Provider metadata" [level=3]
  - text: Share this metadata with your identity provider to complete setup.
  - paragraph: Metadata URL
  - code: http://localhost:3010/api/auth/saml/metadata?tenant=default
  - button:
    - img
  - paragraph: ACS URL
  - code: http://localhost:3010/api/auth/saml/acs
  - button:
    - img
  - paragraph: Entity ID
  - code: next-dashboard
  - button:
    - img
  - link "Open metadata":
    - /url: http://localhost:3010/api/auth/saml/metadata?tenant=default
    - img
    - text: Open metadata
  - link "Test SSO login":
    - /url: /api/auth/saml/login?tenant=default
    - img
    - text: Test SSO login
  - paragraph: Opens an SP-initiated login to verify the flow.
- button "Open AI Copilot":
  - img
- alert
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import { loginAs } from "./helpers";
  3   | 
  4   | /**
  5   |  * SSO / Enterprise settings E2E (src/components/sso/sso-settings.tsx).
  6   |  * Seed the DB first: `npm run db:seed`. Seed admin creds: nextdashboards@gmail.com / admin123.
  7   |  *
  8   |  * The SSO page is only reachable when authenticated; visiting it logged out
  9   |  * redirects to /en/login.
  10  |  *
  11  |  * NOTE: these tests share the dev DB, so they must tolerate prior state — the
  12  |  * admin's tenant may already have an SSO connection from an earlier run. The
  13  |  * helpers below normalize to the expected starting state before each flow.
  14  |  */
  15  | test.describe("SSO / Enterprise settings", () => {
  16  |   test("redirects unauthenticated visitors to the login page", async ({ page }) => {
  17  |     await page.goto("/en/sso");
  18  |     await expect(page).toHaveURL(/\/en\/login/);
  19  |   });
  20  | 
  21  |   test.describe("authenticated", () => {
  22  |     test.beforeEach(async ({ page }) => {
  23  |       await loginAs(page);
  24  |     });
  25  | 
  26  |     test("creates an SSO connection from the empty state", async ({ page }) => {
  27  |       await ensureEmptySso(page);
  28  | 
  29  |       await page.getByRole("button", { name: "Configure SSO", exact: true }).click();
  30  |       const dialog = page.getByRole("dialog");
  31  |       await expect(dialog.getByText("Configure SAML SSO")).toBeVisible();
  32  | 
  33  |       await dialog.getByPlaceholder("e.g. Okta").fill("Okta");
  34  |       await dialog
  35  |         .getByPlaceholder("https://idp.example.com/sso")
  36  |         .fill("https://acme.okta.com/app/next-dashboard/sso/saml");
  37  |       await dialog.getByPlaceholder(/BEGIN CERTIFICATE/).fill(
  38  |         "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
  39  |       );
  40  |       await dialog.getByRole("button", { name: "Save connection", exact: true }).click();
  41  | 
  42  |       // Dialog closes and the connection renders.
  43  |       await expect(dialog).not.toBeVisible();
  44  |       await expect(page.getByText("Enabled").first()).toBeVisible();
  45  |       await expect(page.getByText("Certificate configured").first()).toBeVisible();
  46  | 
  47  |       // The SP metadata card is tenant-scoped (admin operates on the default
  48  |       // workspace when their session carries no tenant claim).
  49  |       await expect(page.getByText(/metadata\?tenant=default/)).toBeVisible();
  50  |       await expect(page.getByText(/\/api\/auth\/saml\/acs/)).toBeVisible();
  51  |     });
  52  | 
  53  |     test("disables and re-enables SSO", async ({ page }) => {
  54  |       await ensureConfiguredSso(page);
  55  | 
  56  |       await page.getByRole("button", { name: "Disable SSO", exact: true }).click();
> 57  |       await expect(page.getByText("Disabled").first()).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  58  | 
  59  |       await page.getByRole("button", { name: "Enable SSO", exact: true }).click();
  60  |       await expect(page.getByText("Enabled").first()).toBeVisible();
  61  |     });
  62  | 
  63  |     test("removes the connection after confirmation", async ({ page }) => {
  64  |       await ensureConfiguredSso(page);
  65  | 
  66  |       await page.getByRole("button", { name: "Remove connection", exact: true }).click();
  67  |       const dialog = page.getByRole("dialog");
  68  |       await expect(dialog.getByText("Remove SSO connection?")).toBeVisible();
  69  |       await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  70  | 
  71  |       await expect(page.getByText("No SSO connection")).toBeVisible();
  72  |     });
  73  |   });
  74  | });
  75  | 
  76  | /** Wait for client-side data to load (hydration + GET) before interacting. */
  77  | async function waitForSsoState(page: Page) {
  78  |   await expect(
  79  |     page.getByText(/No SSO connection|Enabled/).first(),
  80  |   ).toBeVisible();
  81  | }
  82  | 
  83  | /** Guarantee the page shows the empty state, deleting any prior connection. */
  84  | async function ensureEmptySso(page: Page) {
  85  |   await page.goto("/en/sso");
  86  |   await waitForSsoState(page);
  87  |   const empty = page.getByText("No SSO connection");
  88  |   if (!(await empty.isVisible())) {
  89  |     await page.getByRole("button", { name: "Remove connection", exact: true }).click();
  90  |     const dialog = page.getByRole("dialog");
  91  |     await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  92  |     await expect(empty).toBeVisible();
  93  |   }
  94  | }
  95  | 
  96  | /** Guarantee a connection is configured, creating one if needed. */
  97  | async function ensureConfiguredSso(page: Page) {
  98  |   await page.goto("/en/sso");
  99  |   await waitForSsoState(page);
  100 |   if (!(await page.getByText("Enabled").first().isVisible())) {
  101 |     await page.getByRole("button", { name: "Configure SSO", exact: true }).click();
  102 |     const dialog = page.getByRole("dialog");
  103 |     await expect(dialog.getByText("Configure SAML SSO")).toBeVisible();
  104 |     await dialog.getByPlaceholder("e.g. Okta").fill("Okta");
  105 |     await dialog
  106 |       .getByPlaceholder("https://idp.example.com/sso")
  107 |       .fill("https://acme.okta.com/app/next-dashboard/sso/saml");
  108 |     await dialog.getByPlaceholder(/BEGIN CERTIFICATE/).fill(
  109 |       "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
  110 |     );
  111 |     await dialog.getByRole("button", { name: "Save connection", exact: true }).click();
  112 |     await expect(page.getByText("Enabled").first()).toBeVisible();
  113 |   }
  114 | }
  115 | 
```
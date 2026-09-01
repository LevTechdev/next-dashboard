# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sso.spec.ts >> SSO / Enterprise settings >> authenticated >> removes the connection after confirmation
- Location: e2e\sso.spec.ts:63:9

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/en\/dashboard/
Received string:  "http://localhost:3010/en/login"
Timeout: 20000ms

Call log:
  - Expect "toHaveURL" with timeout 20000ms
    43 × unexpected value "http://localhost:3010/en/login"

```

```yaml
- region "Notifications alt+T"
- button "Toggle theme":
  - img
- img
- heading "Welcome back" [level=1]
- paragraph: Log in to your account to continue exploring and utilizing our resources.
- text: Email
- textbox "Your email": nextdashboards@gmail.com
- text: Password
- textbox "Enter password": admin123
- button "Logging in..." [disabled]:
  - img
  - text: Logging in...
- text: OR
- button:
  - img
- button:
  - img
- button:
  - img
- paragraph:
  - text: Don't have an account?
  - link "Create one":
    - /url: /en/register
- paragraph: "Demo: nextdashboards@gmail.com / admin123"
- text: Community of designers Creative resources
- paragraph: "\"I was able to reduce the time taken to present high-level designs by 35% using the platform.\""
- paragraph: Sara Bright
- paragraph: Freelancer Designer
- button:
  - img
- button:
  - img
- alert
```

# Test source

```ts
  1   | import { expect, type Locator, type Page } from "@playwright/test";
  2   | 
  3   | /**
  4   |  * Shared E2E helpers.
  5   |  *
  6   |  * The register API runs an HIBP breach check, so test passwords must NOT be
  7   |  * in known breach corpora — keep TEST_PASSWORD out of any public breach dump.
  8   |  */
  9   | export const TEST_PASSWORD = "Kx9#mQ2vLp7!wZ";
  10  | 
  11  | /** Seed admin credentials (see `npm run db:seed`). */
  12  | export const SEED_ADMIN_EMAIL = "nextdashboards@gmail.com";
  13  | export const SEED_ADMIN_PASSWORD = "admin123";
  14  | 
  15  | /**
  16  |  * Log in through the /en/login form and wait for the dashboard. Defaults to
  17  |  * the seed admin credentials. Only for accounts WITHOUT 2FA (the seed admin
  18  |  * has 2FA disabled); the TOTP-gated login flow lives in the 2FA spec.
  19  |  *
  20  |  * The submit button is disabled until both fields are filled AND React
  21  |  * hydrates, so we wait for it to become enabled before clicking — a click
  22  |  * during hydration is silently dropped.
  23  |  *
  24  |  * Idempotent: if the context already holds a session cookie (e.g. a spec's
  25  |  * beforeEach logged in and the test re-enters), the form is skipped and the
  26  |  * page is just navigated to the dashboard — re-submitting would hit the
  27  |  * /en/login -> /en/dashboard redirect loop and time out.
  28  |  */
  29  | export async function loginAs(
  30  |   page: Page,
  31  |   email: string = SEED_ADMIN_EMAIL,
  32  |   password: string = SEED_ADMIN_PASSWORD,
  33  | ): Promise<void> {
  34  |   // Already-signed-in hardening: a session cookie present in the context means
  35  |   // the page is authenticated (e.g. a spec's beforeEach logged in and the test
  36  |   // re-enters loginAs). Going through the form would loop forever — /en/login
  37  |   // redirects an authenticated session straight back to /en/dashboard, so the
  38  |   // email-input poll below would spin until its timeout ("login page never
  39  |   // served the form"). Detect the session and just ensure we're on the
  40  |   // dashboard, preserving loginAs's post-condition.
  41  |   const hasSession = (await page.context().cookies()).some(
  42  |     (c) => c.name === "token" && c.value.length > 0,
  43  |   );
  44  |   if (hasSession) {
  45  |     await page.goto("/en/dashboard");
  46  |     await expect(page).toHaveURL(/\/en\/dashboard/);
  47  |     return;
  48  |   }
  49  | 
  50  |   // Cold-start hardening: the webServer port probe can succeed a beat before
  51  |   // a fresh `next dev` actually serves routes (notably on Windows), so the
  52  |   // first goto can land on a Next.js 404 page. Re-issue the goto until the
  53  |   // login form renders instead of trusting a single shot — otherwise the
  54  |   // very first spec of a run (which is often the coldest) flakes.
  55  |   await expect
  56  |     .poll(
  57  |       async () => {
  58  |         if ((await page.locator('input[type="email"]').count()) === 0) {
  59  |           await page.goto("/en/login");
  60  |           await page.waitForLoadState("networkidle");
  61  |         }
  62  |         return (await page.locator('input[type="email"]').count()) > 0;
  63  |       },
  64  |       { timeout: 45_000, message: "login page never served the form" },
  65  |     )
  66  |     .toBe(true);
  67  |   // Values typed before React hydrates are silently dropped (the submit never
  68  |   // enables). Retry the fills until the button enables — robust on a cold dev
  69  |   // server, where the login route may be the first page compiled in the run.
  70  |   const emailInput = page.locator('input[type="email"]');
  71  |   const passwordInput = page.getByPlaceholder("Enter password");
  72  |   const submit = page.getByRole("button", { name: "Log in", exact: true });
  73  |   await expect
  74  |     .poll(
  75  |       async () => {
  76  |         await emailInput.fill(email);
  77  |         await passwordInput.fill(password);
  78  |         return submit.isEnabled();
  79  |       },
  80  |       { timeout: 20_000, message: "login form never hydrated" },
  81  |     )
  82  |     .toBe(true);
  83  |   await submit.click();
> 84  |   await expect(page).toHaveURL(/\/en\/dashboard/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  85  | }
  86  | 
  87  | /**
  88  |  * Log out through the header user menu and land back on /en/login.
  89  |  *
  90  |  * The header (src/components/layout/header.tsx) has multiple dropdown triggers
  91  |  * with aria-haspopup="menu" (theme toggle, notifications, user menu). The
  92  |  * user-menu trigger is the one containing the avatar fallback span
  93  |  * (`.avatar-brand`, always rendered), so it's located by that rather than by
  94  |  * the user's name — meaning this works for ANY signed-in account, not just
  95  |  * the seed admin.
  96  |  *
  97  |  * Sequence: open the user menu → click the "Logout" menuitem → confirm the
  98  |  * destructive dialog (ConfirmProvider) → logout() POSTs /api/auth/logout,
  99  |  * clears the token cookie, and router.push("/en/login").
  100 |  */
  101 | export async function logoutViaHeader(page: Page): Promise<void> {
  102 |   await page
  103 |     .locator('header button[aria-haspopup="menu"]')
  104 |     .filter({ has: page.locator("span.avatar-brand") })
  105 |     .click();
  106 |   await page.getByRole("menuitem", { name: /logout/i }).click();
  107 |   await expect(page.getByText("Log out?")).toBeVisible();
  108 |   await page.getByRole("button", { name: "Logout" }).click();
  109 |   await expect(page).toHaveURL(/\/en\/login/);
  110 | }
  111 | 
  112 | export interface RegisterFreshUserOptions {
  113 |   /**
  114 |    * Fixed email to use — e.g. a module-level variable shared across serial
  115 |    * tests in a spec. When omitted, a unique email is generated.
  116 |    */
  117 |   email?: string;
  118 |   /** Prefix for the auto-generated email. Defaults to "user". */
  119 |   emailPrefix?: string;
  120 |   /** Name filled into the signup form. Defaults to "E2E Test User". */
  121 |   name?: string;
  122 | }
  123 | 
  124 | /**
  125 |  * Register a brand-new user and land on the dashboard WITHOUT verifying the
  126 |  * email (clicking "Skip for now" on the signup OTP step). Every signup issues
  127 |  * a 6-digit email OTP for identity verification; the OTP step is deliberately
  128 |  * skipped so the account starts unverified (the flows that call this helper
  129 |  * exercise the unverified state themselves, and must not mutate shared state
  130 |  * like the seed admin's emailVerified / 2FA settings).
  131 |  *
  132 |  * Uses a unique auto-generated email by default (Date.now + random suffix so
  133 |  * parallel workers never collide); pass `options.email` to pin one, e.g. for
  134 |  * serial specs that share the account across tests.
  135 |  *
  136 |  * Returns the email so callers can reuse the account.
  137 |  */
  138 | export interface FillRegistrationFormOptions {
  139 |   /** Name filled into the signup form. Defaults to "E2E Test User". */
  140 |   name?: string;
  141 |   /**
  142 |    * Password + confirmation filled into the signup form. Defaults to
  143 |    * TEST_PASSWORD; override to test validation errors (e.g. too short).
  144 |    */
  145 |   password?: string;
  146 | }
  147 | 
  148 | /**
  149 |  * Fill the signup form and click "Create Account". Assumes the register page
  150 |  * is already loaded (callers wait for hydration via networkidle first).
  151 |  * The submit button is disabled until the confirmation matches, so it always
  152 |  * receives the same value as the password.
  153 |  */
  154 | export async function fillRegistrationForm(
  155 |   page: Page,
  156 |   email: string,
  157 |   options: FillRegistrationFormOptions = {},
  158 | ): Promise<void> {
  159 |   const password = options.password ?? TEST_PASSWORD;
  160 |   await page.getByPlaceholder("Your name").fill(options.name ?? "E2E Test User");
  161 |   await page.getByPlaceholder("Your email").fill(email);
  162 |   await page.getByPlaceholder("Create a password").fill(password);
  163 |   await page.getByPlaceholder("Confirm password").fill(password);
  164 |   const submit = page.getByRole("button", { name: "Create account" });
  165 |   await expect(submit).toBeEnabled();
  166 |   await submit.click();
  167 | }
  168 | 
  169 | /**
  170 |  * Read the dev-mode 6-digit OTP (rendered inline when no mailer is
  171 |  * configured) and submit it to complete the signup identity-verification step.
  172 |  * Assumes the "Check your email" step is on screen.
  173 |  */
  174 | export async function completeSignupOtp(page: Page): Promise<void> {
  175 |   await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  176 |   const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
  177 |   expect(code).toMatch(/^\d{6}$/);
  178 |   // The OTP input auto-submits the moment the 6th digit lands, so filling the
  179 |   // code triggers verification directly. Do NOT click "Verify Email" — the
  180 |   // click would race the in-flight request (button flips to a disabled
  181 |   // "Verifying…" state) and either time out or double-fire the submission.
  182 |   await page.locator('input[maxLength="6"]').fill(code);
  183 |   await expect(page).toHaveURL(/\/en\/dashboard/);
  184 | }
```
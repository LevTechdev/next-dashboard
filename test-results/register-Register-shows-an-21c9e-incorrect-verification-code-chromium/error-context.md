# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register.spec.ts >> Register >> shows an attempts-left error for an incorrect verification code
- Location: e2e\register.spec.ts:45:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Check your email' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for getByRole('heading', { name: 'Check your email' })

```

```yaml
- region "Notifications alt+T"
- button "Toggle theme":
  - img
- img
- heading "Create an account" [level=1]
- paragraph: Start exploring and utilizing all the resources that will help you elevate every design you make.
- text: Name
- textbox "Your name": E2E Test User
- text: Email
- textbox "Your email": bad-otp-1787911782675@example.com
- text: Password
- textbox "Create a password": Kx9#mQ2vLp7!wZ
- text: Confirm Password
- textbox "Confirm password": Kx9#mQ2vLp7!wZ
- button "Creating..." [disabled]:
  - img
  - text: Creating...
- text: OR
- button:
  - img
- button:
  - img
- button:
  - img
- paragraph:
  - text: Already have an account?
  - link "Log in":
    - /url: /en/login
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
  1  | import { test, expect } from "@playwright/test";
  2  | import { fillRegistrationForm, completeSignupOtp } from "./helpers";
  3  | 
  4  | /**
  5  |  * Register E2E (pw4).
  6  |  * Seed the DB first: `npm run db:seed`.
  7  |  * Seeded email for the duplicate test: nextdashboards@gmail.com.
  8  |  *
  9  |  * The register form (src/app/[locale]/(auth)/register/page.tsx):
  10 |  * - name     <input type="text"  placeholder="John Doe">
  11 |  * - email    <input type="email" placeholder="you@example.com">
  12 |  * - password <input placeholder="Min. 6 characters">
  13 |  * - confirm  <input placeholder="Repeat your password">
  14 |  * - submit   <button>Create Account</button>
  15 |  *   NOTE: disabled unless password === confirmPassword, so confirm must always match.
  16 |  * - feedback via sonner toasts.
  17 |  *
  18 |  * Every new account is issued a 6-digit email OTP (identity verification).
  19 |  * In dev the raw code is rendered inline (`data-testid="dev-otp"`) so the
  20 |  * tests can complete the OTP step and reach the dashboard.
  21 |  *
  22 |  * The register API runs an HIBP breach check, so test passwords must NOT be
  23 |  * in known breach corpora ("password123" is rejected server-side).
  24 |  */
  25 | 
  26 | test.describe("Register", () => {
  27 |   test.beforeEach(async ({ page }) => {
  28 |     await page.goto("/en/register");
  29 |     // Hydration-safe: fills during hydration are silently dropped.
  30 |     await page.waitForLoadState("networkidle");
  31 |   });
  32 | 
  33 |   test("creates an account, verifies the email OTP, and lands on the dashboard", async ({
  34 |     page,
  35 |   }) => {
  36 |     const uniqueEmail = `test-${Date.now()}@example.com`;
  37 |     await fillRegistrationForm(page, uniqueEmail);
  38 | 
  39 |     // Identity verification: the OTP step appears right after signup.
  40 |     await completeSignupOtp(page);
  41 | 
  42 |     await expect(page).toHaveURL(/\/en\/dashboard/);
  43 |   });
  44 | 
  45 |   test("shows an attempts-left error for an incorrect verification code", async ({ page }) => {
  46 |     await fillRegistrationForm(page, `bad-otp-${Date.now()}@example.com`);
  47 | 
> 48 |     await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
     |                                                                           ^ Error: expect(locator).toBeVisible() failed
  49 |     // Auto-submit fires on the 6th digit — no "Verify Email" click (it would
  50 |     // race the in-flight request; the error surfaces from the auto-submit).
  51 |     await page.locator('input[maxLength="6"]').fill("000000");
  52 | 
  53 |     await expect(page.getByText(/attempt\(s\) left/i)).toBeVisible();
  54 |     // Still on the OTP step — not logged into the dashboard.
  55 |     await expect(page).toHaveURL(/\/en\/register/);
  56 |   });
  57 | 
  58 |   test("rejects a password shorter than 6 characters and stays on /register", async ({ page }) => {
  59 |     // Matching short passwords keep the submit button enabled; the client
  60 |     // length<6 check fires on submit.
  61 |     await fillRegistrationForm(page, `short-${Date.now()}@example.com`, {
  62 |       password: "123",
  63 |     });
  64 | 
  65 |     await expect(page.getByText(/at least 6 characters/i).first()).toBeVisible();
  66 |     await expect(page).toHaveURL(/\/en\/register/);
  67 |   });
  68 | 
  69 |   test("rejects a duplicate email and stays on /register", async ({ page }) => {
  70 |     await fillRegistrationForm(page, "nextdashboards@gmail.com");
  71 | 
  72 |     await expect(page.getByText(/already in use|already exists|failed/i).first()).toBeVisible();
  73 |     await expect(page).toHaveURL(/\/en\/register/);
  74 |   });
  75 | });
  76 | 
```
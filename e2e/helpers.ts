import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared E2E helpers.
 *
 * The register API runs an HIBP breach check, so test passwords must NOT be
 * in known breach corpora — keep TEST_PASSWORD out of any public breach dump.
 */
export const TEST_PASSWORD = "Kx9#mQ2vLp7!wZ";

/** Seed admin credentials (see `npm run db:seed`). */
export const SEED_ADMIN_EMAIL = "nextdashboards@gmail.com";
export const SEED_ADMIN_PASSWORD = "admin123";

/**
 * Headroom for fetch-gated renders: dashboard reads go through the remote DB
 * and queue behind parallel workers' argon2 logins (~10s CPU each), which
 * blows past the 20s default expect timeout. Use for any wait that gates on a
 * network fetch resolving — initial data lists, post-action refetches, and
 * dialog closes that only happen after a POST/PUT/DELETE succeeds.
 */
export const FETCH_GATED = { timeout: 45_000 } as const;

/**
 * Session cache for loginAs: token strings keyed by "email:password". Workers
 * share module state when the suite runs in the same process, and the goal is
 * to mint at most one argon2 login per credential per run.
 */
const sessionTokens = new Map<string, string>();

// ── Login-throttle awareness ─────────────────────────────────────────────────
//
// /api/auth/login limits 10 attempts / 120s per IP (persisted as SecurityEvent
// rows, so it survives a dev-server restart) and answers 429 with a
// `Retry-After` header. Back-to-back spec runs legitimately trip it; a
// throttled response used to surface as a confusing "redirected back to
// /login" failure. These helpers make the suite wait the window out instead:
// the header is authoritative when present, and the module-level deadline lets
// every later call in the same worker back off proactively instead of
// re-discovering the limit with more attempts.

const THROTTLE_FALLBACK_SECONDS = 30;
let throttledUntil = 0;

/** Seconds to wait, preferring the response's Retry-After header. */
function retryAfterSecondsFrom(res: { headers: () => Record<string, string> }): number {
  const raw = res.headers()["retry-after"];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : THROTTLE_FALLBACK_SECONDS;
}

/** Wait out a throttle window (with a small clock-skew buffer). */
async function waitOutThrottle(seconds: number): Promise<void> {
  const ms = Math.max(seconds, 1) * 1000 + 500;
  throttledUntil = Math.max(throttledUntil, Date.now() + ms);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Public: sleep when a previously-seen 429 window is still open. Specs that
 * drive the login form themselves (the TOTP flow) should call this right
 * before submitting so they inherit the backoff.
 */
export async function waitForLoginThrottleWindow(): Promise<void> {
  const remaining = throttledUntil - Date.now();
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

/** Predicate for page.waitForResponse — the login POST only. */
const isLoginResponse = (res: { url: () => string }) => res.url().includes("/api/auth/login");

/**
 * Log in through the /en/login form and wait for the dashboard. Defaults to
 * the seed admin credentials. Only for accounts WITHOUT 2FA (the seed admin
 * has 2FA disabled); the TOTP-gated login flow lives in the 2FA spec.
 *
 * The submit button is disabled until both fields are filled AND React
 * hydrates, so we wait for it to become enabled before clicking — a click
 * during hydration is silently dropped.
 *
 * Idempotent: if the context already holds a session cookie (e.g. a spec's
 * beforeEach logged in and the test re-enters), the form is skipped and the
 * page is just navigated to the dashboard — re-submitting would hit the
 * /en/login -> /en/dashboard redirect loop and time out.
 */
export async function loginAs(
  page: Page,
  email: string = SEED_ADMIN_EMAIL,
  password: string = SEED_ADMIN_PASSWORD,
): Promise<void> {
  // Already-signed-in hardening: a session cookie present in the context means
  // the page is authenticated (e.g. a spec's beforeEach logged in and the test
  // re-enters loginAs). Going through the form would loop forever — /en/login
  // redirects an authenticated session straight back to /en/dashboard, so the
  // email-input poll below would spin until its timeout ("login page never
  // served the form"). Detect the session and just ensure we're on the
  // dashboard, preserving loginAs's post-condition.
  const hasSession = (await page.context().cookies()).some(
    (c) => c.name === "token" && c.value.length > 0,
  );
  if (hasSession) {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 45_000 });
    return;
  }

  // Cross-worker session cache: each test gets a fresh context (no cookies),
  // and every cold form login burns ~10s of dev-server CPU in argon2 — with
  // 2 workers that contention also delays every parallel dashboard fetch. The
  // first login mints a token and caches it (keyed by credentials); later
  // logins inject it directly and verify it still works by landing on the
  // dashboard. The seed admin is shared, so the cache hit rate is high; a
  // revoked/expired cached token falls through to the form path below.
  const credKey = `${email}:${password}`;
  const cachedToken = sessionTokens.get(credKey);
  if (cachedToken) {
    await page.context().addCookies([
      {
        name: "token",
        value: cachedToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/en/dashboard");
    if (page.url().includes("/en/dashboard")) {
      return;
    } // Token dead (server restart with a changed JWT secret, revocation, etc.)
    // — clear and fall through to the form path.
    sessionTokens.delete(credKey);
  }

  // A 429 seen by an earlier call in this worker is enough to know the window
  // is open — wait it out before spending another attempt on it.
  await waitForLoginThrottleWindow();

  // API-login fast path: the form flow depends on the login page's client
  // hydration, which a degraded/loaded dev server can stall indefinitely
  // (fields filled, submit never enables — seen on long-lived servers).
  // POSTing the credentials directly mints the same httpOnly token cookie
  // into this context's cookie jar (page.request shares it with page),
  // skipping the hydration dependency entirely. Falls through to the form
  // flow below if the API rejects (bad credentials, 2FA-gated account).
  // A 429 is retried once after the Retry-After window rather than reported.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const apiLogin = await page.request.post("/api/auth/login", {
      data: { email, password },
      timeout: 90_000,
    });
    if (apiLogin.ok()) {
      const minted = (await page.context().cookies()).find(
        (c) => c.name === "token" && c.value.length > 0,
      );
      if (minted) {
        sessionTokens.set(credKey, minted.value);
        await page.goto("/en/dashboard");
        await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 45_000 });
        return;
      }
    }
    if (apiLogin.status() === 429) {
      await waitOutThrottle(retryAfterSecondsFrom(apiLogin));
      continue;
    }
    // Anything else (401, 2FA-gated) → the form path below.
    break;
  }

  // Cold-start hardening: the webServer port probe can succeed a beat before
  // a fresh `next dev` actually serves routes (notably on Windows), so the
  // first goto can land on a Next.js 404 page. Re-issue the goto until the
  // login form renders instead of trusting a single shot — otherwise the
  // very first spec of a run (which is often the coldest) flakes.
  await expect
    .poll(
      async () => {
        if ((await page.locator('input[type="email"]').count()) === 0) {
          await page.goto("/en/login");
          await page.waitForLoadState("networkidle");
        }
        return (await page.locator('input[type="email"]').count()) > 0;
      },
      { timeout: 45_000, message: "login page never served the form" },
    )
    .toBe(true);
  // Values typed before React hydrates are silently dropped (the submit never
  // enables). Retry the fills until the button enables — robust on a cold dev
  // server, where the login route may be the first page compiled in the run.
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.getByPlaceholder("Enter password");
  const submit = page.getByRole("button", { name: "Log in", exact: true });
  await expect
    .poll(
      async () => {
        await emailInput.fill(email);
        await passwordInput.fill(password);
        return submit.isEnabled();
      },
      { timeout: 20_000, message: "login form never hydrated" },
    )
    .toBe(true);
  // Watch the login POST so a throttled submit can be retried instead of
  // surfacing as "the form submitted but never redirected".
  const firstLoginResponse = page
    .waitForResponse(isLoginResponse, { timeout: 60_000 })
    .catch(() => null);
  await submit.click();
  const loginResponse = await firstLoginResponse;
  if (loginResponse && loginResponse.status() === 429) {
    await waitOutThrottle(retryAfterSecondsFrom(loginResponse));
    const retryLoginResponse = page
      .waitForResponse(isLoginResponse, { timeout: 60_000 })
      .catch(() => null);
    await submit.click();
    await retryLoginResponse;
  }
  // The login POST runs argon2 (~10s) against the remote DB and can queue
  // behind a parallel worker's login — give the redirect real headroom.
  await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 45_000 });

  // Cache the minted token for later workers/tests (best-effort: the cookie
  // must exist and the dashboard URL proves the session is live).
  const minted = (await page.context().cookies()).find(
    (c) => c.name === "token" && c.value.length > 0,
  );
  if (minted) {
    sessionTokens.set(credKey, minted.value);
  }
}

/**
 * Log out through the header user menu and land back on /en/login.
 *
 * The header (src/components/layout/header.tsx) has multiple dropdown triggers
 * with aria-haspopup="menu" (theme toggle, notifications, user menu). The
 * user-menu trigger is the one containing the avatar fallback span
 * (`.avatar-brand`, always rendered), so it's located by that rather than by
 * the user's name — meaning this works for ANY signed-in account, not just
 * the seed admin.
 *
 * Sequence: open the user menu → click the "Logout" menuitem → confirm the
 * destructive dialog (ConfirmProvider) → logout() POSTs /api/auth/logout,
 * clears the token cookie, and router.push("/en/login").
 */
export async function logoutViaHeader(page: Page): Promise<void> {
  await page
    .locator('header button[aria-haspopup="menu"]')
    .filter({ has: page.locator("span.avatar-brand") })
    .click();
  await page.getByRole("menuitem", { name: /logout/i }).click();
  await expect(page.getByText("Log out?")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/en\/login/);
}

export interface RegisterFreshUserOptions {
  /**
   * Fixed email to use — e.g. a module-level variable shared across serial
   * tests in a spec. When omitted, a unique email is generated.
   */
  email?: string;
  /** Prefix for the auto-generated email. Defaults to "user". */
  emailPrefix?: string;
  /** Name filled into the signup form. Defaults to "E2E Test User". */
  name?: string;
}

/**
 * Register a brand-new user and land on the dashboard WITHOUT verifying the
 * email. Every signup issues a 6-digit email OTP for identity verification;
 * the current UI has no "Skip for now" affordance on the OTP step, but the
 * register API sets the session cookie at signup, so navigating straight to
 * the dashboard leaves the account unverified (the flows that call this
 * helper exercise the unverified state themselves, and must not mutate shared
 * state like the seed admin's emailVerified / 2FA settings).
 *
 * Uses a unique auto-generated email by default (Date.now + random suffix so
 * parallel workers never collide); pass `options.email` to pin one, e.g. for
 * serial specs that share the account across tests.
 *
 * Returns the email so callers can reuse the account.
 */
export interface FillRegistrationFormOptions {
  /** Name filled into the signup form. Defaults to "E2E Test User". */
  name?: string;
  /**
   * Password + confirmation filled into the signup form. Defaults to
   * TEST_PASSWORD; override to test validation errors (e.g. too short).
   */
  password?: string;
}

/**
 * Fill the signup form and click "Sign Up" (t("signUpButton")). Assumes the
 * register page is already loaded (callers wait for hydration via networkidle
 * first).
 *
 * Selectors match the CURRENT register UI (src/app/[locale]/(auth)/register/
 * page.tsx): the name placeholder is localized ("John Doe" in en), the email
 * input's placeholder is the hard-coded "you@example.com", and both password
 * fields share the bullet "••••••••" placeholder — so the password fields are
 * located by input type rather than placeholder text. The submit button is
 * only disabled while a request is in flight (validation fires on submit as
 * toasts), so it always receives the same value as the password.
 */
export async function fillRegistrationForm(
  page: Page,
  email: string,
  options: FillRegistrationFormOptions = {},
): Promise<void> {
  const password = options.password ?? TEST_PASSWORD;
  await page.getByPlaceholder("John Doe").fill(options.name ?? "E2E Test User");
  await page.getByPlaceholder("you@example.com").fill(email);
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.first().fill(password);
  await passwordInputs.nth(1).fill(password);
  const submit = page.getByRole("button", { name: "Sign Up", exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
}

/**
 * Read the dev-mode 6-digit OTP (rendered inline when no mailer is
 * configured) and submit it to complete the signup identity-verification step.
 * Assumes the "Verify your email" step (t("verifyEmailTitle")) is on screen.
 */
export async function completeSignupOtp(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  // The OTP input carries no maxLength attribute (the page slices to 6 digits
  // in JS) and does NOT auto-submit on the 6th digit — click the explicit
  // "Verify & Continue" button (t("verifyContinue")) to submit.
  await page.getByPlaceholder("000000").fill(code);
  await page.getByRole("button", { name: "Verify & Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

export interface WaitForStableLayoutOptions<T> {
  /**
   * Measurement function serialized into the page; returns a JSON-serializable
   * sample. Must be a self-contained function (no closures over test-scope
   * values) since it runs inside the browser via `locator.evaluate`.
   */
  measure: (el: HTMLElement) => T;
  /**
   * Optional gate that must pass before the stability check runs — e.g.
   * requiring a specific child count once the element has hydrated.
   */
  isReady?: (sample: T) => boolean;
  /**
   * Optional custom stability predicate over two consecutive samples. Defaults
   * to comparing `scrollWidth` and `clientWidth` across a double-rAF.
   */
  isStable?: (a: T, b: T) => boolean;
  /** Total budget to wait, in ms. Generous default for cold-route compiles. */
  timeout?: number;
  /** Interval between samples while polling, in ms. */
  pollInterval?: number;
  /** Message for the failure assertion. */
  message?: string;
}

/**
 * Poll a locator until its layout has settled, returning the last stable
 * measurement.
 *
 * Cold-compiled routes can take a moment to hydrate, during which an element
 * is momentarily zero-sized (0x0) — and naive assertions on its geometry
 * (e.g. `scrollWidth > clientWidth` for an overflow check) vacuously pass or
 * fail against that broken layout. This waits until the element has real
 * layout and its metrics are stable across a double-rAF (meaning no re-render
 * is in flight), which is the pattern that makes scroll/overflow assertions
 * reliable on first-page-load.
 *
 * Usage:
 * ```
 * const m = await waitForStableLayout(page, listLocator, {
 *   measure: (el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }),
 *   isReady: (s) => s.clientWidth >= 10,
 *   message: "list never stabilized",
 * });
 * ```
 *
 * Throws (failing the test) if the metrics never stabilize within the timeout.
 */
export async function waitForStableLayout<T>(
  page: Page,
  locator: Locator,
  options: WaitForStableLayoutOptions<T>,
): Promise<T> {
  const { measure, isReady, isStable, timeout = 15_000, pollInterval = 150, message } = options;

  let m: T | null = null;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const sample = await locator.evaluate(measure);
    // A zero-size element means hydration isn't done — keep polling. The
    // caller's isReady gate rides on top (e.g. expected child count).
    const s = sample as { scrollWidth?: number; clientWidth?: number };
    const hasLayout =
      (s.clientWidth === undefined || s.clientWidth >= 10) &&
      (s.scrollWidth === undefined || s.scrollWidth >= 10);
    if (hasLayout && (isReady ? isReady(sample) : true)) {
      await locator.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const settled = await locator.evaluate(measure);
      const stable = isStable
        ? isStable(sample, settled)
        : s.scrollWidth === undefined ||
          ((settled as { scrollWidth?: number }).scrollWidth === s.scrollWidth &&
            (settled as { clientWidth?: number }).clientWidth === s.clientWidth);
      if (stable) {
        m = sample;
        break;
      }
    }
    await page.waitForTimeout(pollInterval);
  }

  // Fails the test if the loop never stabilized. The non-null assertion after
  // it is safe — TS can't see through the matcher.
  expect(m, message ?? "element metrics never stabilized").not.toBeNull();
  return m as T;
}

/** The API Keys tab renders its toolbar only after the initial fetch resolves. */
export async function waitForApiKeysTab(page: Page): Promise<void> {
  // The toolbar renders only after the api-keys fetch resolves on the remote
  // DB; under 2-worker argon2-login contention that fetch can exceed the 20s
  // default expect timeout, so grant explicit headroom.
  await expect(page.getByRole("button", { name: "Create API Key", exact: true })).toBeVisible({
    timeout: 45_000,
  });
}

/**
 * The plan caps API keys per workspace. Specs in this suite leave their keys
 * behind, so once the cap is full POST /api/api-keys answers
 * 402 plan_limit_reached and the dialog stays open on its error toast.
 * Delete the oldest leftover key to reclaim a slot (leaving room for the one
 * about to be created). Plan-agnostic: the cap comes from the 402 itself.
 */
async function reclaimApiKeySlot(page: Page): Promise<void> {
  const listed = await page.request.get("/api/api-keys");
  if (!listed.ok()) return;
  const keys = (await listed.json()) as Array<{ id: string; name: string }>;
  const oldest = keys[keys.length - 1];
  if (!oldest) return;
  await page.request.delete("/api/api-keys", { data: { id: oldest.id } });
  // The tab refetches the list, so the freed slot is visible before we retry.
  await expect(page.getByRole("heading", { name: oldest.name, exact: true })).toHaveCount(
    0,
    FETCH_GATED,
  );
}

/** Submit the create-key dialog and return the POST response. */
async function submitCreateKey(page: Page, dialog: Locator): Promise<number> {
  const posted = page.waitForResponse(
    (r) => r.url().includes("/api/api-keys") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await dialog.getByRole("button", { name: "Generate Key", exact: true }).click();
  return (await posted).status();
}

/**
 * Open the create-key dialog, fill a unique name, submit, and return the raw
 * `dash_...` key scraped from the one-time reveal banner.
 */
export async function createApiKey(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "Create API Key", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Create API Key")).toBeVisible();
  await dialog.getByPlaceholder("e.g., Production Integration").fill(name);

  if ((await submitCreateKey(page, dialog)) === 402) {
    // At the plan's key cap — free a slot and submit again (the dialog is
    // still open, holding the name we already typed).
    await reclaimApiKeySlot(page);
    expect(
      await submitCreateKey(page, dialog),
      "create should succeed after reclaiming a slot",
    ).toBe(200);
  }

  // Both waits gate on the POST + refetch round-tripping the remote DB.
  await expect(dialog).not.toBeVisible(FETCH_GATED);

  const banner = page.locator("main .dashboard-card").filter({ hasText: "API Key Created" });
  await expect(banner).toBeVisible(FETCH_GATED);
  return (await banner.locator("code").textContent())?.trim() ?? "";
}

// ── Scrollbar proofs (the .scrollbar-thin / .scrollbar-none utilities) ──
//
// Shared by the scrollbar specs (scrollbar-thin-mobile, notification-filters-
// mobile, activity-feed-mobile). The app styles scrollbars via two real
// utilities in globals.css: `.scrollbar-thin` (scrollbar-width: thin + a 4px
// WebKit bar) and `.scrollbar-none` (scrollbar-width: none + a WebKit
// `display: none`). These helpers assert the RENDERED result in the browser so
// a regression that swaps a utility for a bare overflow class — silently
// restoring the ~15px default scrollbar — is caught.

export interface ScrollbarMetrics {
  /** The row overflows horizontally (scrollWidth > clientWidth). */
  scrollableX: boolean;
  /** The container overflows vertically (scrollHeight > clientHeight). */
  scrollableY: boolean;
  scrollLeft: number;
  /** The standard computed property: "thin" / "none" / "auto". */
  scrollbarWidth: string;
  /** `::-webkit-scrollbar` width ("4px" vs the ~15px default bar). */
  webkitWidth: string | null;
  /** `::-webkit-scrollbar` display ("none" when hidden). */
  webkitDisplay: string | null;
  /**
   * Layout space the scrollbar actually reserves (offsetWidth - clientWidth).
   * 0 means a hidden bar OR an overlay-scrollbar platform (e.g. macOS), in
   * which case the property proofs still apply.
   */
  gutter: number;
}

export async function readScrollbarMetrics(
  page: Page,
  locator: Locator,
): Promise<ScrollbarMetrics> {
  return locator.evaluate((el) => {
    const node = el as HTMLElement;
    const cs = getComputedStyle(node);
    let webkitWidth: string | null = null;
    let webkitDisplay: string | null = null;
    try {
      webkitWidth = getComputedStyle(node, "::-webkit-scrollbar").width;
      webkitDisplay = getComputedStyle(node, "::-webkit-scrollbar").display;
    } catch {
      // pseudo-element query unsupported — the other proofs still apply
    }
    return {
      scrollableX: node.scrollWidth > node.clientWidth + 1,
      scrollableY: node.scrollHeight > node.clientHeight + 1,
      scrollLeft: node.scrollLeft,
      scrollbarWidth: cs.scrollbarWidth,
      webkitWidth,
      webkitDisplay,
      gutter: node.offsetWidth - node.clientWidth,
    };
  });
}

/**
 * Assert a vertical scroll container renders the thin 4px scrollbar
 * (`.scrollbar-thin`): the real class, `scrollbar-width: thin`, a 4px WebKit
 * bar, and — where the bar reserves layout space — a 4px gutter.
 */
export async function expectThinVerticalScrollbar(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  const m = await readScrollbarMetrics(page, locator);
  // The container must actually overflow vertically — otherwise no scrollbar
  // is rendered at all and the width assertions would be vacuous.
  expect(m.scrollableY, `${label}: container should overflow vertically`).toBe(true);
  expect(
    (await locator.getAttribute("class")) ?? "",
    `${label}: real scrollbar-thin class`,
  ).toContain("scrollbar-thin");
  expect(m.scrollbarWidth, `${label}: scrollbar-width`).toBe("thin");
  expect(m.webkitWidth, `${label}: ::-webkit-scrollbar width`).toBe("4px");
  if (m.gutter > 0) {
    // Where the bar reserves layout space it must be at most the 4px thin
    // bar, never the ~15px default (which would make the gutter ≥ 15). The
    // exact figure varies by element: block containers reserve the full 4px,
    // while bordered elements (e.g. a textarea's 1px borders add to the
    // delta) and native thin textarea scrollbars can report less — all ≤ 4.
    expect(m.gutter, `${label}: scrollbar gutter width`).toBeLessThanOrEqual(4);
  }
}

/**
 * Assert the thin-scrollbar STYLING on an element that may not currently
 * overflow (so no scrollbar is rendered, but the computed properties must
 * still be the app's thin 4px bar). Used e.g. for the Radix Select dropdown
 * viewport, whose items usually fit without scrolling.
 */
export async function expectThinScrollbarStyles(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  const m = await readScrollbarMetrics(page, locator);
  expect(
    (await locator.getAttribute("class")) ?? "",
    `${label}: real scrollbar-thin class`,
  ).toContain("scrollbar-thin");
  expect(m.scrollbarWidth, `${label}: scrollbar-width`).toBe("thin");
  expect(m.webkitWidth, `${label}: ::-webkit-scrollbar width`).toBe("4px");
  // The WebKit bar must not be hidden. The default computed display is
  // "inline"; "block" only appears where an override explicitly sets it (the
  // Radix Select compound rule in globals.css, which must beat Radix's own
  // display:none — a regression there would compute "none" and fail here).
  expect(m.webkitDisplay, `${label}: ::-webkit-scrollbar display`).not.toBe("none");
}

/**
 * Assert a horizontal pill row hides its scrollbar via the real
 * `.scrollbar-none` utility: the real class, `scrollbar-width: none`, a WebKit
 * pseudo `display: none`, and zero layout gutter (a default ~15px bar, or the
 * thin 4px one, would report auto/thin and a non-zero gutter).
 */
export async function expectHiddenScrollbar(
  page: Page,
  locator: Locator,
  label: string,
  axis: "x" | "y",
): Promise<void> {
  const m = await readScrollbarMetrics(page, locator);
  expect(axis === "x" ? m.scrollableX : m.scrollableY, `${label}: row should overflow`).toBe(true);
  expect(
    (await locator.getAttribute("class")) ?? "",
    `${label}: real scrollbar-none class`,
  ).toContain("scrollbar-none");
  expect(m.scrollbarWidth, `${label}: scrollbar-width`).toBe("none");
  expect(m.webkitDisplay, `${label}: ::-webkit-scrollbar display`).toBe("none");
  expect(m.gutter, `${label}: scrollbar gutter width`).toBe(0);
}

/**
 * Assert a horizontal row still scrolls with its scrollbar hidden: a
 * programmatic scroll to the end moves the content and brings the last child
 * inside the client area (hiding a scrollbar never disables scrolling).
 */
export async function assertProgrammaticScrollWorks(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  const before = await readScrollbarMetrics(page, locator);
  expect(before.scrollableX, `${label}: row should overflow`).toBe(true);
  await locator.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  const after = await readScrollbarMetrics(page, locator);
  expect(after.scrollLeft, `${label}: programmatic scroll moved content`).toBeGreaterThan(
    before.scrollLeft,
  );
  const lastInside = await locator.evaluate((el) => {
    const node = el as HTMLElement;
    const children = node.children;
    const last = children[children.length - 1] as HTMLElement;
    const rect = last.getBoundingClientRect();
    const left = node.getBoundingClientRect().left;
    return rect.right <= left + node.clientWidth + 1;
  });
  expect(lastInside, `${label}: last item inside the client area after scroll`).toBe(true);
}

/** The computed `::-webkit-scrollbar-thumb` background (theme-dependent). */
export async function readScrollbarThumbColor(
  page: Page,
  locator: Locator,
): Promise<string | null> {
  return locator.evaluate((el) => {
    try {
      return (
        getComputedStyle(el as HTMLElement, "::-webkit-scrollbar-thumb").backgroundColor || null
      );
    } catch {
      // pseudo-element query unsupported
      return null;
    }
  });
}

/**
 * Toggle the app theme IN-PAGE (no navigation, no addInitScript): set
 * localStorage.theme and flip the `dark` class on <html>, exactly the
 * mechanism the dark tests use for their return-to-light leg — only here it
 * is a first-class helper so the light tests can prove the scrollbar thumb
 * re-colors in BOTH directions (light -> dark and dark -> light) without
 * reloading.
 */
export async function setThemeInPage(page: Page, theme: "dark" | "light"): Promise<void> {
  await page.evaluate((value) => {
    localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
  }, theme);
}

/**
 * Prove the `.dark .scrollbar-thin` thumb override re-colors the bar: read the
 * thumb color in the CURRENT (dark) theme, toggle to light in-page, read
 * again, and assert the colors differ. Callers run this with the page already
 * dark (via addInitScript + goto); this helper flips to light and leaves it
 * there, matching the suite's dark-test convention.
 */
export async function assertThumbRecolorsInDarkMode(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  const darkThumb = await readScrollbarThumbColor(page, locator);
  await setThemeInPage(page, "light");
  const lightThumb = await readScrollbarThumbColor(page, locator);
  expect(darkThumb, `${label}: dark-mode thumb color`).not.toBe(lightThumb);
}

/**
 * Bidirectional variant for light-mode tests: prove light -> dark re-colors
 * the thumb and dark -> light restores the exact light-mode value, with each
 * leg gated on the `dark` class actually flipping (prevents a silently
 * un-themed run).
 */
export async function assertThumbRecolorsBidirectionally(
  page: Page,
  locator: Locator,
  label: string,
): Promise<void> {
  const lightThumb = await readScrollbarThumbColor(page, locator);
  await setThemeInPage(page, "dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkThumb = await readScrollbarThumbColor(page, locator);
  expect(darkThumb, `${label}: dark-mode thumb color`).not.toBe(lightThumb);

  await setThemeInPage(page, "light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const lightThumbAgain = await readScrollbarThumbColor(page, locator);
  expect(lightThumbAgain, `${label}: thumb returns to the exact light-mode color`).toBe(lightThumb);
}

/**
 * Send copilot exchanges until the message thread overflows vertically, so a
 * real scrollbar renders. Mock replies are short, so a few rounds is normally
 * enough; 6 rounds is comfortably beyond what the ~500px thread needs. Assumes
 * the panel is open and `thread` is its scroll container.
 *
 * The mock precondition is enforced by the reply-text poll: a real AI provider
 * would never produce the canned mock text, so the poll times out instead of
 * the test hanging on a slow network (the dev-mode badge only appears AFTER a
 * mock reply, so it can't gate the first round).
 */
export async function fillCopilotThreadUntilScrollable(
  page: Page,
  panel: Locator,
  thread: Locator,
): Promise<void> {
  const textarea = panel.locator("textarea");
  for (let round = 0; round < 6; round++) {
    const { scrollableY } = await readScrollbarMetrics(page, thread);
    if (scrollableY) break;
    await textarea.fill(`Question ${round + 1}`);
    await textarea.press("Enter");
    // Wait for the assistant reply to land before the next round. We
    // poll for the assistant message count (the panel renders a bubble
    // for every message with role "assistant") rather than a specific
    // text pattern so the helper works in both mock mode ("dev-mode
    // mock reply") and real-provider mode (Gemini/OpenAI).
    await expect
      .poll(
        async () => {
          // Assistant messages render with the Bot icon; the message
          // content div has class whitespace-pre-wrap.
          const count = await panel.locator(".rounded-2xl .whitespace-pre-wrap").evaluateAll(
            (els) =>
              els.filter((el) => {
                const t = el.textContent?.trim() ?? "";
                // Exclude loading placeholder ("...") and empty bubbles.
                return t.length > 0 && t !== "...";
              }).length,
          );
          return count >= round + 1;
        },
        { timeout: 25_000, message: "copilot never replied" },
      )
      .toBe(true);
  }
}

/**
 * Seed the logged-in user's activity feed with enough notifications to
 * overflow its 380px cap (the feed starts empty for a fresh account).
 */
export async function seedActivityFeedNotifications(page: Page, count = 12): Promise<void> {
  for (let i = 0; i < count; i++) {
    const res = await page.request.post("/api/notifications", {
      data: {
        type: "order",
        title: `Scrollbar audit item ${i}`,
        description: `Overflow seeding item ${i}`,
      },
    });
    expect(res.ok(), `notification ${i} should be created`).toBeTruthy();
  }
}

export async function registerFreshUser(
  page: Page,
  options: RegisterFreshUserOptions = {},
): Promise<string> {
  const email =
    options.email ??
    `${options.emailPrefix ?? "user"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/en/register");
  // networkidle = hydration + initial client fetches are done, so fills land
  // on the hydrated form (fills during hydration are silently dropped).
  await page.waitForLoadState("networkidle");
  await fillRegistrationForm(page, email, { name: options.name });

  // The OTP step has no "Skip for now" button in the current UI, but the
  // register API sets the session cookie at signup, so navigating straight to
  // the dashboard preserves the unverified-account contract (the flows that
  // call this helper exercise the unverified state themselves). The OTP view
  // appearing is the signal that the signup actually succeeded. Scoped to
  // the heading ROLE: plain getByText would also match the Next.js route
  // announcer ([id="__next-route-announcer__"], role=alert), which can carry
  // the same string after a navigation — strict-mode bomb.
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/dashboard/);
  return email;
}

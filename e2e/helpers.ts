import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared E2E helpers.
 *
 * The register API runs an HIBP breach check, so test passwords must NOT be
 * in known breach corpora — keep TEST_PASSWORD out of any public breach dump.
 */
export const TEST_PASSWORD = "Kx9#mQ2vLp7!wZ";

/** Seed admin credentials (see `npm run db:seed`). */
export const SEED_ADMIN_EMAIL = "admin@dashboard.com";
export const SEED_ADMIN_PASSWORD = "admin123";

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
    await expect(page).toHaveURL(/\/en\/dashboard/);
    return;
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
      { timeout: 30_000, message: "login page never served the form" },
    )
    .toBe(true);
  // Values typed before React hydrates are silently dropped (the submit never
  // enables). Retry the fills until the button enables — robust on a cold dev
  // server, where the login route may be the first page compiled in the run.
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.getByPlaceholder("Enter your password");
  const submit = page.getByRole("button", { name: "Sign In", exact: true });
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
  await submit.click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
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
 * email (clicking "Skip for now" on the signup OTP step). Every signup issues
 * a 6-digit email OTP for identity verification; the OTP step is deliberately
 * skipped so the account starts unverified (the flows that call this helper
 * exercise the unverified state themselves, and must not mutate shared state
 * like the seed admin's emailVerified / 2FA settings).
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
 * Fill the signup form and click "Create Account". Assumes the register page
 * is already loaded (callers wait for hydration via networkidle first).
 * The submit button is disabled until the confirmation matches, so it always
 * receives the same value as the password.
 */
export async function fillRegistrationForm(
  page: Page,
  email: string,
  options: FillRegistrationFormOptions = {},
): Promise<void> {
  const password = options.password ?? TEST_PASSWORD;
  await page.getByPlaceholder("John Doe").fill(options.name ?? "E2E Test User");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Min. 6 characters").fill(password);
  await page.getByPlaceholder("Repeat your password").fill(password);
  const submit = page.getByRole("button", { name: "Create Account" });
  await expect(submit).toBeEnabled();
  await submit.click();
}

/**
 * Read the dev-mode 6-digit OTP (rendered inline when no mailer is
 * configured) and submit it to complete the signup identity-verification step.
 * Assumes the "Verify your email" step is on screen.
 */
export async function completeSignupOtp(page: Page): Promise<void> {
  await expect(page.getByText("Verify your email")).toBeVisible();
  const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  // The OTP input auto-submits the moment the 6th digit lands, so filling the
  // code triggers verification directly. Do NOT click "Verify Email" — the
  // click would race the in-flight request (button flips to a disabled
  // "Verifying…" state) and either time out or double-fire the submission.
  await page.getByPlaceholder("6-digit code").fill(code);
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
  await expect(page.getByRole("button", { name: "Create API Key", exact: true })).toBeVisible();
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
  await dialog.getByRole("button", { name: "Generate Key", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const banner = page.locator("main .dashboard-card").filter({ hasText: "API Key Created" });
  await expect(banner).toBeVisible();
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
          const count = await panel
            .locator('.rounded-2xl .whitespace-pre-wrap')
            .evaluateAll((els) =>
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

  // Skip the inline email-OTP step so the account stays unverified.
  await expect(page.getByText("Verify your email")).toBeVisible();
  await page.getByText(/Skip for now/i).click();

  await expect(page).toHaveURL(/\/en\/dashboard/);
  return email;
}

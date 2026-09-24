import { test, expect, type Page } from "@playwright/test";
import {
  FETCH_GATED,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  TEST_PASSWORD,
  signInEmailField,
} from "./helpers";

/**
 * Auth-page locale smoke tests (ja + id).
 *
 * Guards against raw-key rendering on the auth pages (e.g. a missing
 * namespace showing "auth.welcomeBack") and against a locale's login flow
 * being broken (login → localized dashboard). The strings below are the
 * CURRENT values from src/i18n/locales/{id,ja}.json (auth namespace) — if a
 * translation is edited, update the corresponding expectation here.
 *
 * Register/forgot/reset smoke tests only assert rendering (registration and
 * the reset flow are covered end-to-end by register.spec.ts and
 * forgot-password.spec.ts in en). The login test performs a REAL login with
 * the seed admin (2FA disabled) and lands on the localized dashboard route;
 * the dashboard-shell tests continue from there to pin the sidebar, header,
 * and billing page in the same locales (matching the auth-page coverage).
 * The fresh-user test registers a brand-new account under the locale,
 * verifies the OTP, clears the session, and logs back in with those
 * credentials — a real authentication round-trip for a non-seed account.
 *
 * These pages are public (no SSE stream), so waitForLoadState("networkidle")
 * is safe for hydration before asserting.
 */
const LOCALES = {
  id: {
    login: {
      heading: "Selamat datang kembali",
      emailPlaceholder: "Email Anda",
      passwordPlaceholder: "Masukkan kata sandi",
      button: "Masuk",
    },
    register: {
      heading: "Buat Akun",
      namePlaceholder: "Budi Santoso",
      button: "Daftar",
    },
    forgot: {
      heading: "Lupa kata sandi Anda?",
      button: "Kirim Tautan Reset",
    },
    reset: {
      heading: "Atur Ulang Kata Sandi",
      invalidToken: "Token reset tidak valid atau kedaluwarsa",
    },
    otp: {
      verifyTitle: "Verifikasi email Anda",
      continue: "Verifikasi & Lanjutkan",
    },
    dashboard: {
      analytics: "Analitik",
      search: "Cari...",
      settings: "Pengaturan",
      logout: "Keluar",
      billingTitle: "Langganan & Tagihan",
      billingSubtitle: "Kelola paket Anda, lihat faktur, dan perbarui informasi pembayaran",
      billingRecentInvoices: "Faktur Terbaru",
    },
  },
  ja: {
    login: {
      heading: "お帰りなさい",
      emailPlaceholder: "メールアドレス",
      passwordPlaceholder: "パスワードを入力",
      button: "ログイン",
    },
    register: {
      heading: "アカウント作成",
      namePlaceholder: "あなたの名前",
      button: "登録する",
    },
    forgot: {
      heading: "パスワードをお忘れですか？",
      button: "リセットリンクを送信",
    },
    reset: {
      heading: "パスワードのリセット",
      invalidToken: "リセットトークンが無効または期限切れです",
    },
    otp: {
      verifyTitle: "メールアドレスを確認",
      continue: "確認して続行",
    },
    dashboard: {
      analytics: "分析",
      search: "検索...",
      settings: "設定",
      logout: "ログアウト",
      billingTitle: "サブスクリプション・請求",
      billingSubtitle: "プラン管理、請求書の表示、支払い情報の更新",
      billingRecentInvoices: "最近の請求書",
    },
  },
} as const;

/**
 * Real login under `locale`, shared by the login smoke, the dashboard-shell
 * tests, and the fresh-user round-trip. Defaults to the seed admin (2FA
 * disabled). Hydration-safe: a fresh `next dev` can serve a 404 on the very
 * first hit (re-issue the goto until the form renders), and values typed
 * before React hydrates are silently dropped (retry the fills until the
 * submit enables).
 */
async function loginOnPage(
  page: Page,
  locale: string,
  s: (typeof LOCALES)[keyof typeof LOCALES],
  email: string = SEED_ADMIN_EMAIL,
  password: string = SEED_ADMIN_PASSWORD,
): Promise<void> {
  await page.goto(`/${locale}/login`);

  // Scoped to the sign-in form — see signInEmailField() for why.
  const emailInput = signInEmailField(page);

  await expect
    .poll(
      async () => {
        if ((await emailInput.count()) === 0) {
          await page.goto(`/${locale}/login`);
          await page.waitForLoadState("networkidle");
        }
        return (await emailInput.count()) > 0;
      },
      { timeout: 45_000, message: "login page never served the form" },
    )
    .toBe(true);

  const submit = page.getByRole("button", { name: s.login.button, exact: true });
  await expect
    .poll(
      async () => {
        await emailInput.fill(email);
        await page.getByPlaceholder(s.login.passwordPlaceholder).fill(password);
        return submit.isEnabled();
      },
      { timeout: 20_000, message: "login form never hydrated" },
    )
    .toBe(true);
  await submit.click();

  await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard`));
}

for (const [locale, s] of Object.entries(LOCALES)) {
  test.describe(`Auth pages in ${locale}`, () => {
    test("login page renders localized strings", async ({ page }) => {
      await page.goto(`/${locale}/login`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: s.login.heading })).toBeVisible();
      await expect(page.getByPlaceholder(s.login.emailPlaceholder)).toBeVisible();
      await expect(page.getByPlaceholder(s.login.passwordPlaceholder)).toBeVisible();
      await expect(page.getByRole("button", { name: s.login.button, exact: true })).toBeVisible();
    });

    test("register page renders localized strings", async ({ page }) => {
      await page.goto(`/${locale}/register`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: s.register.heading })).toBeVisible();
      await expect(page.getByPlaceholder(s.register.namePlaceholder)).toBeVisible();
      // The email placeholder is hard-coded "you@example.com" in every locale.
      await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
      await expect(
        page.getByRole("button", { name: s.register.button, exact: true }),
      ).toBeVisible();
    });

    test("forgot-password page renders localized strings", async ({ page }) => {
      await page.goto(`/${locale}/forgot-password`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: s.forgot.heading })).toBeVisible();
      await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
      await expect(page.getByRole("button", { name: s.forgot.button, exact: true })).toBeVisible();
    });

    test("reset-password page renders localized strings without a token", async ({ page }) => {
      // Hitting /reset-password with no token renders the invalid-token state
      // (t("auth.invalidResetToken")) above the back-to-forgot button — the
      // only locale-reachable render of that page without a real reset link.
      await page.goto(`/${locale}/reset-password`);
      await page.waitForLoadState("networkidle");

      await expect(page.getByText(s.reset.invalidToken)).toBeVisible();
      await expect(page.getByRole("button", { name: s.forgot.heading, exact: true })).toBeVisible();
    });

    test("logs in with the seed admin and lands on the localized dashboard", async ({ page }) => {
      await loginOnPage(page, locale, s);
    });

    test("registers a fresh user, verifies OTP, and logs back in under the locale", async ({
      page,
    }) => {
      const email = `${locale}-fresh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

      // ── Register through the localized form (current register UI: localized
      //    name placeholder, hard-coded "you@example.com", password inputs by
      //    type since the bullet placeholder is locale-independent).
      await page.goto(`/${locale}/register`);
      await page.waitForLoadState("networkidle");
      await page
        .getByPlaceholder(s.register.namePlaceholder)
        .fill(`E2E ${locale.toUpperCase()} User`);
      await page.getByPlaceholder("you@example.com").fill(email);
      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.first().fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: s.register.button, exact: true }).click();

      // ── OTP identity step, in the locale's language. Dev contract: with the
      //    mailer blanked the code renders inline ([data-testid="dev-otp"])
      //    and the step does NOT auto-submit — the explicit Verify button.
      //    FETCH_GATED: this heading appears only after the register POST
      //    resolves (argon2 + HIBP round-trip + a cold route compile on a
      //    long-lived dev server), which can blow past the 20s default.
      await expect(page.getByRole("heading", { name: s.otp.verifyTitle })).toBeVisible(FETCH_GATED);
      const code = (await page.getByTestId("dev-otp").textContent())?.trim() ?? "";
      expect(code).toMatch(/^\d{6}$/);
      await page.getByPlaceholder("000000").fill(code);
      await page.getByRole("button", { name: s.otp.continue, exact: true }).click();
      // Post-verify navigation stays in the registering locale (register page
      // pushes /{locale}/dashboard, not a hard-coded /en one).
      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard`));

      // ── Clear the session so the login form is exercised for real, then log
      //    back in with the FRESH credentials through the localized form.
      await page.context().clearCookies();
      await loginOnPage(page, locale, s, email, TEST_PASSWORD);
    });

    test("dashboard shell renders localized sidebar and header controls", async ({ page }) => {
      await loginOnPage(page, locale, s);

      // Sidebar (persistent at the suite's desktop viewport): a real nav item
      // in the locale's language (nav.analytics), not a raw key or English.
      // Scoped to the sidebar: the dashboard's quick-access cards render the
      // same localized labels and would trip strict mode.
      await expect(
        page.locator("a.sidebar-item", { hasText: s.dashboard.analytics }).first(),
      ).toBeVisible();

      // Header: the desktop search pill renders common.search as its visible
      // text (accessible name "<search> K"), not an aria-label — the
      // aria-label'd compact trigger is sm:hidden at the desktop viewport.
      await expect(page.getByRole("button", { name: s.dashboard.search })).toBeVisible();

      // Header user menu opens with localized items (nav.settings / nav.logout).
      // The login toast may briefly overlay the header — wait for it to clear
      // before clicking the avatar (sonner intercepts pointer events).
      await page
        .locator("[data-sonner-toast]")
        .first()
        .waitFor({ state: "detached", timeout: 15_000 })
        .catch(() => {
          /* no toast rendered — nothing to wait out */
        });
      await page.locator(".avatar-brand").first().click();
      await expect(page.getByRole("menuitem", { name: s.dashboard.settings })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: s.dashboard.logout })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("billing page renders localized headings", async ({ page }) => {
      await loginOnPage(page, locale, s);

      await page.goto(`/${locale}/billing`);
      // 20s: the billing route cold-compiles on first hit in a fresh run.
      await expect(page.getByRole("heading", { name: s.dashboard.billingTitle })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(s.dashboard.billingSubtitle)).toBeVisible();
      // The seed admin's plan state renders the Recent Invoices card, not the
      // Payment Methods one (billing.recentInvoices).
      await expect(
        page.getByRole("heading", { name: s.dashboard.billingRecentInvoices }),
      ).toBeVisible();
    });
  });
}

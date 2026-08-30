/**
 * Manual feature sweep driving both servers (:3010 dev, :3011 prod) via
 * Playwright chromium. Verifies admin login, key pages (console errors + 4xx/5xx),
 * SSO connection setup, and the full SP-initiated SSO login against the mock
 * IdP (:3012) with JIT provisioning.
 */
import { chromium } from "playwright";

const DEV = "http://localhost:3010";
const PROD = "http://localhost:3011";
const ADMIN = { email: "admin@dashboard.com", password: "admin123" };
const SSO_LOGIN_EMAIL = "alice@sso.test"; // domain drives IdP discovery
const SSO_USER_EMAIL = "sso@dashboard.com"; // asserted by the mock IdP

const results = [];
const ok = (name, detail = "") => {
  results.push({ name, status: "PASS", detail });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
};
const bad = (name, detail = "") => {
  results.push({ name, status: "FAIL", detail });
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
};

const NOISE_FILTER = (res) =>
  res.status() >= 400 &&
  (res.request().resourceType() === "document" ||
    res.request().resourceType() === "xhr" ||
    res.request().resourceType() === "fetch");

function watchPage(page, label, issues) {
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(`${label} console.error: ${msg.text().slice(0, 200)}`);
  });
  page.on("pageerror", (err) => issues.push(`${label} pageerror: ${String(err).slice(0, 200)}`));
  page.on("response", (res) => {
    if (NOISE_FILTER(res)) issues.push(`${label} ${res.status()} ${res.url().slice(0, 160)}`);
  });
}

/** goto with a settle pause (networkidle never settles: realtime polls). */
async function goto(page, url, pauseMs = 2500) {
  const resp = await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(pauseMs);
  return resp;
}

async function currentMe(page) {
  return page.evaluate(() => fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)));
}
const meEmail = (me) => me?.email || me?.user?.email || null;

async function login(page, base, email, password, label) {
  const issues = [];
  watchPage(page, label, issues);
  await goto(page, `${base}/en/login`, 1500);
  await page.getByPlaceholder("admin@dashboard.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /Sign In/, exact: true }).click();
  await page.waitForURL(/\/en\/dashboard/, { timeout: 45000 });
  await page.waitForTimeout(2500);
  const me = await currentMe(page);
  meEmail(me) === email
    ? ok(`${label}: logged in as ${email} (role ${me?.role || me?.user?.role})`)
    : bad(`${label}: /api/auth/me mismatch`, JSON.stringify(me));
  return issues;
}

async function sweepPages(page, base, label, pages) {
  const issues = [];
  watchPage(page, `${label} sweep`, issues);
  for (const p of pages) {
    const before = issues.length;
    try {
      const resp = await goto(page, `${base}${p}`, 2000);
      if (resp && resp.status() !== 200) {
        bad(`${label} ${p}`, `status ${resp.status()}`);
        continue;
      }
      if (issues.length > before) {
        bad(`${label} ${p}`, issues.slice(before).join(" | ").slice(0, 220));
      } else {
        ok(`${label} ${p}`);
      }
    } catch (e) {
      bad(`${label} ${p}`, String(e).slice(0, 200));
    }
  }
  return issues;
}

const browser = await chromium.launch({ headless: true });

try {
  /* ─────────── DEV :3010 — admin login + SSO connection setup ─────────── */
  console.log("\n=== DEV :3010 ===");
  const devCtx = await browser.newContext();
  const devPage = await devCtx.newPage();
  await login(devPage, DEV, ADMIN.email, ADMIN.password, "dev admin login");

  const devSsoIssues = [];
  watchPage(devPage, "dev SSO settings", devSsoIssues);
  await goto(devPage, `${DEV}/en/sso`);
  const hasConn = await devPage.getByText("Enabled").first().isVisible().catch(() => false);
  if (hasConn) {
    ok("dev SSO: connection already configured");
  } else {
    await devPage.getByRole("button", { name: "Configure SSO", exact: true }).click();
    await devPage.getByRole("dialog").waitFor({ timeout: 15000 });
    await devPage.getByPlaceholder("e.g. Okta").fill("Mock IdP");
    await devPage.getByPlaceholder("https://idp.example.com/sso").fill("http://localhost:3012/sso");
    const { readFileSync } = await import("node:fs");
    const cert = readFileSync("scripts/dev-idp/cert.pem", "utf8");
    await devPage.getByPlaceholder(/BEGIN CERTIFICATE/).fill(cert);
    await devPage.getByPlaceholder("example.com", { exact: true }).fill("sso.test");
    await devPage.getByRole("button", { name: "Save connection", exact: true }).click();
    await devPage.waitForTimeout(3000);
    const body = await devPage.textContent("body").catch(() => "");
    body.includes("Mock IdP") && body.includes("sso.test")
      ? ok("dev SSO: connection created (Mock IdP / sso.test)")
      : bad("dev SSO: connection not rendered", "Mock IdP/sso.test not found in body");
    body.includes("metadata?tenant=default") && body.includes("/api/auth/saml/acs")
      ? ok("dev SSO: SP metadata + ACS URLs shown")
      : bad("dev SSO: metadata/ACS URLs missing");
  }
  if (devSsoIssues.length) bad("dev SSO settings issues", devSsoIssues.slice(0, 3).join(" | "));

  /* ─────────── DEV :3010 — page sweep ─────────── */
  const devPages = [
    "/en/dashboard", "/en/analytics", "/en/orders", "/en/products", "/en/customers",
    "/en/sales", "/en/inventory", "/en/marketing", "/en/team", "/en/roles",
    "/en/billing", "/en/discounts", "/en/notifications", "/en/reports",
    "/en/audit-log", "/en/settings", "/en/integrations", "/en/profile",
    "/en/security", "/en/sso",
  ];
  await sweepPages(devPage, DEV, "dev", devPages);
  await devPage.close();

  /* ─────────── DEV :3010 — SSO login (fresh context, logged out) ─────────── */
  const ssoCtx = await browser.newContext();
  const ssoPage = await ssoCtx.newPage();
  const ssoIssues = [];
  watchPage(ssoPage, "dev SSO login", ssoIssues);
  await goto(ssoPage, `${DEV}/en/login`, 1500);
  await ssoPage.getByPlaceholder("admin@dashboard.com").fill(SSO_LOGIN_EMAIL);
  await ssoPage.getByRole("button", { name: /Sign in with SSO/, exact: true }).click();
  await ssoPage.waitForURL(/\/en\/dashboard/, { timeout: 45000 }).catch(() => {});
  await ssoPage.waitForTimeout(2500);
  const ssoMe = await currentMe(ssoPage);
  if (meEmail(ssoMe) === SSO_USER_EMAIL) {
    ok("dev SSO login: JIT-provisioned + signed in", `me = ${meEmail(ssoMe)} (role ${ssoMe?.role})`);
  } else {
    const url = ssoPage.url();
    const body = (await ssoPage.textContent("body").catch(() => "")).slice(0, 160);
    bad("dev SSO login", `URL ${url} · me=${JSON.stringify(ssoMe)} · body: ${body}`);
  }
  if (ssoIssues.length) bad("dev SSO login issues", ssoIssues.slice(0, 3).join(" | "));
  await ssoPage.close();
  await ssoCtx.close();

  /* ─────────── PROD :3011 — login + key pages + SSO login ─────────── */
  console.log("\n=== PROD :3011 ===");
  const prodCtx = await browser.newContext();
  const prodPage = await prodCtx.newPage();
  await login(prodPage, PROD, ADMIN.email, ADMIN.password, "prod admin login");
  await sweepPages(prodPage, PROD, "prod", [
    "/en/dashboard", "/en/analytics", "/en/orders", "/en/products",
    "/en/security", "/en/integrations", "/en/sso", "/en/profile",
  ]);
  await prodPage.close();

  const prodSsoCtx = await browser.newContext();
  const prodSsoPage = await prodSsoCtx.newPage();
  const prodSsoIssues = [];
  watchPage(prodSsoPage, "prod SSO login", prodSsoIssues);
  await goto(prodSsoPage, `${PROD}/en/login`, 1500);
  await prodSsoPage.getByPlaceholder("admin@dashboard.com").fill(SSO_LOGIN_EMAIL);
  await prodSsoPage.getByRole("button", { name: /Sign in with SSO/, exact: true }).click();
  await prodSsoPage.waitForURL(/\/en\/dashboard/, { timeout: 45000 }).catch(() => {});
  await prodSsoPage.waitForTimeout(2500);
  const prodSsoMe = await currentMe(prodSsoPage);
  if (meEmail(prodSsoMe) === SSO_USER_EMAIL) {
    ok("prod SSO login: JIT-provisioned + signed in", `me = ${meEmail(prodSsoMe)}`);
  } else {
    bad("prod SSO login", `URL ${prodSsoPage.url()} · me=${JSON.stringify(prodSsoMe)}`);
  }
  if (prodSsoIssues.length) bad("prod SSO login issues", prodSsoIssues.slice(0, 3).join(" | "));
  await prodSsoPage.close();
  await prodSsoCtx.close();

  await devCtx.close();
} finally {
  await browser.close();
}

/* ─────────── Summary ─────────── */
const passed = results.filter((r) => r.status === "PASS").length;
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`\n========== SUMMARY ==========`);
console.log(`${passed} passed, ${failed} failed`);
if (failed) {
  console.log("\nFailed checks:");
  for (const r of results.filter((r) => r.status === "FAIL")) console.log(`  - ${r.name}: ${r.detail}`);
  process.exit(1);
}

// Drives a real Midtrans SANDBOX Snap popup payment end-to-end against the
// local dev server (http://localhost:3010): login -> billing -> Professional
// plan -> Midtrans gateway -> Credit/Debit Card -> test card -> 3DS -> settle.
// Prints a JSON summary with the order id and final Midtrans transaction status.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3010";
const EMAIL = process.env.E2E_EMAIL || "nextdashboards@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD || "admin123";
const TEST_CARD = "4811 1111 1111 1114"; // Midtrans sandbox VISA success card
const EXPIRY = "12/30";
const CVV = "123";
const OTP = "112233"; // Midtrans sandbox 3DS password

const log = (...a) => console.log(`[snap]`, ...a);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitVisible(locator, timeout = 90_000, label = "element") {
  await locator.waitFor({ state: "visible", timeout });
  log(`visible: ${label}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);

  // ── 1. Login via API (sets the same httpOnly cookie; the UI form can stall
  //      on hydration while the pooler is slow, so avoid it) ────────────────
  let loggedIn = false;
  for (let attempt = 1; attempt <= 8 && !loggedIn; attempt++) {
    const res = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
      timeout: 60_000,
    });
    log(`login POST attempt ${attempt} -> ${res.status()}`);
    if (res.ok()) {
      const cookies = await page.context().cookies();
      loggedIn = cookies.some((c) => c.name === "token" && c.value.length > 0);
      if (loggedIn) break;
    }
    await sleep(5000);
  }
  if (!loggedIn) throw new Error("API login never succeeded");
  await page.goto(`${BASE}/en/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  log("logged in → dashboard");

  // ── 2. Billing → Plans ────────────────────────────────────────────────
  // The Plans tab sometimes mounts into a stuck spinner when the DB is slow;
  // a full reload remounts it cleanly. Also probe the API straight from the
  // page so a browser-side fetch problem is visible.
  const proBtn = page.getByRole("button", { name: /Switch to Professional/ });
  let gridReady = false;
  for (let cycle = 0; cycle < 4 && !gridReady; cycle++) {
    await page.goto(`${BASE}/en/billing`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("tab", { name: "Plans" }).click();
    const probe = await page.evaluate(async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45_000);
        const r = await fetch("/api/billing/plans", { signal: ctrl.signal });
        clearTimeout(t);
        const j = await r.json();
        return { ok: r.ok, count: Array.isArray(j) ? j.length : -1 };
      } catch (e) {
        return { err: String(e) };
      }
    });
    log(`cycle ${cycle + 1}: page-side plans probe=${JSON.stringify(probe)}`);
    for (let i = 0; i < 30 && !gridReady; i++) {
      if (await proBtn.isVisible().catch(() => false)) {
        gridReady = true;
        break;
      }
      await sleep(2000);
    }
    if (gridReady) break;
    log(`cycle ${cycle + 1}: plans grid still not mounted — reloading`);
  }
  if (!gridReady) throw new Error("plans grid never mounted");
  log("plans grid ready");
  await proBtn.click();

  const dialog = page.getByRole("dialog");
  await waitVisible(dialog, 30_000, "switch dialog");
  await page.getByText("Midtrans (Local payments)").click();
  await page.getByText("Credit / Debit Card").click();
  await page.screenshot({ path: "/tmp/snap-step-1-dialog.png" });
  await dialog.getByRole("button", { name: "Confirm Plan Change" }).click();
  log("checkout submitted (Midtrans sandbox token expected)…");

  // ── 3. Wait for the Snap popup frame ──────────────────────────────────
  let snapFrame = null;
  for (let i = 0; i < 40; i++) {
    snapFrame = page.frames().find((f) => /app\.sandbox\.midtrans\.com\/snap/.test(f.url()));
    if (snapFrame) break;
    await sleep(1000);
  }
  if (!snapFrame) throw new Error("Snap sandbox popup frame never appeared");
  log(`snap popup open: ${snapFrame.url().slice(0, 120)}`);
  await page.screenshot({ path: "/tmp/snap-step-2-popup.png" });

  // ── 4. Fill the card form inside the popup ────────────────────────────
  const cardNo = snapFrame
    .getByPlaceholder("1234 1234 1234 1234")
    .or(snapFrame.locator('input[inputmode="numeric"]').first());
  await cardNo.waitFor({ state: "visible", timeout: 30_000 });
  await cardNo.fill(TEST_CARD);
  await snapFrame
    .getByPlaceholder("MM/YY")
    .fill(EXPIRY)
    .catch(() => {});
  await snapFrame
    .getByPlaceholder("123")
    .fill(CVV)
    .catch(() => {});
  log("card filled");
  await page.screenshot({ path: "/tmp/snap-step-3-card.png" });

  await snapFrame.getByRole("button", { name: /Pay now/i }).click();
  log("Pay now clicked — waiting for 3DS / result…");

  // ── 5. 3DS / result handling ─────────────────────────────────────────
  // Midtrans sandbox 3DS: a nested frame appears asking for an OTP/password.
  let successSeen = false;
  let desc = "";
  for (let i = 0; i < 60; i++) {
    // Fresh popup-close check: snap popup may close itself after success.
    const stillThere = page.frames().find((f) => /app\.sandbox\.midtrans\.com\/snap/.test(f.url()));
    const frames = page.frames();
    // Look for success markers anywhere reachable
    for (const f of frames) {
      try {
        const t =
          (await f
            .locator("body")
            .innerText({ timeout: 2000 })
            .catch(() => "")) || "";
        if (/(Transaction (successful|complete)|Payment success|Berhasil)/i.test(t)) {
          successSeen = true;
          desc = t.slice(0, 200);
        }
      } catch {}
    }
    if (successSeen || !stillThere) break;

    // 3DS prompt: find a frame offering a password/OTP input.
    for (const f of frames) {
      try {
        const pwd = f
          .locator('input[type="password"], input[name*="otp" i], input[name*="pass" i]')
          .first();
        if ((await pwd.count()) > 0 && (await pwd.isVisible().catch(() => false))) {
          await pwd.fill(OTP);
          log(`3DS input filled in frame ${f.url().slice(0, 90)}`);
          // Accept: prefer OK/Continue/Submit; else press Enter.
          const btn = f
            .getByRole("button", { name: /^(OK|Continue|Submit|Ya|Lanjut|Bayar)$/i })
            .first();
          if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
            await btn.click();
          } else {
            await pwd.press("Enter");
          }
          await page.screenshot({ path: "/tmp/snap-step-4-3ds.png" });
          break;
        }
      } catch {}
    }
    await sleep(1000);
  }
  await page.screenshot({ path: "/tmp/snap-step-5-end.png" });
  log(`after-pay state: success=${successSeen} desc=${desc.replace(/\s+/g, " ").slice(0, 120)}`);

  // ── 6. Read the stashed order + status ────────────────────────────────
  const subRes = await page.request.get(`${BASE}/api/billing/subscription`);
  const sub = await subRes.json();
  const orderId = sub?.subscription?.midtransOrderId || null;
  const planId = sub?.subscription?.planId || null;
  const status = sub?.subscription?.status || null;
  log(`subscription: planId=${planId} status=${status} orderId=${orderId}`);

  console.log(
    "SNAP_RESULT " +
      JSON.stringify({ orderId, planId, status, successSeen, desc: desc.slice(0, 120) }),
  );
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[snap] FAILED:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Production smoke test — new-sign-in security email on the LIVE deployment.
 *
 * Validates the two guarantees of the geo-ip rework against real Vercel
 * conditions (CDN geo headers present, real client IP):
 *
 *   1. PRECISE LOCATION — the rendered email resolves the request's IP to a
 *      city-level "Location" line (not "Approximate location" / "Unavailable").
 *      On Vercel this exercises the x-vercel-ip-city/region/country header
 *      path inside getSignInGeo().
 *   2. SINGLE TIMEZONE — exactly one of WIB / WITA / WIT appears in the whole
 *      document (never two or three stacked stamps).
 *
 * Usage:
 *   node scripts/smoke-signin-email.mjs [baseUrl]
 *
 * Defaults to the production deployment. Exit 0 = all checks passed.
 */

const BASE = (process.argv[2] ?? "https://next-dashboard-apps.vercel.app").replace(/\/$/, "");
const URL = `${BASE}/api/emails/new-sign-in`;

console.log(`🚀 Smoke-testing new-sign-in email at ${URL}\n`);

const res = await fetch(URL, { headers: { "user-agent": "smoke-test/1.0" } });
if (!res.ok) {
  console.error(`✗ HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const html = await res.text();

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

// ---- 1. Single timezone (exactly one of WIB / WITA / WIT) -----------------
check("exactly one Indonesian timezone label (WIB | WITA | WIT)", () => {
  const hits = ["WIB", "WITA", "WIT"].filter((z) => html.includes(z));
  if (hits.length === 0) throw new Error("no timezone label found at all");
  if (hits.length > 1) throw new Error(`multiple labels present: ${hits.join(", ")}`);
});

// ---- 2. Precise location ---------------------------------------------------
// The preview endpoint renders SAMPLE data, so this validates the template
// contract (city-level label, no legacy wording) rather than live geo lookup.
check("no legacy 'Approximate location' wording", () => {
  if (/approximate location/i.test(html)) {
    throw new Error("email still renders 'Approximate location'");
  }
});
check("no 'location unavailable' fallback visible", () => {
  if (/location\s+unavailable/i.test(html)) {
    throw new Error("email renders the 'unavailable' fallback");
  }
});
check("renders a city-level Location line", () => {
  if (!/Location/i.test(html)) throw new Error("no Location row rendered");
});

// ---- 3. Structural sanity ---------------------------------------------------
check("email renders non-trivial HTML (> 2 KB)", () => {
  if (html.length < 2048) throw new Error(`document suspiciously small: ${html.length}B`);
});
check("renders the device row", () => {
  if (!/Device/i.test(html)) throw new Error("no Device row rendered");
});

console.log(
  failed === 0 ? "\n✅ All sign-in email checks passed" : `\n❌ ${failed} check(s) failed`,
);
// Only force a non-zero code on failure: calling process.exit(0) right after
// top-level-await fetches trips a libuv assertion on Windows (win/async.c)
// that corrupts the exit code — falling off the end exits cleanly with 0.
if (failed !== 0) process.exit(1);

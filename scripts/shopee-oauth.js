/**
 * Shopee Open Platform OAuth helper.
 *
 * Obtaining a Shopee `access_token` is a 2-step OAuth flow — this script does
 * both steps so you can get the credentials the app connector needs
 * (partner_id, partner_key come from the Open Platform console; access_token
 * and shop_id are produced here).
 *
 * Prerequisites (set once per shell):
 *   $env:SHOPEE_PARTNER_ID="<your app id>"
 *   $env:SHOPEE_PARTNER_KEY="<your app key>"
 *   # optional, must match the redirect configured in your app console:
 *   $env:SHOPEE_REDIRECT="http://localhost:3010/api/affiliates/shopee/callback"
 *   # optional, use Shopee sandbox instead of production:
 *   $env:SHOPEE_HOST="https://partner.test-stable.shopeemobile.com"
 *
 * Usage:
 *   1) node scripts/shopee-oauth.js authorize
 *      -> prints an authorization URL. Open it, log in as the seller, approve.
 *         Shopee redirects to your redirect URL with ?code=...&shop_id=...
 *   2) node scripts/shopee-oauth.js token <code> <shop_id>
 *      -> exchanges the code for access_token + refresh_token.
 *   3) node scripts/shopee-oauth.js refresh <refresh_token> <shop_id>
 *      -> gets a fresh access_token (they expire every 4 hours).
 */
const crypto = require("crypto");

const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";
const PARTNER_ID = process.env.SHOPEE_PARTNER_ID || "";
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const REDIRECT =
  process.env.SHOPEE_REDIRECT || "http://localhost:3010/api/affiliates/shopee/callback";

function requireEnv() {
  if (!PARTNER_ID || !PARTNER_KEY) {
    console.error(
      "ERROR: set SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY env vars first (from open.shopee.com console).",
    );
    process.exit(1);
  }
}

/** Public-API signature: HMAC-SHA256(partner_key, partner_id + path + timestamp) */
function publicSign(path, ts) {
  return crypto.createHmac("sha256", PARTNER_KEY).update(`${PARTNER_ID}${path}${ts}`).digest("hex");
}

function buildAuthorizeUrl() {
  const path = "/api/v2/shop/auth_partner";
  const ts = Math.floor(Date.now() / 1000);
  const sign = publicSign(path, ts);
  const qs = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    sign,
    redirect: REDIRECT,
  }).toString();
  return `${HOST}${path}?${qs}`;
}

async function post(path, body) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = publicSign(path, ts);
  const qs = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    sign,
  }).toString();
  const res = await fetch(`${HOST}${path}?${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  requireEnv();

  if (cmd === "authorize") {
    console.log("\n1. Open this URL in a browser and authorize your shop:\n");
    console.log("   " + buildAuthorizeUrl());
    console.log(
      `\n2. After approving, Shopee redirects to:\n   ${REDIRECT}?code=<CODE>&shop_id=<SHOP_ID>`,
    );
    console.log("\n3. Then run:\n   node scripts/shopee-oauth.js token <CODE> <SHOP_ID>\n");
    return;
  }

  if (cmd === "token") {
    if (!arg1 || !arg2) {
      console.error("Usage: node scripts/shopee-oauth.js token <code> <shop_id>");
      process.exit(1);
    }
    const { status, json } = await post("/api/v2/auth/token/get", {
      code: arg1,
      shop_id: Number(arg2),
      partner_id: Number(PARTNER_ID),
    });
    console.log(`\nHTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
    if (json && json.access_token) {
      console.log(
        "\n✓ SUCCESS — use these in the app (Affiliates → Platforms → Shopee → Connect):",
      );
      console.log(`   partner_id (API Key):   ${PARTNER_ID}`);
      console.log(`   partner_key (API Secret): <the key from your console>`);
      console.log(`   access_token:           ${json.access_token}`);
      console.log(`   shop_id:                ${arg2}`);
      console.log(`\n   (refresh_token: ${json.refresh_token} — valid to renew after 4h)`);
    }
    return;
  }

  if (cmd === "refresh") {
    if (!arg1 || !arg2) {
      console.error("Usage: node scripts/shopee-oauth.js refresh <refresh_token> <shop_id>");
      process.exit(1);
    }
    const { status, json } = await post("/api/v2/auth/access_token/get", {
      refresh_token: arg1,
      shop_id: Number(arg2),
      partner_id: Number(PARTNER_ID),
    });
    console.log(`\nHTTP ${status}`);
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  console.log("Commands:");
  console.log("  authorize                          Print the shop authorization URL");
  console.log("  token <code> <shop_id>             Exchange redirect code for access_token");
  console.log("  refresh <refresh_token> <shop_id>  Renew an expired access_token");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});

/**
 * Mail-transport diagnostic — resolves the configuration the way the app does,
 * then sends ONE real message through the app's own sendEmail().
 *
 * WHY: "users don't receive mail" is not diagnosable from application logs
 * alone. The mail path has three silent-ish outcomes — no transport configured
 * (console only), a transport that accepted the message, and a transport that
 * rejected it — and only the last one is an error. The worst case of all is a
 * transport that ACCEPTS every message and drops it (Resend's sandbox sender
 * only delivers to the account owner), which this prints as a warning and then
 * proves by actually sending.
 *
 * Run:
 *   npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/verify-mail.ts you@example.com
 *
 * Deliberately NOT a CI step: it needs real credentials and sends real mail.
 * Outside production only — it refuses to run when NODE_ENV=production.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/** Minimal .env parser (dotenv is only a transitive dep, so don't rely on it). */
function loadEnvFile(file: string): void {
  let text: string;
  try {
    text = readFileSync(path.join(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Real env wins, mirroring Next.js (it never overwrites a defined var).
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const mask = (v: string | undefined) =>
  v ? `${v.slice(0, 3)}…${v.slice(-2)} (len ${v.length})` : "(unset)";

const to = process.argv[2] || process.env.VERIFY_MAIL_TO;

/**
 * Loaded through the app's own modules so the diagnostic exercises the real
 * transport selection and the real send path, not a reimplementation of them —
 * a drift between this script and `src/lib/email.ts` would make it lie.
 */
async function main(): Promise<void> {
  const { describeMailConfiguration, isResendSandboxSender, sendEmailDetailed } =
    await import("../src/lib/email");
  const config = describeMailConfiguration();
  const requested = (process.env.EMAIL_TRANSPORT ?? "auto").toLowerCase();

  console.log("🔎 Mail transport diagnostic\n");
  console.log(`  EMAIL_TRANSPORT    ${requested}`);
  console.log(`  effective transport ${config.transport}`);
  console.log(`  SMTP_HOST          ${process.env.SMTP_HOST ?? "(unset)"}`);
  console.log(
    `  SMTP_PORT/SECURE   ${process.env.SMTP_PORT ?? "(default)"} / ${process.env.SMTP_SECURE ?? "false"}`,
  );
  console.log(`  SMTP_USER          ${mask(process.env.SMTP_USER)}`);
  console.log(`  SMTP_PASS          ${mask(process.env.SMTP_PASS)}`);
  console.log(`  RESEND_API_KEY     ${mask(process.env.RESEND_API_KEY)}`);
  console.log(`  RESEND_FROM        ${process.env.RESEND_FROM ?? "(unset)"}`);
  console.log(`  EMAIL_FROM         ${process.env.EMAIL_FROM ?? "(unset)"}`);
  console.log(`  sender this run     ${config.from ?? "(none — console fallback)"}`);
  console.log(
    `  sandbox sender?     ${isResendSandboxSender(config.from) ? "YES (undeliverable)" : "no"}`,
  );

  if (config.warnings.length > 0) {
    console.log("\n⚠  Configuration warnings:");
    for (const w of config.warnings) console.log(`   - ${w}`);
  }

  if (!to) {
    console.error(
      "\n❌ No recipient. Pass one:  npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/verify-mail.ts you@example.com",
    );
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    console.error("\n❌ Refusing to send from a production environment — run this locally.");
    process.exit(1);
  }

  console.log(`\n📤 Sending a real message to ${to} …`);
  const started = Date.now();
  try {
    const outcome = await sendEmailDetailed({
      to,
      subject: "Mail transport diagnostic",
      html: "<p>If you can read this, the configured transport can deliver.</p>",
      text: "If you can read this, the configured transport can deliver.",
    });
    const ms = Date.now() - started;
    if (outcome.sent) {
      console.log(
        `\n✅ Accepted by ${outcome.transport} in ${ms}ms — check the inbox (and spam) for ${to}.`,
      );
      console.log("   A real flow records this as EMAIL_DELIVERY_SENT in the audit trail.");
    } else {
      console.log(
        `\n⚠  NOT sent over ${outcome.transport} (${ms}ms): ${outcome.reason ?? "declined by the transport"}`,
      );
      if (outcome.transport === "none") {
        console.log("   Set SMTP_HOST (+ SMTP_USER/SMTP_PASS) or RESEND_API_KEY to send for real.");
      }
      process.exitCode = 2;
    }
  } catch (err) {
    console.error(`\n❌ Transport rejected the message after ${Date.now() - started}ms:`);
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

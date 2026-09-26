/**
 * One-shot operator run of the leaf-orphans digest pipeline.
 *
 *   npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/fire-leaf-orphans-digest.mjs
 *
 * Three phases, in order:
 *   1. force-run the SCHEDULED job (runLeafOrphansDigest({ force: true })) —
 *      exercises its real gate. When the verdict is "Needs reconciliation"
 *      this queues one mail per active admin and writes the per-day marker;
 *      for the quieter verdicts it reports skipped and stays silent.
 *   2. drain the durable outbox explicitly so every queued row attempts a
 *      real transport send inside this script (the in-app `after()` hook has
 *      no request scope here).
 *   3. send the operator TEST digest to the seed admin (same template and
 *      projection, ignores the per-day marker, fires for warn too) and drain
 *      again — this is the "see the real email land" part.
 *
 * Per the operator's instruction the per-day marker is reset at the end, so
 * the scheduled 02:00 run is never suppressed by this exercise.
 * Deliberately NOT a CI step: it needs real credentials and sends real mail.
 * Outside production only.
 */
import { readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

/** Minimal .env parser — the same one verify-mail.ts uses (dotenv is only a transitive dep). */
function loadEnvFile(file) {
  let text;
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to fire the digest from a production environment.");
  process.exit(1);
}

// The dashboard link inside the digest — dev server on 3010.
if (!process.env.APP_URL && !process.env.NEXT_PUBLIC_APP_URL) {
  process.env.APP_URL = "http://localhost:3010";
}

const markerPath = path.join(process.cwd(), "data", "leaf-orphans-digest-sent.json");
const markerExistedBefore = existsSync(markerPath);

async function main() {
  const { runLeafOrphansDigest, sendTestLeafOrphansDigest } =
    await import("../src/lib/leaf-orphans-digest");
  const { drainEmailOutbox, emailOutboxHealth } = await import("../src/lib/email-outbox");
  const { prisma } = await import("../src/lib/db");

  console.log("🔥 Firing the leaf-orphans digest pipeline\n");

  // 1) The scheduled path, forced past its per-day dedupe.
  const forced = await runLeafOrphansDigest({ force: true });
  console.log("[1] scheduled job (force):", JSON.stringify(forced));

  // 2) Turn queued rows into real transport sends.
  const drain1 = await drainEmailOutbox();
  console.log("[2] outbox drain:", JSON.stringify(drain1));

  // 3) Operator test digest → the requesting admin (the seed admin here).
  const to = process.env.TEST_DIGEST_TO || "nextdashboards@gmail.com";
  const me = await prisma.user.findUnique({
    where: { email: to },
    select: { id: true, email: true, tenantId: true },
  });
  if (!me?.email) {
    console.error(`[3] no user found for ${to} — cannot send the test digest.`);
  } else {
    const test = await sendTestLeafOrphansDigest({
      recipients: [{ id: me.id, email: me.email, tenantId: me.tenantId }],
    });
    console.log(`[3] test digest → ${me.email}:`, JSON.stringify(test));
    const drain2 = await drainEmailOutbox();
    console.log("[4] outbox drain:", JSON.stringify(drain2));
  }

  const health = await emailOutboxHealth();
  console.log("[5] outbox health:", JSON.stringify(health));

  // Reset the per-day marker so this exercise never suppresses the real
  // 02:00 scheduled run (operator instruction).
  if (existsSync(markerPath)) {
    rmSync(markerPath);
    console.log("[6] sent-marker reset:", path.relative(process.cwd(), markerPath), "removed");
  } else {
    console.log(
      "[6] sent-marker: not present" +
        (markerExistedBefore ? " (was present before the run — already reset)" : "") +
        " — the scheduled 02:00 run stays armed",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

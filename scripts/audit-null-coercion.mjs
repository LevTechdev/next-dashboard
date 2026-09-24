#!/usr/bin/env node
/**
 * Null-coercion inventory: every `x ?? null` in the app's own code.
 *
 * WHY THIS EXISTS
 * ---------------
 * `x ?? null` looks harmless and is usually right: a Prisma column, a JSON
 * payload field, a React state slot — all of them genuinely mean "no value" as
 * `null`. But the same expression is a silent bug when the value is handed to
 * a resolver that reads ABSENCE (`undefined`) as "derive this for me". A
 * *defined* null is not "unknown" — it is "belongs to nobody", and the row it
 * produces disappears from every tenant-scoped read. That is exactly how a
 * whole family of SecurityEvent rows lost attribution, and how an actor-bearing
 * ActivityLog row became invisible to the audit-log page.
 *
 * THE RULE (see CLAUDE.md → Null coercion)
 * ---------------------------------------
 *   - Do NOT convert a missing optional into a defined `null` on the way into
 *     a resolver (`session.user.tenantId ?? null` → use the resolver).
 *   - DO resolve nullish through the actor: `claimed ?? (await
 *     resolveUserTenantId(userId))`.
 *   - Explicit nulls that ARE the contract (DB columns, JSON payload shape,
 *     the canonical audit-hash payload) are fine and stay.
 *
 * This script is a REPORT, not a gate: it lists each site with its line so a
 * reviewer can classify it. It exits non-zero only when a file listed in
 * `KNOWN_INTENTIONAL` is missing (i.e. the list has drifted), so the
 * documentation below cannot rot silently.
 *
 * Run:  npm run check:null-coercion
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ROOTS = ["src", "prisma", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "__tests__", "coverage"]);
const SKIP_FILE = /(\.test\.|\.spec\.|\.stories\.)/;

/**
 * Files whose `?? null` sites are the contract, not a coercion bug.
 * Keeping them listed here (instead of just ignoring them) means the next
 * person reading this report sees WHY each exemption is safe.
 */
const KNOWN_INTENTIONAL = new Map([
  ["src/lib/audit-hash.ts", "canonical hash payload — a null IS data (it changes the hash)"],
  ["src/lib/security-events.ts", "the writer's own payload shaping + the resolver result"],
  ["src/lib/tenancy.ts", "resolver return contract: string | null"],
  ["src/lib/siem.ts", "SIEM payload shape"],
  ["src/lib/scheduler.ts", 'job-status payload; null renders as "never ran"'],
  ["src/lib/invoice-snapshot.ts", "snapshot JSON contract declares string | null"],
  ["src/lib/api-guard.ts", "session shape consumed by effectiveTenantId (nullish = derive)"],
  ["src/lib/abac.ts", 'AbacContext.tenantId: falsy means "tenancy off", not "no workspace"'],
  ["src/lib/api-key-auth.ts", "helper return contract: string | null"],
  ["src/lib/provisioning.ts", "tenant id returned to a caller that provisions on null"],
  ["prisma/seed.ts", "config-derived column values (env absent → column null)"],
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|cjs)$/.test(entry) && !SKIP_FILE.test(entry)) out.push(full);
  }
  return out;
}

const hits = new Map();
for (const root of ROOTS) {
  let files;
  try {
    files = walk(join(ROOT, root));
  } catch {
    continue; // directory not present in this checkout
  }
  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join("/");
    const text = readFileSync(file, "utf8");
    const lines = [];
    text.split("\n").forEach((line, i) => {
      if (line.includes("?? null")) lines.push({ line: i + 1, text: line.trim() });
    });
    if (lines.length > 0) hits.set(rel, lines);
  }
}

const total = [...hits.values()].reduce((n, l) => n + l.length, 0);
console.log(`🔎 Null-coercion inventory — ${total} \`?? null\` site(s) in ${hits.size} file(s)\n`);

let undocumented = 0;
for (const [file, lines] of [...hits.entries()].sort()) {
  const reason = KNOWN_INTENTIONAL.get(file);
  const flag = reason ? "✓" : "?";
  console.log(`${flag} ${file}${reason ? `  — ${reason}` : ""}`);
  for (const { line, text } of lines) console.log(`    ${line}: ${text}`);
  if (!reason) undocumented += 1;
}
console.log(
  `\n${total - 0} site(s); ${undocumented} file(s) not in KNOWN_INTENTIONAL. ` +
    "Classify each: a resolver input must never receive a coerced null.",
);

// Drift guard: a listed file that no longer has any `?? null` means this list
// is stale and should be updated — fail loudly instead of rotting.
const missing = [...KNOWN_INTENTIONAL.keys()].filter((f) => !hits.has(f));
if (missing.length > 0) {
  console.error(
    `❌ KNOWN_INTENTIONAL lists ${missing.length} file(s) with no \`?? null\` left: ${missing.join(", ")}`,
  );
  console.error(
    "   Update the list in scripts/audit-null-coercion.mjs so the report stays honest.",
  );
  process.exit(1);
}

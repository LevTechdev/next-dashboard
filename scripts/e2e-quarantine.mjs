#!/usr/bin/env node
/**
 * E2E quarantine tooling — issue #7.
 *
 * Two jobs, both fed by e2e/quarantine.json:
 *
 *   grep   → prints a regex alternation of the quarantined titles, for
 *            `playwright test --grep-invert`. Prints `(?!)` (matches nothing)
 *            when the registry is empty, so the command line stays valid.
 *   check  → collects the suite with `playwright test --list` and verifies that
 *            every registry entry still matches EXACTLY ONE test. This is what
 *            stops the exemption list from rotting: fix a quarantined test and
 *            forget to delete its entry, or rename the test, and this fails.
 *
 * Usage:
 *   node scripts/e2e-quarantine.mjs grep
 *   node scripts/e2e-quarantine.mjs check
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(join(root, "e2e", "quarantine.json"), "utf8"));
const entries = registry.entries ?? [];

/**
 * `--list` prints paths relative to the test dir ("2fa-modal-mobile.spec.ts:44:7 › …"),
 * without the e2e/ prefix the registry uses, so compare on the basename.
 */
const basename = (file) => file.split(/[\\/]/).pop();

/** Titles as Playwright prints them in `--list`: "path:line:col › describe › test". */
function collectTitles() {
  const out = execFileSync("npx", ["playwright", "test", "--list"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // Windows shells route npx through a .cmd shim.
    shell: process.platform === "win32",
  });
  return out
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[│|]\s*)?/, "").trim())
    .filter((line) => /\.spec\.(ts|js):\d+:\d+\s*›/.test(line));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function grep() {
  if (entries.length === 0) {
    process.stdout.write("(?!)");
    return;
  }
  process.stdout.write(entries.map((e) => escapeRe(e.match)).join("|"));
}

function check() {
  const titles = collectTitles();
  if (titles.length === 0) {
    console.error(
      "::error::Could not collect the E2E suite (playwright --list produced no test titles).",
    );
    process.exit(1);
  }

  let failed = false;
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.file}::${entry.match}`;
    if (seen.has(key)) {
      console.error(`::error::Duplicate quarantine entry: ${key}`);
      failed = true;
      continue;
    }
    seen.add(key);

    const hits = titles.filter((t) => t.includes(basename(entry.file)) && t.includes(entry.match));
    if (hits.length === 0) {
      console.error(
        `::error::Quarantine entry no longer matches any test — the exemption is stale. ` +
          `Remove it from e2e/quarantine.json: ${key}`,
      );
      failed = true;
    } else if (hits.length > 1) {
      console.error(
        `::error::Quarantine entry matches ${hits.length} tests — make \`match\` more specific: ${key}`,
      );
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log(
    `Quarantine registry consistent: ${entries.length} entr${entries.length === 1 ? "y" : "ies"} ` +
      `across ${new Set(entries.map((e) => e.file)).size} spec files (issue #7).`,
  );
}

const command = process.argv[2] ?? "grep";
if (command === "grep") grep();
else if (command === "check") check();
else {
  console.error(`Unknown command "${command}". Use "grep" or "check".`);
  process.exit(2);
}

#!/usr/bin/env node
/**
 * Acknowledge leaf-sync orphans — the reconciliation CLI for the orphan report
 * (scripts/sync-supabase-leaves.mjs → data/leaf-sync-watermark.json).
 *
 * The orphan report names the exact local rows that can never reach the remote
 * mirror (their FK targets — dev-seed users/tenants — exist only locally).
 * Once an operator has reconciled a ref (or confirmed it is a dev-fixture
 * artifact), this CLI records that acknowledgement in a ledger so the ref
 * retires from the scheduler card's report. Acknowledgement NEVER touches the
 * rows themselves: SecurityEvent is hash-chained with its userId in the
 * canonical payload (src/lib/audit-hash.ts), so orphans are never rewritten to
 * force a sync — mirror + acknowledge, nothing else.
 *
 * Usage:
 *   node scripts/ack-leaf-orphans.mjs                          # list open items (default)
 *   node scripts/ack-leaf-orphans.mjs <ref> [<ref>...]         # acknowledge refs
 *   node scripts/ack-leaf-orphans.mjs <ref> --note "reconciled by hand"
 *   node scripts/ack-leaf-orphans.mjs --unack <ref> [<ref>...] # retire an acknowledgement
 *
 * A ref may be a full sample fingerprint (`cmu… [userId=cmu…]`) or just the
 * row id (`cmu…`) — the ledger stores the bare subject, which acks every
 * fingerprint variant of that row. By default refs must appear in the current
 * report (typo protection); --force accepts a ref the report no longer lists.
 * Refs not yet in the report are simply remembered, so a ref seen in an
 * earlier full load stays retired.
 *
 * The ledger lives at data/leaf-sync-orphans-ack.json (gitignored alongside
 * the watermark file — local operator state, not repo content).
 */

import { readFileSync } from "node:fs";
import process from "node:process";
import {
  applyAckLedger,
  readAckLedger,
  writeAckLedger,
  sampleRef,
  normalizeAckEntries,
} from "./lib/leaf-orphans.mjs";

const ROOT = process.cwd();

function fail(message) {
  console.error(`[ack-leaf-orphans] ${message}`);
  process.exit(2);
}

/** Load the raw report from the leaf-sync state file. */
function readRawReport() {
  try {
    const raw = JSON.parse(readFileSync("data/leaf-sync-watermark.json", "utf-8"));
    return raw.orphanReport && typeof raw.orphanReport === "object" ? raw.orphanReport : {};
  } catch {
    return {};
  }
}

/** One report line per table, or the all-clear. */
function printReport(report, indent = "  ") {
  const tables = Object.entries(report).filter(([, e]) => (e?.count ?? 0) > 0);
  if (tables.length === 0) {
    console.log(`${indent}(nothing left to reconcile)`);
    return;
  }
  for (const [table, entry] of tables) {
    console.log(`${indent}${table}: ${entry.count} unsyncable row${entry.count === 1 ? "" : "s"}`);
    for (const s of entry.samples ?? []) console.log(`${indent}  ${s}`);
  }
}

const args = process.argv.slice(2);
const unack = args.includes("--unack");
const force = args.includes("--force");
const noteFlag = args.indexOf("--note");
let note;
if (noteFlag !== -1) {
  note = args[noteFlag + 1];
  if (note === undefined) fail("--note requires a value");
  args.splice(noteFlag, 2);
}
const refs = args
  .filter((a) => !a.startsWith("--"))
  .map(sampleRef)
  .filter(Boolean);

if (!unack && refs.length === 0) {
  // Default view: the open (unacknowledged) report for the operator.
  console.log("Open leaf-sync orphans (report minus acknowledged):");
  printReport(applyAckLedger(readRawReport(), readAckLedger(ROOT).entries));
  process.exit(0);
}

if (refs.length === 0) fail("no refs given for --unack");
if (note !== undefined && unack) fail("--note only applies to acknowledgements");

const ledger = readAckLedger(ROOT);
const rawReport = readRawReport();
const knownRefs = new Set(
  Object.values(rawReport).flatMap((e) => (Array.isArray(e?.samples) ? e.samples : [])),
);

if (!unack && !force) {
  const unknown = refs.filter((r) => ![...knownRefs].some((s) => sampleRef(s) === r));
  if (unknown.length > 0) {
    fail(
      `ref(s) not in the current orphan report: ${unknown.join(", ")}\n` +
        `Check the report (run the CLI with no args) or pass --force to acknowledge anyway.`,
    );
  }
}

if (unack) {
  // Exact-match removal: refs arrive sampleRef()-normalized, and cuids are
  // fixed-length, so a prefix match could only retire an unrelated entry.
  const remaining = ledger.entries.filter((e) => !refs.includes(e.ref));
  const removed = ledger.entries.length - remaining.length;
  writeAckLedger(ROOT, remaining);
  console.log(`[ack-leaf-orphans] unacknowledged ${removed} entr${removed === 1 ? "y" : "ies"}.`);
  console.log("Open leaf-sync orphans (report minus acknowledged):");
  printReport(applyAckLedger(readRawReport(), remaining));
  process.exit(0);
}

// Acknowledge: merge + persist the ledger, then show the projected report.
const at = new Date().toISOString();
const merged = normalizeAckEntries([...ledger.entries, ...refs.map((ref) => ({ ref, note, at }))]);
writeAckLedger(ROOT, merged);
const acknowledged = merged.length - ledger.entries.length;
console.log(
  `[ack-leaf-orphans] acknowledged ${acknowledged} new ref${acknowledged === 1 ? "" : "s"} ` +
    `(${merged.length} total) → data/leaf-sync-orphans-ack.json`,
);
if (note) console.log(`[ack-leaf-orphans] note: ${note}`);

const open = applyAckLedger(
  rawReport,
  merged.map((e) => e.ref),
);
console.log("Open leaf-sync orphans (report minus acknowledged):");
printReport(open);
if (Object.keys(open).length === 0 && Object.keys(rawReport).length > 0) {
  console.log(
    "[ack-leaf-orphans] every sampled ref is acknowledged — remaining counts (if any) have no sample to name.",
  );
}

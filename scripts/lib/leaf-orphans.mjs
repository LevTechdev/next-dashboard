/**
 * Acknowledged-orphan ledger for the Supabase leaf sync — shared logic.
 *
 * The leaf sync (scripts/sync-supabase-leaves.mjs) can never copy rows whose
 * FK targets exist only in local dev data (dev-seed users/tenants the remote
 * mirror has never seen). It reports those orphans — count + sample
 * fingerprints — in its clean-run state file, and the scheduler card surfaces
 * them. But a report is not a work queue: once an operator has confirmed a
 * ref is a dev-fixture artifact (or reconciled it by hand), that ref should
 * stop demanding attention.
 *
 * This module is the reconciliation mechanism, with one invariant from the
 * audit side: SecurityEvent rows are hash-chained with their userId in the
 * canonical payload (src/lib/audit-hash.ts), so orphans must NEVER be
 * rewritten to make them sync. Reconciliation is therefore acknowledge-only —
 * a ledger of reviewed refs that consumers SUBTRACT from the raw report:
 *
 *   - data/leaf-sync-watermark.json keeps the RAW report (the sync script
 *     owns that file and stays ledger-agnostic — no double-subtraction when
 *     an incremental run merges into a previously-acknowledged report);
 *   - data/leaf-sync-orphans-ack.json (gitignored, like the watermark) holds
 *     the acknowledged refs;
 *   - every consumption point (scheduler card, ack CLI) projects
 *     report − ledger, so `--unack` is trivially correct: the raw report
 *     shines through again.
 *
 * Sample fingerprints look like `cmu… [userId=cmu…]` (optionally with a
 * tenantId); the leading id is the row's subject. An acknowledgement stored
 * as the bare subject acks the whole row — every fingerprint variant of it —
 * so a sample re-derived with a different FK annotation still matches.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One table's orphan tally from the leaf-sync report: how many rows can never
 * sync, plus up to 6 sample fingerprints naming them.
 *
 * @typedef {{ count: number, samples?: string[] }} OrphanEntry
 * @typedef {Record<string, OrphanEntry>} OrphanReport
 */

/** Where the acknowledged refs live (gitignored alongside the watermark file).
 *
 * @param {string} root
 * @returns {string}
 */
export function ackLedgerPath(root) {
  return join(root, "data", "leaf-sync-orphans-ack.json");
}

/** The row id a sample fingerprint is about: text before the bracketed FKs.
 *
 * @param {string | null | undefined} sample
 * @returns {string}
 */
export function sampleRef(sample) {
  const s = String(sample ?? "").trim();
  const bracket = s.indexOf(" [");
  return bracket === -1 ? s : s.slice(0, bracket);
}

/** Whether a sample fingerprint is covered by the acknowledged refs.
 *
 * @param {string} sample
 * @param {readonly string[]} ackRefs
 * @returns {boolean}
 */
export function isRefAcknowledged(sample, ackRefs) {
  const subject = sampleRef(sample);
  return (ackRefs ?? []).some((ack) => ack === subject || sample.startsWith(`${ack} [`));
}

/**
 * Subtract the acknowledged refs from an orphan report: per table the count
 * loses one per acknowledged sample, samples lose the acknowledged ones, and
 * a table whose count reaches 0 disappears entirely (nothing left to
 * reconcile). Pure — callers own persistence. Accepts bare refs, full sample
 * fingerprints, or ledger entries ({ ref }), so a caller can hand either the
 * ledger's entries or their refs. A malformed entry is dropped rather than
 * thrown on: a hand-edited report must not take the card down.
 *
 * @param {OrphanReport | Record<string, unknown>} orphanReport
 * @param {ReadonlyArray<string | { ref: string } | null | undefined> | null | undefined} ackRefs
 * @returns {OrphanReport}
 */
export function applyAckLedger(orphanReport, ackRefs) {
  const acks = (ackRefs ?? [])
    .map((r) => sampleRef(typeof r === "string" ? r : r?.ref))
    .filter(Boolean);
  const result = {};
  for (const [table, entry] of Object.entries(orphanReport ?? {})) {
    if (!entry || typeof entry !== "object") continue;
    const samples = Array.isArray(entry.samples) ? entry.samples : [];
    const kept = samples.filter((s) => !isRefAcknowledged(s, acks));
    const acknowledged = samples.length - kept.length;
    const count = Math.max(0, (typeof entry.count === "number" ? entry.count : 0) - acknowledged);
    if (count <= 0 && kept.length === 0) continue;
    result[table] = kept.length > 0 ? { count, samples: kept } : { count };
  }
  return result;
}

/** Keep only well-formed ack entries; dedupe by ref (first wins).
 *
 * @param {ReadonlyArray<null | undefined | { ref?: unknown, note?: unknown, at?: unknown }>} entries
 * @returns {Array<{ ref: string, note?: string, at?: string }>} the normalized entries
 */
export function normalizeAckEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries ?? []) {
    if (!e || typeof e !== "object") continue;
    const ref = sampleRef(e.ref);
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    out.push({
      ref,
      ...(typeof e.note === "string" && e.note.trim() ? { note: e.note.trim() } : {}),
      ...(typeof e.at === "string" ? { at: e.at } : {}),
    });
  }
  return out;
}

/** Read the ledger; a missing or corrupt file reads as an empty ledger.
 *
 * @param {string} root
 * @returns {{ entries: Array<{ ref: string, note?: string, at?: string }> }}
 */
export function readAckLedger(root) {
  const path = ackLedgerPath(root);
  if (!existsSync(path)) return { entries: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return { entries: normalizeAckEntries(parsed.entries) };
  } catch {
    return { entries: [] };
  }
}

/** Persist the ledger atomically (tmp + rename) so a crash cannot truncate it.
 *
 * @param {string} root
 * @param {ReadonlyArray<{ ref: string, note?: string, at?: string }>} entries
 * @returns {void}
 */
export function writeAckLedger(root, entries) {
  const path = ackLedgerPath(root);
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ entries }, null, 2)}\n`, "utf-8");
  renameSync(tmp, path);
}

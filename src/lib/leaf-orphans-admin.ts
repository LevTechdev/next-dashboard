import "server-only";

/**
 * Admin-side access to the leaf-sync orphan report and its acknowledged-ref
 * ledger (data/leaf-sync-orphans-ack.json, gitignored operator state).
 *
 * The ledger itself lives in scripts/lib/leaf-orphans.mjs — the ack CLI and
 * this module must stay one mechanism, never two: both write through
 * writeAckLedger (atomic tmp+rename) and both project through applyAckLedger,
 * so `--unack` on the CLI stays trivially correct against whatever the admin
 * endpoint acknowledged and vice versa. The sync script owns only the RAW
 * report inside data/leaf-sync-watermark.json and never sees the ledger.
 *
 * Acknowledgement NEVER touches the rows: SecurityEvent is hash-chained with
 * its userId in the canonical payload (src/lib/audit-hash.ts), so orphans are
 * never rewritten to force a sync — mirror + acknowledge, nothing else.
 */

export interface OrphanEntry {
  count: number;
  samples?: string[];
}

export type OrphanReport = Record<string, OrphanEntry>;

export interface LeafOrphansSummary {
  /** ok: nothing unsyncable. bad: the report still NAMES unacknowledged rows. warn: counts remain but every sampled ref is acknowledged. */
  state: "ok" | "warn" | "bad";
  total: number;
  /** How many sample fingerprints survive the projection — the refs an operator can still name and retire. */
  unacknowledgedSamples: number;
  tables: Record<string, OrphanEntry>;
}

/** Absolute path of the leaf-sync state file that carries the RAW report. */
function watermarkPath(): string {
  return `${process.cwd()}/data/leaf-sync-watermark.json`;
}

/**
 * Read the RAW orphan report the sync script persisted — deliberately NOT the
 * projected view: ack/unack both need the raw report as their source of truth,
 * or an acknowledged ref could never be named again (and --unack would be a
 * no-op). Read + apply the ledger in one call when you want the card's view —
 * see summarizeLeafOrphans.
 */
export async function readRawLeafOrphanReport(): Promise<OrphanReport | undefined> {
  try {
    const fs = await import("node:fs");
    const raw = JSON.parse(fs.readFileSync(watermarkPath(), "utf-8")) as {
      orphanReport?: unknown;
    };
    if (!raw.orphanReport || typeof raw.orphanReport !== "object") return undefined;
    return raw.orphanReport as OrphanReport;
  } catch {
    return undefined;
  }
}

/**
 * Acknowledge refs so they retire from every projected view of the report.
 * Refs may be full sample fingerprints (`cmu… [userId=cmu…]`) or bare row ids —
 * the ledger stores the normalized subject either way, which acks every
 * fingerprint variant of that row. A ref that is already acknowledged is
 * idempotent (deduped by the ledger), and a ref the current report no longer
 * lists is still remembered: it retires the moment a stale full-load report
 * resurfaces.
 */
export async function acknowledgeLeafOrphanRefs(refs: readonly string[]): Promise<number> {
  const { normalizeAckEntries, readAckLedger, writeAckLedger, sampleRef } =
    await import("../../scripts/lib/leaf-orphans.mjs");
  const wanted = (refs ?? []).map((r) => sampleRef(r)).filter(Boolean);
  if (wanted.length === 0) return 0;

  const ledger = readAckLedger(process.cwd());
  const known = new Set(ledger.entries.map((e) => e.ref));
  const at = new Date().toISOString();
  const merged = normalizeAckEntries([
    ...ledger.entries,
    ...wanted.map((ref) => ({ ref, at, note: "acknowledged from the admin panel" })),
  ]);
  writeAckLedger(process.cwd(), merged);
  return merged.length - known.size;
}

/**
 * The card's view of one report: raw minus the acknowledged-ref ledger, rolled
 * into the verdict the admin surfaces share. Callers own the read — pass the
 * RAW report from readRawLeafOrphanReport (the digest and the GET/POST routes
 * all do) — so tests can feed any report without touching the filesystem.
 * `undefined` (no state file / no report) is the clean verdict.
 */
export async function summarizeLeafOrphans(
  report: OrphanReport | undefined,
): Promise<LeafOrphansSummary> {
  if (!report) return { state: "ok", total: 0, unacknowledgedSamples: 0, tables: {} };

  const { applyAckLedger, readAckLedger } = await import("../../scripts/lib/leaf-orphans.mjs");
  const projected = applyAckLedger(report, readAckLedger(process.cwd()).entries);

  const tables = Object.fromEntries(
    Object.entries(projected).filter(([, e]) => (e?.count ?? 0) > 0),
  );
  const total = Object.values(tables).reduce((sum, e) => sum + (e?.count ?? 0), 0);
  const unacknowledgedSamples = Object.values(tables).reduce(
    (sum, e) => sum + (e?.samples?.length ?? 0),
    0,
  );
  const state: LeafOrphansSummary["state"] =
    total === 0 ? "ok" : unacknowledgedSamples > 0 ? "bad" : "warn";

  return { state, total, unacknowledgedSamples, tables };
}

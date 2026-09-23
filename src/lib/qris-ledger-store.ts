import fs from "fs";
import path from "path";
import { qrisLedger, setQrisLedgerPersistHook, type QrisLedgerState } from "./qris-engine";

/**
 * Server-only JSON persistence for the QRIS income ledger.
 *
 * The engine itself stays fs-free because client components import its pure QR
 * helpers (generateQrisPayload etc.), so this store registers a persist hook
 * from instrumentation at server startup: every mutation (transaction created,
 * payment confirmed, withdrawal completed, ...) writes the ledger to
 * data/qris-ledger.json and hydration on boot replays it, so the ledger
 * survives server restarts instead of resetting to the seeded demo state.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const LEDGER_FILE = path.join(DATA_DIR, "qris-ledger.json");
const BACKUP_FILE = LEDGER_FILE + ".bak";

/** Shape-validate a parsed ledger so a truncated/corrupt file is never trusted. */
function isValidLedgerState(value: unknown): value is QrisLedgerState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    Array.isArray(s.transactions) &&
    Array.isArray(s.disbursements) &&
    typeof s.availableBalance === "number" &&
    typeof s.pendingBalance === "number" &&
    typeof s.totalWithdrawn === "number"
  );
}

/** Read a ledger file, returning null when missing or corrupt. */
function readValidatedLedger(file: string): QrisLedgerState | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    return isValidLedgerState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEDGER_FILE)) {
    // Seed with the engine's current (demo) state so the first boot matches
    // the pre-persistence behavior; every subsequent mutation then persists.
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(qrisLedger.getState(), null, 2), "utf8");
  }
}

export function hydrateQrisLedger(): void {
  try {
    ensureFile();
    let state = readValidatedLedger(LEDGER_FILE);
    if (!state) {
      // Primary file is missing or corrupt (e.g. a crash mid-write):
      // fall back to the last known-good backup before reseeding.
      const backup = readValidatedLedger(BACKUP_FILE);
      if (backup) {
        console.warn("QRIS ledger file corrupt; restored from backup.");
        fs.copyFileSync(BACKUP_FILE, LEDGER_FILE);
        state = backup;
      } else {
        console.error("QRIS ledger unreadable; reseeding from demo state.");
        state = qrisLedger.getState();
        fs.writeFileSync(LEDGER_FILE, JSON.stringify(state, null, 2), "utf8");
      }
    }
    qrisLedger.hydrate(state);
  } catch (err) {
    console.error("Failed to hydrate QRIS ledger:", err);
  }
}

export function persistQrisLedger(state: QrisLedgerState): void {
  try {
    ensureFile();
    // Preserve the last known-good ledger so a failed future write can be
    // recovered. Skipped when the current file is corrupt, to keep a good
    // backup from being clobbered.
    if (readValidatedLedger(LEDGER_FILE)) {
      fs.copyFileSync(LEDGER_FILE, BACKUP_FILE);
    }
    // Atomic write: tmp file + fsync + rename, so a crash mid-write can
    // never leave a truncated ledger on disk.
    const tmp = LEDGER_FILE + ".tmp";
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeFileSync(fd, JSON.stringify(state, null, 2), "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, LEDGER_FILE);
  } catch (err) {
    console.error("Failed to persist QRIS ledger:", err);
  }
}

/** Hydrate once and attach the hook. Called from instrumentation.register(). */
export function registerQrisLedgerPersistence(): void {
  hydrateQrisLedger();
  setQrisLedgerPersistHook(persistQrisLedger);
}

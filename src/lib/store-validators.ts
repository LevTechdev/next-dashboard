import fs from "fs";
import path from "path";

/**
 * Shape validators for the operational data stores (formerly JSON files in
 * data/, now persisted through Prisma — see src/lib/*-store.ts).
 *
 * Every store exposes one pure `isValidX(value: unknown)` predicate so a
 * corrupt row-set or a truncated legacy file is never trusted, exactly like
 * the original QRIS ledger validator. `checkStoreIntegrity()` at the bottom
 * combines them for /api/health.
 */

// ─── QRIS ledger (same rules as the original qris-ledger-store validator) ───

export interface LedgerLikeState {
  transactions: unknown[];
  disbursements: unknown[];
  availableBalance: number;
  pendingBalance: number;
  totalWithdrawn: number;
  totalInbound?: number;
}

/** Shape-validate a parsed ledger so a truncated/corrupt store is never trusted. */
export function isValidLedgerState(value: unknown): value is LedgerLikeState {
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

// ─── Purchase orders ─────────────────────────────────────────────────────────

const PO_STATUSES = new Set(["DRAFT", "ISSUED", "RECEIVED", "CANCELLED"]);

export function isValidPurchaseOrder(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.poNumber === "string" &&
    typeof p.supplierId === "string" &&
    typeof p.supplierName === "string" &&
    typeof p.status === "string" &&
    PO_STATUSES.has(p.status) &&
    typeof p.totalAmount === "number" &&
    Array.isArray(p.items) &&
    p.items.every(
      (item: unknown) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).productId === "string" &&
        typeof (item as Record<string, unknown>).quantity === "number" &&
        typeof (item as Record<string, unknown>).unitCost === "number" &&
        typeof (item as Record<string, unknown>).totalCost === "number",
    )
  );
}

export function isValidPurchaseOrders(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every(isValidPurchaseOrder);
}

// ─── Tenant branding ─────────────────────────────────────────────────────────

export function isValidTenantBranding(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.tenantId === "string" &&
    typeof b.brandName === "string" &&
    typeof b.customDomain === "string" &&
    typeof b.primaryColor === "string" &&
    typeof b.accentColor === "string"
  );
}

export function isValidTenantBrandingMap(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isValidTenantBranding);
}

// ─── Inventory snapshots ─────────────────────────────────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidInventorySnapshot(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.date === "string" && DATE_ONLY.test(s.date) && typeof s.value === "number";
}

export function isValidInventorySnapshots(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every(isValidInventorySnapshot);
}

// ─── Beneficiaries ───────────────────────────────────────────────────────────

export function isValidBeneficiary(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.accountNumber === "string" &&
    typeof b.accountName === "string" &&
    typeof b.channel === "string" &&
    typeof b.verified === "boolean" &&
    typeof b.favorite === "boolean" &&
    typeof b.lastUsedAt === "string" &&
    typeof b.totalDisbursed === "number"
  );
}

export function isValidBeneficiaries(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every(isValidBeneficiary);
}

// ─── Webhook DLQ ─────────────────────────────────────────────────────────────

const DLQ_STATUSES = new Set(["FAILED", "RETRYING", "RESOLVED"]);

export function isValidDlqEntry(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.platform === "string" &&
    typeof d.event === "string" &&
    typeof d.errorMessage === "string" &&
    typeof d.retryCount === "number" &&
    typeof d.maxRetries === "number" &&
    typeof d.status === "string" &&
    DLQ_STATUSES.has(d.status) &&
    typeof d.createdAt === "string" &&
    typeof d.lastAttemptAt === "string"
  );
}

export function isValidDlqEntries(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every(isValidDlqEntry);
}

// ─── Chat alerts config ──────────────────────────────────────────────────────

export function isValidChatAlertsData(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  const channelsOk =
    Array.isArray(c.channels) &&
    c.channels.every(
      (ch: unknown) =>
        !!ch &&
        typeof ch === "object" &&
        typeof (ch as Record<string, unknown>).id === "string" &&
        typeof (ch as Record<string, unknown>).platform === "string" &&
        typeof (ch as Record<string, unknown>).webhookUrl === "string" &&
        Array.isArray((ch as Record<string, unknown>).enabledEvents),
    );
  const rules = c.rules as Record<string, unknown> | undefined;
  const rulesOk =
    !!rules &&
    typeof rules === "object" &&
    typeof rules.stockoutDoiThreshold === "number" &&
    typeof rules.vipOrderMinAmount === "number" &&
    typeof rules.paymentAlertsEnabled === "boolean" &&
    typeof rules.dailyDigestTime === "string" &&
    typeof rules.dailyDigestEnabled === "boolean";
  const deliveriesOk =
    Array.isArray(c.deliveries) &&
    c.deliveries.every(
      (d: unknown) =>
        !!d &&
        typeof d === "object" &&
        typeof (d as Record<string, unknown>).id === "string" &&
        typeof (d as Record<string, unknown>).channelId === "string",
    );
  return channelsOk && rulesOk && deliveriesOk;
}

// ─── Integrity report for /api/health ────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");

export interface StoreIntegrity {
  /** Canonical store name. */
  store: string;
  /** The store resolved to a readable, shape-valid state. */
  valid: boolean;
  /** Non-empty (has real rows/records). */
  populated: boolean;
  /** Number of top-level records, when countable. */
  count: number | null;
  /** Set when reading or validating failed. */
  error: string | null;
  /** Whether a legacy data/<store>.json file still exists on disk. */
  legacyFile: boolean;
  /** Whether the legacy file (when present) passes the same validation. */
  legacyFileValid: boolean | null;
}

interface StoreDefinition {
  store: string;
  file: string;
  /** Read the live store state (DB-backed) and count top-level records. */
  read: () => Promise<{ value: unknown; count: number | null }>;
  validate: (value: unknown) => boolean;
}

function readLegacyFile(file: string): unknown | null {
  try {
    const full = path.join(DATA_DIR, file);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Live integrity of every operational store. Read-only: never seeds, never
 * creates rows or files. Never throws — failures surface per-store in the
 * returned report so /api/health can always answer.
 */
export async function checkStoreIntegrity(): Promise<{
  healthy: boolean;
  stores: StoreIntegrity[];
}> {
  // Imported lazily so validator-only consumers (and tests that mock the DB
  // client) never load Prisma transitively just for the shape predicates.
  const {
    loadQrisLedgerSnapshot,
    loadPurchaseOrders,
    loadTenantBrandingMap,
    loadInventorySnapshots,
    loadBeneficiaries,
    loadDlqEntries,
    loadChatConfig,
  } = await import("./store-readers");

  const definitions: StoreDefinition[] = [
    {
      store: "qris-ledger",
      file: "qris-ledger.json",
      read: async () => {
        const state = await loadQrisLedgerSnapshot();
        return {
          value: state,
          count: state ? state.transactions.length + state.disbursements.length : 0,
        };
      },
      validate: (v) => isValidLedgerState(v),
    },
    {
      store: "purchase-orders",
      file: "purchase-orders.json",
      read: async () => {
        const orders = await loadPurchaseOrders();
        return { value: orders, count: orders.length };
      },
      validate: (v) => isValidPurchaseOrders(v),
    },
    {
      store: "tenant-branding",
      file: "tenant-branding.json",
      read: async () => {
        const map = await loadTenantBrandingMap();
        return { value: map, count: Object.keys(map).length };
      },
      validate: (v) => isValidTenantBrandingMap(v),
    },
    {
      store: "inventory-snapshots",
      file: "inventory-snapshots.json",
      read: async () => {
        const snaps = await loadInventorySnapshots();
        return { value: snaps, count: snaps.length };
      },
      validate: (v) => isValidInventorySnapshots(v),
    },
    {
      store: "beneficiaries",
      file: "beneficiaries.json",
      read: async () => {
        const list = await loadBeneficiaries();
        return { value: list, count: list.length };
      },
      validate: (v) => isValidBeneficiaries(v),
    },
    {
      store: "webhook-dlq",
      file: "webhook-dlq.json",
      read: async () => {
        const list = await loadDlqEntries();
        return { value: list, count: list.length };
      },
      validate: (v) => isValidDlqEntries(v),
    },
    {
      store: "chat-alerts",
      file: "chat-alerts.json",
      read: async () => {
        const config = await loadChatConfig();
        return {
          value: config,
          count: config ? config.channels.length + config.deliveries.length : 0,
        };
      },
      validate: (v) => isValidChatAlertsData(v),
    },
  ];

  const stores: StoreIntegrity[] = [];
  for (const def of definitions) {
    const legacyRaw = readLegacyFile(def.file);
    const legacyFile = legacyRaw !== null;
    const legacyFileValid = legacyFile ? def.validate(legacyRaw) : null;
    let valid = false;
    let populated = false;
    let count: number | null = null;
    let error: string | null = null;
    try {
      const { value, count: readCount } = await def.read();
      valid = value !== null && value !== undefined && def.validate(value);
      count = readCount;
      populated = typeof count === "number" ? count > 0 : valid;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    stores.push({
      store: def.store,
      valid,
      populated,
      count,
      error,
      legacyFile,
      legacyFileValid,
    });
  }

  return { healthy: stores.every((s) => s.valid), stores };
}

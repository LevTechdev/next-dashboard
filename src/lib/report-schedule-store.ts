import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Persisted schedule store for scheduled executive reports.
 *
 * The Reports page's schedule config used to live in a module-level variable
 * inside the API route — every server restart silently reset it, and the
 * scheduler (a different module instance) could never read it. This JSON
 * store is the single source of truth both surfaces read/write, following
 * the data/*.json store pattern used by the QRIS ledger, webhook DLQ, and
 * auto-payout cycle.
 */

export interface ReportScheduleConfig {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  recipients: string[];
  metrics: {
    gmv: boolean;
    topProducts: boolean;
    forecast: boolean;
    channelBreakdown: boolean;
  };
  isActive: boolean;
  lastSentAt: string | null;
  timeOfDay: string; // "08:00" server time
}

const STORE_PATH = join(process.cwd(), "data", "report-schedule.json");

export const DEFAULT_REPORT_SCHEDULE: ReportScheduleConfig = {
  frequency: "WEEKLY",
  recipients: [],
  metrics: {
    gmv: true,
    topProducts: true,
    forecast: true,
    channelBreakdown: true,
  },
  isActive: false,
  lastSentAt: null,
  timeOfDay: "08:00",
};

export function readReportSchedule(): ReportScheduleConfig {
  try {
    if (!existsSync(STORE_PATH)) return { ...DEFAULT_REPORT_SCHEDULE };
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf-8")) as Partial<ReportScheduleConfig>;
    return {
      ...DEFAULT_REPORT_SCHEDULE,
      ...parsed,
      metrics: { ...DEFAULT_REPORT_SCHEDULE.metrics, ...(parsed.metrics ?? {}) },
    };
  } catch {
    return { ...DEFAULT_REPORT_SCHEDULE };
  }
}

export function writeReportSchedule(config: ReportScheduleConfig): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(config, null, 2));
  } catch {
    // Best-effort persistence; the API still functions in-memory for GET.
  }
}

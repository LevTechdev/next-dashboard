import "server-only";

import { prisma } from "@/lib/db";

/**
 * Persisted schedule store for scheduled executive reports, one row per
 * workspace. Previously a data/report-schedule.json file, which was both
 * global and read-only on serverless hosts.
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

function mapRow(row: {
  frequency: string;
  recipients: string[];
  metrics: unknown;
  isActive: boolean;
  lastSentAt: Date | null;
  timeOfDay: string;
}): ReportScheduleConfig {
  const metrics =
    row.metrics && typeof row.metrics === "object"
      ? (row.metrics as Partial<ReportScheduleConfig["metrics"]>)
      : {};
  return {
    ...DEFAULT_REPORT_SCHEDULE,
    frequency: (["DAILY", "WEEKLY", "MONTHLY"] as const).includes(
      row.frequency as ReportScheduleConfig["frequency"],
    )
      ? (row.frequency as ReportScheduleConfig["frequency"])
      : DEFAULT_REPORT_SCHEDULE.frequency,
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    metrics: { ...DEFAULT_REPORT_SCHEDULE.metrics, ...metrics },
    isActive: row.isActive,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    timeOfDay: row.timeOfDay || DEFAULT_REPORT_SCHEDULE.timeOfDay,
  };
}

export async function readReportSchedule(tenantId: string): Promise<ReportScheduleConfig> {
  const row = await prisma.reportSchedule.findUnique({ where: { tenantId } });
  return row ? mapRow(row) : { ...DEFAULT_REPORT_SCHEDULE };
}

export async function writeReportSchedule(
  tenantId: string,
  config: ReportScheduleConfig,
): Promise<void> {
  await prisma.reportSchedule.upsert({
    where: { tenantId },
    create: {
      tenantId,
      frequency: config.frequency,
      recipients: config.recipients,
      metrics: config.metrics,
      isActive: config.isActive,
      lastSentAt: config.lastSentAt ? new Date(config.lastSentAt) : null,
      timeOfDay: config.timeOfDay,
    },
    update: {
      frequency: config.frequency,
      recipients: config.recipients,
      metrics: config.metrics,
      isActive: config.isActive,
      lastSentAt: config.lastSentAt ? new Date(config.lastSentAt) : null,
      timeOfDay: config.timeOfDay,
    },
  });
}

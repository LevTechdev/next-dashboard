import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import {
  readReportSchedule,
  writeReportSchedule,
  type ReportScheduleConfig,
} from "@/lib/report-schedule-store";

export const dynamic = "force-dynamic";

export type { ReportScheduleConfig };

/**
 * GET /api/reports/scheduled
 * Returns current scheduled report configuration.
 */
export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    return NextResponse.json({
      success: true,
      schedule: readReportSchedule(),
    });
  } catch (error) {
    console.error("GET scheduled reports error:", error);
    return NextResponse.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}

/**
 * POST /api/reports/scheduled
 * Updates scheduled report frequency, recipients, and KPI inclusion settings.
 */
export async function POST(req: Request) {
  try {
    const { session, response } = await requirePermission("update", "reports", req);
    if (response) return response;

    const body = await req.json();
    const { frequency, recipients, metrics, isActive, timeOfDay } = body;

    if (frequency && !["DAILY", "WEEKLY", "MONTHLY"].includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    }

    if (recipients && (!Array.isArray(recipients) || recipients.length === 0)) {
      return NextResponse.json({ error: "At least one recipient email required" }, { status: 400 });
    }

    const current = readReportSchedule();
    const next: ReportScheduleConfig = {
      ...current,
      frequency: frequency || current.frequency,
      recipients: recipients || current.recipients,
      metrics: metrics ? { ...current.metrics, ...metrics } : current.metrics,
      isActive: isActive !== undefined ? Boolean(isActive) : current.isActive,
      timeOfDay: timeOfDay || current.timeOfDay,
    };
    writeReportSchedule(next);

    return NextResponse.json({
      success: true,
      schedule: next,
      message: "Scheduled report configuration updated",
    });
  } catch (error) {
    console.error("POST scheduled reports error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

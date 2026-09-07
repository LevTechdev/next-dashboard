import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

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
  timeOfDay: string; // "08:00"
}

// In-memory persistent schedule store (defaults to active weekly admin digest)
let activeSchedule: ReportScheduleConfig = {
  frequency: "WEEKLY",
  recipients: ["admin@example.com", "stakeholders@example.com"],
  metrics: {
    gmv: true,
    topProducts: true,
    forecast: true,
    channelBreakdown: true,
  },
  isActive: true,
  lastSentAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  timeOfDay: "08:00",
};

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
      schedule: activeSchedule,
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

    activeSchedule = {
      ...activeSchedule,
      frequency: frequency || activeSchedule.frequency,
      recipients: recipients || activeSchedule.recipients,
      metrics: metrics ? { ...activeSchedule.metrics, ...metrics } : activeSchedule.metrics,
      isActive: isActive !== undefined ? Boolean(isActive) : activeSchedule.isActive,
      timeOfDay: timeOfDay || activeSchedule.timeOfDay,
    };

    return NextResponse.json({
      success: true,
      schedule: activeSchedule,
      message: "Scheduled report configuration updated",
    });
  } catch (error) {
    console.error("POST scheduled reports error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

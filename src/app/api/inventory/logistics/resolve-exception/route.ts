import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { resolveFleetException, type FleetExceptionAction } from "@/lib/fleet-tax-store";

export const dynamic = "force-dynamic";

const ACTIONS: FleetExceptionAction[] = ["RESCHEDULE", "REROUTE_LOCKER", "SEND_ALERT"];

export async function POST(req: Request) {
  try {
    const { session, response } = await requirePermission("update", "inventory", req);
    if (response) return response;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const shipmentId = typeof body?.shipmentId === "string" ? body.shipmentId : "";
    const action = typeof body?.action === "string" ? body.action.toUpperCase() : "";
    if (!shipmentId || !ACTIONS.includes(action as FleetExceptionAction)) {
      return NextResponse.json({ error: "Invalid shipment or action" }, { status: 400 });
    }

    const shipment = await resolveFleetException(
      tenantId,
      shipmentId,
      action as FleetExceptionAction,
    );
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, shipment });
  } catch (error) {
    console.error("[FLEET_RESOLVE_EXCEPTION_ERROR]", error);
    return NextResponse.json({ error: "Failed to resolve shipment exception" }, { status: 500 });
  }
}

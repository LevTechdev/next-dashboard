import { NextResponse } from "next/server";
import { MOCK_FLEET_SHIPMENTS, getFleetTelemetrySummary } from "@/lib/logistics-fleet";

export async function GET() {
  const summary = getFleetTelemetrySummary(MOCK_FLEET_SHIPMENTS);
  return NextResponse.json({
    summary,
    shipments: MOCK_FLEET_SHIPMENTS,
  });
}

import { NextResponse } from "next/server";
import { MOCK_JURISDICTIONS } from "@/lib/tax-nexus";

export async function GET() {
  const activeNexusCount = MOCK_JURISDICTIONS.filter((j) => j.status === "NEXUS_REACHED").length;
  const approachingCount = MOCK_JURISDICTIONS.filter((j) => j.status === "APPROACHING").length;

  return NextResponse.json({
    summary: {
      activeNexusCount,
      approachingCount,
      totalJurisdictionsMonitored: MOCK_JURISDICTIONS.length,
      estimatedQuarterlyLiabilityUsd: 89400,
    },
    jurisdictions: MOCK_JURISDICTIONS,
  });
}

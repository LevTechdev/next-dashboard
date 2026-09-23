import { NextResponse } from "next/server";
import { MOCK_QUARTERLY_FILINGS } from "@/lib/tax-nexus";

export async function GET() {
  return NextResponse.json(MOCK_QUARTERLY_FILINGS);
}

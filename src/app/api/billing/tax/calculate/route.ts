import { NextRequest, NextResponse } from "next/server";
import { calculateTaxRate } from "@/lib/tax-nexus";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = calculateTaxRate({
      country: body.country || "US",
      stateOrRegion: body.stateOrRegion,
      subtotal: Number(body.subtotal) || 100,
      category: body.category || "DIGITAL_SAAS",
      b2bTaxId: body.b2bTaxId,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Tax calculation failed" }, { status: 400 });
  }
}

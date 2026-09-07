import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { shipmentId, action } = await req.json();
    return NextResponse.json({
      success: true,
      shipmentId,
      actionTaken: action,
      resolvedAt: new Date().toISOString(),
      message: `Exception on ${shipmentId} dispatched for action ${action}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to resolve exception" }, { status: 400 });
  }
}

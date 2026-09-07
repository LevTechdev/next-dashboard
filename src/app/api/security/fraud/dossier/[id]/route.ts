import { NextRequest, NextResponse } from "next/server";
import { generateDisputeDossier } from "@/lib/fraud-detection";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dossier = generateDisputeDossier(id, "ORD-2026-" + id.slice(-4), 1420.0, "USD");
  return NextResponse.json(dossier);
}

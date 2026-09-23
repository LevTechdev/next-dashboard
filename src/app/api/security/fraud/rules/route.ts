import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FRAUD_RULES, FraudRulesConfig } from "@/lib/fraud-detection";

let activeRules: FraudRulesConfig = { ...DEFAULT_FRAUD_RULES };

export async function GET() {
  return NextResponse.json(activeRules);
}

export async function PUT(req: NextRequest) {
  try {
    const updates = await req.json();
    activeRules = { ...activeRules, ...updates };
    return NextResponse.json({ success: true, rules: activeRules });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

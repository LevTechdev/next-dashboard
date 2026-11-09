import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { DEFAULT_FRAUD_RULES, FraudRulesConfig } from "@/lib/fraud-detection";

/**
 * Fraud thresholds are per-workspace. They stay in process memory (they are
 * tunable policy, not financial records), but are keyed by tenant so one
 * workspace can never read or overwrite another's rules.
 */
const activeRules = new Map<string, FraudRulesConfig>();

function rulesFor(tenantId: string): FraudRulesConfig {
  const existing = activeRules.get(tenantId);
  if (existing) return existing;
  const defaults = { ...DEFAULT_FRAUD_RULES };
  activeRules.set(tenantId, defaults);
  return defaults;
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = await effectiveTenantId(session);
  if (!tenantId) {
    return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
  }
  return NextResponse.json(rulesFor(tenantId));
}

export async function PUT(req: NextRequest) {
  const { session, response } = await requirePermission("update", "security", req);
  if (response) return response;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = await effectiveTenantId(session);
  if (!tenantId) {
    return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
  }

  try {
    const updates = await req.json();
    const merged = { ...rulesFor(tenantId), ...updates } as FraudRulesConfig;
    activeRules.set(tenantId, merged);
    return NextResponse.json({ success: true, rules: merged });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

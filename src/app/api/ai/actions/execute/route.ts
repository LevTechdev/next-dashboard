import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";
import { executeCopilotAction, CopilotActionProposal } from "@/lib/ai/copilot-proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const tenantId = getTenantId(session);
    const userId = session.user.id;

    const body = await req.json();
    const proposal: CopilotActionProposal = body?.proposal;

    if (!proposal || !proposal.type || !proposal.id) {
      return NextResponse.json({ error: "Invalid action proposal payload" }, { status: 400 });
    }

    const result = await executeCopilotAction(proposal, tenantId, userId);

    return NextResponse.json({
      ok: true,
      proposalId: proposal.id,
      type: proposal.type,
      message: result.message,
      resultId: result.resultId,
      details: result.details,
      executedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Copilot Action Execution Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute copilot action proposal" },
      { status: 500 },
    );
  }
}

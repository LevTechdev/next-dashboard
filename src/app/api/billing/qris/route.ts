import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { loadQrisLedger } from "@/lib/qris-ledger-store";

async function resolveLedger(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return { response };
  const tenantId = await effectiveTenantId(session);
  if (!tenantId) {
    return {
      response: NextResponse.json({ error: "No workspace for this account" }, { status: 400 }),
    };
  }
  const ledger = await loadQrisLedger(tenantId);
  return { session, tenantId, ledger };
}

export async function GET(req: Request) {
  try {
    const resolved = await resolveLedger(req);
    if ("response" in resolved) return resolved.response;
    const state = resolved.ledger.getState();
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve QRIS ledger",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const resolved = await resolveLedger(req);
    if ("response" in resolved) return resolved.response;

    const body = await req.json();
    const { amount, customerName } = body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid payment amount" },
        { status: 400 },
      );
    }

    const tx = resolved.ledger.createTransaction(parsedAmount, customerName || "Customer");
    return NextResponse.json({ success: true, transaction: tx });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create QRIS transaction",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const resolved = await resolveLedger(req);
    if ("response" in resolved) return resolved.response;

    const body = await req.json();
    const { transactionId, sourceBank } = body;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    const tx = resolved.ledger.confirmPayment(transactionId, sourceBank || "BCA Mobile");
    const updatedState = resolved.ledger.getState();

    return NextResponse.json({
      success: true,
      message: "Payment successfully simulated and confirmed into ledger",
      transaction: tx,
      availableBalance: updatedState.availableBalance,
      pendingBalance: updatedState.pendingBalance,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to confirm payment",
      },
      { status: 400 },
    );
  }
}

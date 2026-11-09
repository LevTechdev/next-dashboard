import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { effectiveTenantId } from "@/lib/tenancy";
import { loadQrisLedger } from "@/lib/qris-ledger-store";

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;
    const tenantId = await effectiveTenantId(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 400 });
    }

    const body = await req.json();
    const { method, destinationName, destinationAccount, amount, bankCode, cardType, notes } = body;

    if (!method || !destinationName || !destinationAccount || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required withdrawal fields" },
        { status: 400 },
      );
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid withdrawal amount" },
        { status: 400 },
      );
    }

    const ledger = await loadQrisLedger(tenantId);
    const disbursement = ledger.withdraw({
      method,
      destinationName,
      destinationAccount,
      amount: parsedAmount,
      bankCode,
      cardType,
      notes,
    });

    const updatedState = ledger.getState();

    return NextResponse.json({
      success: true,
      message: "Withdrawal processed successfully",
      disbursement,
      availableBalance: updatedState.availableBalance,
      totalWithdrawn: updatedState.totalWithdrawn,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Withdrawal failed" },
      { status: 400 },
    );
  }
}

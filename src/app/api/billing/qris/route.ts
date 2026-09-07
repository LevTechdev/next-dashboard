import { NextResponse } from "next/server";
import { qrisLedger } from "@/lib/qris-engine";

export async function GET() {
  try {
    const state = qrisLedger.getState();
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
    const body = await req.json();
    const { amount, customerName } = body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid payment amount" },
        { status: 400 },
      );
    }

    const tx = qrisLedger.createTransaction(parsedAmount, customerName || "Customer");
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
    const body = await req.json();
    const { transactionId, sourceBank } = body;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    const tx = qrisLedger.confirmPayment(transactionId, sourceBank || "BCA Mobile");
    const updatedState = qrisLedger.getState();

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

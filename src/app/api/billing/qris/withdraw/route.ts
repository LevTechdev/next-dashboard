import { NextResponse } from "next/server";
import { qrisLedger } from "@/lib/qris-engine";

export async function POST(req: Request) {
  try {
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

    const disbursement = qrisLedger.withdraw({
      method,
      destinationName,
      destinationAccount,
      amount: parsedAmount,
      bankCode,
      cardType,
      notes,
    });

    const updatedState = qrisLedger.getState();

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

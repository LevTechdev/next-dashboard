import { NextResponse } from "next/server";
import { inquireAccountName } from "@/lib/beneficiary-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountNumber = body.accountNumber || body.account;
    const channel = body.channel || body.method;
    const bankCode = body.bankCode;

    if (!accountNumber || typeof accountNumber !== "string") {
      return NextResponse.json({ error: "Account number is required" }, { status: 400 });
    }

    const inquiry = await inquireAccountName(accountNumber, channel, bankCode);
    return NextResponse.json(inquiry);
  } catch (error) {
    console.error("Account inquiry error:", error);
    return NextResponse.json({ error: "Failed to perform account inquiry" }, { status: 500 });
  }
}

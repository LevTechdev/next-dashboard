import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

// Mock stored payouts in memory for dev/demo purposes
const mockPayouts = [
  {
    id: "PAY-9812",
    amount: 1450.0,
    currency: "USD",
    provider: "STRIPE",
    status: "COMPLETED",
    account: "acct_1NZs9kFj3K9l...",
    affiliateName: "Sarah Tech Media",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "PAY-9811",
    amount: 820.5,
    currency: "USD",
    provider: "MIDTRANS",
    status: "COMPLETED",
    account: "BCA - 8920194821",
    affiliateName: "IndoCommerce Hub",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
  },
  {
    id: "PAY-9810",
    amount: 340.0,
    currency: "USD",
    provider: "STRIPE",
    status: "PROCESSING",
    account: "acct_1NZb3qLk8L1m...",
    affiliateName: "Nexus Review Studio",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    completedAt: null,
  },
  {
    id: "PAY-9809",
    amount: 510.0,
    currency: "USD",
    provider: "BANK_TRANSFER",
    status: "SCHEDULED",
    account: "Mandiri - 14000192837",
    affiliateName: "Digital Trend ID",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    completedAt: null,
  },
];

export async function GET(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const totalPaid = mockPayouts
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingBalance = mockPayouts
      .filter((p) => p.status === "PROCESSING" || p.status === "SCHEDULED")
      .reduce((sum, p) => sum + p.amount, 0);

    const availableBalance = 2450.0;

    return NextResponse.json({
      summary: {
        totalPaid,
        pendingBalance,
        availableBalance,
        currency: "USD",
      },
      payouts: mockPayouts,
    });
  } catch (error) {
    console.error("Affiliate Payouts GET error:", error);
    return NextResponse.json({ error: "Failed to fetch affiliate payouts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const body = await req.json();
    const { amount, provider, account, affiliateName } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid payout amount" }, { status: 400 });
    }

    const newPayout = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: parseFloat(amount),
      currency: "USD",
      provider: provider || "STRIPE",
      status: "PROCESSING",
      account: account || "Default Connected Account",
      affiliateName: affiliateName || session.user?.name || "Affiliate Partner",
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    mockPayouts.unshift(newPayout);

    return NextResponse.json({
      success: true,
      payout: newPayout,
    });
  } catch (error) {
    console.error("Affiliate Payouts POST error:", error);
    return NextResponse.json({ error: "Failed to process payout request" }, { status: 500 });
  }
}

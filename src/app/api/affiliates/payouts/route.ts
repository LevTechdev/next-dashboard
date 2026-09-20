import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { qrisLedger } from "@/lib/qris-engine";
import { getAutoPayouts } from "@/lib/affiliate-auto-payout";

/**
 * Affiliate payouts with automated balance validation.
 *
 * Available balance = commissions the workspace has earned (sum of APPROVED
 * + PAID conversions) minus what is already committed to outstanding payouts
 * (PROCESSING/SCHEDULED). A payout request that exceeds the balance is a 400
 * with the computed balance in the payload; a request that exceeds the QRIS
 * settlement ledger's available cash is a 503-style 409 so the UI can tell
 * the operator to top up the settlement account first.
 */

// Mock stored payouts in memory for dev/demo purposes (payout execution is
// provider-side; the ledger of requests stays in-memory like the dev seeds).
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

/** QRIS ledger holds IDR — convert to the USD payout base. */
const IDR_PER_USD = 15850;
// Auto-payout records live in a JSON store so route bundles share them.
const autoOutstandingUsd = (): number =>
  getAutoPayouts()
    .filter((p) => p.status === "SCHEDULED")
    .reduce((s: number, p: { amount: number }) => s + p.amount, 0);
const qrisBalanceUsd = (): number => qrisLedger.getState().availableBalance / IDR_PER_USD;

/**
 * Committed balance components, all in USD:
 *  - earned: APPROVED + PAID conversions (commission actually owed/owed+paid)
 *  - outstanding: payouts not yet completed (reserve against double-payout)
 */
async function computeBalances() {
  const conversionAgg = await prisma.affiliateConversion.aggregate({
    _sum: { commissionAmount: true },
    where: { status: { in: ["APPROVED", "PAID"] } },
  });

  const earned = conversionAgg._sum.commissionAmount || 0;
  const outstanding =
    mockPayouts
      .filter((p) => p.status === "PROCESSING" || p.status === "SCHEDULED")
      .reduce((sum, p) => sum + p.amount, 0) + autoOutstandingUsd();
  const totalPaid = mockPayouts
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  const availableBalance = Math.max(0, earned - outstanding);
  const settlementBalance = qrisBalanceUsd();

  return { earned, outstanding, totalPaid, availableBalance, settlementBalance };
}

export async function GET(req: Request) {
  try {
    const { response } = await requireAuth(req);
    if (response) return response;

    const { totalPaid, outstanding, availableBalance, settlementBalance } = await computeBalances();

    return NextResponse.json({
      summary: {
        totalPaid,
        pendingBalance: outstanding,
        availableBalance,
        settlementBalance,
        currency: "USD",
      },
      payouts: [...mockPayouts, ...getAutoPayouts()],
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
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: "Invalid payout amount" }, { status: 400 });
    }

    const { availableBalance, settlementBalance } = await computeBalances();

    if (numericAmount > availableBalance) {
      return NextResponse.json(
        {
          error: "insufficient_commission_balance",
          message: "Requested payout exceeds the available commission balance.",
          availableBalance,
          requested: numericAmount,
        },
        { status: 400 },
      );
    }

    // Settlement coverage: the QRIS ledger is the cash that actually pays out.
    if (numericAmount > settlementBalance) {
      return NextResponse.json(
        {
          error: "insufficient_settlement_funds",
          message:
            "The QRIS settlement balance cannot cover this payout. Top up the settlement account or pay out a smaller amount.",
          settlementBalance,
          requested: numericAmount,
        },
        { status: 409 },
      );
    }

    const newPayout = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: numericAmount,
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
      balanceAfter: {
        available: Math.max(0, availableBalance - numericAmount),
        settlement: Math.max(0, settlementBalance - numericAmount),
      },
    });
  } catch (error) {
    console.error("Affiliate Payouts POST error:", error);
    return NextResponse.json({ error: "Failed to process payout request" }, { status: 500 });
  }
}

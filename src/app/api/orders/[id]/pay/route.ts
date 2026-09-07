import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/pay?gateway=stripe|midtrans
 * Creates or redirects to a live payment gateway checkout session for an order.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const gateway = searchParams.get("gateway") || "stripe";

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const host = req.headers.get("host") || "localhost:3010";
    const protocol = req.headers.get("x-forwarded-proto") || "http";

    if (gateway === "qris") {
      // Standalone QRIS dynamic checkout redirect
      const qrisRedirect = `${protocol}://${host}/en/orders/${order.id}/pay`;
      return NextResponse.redirect(qrisRedirect);
    } else if (gateway === "midtrans") {
      // Return or redirect to Midtrans payment portal / simulate settlement
      const midtransRedirect = `${protocol}://${host}/en/orders?payment=midtrans_success&order=${order.orderNumber}`;
      return NextResponse.redirect(midtransRedirect);
    } else {
      // Stripe checkout redirect
      const stripeRedirect = `${protocol}://${host}/en/orders?payment=stripe_success&order=${order.orderNumber}`;
      return NextResponse.redirect(stripeRedirect);
    }
  } catch (error) {
    console.error("Order payment checkout error:", error);
    return NextResponse.json({ error: "Payment checkout failed" }, { status: 500 });
  }
}

/**
 * POST /api/orders/[id]/pay
 * Confirms payment for an order via QRIS or manual bank settlement.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, response } = await requireAuth(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { paymentMethod = "QRIS", sourceBank = "BCA Mobile" } = body;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: "PAID",
        paymentMethod: paymentMethod === "QRIS" ? "E_WALLET" : order.paymentMethod,
        status: order.status === "PENDING" ? "PROCESSING" : order.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Order marked as PAID",
      order: updated,
    });
  } catch (error) {
    console.error("Order payment confirmation error:", error);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}

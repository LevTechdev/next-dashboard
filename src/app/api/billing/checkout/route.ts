import { NextResponse } from "next/server";
import { getTokenFromRequest, getTokenFromCookie, verifyToken } from "@/lib/auth";
import { createStripeCheckoutSession } from "@/lib/payments/stripe";
import { createMidtransTransaction } from "@/lib/payments/midtrans";

export async function POST(req: Request) {
  try {
    const token = getTokenFromRequest(req) ?? getTokenFromCookie(req);
    const user = token ? verifyToken(token) : null;
    const session = user ? { user } : null;
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { planId, provider, amount } = await req.json();
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing`;

    if (provider === "stripe") {
      const url = await createStripeCheckoutSession(planId, session.user.id, returnUrl);
      return NextResponse.json({ url });
    } 
    
    if (provider === "midtrans") {
      // For Midtrans, generate a unique order ID for the subscription/payment
      const orderId = `SUB-${session.user.id}-${Date.now()}`;
      const customerDetails = {
        first_name: session.user.name,
        email: session.user.email,
      };
      const transaction = await createMidtransTransaction(orderId, amount, customerDetails);
      return NextResponse.json({ url: transaction.redirect_url, token: transaction.token });
    }

    return new NextResponse("Invalid provider", { status: 400 });
  } catch (error) {
    console.error("[CHECKOUT_POST]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

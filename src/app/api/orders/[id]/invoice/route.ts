import { NextResponse } from "next/server";
import { getTokenFromRequest, getTokenFromCookie, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToStream } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/lib/invoice-pdf";
import React from "react";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromRequest(req) ?? getTokenFromCookie(req);
    const user = token ? verifyToken(token) : null;
    const session = user ? { user } : null;
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: orderId } = await params;
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId: session.user.tenantId },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      return new NextResponse("Order not found", { status: 404 });
    }

    // Mock company data - in a real app, fetch from Tenant settings
    const company = {
      name: "Acme Corporation",
      address: "123 Business Avenue, Suite 100\nJakarta, Indonesia 12345",
      email: "billing@acmecorp.com"
    };

    // Render PDF stream
    const stream = await renderToStream(
      React.createElement(InvoiceDocument, { order, company }) as any
    );

    // Return as downloadable file
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[INVOICE_GET]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

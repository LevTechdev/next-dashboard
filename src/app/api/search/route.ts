import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { decryptCustomerPII, withDecryptedCustomer } from "@/lib/pii";
import { getTenantId } from "@/lib/tenancy";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = getTenantId(session);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ orders: [], customers: [], products: [] });
  }

  const [orders, customers, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
          // customer.email is encrypted at rest and cannot be substring-searched
        ],
      },
      include: { customer: true, channel: true },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: {
        // email/phone are encrypted at rest; searchable fields are name/city
        tenantId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { totalSpent: "desc" },
    }),
    prisma.product.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { category: true },
      take: 5,
      orderBy: { price: "desc" },
    }),
  ]);

  return NextResponse.json({
    orders: orders.map(withDecryptedCustomer),
    customers: customers.map(decryptCustomerPII),
    products,
  });
}

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const categories = await prisma.productCategory.findMany({
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories);
}

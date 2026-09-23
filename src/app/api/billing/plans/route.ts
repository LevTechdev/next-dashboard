import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The public catalogue: Starter / Professional / Enterprise only. Legacy
// rows ("Free", an old duplicate "Pro") are deactivated in the DB and
// excluded here so they can never resurface in Billing.
const HIDDEN_LEGACY_PLAN_NAMES = ["Free", "Pro"];

export async function GET() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true, name: { notIn: HIDDEN_LEGACY_PLAN_NAMES } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(plans);
}

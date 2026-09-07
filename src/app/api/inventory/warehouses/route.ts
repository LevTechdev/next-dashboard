import { NextResponse } from "next/server";
import { DEFAULT_WAREHOUSES } from "@/lib/inventory-replenishment";

export const dynamic = "force-dynamic";

export async function GET() {
  const totalCapacity = DEFAULT_WAREHOUSES.reduce((sum, w) => sum + w.capacityUnits, 0);
  const totalStock = DEFAULT_WAREHOUSES.reduce((sum, w) => sum + w.totalStockUnits, 0);
  const overallUtilization = Number(((totalStock / totalCapacity) * 100).toFixed(1));

  return NextResponse.json({
    warehouses: DEFAULT_WAREHOUSES,
    summary: {
      totalWarehouses: DEFAULT_WAREHOUSES.length,
      totalCapacity,
      totalStock,
      overallUtilization,
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const startTime = Date.now();
  const url = new URL(req.url);
  const isDeep = url.searchParams.get("deep") === "true";

  let dbStatus = "connected";
  let dbLatencyMs = 0;
  let dbError: string | null = null;
  let counts: Record<string, number> | null = null;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;

    if (isDeep) {
      const [userCount, customerCount, orderCount, productCount] = await Promise.all([
        prisma.user.count(),
        prisma.customer.count(),
        prisma.order.count(),
        prisma.product.count(),
      ]);
      counts = {
        users: userCount,
        customers: customerCount,
        orders: orderCount,
        products: productCount,
      };
    }
  } catch (err: any) {
    dbStatus = "disconnected";
    dbError = err.message || "Database connection error";
  }

  const memory = process.memoryUsage();
  const isHealthy = dbStatus === "connected";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError && { error: dbError }),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
          heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
          rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
        },
      },
      ...(counts && { dataCounts: counts }),
      totalResponseTimeMs: Date.now() - startTime,
    },
    { status: statusCode },
  );
}

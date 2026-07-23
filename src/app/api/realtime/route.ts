import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let prevSnapshot = "";

      const sendData = async () => {
        try {
          const data = await fetchDashboardData();
          const currentSnapshot = JSON.stringify(data);

          const changed = prevSnapshot !== "";
          if (currentSnapshot !== prevSnapshot) {
            // Only push if data actually changed
            const payload = { ...data, changed };
            const message = `data: ${JSON.stringify(payload)}\n\n`;
            controller.enqueue(encoder.encode(message));
          }
          prevSnapshot = currentSnapshot;
        } catch (error) {
          const message = `data: ${JSON.stringify({ error: "Failed to fetch data", timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(message));
        }
      };

      await sendData();
      const intervalId = setInterval(sendData, 10000);

      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, entity, entityId, details, userId } = body;

    if (action && entity) {
      await prisma.activityLog.create({
        data: {
          action,
          entity,
          entityId: entityId || null,
          details: details || JSON.stringify(body),
        },
      });
    }

    return new Response(JSON.stringify({ success: true, timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function fetchDashboardData() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalRevenue,
    totalOrders,
    totalCustomers,
    totalProducts,
    recentOrders,
    pendingOrders,
    lowStockProducts,
    todayRevenue,
    todayOrders,
    activeCampaigns,
    activeDiscounts,
    expiringDiscounts,
    lowStockDetails,
    budgetAlerts,
  ] = await Promise.all([
    prisma.order.aggregate({ _sum: { grandTotal: true } }),
    prisma.order.count(),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true, channel: true },
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { stock: { lte: 10 }, isActive: true } }),
    prisma.order.aggregate({
      _sum: { grandTotal: true },
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.discount.count({ where: { isActive: true, endsAt: { gte: now } } }),
    prisma.discount.findMany({
      where: {
        isActive: true,
        endsAt: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
      take: 3,
      orderBy: { endsAt: "asc" },
      select: { code: true, name: true, endsAt: true },
    }),
    prisma.product.findMany({
      where: { stock: { lte: 10 }, isActive: true },
      take: 5,
      orderBy: { stock: "asc" },
      select: { name: true, stock: true, sku: true },
    }),
    // Fetch active campaigns with budget/spent data for budget alerts
    prisma.campaign.findMany({
      where: { status: "ACTIVE", budget: { gt: 0 } },
      select: { id: true, name: true, budget: true, spent: true },
    }),
  ]);

  // Calculate today's sales milestones
  const revenueMilestones = [1000000, 5000000, 10000000, 50000000, 100000000];
  const todayTotal = todayRevenue._sum.grandTotal || 0;
  const nearestMilestone = revenueMilestones.find((m) => todayTotal < m);

  // Find recently created products (last hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const newProductsCount = await prisma.product.count({
    where: { createdAt: { gte: oneHourAgo } },
  });

  return {
    timestamp: now.toISOString(),
    stats: {
      totalRevenue: totalRevenue._sum.grandTotal || 0,
      totalOrders,
      totalCustomers,
      totalProducts,
    },
    today: {
      revenue: todayTotal,
      orders: todayOrders,
      nearestRevenueMilestone: nearestMilestone,
      milestoneProgress: nearestMilestone ? (todayTotal / nearestMilestone) * 100 : 100,
    },
    alerts: {
      pendingOrders,
      lowStockProducts,
      activeCampaigns,
      activeDiscounts,
    },
    expiringDiscounts,
    lowStockProductsList: lowStockDetails,
    newProductsCount,
    // Campaign budget data (full list, threshold filtering done client-side)
    budgetAlerts: {
      overBudget: budgetAlerts
        .filter((c) => c.spent >= c.budget)
        .map((c) => ({ id: c.id, name: c.name, spent: c.spent, budget: c.budget })),
      allCampaigns: budgetAlerts.map((c) => ({
        id: c.id,
        name: c.name,
        spent: c.spent,
        budget: c.budget,
        percentUsed: Math.round((c.spent / c.budget) * 100),
      })),
    },
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      grandTotal: o.grandTotal,
      status: o.status,
      customerName: o.customer?.name || "Guest",
      channelName: o.channel?.name || "Direct",
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

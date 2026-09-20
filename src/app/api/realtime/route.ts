import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ring buffer of the last few dashboard snapshots per tenant, replayed to
// newly connected SSE clients so a fresh tab immediately shows recent
// activity instead of waiting for the next 10s tick.
const SNAPSHOT_BUFFER_MAX = 5;
const snapshotBuffers = new Map<string, any[]>();

function pushSnapshot(tenantId: string | null, data: any): void {
  const compact = {
    timestamp: data.timestamp,
    stats: data.stats,
    today: data.today,
    alerts: data.alerts,
    expiringDiscounts: data.expiringDiscounts,
    lowStockProductsList: data.lowStockProductsList,
    newProductsCount: data.newProductsCount,
    budgetAlerts: data.budgetAlerts,
    recentOrders: data.recentOrders,
  };
  const key = tenantId || "anonymous";
  const buffer = snapshotBuffers.get(key) || [];
  buffer.push(compact);
  if (buffer.length > SNAPSHOT_BUFFER_MAX) buffer.shift();
  snapshotBuffers.set(key, buffer);
}

export async function GET(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (response) return response;
  const tenantId = getTenantId(session);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let prevSnapshot = "";
      let closed = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      // Enqueue without ever throwing after the controller is closed. A client
      // disconnect (or a failed enqueue) flips `closed`, stops the interval and
      // makes every later tick a no-op — no unhandled "Controller is already
      // closed" rejections from ticks racing the abort handler.
      const safeEnqueue = (message: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          closed = true;
          if (intervalId) clearInterval(intervalId);
        }
      };

      // Replay recent snapshots first (changed=false so the client treats them
      // as current state, not new activity — its own refs are primed by them).
      const buffer = snapshotBuffers.get(tenantId || "anonymous") || [];
      for (const snapshot of buffer) {
        safeEnqueue(`data: ${JSON.stringify({ ...snapshot, changed: false, replayed: true })}\n\n`);
      }

      const sendData = async () => {
        if (closed) return;
        try {
          const data = await fetchDashboardData(tenantId);
          const currentSnapshot = JSON.stringify(data);

          const changed = prevSnapshot !== "";
          if (currentSnapshot !== prevSnapshot) {
            // Only push if data actually changed
            const payload = { ...data, changed };
            safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
            // Buffer for late joiners regardless of whether this tick changed
            // (keeps the replay bounded to real state transitions).
            if (changed) pushSnapshot(tenantId, data);
          }
          prevSnapshot = currentSnapshot;
        } catch {
          safeEnqueue(
            `data: ${JSON.stringify({ error: "Failed to fetch data", timestamp: new Date().toISOString() })}\n\n`,
          );
        }
      };

      void sendData();
      intervalId = setInterval(() => {
        void sendData();
      }, 10000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // already closed
        }
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
    // Authenticated so the audit row can be attributed to a real workspace;
    // the caller's supplied userId is honored as an override (the client
    // never calls this endpoint today, but keep the old contract working).
    const { session, response } = await requireAuth(request);
    if (response) return response;

    const body = await request.json();
    const { action, entity, entityId, details, userId } = body;

    if (action && entity) {
      await prisma.activityLog.create({
        data: {
          action,
          entity,
          entityId: entityId || null,
          details: details || JSON.stringify(body),
          userId: userId || session.user.id,
          tenantId: session.user.tenantId,
        },
      });
    }

    return new Response(JSON.stringify({ success: true, timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function fetchDashboardData(tenantId: string | null) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // monthStart removed (unused)

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
    prisma.order.aggregate({ where: { tenantId }, _sum: { grandTotal: true } }),
    prisma.order.count({ where: { tenantId } }),
    prisma.customer.count({ where: { isActive: true, tenantId } }),
    prisma.product.count({ where: { isActive: true, tenantId } }),
    prisma.order.findMany({
      where: { tenantId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true, channel: true },
    }),
    prisma.order.count({ where: { status: "PENDING", tenantId } }),
    prisma.product.count({ where: { stock: { lte: 10 }, isActive: true, tenantId } }),
    prisma.order.aggregate({
      _sum: { grandTotal: true },
      where: { createdAt: { gte: todayStart }, tenantId },
    }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, tenantId } }),
    prisma.campaign.count({ where: { status: "ACTIVE", tenantId } }),
    prisma.discount.count({ where: { isActive: true, endsAt: { gte: now }, tenantId } }),
    prisma.discount.findMany({
      where: {
        isActive: true,
        tenantId,
        endsAt: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
      take: 3,
      orderBy: { endsAt: "asc" },
      select: { code: true, name: true, endsAt: true },
    }),
    prisma.product.findMany({
      where: { stock: { lte: 10 }, isActive: true, tenantId },
      take: 5,
      orderBy: { stock: "asc" },
      select: { name: true, stock: true, sku: true },
    }),
    // Fetch active campaigns with budget/spent data for budget alerts
    prisma.campaign.findMany({
      where: { status: "ACTIVE", budget: { gt: 0 }, tenantId },
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

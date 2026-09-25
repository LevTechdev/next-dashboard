import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { withDecryptedCustomer } from "@/lib/pii";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";
import type { SupportedCurrencyCode } from "@/lib/currency";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;
  const tenantId = getTenantId(session);
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const [
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,

      recentOrders,
      topProducts,
      salesChannels,
      ordersLastYear,
      customersLastYear,
      productsLastYear,
      orderCurrencies,
    ] = await Promise.all([
      prisma.order.aggregate({ where: { tenantId }, _sum: { grandTotal: true } }),
      prisma.order.count({ where: { tenantId } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.product.count({ where: { isActive: true, tenantId } }),
      prisma.order.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { customer: true, channel: true },
      }),
      prisma.product.findMany({
        where: { tenantId },
        take: 5,
        orderBy: { orderItems: { _count: "desc" } },
        include: { _count: { select: { orderItems: true, affiliateLinks: true } } },
      }),
      prisma.salesChannel.findMany({
        include: { _count: { select: { orders: true } } },
      }),
      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: oneYearAgo } },
        select: { createdAt: true, grandTotal: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.customer.findMany({
        where: { tenantId, createdAt: { gte: oneYearAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.product.findMany({
        where: { tenantId, createdAt: { gte: oneYearAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      // The dominant denomination of this tenant's orders — the revenue
      // figures below are raw sums of Order.grandTotal, so the client must
      // format them in the orders' currency, not guess from magnitude.
      prisma.order.groupBy({
        by: ["currency"],
        where: { tenantId },
        _count: { _all: true },
        orderBy: { _count: { currency: "desc" } },
        take: 1,
      }),
    ]);

    // Calculate growth vs previous month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Totals live in the `{ val }` refs below — `processGrowth` mutates them —
    // so there are no scalar counters to declare here.
    const processGrowth = (
      items: any[],
      currentRef: { val: number },
      prevRef: { val: number },
      valueFn: (item: any) => number = () => 1,
    ) => {
      items.forEach((item) => {
        const d = new Date(item.createdAt);
        if (d.getFullYear() === currentYear) {
          if (d.getMonth() === currentMonth) currentRef.val += valueFn(item);
          else if (d.getMonth() === currentMonth - 1) prevRef.val += valueFn(item);
        } else if (
          currentMonth === 0 &&
          d.getFullYear() === currentYear - 1 &&
          d.getMonth() === 11
        ) {
          prevRef.val += valueFn(item);
        }
      });
    };

    const revC = { val: 0 },
      revP = { val: 0 };
    const ordC = { val: 0 },
      ordP = { val: 0 };
    processGrowth(ordersLastYear, revC, revP, (o) => o.grandTotal);
    processGrowth(ordersLastYear, ordC, ordP);

    const custC = { val: 0 },
      custP = { val: 0 };
    processGrowth(customersLastYear, custC, custP);

    const prodC = { val: 0 },
      prodP = { val: 0 };
    processGrowth(productsLastYear, prodC, prodP);

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const revenueGrowth = calculateGrowth(revC.val, revP.val);
    const ordersGrowth = calculateGrowth(ordC.val, ordP.val);
    const customersGrowth = calculateGrowth(custC.val, custP.val);
    const productsGrowth = calculateGrowth(prodC.val, prodP.val);

    // Calculate monthly data in JavaScript
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyRevMap: Record<string, number> = {};
    const monthlyOrdMap: Record<string, number> = {};
    const monthlyCustMap: Record<string, number> = {};
    const monthlyProdMap: Record<string, number> = {};

    // "YYYY-M" keys — safe across the year boundary (a plain month-name map
    // would merge this January with last January).
    const monthlyRevByMonthKey = new Map<string, number>();

    ordersLastYear.forEach((order) => {
      const month = monthNames[new Date(order.createdAt).getMonth()];
      monthlyRevMap[month] = (monthlyRevMap[month] || 0) + order.grandTotal;
      const d = new Date(order.createdAt);
      const mk = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyRevByMonthKey.set(mk, (monthlyRevByMonthKey.get(mk) ?? 0) + order.grandTotal);
      monthlyOrdMap[month] = (monthlyOrdMap[month] || 0) + 1;
    });

    customersLastYear.forEach((c) => {
      const month = monthNames[new Date(c.createdAt).getMonth()];
      monthlyCustMap[month] = (monthlyCustMap[month] || 0) + 1;
    });

    productsLastYear.forEach((p) => {
      const month = monthNames[new Date(p.createdAt).getMonth()];
      monthlyProdMap[month] = (monthlyProdMap[month] || 0) + 1;
    });

    // Date anchors (one ISO day per bucket) let the RevenueChart aggregate
    // honest Weekly/Yearly groupings client-side from the same payload.
    // ALL 12 trailing months are returned — empty months included (revenue 0)
    // — so the chart never collapses to fewer bars when early months have no
    // orders; the month key (not the name) keeps ordering unambiguous across
    // the year boundary.
    const nowDate = new Date();
    const trailingMonths: Array<{ key: string; month: string; year: number; monthIdx: number }> =
      [];
    for (let back = 11; back >= 0; back -= 1) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - back, 1);
      trailingMonths.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthNames[d.getMonth()],
        year: d.getFullYear(),
        monthIdx: d.getMonth(),
      });
    }
    const monthlyRevenue = trailingMonths.map(({ key, month, year, monthIdx }) => ({
      month,
      revenue: monthlyRevByMonthKey.get(key) ?? 0,
      date: `${year}-${String(monthIdx + 1).padStart(2, "0")}-15`,
    }));

    const extractSparkline = (map: Record<string, number>) => {
      return monthNames
        .filter((m) => map[m] !== undefined)
        .map((m) => map[m] || 0)
        .slice(-7);
    };

    const channelSales = await Promise.all(
      salesChannels.map(async (channel) => {
        const total = await prisma.order.aggregate({
          where: { channelId: channel.id, tenantId },
          _sum: { grandTotal: true },
        });
        return {
          name: channel.name,
          slug: channel.slug,
          value: total._sum.grandTotal || 0,
          color: getChannelColor(channel.slug),
        };
      }),
    );

    // 30-day per-channel trend: one row per day, one column per channel slug,
    // feeding the stacked area chart on the Analytics channels tab.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const recentChannelOrders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      select: {
        createdAt: true,
        grandTotal: true,
        channel: { select: { slug: true, name: true } },
      },
    });
    const dayKeys: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const activeChannels = channelSales.filter((c) => c.value > 0).slice(0, 6);
    const channelTrendMap = new Map<string, Record<string, number | string>>();
    for (const key of dayKeys) {
      const row: Record<string, number | string> = { date: key };
      for (const ch of activeChannels) row[ch.slug] = 0;
      channelTrendMap.set(key, row);
    }
    for (const order of recentChannelOrders) {
      const slug = order.channel?.slug;
      if (!slug) continue;
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      const row = channelTrendMap.get(key);
      if (row && slug in row) {
        row[slug] = (Number(row[slug]) || 0) + (order.grandTotal || 0);
      }
    }
    const channelTrend = Array.from(channelTrendMap.values());

    const dominantCurrency = (orderCurrencies[0]?.currency ?? "USD") as SupportedCurrencyCode;

    return NextResponse.json({
      currency: dominantCurrency,
      stats: {
        totalRevenue: totalRevenue._sum.grandTotal || 0,
        totalOrders,
        totalCustomers,
        totalProducts,
        revenueGrowth,
        ordersGrowth,
        customersGrowth,
        productsGrowth,
      },
      recentOrders: recentOrders.map(withDecryptedCustomer),
      topProducts: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        orderCount: p._count.orderItems,
        linkedCount: p._count.affiliateLinks,
      })),
      salesByChannel: channelSales,
      channelTrend: channelTrend as Array<Record<string, number | string>>,
      revenueData: monthlyRevenue,
      sparklines: {
        orders: extractSparkline(monthlyOrdMap),
        customers: extractSparkline(monthlyCustMap),
        products: extractSparkline(monthlyProdMap),
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({
      currency: "USD",
      stats: {
        totalRevenue: 0,
        totalOrders: 0,
        totalCustomers: 0,
        totalProducts: 0,
        revenueGrowth: 0,
        ordersGrowth: 0,
        customersGrowth: 0,
        productsGrowth: 0,
      },
      recentOrders: [],
      topProducts: [],
      salesByChannel: [],
      channelTrend: [],
      revenueData: [],
    });
  }
}

function getChannelColor(slug: string): string {
  const colors: Record<string, string> = {
    "online-store": "#10B981",
    facebook: "#3B82F6",
    "facebook-shop": "#2563EB",
    instagram: "#EC4899",
    tiktok: "#F43F5E",
    shopify: "#059669",
  };
  return colors[slug] || "#6B7280";
}

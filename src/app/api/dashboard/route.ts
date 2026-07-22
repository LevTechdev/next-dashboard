import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
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
    ] = await Promise.all([
      prisma.order.aggregate({ _sum: { grandTotal: true } }),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { customer: true, channel: true },
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { orderItems: { _count: "desc" } },
        include: { _count: { select: { orderItems: true } } },
      }),
      prisma.salesChannel.findMany({
        include: { _count: { select: { orders: true } } },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: oneYearAgo } },
        select: { createdAt: true, grandTotal: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Calculate monthly revenue in JavaScript (database-agnostic)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap: Record<string, number> = {};
    
    ordersLastYear.forEach((order) => {
      const month = monthNames[new Date(order.createdAt).getMonth()];
      monthlyMap[month] = (monthlyMap[month] || 0) + order.grandTotal;
    });

    const monthlyRevenue = monthNames
      .filter((m) => monthlyMap[m] !== undefined)
      .map((month) => ({
        month,
        revenue: monthlyMap[month],
      }));

    const channelSales = await Promise.all(
      salesChannels.map(async (channel) => {
        const total = await prisma.order.aggregate({
          where: { channelId: channel.id },
          _sum: { grandTotal: true },
        });
        return {
          name: channel.name,
          value: total._sum.grandTotal || 0,
          color: getChannelColor(channel.slug),
        };
      })
    );

    return NextResponse.json({
      stats: {
        totalRevenue: totalRevenue._sum.grandTotal || 0,
        totalOrders,
        totalCustomers,
        totalProducts,
        revenueGrowth: 12.5,
        ordersGrowth: 8.3,
        customersGrowth: 15.2,
        productsGrowth: 5.1,
      },
      recentOrders,
      topProducts: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        orderCount: p._count.orderItems,
      })),
      salesByChannel: channelSales,
      revenueData: monthlyRevenue,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      {
        stats: {
          totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0,
          revenueGrowth: 0, ordersGrowth: 0, customersGrowth: 0, productsGrowth: 0,
        },
        recentOrders: [],
        topProducts: [],
        salesByChannel: [],
        revenueData: [],
      }
    );
  }
}

function getChannelColor(slug: string): string {
  const colors: Record<string, string> = {
    "online-store": "#10B981",
    "facebook": "#3B82F6",
    "facebook-shop": "#2563EB",
    "instagram": "#EC4899",
    "tiktok": "#F43F5E",
    "shopify": "#059669",
  };
  return colors[slug] || "#6B7280";
}

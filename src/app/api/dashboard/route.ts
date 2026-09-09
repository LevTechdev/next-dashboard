import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { withDecryptedCustomer } from "@/lib/pii";
import { requireAuth } from "@/lib/api-guard";
import { getTenantId } from "@/lib/tenancy";

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
      productsLastYear
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
    ]);

    // Calculate growth vs previous month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let currentMonthRevenue = 0;
    let previousMonthRevenue = 0;
    let currentMonthOrders = 0;
    let previousMonthOrders = 0;
    let currentMonthCustomers = 0;
    let previousMonthCustomers = 0;
    let currentMonthProducts = 0;
    let previousMonthProducts = 0;

    const processGrowth = (items: any[], currentRef: {val:number}, prevRef: {val:number}, valueFn: (item: any) => number = () => 1) => {
      items.forEach(item => {
        const d = new Date(item.createdAt);
        if (d.getFullYear() === currentYear) {
          if (d.getMonth() === currentMonth) currentRef.val += valueFn(item);
          else if (d.getMonth() === currentMonth - 1) prevRef.val += valueFn(item);
        } else if (currentMonth === 0 && d.getFullYear() === currentYear - 1 && d.getMonth() === 11) {
          prevRef.val += valueFn(item);
        }
      });
    };

    let revC = {val:0}, revP = {val:0};
    let ordC = {val:0}, ordP = {val:0};
    processGrowth(ordersLastYear, revC, revP, o => o.grandTotal);
    processGrowth(ordersLastYear, ordC, ordP);
    
    let custC = {val:0}, custP = {val:0};
    processGrowth(customersLastYear, custC, custP);
    
    let prodC = {val:0}, prodP = {val:0};
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
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const monthlyRevMap: Record<string, number> = {};
    const monthlyOrdMap: Record<string, number> = {};
    const monthlyCustMap: Record<string, number> = {};
    const monthlyProdMap: Record<string, number> = {};

    ordersLastYear.forEach((order) => {
      const month = monthNames[new Date(order.createdAt).getMonth()];
      monthlyRevMap[month] = (monthlyRevMap[month] || 0) + order.grandTotal;
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

    const monthlyRevenue = monthNames.filter(m => monthlyRevMap[m] !== undefined).map(month => ({ month, revenue: monthlyRevMap[month] }));
    
    const extractSparkline = (map: Record<string, number>) => {
      return monthNames.filter(m => map[m] !== undefined).map(m => map[m] || 0).slice(-7);
    };

    const channelSales = await Promise.all(
      salesChannels.map(async (channel) => {
        const total = await prisma.order.aggregate({
          where: { channelId: channel.id, tenantId },
          _sum: { grandTotal: true },
        });
        return {
          name: channel.name,
          value: total._sum.grandTotal || 0,
          color: getChannelColor(channel.slug),
        };
      }),
    );

    return NextResponse.json({
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
      revenueData: monthlyRevenue,
      sparklines: {
        orders: extractSparkline(monthlyOrdMap),
        customers: extractSparkline(monthlyCustMap),
        products: extractSparkline(monthlyProdMap)
      }
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({
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

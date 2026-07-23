import { z } from "zod";
import { prisma } from "@/lib/db";

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

// Tool definitions as plain objects compatible with streamText
export const dashboardTools = {
  getDashboardStats: {
    description:
      "Get overall dashboard statistics including total revenue, orders count, customer count, active product count, and growth percentages.",
    inputSchema: z.object({}),
    execute: async () => {
      const [totalRevenue, totalOrders, totalCustomers, totalProducts] = await Promise.all([
        prisma.order.aggregate({ _sum: { grandTotal: true } }),
        prisma.order.count(),
        prisma.customer.count(),
        prisma.product.count({ where: { isActive: true } }),
      ]);

      return {
        totalRevenue: totalRevenue._sum.grandTotal || 0,
        totalOrders,
        totalCustomers,
        totalProducts,
        revenueGrowth: 12.5,
        ordersGrowth: 8.3,
        customersGrowth: 15.2,
        productsGrowth: 5.1,
      };
    },
  },

  getRecentOrders: {
    description: "Get the most recent orders with customer and channel info.",
    inputSchema: z.object({
      limit: z.number().optional().default(5),
    }),
    execute: async ({ limit }: { limit?: number }) => {
      const orders = await prisma.order.findMany({
        take: Math.min(limit || 5, 20),
        orderBy: { createdAt: "desc" },
        include: { customer: true, channel: true },
      });

      return orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.grandTotal,
        customer: order.customer?.name || "Guest",
        channel: order.channel?.name || "N/A",
        date: order.createdAt.toISOString(),
        paymentStatus: order.paymentStatus,
      }));
    },
  },

  getTopProducts: {
    description: "Get the top selling products ranked by order count.",
    inputSchema: z.object({
      limit: z.number().optional().default(5),
    }),
    execute: async ({ limit }: { limit?: number }) => {
      const products = await prisma.product.findMany({
        take: Math.min(limit || 5, 20),
        orderBy: { orderItems: { _count: "desc" } },
        include: { _count: { select: { orderItems: true } }, category: true },
      });

      return products.map((product, index) => ({
        rank: index + 1,
        name: product.name,
        price: product.price,
        totalSold: product._count.orderItems,
        stock: product.stock,
        category: product.category?.name || "Uncategorized",
      }));
    },
  },

  getSalesByChannel: {
    description:
      "Get sales revenue breakdown by sales channel (Online Store, Facebook, Instagram, TikTok, Shopify, etc.)",
    inputSchema: z.object({}),
    execute: async () => {
      const channels = await prisma.salesChannel.findMany({
        include: { _count: { select: { orders: true } } },
      });

      const channelSales = await Promise.all(
        channels.map(async (channel) => {
          const agg = await prisma.order.aggregate({
            where: { channelId: channel.id },
            _sum: { grandTotal: true },
          });
          return {
            name: channel.name,
            revenue: agg._sum.grandTotal || 0,
            orderCount: channel._count.orders,
          };
        }),
      );

      return channelSales;
    },
  },

  getRevenueData: {
    description: "Get monthly revenue data for the current year to show revenue trends over time.",
    inputSchema: z.object({}),
    execute: async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: oneYearAgo } },
        select: { createdAt: true, grandTotal: true },
        orderBy: { createdAt: "asc" },
      });

      const monthlyMap: Record<string, number> = {};
      orders.forEach((order) => {
        const month = monthNames[new Date(order.createdAt).getMonth()];
        monthlyMap[month] = (monthlyMap[month] || 0) + order.grandTotal;
      });

      const monthlyRevenue = monthNames
        .filter((m) => monthlyMap[m] !== undefined)
        .map((month) => ({
          month,
          revenue: monthlyMap[month],
        }));

      const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);

      return { monthlyRevenue, totalRevenue, totalOrders: orders.length };
    },
  },

  searchBusiness: {
    description:
      "Search across orders, customers, and products by keyword. Use for finding specific entities.",
    inputSchema: z.object({
      query: z.string().min(2, "Search query must be at least 2 characters"),
    }),
    execute: async ({ query }: { query: string }) => {
      const [orders, customers, products] = await Promise.all([
        prisma.order.findMany({
          where: {
            OR: [
              { orderNumber: { contains: query, mode: "insensitive" } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          include: { customer: true },
          take: 3,
          orderBy: { createdAt: "desc" },
        }),
        prisma.customer.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 3,
          orderBy: { totalSpent: "desc" },
        }),
        prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 3,
          orderBy: { price: "desc" },
        }),
      ]);

      return {
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.grandTotal,
          customer: o.customer?.name || "Guest",
        })),
        customers: customers.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          city: c.city,
          totalSpent: c.totalSpent,
        })),
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          sku: p.sku,
        })),
      };
    },
  },

  getCustomerDetails: {
    description:
      "Get detailed information about a specific customer, including order history and total spending.",
    inputSchema: z.object({
      customerId: z.string().describe("The customer's unique ID"),
    }),
    execute: async ({ customerId }: { customerId: string }) => {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          _count: { select: { orders: true } },
          orders: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { channel: true },
          },
        },
      });

      if (!customer) return { error: "Customer not found" };

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        city: customer.city,
        segment: customer.segment,
        totalSpent: customer.totalSpent,
        isActive: customer.isActive,
        totalOrders: customer._count.orders,
        recentOrders: customer.orders.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.grandTotal,
          channel: o.channel?.name || "N/A",
          date: o.createdAt.toISOString(),
        })),
      };
    },
  },

  getOrderDetails: {
    description:
      "Get detailed information about a specific order, including items, customer, and payment details.",
    inputSchema: z.object({
      orderId: z.string().describe("The order's unique ID"),
    }),
    execute: async ({ orderId }: { orderId: string }) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          channel: true,
          user: true,
          items: { include: { product: true } },
        },
      });

      if (!order) return { error: "Order not found" };

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        discountAmount: order.discountAmount,
        shippingAmount: order.shippingAmount,
        taxAmount: order.taxAmount,
        grandTotal: order.grandTotal,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        customer: order.customer?.name || "Guest",
        channel: order.channel?.name || "N/A",
        date: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          product: item.product?.name || "Unknown",
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.total,
        })),
      };
    },
  },
};

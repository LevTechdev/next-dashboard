import { PrismaClient, type Product, type Customer, type SalesChannel } from "@prisma/client";
import { hash } from "bcryptjs";
import { computeHash, GENESIS_HASH } from "@/lib/audit-hash";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.orderDiscount.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryRecord.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.salesChannel.deleteMany();
  await prisma.user.deleteMany();

  // Re-chain the SecurityEvent tamper-evident hash chain. user.deleteMany()
  // NULLs userId on every event whose user was wiped (onDelete: SetNull), and
  // since userId is part of the canonical hash payload (src/lib/audit-hash.ts),
  // the stored hashes stop verifying. Recompute prevHash + hash for every
  // remaining event so a fresh seed always leaves the chain intact — this is
  // what keeps CI's post-E2E chain check and GET /api/security/audit/verify
  // green after any re-seed (idempotent: rows that already match are skipped).
  {
    const securityEvents = await prisma.securityEvent.findMany({
      orderBy: { seq: "asc" },
    });
    let prevHash = GENESIS_HASH;
    let rechained = 0;
    for (const e of securityEvents) {
      const hash = computeHash(prevHash, e);
      if (e.hash !== hash || (e.prevHash ?? GENESIS_HASH) !== prevHash) {
        await prisma.securityEvent.update({
          where: { id: e.id },
          data: { prevHash, hash },
        });
        rechained++;
      }
      prevHash = hash;
    }
    if (rechained > 0) {
      console.log(`🔗 SecurityEvent chain re-chained (${rechained} rows)`);
    }
  }

  // Default tenant — matches scripts/backfill-tenant.mjs + the register route
  // (both resolve the "default" workspace). Without this row, tenant-scoped
  // API routes (e.g. /api/auth/saml/connections) fail with "No tenant context"
  // on any fresh database (CI, act, new dev machines).
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Workspace", slug: "default" },
  });

  // Create Users (assigned to the default tenant, same as registration)
  const adminPassword = await hash("admin123", 10);
  const staffPassword = await hash("staff123", 10);

  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@dashboard.com", password: adminPassword, role: "ADMIN", position: "System Administrator", emailVerified: new Date(), tenantId: defaultTenant.id },
  });
  const manager = await prisma.user.create({
    data: { name: "Sarah Johnson", email: "sarah@dashboard.com", password: staffPassword, role: "MANAGER", position: "Sales Manager", tenantId: defaultTenant.id },
  });
  const staff = await prisma.user.create({
    data: { name: "Mike Wilson", email: "mike@dashboard.com", password: staffPassword, role: "STAFF", position: "Sales Staff", tenantId: defaultTenant.id },
  });

  console.log("✅ Users created (default tenant: ", defaultTenant.slug, ")");

  // Create Plans (Free/Pro/Enterprise) — stripePriceId is wired from env so a
  // production deploy can point at real Stripe prices. The Free plan is $0 and
  // is never routed through Stripe Checkout.
  const planData = [
    {
      name: "Free",
      description: "For personal use and small startups",
      price: 0,
      yearlyPrice: null,
      interval: "MONTHLY",
      features: ["Up to 100 orders/month", "1 team member", "Email support"],
      maxOrders: 100,
      maxTeamMembers: 1,
      hasAnalytics: false,
      hasReports: false,
      hasMultiChannel: false,
      hasApiAccess: false,
      hasRoleBasedAccess: false,
      supportLevel: "email",
      popular: false,
      sortOrder: 0,
      stripePriceId: null,
    },
    {
      name: "Pro",
      description: "Best for growing businesses with multiple channels",
      price: 29,
      yearlyPrice: 290,
      interval: "MONTHLY",
      features: [
        "Up to 1,000 orders/month",
        "10 team members",
        "Advanced analytics",
        "Reports & insights",
        "Multi-channel sales",
        "API access",
        "Priority support",
      ],
      maxOrders: 1000,
      maxTeamMembers: 10,
      hasAnalytics: true,
      hasReports: true,
      hasMultiChannel: true,
      hasApiAccess: true,
      hasRoleBasedAccess: true,
      supportLevel: "priority",
      popular: true,
      sortOrder: 1,
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
    },
    {
      name: "Enterprise",
      description: "For large organizations with advanced needs",
      price: 99,
      yearlyPrice: 990,
      interval: "MONTHLY",
      features: [
        "Unlimited orders",
        "Unlimited team members",
        "Role-based access",
        "Dedicated support",
        "Everything in Pro",
      ],
      maxOrders: null,
      maxTeamMembers: null,
      hasAnalytics: true,
      hasReports: true,
      hasMultiChannel: true,
      hasApiAccess: true,
      hasRoleBasedAccess: true,
      supportLevel: "dedicated",
      popular: false,
      sortOrder: 2,
      stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    },
  ];

  for (const p of planData) {
    await prisma.plan.upsert({
      where: { name: p.name },
      update: p,
      create: p,
    });
  }
  console.log("✅ Plans created (Free/Pro/Enterprise)");

  // Seed the admin on the Free plan so the billing page shows plan gating
  // immediately instead of "No Active Plan".
  const freePlan = await prisma.plan.findUnique({ where: { name: "Free" } });
  if (freePlan) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await prisma.subscription.upsert({
      where: { userId: admin.id },
      update: {
        planId: freePlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        userId: admin.id,
        planId: freePlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    console.log("✅ Admin seeded on Free plan");
  }

  // Create Sales Channels
  const channelData = [
    { name: "Online Store", slug: "online-store", icon: "store" },
    { name: "Facebook", slug: "facebook", icon: "facebook" },
    { name: "Facebook Shop", slug: "facebook-shop", icon: "facebook" },
    { name: "Instagram", slug: "instagram", icon: "instagram" },
    { name: "TikTok", slug: "tiktok", icon: "music" },
    { name: "Shopify", slug: "shopify", icon: "shopping-bag" },
  ];

  const channels: Record<string, SalesChannel> = {};
  for (const ch of channelData) {
    channels[ch.slug] = await prisma.salesChannel.create({ data: ch });
  }
  console.log("✅ Sales channels created");

  // Create Product Categories (assigned to the default tenant so the
  // tenant-scoped product/category queries can see them)
  const categories = await Promise.all([
    prisma.productCategory.create({ data: { name: "Electronics", slug: "electronics", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Clothing", slug: "clothing", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Home & Living", slug: "home-living", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Accessories", slug: "accessories", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Sports", slug: "sports", tenantId: defaultTenant.id } }),
  ]);
  console.log("✅ Categories created");

  // Create Products
  const productData = [
    { name: "Wireless Bluetooth Headphones", category: 0, price: 899000, costPrice: 450000, stock: 45, sku: "ELEC-001" },
    { name: "Premium Smart Watch", category: 0, price: 2499000, costPrice: 1200000, stock: 28, sku: "ELEC-002" },
    { name: "USB-C Hub 7-in-1", category: 0, price: 349000, costPrice: 150000, stock: 120, sku: "ELEC-003" },
    { name: "Cotton Casual T-Shirt", category: 1, price: 149000, costPrice: 50000, stock: 200, sku: "CLTH-001" },
    { name: "Denim Jacket Classic", category: 1, price: 599000, costPrice: 250000, stock: 35, sku: "CLTH-002" },
    { name: "Running Shoes Pro", category: 4, price: 1299000, costPrice: 600000, stock: 50, sku: "SPRT-001" },
    { name: "Minimalist Desk Lamp", category: 2, price: 449000, costPrice: 180000, stock: 65, sku: "HOME-001" },
    { name: "Leather Wallet", category: 3, price: 299000, costPrice: 100000, stock: 0, sku: "ACCS-001" },
    { name: "Yoga Mat Premium", category: 4, price: 399000, costPrice: 150000, stock: 8, sku: "SPRT-002" },
    { name: "Ceramic Coffee Mug Set", category: 2, price: 199000, costPrice: 60000, stock: 150, sku: "HOME-002" },
    { name: "Sunglasses Aviator", category: 3, price: 499000, costPrice: 180000, stock: 12, sku: "ACCS-002" },
    { name: "Mechanical Keyboard RGB", category: 0, price: 1799000, costPrice: 800000, stock: 22, sku: "ELEC-004" },
  ];

  const products: Product[] = [];
  for (const p of productData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
        sku: p.sku,
        categoryId: categories[p.category].id,
        tenantId: defaultTenant.id,
      },
    });
    products.push(product);
  }
  console.log("✅ Products created");

  // Create Customers
  const customerData = [
    { name: "John Doe", email: "john@email.com", phone: "+62-812-3456-7890", city: "Jakarta", segment: "VIP" },
    { name: "Jane Smith", email: "jane@email.com", phone: "+62-813-9876-5432", city: "Surabaya", segment: "REGULAR" },
    { name: "Budi Santoso", email: "budi@email.com", phone: "+62-811-2345-6789", city: "Bandung", segment: "NEW" },
    { name: "Siti Rahayu", email: "siti@email.com", phone: "+62-817-8765-4321", city: "Yogyakarta", segment: "VIP" },
    { name: "Alex Wong", email: "alex@email.com", phone: "+62-815-6543-2109", city: "Medan", segment: "REGULAR" },
    { name: "Rina Amelia", email: "rina@email.com", phone: "+62-819-3210-9876", city: "Makassar", segment: "NEW" },
    { name: "David Chen", email: "david@email.com", phone: "+62-818-1111-2222", city: "Jakarta", segment: "REGULAR" },
    { name: "Maya Putri", email: "maya@email.com", phone: "+62-814-3333-4444", city: "Bali", segment: "VIP" },
    { name: "Tommy Gunawan", email: "tommy@email.com", phone: "+62-816-5555-6666", city: "Semarang", segment: "REGULAR" },
    { name: "Dewi Lestari", email: "dewi@email.com", phone: "+62-813-7777-8888", city: "Palembang", segment: "NEW" },
  ];

  const customers: Customer[] = [];
  for (const c of customerData) {
    customers.push(
      await prisma.customer.create({
        data: {
          ...c,
          lastOrderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          tenantId: defaultTenant.id,
        },
      })
    );
  }
  console.log("✅ Customers created");

  // Create Orders with items — spread across the last 12 months so the
  // dashboard revenue chart and the sales pages look alive. Order counts ramp
  // up toward the present (gently growing revenue curve across all 12 bars),
  // and statuses are weighted by order age: fresh orders are in-flight
  // (PENDING/PROCESSING), older ones are mostly DELIVERED, and a steady ~5%
  // are CANCELLED — so the sales page status filter has a real mix.
  const MONTHS = 12;
  const now = new Date();

  // Per-month order counts: ~15-20 twelve months ago → ~40 this month (+jitter).
  const monthCounts = Array.from({ length: MONTHS }, (_, i) => {
    const base = 15 + Math.round((i / (MONTHS - 1)) * 25);
    return base + Math.floor(Math.random() * 8);
  });

  const pick = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

  /** First day of `count` months back from today. */
  const monthsAgo = (count: number): Date => {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - count);
    return d;
  };

  /** Status weighted by order age (days). */
  const statusForAge = (ageDays: number): string => {
    const roll = Math.random();
    if (ageDays < 7) {
      if (roll < 0.4) return "PENDING";
      if (roll < 0.75) return "PROCESSING";
      if (roll < 0.9) return "SHIPPED";
      return "DELIVERED";
    }
    if (ageDays < 30) {
      if (roll < 0.15) return "PROCESSING";
      if (roll < 0.55) return "SHIPPED";
      if (roll < 0.93) return "DELIVERED";
      return "CANCELLED";
    }
    if (roll < 0.85) return "DELIVERED";
    if (roll < 0.95) return "CANCELLED";
    return "SHIPPED";
  };

  let orderSeq = 1000;

  const paymentMethods = ["CREDIT_CARD", "BANK_TRANSFER", "E_WALLET", "COD"];

  for (let m = 0; m < MONTHS; m++) {
    const monthStart = monthsAgo(MONTHS - 1 - m);
    const daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    // Clamp the current month to today so no order is future-dated.
    const maxDay = m === MONTHS - 1 ? now.getDate() : daysInMonth;

    for (let k = 0; k < monthCounts[m]; k++) {
      const customer = pick(customers);
      const channel = pick(Object.values(channels));
      const numItems = Math.floor(Math.random() * 3) + 1;
      const items = [];
      let totalAmount = 0;

      for (let j = 0; j < numItems; j++) {
        const product = pick(products);
        const qty = Math.floor(Math.random() * 3) + 1;
        const total = product.price * qty;
        totalAmount += total;
        items.push({
          productId: product.id,
          name: product.name,
          quantity: qty,
          price: product.price,
          total,
        });
      }

      const discountAmount = Math.random() > 0.7 ? totalAmount * 0.1 : 0;
      const shippingAmount = totalAmount > 500000 ? 0 : 25000;
      const taxAmount = totalAmount * 0.11;
      const grandTotal = totalAmount - discountAmount + shippingAmount + taxAmount;

      const orderDate = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        1 + Math.floor(Math.random() * maxDay),
        8 + Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 60),
        0,
      );

      const status = statusForAge((Date.now() - orderDate.getTime()) / 86400000);
      const paymentStatus =
        status === "CANCELLED"
          ? Math.random() < 0.5
            ? "REFUNDED"
            : "UNPAID"
          : status === "PENDING"
            ? "UNPAID"
            : "PAID";

      await prisma.order.create({
        data: {
          orderNumber: `ORD-${String(orderSeq++).padStart(4, "0")}`,
          customerId: customer.id,
          userId: pick([admin.id, manager.id, staff.id]),
          channelId: channel.id,
          status,
          totalAmount,
          discountAmount,
          shippingAmount,
          taxAmount,
          grandTotal,
          paymentMethod: pick(paymentMethods),
          paymentStatus,
          shippingAddress: `${Math.floor(Math.random() * 999) + 1} ${["Jl. Merdeka", "Jl. Sudirman", "Jl. Gatot Subroto", "Jl. Thamrin"][Math.floor(Math.random() * 4)]}, ${customer.city}`,
          createdAt: orderDate,
          tenantId: defaultTenant.id,
          items: { create: items },
        },
      });

      // Update customer stats
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalSpent: { increment: grandTotal },
          totalOrders: { increment: 1 },
          lastOrderDate: orderDate,
        },
      });
    }
  }
  console.log(`✅ Orders created (${orderSeq - 1000} across ${MONTHS} months)`);

  // Create Discounts
  const discountData = [
    { code: "WELCOME10", name: "Welcome 10% Off", type: "PERCENTAGE", value: 10, minPurchase: 0, maxUses: 100, startsAt: new Date("2025-01-01"), endsAt: new Date("2026-12-31"), usedCount: 45 },
    { code: "SALE50", name: "Flash Sale 50K", type: "FIXED", value: 50000, minPurchase: 200000, maxUses: 50, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), usedCount: 23 },
    { code: "FREESHIP", name: "Free Shipping", type: "FIXED", value: 25000, minPurchase: 300000, maxUses: 200, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), usedCount: 78 },
    { code: "VIP20", name: "VIP 20% Discount", type: "PERCENTAGE", value: 20, minPurchase: 1000000, maxUses: 30, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), usedCount: 12 },
    { code: "HOLIDAY15", name: "Holiday Special 15%", type: "PERCENTAGE", value: 15, minPurchase: 500000, maxUses: 0, startsAt: new Date("2025-12-01"), endsAt: new Date("2026-01-15"), usedCount: 67 },
  ];

  for (const d of discountData) {
    await prisma.discount.create({ data: { ...d, tenantId: defaultTenant.id } });
  }
  console.log("✅ Discounts created");

  // Create Campaigns
  const campaignData = [
    { name: "Summer Sale 2026", description: "Big summer discounts across all categories", type: "SOCIAL", status: "ACTIVE", budget: 15000000, spent: 8200000, channel: "instagram" },
    { name: "New Product Launch", description: "Promoting new electronics line", type: "ADS", status: "ACTIVE", budget: 25000000, spent: 15000000, channel: "facebook" },
    { name: "Email Newsletter Q3", description: "Quarterly newsletter campaign", type: "EMAIL", status: "COMPLETED", budget: 5000000, spent: 4800000, channel: "email" },
    { name: "TikTok Influencer", description: "Collaboration with top influencers", type: "SOCIAL", status: "DRAFT", budget: 30000000, spent: 0, channel: "tiktok" },
    { name: "Google Ads Retargeting", description: "Retargeting campaign for cart abandoners", type: "ADS", status: "PAUSED", budget: 10000000, spent: 3500000, channel: "google" },
    { name: "Flash Weekend Deal", description: "Weekend flash sale promotion", type: "SMS", status: "ACTIVE", budget: 8000000, spent: 2500000, channel: "facebook" },
  ];

  for (const c of campaignData) {
    await prisma.campaign.create({
      data: {
        ...c,
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-12-31"),
        tenantId: defaultTenant.id,
      },
    });
  }
  console.log("✅ Campaigns created");

  // Create Inventory Records
  for (const product of products) {
    await prisma.inventoryRecord.create({
      data: {
        productId: product.id,
        type: "IN",
        quantity: product.stock,
        notes: "Initial stock",
      },
    });
  }
  console.log("✅ Inventory records created");

  // Create Activity Logs
  const activities = [
    { action: "LOGIN", details: "Admin logged in" },
    { action: "CREATE_ORDER", details: "New order ORD-0001 created" },
    { action: "UPDATE_PRODUCT", details: "Product stock updated" },
    { action: "CREATE_CAMPAIGN", details: "New campaign 'Summer Sale' created" },
    { action: "APPLY_DISCOUNT", details: "Discount WELCOME10 applied to order" },
  ];

  for (const a of activities) {
    await prisma.activityLog.create({
      data: { userId: admin.id, tenantId: defaultTenant.id, ...a },
    });
  }
  console.log("✅ Activity logs created");

  console.log("\n🎉 Database seeded successfully!");
  console.log("📧 Admin login: admin@dashboard.com / admin123");
  console.log("📧 Staff login: sarah@dashboard.com / staff123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

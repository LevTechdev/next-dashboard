import { PrismaClient, type Product, type Customer, type SalesChannel } from "@prisma/client";
import { hash } from "bcryptjs";
import { computeHash, GENESIS_HASH } from "@/lib/audit-hash";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.notification.deleteMany();
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

  // Re-chain the SecurityEvent tamper-evident hash chain.
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

  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Workspace", slug: "default" },
  });

  const adminPassword = await hash("admin123", 10);
  const staffPassword = await hash("staff123", 10);

  const admin = await prisma.user.create({
    data: { name: "Admin", email: "nextdashboards@gmail.com", password: adminPassword, role: "ADMIN", position: "System Administrator", emailVerified: new Date(), tenantId: defaultTenant.id },
  });
  const manager = await prisma.user.create({
    data: { name: "Sarah Johnson", email: "sarah@dashboard.com", password: staffPassword, role: "MANAGER", position: "Sales Manager", tenantId: defaultTenant.id },
  });
  const staff = await prisma.user.create({
    data: { name: "Mike Wilson", email: "mike@dashboard.com", password: staffPassword, role: "STAFF", position: "Sales Staff", tenantId: defaultTenant.id },
  });

  console.log("✅ Users created (default tenant: ", defaultTenant.slug, ")");

  const planData = [
    {
      name: "Starter",
      description: "Perfect for small businesses getting started.",
      price: 29,
      yearlyPrice: 276,
      interval: "MONTHLY",
      features: [
        "Up to 100 orders/month",
        "Up to 3 team members",
        "Basic analytics",
        "Standard exports",
        "Email support",
      ],
      maxOrders: 100,
      maxTeamMembers: 3,
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
      name: "Professional",
      description: "For growing teams who need full power.",
      price: 79,
      yearlyPrice: 756,
      interval: "MONTHLY",
      features: [
        "Up to 1,000 orders/month",
        "Up to 10 team members",
        "Advanced real-time analytics",
        "Priority support",
        "Multi-channel integrations",
        "Custom reports",
        "Role-Based Access Control",
        "API & Webhooks",
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
      description: "Custom solutions for high-volume businesses.",
      price: 199,
      yearlyPrice: 1908,
      interval: "MONTHLY",
      features: [
        "Unlimited orders",
        "Unlimited team members",
        "Advanced real-time analytics",
        "24/7 Dedicated support",
        "Multi-channel integrations",
        "Custom reports",
        "Role-Based Access Control",
        "API & Webhooks",
        "Custom data exports",
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

  const freePlan = await prisma.plan.findUnique({ where: { name: "Starter" } }); // Using Starter as Free
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
    console.log("✅ Admin seeded on Starter plan");
  }

  const channelData = [
    { name: "Online Store", slug: "online-store", icon: "store" },
    { name: "Facebook", slug: "facebook", icon: "facebook" },
    { name: "Facebook Shop", slug: "facebook-shop", icon: "facebook" },
    { name: "Instagram", slug: "instagram", icon: "instagram" },
    { name: "TikTok", slug: "tiktok", icon: "music" },
    { name: "Shopify", slug: "shopify", icon: "shopping-bag" },
    { name: "Shopee", slug: "shopee", icon: "shopping-cart" },
    { name: "Tokopedia", slug: "tokopedia", icon: "shopping-cart" },
  ];

  const channels: Record<string, SalesChannel> = {};
  for (const ch of channelData) {
    channels[ch.slug] = await prisma.salesChannel.create({ data: ch });
  }
  console.log("✅ Sales channels created");

  const categories = await Promise.all([
    prisma.productCategory.create({ data: { name: "Electronics", slug: "electronics", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Clothing", slug: "clothing", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Home & Living", slug: "home-living", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Accessories", slug: "accessories", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Sports", slug: "sports", tenantId: defaultTenant.id } }),
    prisma.productCategory.create({ data: { name: "Beauty", slug: "beauty", tenantId: defaultTenant.id } }),
  ]);
  console.log("✅ Categories created");

  const productData = [
    { name: "Wireless Bluetooth Headphones", category: 0, price: 899000, costPrice: 450000, stock: 45, sku: "ELEC-001" },
    { name: "Premium Smart Watch", category: 0, price: 2499000, costPrice: 1200000, stock: 28, sku: "ELEC-002" },
    { name: "USB-C Hub 7-in-1", category: 0, price: 349000, costPrice: 150000, stock: 120, sku: "ELEC-003" },
    { name: "Mechanical Keyboard RGB", category: 0, price: 1799000, costPrice: 800000, stock: 22, sku: "ELEC-004" },
    { name: "4K Action Camera", category: 0, price: 3200000, costPrice: 2000000, stock: 15, sku: "ELEC-005" },
    { name: "Noise Cancelling Earbuds", category: 0, price: 1500000, costPrice: 700000, stock: 80, sku: "ELEC-006" },
    { name: "Portable Power Bank 20000mAh", category: 0, price: 450000, costPrice: 200000, stock: 150, sku: "ELEC-007" },
    { name: "Wireless Charging Pad", category: 0, price: 250000, costPrice: 100000, stock: 200, sku: "ELEC-008" },
    { name: "Smart Home Security Camera", category: 0, price: 850000, costPrice: 400000, stock: 60, sku: "ELEC-009" },
    { name: "Bluetooth Speaker Waterproof", category: 0, price: 650000, costPrice: 300000, stock: 110, sku: "ELEC-010" },
    
    { name: "Cotton Casual T-Shirt", category: 1, price: 149000, costPrice: 50000, stock: 200, sku: "CLTH-001" },
    { name: "Denim Jacket Classic", category: 1, price: 599000, costPrice: 250000, stock: 35, sku: "CLTH-002" },
    { name: "Slim Fit Chino Pants", category: 1, price: 349000, costPrice: 150000, stock: 150, sku: "CLTH-003" },
    { name: "V-Neck Wool Sweater", category: 1, price: 499000, costPrice: 200000, stock: 90, sku: "CLTH-004" },
    { name: "Summer Floral Dress", category: 1, price: 299000, costPrice: 120000, stock: 75, sku: "CLTH-005" },
    { name: "Athletic Performance Shorts", category: 1, price: 199000, costPrice: 80000, stock: 180, sku: "CLTH-006" },
    { name: "Waterproof Windbreaker", category: 1, price: 450000, costPrice: 200000, stock: 45, sku: "CLTH-007" },
    { name: "Formal Button-Down Shirt", category: 1, price: 399000, costPrice: 150000, stock: 120, sku: "CLTH-008" },
    
    { name: "Minimalist Desk Lamp", category: 2, price: 449000, costPrice: 180000, stock: 65, sku: "HOME-001" },
    { name: "Ceramic Coffee Mug Set", category: 2, price: 199000, costPrice: 60000, stock: 150, sku: "HOME-002" },
    { name: "Orthopedic Memory Foam Pillow", category: 2, price: 550000, costPrice: 250000, stock: 80, sku: "HOME-003" },
    { name: "Aromatherapy Essential Oil Diffuser", category: 2, price: 350000, costPrice: 150000, stock: 100, sku: "HOME-004" },
    { name: "Non-Stick Frying Pan 28cm", category: 2, price: 420000, costPrice: 200000, stock: 40, sku: "HOME-005" },
    { name: "Robot Vacuum Cleaner", category: 2, price: 3500000, costPrice: 2000000, stock: 20, sku: "HOME-006" },
    
    { name: "Leather Wallet", category: 3, price: 299000, costPrice: 100000, stock: 0, sku: "ACCS-001" },
    { name: "Sunglasses Aviator", category: 3, price: 499000, costPrice: 180000, stock: 12, sku: "ACCS-002" },
    { name: "Canvas Tote Bag", category: 3, price: 150000, costPrice: 50000, stock: 200, sku: "ACCS-003" },
    { name: "Silver Pendant Necklace", category: 3, price: 750000, costPrice: 300000, stock: 35, sku: "ACCS-004" },
    { name: "Classic Wristwatch", category: 3, price: 1200000, costPrice: 500000, stock: 25, sku: "ACCS-005" },
    
    { name: "Running Shoes Pro", category: 4, price: 1299000, costPrice: 600000, stock: 50, sku: "SPRT-001" },
    { name: "Yoga Mat Premium", category: 4, price: 399000, costPrice: 150000, stock: 8, sku: "SPRT-002" },
    { name: "Adjustable Dumbbell Set", category: 4, price: 1800000, costPrice: 1000000, stock: 15, sku: "SPRT-003" },
    { name: "Resistance Bands Pack", category: 4, price: 150000, costPrice: 50000, stock: 120, sku: "SPRT-004" },
    { name: "Cycling Helmet Aerodynamic", category: 4, price: 650000, costPrice: 300000, stock: 45, sku: "SPRT-005" },
    
    { name: "Hydrating Facial Serum", category: 5, price: 350000, costPrice: 100000, stock: 150, sku: "BEAU-001" },
    { name: "Matte Liquid Lipstick", category: 5, price: 150000, costPrice: 40000, stock: 200, sku: "BEAU-002" },
    { name: "SPF 50 Sunscreen", category: 5, price: 250000, costPrice: 80000, stock: 300, sku: "BEAU-003" },
    { name: "Vitamin C Brightening Cream", category: 5, price: 450000, costPrice: 150000, stock: 85, sku: "BEAU-004" }
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
  console.log(`✅ Products created (${products.length})`);

  // Create 75 Customers (Indonesian + International mix)
  const names = [
    "Budi Santoso", "Siti Rahayu", "Agus Setiawan", "Sri Wahyuni", "Ahmad Hidayat", 
    "Dewi Lestari", "Hendra Gunawan", "Rina Amelia", "Eko Prasetyo", "Maya Putri",
    "Rizky Aditya", "Fitri Handayani", "Dimas Anggara", "Nurul Huda", "Dedi Kurniawan",
    "John Doe", "Jane Smith", "Michael Johnson", "Emily Brown", "Chris Williams", 
    "Jessica Jones", "David Garcia", "Sarah Miller", "James Davis", "Laura Rodriguez",
    "Intan Permatasari", "Fajar Nugroho", "Sari Indah", "Robert Martinez", "Linda Hernandez",
    "William Lopez", "Karen Gonzalez", "Richard Wilson", "Nancy Anderson", "Charles Thomas",
    "Lisa Taylor", "Joseph Moore", "Betty Jackson", "Thomas Martin", "Margaret Lee",
    "Christopher Perez", "Sandra Thompson", "Daniel White", "Ashley Harris", "Paul Sanchez",
    "Joko Anwar", "Ayu Ting Ting", "Raffi Ahmad", "Nagita Slavina", "Deddy Corbuzier",
    "Raisa Andriana", "Iqbaal Ramadhan", "Maudy Ayunda", "Reza Rahadian", "Tara Basro",
    "Kimberly Clark", "Mark Ramirez", "Donna Lewis", "Donald Robinson", "Michelle Walker",
    "George Young", "Carol Allen", "Kenneth King", "Amanda Wright", "Steven Scott",
    "Bambang Pamungkas", "Kevin Sanjaya", "Jonatan Christie", "Anthony Ginting", "Greysia Polii",
    "Melissa Torres", "Edward Nguyen", "Deborah Hill", "Brian Flores", "Stephanie Green"
  ];
  
  const cities = [
    "Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Tangerang",
    "Depok", "Bekasi", "Denpasar", "Bogor", "Malang", "Padang", "Yogyakarta", "Balikpapan",
    "Singapore", "Kuala Lumpur", "Bangkok", "Manila", "Ho Chi Minh City", "Sydney", "Melbourne",
    "Banjarmasin", "Pontianak", "Batam", "Samarinda", "Manado", "Mataram", "Kupang"
  ];

  const customers: Customer[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const segment = Math.random() > 0.8 ? "VIP" : (Math.random() > 0.4 ? "REGULAR" : "NEW");
    
    customers.push(
      await prisma.customer.create({
        data: {
          name,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          phone: `+62-81${Math.floor(Math.random() * 900000000) + 100000000}`,
          city,
          segment,
          lastOrderDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
          tenantId: defaultTenant.id,
        },
      })
    );
  }
  console.log(`✅ Customers created (${customers.length})`);

  // Create 200+ Orders
  const MONTHS = 3; // spread over 90 days
  const now = new Date();
  
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const statusRolls = () => {
    const r = Math.random();
    if (r < 0.70) return "DELIVERED";
    if (r < 0.85) return "SHIPPED";
    if (r < 0.95) return "PROCESSING";
    if (r < 0.98) return "PENDING";
    return "CANCELLED";
  };

  let orderSeq = 1000;
  const paymentMethods = ["CREDIT_CARD", "BANK_TRANSFER", "E_WALLET", "COD", "VIRTUAL_ACCOUNT"];

  for (let i = 0; i < 250; i++) {
    const customer = pick(customers);
    const channel = pick(Object.values(channels));
    const numItems = Math.floor(Math.random() * 4) + 1;
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

    // Random date in the last 90 days
    const orderDate = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000);
    const status = statusRolls();
    
    let paymentStatus = "PAID";
    if (status === "PENDING") paymentStatus = "UNPAID";
    if (status === "CANCELLED" && Math.random() > 0.5) paymentStatus = "REFUNDED";

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
        shippingAddress: `${Math.floor(Math.random() * 999) + 1} ${["Jl. Merdeka", "Jl. Sudirman", "Jl. Gatot Subroto", "Jl. Thamrin", "Jl. Asia Afrika", "Jl. Diponegoro"][Math.floor(Math.random() * 6)]}, ${customer.city}`,
        createdAt: orderDate,
        tenantId: defaultTenant.id,
        items: { create: items },
      },
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalSpent: { increment: grandTotal },
        totalOrders: { increment: 1 },
        lastOrderDate: orderDate > (customer.lastOrderDate || new Date(0)) ? orderDate : customer.lastOrderDate,
      },
    });
  }
  console.log(`✅ Orders created (${orderSeq - 1000})`);

  // Notifications
  const notificationTypes = ["order", "customer", "product", "revenue", "inventory", "discount", "campaign", "alert"];
  for (let i = 0; i < 25; i++) {
    const type = pick(notificationTypes);
    let title = "Notification";
    let description = "Description";
    if (type === "order") {
      title = `New order ${pick(["ORD-1042", "ORD-1150", "ORD-1201"])} received`;
      description = `Order value: Rp ${Math.floor(Math.random() * 2000) * 1000}`;
    } else if (type === "inventory") {
      title = `Low stock alert: ${pick(products).name}`;
      description = "Stock is below 5 units. Please restock soon.";
    } else if (type === "customer") {
      title = "New VIP Customer Segment unlocked";
      description = `${pick(customers).name} has reached VIP status.`;
    } else {
      title = `System ${type} update`;
      description = `Please check the ${type} dashboard for new updates.`;
    }

    await prisma.notification.create({
      data: {
        userId: admin.id,
        type,
        title,
        description,
        read: Math.random() > 0.5,
        createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      }
    });
  }
  console.log("✅ Notifications created (25)");

  // Discounts
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

  // Campaigns
  const campaignData = [
    { name: "Summer Sale 2026", description: "Big summer discounts across all categories", type: "SOCIAL", status: "ACTIVE", budget: 15000000, spent: 8200000, channel: "instagram" },
    { name: "New Product Launch", description: "Promoting new electronics line", type: "ADS", status: "ACTIVE", budget: 25000000, spent: 15000000, channel: "facebook" },
    { name: "Email Newsletter Q3", description: "Quarterly newsletter campaign", type: "EMAIL", status: "COMPLETED", budget: 5000000, spent: 4800000, channel: "email" },
    { name: "TikTok Influencer", description: "Collaboration with top influencers", type: "SOCIAL", status: "DRAFT", budget: 30000000, spent: 0, channel: "tiktok" },
    { name: "Google Ads Retargeting", description: "Retargeting campaign for cart abandoners", type: "ADS", status: "PAUSED", budget: 10000000, spent: 3500000, channel: "google" },
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

  // Inventory Records
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

  const activities = [
    { action: "LOGIN", details: "Admin logged in" },
    { action: "CREATE_ORDER", details: "New order ORD-1001 created" },
    { action: "UPDATE_PRODUCT", details: "Product stock updated" },
    { action: "CREATE_CAMPAIGN", details: "New campaign 'Summer Sale' created" },
  ];

  for (const a of activities) {
    await prisma.activityLog.create({
      data: { userId: admin.id, tenantId: defaultTenant.id, ...a },
    });
  }
  console.log("✅ Activity logs created");

  console.log("\n🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

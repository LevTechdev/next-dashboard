import { PrismaClient, type Product, type Customer, type SalesChannel } from "@prisma/client";
import { hash } from "bcryptjs";

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

  // Create Users
  const adminPassword = await hash("admin123", 10);
  const staffPassword = await hash("staff123", 10);

  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@dashboard.com", password: adminPassword, role: "ADMIN", position: "System Administrator", emailVerified: new Date() },
  });
  const manager = await prisma.user.create({
    data: { name: "Sarah Johnson", email: "sarah@dashboard.com", password: staffPassword, role: "MANAGER", position: "Sales Manager" },
  });
  const staff = await prisma.user.create({
    data: { name: "Mike Wilson", email: "mike@dashboard.com", password: staffPassword, role: "STAFF", position: "Sales Staff" },
  });

  console.log("✅ Users created");

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

  // Create Product Categories
  const categories = await Promise.all([
    prisma.productCategory.create({ data: { name: "Electronics", slug: "electronics" } }),
    prisma.productCategory.create({ data: { name: "Clothing", slug: "clothing" } }),
    prisma.productCategory.create({ data: { name: "Home & Living", slug: "home-living" } }),
    prisma.productCategory.create({ data: { name: "Accessories", slug: "accessories" } }),
    prisma.productCategory.create({ data: { name: "Sports", slug: "sports" } }),
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
        },
      })
    );
  }
  console.log("✅ Customers created");

  // Create Orders with items
  const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
  const paymentStatuses = ["PAID", "UNPAID", "REFUNDED"];
  const paymentMethods = ["CREDIT_CARD", "BANK_TRANSFER", "E_WALLET", "COD"];

  for (let i = 0; i < 25; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const channel = channels[Object.keys(channels)[Math.floor(Math.random() * Object.keys(channels).length)]];
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let totalAmount = 0;

    for (let j = 0; j < numItems; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const total = product.price * qty;
      totalAmount += total;
      items.push({ productId: product.id, name: product.name, quantity: qty, price: product.price, total });
    }

    const discountAmount = Math.random() > 0.7 ? totalAmount * 0.1 : 0;
    const shippingAmount = totalAmount > 500000 ? 0 : 25000;
    const taxAmount = totalAmount * 0.11;
    const grandTotal = totalAmount - discountAmount + shippingAmount + taxAmount;

    const orderDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);

    await prisma.order.create({
      data: {
        orderNumber: `ORD-${String(1000 + i).padStart(4, "0")}`,
        customerId: customer.id,
        userId: [admin.id, manager.id, staff.id][Math.floor(Math.random() * 3)],
        channelId: channel.id,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        totalAmount,
        discountAmount,
        shippingAmount,
        taxAmount,
        grandTotal,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
        shippingAddress: `${Math.floor(Math.random() * 999) + 1} ${["Jl. Merdeka", "Jl. Sudirman", "Jl. Gatot Subroto", "Jl. Thamrin"][Math.floor(Math.random() * 4)]}, ${customer.city}`,
        createdAt: orderDate,
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
  console.log("✅ Orders created");

  // Create Discounts
  const discountData = [
    { code: "WELCOME10", name: "Welcome 10% Off", type: "PERCENTAGE", value: 10, minPurchase: 0, maxUses: 100, startsAt: new Date("2025-01-01"), endsAt: new Date("2026-12-31"), usedCount: 45 },
    { code: "SALE50", name: "Flash Sale 50K", type: "FIXED", value: 50000, minPurchase: 200000, maxUses: 50, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), usedCount: 23 },
    { code: "FREESHIP", name: "Free Shipping", type: "FIXED", value: 25000, minPurchase: 300000, maxUses: 200, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), usedCount: 78 },
    { code: "VIP20", name: "VIP 20% Discount", type: "PERCENTAGE", value: 20, minPurchase: 1000000, maxUses: 30, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), usedCount: 12 },
    { code: "HOLIDAY15", name: "Holiday Special 15%", type: "PERCENTAGE", value: 15, minPurchase: 500000, maxUses: 0, startsAt: new Date("2025-12-01"), endsAt: new Date("2026-01-15"), usedCount: 67 },
  ];

  for (const d of discountData) {
    await prisma.discount.create({ data: d });
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
      data: { userId: admin.id, ...a },
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

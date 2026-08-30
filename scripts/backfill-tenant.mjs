import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Idempotent migration: ensure a default Tenant exists and every existing
 * tenant-scoped row without a tenant is assigned to it. Safe to run repeatedly.
 */
const tenant = await prisma.tenant.upsert({
  where: { slug: "default" },
  update: {},
  create: { name: "Default Workspace", slug: "default" },
});
console.log("default tenant:", tenant.id);

const data = { tenantId: tenant.id };
const where = { tenantId: null };
const u = await prisma.user.updateMany({ where, data });
const c = await prisma.customer.updateMany({ where, data });
const p = await prisma.product.updateMany({ where, data });
const o = await prisma.order.updateMany({ where, data });
const cat = await prisma.productCategory.updateMany({ where, data });
const disc = await prisma.discount.updateMany({ where, data });
const camp = await prisma.campaign.updateMany({ where, data });
console.log(
  `assigned → users:${u.count} customers:${c.count} products:${p.count} orders:${o.count} categories:${cat.count} discounts:${disc.count} campaigns:${camp.count}`,
);

await prisma.$disconnect();

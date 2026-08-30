import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const rows = await p.activityLog.findMany({
  where: { tenantId: null },
  orderBy: { createdAt: "desc" },
  take: 10,
  select: { action: true, entity: true, details: true, userId: true, createdAt: true },
});
for (const r of rows) {
  console.log(
    `${r.createdAt.toISOString()} | ${r.action} | ${r.entity ?? "-"} | user=${r.userId?.slice(0, 12) ?? "null"} | ${(r.details ?? "").slice(0, 60)}`,
  );
}
console.log("total null activity rows:", rows.length);

await p.$disconnect();

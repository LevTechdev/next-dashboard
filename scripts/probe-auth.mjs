import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true, totpEnabled: true, isActive: true, emailVerified: true, lockedUntil: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(JSON.stringify(users, null, 2));
} catch (e) {
  console.error("PROBE_ERROR:", e.message);
} finally {
  await prisma.$disconnect();
}

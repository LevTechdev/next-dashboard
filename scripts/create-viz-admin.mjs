import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const EMAIL = `viz-qa-${Date.now()}@codebuff-test.local`;
const PASSWORD = "VizOnly#2026!Qa";
// Same OWASP params as src/lib/auth.ts ARGON2_OPTS
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

try {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "default" } });
  const password = await hash(PASSWORD, OPTS);
  const user = await prisma.user.create({
    data: {
      name: "Visual QA (temp)",
      email: EMAIL,
      password,
      passwordAlgo: "argon2id",
      passwordChangedAt: new Date(),
      role: "ADMIN",
      isActive: true,
      emailVerified: new Date(),
      tenantId: tenant?.id ?? null,
    },
  });
  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, id: user.id }, null, 2));
} catch (e) {
  console.error("CREATE_ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

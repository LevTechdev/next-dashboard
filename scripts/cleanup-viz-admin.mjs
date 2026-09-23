import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  // Guard: only ever touch throwaway verification accounts on this domain.
  // API keys go first (their user relation is SetNull, which would orphan them).
  const qaUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@codebuff-test.local" } },
    select: { id: true },
  });
  const qaIds = qaUsers.map((u) => u.id);
  const deletedKeys =
    qaIds.length > 0
      ? await prisma.apiKey.deleteMany({ where: { userId: { in: qaIds } } })
      : { count: 0 };
  const deleted = await prisma.user.deleteMany({
    where: { email: { endsWith: "@codebuff-test.local" } },
  });
  console.log(
    JSON.stringify({ deletedUsers: deleted.count, deletedApiKeys: deletedKeys.count }, null, 2),
  );
} catch (e) {
  console.error("CLEANUP_ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

import "server-only";

import { prisma } from "@/lib/db";

/**
 * Resolve the database row behind an authenticated session.
 *
 * The token's subject id is tried first, then the token's email. The email step
 * is the important one: user ids are cuids that change whenever the database is
 * re-seeded while a browser still holds an older cookie. The id then matches no
 * row, but the email always identifies the same person.
 *
 * This replaces a per-route fallback to "the first admin". That fallback was
 * worse than it looked: mutations used `findFirst({ role: "ADMIN" }, orderBy
 * createdAt asc)` while reads used the same findFirst *without* the ordering,
 * so a profile write could land on one admin row while the page rendered
 * another — the intermittent "my changes don't save" bug. It also meant any
 * unrecognised session silently wrote its profile onto someone else's account.
 *
 * Callers must treat `null` as 404 rather than guessing at a user.
 */
export async function resolveSessionUserId(session: {
  user: { id?: string | null; email?: string | null };
}): Promise<string | null> {
  const id = session.user.id?.trim();
  if (id) {
    const byId = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (byId) return byId.id;
  }

  const email = session.user.email?.trim();
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) return byEmail.id;
  }

  return null;
}

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

/**
 * POST /api/customers/import
 * Bulk-creates customers from parsed CSV rows:
 * [{ name, email?, phone?, city?, country?, segment?, notes? }]
 * Rows without a name are reported back as skipped.
 */
export async function POST(req: Request) {
  const { response } = await requirePermission("create", "customers", req);
  if (response) return response;

  const body = await req.json();
  const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 rows per import" }, { status: 400 });
  }

  const validSegments = new Set(["VIP", "REGULAR", "NEW"]);
  let imported = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || "").trim();
    if (!name) {
      skipped.push({ row: i + 1, reason: "Missing name" });
      continue;
    }

    const segment = (row.segment || "").trim().toUpperCase();

    try {
      await prisma.customer.create({
        data: {
          name,
          email: row.email || null,
          phone: row.phone || null,
          city: row.city || null,
          country: row.country || null,
          segment: validSegments.has(segment) ? segment : "REGULAR",
          notes: row.notes || null,
        },
      });
      imported++;
    } catch {
      skipped.push({ row: i + 1, reason: "Database error" });
    }
  }

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: "IMPORT_CUSTOMERS",
      entity: "Customer",
      details: `Imported ${imported} customers (${skipped.length} skipped)`,
      userId: session.user.id,
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({ imported, skipped });
}

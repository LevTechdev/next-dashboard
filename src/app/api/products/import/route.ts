import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-guard";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * POST /api/products/import
 * Bulk-creates products from parsed CSV rows:
 * [{ name, price, costPrice?, stock?, sku?, category?, description? }]
 * Rows without a valid name/price are reported back as skipped.
 */
export async function POST(req: Request) {
  const { response } = await requirePermission("create", "products", req);
  if (response) return response;

  const body = await req.json();
  const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 rows per import" }, { status: 400 });
  }

  const categories = await prisma.productCategory.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  let imported = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || "").trim();
    const price = parseFloat(row.price);
    if (!name || isNaN(price)) {
      skipped.push({ row: i + 1, reason: "Missing name or invalid price" });
      continue;
    }

    let categoryId: string | null = null;
    const categoryName = (row.category || "").trim();
    if (categoryName) {
      const existing = categoryByName.get(categoryName.toLowerCase());
      if (existing) {
        categoryId = existing;
      } else {
        const created = await prisma.productCategory.create({
          data: { name: categoryName, slug: `${slugify(categoryName)}-${Date.now().toString(36)}` },
        });
        categoryByName.set(categoryName.toLowerCase(), created.id);
        categoryId = created.id;
      }
    }

    try {
      await prisma.product.create({
        data: {
          name,
          slug: `${slugify(name)}-${Date.now().toString(36)}${i}`,
          description: row.description || null,
          price,
          costPrice: parseFloat(row.costPrice) || 0,
          stock: parseInt(row.stock, 10) || 0,
          sku: row.sku || null,
          categoryId,
        },
      });
      imported++;
    } catch {
      skipped.push({ row: i + 1, reason: "Database error (duplicate slug or invalid data)" });
    }
  }

  const { session } = await requireAuth(req);
  await prisma.activityLog.create({
    data: {
      action: "IMPORT_PRODUCTS",
      entity: "Product",
      details: `Imported ${imported} products (${skipped.length} skipped)`,
      userId: session.user.id,
    },
  });

  return NextResponse.json({ imported, skipped });
}

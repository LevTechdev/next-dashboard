import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api-docs-openapi";

/**
 * Machine-readable OpenAPI 3.1 spec for the whole API surface, generated from
 * the same registry that drives the /docs/api explorer and code snippets.
 * Public by design — it describes the endpoints; it grants no access.
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(buildOpenApiDocument(), {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}

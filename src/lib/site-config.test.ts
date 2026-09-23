import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { EXTRA_PUBLIC_PATHS, MARKETING_PATHS } from "./site-config";

/**
 * Guard for the marketing route group ⇄ public-route list.
 *
 * `src/middleware.ts` derives the public paths from MARKETING_PATHS and sends
 * everything else to /login. A page added under `(marketing)` but missing from
 * that list therefore renders publicly-404s as a login redirect — the exact
 * bug that hid /careers after it shipped. This test makes both directions
 * explicit: the registry may not point at pages that do not exist, and a new
 * page may not appear without being registered (or declared protected below).
 */

const MARKETING_DIR = join(process.cwd(), "src", "app", "[locale]", "(marketing)");

/**
 * Pages under the (marketing) group that are intentionally NOT public.
 * Entries are prefixes (middleware matches the same way), so protecting
 * /docs also covers /docs/api.
 */
const PROTECTED_MARKETING_PAGES = [
  // Internal engineering docs — reachable from the dashboard, not the site.
  "/docs",
];

/** Everything middleware serves without a session. */
const PUBLIC_PATHS: readonly string[] = [...MARKETING_PATHS, ...EXTRA_PUBLIC_PATHS];

/** Route path ("" for the group index) → does a page.tsx exist for it? */
function pageExists(route: string): boolean {
  return existsSync(join(MARKETING_DIR, route, "page.tsx"));
}

/** Every route under the (marketing) group that renders a page.tsx. */
function marketingPageRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "__tests__") continue;
      const child = join(dir, entry.name);
      const route = `${prefix}/${entry.name}`;
      if (existsSync(join(child, "page.tsx"))) routes.push(route);
      walk(child, route);
    }
  };
  if (existsSync(join(MARKETING_DIR, "page.tsx"))) routes.push("");
  walk(MARKETING_DIR, "");
  return routes;
}

/** Mirrors middleware's `isPublicRoute` prefix matching. */
function isRegistered(route: string): boolean {
  return PUBLIC_PATHS.some((p) => (p === "" ? route === "" : route.startsWith(p)));
}

/** Prefix-aware equivalent of PROTECTED_MARKETING_PAGES. */
function isProtected(route: string): boolean {
  return PROTECTED_MARKETING_PAGES.some((p) => route === p || route.startsWith(`${p}/`));
}

describe("site-config · marketing paths", () => {
  it("points every registered public path at a real page", () => {
    const missing = MARKETING_PATHS.filter((p) => !pageExists(p));
    expect(missing, `registered but no page.tsx: ${missing.join(", ")}`).toEqual([]);
  });

  it("registers every marketing page as public (or marks it protected)", () => {
    const unregistered = marketingPageRoutes().filter(
      (route) => !isRegistered(route) && !isProtected(route),
    );
    expect(
      unregistered,
      `marketing pages without a public route (add to MARKETING_PATHS or PROTECTED_MARKETING_PAGES): ${unregistered.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps /careers public so the footer link never bounces to login", () => {
    expect(MARKETING_PATHS).toContain("/careers");
    expect(pageExists("/careers")).toBe(true);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Service-worker contract guard.
 *
 * Two failures this pins, both of which have already cost real debugging time
 * in this repo:
 *
 *  1. **A worker registered outside a production build.** `public/sw.js` serves
 *     scripts/styles/images cache-first and dev chunk URLs are stable across
 *     edits, so a worker running under `next dev` keeps executing the PREVIOUS
 *     build — the app looks like it ignored your edit (a phantom
 *     "MISSING_MESSAGE", a step that "isn't implemented"). Registration must
 *     therefore stay behind the `NODE_ENV === "development"` early return in
 *     src/components/pwa-register.tsx, and that file must be the only place
 *     that calls `register`.
 *
 *  2. **Awaiting `navigator.serviceWorker.ready`.** It never settles without a
 *     registration — it does not reject — so the caller hangs with nothing to
 *     catch. Registration is production-only, which makes "no worker" the
 *     normal case in dev. All lookups go through src/lib/service-worker.ts.
 *
 * This suite runs in the components job (`npm run test:components`), which is a
 * required CI job, so a regression fails the build rather than shipping.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SW_HELPER = join("src", "lib", "service-worker.ts");
const PWA_REGISTER = join("src", "components", "pwa-register.tsx");
const SW_FILE = join("public", "sw.js");

/** Every .ts/.tsx file the app ships (excludes tests and declarations). */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.d\.ts$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

const files = sourceFiles(join(ROOT, "src")).map((full) => ({
  path: relative(ROOT, full).split(sep).join("/"),
  text: readFileSync(full, "utf-8"),
}));

describe("service worker contract", () => {
  it("registers a worker from exactly one place", () => {
    const registrars = files
      .filter((f) => /serviceWorker\s*\.\s*register\s*\(/.test(f.text))
      .map((f) => f.path);

    expect(registrars).toEqual(["src/components/pwa-register.tsx"]);
  });

  it("gates registration behind the development early return", () => {
    const source = readFileSync(join(ROOT, PWA_REGISTER), "utf-8");

    const guard = source.indexOf('process.env.NODE_ENV === "development"');
    const register = source.indexOf("serviceWorker");
    expect(guard, "pwa-register.tsx lost its NODE_ENV development guard").toBeGreaterThan(-1);

    // The guard must come BEFORE the registration call, and must `return` so
    // the production branch is unreachable in dev.
    const registerCall = source.indexOf(".register(");
    expect(registerCall).toBeGreaterThan(guard);
    expect(source.slice(guard, registerCall)).toMatch(/return;/);
    expect(register).toBeGreaterThan(-1);

    // The guard also has to clean up: a dev browser with a worker from an
    // earlier session keeps serving stale chunks until it is unregistered.
    const guardBlock = source.slice(guard, registerCall);
    expect(guardBlock).toContain("getRegistrations");
    expect(guardBlock).toContain("unregister");
  });

  it("never awaits navigator.serviceWorker.ready (it cannot settle)", () => {
    const offenders = files
      .filter((f) => f.path !== SW_HELPER.split(sep).join("/"))
      // `.ready` is only dangerous when awaited/returned; a mention in a comment
      // explaining the trap is fine, so match the property access itself.
      .filter((f) => /serviceWorker\s*\.\s*ready/.test(f.text.replace(/\/\/.*$/gm, "")))
      .map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  it("keeps the worker's hard-won invariants", () => {
    const sw = readFileSync(join(ROOT, SW_FILE), "utf-8");

    // Authenticated API responses must never be cached: serving a previous
    // session's /api/auth/me is what caused the silent account-switch bug.
    expect(sw).toContain('request.url.includes("/api/")');
    const apiBranch = sw.indexOf('request.url.includes("/api/")');
    expect(sw.slice(apiBranch)).not.toMatch(/cache\.put/);

    // …and the cache version must be bumped whenever the strategy changes.
    expect(sw).toMatch(/const CACHE_NAME = "next-dashboard-v\d+"/);
  });
});

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Next resolves exactly ONE instrumentation hook: it collects candidates from
 * beside the app directory and keeps the last match, with no error for a
 * duplicate. A root-level copy is therefore silently ignored — which is how the
 * scheduler bootstrap and the QRIS ledger hook ended up sitting in a file that
 * never ran, while the compiled server bundle said `src_instrumentation_ts`.
 * These assertions keep startup work in the one file Next actually loads.
 */
const projectRoot = process.cwd();
const srcHookPath = path.join(projectRoot, "src", "instrumentation.ts");
const rootHookPath = path.join(projectRoot, "instrumentation.ts");
const nodeHookPath = path.join(projectRoot, "src", "instrumentation.node.ts");

describe("instrumentation hook", () => {
  it("exists in exactly one location, beside the app directory", () => {
    expect(existsSync(srcHookPath)).toBe(true);
    expect(existsSync(rootHookPath)).toBe(false);
  });

  it("imports the node-only startup dynamically, behind a runtime check", () => {
    const source = readFileSync(srcHookPath, "utf8");

    expect(source).toMatch(/NEXT_RUNTIME\s*!==\s*"nodejs"/);
    expect(source).toMatch(/await import\("\.\/instrumentation\.node"\)/);
    // A static Node import would be traced into the Edge bundle.
    expect(source).not.toMatch(/^import .*from "\.\/lib\/(scheduler|qris-ledger-store)"/m);
  });

  it("registers the ledger persistence and the scheduler for the node runtime", () => {
    const source = readFileSync(nodeHookPath, "utf8");

    expect(source).toContain("registerQrisLedgerPersistence()");
    expect(source).toContain("startScheduler()");
  });
});

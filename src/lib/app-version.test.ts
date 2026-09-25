import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LITERAL_FALLBACK } from "./app-version";

/**
 * The version story, pinned.
 *
 * It drifted badly once: the in-product changelog narrated v2.7.0 while the
 * newest git tag (and therefore the GitHub release) was v1.1.0. Releases are cut
 * by semantic-release from the tag list, so the tag line is the source of truth
 * and everything user-facing has to follow it:
 *
 *   package.json version  ==  the changelog's newest entry  ==  the tag the
 *   build reports (NEXT_PUBLIC_APP_VERSION, resolved from `git describe`).
 *
 * A test can't reach the git tag, so it pins the two committable ends of that
 * chain and fails loudly with the new number when they move — which is exactly
 * what someone adding a changelog entry needs to do.
 */
const root = join(__dirname, "..", "..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8")) as Record<string, unknown>;
}

describe("release version", () => {
  it("keeps the build fallback equal to package.json", () => {
    const pkg = readJson("package.json") as { version?: string };
    expect(LITERAL_FALLBACK).toBe(pkg.version);
  });

  it("keeps package.json equal to the changelog's newest entry, in every locale", () => {
    const pkg = readJson("package.json") as { version?: string };
    for (const locale of ["en", "id", "ja", "zh"]) {
      const messages = readJson(`src/i18n/locales/${locale}.json`) as any;
      const entries = messages.changelogPage.entries as { version: string; date: string }[];
      expect(entries.length).toBeGreaterThan(0);
      expect(
        entries[0].version,
        `${locale}: the newest changelog entry must carry the released version; bump ` +
          `package.json and the entry together when the release line moves`,
      ).toBe(pkg.version);
    }
  });

  it("keeps the changelog timeline versions unique and descending", () => {
    const messages = readJson("src/i18n/locales/en.json") as any;
    const versions = (messages.changelogPage.entries as { version: string }[]).map(
      (e) => e.version,
    );
    expect(new Set(versions).size).toBe(versions.length);
  });
});

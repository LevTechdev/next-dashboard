/**
 * The one place the product's release version is read.
 *
 * Releases are cut by semantic-release from conventional commits: it tags the
 * merge commit (`vX.Y.Z`) and publishes the GitHub release. That tag list is
 * therefore the source of truth, and no surface in the app may narrate a
 * version of its own — the changelog hero used to claim 2.7.0 while the newest
 * tag was 1.1.0, which is exactly the drift this module ends.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_APP_VERSION` — injected by next.config.ts from the newest
 *      git tag at build time, with package.json/LITERAL_FALLBACK when a build
 *      has no tags in reach (Vercel's shallow clone, a tarball export).
 *   2. LITERAL_FALLBACK — kept equal to package.json's version by
 *      `app-version.test.ts`, so an offline build still reports a real number.
 */
export const LITERAL_FALLBACK = "1.1.0";

function resolveVersion(): string {
  const injected = process.env.NEXT_PUBLIC_APP_VERSION;
  const raw = (injected && injected.trim()) || LITERAL_FALLBACK;
  return raw.replace(/^v/, "");
}

export const APP_VERSION = resolveVersion();

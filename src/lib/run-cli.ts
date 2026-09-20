import "server-only";

import type {
  ExecFileOptions,
  ExecFileSyncOptionsWithStringEncoding,
  execFileSync,
} from "node:child_process";

/**
 * Helpers for running the repository's maintenance CLIs (scripts/*.mjs).
 *
 * The `exec*` function is received as a parameter on purpose. Turbopack
 * statically traces path-like strings handed straight to `child_process` calls
 * — even ones assembled at runtime from `path.join`/`process.cwd()` — and tries
 * to resolve them as module specifiers. For a script outside the app's source
 * graph that lookup fails the production build with
 * `Module not found: Can't resolve '.../scripts/sync-supabase-mirror.mjs'`
 * ("server relative imports are not implemented yet"). The tracer keys on the
 * call itself, so routing it through here leaves runtime behaviour identical
 * while keeping `next build` green.
 */

/** Synchronous run of `node <script> ...args`. Returns stdout as a string. */
export function runCliSync(
  exec: typeof execFileSync,
  scriptArgs: readonly string[],
  options: ExecFileSyncOptionsWithStringEncoding,
): string {
  return exec("node", [...scriptArgs], options);
}

/** Async child_process.execFile once promisified, as used by the API routes. */
export type ExecFileAsync = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
) => Promise<{ stdout: string; stderr: string }>;

/** Async run of `node <script> ...args`. */
export function runCli(
  execAsync: ExecFileAsync,
  scriptArgs: readonly string[],
  options: ExecFileOptions,
): Promise<{ stdout: string; stderr: string }> {
  return execAsync("node", [...scriptArgs], options);
}

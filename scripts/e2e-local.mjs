/**
 * Local-DB E2E runner — the no-Supabase way to run the Playwright suite.
 *
 * The E2E suite normally targets the shared Supabase Postgres in `.env` /
 * `.env.local`. When that pooler is unreachable (or you simply don't want to
 * touch it), this script defaults the environment to the LOCAL
 * `nextdashboard` Postgres mirror with the mailer blanked, so:
 *
 *   - `globalSetup` seeds the LOCAL database (shell/process env wins over
 *     `.env` for Prisma and Next.js),
 *   - the register/forgot-password specs see the no-mailer dev contract
 *     (inline `data-testid="dev-otp"` and the forgot-password reset URL are
 *     only rendered when no mailer is configured), and
 *   - `AI_MOCK=1` keeps the copilot specs deterministic.
 *
 * Subcommands:
 *
 *   node scripts/e2e-local.mjs db            # provision the local mirror:
 *                                            #   reuse/launch Postgres →
 *                                            #   create the database →
 *                                            #   `prisma db push` the schema
 *   node scripts/e2e-local.mjs db --seed     # ...then also `npm run db:seed`
 *   node scripts/e2e-local.mjs test [...]    # run the Playwright suite
 *   node scripts/e2e-local.mjs dev [...]     # dev server with the same env
 *
 * The whole fallback from a clean machine is one command:
 *
 *   npm run db:provision:local && npm run test:e2e:local
 *
 * `db` is IDEMPOTENT: a Postgres already listening on the target host:port is
 * reused (Docker is only consulted when nothing listens there — and only for
 * localhost targets); `CREATE DATABASE` tolerates "already exists";
 * `prisma db push` is a no-op once the schema is in sync.
 *
 * Any variable already set in your shell WINS over the defaults below, so you
 * can still point at a different database or keep a real provider key (not
 * recommended for the auth specs).
 */
import { spawnSync } from "node:child_process";
import net from "node:net";
import process from "node:process";

const LOCAL_DB_URL = "postgresql://postgres:postgres@localhost:5432/nextdashboard";
const DEFAULT_PG_CONTAINER = "next-dashboard-e2e-pg";

/** The DATABASE_URL this run targets (shell override wins). */
function targetDbUrl() {
  return process.env.DATABASE_URL || LOCAL_DB_URL;
}

function buildEnv() {
  const env = { ...process.env };
  // Local Postgres mirror for both the pooled (DATABASE_URL) and direct
  // (DIRECT_URL) Prisma connections.
  if (!process.env.DATABASE_URL) env.DATABASE_URL = LOCAL_DB_URL;
  if (!process.env.DIRECT_URL) env.DIRECT_URL = targetDbUrl();
  // Blank the mailer so the dev-OTP / reset-URL contract is active. Empty
  // strings still override `.env.local` (Next.js does not overwrite an env
  // var that is already defined in the process).
  for (const key of ["RESEND_API_KEY", "SMTP_HOST", "EMAIL_TRANSPORT"]) {
    if (process.env[key] === undefined) env[key] = "";
  }
  // Deterministic copilot specs (see docs/e2e-run.md).
  if (!process.env.AI_MOCK) env.AI_MOCK = "1";
  return env;
}

/** TCP-probe host:port; resolves true when something accepts the connection. */
function isPostgresUp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/** Poll until Postgres accepts connections (Docker containers take a beat). */
async function waitUntilPostgresUp(host, port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPostgresUp(host, port, 1000)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function run(bin, args, opts = {}) {
  // Windows needs a shell to resolve npx/npm.cmd; the args passed through
  // here are relative paths / flags (no spaces), so quoting is not a concern.
  return spawnSync(bin, args, {
    stdio: opts.capture ? "pipe" : "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
}

/**
 * Make sure a Postgres is listening on the target host:port. Reuses anything
 * already there (native install, an existing container, a dev server);
 * launches a `postgres:16` Docker container only when nothing listens AND the
 * target is localhost AND the Docker daemon is up.
 */
async function ensurePostgres(dbUrl) {
  const url = new URL(dbUrl);
  const host = url.hostname;
  const port = Number(url.port || 5432);

  if (await isPostgresUp(host, port)) {
    console.log(`[e2e-local:db] Postgres already listening at ${host}:${port} — reusing it`);
    return;
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal) {
    console.error(
      `[e2e-local:db] Nothing listens at ${host}:${port} and it is not localhost — ` +
        `start that Postgres or point DATABASE_URL elsewhere.`,
    );
    process.exit(1);
  }

  const docker = spawnSync("docker", ["info"], {
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  if (docker.status !== 0) {
    console.error(
      `[e2e-local:db] Nothing listens at ${host}:${port} and the Docker daemon is not running.\n` +
        `[e2e-local:db] Start Postgres or Docker, then re-run this command.`,
    );
    process.exit(1);
  }

  const name = process.env.E2E_PG_CONTAINER || DEFAULT_PG_CONTAINER;
  console.log(`[e2e-local:db] launching Postgres container "${name}" on :${port}...`);
  // Reuse a stopped container with the same name; create it if missing.
  let started = run("docker", ["start", name], { capture: true });
  if (started.status !== 0) {
    started = run(
      "docker",
      [
        "run",
        "-d",
        "--name",
        name,
        "-e",
        "POSTGRES_PASSWORD=postgres",
        "-p",
        `${port}:5432`,
        "postgres:16",
      ],
      { capture: true },
    );
  }
  if (started.status !== 0) {
    console.error(started.stderr?.toString() || started.stdout?.toString() || "docker run failed");
    process.exit(1);
  }

  if (!(await waitUntilPostgresUp(host, port))) {
    console.error(`[e2e-local:db] container "${name}" never became reachable on ${host}:${port}`);
    process.exit(1);
  }
  console.log(`[e2e-local:db] Postgres container "${name}" is ready`);
}

/**
 * Create the target database if missing, via `prisma db execute` against the
 * server's admin database. `CREATE DATABASE` cannot run in a DO block, so
 * idempotency comes from tolerating the duplicate_database error.
 */
function ensureDatabase(dbUrl) {
  const url = new URL(dbUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) {
    console.error(`[e2e-local:db] DATABASE_URL has no database name: ${dbUrl}`);
    process.exit(1);
  }
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = "/postgres";

  console.log(`[e2e-local:db] ensuring database "${dbName}" exists...`);
  const result = run(
    "npx",
    ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
    {
      input: `CREATE DATABASE "${dbName}";\n`,
      env: { ...buildEnv(), DATABASE_URL: adminUrl.toString(), DIRECT_URL: adminUrl.toString() },
      capture: true,
    },
  );
  if (result.status !== 0) {
    const err = `${result.stderr?.toString() ?? ""}${result.stdout?.toString() ?? ""}`;
    if (/already exists/i.test(err)) {
      console.log(`[e2e-local:db] database "${dbName}" already exists`);
      return;
    }
    console.error(err || "prisma db execute failed");
    process.exit(1);
  }
  console.log(`[e2e-local:db] created database "${dbName}"`);
}

/** Push the Prisma schema (idempotent — a no-op once in sync). */
function pushSchema(env) {
  console.log("[e2e-local:db] pushing schema (prisma db push)...");
  const result = run("npx", ["prisma", "db", "push", "--skip-generate"], { env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const command = process.argv[2] ?? "test";
const extraArgs = process.argv.slice(3);

if (command === "db") {
  const dbUrl = targetDbUrl();
  await ensurePostgres(dbUrl);
  ensureDatabase(dbUrl);
  const env = buildEnv();
  pushSchema(env);
  if (extraArgs.includes("--seed")) {
    console.log("[e2e-local:db] seeding (npm run db:seed)...");
    const result = run("npm", ["run", "db:seed"], { env });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(`[e2e-local:db] ready — next: npm run test:e2e:local (or npm run dev:local)`);
  process.exit(0);
}

const env = buildEnv();
console.log(`[e2e-local] DATABASE_URL=${env.DATABASE_URL}`);
console.log(`[e2e-local] DIRECT_URL=${env.DIRECT_URL}`);
console.log(`[e2e-local] mailer keys blanked, AI_MOCK=${env.AI_MOCK}`);
console.log(`[e2e-local] running: ${command}${extraArgs.length ? ` ${extraArgs.join(" ")}` : ""}`);

let bin;
let args;
if (command === "dev") {
  bin = "npm";
  args = ["run", "dev", ...extraArgs];
} else {
  bin = "npx";
  args = ["playwright", "test", ...extraArgs];
}

const result = run(bin, args, { env });
process.exit(result.status ?? 1);

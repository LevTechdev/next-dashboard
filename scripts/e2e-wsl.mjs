#!/usr/bin/env node
/**
 * One-command live E2E runner for a Windows host with WSL 2.
 *
 * Unlike `test:e2e:local` (which reuses the shared local Postgres mirror), this
 * runner is disposable and self-contained:
 *
 *   1. start a throwaway PostgreSQL 16 cluster inside WSL (user-owned data dir,
 *      no system service or root access required),
 *   2. create the schema and start Next dev on a free Windows port with a
 *      private `NEXT_DIST_DIR`, so it can run beside another dev server,
 *   3. run Playwright against that app (globalSetup seeds the fresh database),
 *   4. stop the app, stop Postgres, and remove the throwaway data directory.
 *
 * Usage:
 *
 *   npm run test:e2e:wsl
 *   npm run test:e2e:wsl -- e2e/login.spec.ts
 *   npm run test:e2e:wsl -- e2e/login.spec.ts --workers=1
 *
 * Optional environment overrides:
 *   E2E_WSL_DISTRO=Ubuntu          WSL distribution
 *   E2E_WSL_APP_PORT=3020          first app port to try
 *   E2E_WSL_DB_PORT=55440          first Postgres port to try
 *   E2E_WSL_PG_BIN=/usr/lib/...    PostgreSQL bin directory
 *   E2E_WSL_READY_TIMEOUT_MS=...   startup/health timeout (default 300000)
 *
 * Requirements inside WSL: PostgreSQL 16 server binaries (`initdb`, `pg_ctl`,
 * `psql`). On Ubuntu these come from `postgresql-16`; the runner finds them
 * under /usr/lib/postgresql/<version>/bin.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DISTRO = process.env.E2E_WSL_DISTRO || "Ubuntu";
const APP_PORT_START = Number(process.env.E2E_WSL_APP_PORT || 3020);
const DB_PORT_START = Number(process.env.E2E_WSL_DB_PORT || 55440);
const PG_BIN = process.env.E2E_WSL_PG_BIN || "/usr/lib/postgresql/16/bin";
const READY_TIMEOUT_MS = Number(process.env.E2E_WSL_READY_TIMEOUT_MS || 300_000);
const PLAYWRIGHT_ARGS = process.argv.slice(2);
const KEEP_ON_FAILURE = process.env.E2E_WSL_KEEP === "1";

if (process.platform !== "win32") {
  console.error(
    "[e2e-wsl] This runner is for Windows hosts with WSL 2. " +
      "Use `npm run test:e2e:local` on Linux/macOS.",
  );
  process.exit(1);
}

let appChild = null;
let appLogPath = null;
let keepaliveChild = null;
let pgDataDir = null;
let pgStarted = false;
let cleanedUp = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** Run a bash script inside the configured WSL distribution. */
function runWsl(script, { capture = true, stdio = "pipe" } = {}) {
  return spawnSync("wsl.exe", ["-d", DISTRO, "--", "bash", "-lc", script], {
    encoding: "utf8",
    stdio: capture ? "pipe" : stdio,
    windowsHide: true,
  });
}

function logWslFailure(label, result) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output) console.error(`[e2e-wsl] ${label}:\n${output}`);
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try {
        server.close();
      } catch {
        /* already closed */
      }
      resolve(ok);
    };
    server.once("error", () => finish(false));
    server.listen({ port, host: "0.0.0.0", exclusive: true }, () => finish(true));
  });
}

function wslPortInUse(port) {
  // `ss` is present on Ubuntu; if it is unavailable, let the bind probe decide.
  const result = runWsl(`ss -ltn 2>/dev/null | grep -qE '[:.]${port}([[:space:]]|$)'`);
  return result.status === 0;
}

async function findFreePort(start, label) {
  for (let port = start; port < start + 100; port += 1) {
    if ((await canListen(port)) && !wslPortInUse(port)) return port;
  }
  throw new Error(`could not find a free ${label} port in ${start}-${start + 99}`);
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return true;
    await sleep(500);
  }
  return false;
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return true;
    } catch {
      /* server still compiling or not listening yet */
    }
    if (appChild && appChild.exitCode !== null) return false;
    await sleep(1000);
  }
  return false;
}

function printAppLogTail() {
  if (!appLogPath) return;
  try {
    const lines = readFileSync(appLogPath, "utf8").split(/\r?\n/);
    console.error(`[e2e-wsl] Last app log lines (${appLogPath}):`);
    console.error(lines.slice(-80).join("\n"));
  } catch {
    /* no log available */
  }
}

function killTree(pid) {
  if (!pid) return;
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
  });
}

function printPostgresLogs(dataDir) {
  const log = runWsl(`
cat ${shellQuote(`${dataDir}/initdb.log`)} ${shellQuote(`${dataDir}/pgctl.log`)} ${shellQuote(`${dataDir}/postgres.log`)} 2>/dev/null | tail -80 || true
`);
  if (log.stdout?.trim()) console.error(log.stdout.trim());
}

async function startPostgres(port) {
  pgDataDir = `/tmp/next-dashboard-e2e-pg-${Date.now()}-${process.pid}`;
  const dataDir = pgDataDir;

  // Redirect Postgres/pg_ctl's stdio away from the WSL process pipes. Without
  // this, the daemon can keep the captured pipe open and make spawnSync wait
  // forever even though the server is already accepting connections.
  const init = runWsl(`
set -euo pipefail
PG_BIN=${shellQuote(PG_BIN)}
if [ ! -x "$PG_BIN/initdb" ]; then
  echo "PostgreSQL server binaries were not found at $PG_BIN." >&2
  echo "Install PostgreSQL 16 in WSL or set E2E_WSL_PG_BIN to its bin directory." >&2
  exit 127
fi
"$PG_BIN/initdb" -D ${shellQuote(dataDir)} -U postgres --auth=trust --encoding=UTF8 --no-locale </dev/null >${shellQuote(`${dataDir}/initdb.log`)} 2>&1
`);
  if (init.status !== 0) {
    logWslFailure("Postgres initdb failed", init);
    printPostgresLogs(dataDir);
    throw new Error("could not initialize the disposable WSL PostgreSQL cluster");
  }

  const start = runWsl(`
set -euo pipefail
PG_BIN=${shellQuote(PG_BIN)}
"$PG_BIN/pg_ctl" -D ${shellQuote(dataDir)} -o "-p ${port} -h 127.0.0.1 -k /tmp" -l ${shellQuote(`${dataDir}/postgres.log`)} -w -t 60 start </dev/null >>${shellQuote(`${dataDir}/pgctl.log`)} 2>&1
`);
  if (start.status !== 0) {
    logWslFailure("Postgres start failed", start);
    printPostgresLogs(dataDir);
    throw new Error("could not start the disposable WSL PostgreSQL cluster");
  }
  pgStarted = true;

  const create = runWsl(`
set -euo pipefail
PG_BIN=${shellQuote(PG_BIN)}
"$PG_BIN/psql" -h 127.0.0.1 -p ${port} -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE nextdashboard;'
`);
  if (create.status !== 0) {
    logWslFailure("Postgres database creation failed", create);
    printPostgresLogs(dataDir);
    throw new Error("could not create the disposable E2E database");
  }

  if (!(await waitForPort("127.0.0.1", port, 30_000))) {
    throw new Error(
      `WSL PostgreSQL did not become reachable on 127.0.0.1:${port}. ` +
        "Check that WSL localhost forwarding is enabled.",
    );
  }
  console.log(`[e2e-wsl] disposable Postgres ready on 127.0.0.1:${port}`);
}

function stopPostgres() {
  if (!pgDataDir) return;
  if (pgStarted) {
    const result = runWsl(`
set +e
PG_BIN=${shellQuote(PG_BIN)}
[ -x "$PG_BIN/pg_ctl" ] && "$PG_BIN/pg_ctl" -D ${shellQuote(pgDataDir)} -m fast -w -t 30 stop
`);
    if (result.status !== 0) {
      logWslFailure("Postgres stop warning", result);
      return;
    }
  }
  const result = runWsl(`rm -rf ${shellQuote(pgDataDir)}`);
  if (result.status !== 0) logWslFailure("Postgres cleanup warning", result);
  pgStarted = false;
  pgDataDir = null;
}

function startApp(port, env) {
  const logDir = path.join(ROOT, ".tmp");
  mkdirSync(logDir, { recursive: true });
  appLogPath = path.join(logDir, `e2e-wsl-app-${port}.log`);
  rmSync(appLogPath, { force: true });
  const logStream = createWriteStream(appLogPath, { flags: "a" });

  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  appChild = spawn(process.execPath, [nextBin, "dev", "-p", String(port), "-H", "0.0.0.0"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  appChild.stdout.pipe(logStream);
  appChild.stderr.pipe(logStream);
  console.log(`[e2e-wsl] Next dev starting on http://localhost:${port}`);
}

function stopApp() {
  if (appChild && appChild.exitCode === null) {
    killTree(appChild.pid);
  }
  appChild = null;
}

async function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;

  stopApp();
  if (pgDataDir && KEEP_ON_FAILURE && process.exitCode !== 0) {
    console.error(
      `[e2e-wsl] E2E_WSL_KEEP=1: leaving Postgres data at ${pgDataDir}; ` +
        `stop it with pg_ctl -D ${pgDataDir} -m fast stop`,
    );
  } else {
    stopPostgres();
  }

  if (keepaliveChild && keepaliveChild.exitCode === null) {
    killTree(keepaliveChild.pid);
  }
  keepaliveChild = null;
}

async function main() {
  const probe = runWsl("command -v bash >/dev/null && echo ready");
  if (probe.status !== 0) {
    logWslFailure(`WSL distribution "${DISTRO}" is not available`, probe);
    console.error(
      `[e2e-wsl] WSL probe status=${probe.status} signal=${probe.signal ?? "none"} ` +
        `error=${probe.error ? String(probe.error) : "none"}`,
    );
    throw new Error(`WSL distribution "${DISTRO}" is not available; set E2E_WSL_DISTRO.`);
  }

  const dbPort = await findFreePort(DB_PORT_START, "Postgres");
  const appPort = await findFreePort(APP_PORT_START, "Next.js");
  console.log(`[e2e-wsl] selected clean ports: app=${appPort}, postgres=${dbPort}`);

  // Keep the WSL VM alive while the disposable server runs, even if this is the
  // only WSL command in the session.
  keepaliveChild = spawn("wsl.exe", ["-d", DISTRO, "--", "bash", "-lc", "exec sleep infinity"], {
    stdio: "ignore",
    windowsHide: true,
  });

  await startPostgres(dbPort);

  const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/nextdashboard`;
  const appUrl = `http://localhost:${appPort}`;
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl,
    DIRECT_URL: dbUrl,
    NEXTAUTH_URL: appUrl,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "e2e-wsl-secret",
    JWT_SECRET: process.env.JWT_SECRET || "e2e-wsl-secret",
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
    E2E_PORT: String(appPort),
    E2E_LOGIN_THROTTLE_LIMIT: "500",
    AI_MOCK: "1",
    // Force the no-mailer dev contract used by the OTP/reset specs.
    RESEND_API_KEY: "",
    SMTP_HOST: "",
    EMAIL_TRANSPORT: "",
  };

  console.log("[e2e-wsl] pushing schema...");
  const push = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--skip-generate",
    ],
    { cwd: ROOT, env, stdio: "inherit", windowsHide: true },
  );
  if (push.status !== 0) {
    throw new Error("prisma db push failed");
  }

  // A second `next dev` must never share `.next` with the primary dev server.
  rmSync(path.join(ROOT, ".next-e2e"), { recursive: true, force: true });
  startApp(appPort, env);

  const ready = await waitForHttp(`${appUrl}/en/login`, READY_TIMEOUT_MS);
  if (!ready) {
    printAppLogTail();
    throw new Error(`Next dev did not become ready at ${appUrl}/en/login`);
  }
  console.log(`[e2e-wsl] app ready at ${appUrl}`);

  // Playwright's webServer has reuseExistingServer enabled locally. Deleting CI
  // makes that explicit even when the caller's shell exports CI=1; the app was
  // started above and must be reused, not replaced.
  const testEnv = { ...env };
  delete testEnv.CI;
  const playwright = spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules", "@playwright", "test", "cli.js"), "test", ...PLAYWRIGHT_ARGS],
    { cwd: ROOT, env: testEnv, stdio: "inherit", windowsHide: true },
  );

  process.exitCode = playwright.status ?? 1;
  if (process.exitCode !== 0) printAppLogTail();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    console.error(`\n[e2e-wsl] ${signal} received; cleaning up...`);
    cleanup().finally(() => process.exit(130));
  });
}

main()
  .catch((error) => {
    console.error(`[e2e-wsl] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(cleanup);

# Running the E2E suite

Playwright config: `playwright.config.ts` (specs in `e2e/`, dev server on
port **3010**, 2 workers, `globalSetup` seeds the DB once per run).

## Prerequisites

None for the local runner beyond the project install — `npm run db:provision:local`
sets up the Postgres mirror (reusing or launching one) and pushes the schema.
Running bare `npm run test:e2e` instead additionally needs:

- Postgres running on `DATABASE_URL` (from `.env.local`).
- Prisma client generated + schema pushed: `npx prisma db push && npx prisma generate`.
- The seed admin `nextdashboards@gmail.com` / `admin123` (created by the
  `globalSetup` seed — no manual `npm run db:seed` needed).

## Run

```bash
# Recommended: local Postgres mirror with the mailer blanked — no Supabase,
# no env setup (DATABASE_URL/DIRECT_URL → local mirror, AI_MOCK=1 automatic).
# Provision the mirror first if you haven't (idempotent):
npm run db:provision:local
npm run test:e2e:local

# …a single spec (args pass through after --):
npm run test:e2e:local -- e2e/register.spec.ts

# Alternative: run against the shared Supabase pooler from .env.local
# (needs AI_MOCK=1 — see the next section):
npm run test:e2e
```

See the [Local-DB fallback](#local-db-fallback-supabase-pooler-unreachable)
section for why the local runner is the default and everything it sets.

## AI_MOCK=1 (bare `npm run test:e2e` only)

`npm run test:e2e:local` sets `AI_MOCK=1` automatically — this section only
applies to bare `npm run test:e2e`. The copilot specs assert the **dev-mode
mock reply** ("dev-mode mock reply", the header badge). Without `AI_MOCK=1`,
a real provider key (if set) makes them hit Gemini/OpenAI instead — slow and
non-deterministic. CI sets `AI_MOCK=1`; local runs must too:

```bash
AI_MOCK=1 npm run test:e2e
```

## Warm-server reuse

The config has `reuseExistingServer: !CI`, so a dev server already listening
on **3010** is reused instead of spawned. If you're already running
`npm run dev` (e.g. for the Preview tab), Playwright will use it — make sure
it was started with the same environment the suite expects (`npm run dev:local`
for the local runner, or `AI_MOCK=1` for bare runs), or the copilot and
auth-OTP specs behave differently than configured.

## Recovering from a crashed server

A dev server that dies mid-run can corrupt `.next`, leaving every route
serving 404s while the port still answers — the failure signature is
"playwright says 200 but the page is a Next.js 404" (and the AI copilot
"never replies" because the mock is down). Recover:

```bash
# 1. Confirm the port is held and kill the stale process (Windows: taskkill)
netstat -ano | grep ":3010" | grep LISTEN
# 2. Clear the corrupted build cache
rm -rf .next
# 3. Restart with the local-runner env, then re-run
npm run dev:local > /tmp/dev.log 2>&1 &
npm run test:e2e:local
```

Never run two `next dev` instances on the same `.next` — they corrupt each
other. If a second server is unavoidable, give it its own `-p` port and
`.next` dir.

## Local-DB fallback (Supabase pooler unreachable)

The suite targets the shared Supabase Postgres in `.env` / `.env.local`. When
that pooler is unreachable (TLS handshake hangs, `db:seed` fails with
`P1001`), every spec that touches the DB times out — the marketing/auth-UI
pages still render, but `globalSetup` cannot seed and logins stall.The fallback is to run the suite against a **local Postgres mirror** (the
`nextdashboard` database used throughout this repo's E2E work) with the
mailer blanked. `npm run test:e2e:local` (and `npm run dev:local`) set the
whole environment — DATABASE_URL/DIRECT_URL point at the local mirror,
`RESEND_API_KEY`/`SMTP_HOST`/`EMAIL_TRANSPORT` are blanked, and `AI_MOCK=1` —
via `scripts/e2e-local.mjs`:

The whole fallback from a clean machine is one command — the `db` subcommand
(`npm run db:provision:local`) reuses any Postgres already listening on the
target, falls back to launching a `postgres:16` Docker container only when
nothing listens on localhost:5432, creates the `nextdashboard` database
(tolerating "already exists"), and pushes the schema:

```bash
# 1. One-time provisioning (idempotent — safe to re-run any time):
npm run db:provision:local

#    …optionally with the seed admin data:
npm run db:provision:local -- --seed

# 2. Run the suite against the local DB. Shell/process env wins over .env
#    for Prisma, so globalSetup seeds the LOCAL database automatically.
npm run test:e2e:local

# …a single spec (args pass through after --):
npm run test:e2e:local -- e2e/register.spec.ts
```

Prefer to provision by hand? The equivalent steps:

```bash
docker run -d --name next-dashboard-e2e-pg \
  -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker exec next-dashboard-e2e-pg createdb -U postgres nextdashboard
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nextdashboard" npx prisma db push
```

Two gotchas make the script's defaults important:

- **The mailer is blanked on purpose.** The register/forgot-password specs
  rely on the no-mailer dev contract: the inline dev OTP
  (`data-testid="dev-otp"`) and the forgot-password reset URL are only
  rendered when no mailer is configured (`isDevFallbackAllowed()` in
  `src/lib/email.ts`). If `.env.local` sets `RESEND_API_KEY` / `SMTP_HOST`
  (or `EMAIL_TRANSPORT=resend`), those fallbacks are hidden and the OTP-flow
  specs hang. Empty-string env vars still override `.env.local` — Next.js
  does not overwrite an env var that is already defined in the process. (The
  Resend call is also bounded by a 10s timeout in `email.ts`, so a mailer
  outage can no longer stall the register API for ~30s — but the specs still
  need the fallback *visible*.)
- **A warm dev server on 3010 is reused as-is** (`reuseExistingServer`). If
  you started `npm run dev` against the remote pooler, tests will seed the
  local DB but hit the remote one through the reused server. When the pooler
  is down, (re)start the dev server with the same local env:

  ```bash
  npm run dev:local
  ```

Any variable already set in your shell overrides the script's defaults, so
pointing at a different database or a real provider key is still one export
away.

## Notes

- `npm run test:e2e` runs `npx playwright test`; the `--list` count-check
  (`Total: 106 tests`) used by CI skips `globalSetup` and needs no DB.
- After a full run, `npm run check:audit-chain` verifies the tamper-evident
  security-event chain (CI runs it post-suite).
- CI runs this exact flow: `.github/workflows/e2e-local.yml` executes
  `npm run db:provision:local` (exercising the runner's Docker branch on a
  clean runner) followed by `npm run test:e2e:local` on every push/PR,
  alongside the existing service-container job (`e2e.yml`).

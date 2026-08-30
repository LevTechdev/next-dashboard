# Running the E2E suite

Playwright config: `playwright.config.ts` (specs in `e2e/`, dev server on
port **3010**, 2 workers, `globalSetup` seeds the DB once per run).

## Prerequisites

- Postgres running on `DATABASE_URL` (from `.env.local`).
- Prisma client generated + schema pushed: `npx prisma db push && npx prisma generate`.
- The seed admin `admin@dashboard.com` / `admin123` (created by the
  `globalSetup` seed — no manual `npm run db:seed` needed).

## Run

```bash
npm run db:seed            # optional — globalSetup re-seeds anyway
npm run test:e2e
```

## AI_MOCK=1 is required

The copilot specs assert the **dev-mode mock reply** ("dev-mode mock reply",
the header badge). Without `AI_MOCK=1`, a real provider key (if set) makes
them hit Gemini/OpenAI instead — slow and non-deterministic. CI sets
`AI_MOCK=1`; local runs must too:

```bash
AI_MOCK=1 npm run test:e2e
```

## Warm-server reuse

The config has `reuseExistingServer: !CI`, so a dev server already listening
on **3010** is reused instead of spawned. If you're already running
`npm run dev` (e.g. for the Preview tab), Playwright will use it — make sure
it was started with `AI_MOCK=1`, or the copilot specs behave as real-provider
runs.

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
# 3. Restart WITH the mock, then re-run
AI_MOCK=1 npm run dev > /tmp/dev.log 2>&1 &
AI_MOCK=1 npm run test:e2e
```

Never run two `next dev` instances on the same `.next` — they corrupt each
other. If a second server is unavoidable, give it its own `-p` port and
`.next` dir.

## Notes

- `npm run test:e2e` runs `npx playwright test`; the `--list` count-check
  (`Total: 77 tests`) used by CI skips `globalSetup` and needs no DB.
- After a full run, `npm run check:audit-chain` verifies the tamper-evident
  security-event chain (CI runs it post-suite).

# Scheduler jobs — quota digest, auto-payout, webhook retry

Three periodic jobs run inside the Next.js node process. They are registered
once at server boot by `instrumentation.ts` → `src/lib/scheduler.ts` and can
also be triggered manually through admin API routes or a small script.

## How scheduling works

- **In-app tick loop** (`src/lib/scheduler.ts`): a 5-minute heartbeat checks
  each job's schedule. Jobs only run when `SCHEDULER_ENABLED=1` **or**
  `NODE_ENV=production`, so `npm run dev` never emails anyone or moves money.
  Set `SCHEDULER_ENABLED=1` in `.env.local` to exercise them locally.
- **Vercel cron** (`vercel.json`): a daily 02:00 UTC entry hits
  `/api/usage/digest?secret=${CRON_SECRET}` as an external trigger. The
  endpoint is idempotent with the in-app loop (one digest per day, keyed by
  the dedup registry), so both can be active at once.

## Jobs

| Job             | Schedule                        | Engine                          | Side effects |
|-----------------|---------------------------------|---------------------------------|--------------|
| `usage-digest`  | Daily at 02:00 server time      | `src/lib/usage-digest.ts`       | In-app notification + email (Resend) to workspace owners when any metric crosses 80%/100% |
| `auto-payout`   | Hourly evaluation, monthly execution | `src/lib/affiliate-auto-payout.ts` | Creates one SCHEDULED payout per calendar cycle when available commission ≥ threshold |
| `webhook-retry` | Every 5-minute tick (due sweep) | `src/lib/webhook-retry.ts`      | Re-dispatches RETRYING DLQ entries; promotes to terminal FAILED after 5 attempts |
| `auto-reorder`  | Hourly (with auto-payout)       | `src/lib/inventory-auto-reorder.ts` | Drafts DRAFT purchase orders for active products at/below their velocity-based reorder point (cooldown 7 days per product) |

## Configuration

| Env var                     | Default        | Meaning |
|-----------------------------|----------------|---------|
| `SCHEDULER_ENABLED`         | off in dev     | `1` enables the in-app loop outside production |
| `CRON_SECRET`               | —              | Required by `/api/usage/digest?secret=…`; generate with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `AUTO_PAYOUT_THRESHOLD_USD` | `500`          | Available-commission level that triggers the monthly payout |
| `AUTO_PAYOUT_RATIO`         | `1`            | Fraction of available balance committed (0.1–1, clamped); e.g. `0.5` pays half |
| `AUTO_REORDER_MIN_RISK`     | `WARNING`      | Minimum stockout risk that triggers a draft PO (`CRITICAL` drafts only for critical items) |
| `AUTO_REORDER_COOLDOWN_DAYS`| `7`            | Minimum days between auto-drafted POs for the same product |
| `RESEND_API_KEY`            | —              | When absent, digest emails log instead of sending |

## Manual runs

### HTTP (admin session)

```bash
# 1. Mint a token (seed admin)
TOKEN=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nextdashboards@gmail.com","password":"admin123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

# 2. Preview the auto-payout decision (no side effects)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3010/api/affiliates/auto-payout

# 3. Execute it (add &force=1 to bypass the once-per-cycle guard)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3010/api/affiliates/auto-payout?force=1"

# 4. Run the quota digest right now
curl -s "http://localhost:3010/api/usage/digest?secret=$CRON_SECRET"

# 5. DLQ operations (Integrations → Delivery health does the same via UI)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"sweep"}' http://localhost:3010/api/webhooks/inbound/dlq

# 6. Draft POs for products at/below reorder point (status DRAFT, no send)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3010/api/inventory/auto-reorder
```

`POST /api/webhooks/inbound/dlq` actions: `sweep` (process all due retries),
`retry` (one entry now), `replay` (requeue a FAILED entry), `discard`
(terminal dismissal).

### Script (any Node REPL / `npx tsx`)

```ts
import { runSchedulerJob } from "@/lib/scheduler";

await runSchedulerJob("usage-digest");  // { owners, sent }
await runSchedulerJob("auto-payout");   // { triggered, reason, payout? }
await runSchedulerJob("webhook-retry"); // { processed, retried, promoted }
```

## State & idempotency

- `data/auto-payout-cycle.json` — last executed cycle (`YYYY-MM`); the guard
  makes reboots and duplicate ticks harmless. Delete the file (or use
  `?force=1`) to re-run within a cycle.
- `data/auto-payouts.json` — persisted payout registry; merged into
  `GET /api/affiliates/payouts` so every route bundle sees the same ledger.
- `data/webhook-dlq.json` — DLQ entries with `retryCount`, `nextRetryAt`,
  and `status` (`FAILED` | `RETRYING` | `RESOLVED`).
- `data/auto-reorder-ledger.json` — productId → last auto-draft timestamp
  (the per-product cooldown guard).
- `data/scheduler-runs.json` — last execution (time/outcome/result) per job,
  rendered by Settings → Scheduler health (`GET /api/scheduler/status`).
- Backoff: 5 min base, doubles per attempt, capped at 30 min; `MAX_ATTEMPTS`
  is 5, after which the entry is terminal until a human replays or discards.

## Verifying

- Unit tests: `npx vitest run --config vitest.components.config.ts src/lib/__tests__/scheduler-jobs.test.ts`
- Live probe: the manual HTTP calls above; the payouts tab
  (`/en/affiliates` → Payouts & Disbursements) shows new SCHEDULED rows, and
  Integrations → Delivery health reflects retry sweeps.

# Preview run doc — next-dashboard

How to reproduce the uncommitted artifacts a fresh worktree needs and how to
run the dev server for the live Preview tab.

## Reproduce artifacts

The app needs env files, installed dependencies, and a Prisma client + DB
schema in sync. This workspace IS the main checkout, so the env files are
already present — no copying needed. On a fresh worktree:

1. Copy the env files from the main checkout:
   `copy .env .env.local` (never commit their values).
2. Install dependencies with npm: `npm ci` (the `postinstall` hook runs
   `npx prisma generate`).
3. Sync the Prisma schema to the local Postgres and regenerate the client —
   required for the order-fulfillment fields (`processingAt`, `shippedAt`,
   `deliveredAt`, `refundedAt`, `trackingNumber`, `carrier`):
   `npx prisma db push && npx prisma generate`
4. Seed the database (idempotent demo data; the E2E specs assume the seed
   admin `admin@dashboard.com` / `admin123`): `npm run db:seed`
   (Postgres must be running on `DATABASE_URL` from `.env.local`).

## Run the server

Default port is **3010** (`npm run dev` = `next dev -p 3010`).

- Start: `npm run dev`
- Expected: Next.js dev server prints `Local: http://localhost:3010` and
  responds on that URL. Logs go to stdout (redirect to a file when detached).
- The AI copilot answers with the dev-mode mock reply when `OPENAI_API_KEY`
  is unset (or `AI_MOCK=1`), so the panel is usable without a provider key.
- Stop: kill the `node.exe`/`npm` process holding port 3010.

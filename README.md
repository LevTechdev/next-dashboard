# Next Dashboard
# next-dashboard
=======
# Next Dashboard

A full-featured admin dashboard built with [Next.js](https://nextjs.org) 16, featuring real-time data, internationalization, and comprehensive test coverage.

## Badges

<p>
  <img src="https://img.shields.io/badge/lib%20coverage-100%25-brightgreen" alt="Library Coverage 100%" />
  <img src="https://img.shields.io/badge/branch%20coverage-97%25-brightgreen" alt="Branch Coverage 97%" />
  <img src="https://img.shields.io/badge/UI%20coverage-30%25-orange" alt="Component Coverage" />
  <img src="https://img.shields.io/badge/API%20coverage-93%25-brightgreen" alt="API Coverage 93%" />
  <img src="https://img.shields.io/badge/tests-857%20passing-brightgreen" alt="857 Tests Passing" />
</p>

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19)
- **Database:** SQLite via Prisma ORM
- **Auth:** Auth0 (Next.js SDK)
- **Styling:** Tailwind CSS 3.4
- **i18n:** next-intl (English + Indonesian)
- **Testing:** Vitest + Testing Library
- **Charts:** Recharts
- **UI:** Radix UI primitives + Framer Motion

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) to view the dashboard.

## Environment Variables

Copy the commented vars from `.env` into your environment as needed. Key ones:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite/Postgres connection string |
| `JWT_SECRET` | ✅ (prod) | Secret for signing auth JWTs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google login | Google OAuth (see `src/app/api/auth/google/`) |
| `GOOGLE_REDIRECT_URI` | for Google login | OAuth redirect URI (defaults to `http://localhost:3010/api/auth/google/callback`) |
| `PII_ENCRYPTION_KEY` | ✅ (prod) | AES-256-GCM key (64 hex chars) for encrypted customer PII |
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | for AI Copilot | Gemini API key for the dashboard Copilot panel (`/api/ai/chat`) — **preferred provider** (model `gemini-flash-latest` by default, override with `GEMINI_MODEL`); `GOOGLE_GENERATIVE_AI_API_KEY` is what the Google AI SDK reads, `GEMINI_API_KEY` is the alias the route checks |
| `OPENAI_API_KEY` | for AI Copilot | OpenAI API key — fallback provider when no Gemini key is set; in dev, the route falls back to an instant mock reply when no provider key is configured |
| `AI_MOCK` | optional | Set `1` to force the dev-mode mock Copilot even when a provider key is set (demos/tests/CI — CI sets this so E2E runs are deterministic without a provider key) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | optional | PostHog product analytics (see `src/components/analytics/posthog-provider.tsx`) |
| `STRIPE_SECRET_KEY` | for billing | Stripe secret key — enables Checkout + Customer Portal on the billing page (see `src/lib/stripe.ts`) |
| `STRIPE_WEBHOOK_SECRET` | for billing | `whsec_...` for verifying Stripe events at `POST /api/billing/webhook` |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ENTERPRISE` | for billing | Stripe recurring Price IDs for the Pro/Enterprise plans (the seed reads them; without them paid checkout is disabled with a clear 503) |
| `NEXT_PUBLIC_APP_URL` | optional | Public origin used for Checkout success/cancel + portal return URLs (defaults to the request origin) |
| `SAML_SP_ISSUER` | for SSO | SAML Service Provider issuer for the SSO page (defaults to `next-dashboard`) |
| `AFFILIATE_HEADLESS` | optional | Enables the headless-browser path for affiliate link imports |
| `SMTP_HOST` | for email | SMTP server hostname — enables the SMTP transport (preferred; see below) |
| `SMTP_PORT` | for email | SMTP port (default `587`, or `465` with `SMTP_SECURE=true`) |
| `SMTP_SECURE` | for email | `true`/`1` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | for email | SMTP credentials (omit for open relays) |
| `RESEND_API_KEY` | for email | Resend API key — fallback transport when no `SMTP_HOST` is set |
| `EMAIL_FROM` | for email | Verified sender, e.g. `Dashboard <no-reply@yourdomain.com>` (defaults to Resend's test sender) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional | OpenTelemetry traces endpoint |
| `SIEM_WEBHOOK_URL` / `SIEM_WEBHOOK_TOKEN` | optional | Real-time forwarding of security audit events |

**Email transport priority:** `SMTP_HOST` (your own server/relay via nodemailer) → `RESEND_API_KEY` (Resend) → dev console fallback. Every new account is issued a 6-digit email OTP at signup and must verify it from the Security Center; verification and password-reset emails go through this chain.

**Email without any mailer configured:** verification links, reset links, and OTP codes are logged to the server console and returned in the API response (dev mode only) — this is what the E2E suite relies on.

**AI Copilot:** `/api/ai/chat` uses Gemini (`GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`, model `gemini-flash-latest` by default — Google's stable alias for the newest flash line (currently gemini-3.7-flash); the retired 2.x flash models (`gemini-2.0-flash` / `gemini-2.5-flash`) 404, and specific 3.x preview names each have their own free-tier daily quota, so the alias is a safer default; set `GEMINI_MODEL` to override, e.g. `gemini-3-flash-preview`) with OpenAI (`OPENAI_API_KEY`) as a fallback. When no provider key is configured the route falls back to an instant canned mock reply in every non-production environment — local dev, tests, and preview/staging deploys (Vercel `VERCEL_ENV=preview`, or `APP_ENV=staging`); `AI_MOCK=1` forces the mock anywhere, which is how CI keeps E2E runs deterministic without a provider key. Mock replies are flagged with an `X-AI-Mock` response header, and the Copilot panel shows a subtle "dev mode" badge in its header when a reply came from the mock. In real production a missing key returns a 503 with a clear error instead of a generic failure.

**Stripe billing:** the billing page gates Free/Pro/Enterprise plans. The Free plan ($0) switches directly; Pro/Enterprise go through Stripe Checkout (`POST /api/billing/checkout`), and the Stripe Customer Portal is wired for payment methods/invoices/subscription management (`POST /api/billing/portal`). A webhook at `POST /api/billing/webhook` keeps the local subscription/invoice rows in sync (`checkout.session.completed`, `customer.subscription.updated/deleted`). In dev, run `stripe listen --forward-to localhost:3010/api/billing/webhook` and set `STRIPE_WEBHOOK_SECRET` to the printed `whsec_...`. Without `STRIPE_SECRET_KEY` the routes return 503 with a clear error so the page still works (Free plan only).

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (port 3010) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Unit tests (lib/) |
| `npm run test:components` | Component tests |
| `npm run test:api` | API integration tests |
| `npm run test:all` | All tests (sequential) |
| `npm run coverage:all` | All tests with coverage + merged report |
| `npm run coverage:merge` | Merge existing coverage reports |

## Helper & Tooling Scripts

The `npm run` scripts below wrap the one-shot helpers in [`scripts/`](scripts/). They are grouped by prefix and safe to re-run — the i18n mergers only add missing keys and the icon fixer only adds missing `size` props.

### `i18n:*` — locale key mergers

Adds missing translation keys to all 4 locale files (`en`, `id`, `zh`, `ja`) without overwriting existing translations.

| Command | Description |
|---|---|
| `npm run i18n:affiliate` | Merge affiliate-marketing keys (`nav.affiliates` + `affiliates` namespace) |
| `npm run i18n:keys` | Merge detail-page, password-reset, invoice-download, and CSV-import keys |
| `npm run i18n:image-features` | Merge image-manager / fetch-tier / headless-toggle keys |
| `npm run i18n:image` | Merge product-image-gallery keys |
| `npm run i18n:import` | Merge URL-importer keys |
| `npm run i18n:add-all` | Run all five i18n mergers in sequence |

### `db:*` — database maintenance

| Command | Description |
|---|---|
| `npm run db:generate` | Generate the Prisma client from `prisma/schema.prisma` |
| `npm run db:push` | Push schema changes to the database without a migration |
| `npm run db:seed` | Seed the database with demo data |
| `npm run db:studio` | Open Prisma Studio to browse and edit data |
| `npm run db:backfill-tenant` | Backfill tenant IDs for records created before multi-tenancy |
| `npm run db:encrypt-pii` | Encrypt customer PII fields in place (one-shot migration helper) |

### `shopee:*` — Shopee Open Platform

| Command | Description |
|---|---|
| `npm run shopee:oauth` | OAuth helper — authorize the app and obtain/refresh access tokens |
| `npm run shopee:test` | Live Shopee Open Platform API round-trip test (requires `SHOPEE_*` env credentials) |

### `icons:*` — icon-size audit & codemod

| Command | Description |
|---|---|
| `npm run icons:scan` | Scan for `lucide-animated` icons missing an explicit `size` prop (read-only) |
| `npm run icons:fix` | Codemod: add explicit `size={N}` to icons that only have Tailwind classes |
| `npm run icons:fix-dry` | Preview what `icons:fix` would change without writing anything |

## Test Structure

Tests are organized by scope, each with its own Vitest config and coverage thresholds:

| Suite | Config | Files | Coverage | Threshold |
|---|---|---|---|---|
| Unit | `vitest.config.ts` | `src/lib/**` | 100% stmts | 90% stmts / 80% branches |
| Components | `vitest.components.config.ts` | `src/components/**` | 30% stmts | 30% stmts |
| API | `vitest.api.config.ts` | `src/app/api/**` | 93% stmts | 85% stmts |
| **Merged** | — | All | 72% stmts | — |

Run `npx vitest run --config vitest.api.config.ts --coverage` for any individual suite, or use `npm run coverage:all` to run everything and generate a unified HTML report at `coverage/merged-report/index.html`.

## CI/CD

GitHub Actions runs on every push/PR to `main`:

1. **Lint** — ESLint
2. **TypeScript** — `tsc --noEmit`
3. **Test** — Unit tests with coverage
4. **Test (Components)** — Component tests with coverage
5. **Test (API)** — API integration tests with coverage
6. **Coverage Merge** — Combines all 3 coverage reports, generates unified HTML
7. **Build** — Production build

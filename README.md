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

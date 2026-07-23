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

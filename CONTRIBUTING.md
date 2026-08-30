# Contributing to Next Dashboard

Thank you for your interest in contributing! This guide covers how to set up your development environment, write commits that trigger automatic releases, and navigate the CI/CD pipeline.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Coding Conventions](#coding-conventions)
4. [Commit Conventions](#commit-conventions)
5. [Release Workflow](#release-workflow)
6. [Pull Request Process](#pull-request-process)
7. [Testing Guidelines](#testing-guidelines)
8. [Internationalization (i18n)](#internationalization-i18n)
9. [Premium Design System](#premium-design-system)

---

## Development Setup

### Prerequisites

- **Node.js** 20+ (see `.nvmrc`)
- **npm** 10+
- **Git**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/LevTechdev/next-dashboard.git
cd next-dashboard

# Install dependencies (uses --legacy-peer-deps via .npmrc)
npm install

# Set up the database
npm run db:push
npm run db:seed

# Start the development server
npm run dev        # → http://localhost:3010
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3010) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Unit tests (lib/) |
| `npm run test:components` | Component tests |
| `npm run test:api` | API integration tests |
| `npm run test:all` | All tests (sequential) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run coverage:all` | All tests with merged coverage report |
| `npm run storybook` | Storybook dev server (port 6006) |
| `npm run doctor` | React Doctor diagnostics |

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (dashboard)/     # Authenticated dashboard routes
│   │   │   ├── billing/
│   │   │   ├── settings/
│   │   │   └── design-tokens/
│   │   └── (marketing)/     # Public marketing routes
│   │       └── pricing/
│   ├── api/                 # Next.js API routes
│   └── globals.css          # Global styles + premium design tokens
├── components/
│   ├── ui/                  # Reusable UI primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── shimmer-button.tsx
│   │   ├── faq-accordion.tsx
│   │   └── ...
│   ├── layout/              # Sidebar, header, nav
│   └── ...                  # Feature components
├── hooks/                   # Custom React hooks
├── i18n/
│   └── locales/             # Translation files (en.json, id.json)
├── lib/                     # Utilities, DB, auth helpers
└── stories/                 # Storybook documentation stories
```

---

## Coding Conventions

### TypeScript

- Strict mode enabled — avoid `any` where possible
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal types
- All new files should have complete type annotations on exported symbols

### React

- Use **Server Components** by default (no `"use client"` unless you need hooks, event handlers, or browser APIs)
- Client components should be leaf nodes as much as possible
- Use `cn()` from `@/lib/utils` for conditional class merging
- Import animation variants from `@/components/motion` (e.g., `AnimateSection`, `AnimateUp`, `buttonTap`)

### CSS

- Prefer Tailwind utilities for layout and spacing
- Complex animations and premium effects go in `src/app/globals.css` as `@layer components`
- Theme transitions use CSS custom properties defined in `:root` and `.dark`
- New premium classes should follow the existing naming pattern (`.vengeance-*`, `.gradient-*`, `.glow-*`, `.fb-*`)

### SCSS/CSS Classes

- Use the project's premium CSS classes where applicable: `dashboard-card`, `stat-card-premium`, `vengeance-card`, `vengeance-glass`, `glow-border`, `badge-premium`, `double-bezel`, etc.
- See [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) for the full reference.

---

## Commit Conventions

This project uses **Conventional Commits** to automatically determine version bumps and generate changelogs via [semantic-release](https://semantic-release.gitbook.io/).

### Format

```
<type>: <short description>

[optional body]

[optional footer(s)]
```

### Types & Release Rules

| Type | Release | Description | Example |
|------|---------|-------------|---------|
| `feat` | **minor** | A new feature | `feat: add user avatar upload` |
| `fix` | **patch** | A bug fix | `fix: correct date formatting in dashboard` |
| `perf` | **patch** | Performance improvement | `perf: optimize database query pagination` |
| `docs` | **patch** | Documentation only | `docs: add API reference for billing endpoints` |
| `refactor` | **patch** | Code restructuring | `refactor: extract pricing card component` |
| `style` | **patch** | Formatting, whitespace | `style: reorder imports in globals.css` |
| `chore` | **no release** | Tooling, config | `chore: update eslint config` |
| `test` | **no release** | Adding/updating tests | `test: add pricing page unit tests` |
| `ci` | **no release** | CI/CD changes | `ci: add release workflow` |

### Breaking Changes

To trigger a **major** version bump, add `BREAKING CHANGE:` in the commit body or footer:

```
feat: redesign auth flow

BREAKING CHANGE: The authentication API has been rewritten. 
Old tokens are no longer valid.
```

You can also use the `breaking` type (which maps to `major`):

```
breaking: drop Node.js 18 support
```

### Examples

```bash
# Good — triggers a minor release
git commit -m "feat: redesign pricing page with billing period tabs"

# Good — triggers a patch release
git commit -m "fix: resolve theme transition flash on page load"

# Good — no release triggered
git commit -m "chore: update .npmrc with legacy-peer-deps"

# Good — breaking change
git commit -m "feat: migrate to new payment provider

BREAKING CHANGE: Stripe integration replaced. Webhook endpoints have changed."
```

---

## Release Workflow

This project uses [semantic-release](https://semantic-release.gitbook.io/) for fully automated releases. The process is:

### How Releases Work

```
Developer → pushes commit(s) to main
    ↓
GitHub Actions CI runs (lint → typecheck → tests → build)
    ↓
If all jobs pass, the release job fires:
    ├─ Analyzes commits since last tag
    ├─ Determines version bump (major/minor/patch)
    ├─ Updates CHANGELOG.md
    ├─ Creates GitHub Release
    ├─ Bumps version in package.json
    └─ Commits changes back to main [skip ci]
```

### Release Configuration

All release settings live in `.releaserc.json`:

| Plugin | Role |
|--------|------|
| `@semantic-release/commit-analyzer` | Reads commit messages → determines version |
| `@semantic-release/release-notes-generator` | Builds release notes with emoji sections |
| `@semantic-release/changelog` | Prepends new entries to CHANGELOG.md |
| `@semantic-release/github` | Creates GitHub Release with changelog asset |
| `@semantic-release/git` | Commits CHANGELOG.md + package.json back |

### What to Expect

- Every push to `main` with conventional commits triggers a potential release
- The release job **waits** for lint, typecheck, all test suites, and build to pass
- E2E tests run in parallel but **do not block** the release
- The CHANGELOG is auto-generated — never edit it manually
- Commit messages from semantic-release include `[skip ci]` to prevent CI loops

### Local Dry-Run

```bash
# Preview what would be released without actually publishing
npx semantic-release --dry-run --no-ci
```

---

## Pull Request Process

1. **Create a branch** from `main` with a descriptive name:
   ```
   feat/add-billing-period-tabs
   fix/theme-transition-bug
   docs/update-contributing-guide
   ```

2. **Commit** using conventional commit format (see above).

3. **Open a PR** against `main` with a clear title and description.

4. **CI checks** must pass before merging:
   - ✅ Lint
   - ✅ TypeScript
   - ✅ Tests
   - ✅ Build

5. **Merge** via squash merge to keep history clean.

> **Note:** The PR itself won't trigger a release — only pushes to `main` do. After merging, squash your commits into one conventional commit message so the merge commit triggers the correct version bump.

---

## Testing Guidelines

### Test Suites

| Suite | Config | What to Test | Coverage Target |
|-------|--------|-------------|-----------------|
| **Unit** | `vitest.config.ts` | Lib utilities, helpers, pure functions | 90%+ |
| **Components** | `vitest.components.config.ts` | UI components, interactions | 30%+ |
| **API** | `vitest.api.config.ts` | API routes, middleware, auth | 85%+ |
| **E2E** | `playwright.config.ts` | Critical user flows | — |

### Writing Tests

- Place tests next to the file they test in `__tests__/` directories
- Use `@testing-library/react` for component tests
- Mock external dependencies (DB, auth) with Vitest's `vi.mock()`
- Use the project's test utilities in `src/test-utils/`

### Running Tests

```bash
npm test                        # Unit tests only
npm run test:components         # Component tests only
npm run test:api                # API tests only
npm run test:all                # All tests
npm run test:e2e                # Playwright E2E tests
npm run coverage:all            # All tests + merged coverage report
```

---

## Internationalization (i18n)

This project uses [next-intl](https://next-intl-docs.vercel.app/) for internationalization.

### Adding a New Locale

1. Add the locale to the `locales` array in `src/i18n/routing.ts`:
   ```ts
   export const routing = defineRouting({
     locales: ["en", "id", "zh", "ja"],  // add your locale here
     defaultLocale: "en",
   });
   ```

2. Create a new JSON file in `src/i18n/locales/` (e.g., `fr.json`).

3. Translate all keys from `en.json` into the target language.

### Using Translations in Components

```tsx
import { useTranslations } from "next-intl";

function MyComponent() {
  const t = useTranslations("pricing");
  return <h1>{t("title")}</h1>;
}
```

### Translation Keys

Translations are organized by namespace (e.g., `pricing`, `billing`, `dashboard`). Each namespace corresponds to the first segment of the key passed to `useTranslations()`:

```json
{
  "pricing": {
    "title": "Plans That",
    "monthly": "Monthly",
    "yearly": "Yearly"
  }
}
```

```tsx
const t = useTranslations("pricing");
t("title")     // → "Plans That"
t("monthly")   // → "Monthly"
```

---

## Premium Design System

This project includes a premium design system built on top of shadcn/ui with:

- **Vengeance UI** classes (`.vengeance-card`, `.vengeance-glass`)
- **21st.dev-inspired** classes (`.gradient-border-card`, `.spotlight-card`, `.badge-premium`)
- **Dashboard components** with animated counters, glass headers, and interactive particles
- **Full dark mode** with smooth theme transitions
- **Framer Motion** animation variants (see `src/components/motion.tsx`)

For the complete reference, see [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) and the Storybook stories:

```bash
npm run storybook   # → http://localhost:6006
```

---

## Need Help?

- Open an issue on [GitHub](https://github.com/LevTechdev/next-dashboard/issues)
- Check the [CHANGELOG.md](./CHANGELOG.md) for recent changes
- Review [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) for the premium design system reference

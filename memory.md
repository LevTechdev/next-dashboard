# Project Memory: Next Dashboard

> Last updated: 2026-07-14
> Framework: Next.js 16 (App Router, React 19)
> Database: SQLite via Prisma ORM
> Styling: Tailwind CSS 3.4
> i18n: next-intl (English + Indonesian)
> Testing: Vitest + Testing Library (jsdom)
> Charts: Recharts
> UI: Radix UI + Framer Motion + Lucide Icons
> Analytics: PostHog

---

## 1. Architecture Decisions

### Authentication — Custom JWT (verified 2026-07-14)
- **Custom JWT auth is live** (NOT Auth0, NOT mock). Earlier "Auth0 removed / all public/mock" notes were inaccurate and have been corrected.
- `@/lib/auth.ts` — real auth core: `hashPassword`/`verifyPassword` (bcryptjs), `signToken`/`verifyToken` (jsonwebtoken, 7d expiry), token extraction from `Authorization: Bearer` header or `token` cookie.
- `@/lib/api-guard.ts` — real `requireAuth()`/`requirePermission()`: verifies JWT, returns 401 when token is missing/invalid, extracts `role` for permission checks. Does NOT blanket-grant ADMIN.
- `@/hooks/use-auth.tsx` — real `AuthProvider` context: `login`, `register`, `logout`, `refreshUser`, `updateUser`, `isAuthenticated`, plus 2FA (`requires2FA`) support. Calls `/api/auth/*`.
- `@/lib/auth0.ts` — legacy stub kept only to satisfy stray imports (`getSession` returns `null`); not part of the active auth path.
- `src/app/api/auth/` — 9 active routes: `login`, `register`, `logout`, `me`, `google` + `google/callback` (OAuth), `totp/setup`, `totp/verify`, `totp/disable`.
- **Auth-protected API routes returning 401 is correct behavior** when no valid JWT is supplied — it is not a bug.

### i18n Setup
- **Locales**: `en` (English), `id` (Indonesian)
- **Default locale**: `en`
- **Locale detection**: Enabled (via `Accept-Language` header)
- **Middleware**: Excludes `/api/`, `/_next/`, `/favicon`, `/icon`, `/apple-icon`, `/manifest.json`, and paths with file extensions
- **Route groups**: `(marketing)` and `(dashboard)` within `[locale]`

### Manifest & PWA
- `manifest.ts` generates manifest at `/manifest.webmanifest`
- Icons generated via `icon.tsx` (32×32) and `apple-icon.tsx` (180×180) using `next/og` ImageResponse
- Service worker at `/sw.js`

---

## 2. Features Built

### Marketing Pages
| Route | File | Status |
|---|---|---|
| `/` → `/en` (landing) | `[locale]/(marketing)/page.tsx` | ✅ Enhanced with micro-interactions |
| `/en/features` | `[locale]/(marketing)/features/page.tsx` | ✅ |
| `/en/pricing` | `[locale]/(marketing)/pricing/page.tsx` | ✅ |
| `/en/changelog` | `[locale]/(marketing)/changelog/page.tsx` | ✅ |
| `/en/integrations-overview` | `[locale]/(marketing)/integrations-overview/page.tsx` | ✅ |

### Landing Page Features (Enhanced)
- **Asymmetric Split Hero** — LightPillar 3D background, magnetic CTA buttons, animated trust metrics
- **Metrics Carousel** — Infinite scroll animation with 6 metrics (12.4K Orders, 99.9% Uptime, etc.)
- **Bento Grid Features** — 4 feature cards with hover glow overlay, perpetual pulse indicators, mouse-tracking radial gradients
- **Live Status Card** — Rotating notification badge (AnimatePresence), pulsing status indicators
- **Growth Stats Card** — Revenue, Orders, Conversion, Avg. Order metrics
- **Priority Queue** — Auto-shuffling item list with popLayout animation
- **Testimonials** — 2 testimonial cards with quote SVGs
- **Bottom CTA** — "Ready for scale." with double-bezel container and Access Workspace button

### Dashboard Pages
| Route | File | Status |
|---|---|---|
| `/en/dashboard` | `[locale]/(dashboard)/page.tsx` | ✅ |
| `/en/analytics` | `[locale]/(dashboard)/analytics/page.tsx` | ✅ |
| `/en/orders` | `[locale]/(dashboard)/orders/page.tsx` | ✅ |
| `/en/products` | `[locale]/(dashboard)/products/page.tsx` | ✅ |
| `/en/customers` | `[locale]/(dashboard)/customers/page.tsx` | ✅ |
| `/en/team` | `[locale]/(dashboard)/team/page.tsx` | ✅ |
| `/en/roles` | `[locale]/(dashboard)/roles/page.tsx` | ✅ |
| `/en/billing` | `[locale]/(dashboard)/billing/page.tsx` | ✅ |
| `/en/discounts` | `[locale]/(dashboard)/discounts/page.tsx` | ✅ |
| `/en/marketing` | `[locale]/(dashboard)/marketing/page.tsx` | ✅ |
| `/en/inventory` | `[locale]/(dashboard)/inventory/page.tsx` | ✅ |
| `/en/integrations` | `[locale]/(dashboard)/integrations/page.tsx` | ✅ |
| `/en/notifications` | `[locale]/(dashboard)/notifications/page.tsx` | ✅ |
| `/en/profile` | `[locale]/(dashboard)/profile/page.tsx` | ✅ |
| `/en/reports` | `[locale]/(dashboard)/reports/page.tsx` | ✅ |
| `/en/sales` | `[locale]/(dashboard)/sales/page.tsx` | ✅ |
| `/en/settings` | `[locale]/(dashboard)/settings/page.tsx` | ✅ |
| `/en/audit-log` | `[locale]/(dashboard)/audit-log/page.tsx` | ✅ |

---

## 3. Hooks

| Hook | File | Purpose |
|---|---|---|
| `useAuth()` | `src/hooks/use-auth.tsx` | Real JWT auth context: `{ user, isLoading, error, isAuthenticated, login, register, logout, refreshUser, updateUser }` |
| `useAnalytics()` | `src/hooks/use-analytics.ts` | PostHog analytics: `capture()`, `trackCTA()`, `trackFeatureInteraction()`, `trackLanguageSwitch()`, `trackScrollDepth()` |
| `useRealtimeData<T>(url, options)` | `src/hooks/use-realtime-data.ts` | Polling hook: `{ data, loading, error, lastUpdated, isRefreshing, refresh }` |
| `useSaas(userId?)` | `src/hooks/use-saas.ts` | Billing: fetches plans + subscription, `{ plans, subscription, isLoading }` |

---

## 4. Component Structure

### UI Primitives (`src/components/ui/`)
| Component | File |
|---|---|
| Avatar | `avatar.tsx` |
| Badge | `badge.tsx` |
| Button | `button.tsx` |
| Card | `card.tsx` |
| Dialog | `dialog.tsx` |
| DropdownMenu | `dropdown-menu.tsx` |
| Input | `input.tsx` |
| Select | `select.tsx` |
| Skeleton | `skeleton.tsx` |
| Table | `table.tsx` |
| Tabs | `tabs.tsx` |

### Layout Components (`src/components/layout/`)
- `header.tsx` — Top navigation with user menu
- `sidebar.tsx` — Dashboard sidebar navigation
- `mobile-nav.tsx` — Mobile navigation drawer

### Animation & Motion (`src/components/`)
- `motion.tsx` — Exports `AnimateSection`, `AnimateUp`, `StaggerGrid`, `StaggerItem`, `HoverCard`, `buttonTap`
- `page-transition.tsx` — Page transition wrapper
- `view-transition-provider.tsx` — View transition provider

### Charts (`src/components/charts/`)
- `revenue-chart.tsx` — Revenue visualization (Recharts)
- `sales-channel-chart.tsx` — Sales channel breakdown

### Backgrounds (`src/components/backgrounds/`)
- `LightPillar/index.tsx` — Three.js WebGL light pillar effect (used on landing page)

### Other Components
- `command-palette.tsx` — Cmd+K command palette
- `notification-panel.tsx` — Notification dropdown
- `order-tracking-timeline.tsx` — Order status timeline
- `realtime-indicator.tsx` — WebSocket/realtime connection indicator
- `realtime-provider.tsx` — Realtime context provider
- `pwa-register.tsx` — PWA service worker registration

---

## 5. API Routes (25 total)

| Route | File | Purpose |
|---|---|---|
| `GET /api/dashboard` | `dashboard/route.ts` | Dashboard stats + chart data |
| `GET /api/search?q=` | `search/route.ts` | Search orders, customers, products |
| `GET /api/audit-log` | `audit-log/route.ts` | Paginated audit logs |
| `GET/PUT/DELETE /api/profile` | `profile/route.ts` | User profile CRUD |
| `PUT /api/profile/password` | `profile/password/route.ts` | Change password |
| `PUT/DELETE /api/profile/avatar` | `profile/avatar/route.ts` | Avatar management |
| `GET /api/orders` | `orders/route.ts` | Orders listing |
| `GET /api/customers` | `customers/route.ts` | Customers listing |
| `GET /api/products` | `products/route.ts` | Products listing |
| `GET /api/categories` | `categories/route.ts` | Product categories |
| `GET /api/team` | `team/route.ts` | Team members |
| `GET /api/roles` | `roles/route.ts` | Roles & permissions |
| `GET /api/api-keys` | `api-keys/route.ts` | API key management |
| `GET /api/discounts` | `discounts/route.ts` | Discount codes |
| `GET /api/marketing` | `marketing/route.ts` | Campaign management |
| `GET /api/notifications` | `notifications/route.ts` | Notifications list |
| `GET /api/notifications/preferences` | `notifications/preferences/route.ts` | Notification prefs |
| `POST /api/notifications/batch` | `notifications/batch/route.ts` | Batch notification actions |
| `GET/PUT /api/billing/subscription` | `billing/subscription/route.ts` | Subscription management |
| `GET /api/billing/invoices` | `billing/invoices/route.ts` | Invoice history |
| `GET /api/billing/plans` | `billing/plans/route.ts` | Plan listings |
| `POST /api/webhooks` | `webhooks/route.ts` | Webhook management |
| `GET /api/webhooks/deliveries` | `webhooks/deliveries/route.ts` | Webhook delivery log |
| `POST /api/webhooks/test` | `webhooks/test/route.ts` | Test webhook delivery |
| `GET /api/realtime` | `realtime/route.ts` | Realtime status |

---

## 6. Test Structure

### Configs
| Config | Environment | Files | Tests | Coverage Threshold |
|---|---|---|---|---|
| `vitest.config.ts` | Node | `src/lib/**` | ~1 test | 90% stmts / 80% branches |
| `vitest.components.config.ts` | jsdom | `src/components/**`, `src/app/**` | 433 tests | 30% stmts |
| `vitest.api.config.ts` | Node | `src/app/api/__tests__/**` | N/A | 85% stmts |

### Test Files
**Component Tests (jsdom):**
- `landing-page.test.tsx` — 11 tests (hero, CTAs, metrics, features, testimonials, bottom CTA)
- `marketing-layout.test.tsx` — Marketing layout structure
- `features-page.test.tsx` — Features page content
- `pricing-page.test.tsx` — Pricing page
- `changelog-page.test.tsx` — Changelog page
- `integrations-page.test.tsx` — Integrations page
- `data-structures.test.tsx` — Data structures
- `header.test.tsx` — Header component
- `products-page.test.tsx` — Products dashboard page
- `customers-page.test.tsx` — Customers dashboard page
- `team-page.test.tsx` — Team page
- `discounts-page.test.tsx` — Discounts page
- `marketing-page.test.tsx` — Marketing page
- `setup.ts` — Global test configuration with mocks

**API Tests (Node):**
- `routes-integration.test.ts` — API integration tests
- `routes-remaining.test.ts` — 35 remaining API tests
- `routes-permissions.test.ts` — Permission tests

**Library Tests:**
- `api-guard.test.ts` — API guard tests
- `permissions.test.ts` — Permission tests

### Test Mocks
- `next/navigation` — `useParams`, `usePathname`, `useRouter`
- `next/link` — Renders as `<a>` tag
- `framer-motion` — No-op wrapper (motion, AnimatePresence, hooks)
- `next-themes` — `useTheme` returns `{ theme: "light", setTheme }`
- `lucide-react` — All icons render as `<svg>` with `data-testid`
- `@/components/backgrounds/LightPillar` — Null (Three.js WebGL crashes in jsdom)
- `@/components/motion` — Passthrough mock (AnimateSection, AnimateUp, etc.)
- `@/components/ui/button` — Render as `<button>`
- `@/lib/utils` — Real utils passthrough, `cn` simplified
- `@radix-ui/react-slot` — Slot mock
- `class-variance-authority` — `cva` mock

---

## 7. Skills & Design System

### Loaded Skills
| Skill | Purpose |
|---|---|
| `vercel-react-best-practices` | React/Next.js performance optimization |
| `vercel-react-native-skills` | React Native (unused) |
| `vercel-react-view-transitions` | View Transition API |
| `vercel-composition-patterns` | React composition patterns |
| `web-design-guidelines` | Web interface design review |
| `writing-guidelines` | Prose/style review |
| `verification-before-completion` | Pre-commit verification |
| `writing-plans` | Multi-step task planning |
| `writing-skills` | Skill creation/editing |
| `subagent-driven-development` | Parallel agent orchestration |

### Design System (from DESIGN.md)
- **DESIGN_VARIANCE**: 7/10 — dynamic layouts, avoid generic patterns
- **MOTION_INTENSITY**: 6/10 — fluid, purposeful motion
- **VISUAL_DENSITY**: 4/10 — balanced whitespace
- **Fonts**: Inter (sans-serif only)
- **Palette**: High-contrast monochrome (Slate/Zinc) with vivid accents (Indigo, Emerald)
- **Anti-Center Bias**: Split-screen/asymmetric heroes preferred
- **Bento Grids**: Distinct content per cell, avoid identical card patterns

---

## 8. Remaining Tasks & Known Issues

### High Priority
- [ ] Deploy to production and verify all routes work end-to-end
- [ ] Address `npm audit` findings (2 moderate, 1 high) — review before any `audit fix --force`

### Medium Priority
- [ ] Add E2E tests with Playwright for critical user flows (esp. login/register/2FA)
- [ ] Expand test coverage for dashboard pages (currently ~30%)

### Low Priority
- [ ] Landing page could use performance optimization for Three.js LightPillar
- [ ] Add remaining page transitions for all route changes
- [ ] Add Storybook for component development

### Completed (2026-07-14 cleanup)
- [x] Removed duplicate "password too short" test in `routes-integration.test.ts`
- [x] Removed unused `uuid` dependency (0 usages in source/tests)
- [x] Removed dead `@auth/core` alias from `vitest.config.ts` and `vitest.components.config.ts` (package was not even declared)
- [x] Corrected inaccurate Auth0/mock notes above — auth is a live custom JWT system
- Note: `bcryptjs`, `jsonwebtoken`, `otplib`, `qrcode` are ALL in active use — do NOT remove them

---

## 9. Quick Reference

### Common Commands
```bash
npm run dev              # Start dev server (port 3010)
npm run build            # Production build
npm test                 # Unit tests
npm run test:components  # Component tests
npm run test:all         # All tests
npm run coverage:all     # All tests + coverage report
```

### Project Structure
```
src/
├── app/
│   ├── [locale]/
│   │   ├── (dashboard)/  # 18 dashboard pages
│   │   └── (marketing)/  # 5 marketing pages + tests
│   ├── api/              # 25 API route files
│   ├── icon.tsx          # Generated favicon (32×32)
│   ├── apple-icon.tsx    # Generated apple icon (180×180)
│   ├── manifest.ts       # PWA manifest
│   ├── layout.tsx        # Root layout
│   └── providers.tsx     # App providers
├── components/
│   ├── ui/               # 11 UI primitives
│   ├── layout/           # Header, sidebar, mobile-nav
│   ├── charts/           # Revenue, sales channel charts
│   ├── backgrounds/      # LightPillar (Three.js)
│   └── ...               # Command palette, notifications, etc.
├── hooks/                # 4 custom hooks
├── lib/                  # Utilities, auth0 stub, api-guard, permissions
├── i18n/                 # Locale config + en.json, id.json
└── middleware.ts         # i18n routing only
```

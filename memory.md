# Project Memory: Next Dashboard

> Last updated: 2026-08-06
> Framework: Next.js 16 (App Router, React 19)
> Database: PostgreSQL via Prisma ORM (`.env` → `postgresql://...@localhost:5432/nextdashboard`)
> Styling: Tailwind CSS 3.4
> i18n: next-intl (en, id, ja, zh)
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

### i18n Setup (MANDATORY FOR ALL NEW FEATURES & IMPROVEMENTS)
- **Locales**: `en` (English), `id` (Indonesian), `ja` (Japanese), `zh` (Chinese)
- **Default locale**: `en`
- **Locale parity**: `src/i18n/__tests__/locales-parity.test.ts` strictly guards 100% namespace and key parity across all 4 locales (`en`, `id`, `ja`, `zh`). Run `npm run test:i18n` to verify.
- **MANDATORY POLICY**: Every new feature, UI widget, dialog, status toast, export menu, and form control **MUST include full internationalization (i18n)** across all 4 locales (`en`, `id`, `ja`, `zh`) with 100% key parity. Hardcoded English UI strings are strictly prohibited. Always wire components using `next-intl` (`useTranslations`) and register identical key trees across all 4 locale JSON files in `src/i18n/locales/`.
- **Locale detection**: Enabled (via `Accept-Language` header)
- **Middleware**: Excludes `/api/`, `/_next/`, `/favicon`, `/icon`, `/apple-icon`, `/manifest.json`, and paths with file extensions
- **Route groups**: `(marketing)` and `(dashboard)` within `[locale]`

### Anti-AI Slop & Dynamic Theme Architecture (STRICT DESIGN STANDARD)
- **Banned Visual & Copy Patterns**:
  - **No Generic Pill Gradients**: Never use cliché AI-slop gradients like `bg-gradient-to-r from-indigo-500 to-purple-600` or random neon borders.
  - **No Hardcoded Static Colors**: Strictly ban hardcoded `indigo-600`, `indigo-500`, `violet-600`, `purple-600` on custom feature surfaces.
  - **No AI Clichés or Gimmicks**: Ban unnecessary sparkle emojis (`✨`), floating glow blobs, and robotic marketing buzzwords ("revolutionary multi-channel synergy", "empower your ecosystem").
  - **No Untranslated Strings**: Never hardcode English text or raw placeholders.
- **Mandatory Dynamic Theme Adaptation**:
  - Every new feature, card, dialog, table, badge, and input must dynamically bind to the user's custom appearance color configured in **Settings -> Appearance**.
  - Always use standard design tokens: `text-primary`, `bg-primary`, `border-primary`, `ring-primary`, `focus:ring-primary`, and `bg-primary/10` / `border-primary/20` for tinted highlights.
  - When the user selects Emerald, Amber, Violet, Rose, Cyan, or a custom HEX code, all payment terminals, standees, bank cards, and modals must instantaneously reflect their brand identity.
- **Natural Language Microcopy**:
  - Use concise, direct, human-grade language ("Tarik Saldo", "Verifikasi Rekening", "Rekening Terdaftar", "Bank Tujuan").


### Manifest & PWA
- `manifest.ts` generates manifest at `/manifest.webmanifest`
- Icons generated via `icon.tsx` (32×32) and `apple-icon.tsx` (180×180) using `next/og` ImageResponse
- Service worker at `/sw.js` with offline caching for analytics and dashboard APIs
- `PWAInstallPrompt` with desktop dock install and iOS Safari 3-step guide modal
- `OfflineIndicator` with real-time connectivity status banners

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
| `/en/integrations` | `[locale]/(dashboard)/integrations/page.tsx` | ✅ Developer Portal: API keys, webhooks, delivery logs, whoami playground + quick-start snippets |
| `/en/notifications` | `[locale]/(dashboard)/notifications/page.tsx` | ✅ |
| `/en/profile` | `[locale]/(dashboard)/profile/page.tsx` | ✅ |
| `/en/reports` | `[locale]/(dashboard)/reports/page.tsx` | ✅ |
| `/en/sales` | `[locale]/(dashboard)/sales/page.tsx` | ✅ |
| `/en/settings` | `[locale]/(dashboard)/settings/page.tsx` | ✅ |
| `/en/audit-log` | `[locale]/(dashboard)/audit-log/page.tsx` | ✅ |
| `/en/security` | `[locale]/(dashboard)/security/page.tsx` | ✅ Security Center (score banner, stat tiles, 2FA/passkeys/sessions/backup/email-verification/activity cards) |
| `/en/sso` | `[locale]/(dashboard)/sso/page.tsx` | ✅ SSO / Enterprise settings (SAML connection CRUD, metadata URL; validation in `src/lib/sso.ts`) |
| `/en/affiliates` | `[locale]/(dashboard)/affiliates/page.tsx` | ✅ Affiliate Portal: links, conversions, products, and multi-gateway payout requests |

### Enterprise Feature Suites (100% i18n Across en/id/ja/zh)
1. **⚡ Real-Time Operations**:
   - **Global Sales Map** (`src/components/dashboard/widgets/global-sales-map.tsx`): Interactive Mercator projection SVG map with live radar pulses, order trajectory pings, and localized KPI telemetry.
   - **CRT Telemetry Terminal** (`src/components/dashboard/widgets/crt-telemetry-terminal.tsx`): Retro scanline CRT display streaming real-time SSE order logs and server telemetry.
   - **Live Webhook Simulator** (`src/components/dashboard/webhook-event-simulator.tsx`): Playground with one-click triggers (Instagram Order, Midtrans QRIS, Affiliate Payout, Low Inventory) updating live metrics and emitting toast alerts.
2. **📈 Growth & Unit Economics**:
   - **Performance Marketing Engine** (`src/components/dashboard/widgets/performance-marketing-engine.tsx`): Core ROAS, Break-Even ROAS, CPA/CAC, and MVP Target Price formulas (`src/lib/marketing-math.ts`).
   - Includes full 6-step revenue-to-margin waterfall flowdown and interactive scenario simulation drawer with presets (Apparel, SaaS, Tech). Localized under `unitEconomics` namespace.
3. **🤝 Monetization & Payouts**:
   - **Affiliate Payouts** (`src/app/[locale]/(dashboard)/affiliates/page.tsx`): Payout summary banner, balance tracking, and request dialog with Stripe Connect / Midtrans bank transfer rails.
   - **Multi-Channel Team Permissions** (`src/app/[locale]/(dashboard)/team/page.tsx`): Invite dialog with role selection and granular channel scoping (Online Store, TikTok Shop, Shopee, Instagram Shopping, POS).
4. **🧾 Legal & Accounting**:
   - **Branded Invoices & Receipts** (`/api/orders/[id]/invoice` & `/api/billing/invoices/[id]/download`): High-resolution printable PDF invoices with base64 QR digital verification codes, tax breakdowns (PPN 11% / Sales Tax), payment status badges, and Stripe/Midtrans pay buttons.
5. **📊 Automation & Mobility**:
   - **Scheduled Executive Email Reports** (`src/components/reports/scheduled-reports-dialog.tsx`): Configurable daily/weekly/monthly digest scheduling via Resend (`/api/reports/send-digest`).
   - **Multi-Format Export Menu** (`src/components/reports/reports-export-menu.tsx`): One-click export to CSV, multi-sheet Excel (`.xlsx`), and Print/Save PDF.
   - **PWA & Offline Support**: App install prompt (`src/components/pwa-install-prompt.tsx`) with iOS Safari 3-step guide, service worker caching (`public/sw.js`), and floating connectivity banner (`src/components/offline-indicator.tsx`).
6. **📦 Smart Inventory Replenishment & Supplier Purchase Orders (`/inventory`)**:
   - **Sales Velocity & Replenishment Engine** (`src/lib/inventory-replenishment.ts`): 30-day velocity, Days of Inventory (DOI), Reorder Point (ROP = Lead Time × Velocity + Safety Stock), stockout risk tiers (CRITICAL, WARNING, HEALTHY, OVERSTOCKED), and suggested reorder quantities. Unit-tested in `src/lib/inventory-replenishment.test.ts`.
   - **Purchase Orders Engine** (`src/lib/purchase-orders-store.ts`, `/api/inventory/purchase-orders`): PO generation (`PO-YYYY-XXXX`), line item budgeting, status lifecycle (`DRAFT` → `ISSUED` → `RECEIVED` → `CANCELLED`). Marking a PO as `RECEIVED` automatically increments `Product.stock` in PostgreSQL and logs an `InventoryRecord` audit entry.
   - **Branded Printable PO Documents** (`/api/inventory/purchase-orders/[id]/pdf`): High-res vector-crisp printable HTML/PDF Purchase Order sheets with digital barcode verification, vendor details, warehouse dock address, and terms.
   - **Multi-Warehouse Allocation** (`/api/inventory/warehouses`): Track fulfillment hub capacity (Jakarta Central, Surabaya Logistics Hub, Singapore Regional Gateway) and multi-channel inventory allocation (Online Store, TikTok Shop, Shopee, POS).
7. **🎨 Multi-Tenant White-Labeling & Custom Branding (`/settings`)**:
   - **Custom Domain Routing** (`src/lib/tenant-branding.ts`, `/api/tenant/branding`, `/api/tenant/domain-verify`): Enterprise custom domain routing (`dashboard.yourbrand.com`) with DNS CNAME target badge (`cname.next-dashboard.com`), real-time TLS verification, and 1-click clipboard copy.
   - **Theme Accent Customization**: 6 curated presets (Indigo, Emerald, Violet, Amber, Rose, Cyan) + custom hex color picker with dynamic CSS variable injection (`--primary`, `--primary-rgb`).
   - **Invoice & Receipt Template Notes**: Configurable default remittance terms, bank account details, and tax disclaimers rendered directly on customer PDF invoices.
   - **Organization Switcher** (`src/components/layout/organization-switcher.tsx`): Top-header workspace switcher with instant tenant switching (`/api/tenants/switch`) issuing updated JWT auth cookies, and instant workspace creation modal (`/api/tenants`).
8. **💳 Standalone QRIS Commerce Engine, Barcode Invoicing & System Upgrades (v2.6.0)**:
   - **Standalone ASPI QRIS Engine & Auto-Sensing SSE Stream** (`src/lib/qris-engine.ts`, `/api/billing/qris/stream`): Full Bank Indonesia / ASPI compliant QRIS payment lifecycle operating independently without external gateways. Global EventEmitter `qrisEmitter` pushes real-time Server-Sent Events (`payment_confirmed`, `transaction_created`, `withdrawal_completed`) directly to the POS terminal, automatically settling transactions without browser reloads.
   - **Direct Order QRIS Checkout** (`/orders/[id]/pay`, `/api/orders/[id]/pay`): Standalone customer payment portal featuring dynamic ASPI QR code, expiration countdown timer, real-time SSE payment listener, and simulated banking rail trigger.
   - **Printable A5/A6 Tabletop QRIS Standee & Transfer Receipts**: Printable high-resolution counter standee with official Bank Indonesia / ASPI logos, merchant NMID `ID1020084729101`, and accepted e-wallet badges (GoPay, OVO, DANA, LinkAja, ShopeePay, BCA, Mandiri, BRI, BNI). Official printable transfer proofs with clipboard copy for completed disbursements.
   - **Multi-Channel Instant Disbursements & FX Settlement**: Supports Indonesian e-wallets (DANA, OVO, GoPay), national banks (BCA, Mandiri, BRI, BNI, Permata, CIMB Niaga), and global payout rails (Visa/Mastercard OCT in USD, Alipay in CNY) with automated exchange rate conversion and fee transparency. Added CNY (Chinese Yuan, ¥) to supported currencies in `src/lib/currency.ts`.
   - **10MB Multi-Format & SVG Asset Upload Engine**: Upgraded user avatar (`/api/profile/avatar`) and product media manager (`src/components/product-image-manager.tsx`) upload limit to 10MB (`10 * 1024 * 1024` bytes). Full native vector SVG (`image/svg+xml`) support with raw vector fidelity preservation alongside WebP, AVIF, PNG, JPEG, and GIF.
   - **Pure TypeScript Code128 Vector Barcode Engine** (`src/lib/barcode.ts`): Self-contained Code128-B barcode generator emitting clean, scalable SVG vector elements and data URLs without native C++ canvas or heavy server dependencies.
   - **Interactive Invoice Template & Barcode Customizer** (`src/components/billing/invoice-customizer-dialog.tsx`): Visual customizer in Billing -> Invoices tab with live SVG barcode preview, company branding, NPWP tax registration, theme accent colors, and custom remittance terms. Printable invoice route (`/api/orders/[id]/invoice`) rendered with dynamic Code128 barcode, QR code verification, and direct QRIS checkout link.
   - **Dynamic Entity Appearance Accent Synchronization**: Customer names, order IDs (`#orderNumber`), product titles, and marketing campaign names across all dashboard pages (`/customers`, `/orders`, `/products`, `/marketing`, `/sales`, `/dashboard`) dynamically inherit the user's customized appearance primary color via `text-primary hover:underline font-semibold transition-colors`.
   - **Navbar Dropdown Auto-Scroll & Body Lock Bug Fix**: Resolved body scroll locking and viewport jumping when opening/closing navbar dropdown menus (Profile, Language, Currency, Theme) by defaulting Radix UI `DropdownMenu` to `modal={false}` and preventing focus scroll via `e.preventDefault()` on `onCloseAutoFocus`.
   - **Navbar Telemetry Badge i18n Localization**: Fully localized `RealtimeConnectionBadge` in `src/components/layout/header.tsx` across `en`, `id`, `ja`, and `zh` under the `telemetry` namespace.
   - **Legal Compliance & Changelog Automation**: Release v2.6.0 added to `src/app/[locale]/(marketing)/changelog/page.tsx` across all 4 locales. Terms of Service (`/terms`) and Privacy Policy (`/privacy`) updated with section 7 covering QRIS transaction standards, FX conversion terms, telemetry data streams, and encrypted media storage.
9. **🏦 Indonesian Banking Directory (4 Regions), Real Beneficiary Tracking & Tactile Card/Wallet Design System**:
   - **Comprehensive Indonesian Banking Directory** (`src/lib/indonesian-banks.ts`): Complete registry of 50+ Indonesian banks categorized into 4 core banking regions/sectors:
     1. *BUMN / Himbara*: Mandiri (008), BRI (002), BNI (009), BTN (200), BSI (451).
     2. *Bank Swasta Nasional*: BCA (014), CIMB Niaga (022), Danamon (011), Permata (013), Panin (019), OCBC NISP (028), Maybank (016), Mega (426), Sinarmas (153), BTPN / Jenius (213), BCA Syariah (536), Muamalat (147), etc.
     3. *BPD Across 4 Geographic Macro-Regions*:
        - Region 1 (Sumatera): Bank Nagari (118), Sumut (117), Riau Kepri (119), Sumsel Babel (120), Aceh Syariah (116), Lampung (121), Bengkulu (133), Jambi (115).
        - Region 2 (Jawa & Bali): Bank BJB (110), DKI (111), Jateng (113), Jatim (114), BPD DIY (112), BPD Bali (129).
        - Region 3 (Kalimantan & Sulawesi): Bank Kalbar (123), Kaltimtara (124), Kalsel (122), Kalteng (125), Sulselbar (126), SulutGo (127), Sulteng (134), Sultra (135).
        - Region 4 (Indonesia Timur: Nusa Tenggara, Maluku, Papua): Bank NTB Syariah (128), NTT (130), Maluku Malut (131), Papua (132).
     4. *Bank Digital & Neobanks*: Bank Jago (542), SeaBank (535), Allo Bank (567), Blu by BCA Digital (501), Line Bank (484), Bank Neo Commerce / BNC (490), Krom Bank (459), Superbank (562).
   - **Real User & Beneficiary Tracking Engine** (`src/lib/account-validator.ts`, `src/lib/beneficiary-store.ts`, `/api/billing/beneficiaries`):
     - Automatic number pattern detection: phone numbers (`08...`) detect telco carrier (Telkomsel, Indosat, XL, etc.) and auto-route to DANA, GoPay, OVO, LinkAja, or ShopeePay.
     - 16-digit card input undergoes BIN detection and Luhn algorithm validation for Visa, Mastercard, GPN, and JCB.
     - Real-time simulated account name inquiry resolver (`/api/billing/beneficiaries/inquiry`) matching Bank Indonesia SNAP / BI-FAST inquiry standard.
     - Persistent beneficiary store (`data/beneficiaries.json`) with in-memory caching and 1-click payout repeat.
   - **Tactile Physical Card Visual Component** (`src/components/ui/bank-card-visual.tsx`):
     - Authentic micro-circuit gold EMV contact chip SVG, dual contactless NFC radio wave glyph, embossed 16-digit card number with realistic metallic drop shadow, holographic security badge, issuer bank watermark, and card tier indicator (Classic, Gold, Platinum, Black Signature, GPN Nasional).
     - Dynamically adapts to user's selected appearance accent color (`--primary`, `border-primary/40`).
   - **Digital E-Money Wallet Pass Component** (`src/components/ui/emoney-wallet-pass.tsx`):
     - Authentic smartphone mobile pass styling with official e-wallet glyphs (DANA, OVO, GoPay, LinkAja, ShopeePay, Alipay), verified recipient badge, formatted phone number, and account tier pill.
   - **Searchable Bank Directory Browser** (`src/components/billing/bank-directory-dialog.tsx`):
     - Interactive modal embedded into the billing withdrawal terminal allowing instant search by name or 3-digit clearing code across all 4 regions with 1-click selection.

## 3. Hooks

| Hook | File | Purpose |
|---|---|---|
| `useAuth()` | `src/hooks/use-auth.tsx` | Real JWT auth context: `{ user, isLoading, error, isAuthenticated, login, register, logout, refreshUser, updateUser }` |
| `useAnalytics()` | `src/hooks/use-analytics.ts` | PostHog analytics: `capture()`, `trackCTA()`, `trackFeatureInteraction()`, `trackLanguageSwitch()`, `trackScrollDepth()` |
| `useRealtimeData<T>(url, options)` | `src/hooks/use-realtime-data.ts` | Polling hook: `{ data, loading, error, lastUpdated, isRefreshing, refresh }` |
| `useSaas(userId?)` | `src/hooks/use-saas.ts` | Billing: fetches plans + subscription, `{ plans, subscription, isLoading }` |
| `useAiChat()` | `src/hooks/use-ai-chat.ts` | AI copilot chat: posts `{ messages, locale }` to `/api/ai/chat`, streams replies; localized error fallback via `errorContent` option |
| `useSecurityData()` | `src/components/security/use-security-data.ts` | Security Center data: sessions, events, passkeys, backup-code count, 2FA status, email-verified flag, `mfaVerifiedRecently` + `refresh()` |
| `useResendCooldown()` | `src/components/security/use-resend-cooldown.ts` | Shared 60s email-verification resend cooldown (localStorage-persisted under `email-verify-cooldown-until`, decrement-based interval, marker cleared on active→0 or when expired on mount). Configurable via `{ durationSeconds?, storageKey? }` (defaults 60s / `email-verify-cooldown-until`). Used by the Security Center card, profile page, register OTP step, and forgot-password page (the last via its own `forgot-password-cooldown-until` key) |

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

### Security (`src/components/security/`)
- `use-security-data.ts` — Shared hook loading sessions/events/passkeys/backup/2FA/email + `timeAgo`/`withinDays`
- `sessions-card.tsx`, `passkeys-card.tsx`, `backup-codes-card.tsx`, `activity-card.tsx`, `email-verification-card.tsx` — Reusable section cards (email card shares the 60s resend cooldown via `use-resend-cooldown.ts`)
- `use-resend-cooldown.ts` — Shared resend-cooldown hook (Security Center card + profile page share the same localStorage key)
- `totp-card.tsx` — 2FA TOTP setup (QR) / disable
- `security-center.tsx` — `/security` page: score banner (incl. MFA-recently-verified chip), stat tiles, section grid
- `src/lib/security-score.ts` — Pure `computeSecurityScore`/`scoreTier`/`scoreColor` + `SUSPICIOUS_EVENT_TYPES`/`MFA_VERIFICATION_EVENT_TYPES` (weighted: TOTP/passkeys/backup/email-verified/MFA-verified-recently/no-suspicious/sessions); unit-tested

### SSO (`src/components/sso/`)
- `sso-settings.tsx` — SAML connection management (create/edit/toggle/delete, metadata URL generation); validation via `src/lib/sso.ts`

### AI Copilot (`src/components/ai/`)
- `ai-copilot-provider.tsx` — Copilot context provider
- `ai-copilot-panel.tsx` — Chat panel; fully localized via `useTranslations('ai')` + `useLocale` (UI strings + suggested questions)
- `ai-copilot-button.tsx` — Floating launcher button (localized aria-labels)

### Other Components
- `command-palette.tsx` — Cmd+K command palette
- `notification-panel.tsx` — Notification dropdown
- `order-tracking-timeline.tsx` — Order status timeline
- `realtime-indicator.tsx` — WebSocket/realtime connection indicator
- `realtime-provider.tsx` — Realtime context provider. SSE connection is gated on auth state (`useAuth().isAuthenticated`): booting logged-out stays quiet (no 401 retry storm), signing in connects immediately with a fresh backoff instead of waiting out the old exponential retry schedule (which left the header indicator stuck on Disconnected for up to ~30s after login), logging out closes the stream. Note: `setConnectionStatus("disconnected")` in the logged-out branch carries `// eslint-disable-line react-hooks/set-state-in-effect` (matches the settings-page pattern); the OTHER 2 lint errors in this file (line 85 setState-in-effect, `detectAllChanges` use-before-define) pre-date this change and are untouched
- `pwa-register.tsx` — PWA service worker registration

---

## 5. API Routes (28 listed; +9 auth routes in section 1)

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
| `GET /api/v1/whoami` | `v1/whoami/route.ts` | API-key auth test endpoint (used by playground) |
| `GET /api/webhooks/deliveries` | `webhooks/deliveries/route.ts` | Webhook delivery log |
| `POST /api/webhooks/test` | `webhooks/test/route.ts` | Test webhook delivery |
| `GET /api/realtime` | `realtime/route.ts` | Realtime status |
| `POST /api/ai/chat` | `ai/chat/route.ts` | AI copilot chat (locale-aware system prompt via `src/lib/ai/chat-locale.ts`) |
| `GET/POST/PUT/DELETE /api/auth/saml/connections` | `auth/saml/connections/route.ts` | SAML connection CRUD (null-tenant sessions fall back to the default workspace, matching `db:backfill-tenant` semantics) |
| `POST /api/auth/verify-email/send` | `auth/verify-email/send/route.ts` | Auth-gated; stores 1-hour token; dev mode returns the link (no mailer configured) |
| `GET /api/auth/verify-email/confirm?token=&locale=` | `auth/verify-email/confirm/route.ts` | Token-based confirm (works logged-out); sets `emailVerified`, logs `EMAIL_VERIFIED`, 302s to `/[locale]/security?verified=true\|invalid` (locale validated against en/id/ja/zh) |

---

## 6. Test Structure

### Configs
| Config | Environment | Files | Tests | Coverage Threshold |
|---|---|---|---|---|
| `vitest.config.ts` | Node | `src/lib/**` | ~1 test | 90% stmts / 80% branches |
| `vitest.components.config.ts` | jsdom | `src/components/**`, `src/app/**` | ~410 tests | 30% stmts |
| `vitest.api.config.ts` | Node | `src/app/api/__tests__/**` | N/A | 85% stmts |

### Test Files
**Component Tests (jsdom):**
- `landing-page.test.tsx` — 11 tests (hero, CTAs, metrics, features, testimonials, bottom CTA)
- `marketing-layout.test.tsx` — Marketing layout structure
- `features-page.test.tsx` — Features page content
- `pricing-page.test.tsx` — Pricing page
- `changelog-page.test.tsx` — Changelog page
- `integrations-page.test.tsx` — Integrations page (tabs, API keys, webhooks, deliveries, playground)
- `data-structures.test.tsx` — Data structures
- `header.test.tsx` — Header component
- `products-page.test.tsx` — Products dashboard page
- `customers-page.test.tsx` — Customers dashboard page
- `team-page.test.tsx` — Team page
- `discounts-page.test.tsx` — Discounts page
- `marketing-page.test.tsx` — Marketing page
- `sso-page.test.tsx` — SSO page (6 tests: renders, create-form validation, connection list states)
- `setup.ts` — Global test configuration with mocks

**API Tests (Node):**
- `routes-integration.test.ts` — API integration tests
- `routes-remaining.test.ts` — 35 remaining API tests
- `routes-permissions.test.ts` — Permission tests

**Library Tests:**
- `api-guard.test.ts` — API guard tests
- `permissions.test.ts` — Permission tests
- `sso.test.ts` — SAML connection validation + metadata URL helpers (17 tests)
- `ai/chat-locale.test.ts` — Locale normalization + AI instruction builder
- `i18n/__tests__/ai-locales.test.ts` — `ai` namespace parity across all 4 locales

**Playwright E2E (`e2e/`, `npm run test:e2e`):**
- `playwright.config.ts` — `workers: 1`, sequential files, dev server on :3010 (reused if already running), seed DB first: `npm run db:seed`
- `helpers.ts` — shared `registerFreshUser(page, { email?, emailPrefix?, name? })` (registers a unique user, skips the signup OTP step, waits for `/en/dashboard`, returns the email) + `fillRegistrationForm(page, email, { name?, password? })` (fills the signup form, waits for the enabled Create Account button, clicks) + `completeSignupOtp(page)` (reads the inline dev OTP and submits it) + `TEST_PASSWORD` (HIBP-safe) + `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` + `loginAs(page, email?, password?)` (goes to `/en/login`, fills the form, waits for the enabled Sign In button, waits for the dashboard; non-2FA accounts only) + `logoutViaHeader(page)` (opens the header user menu via `header button[aria-haspopup="menu"]` filtered by the always-rendered `span.avatar-brand` avatar fallback — disambiguates from the theme-toggle/notification dropdowns and works for ANY user, not just the seed admin — clicks the Logout menuitem, confirms the "Log out?" dialog, waits for `/en/login`). `registerFreshUser` (which reuses `fillRegistrationForm`) is used by `security-center`, `two-factor-auth`, `profile-email-verification`; `loginAs` by `security-center` + `sso` setup + `logout.spec.ts`; `logoutViaHeader` by `logout.spec.ts`; `register.spec.ts` uses `fillRegistrationForm`/`completeSignupOtp`; `login.spec.ts`'s valid-creds test uses `loginAs` (its invalid-creds test stays manual — it asserts the error path)
- `login.spec.ts` — valid seed creds land on dashboard; invalid creds show error + stay on /login
- `logout.spec.ts` — `loginAs` + `logoutViaHeader` (shared helpers) + 401 from /api/auth/me without cookie
- `register.spec.ts` — unique email → dashboard; short password rejected; duplicate email rejected
- `forgot-password.spec.ts` — full flow (request link → reset → old password rejected → new password logs in) + bogus-token + no-token + unknown-email-no-link (4 tests)
- `security-center.spec.ts` — unauth redirect; score banner/stat tiles/section cards; current-session "This device"; backup-code generation + regeneration confirmation; 2FA unset state; email-verification card states + full fresh-user flow (register → send dev link → cooldown disabled button + countdown note → confirm → toast + verified card) + invalid-token rejection
- `two-factor-auth.spec.ts` — full TOTP lifecycle on a fresh user: enable via Security Center (QR + secret capture, otplib `generateSync`), TOTP-gated login + invalid code rejection, disable with password confirmation, then password-only login
- `sso.spec.ts` — SAML connection create → toggle → edit → delete via real browser dialog (4 tests)
- `integrations.spec.ts` — developer portal (5 tests): unauth redirect; API key create → one-time reveal banner (raw `dash_` key scraped from `<code>`) → list row with ACTIVE/read badges → revoke → reactivate → delete-with-confirm; playground whoami with a freshly created key (rides `waitForResponse` on `/api/v1/whoami`, asserts Status 200 + `"authenticated": true` in the response `<pre>`); webhook create (Orders-group checkbox) → signing-secret banner → pause → activate → edit/rename → delete-with-confirm. Hermetic — never clicks "Test webhook" (outbound HTTP). Tolerates leftover dev-DB state: every flow creates its own timestamped-named resource and locates its row via `main .dashboard-card` filtered by an exact heading. Lessons: (a) `getByText("API Key Created")` is ambiguous in strict mode against the lowercase success toast — use `{ exact: true }`; (b) wait for the API Keys tab's data fetch to resolve BEFORE switching tabs (click during hydration is dropped); (c) "Add Endpoint" renders twice when the list is empty (toolbar + empty-state card) — use `.first()`
- `scripts/check-seeded-dashboard.ts` + `npm run check:seed` — browser-free seed-integrity CI check (added 2026-08-13, same day as the dashboard spec). Replicates `/api/dashboard`'s EXACT tenant-scoped queries (sum grandTotal, order/customer/product counts, recentOrders take 10, topProducts take 5 — all `where: { tenantId }`, products additionally `isActive: true`) against the fresh seed and exits non-zero when any come back zero/empty. Hardcodes the seed's canonical constants (tenant slug `default`, `admin@dashboard.com`) because `prisma/seed.ts` calls `main()` at module scope (importing it would WIPE + re-seed the DB). Runs as a step in `e2e-reusable.yml` right after `db:seed` (both callers: e2e.yml + ci.yml's release gate) — so a seed regression fails in ~seconds with zero browser/server overhead, before the 3.3m Playwright suite. Verified both paths locally: PASS on a good seed (exit 0); after nulling tenantIds on orders/customers/products → 6 FAILs + exit 1; re-seed restores PASS. The browser-level assertion of the same contract lives in the E2E spec below; the script covers the seed half, the spec covers the API/UI half. **Audit-tenant assertions added same day (2026-08-13)**: also counts `SecurityEvent`/`ActivityLog` rows with `tenantId: null` and fails when either is non-zero — catches the seed demo-log class of bug (the seed's 5 demo activity logs were historically written without tenantId, resurrecting NULL rows on every re-seed; fixed in `prisma/seed.ts`). Verified: fresh seed → 11/11 PASS; after nulling one ActivityLog's tenantId → `zero NULL-tenant ActivityLog rows — 1` FAIL + exit 1; re-seed restores PASS
- `tenant-isolation.spec.ts` — audit tenant-isolation guard (3 tests, added 2026-08-13). Proves `/api/audit-log` + `/api/auth/security-events` never leak across workspaces. `beforeAll` re-seeds, then runs `npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/seed-tenant-isolation.ts` (prints JSON { email, password, marker names } parsed by the spec): the script upserts a SECOND workspace (`tenant-b`), creates a STAFF actor in it (bcrypt hash, `passwordAlgo: "bcrypt"` — login accepts it), and stamps distinguishable markers: activityLog `ISOLATION_TENANT_A_ACTION` (default tenant) vs `ISOLATION_TENANT_B_ACTION`, and SecurityEvents written through the REAL `logSecurityEvent` path (keeps the hash chain intact) including a **poisoned row** — admin's userId + tenant B's tenantId — that the read-side tenant scope must hide from BOTH feeds (if the scope were removed, admin would see it via the userId match → test fails). Tests: (1) admin (default workspace) audit-log contains A-action not B-action; feed contains A-event, not B-event, not the poisoned one; (2) tenant-B user (API login + Bearer) audit-log contains B-action not A-action, feed contains B-event not A-event/poisoned — the strict `{ tenantId }` branch; (3) UI: tenant-B user on `/en/audit-log` sees "Tenant B marker" and never "Tenant A marker". Setup script needs `scripts/tsconfig.e2e.json` (extends root, aliases `server-only` → `node_modules/server-only/empty.js` exactly like the vitest configs, `@/*` → `../src/*` relative to scripts/) because `logSecurityEvent`/`audit-chain`/`siem`/`request-meta` all import `server-only`, which throws under plain node. NOTE: the SecurityEvent hash chain was historically broken from near the start (events written before the hashing feature shipped had NULL hashes, and rows 46+ mismatched every known canonical form — a lost pre-repo hashing implementation); the isolation spec's own events always verified correctly (ok=YES), confirming the setup never corrupted the chain. **RESOLVED 2026-08-13 by `scripts/repair-audit-chain.ts` + `npm run repair:audit-chain`** — see that bullet below; `/api/security/audit/verify` now reports `ok: true`, `verified` == `total` (1532 at last check, incl. new events chained onto the repaired tail). **i18n note**: the marker events (`ISOLATION_TENANT_A_EVENT` / `ISOLATION_TENANT_B_EVENT`) previously triggered browser `MISSING_MESSAGE: security.evt_*` warnings whenever a page rendered the ActivityCard; fixed by adding `security.evt_ISOLATION_TENANT_A_EVENT` + `evt_ISOLATION_TENANT_B_EVENT` to ALL 4 locales (`src/i18n/locales/{en,id,ja,zh}.json`, after `evt_APIKEY_CREATED` — the parity test requires identical key trees, so they MUST land in every locale together). Verified: `npm run test:i18n` 6/6 pass; isolation spec 3/3 with ZERO new MISSING_MESSAGE lines in the dev log
- `security-chain-tamper.spec.ts` — tamper-evidence guard (3 tests, added 2026-08-13). Proves the SecurityEvent hash chain catches tampering through the REAL admin endpoint: `beforeAll` runs `npm run repair:audit-chain` (deterministic clean baseline that also absorbs CI-retry leftovers) + TWO admin API logins so the tail always has ≥2 real chained events; test 1 asserts a clean baseline (200, ok:true, verified==total) and captures two adjacent tail rows; test 2 modifies the target row's `metadata` → verify returns 409 with EXACTLY one break `{seq, id, reason: "content hash mismatch (record was modified)"}`; test 3 deletes the target row → 409 with exactly one break at the SUCCESSOR `{seq, id, reason: "prevHash does not match previous event hash (insert/delete/reorder)"}` (reorder/insert/delete detection). Every tamper is surgically undone in `finally` (restore metadata / re-insert the deleted row with all original fields incl. id+seq+prevHash+hash) and each test re-asserts the chain is clean again — a passing run leaves the DB byte-identical (verified live: chain ok after spec). Requires serial execution (`workers: 1`, `fullyParallel: false` in playwright.config) since it touches the shared chain; `expect` + PrismaClient used directly in the spec (no server-only imports). Full suite: 47/47 pass
- `scripts/repair-audit-chain.ts` + `npm run repair:audit-chain` (added 2026-08-13 as .mjs, converted to .ts 2026-08-13) — repair of the SecurityEvent tamper-evident hash chain. Diagnosis: EVERY hashed row predating the script failed verification — the stored hashes came from an earlier (now-lost) pre-repo implementation that matches no known canonical form (brute-forced candidates: sorted/insertion-order JSON, with/without id/seq/tenantId/prevHash, epoch dates, double hashing — none match; `git log` shows `audit-chain.ts` shipped in a single 2026-08-03 commit, while hashed rows date from 07-31, so the hashing code was never in this repo when those rows were written). FIX: recompute `prevHash` + `hash` for EVERY row in seq order with the canonical algorithm IMPORTED from `src/lib/audit-hash.ts` (the same module `audit-chain.ts` and the seed's re-chain use — converted from .mjs to .ts + tsx precisely so the repair can never drift from the chain code; a divergence would surface as `broken before > 0`), also hashing previously-NULL "legacy" rows so the ENTIRE table becomes one verifiable chain. Idempotent — rows whose hashes already match are untouched (verified: 2nd run updates 0). Result: 1518 broken → 0; admin `/api/security/audit/verify` reports `ok: true`, 1532/1532 verified, firstBreakSeq null; security-center E2E 10/10 still green; after the .ts conversion 1765/1765 verify with 0 updates (drift-proof). Safe to re-run anytime (e.g. after a fresh seed in a new env) — it's the CI-env equivalent of `db:seed` for the audit chain
- `scripts/check-audit-chain.ts` + `npm run check:audit-chain` + CI step (added 2026-08-13) — chain-integrity guard: fails when the tamper-evident chain is broken (content/prevHash mismatch — the 409 GET /api/security/audit/verify reports — OR any NULL-hash row the verify walk silently skips). Runs the REAL `verifyAuditChain` (no drift). Wired into `e2e-reusable.yml` AFTER `Run E2E tests` (both callers: e2e.yml + ci.yml release gate) so corruption surfaces the moment the suite finishes, instead of silently accumulating across runs. **Tenant-attribution checks added same day**: also fails when any HASHED row has a NULL tenantId, or when a hashed row's tenantId references no existing Tenant. The chain is deliberately MULTI-tenant (the isolation fixture stamps tenant-b events + the poisoned row — a real, existing tenant), so the assertion is attribution integrity, NOT "default tenant only" (that would break the isolation fixture + post-E2E check). Insight from testing: `SecurityEvent_tenantId_fkey` is ENFORCED at the DB level (Prisma P2003 on a bogus id), so the orphaned-reference check is defense-in-depth (raw SQL / dropped FK) while the NULL-tenant check is the real new coverage — the FK can't catch NULL. tenantId is NOT part of the canonical hash payload, so the chain itself can never catch this class. Verified: PASS on the multi-tenant chain (1765 events incl. tenant-b); nulling one hashed row's tenantId → `[FAIL] zero hashed rows with NULL tenantId — {"nullTenant":1}` + exit 1; restore → PASS **Design finding while wiring it up**: re-seeding BREAKS the chain — `prisma.user.deleteMany()` NULLs `SecurityEvent.userId` (onDelete: SetNull) and userId is part of the canonical payload, so every wiped user's events stop verifying (the isolation spec's mid-suite re-seed alone broke ~42 rows). Fixed at the ROOT: `prisma/seed.ts` now re-chains the whole table right after `user.deleteMany()` (imports `computeHash`/`GENESIS_HASH` from the new shared `src/lib/audit-hash.ts` — see below), and `scripts/seed-tenant-isolation.ts` re-chains after its idempotent marker `deleteMany` (removing prior-run markers from mid-chain is a legit delete that must be re-chained, same as the seed). Verified: PASS on clean (1759/1759 after full suite), FAIL+exit 1 on tamper with the exact break (seq 394, "content hash mismatch"), full suite 47/47 with the post-suite check green; API tests 202/202, check:seed PASS
- **`src/lib/audit-hash.ts` (added 2026-08-13)** — the canonical chain hashing (GENESIS_HASH, stableStringify, canonicalEvent, computeHash) extracted from `audit-chain.ts` into a dependency-free module (NO server-only import) so `prisma/seed.ts` and the isolation setup script can re-chain under the root tsconfig; `audit-chain.ts` now imports + re-exports from it (exports unchanged: computeHash/GENESIS_HASH/ChainableEvent/verifyAuditChain) — single source of truth, no drift between the chain code and the re-chain steps. `scripts/repair-audit-chain.ts` ALSO imports from audit-hash now (converted from .mjs, runs under `npx tsx --tsconfig scripts/tsconfig.e2e.json` like the other e2e scripts) — no second copy anywhere

Catches the seed-without-tenantId class of bug (dashboard showed Rp 0 / 0 / 0 / 0 for the seeded admin despite hundreds of orders / 10 customers / 12 products in the DB) at the UI AND API level. Re-runs `npm run db:seed` in `beforeAll` (`execSync`) so it's self-contained — and since the file sorts alphabetically first, the whole suite starts from a fresh seed (mirrors CI's seed step). (a) API: `POST /api/auth/login` → Bearer token → `GET /api/dashboard` asserts `stats.totalRevenue/totalOrders/totalCustomers/totalProducts > 0` + non-empty `recentOrders`/`topProducts` — the route returns all-zero stats both on error AND when the tenant-scoped queries see nothing, so non-zero is the direct regression signal. (b) UI: `loginAs` → the four `.stat-card-premium` cards show non-zero `p.text-2xl` values (revenue `/^Rp\s[1-9][0-9.,]*$/` — `formatCurrency` always uses id-ID regardless of browser locale, NBSP between Rp and the digits is covered by `\s`; counts `/^[1-9][0-9]*$/`); `toHaveText` auto-retry absorbs the ~1.6s `AnimatedCounter` count-up. Seed counts are non-deterministic (~360 orders via per-month jitter; 10 customers / 12 products fixed), revenue is random → asserted non-zero, never exact. Full suite: 41/41 pass
- **CI**: `.github/workflows/e2e.yml` runs the full Playwright suite on EVERY push + PR (all branches) — Postgres 16 service → `npm ci` → `prisma db push` → `playwright install --with-deps chromium` → `db:seed` → `npm run test:e2e`. Uploads `playwright-report/` (always) + `test-results/` (on failure, 14-day) as artifacts. `ci.yml` (lint/typecheck/unit/component/API/build/coverage/release, push+PR to main only) now ALSO has a main-push-only `e2e` job ("Playwright E2E (release gate)", `if: github.event_name == 'push'`) wired into `release.needs` so a failed E2E run blocks semantic-release. Because GitHub Actions can't `needs` across workflows, the job body lives ONCE in `.github/workflows/e2e-reusable.yml` (a `workflow_call` reusable workflow; inputs = node-version, artifact-suffix, DB/secret placeholders) and BOTH `e2e.yml` and the ci.yml gate call it (gate passes `artifact-suffix: "-gate"`) — single source of truth, no drift. Accepted tradeoff: the suite runs twice on main pushes (here + e2e.yml); on PRs to main only e2e.yml runs (no double-run). No mailer/PII env needed: dev fallback returns OTPs/links inline and `pii.ts` uses a dev key outside production. **Verified locally with `act` v0.2.89** — see the act bullets in E2E lessons below; the first in-container run exposed (and the fix landed) a fresh-DB seed bug, so this workflow is known-good end-to-end
- **audit-chain guard**: `.github/workflows/audit-chain.yml` (added 2026-08-13) — fast (~1 min, no Playwright/browser install), browser-free job on every push + PR (all branches): Postgres 16 service → `npm ci` → `prisma db push` → `db:seed` → `check:seed` → baseline `check:audit-chain` → `npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/seed-chain-events.ts` (stamps 3 REAL chained LOGIN SecurityEvents referencing a throwaway user via `logSecurityEvent`) → `db:seed` AGAIN (wipes the user → userId NULLed → seed's re-chain must fix the 3 rows) → `check:audit-chain` MUST pass. This is what makes the guard meaningful: a fresh seed has ZERO SecurityEvent rows, so check:audit-chain alone would pass trivially — the re-seed step is what actually exercises the seed's re-chain (verified locally: re-seed logs `🔗 SecurityEvent chain re-chained (3 rows)` and the final check passes 1762/1762; the FAIL case — seed without re-chain — was demonstrated when the isolation spec's re-seed broke ~42 rows before the fix). Mirrors e2e.yml's triggers + e2e-reusable.yml's Postgres setup; YAML validated with js-yaml
- **i18n guard**: `.github/workflows/i18n.yml` runs `npm run test:i18n` (`vitest run --config vitest.components.config.ts src/i18n/__tests__/`) on every push + PR (all branches) — locale-parity (exact namespace/key tree parity across en/id/ja/zh) + ai-namespace parity, 6 tests, ~1 min in CI, no DB/env needed. Verified end-to-end with act (Job succeeded). **Gotcha**: `vitest.config.ts` (node, `npm test`) EXCLUDES `**/__tests__/**`, so the parity tests only run under the components config — `test:i18n` must keep pointing at it

**E2E lessons learned (IMPORTANT for future specs):**
- **Radix Dialog does NOT mount in jsdom** under this repo's test setup (tree unmounts with no error). Dialog flows are covered by Playwright E2E instead; component tests stick to non-dialog interactions.
- **Hydration race**: clicking/filling before React hydration completes silently drops the action (no fetch fires, form state never updates). Always wait for client-fetched data or `waitForLoadState("networkidle")` after `page.goto` before interacting.
- **Register runs an HIBP breach check** (`src/lib/hibp.ts`) — test passwords must not be in breach corpora (`password123` is rejected; `Kx9#mQ2vLp7!wZ` is safe).
- **TOTP 30s window**: generate codes right before submit; skip/await when <10s left in the window to avoid boundary flakiness.
- **Radix Tabs activate on `mouseDown`** (component tests must fire `mouseDown`, not `click`).
- Logout now requires a confirm dialog (header menu → Logout → dialog).
- **Mount-time toasts**: sonner's Toaster subscribes on mount and never replays earlier toasts — so `<Toaster />` is mounted BEFORE `{children}` in `providers.tsx`. Any component that calls `toast.*` from a mount `useEffect` (e.g. Security Center's `?verified=true` toast after a full-page redirect) relies on this ordering; keep it.
- **Email-verification dev flow**: the send route returns the link inline in dev (no mailer) — E2E clicks the send button, reads the `<code>` link, and navigates to it.
- **Security event label vs card-status text**: activity labels use `evt_*` keys; keep them distinct from card status strings (e.g. `evt_EMAIL_VERIFIED` = "Email confirmed") to avoid ambiguous `getByText` matches.
- **Toast vs card-status text ambiguity**: success toasts can share text with the page (e.g. "Two-factor authentication enabled" appears in BOTH the sonner toast and the Security Center card status) → strict-mode violation. Scope with `getByLabel("Notifications alt+T")` (sonner region) or `getByRole("main")` (page content).
- **`.next` dev-cache poisoning**: running `next start`/`next build` (e.g. a background prod server on :3011) writes production build artifacts into `.next` — the SAME directory `next dev` (Playwright's webServer on :3010) compiles into. A dev server booting against a production-built `.next` serves Next 404s for existing routes (tests fail with a "This page could not be found" snapshot + 404 on `/api/auth/me`). Fix: `rm -rf .next` and re-run.
- **Email-verification resend cooldown**: 60s cooldown after each send, persisted in localStorage (`email-verify-cooldown-until` epoch ms) so a refresh can't bypass it. Implemented once in `use-resend-cooldown.ts` (decrement-based `setInterval` + transition-detection ref clears the marker only on active→0; expired markers are dropped on mount) and shared by the Security Center card AND the profile page. Button shows `resendInSeconds` countdown + `emailResendNote`; reverts to `resendEmail` label after expiry when a link was shown.
- **First-hit cold-route compile can blow the 10s expect timeout in CI containers** (observed intermittently on `/api/auth/forgot-password` — the sent-view text never appeared within 10s on the route's first hit; retries passed once warm, showing as "1 flaky"). Pattern: assert the UI AFTER `page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes(...))` around the click — the response wait rides the longer test timeout (30s+) while `expect` caps at 10s, and the UI only swaps after the response lands. Multi-step flows (register → reset → logins) also get `test.setTimeout(45_000)` headroom. (E2E confirms: was 33+1flaky in-container, now 34 passed 0 flaky first-attempt.)
- **`act` quirk — artifact uploads**: `actions/upload-artifact@v4` fails under act with `Unable to get the ACTIONS_RUNTIME_TOKEN env variable` unless act is run with `--artifact-server-path <dir>` (that flag spins up act's internal artifact server which provides the token). GitHub-hosted runners always provide it, so this is act-only. Command that reproduces CI locally: `act -j e2e -W .github/workflows/e2e.yml --reuse --artifact-server-path <dir>` (binary kept at `~/AppData/Local/act/act.exe`, config `actrc` pinned to `ghcr.io/catthehacker/ubuntu:act-latest`; reinstall: `curl -sL -o act.zip https://github.com/nektos/act/releases/download/v0.2.89/act_Windows_x86_64.zip && unzip act.zip`).
- **Fresh-DB vs leftover-dev-data false negatives**: a green local E2E run is only trustworthy if the dev DB matches CI's fresh-DB state. The 34/34 local pass was masking a REAL bug: `prisma/seed.ts` created no tenant, so on a fresh DB the SAML connections route's `tenant.findFirst()` fallback returned null → 400 "No tenant context" → the create-connection dialog never closed (sso.spec 1/4 in-container vs 4/4 locally — leftover dev tenants from `db:backfill-tenant` hid it). Fixed: seed now creates the default workspace `{ name: "Default Workspace", slug: "default" }` (same as `scripts/backfill-tenant.mjs`) and assigns seeded users to it (same as the register route). Rule: when a spec passes locally but fails in CI/act, diff the seed against what leftover local state could be masking before blaming timing. **Follow-up fix (2026-08-13)**: seeded BUSINESS data now also carries `tenantId: defaultTenant.id` — orders/customers/products/productCategories/discounts/campaigns all get it (SalesChannel/InventoryRecord/OrderItem have no `tenantId` column and are intentionally left alone). Before this, every tenant-scoped API (`/api/dashboard`, `/api/orders`, `/api/customers`, `/api/products`, `/api/discounts`, `/api/marketing`) returned 0s/empty for the seeded admin even though the rows existed — the E2E suite missed it because no spec asserts seeded-data visibility. If seeded dashboards ever look empty again, check the seed's `tenantId` assignment first. **Richer demo data (2026-08-13)**: the order block now generates ~360 orders spread across the last 12 calendar months (per-month counts 15→~45 with jitter, so the dashboard revenue chart shows 12 populated bars with an upward trend; current month is clamped to today so nothing is future-dated), and statuses are weighted by order age via `statusForAge` — <7d mostly PENDING/PROCESSING, <30d SHIPPED/DELIVERED, older mostly DELIVERED with a steady ~5% CANCELLED (paymentStatus derived from status: PENDING→UNPAID, CANCELLED→REFUNDED/UNPAID, else PAID). Customer `totalSpent`/`totalOrders`/`lastOrderDate` are incremented per order as before. Order counts are NOT deterministic anymore (jitter) — nothing asserts exact counts (the E2E dashboard spec + `check:seed` only require non-zero).
- **act on Windows**: the mounted repo volume is slow, so Next's on-demand route compile can exceed `expect` timeouts on a route's FIRST hit in-container (retries pass once warm). If an isolated test fails only in the container and the page snapshot shows no error toast (just a still-open dialog / pending state), it's an environment artifact — not a workflow bug — after ruling out DB-state differences.

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
- [x] Google OAuth login — configured with real credentials in `.env.local`; `/api/auth/google` redirects to Google consent screen; callback creates/finds user + sets JWT cookie

### Medium Priority
- [x] Add E2E tests with Playwright for critical user flows (login/register/logout/2FA + Security Center)
- [ ] Expand test coverage for dashboard pages (currently ~30%)

### Low Priority
- [ ] Landing page could use performance optimization for Three.js LightPillar
- [ ] Add remaining page transitions for all route changes
- [ ] Add Storybook for component development

### Completed (security hardening)
- [x] **Register-route audit tenant scoping (2026-08-13)**: `SecurityEvent` + `ActivityLog` gained a nullable `tenantId` column (+ `Tenant` back-relations, `@@index([tenantId])`); `logSecurityEvent` accepts `tenantId` and persists it; the register route now passes `user.tenantId` to the `LOGIN` security event AND writes a new `REGISTER` activity log (`entity: "User"`) with the same tenantId — so account-creation audit records live inside the workspace boundary. All other `logSecurityEvent` callers unchanged (param optional). Verified live: registered a fresh user → both rows carried the default tenant's id (matching the JWT `tenantId` claim); cleaned up the test user + its audit rows. eslint + tsc clean, 4/4 register E2E specs still pass
- [x] **Tenant-scoped audit READS (2026-08-13)**: `src/lib/tenancy.ts` gained `effectiveTenantId(session)` (JWT claim, falling back to the first-created tenant for legacy no-claim sessions — the SAML-route/backfill semantic); the two user-facing audit reads use the strict `tenantWhere(await effectiveTenantId(session!))` filter: `/api/audit-log` (filter AND-combined with the existing search `OR` via a `where.AND` wrapper so the two never collide) and `/api/auth/security-events` (`listSecurityEvents` takes the tenant filter). Originally the default workspace ALSO admitted null-tenant rows via an `{ OR: [{ tenantId }, { tenantId: null }] }` fallback (`auditTenantScope`) — REMOVED same day once `db:backfill-audit` + the seed fix eliminated null-tenant rows: an audit row without a tenant belongs to nobody and stays invisible. The ADMIN-only global tools `/api/security/audit/export` + `/api/security/audit/verify` are intentionally left unscoped (whole-deployment hash-chain integrity + SIEM export). API test mocks gained a `tenant: deepModel({})` so the fallback `prisma.tenant.findFirst` resolves. eslint + tsc clean, 202/202 API tests + 10/10 security-center E2E pass
- [x] **Legacy audit rows backfilled (2026-08-13)**: `scripts/backfill-audit-tenants.mjs` (`npm run db:backfill-audit`) assigns every NULL-tenant `SecurityEvent` + `ActivityLog` row to the default (first-created) tenant — idempotent, and SAFE for the SecurityEvent hash chain because `tenantId` is NOT part of the canonical chain payload (audit-chain hashes userId/type/ip/userAgent/metadata/createdAt). Ran it: 1284 securityEvents + 5 activityLogs assigned, 0 NULL remain. ALSO fixed the seed: its 5 demo activity logs (LOGIN/CREATE_ORDER/UPDATE_PRODUCT/CREATE_CAMPAIGN/APPLY_DISCOUNT) were created WITHOUT `tenantId`, so every re-seed resurrected 5 null rows that made the backfill look like it wasn't holding — now `tenantId: defaultTenant.id` like the rest of the seed (the `check:seed` script doesn't cover activity logs; a NULL-activity-log-after-reseed is the symptom to remember). Verified: fresh seed → 0 NULL activity rows, backfill is a no-op; strict read scope + isolation spec + full 44/44 E2E suite pass
- [x] **AuditLog model tenant-scoped too (2026-08-13)**: the separate `AuditLog` model (admin trail for api-keys/webhooks/billing/roles — write-only, no read sites in src) gained a nullable `tenantId` + `Tenant` relation + `@@index([tenantId])` (`prisma db push` applied; the dev server had to be stopped/restarted because Turbopack holds the Prisma query-engine DLL, which blocks `prisma generate` on Windows with EPERM). All 11 write sites now stamp the caller's tenant: `api-keys/route.ts` POST (existing `requireAuth` session) + DELETE/PUT (added `requireAuth`), `webhooks/route.ts` POST (existing session) + PUT/DELETE (added `requireAuth`), `webhooks/test/route.ts` (added `requireAuth`), `billing/subscription/route.ts` POST+PUT (the resolved admin user now selects `tenantId: true`), `roles/route.ts` PUT/POST/DELETE (added `requireAuth` — these handlers previously had NO actor context at all). Verified live: CREATE_API_KEY auditLog row carries the default tenant id; 202/202 API tests + 5/5 integrations E2E (full api-key + webhook lifecycle) + full 44/44 E2E suite pass; eslint + tsc clean
- [x] **ALL audit writes tenant-scoped (2026-08-13)**: every remaining `activityLog.create` + `logSecurityEvent` call site now carries the workspace's tenantId, so the writes match the reads. activityLog: `orders/route` POST+PUT, `orders/[id]` PATCH, `customers/[id]` PUT+DELETE, `products/[id]` PUT+DELETE, `customers/import`, `products/import`, `products/bulk`, `affiliates/links` POST, `affiliates/import-link` POST, `affiliates/platforms/[id]/sync`, `affiliates/platforms/[id]/connection` PUT, `auth/reset-password` (from the DB user), and `realtime` POST — which ALSO gained a `requireAuth` guard (was fully unauthenticated; it wrote client-supplied rows with no trusted tenant; the client only ever calls GET, and the existing tests' mocked session keeps them green). logSecurityEvent: login (LOGIN/LOGIN_FAILED/ACCOUNT_LOCKED/MFA_VERIFIED/BACKUP_CODE_USED), logout (from the decoded JWT claim), refresh-REUSE (best-effort `prisma.user.findUnique` for the actor's tenant), profile/password PASSWORD_CHANGE, backup-codes, webauthn register+authenticate+credentials, sessions + sessions/[id], step-up (both events), totp/verify, verify-email confirm+otp, saml/acs — all from the DB user or `session.user.tenantId`. The separate `AuditLog` model (api-keys/webhooks/billing/roles) is intentionally untouched (different model, no tenantId column). Verified live: admin login → `LOGIN` event + order create → `CREATE_ORDER` row both landed with the default tenant id; legacy pre-column rows stay NULL and are covered by the read-side OR clause. eslint + tsc clean, 202/202 API tests + 22/22 auth E2E (register/login/logout/two-factor) + 10/10 security-center pass
- [x] **Tenant attribution is now CENTRAL + actor-based, not type-based (2026-09-24)**: the release gate failed on 54 hashed `EMAIL_DELIVERY_FAILED` rows with a NULL tenantId. Two compounding causes. (1) `logEmailDelivery` forwarded `tenantId: params.tenantId ?? null` — a DEFINED `null` — and `logSecurityEvent` only ran its tenant resolver when the field was `undefined` (`params.tenantId !== undefined ? params.tenantId : resolveUserTenantId(...)`), so treating "explicit null" as "no workspace" silently dropped attribution for a whole event family (the same `session.x.tenantId ?? null` shape appears at 4 more call sites). FIX: one rule in `logSecurityEvent` — `params.tenantId ?? (await resolveUserTenantId(params.userId))`; a non-null tenant always wins, nullish resolves the actor's workspace, an actor-less event stays unattributed. (2) the guards keyed their exemption off a TYPE allowlist (`RATE_LIMITED`) instead of the actual invariant, so any other anonymous-but-legit event (a verification email requested for an address with no account) failed the gate despite being unattributable by construction. FIX: the rule is now ACTOR-based everywhere — `check:audit-chain` fails only on "hashed row with `userId` set but `tenantId` null", `check:seed` asserts every NULL-tenant row is actor-less, and `backfill-audit-tenants.mjs` stamps only actor-bearing rows. Backfilled 5 legacy actor rows; 2385 actor-less rows correctly exempt; guard green on 13568 events. VERIFIED end-to-end: the security-center OTP flow's fresh `EMAIL_DELIVERY_FAILED` rows now carry actor AND tenant, and `SELECT COUNT(*) ... WHERE hash IS NOT NULL AND "userId" IS NOT NULL AND "tenantId" IS NULL` = 0. 5 regression tests added to `security-event-chain-tail.test.ts` (resolves when omitted, resolves on explicit null, explicit tenant wins, actor-less stays null WITHOUT querying, lookup failure degrades to null) — confirmed non-vacuous by reverting the one-line fix (the explicit-null test fails). Remember: this class is invisible to the hash chain because tenantId is NOT part of the canonical payload, so only these guards can catch it.
- [x] **Seed wipes the developer-portal child tables (2026-09-24)**: `prisma/seed.ts`'s truncate list never touched `ApiKey`/`WebhookEndpoint`, and every re-seed runs `user.deleteMany()` (→ `userId` SetNull on survivoing keys). 177 orphaned `e2e-key-*` rows had accumulated with NULL ownership, so the integrations spec's `reclaimApiKeySlot` (which deleted the OLDEST key from an unscoped global GET — usually an orphan) never freed a slot on the admin's own per-user cap (`where: { userId, status: "ACTIVE" }`, Starter = 2) → POST /api/api-keys answered 402 forever, at any worker count. FIX: the seed now `deleteMany`s both tables (deterministic fixture: exactly one demo key + one demo webhook), the demo key's upsert restores `userId` on the update branch, and the reclaim skips the demo fixture and deletes the oldest non-demo key per round (own keys are finite, so it converges). Also remember `PAGE_ACCESS.integrations` is ADMIN-only, so every developer-portal spec family shares ONE account — that is why the race appeared locally (2 workers) and not in CI (`workers: 1`).
- [x] **Production dependencies remediated to zero known vulns (2026-09-24)**: `npm audit --omit=dev` went from **12 findings (3 moderate / 8 high / 1 critical)** to **0**. The critical was **Next.js itself** — `16.2.9` sat inside the affected range (unauth RCE in the Image Optimization API when AVIF is used, unauth RCE on Windows-hosted servers, middleware/proxy bypass, SSRF in Server Actions + rewrites, internal Server Function disclosure), and this app accepts AVIF uploads, so the bump to **16.3.6** also cleared the nested `postcss` findings. Also: `sharp` ^0.34.5 → **0.35.4** (libvips/libheif CVEs, reached by uploaded images; it backs `scripts/generate-og.mjs` + the OG API test + Next's image optimizer), `nodemailer` ^9.0.4 → **10.0.10** (the advisories cover `<=9.1.0`, so no in-range fix existed — this was a MAJOR bump, re-verified through the OTP/reset mailer paths), and `npm audit fix` cleared the rest (`@xmldom/xmldom`, `brace-expansion`, `dompurify`, `fast-uri`, `fflate`, `nanoid`, `baseline-browser-mapping`). `xlsx` has **no npm fix at all**: npm's registry copy is abandoned at 0.18.5 (prototype pollution + ReDoS) while SheetJS publishes to `cdn.sheetjs.com` — replaced with the official **vendored** tarball `vendor/xlsx-0.20.3.tgz` (sha256 `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`, 2.4 MB), declared as `file:vendor/...` so CI's `npm ci` never depends on a third-party CDN. It installs under the module name `xlsx`, so the two export call sites (`reports-export-menu.tsx`, `use-data-export.ts`) needed **no code change** — verified by a runtime workbook build/read roundtrip. Remaining **9 dev-only** findings (`@vitest/mocker`, `deepmerge-ts`, `valibot`) all need `npm audit fix --force` major bumps of vitest/Storybook and are accepted
- [x] **Two Windows/dev-harness traps that cost real time (2026-09-24)**: (1) `npm install` **RE-RESOLVES `^` ranges** even when the lockfile was consistent, so it floated `@storybook/nextjs-vite` 10.5.3 → 10.6.0 while `storybook` core stayed 10.5.3 — and 10.6.0 demands core `^10.6.0`, which broke Vitest's startup entirely (`storybook/internal/common` does not provide an export named `findTsconfigPathForFile`). Any Storybook-family skew shows up as a *startup* error for the whole unit suite, not a test failure. Fix: keep `storybook` core at/above what its addons require (now ^10.6.0). (2) Playwright's config has `reuseExistingServer: !CI`, so it will happily use an ALREADY-RUNNING :3010 server — and a plain `npm run dev` server is missing the E2E harness env, which fails 7 specs in confusing ways: the inline `data-testid="dev-otp"` and the account-recovery confirm link only render when the mailer is BLANKED, the copilot asserts need `AI_MOCK=1`, and `/api/auth/login` returns **429** without `E2E_LOGIN_THROTTLE_LIMIT=500`. Always start the E2E server via `node scripts/e2e-local.mjs dev` (it sets all four). Also note `npm install` fails with EPERM on Windows while a dev server holds the `@next/.swc-*` binary and the Prisma query-engine DLL — stop :3010 first
- [x] **Strict-mode flake: the login page can hold TWO email inputs at once (2026-09-24)**: `auth-locale-smoke` failed on `locator('input[type="email"]')` with "strict mode violation: resolved to 2 elements" — the login page swaps views (returning-user chooser / login / forgot-password) through `motion`, and AnimatePresence keeps the OUTGOING view mounted while it animates out, so both an email input from the exiting view and the sign-in form's coexist for that beat. Playwright strict mode counts HIDDEN elements too, so the failure depends purely on animation timing (it passed for months and only surfaced after the Next 16.3.6 bump shifted hydration/animation timing). FIX: `signInEmailField(page)` in `e2e/helpers.ts` scopes to `form:has(input[type="password"]) input[type="email"]` — the password field is unique to the sign-in form — and it is used by `loginAs` (~25 specs) plus every spec that hand-rolled the login fill (`2fa-modal-mobile`, `account-recovery`, `backup-code-login`, `forgot-password`, `login`, `passkey-passwordless`, `passkey-second-factor`, `recovery-readiness`, `session-expiry-force-close`, `spare-authenticator`, `two-factor-auth`, `auth-locale-smoke`). The narrow `await page.locator('input[type="email"]').fill(email)` had been copy-pasted into 12 specs — remember to scope any new auth fill the same way. SECOND LAYER (same day, gate 6): the scoped locator can STILL double-match when a long-lived dev server keeps a stale hidden copy of the sign-in form mounted (gate 6's `two-factor-auth:157` failed on `form:has(input[type="password"]) input[type="email"]` resolving to 2, yet the ARIA snapshot showed one form and a live probe in the failing flow found exactly one — the twin never reaches the a11y tree, and the spec passed 6/6 with a fresh server). FIX: the helper (and every hand-rolled copy, now `form:visible:has(input[type="password"]) input[type="email"]`) restricts to VISIBLE forms, and local gate runs restart the harness dev server before a full suite instead of reusing one across many suites
- [x] **CI-vs-local E2E asymmetry: five reds that only exist on a fresh database (2026-09-24)**: the PR's E2E gate failed 5 tests that all pass locally — and they were a strict SUBSET of main's 20 CI reds (compare `playwright-test-results` artifacts across runs; the branch's locator hardening had already repaired 15 of main's). All five shared one shape: the local machine carries state a per-run CI database does not. (1) `prisma/seed.ts` read `affiliatePlatform.findMany` but NEVER created one, so on an empty DB both affiliate blocks silently skipped — no conversions, no `PAY-SEED-SCHEDULED` JSON payout, empty tabs the spec asserts on. (2) The scheduler ledger lives in `data/scheduler-runs.json` (gitignored runtime store), absent on fresh checkouts, so the backup-verify row rendered "never" instead of green; the seed now plants a green entry OUTSIDE the affiliate conditional (nesting it there recreates the silent-skip class) and never overwrites a real recorded run. (3) `test.use({ ...devices["iPhone 13"] })` silently switches the browser to WEBKIT (the descriptor's `defaultBrowserType`) while CI installs only chromium → `browserType.launch: Executable doesn't exist`; keep the device metrics, pin `defaultBrowserType: "chromium"`. (4) The roles tab bar overflows 2px on Ubuntu font metrics vs a 1px allowance (the test's own comment admits it exists for this drift). VERIFICATION TECHNIQUE that finally reproduces CI locally: create a scratch database on the local Postgres (`CREATE DATABASE nextdashboard_scratch_ci`), `prisma db push` + `db:seed` against it, boot the harness server with `DATABASE_URL` pointed at it, run the failed specs — this caught a SIXTH latent red the first artifact diff missed (`affiliates-platform-icons` expects the full six-platform catalog with `baseUrl`), before another 27-minute CI round-trip. Seed the FULL catalog (TikTok Shop/Shopee/Tokopedia/Facebook/Instagram/Lazada with brand colors + baseUrl), not a minimal guess — the specs pin the whole contract
- [x] **Duplicate verification toasts had THREE sources; ownership is now explicit (2026-09-24)**: `profile-email-verification` failed with a strict-mode violation — THREE toasts for one bad confirm link: the profile page's own `?verified` effect, the Security Center's equivalent, AND `VerificationSuccessToaster` (mounted once in `providers.tsx` but its effect re-ran and its strip was ASYNC `router.replace`, so the marker was still in the URL on the re-run → second fire; StrictMode dev adds a third). The pages' own `history.replaceState` strips are synchronous and fire exactly once — they were never the problem. FIX: `?verified=true|invalid` is OWNED by the landing pages (the confirm route's `from` whitelist only redirects to `profile|security`, so every landing page has a handler); the global toaster keeps only redirect-only markers (`?verification=success` — helper-emitted, no landing page — plus `?2fa=enabled|disabled`, `?password=changed`) and strips THEM synchronously via `history.replaceState`. Note the global texts differ from the page ones ("Email verified successfully — your account is now fully secured." vs "Email verified successfully!") and E2E asserts the page ones. 5 regression tests in `verification-success-toaster.test.tsx` pin the ownership split (page-owned marker → no fire; redirect-only → fire once + survive a re-render)
- [x] **Local production smoke test, and the scheduler trap in it (2026-09-24)**: `npm run build` → `npx next start -p 3010` → `BASE_URL=http://localhost:3010 node scripts/production-smoke-test.mjs` = **5/5 checks pass** (health + DB latency, security headers, landing page, inbound webhook route, compliance-pack API) on Next 16.3.6. TRAP: `next start` sets `NODE_ENV=production`, which **activates the in-app scheduler** (`src/lib/scheduler.ts` runs when `SCHEDULER_ENABLED=1` **or** production) — so a naive local smoke test can email real recipients and create payout rows. Blank `RESEND_API_KEY`/`SMTP_HOST`/`EMAIL_TRANSPORT` in the child process env for any local production run (Next does not override already-set env vars)
- [x] **The ~90 MB CI logs (and the cold-wait flakes) were a Tailwind v3/v4 mismatch, not test output (2026-09-24)**: every E2E job log was 81–95 MB and would not download inside `gh`'s timeout, and the failure text was buried under ~43,999 `Unknown at rule: @theme` warnings per job. Cause: `src/app/globals.css` carried a Tailwind **v4** `@theme inline { … }` block while the pipeline is Tailwind **v3** (`postcss.config.mjs` runs `tailwindcss` + tailwind.config.ts is v3-shaped), so v3 passed the v4 at-rule through verbatim and Next/lightningcss rejected it on EVERY client CSS transform — one warning storm per compile, with the dev server competing against its own stdout while specs waited on cold compiles. FIX: move the four `@keyframes` (shimmer-slide, spin-around, marquee, marquee-vertical) to the top level and delete the wrapper. BONUS BUG the wrapper was hiding: `animate-shimmer-slide`/`animate-spin-around`/`animate-marquee(-vertical)` were never real v3 utilities (no `theme.extend.animation` entries), so `ShimmerButton` and `Marquee` rendered motionless — they are now declared in `tailwind.config.ts`. VERIFY with a fresh dev server + a few curls: warning count 43,999 → **0**, dev log 23 lines. Practical lesson: fetch a CI job log's SIZE first (`gh api .../actions/runs/<id>/artifacts`) and prefer the small `playwright-test-results` artifact for the failing spec's name/error over the log stream
- [x] **`x ?? null` is a silent attribution killer; the resolver is now CENTRAL (2026-09-24)**: sweep + report script (`npm run check:null-coercion`, 130 sites / 61 files) for the pattern where a DEFINED null is handed to something that reads ABSENCE as "derive it". Fixes: (1) `src/lib/activity-audit.ts` wrote `tenantId: session.user.tenantId ?? null`, so an actor-bearing `ActivityLog` row (every delete/revoke recorded by a session whose JWT carried no tenant claim) landed with no tenant and was invisible to the tenant-scoped `/en/audit-log` read; (2) `src/app/api/billing/webhook/route.ts` used `checkout.metadata?.tenantId ?? null` and `sub.metadata?.tenantId ?? null` — Stripe sessions created before the tenant was stamped wrote `AuditLog` rows belonging to nobody. Rule now used everywhere: **non-null claim wins, nullish resolves from the actor** via the single shared `resolveUserTenantId()` in `src/lib/tenancy.ts` (also adopted by `security-events.ts` and `usage-digest.ts`, which each had their own copy). Regression tests: `src/lib/__tests__/tenant-attribution-writers.test.ts` (7) + two cases in `src/app/api/__tests__/stripe-billing.test.ts` pinning "resolves when metadata omits the tenant" AND "an explicit tenant still wins without a lookup". Note `src/lib/audit-hash.ts` must KEEP its explicit nulls — there a null is data (it changes the hash). Also fixed: `src/lib/__tests__/*` runs under `vitest.components.config.ts` and `src/app/api/__tests__/*` under `vitest.api.config.ts` — the DEFAULT `vitest run` excludes both `__tests__` globs, so a bare `npx vitest run <path-in-__tests__>` reports "No test files found"
- [x] **"Users don't receive mail" was a configuration trap the repo documented and then shipped (2026-09-25)**: the production-shaped env (`.env.remote-supabase.bak`) sets `EMAIL_TRANSPORT=resend` with `RESEND_FROM="Next Dashboard <onboarding@resend.dev>"` — Resend's SANDBOX sender, which delivers only to the Resend account owner's own address and rejects every other recipient while the app reports success (the file's own comment warns about exactly this). Two structural faults made it silent: (1) the send was awaited INSIDE the request, and a cold SMTP/TLS handshake to Gmail measured **15.9s** here — longer than a serverless function budget, so a killed attempt lost the message after the user was told to check their inbox (the transport itself works: `scripts/verify-mail.ts` performed a real delivery, then 5.4s warm); (2) nothing retried, so one 429/timeout/4xx lost the mail permanently. FIXES: `src/lib/email.ts` classifies failures (`isTransientMailError`: ETIMEDOUT/ECONNRESET/4xx/429/5xx retryable; invalid-from/unverified/sender/sandbox/SMTP-5xx not) and retries transient ones with backoff (250ms/750ms); `describeMailConfiguration()` resolves the transport the way a send will, and refuses to hand a real recipient to the sandbox sender — with SMTP available it RESCUES to SMTP and logs the exact remediation (verify a domain in Resend, then set `RESEND_FROM`/`EMAIL_FROM`), and the SMTP path sends as the authenticated account rather than as `@resend.dev` (Gmail rewrites a From it does not own); an explicit `EMAIL_TRANSPORT=resend` is still honoured for a real sender. NEW `src/lib/email-outbox.ts` + `EmailOutbox` (migration `20260925000000_add_email_outbox`): rows are durable BEFORE any transport is touched, delivery runs off the response path via `after()` (inline outside a request), a claim lease (`claimedAt`, 2min) lets the fast path and the sweep coexist without double-sending, transient failures return with exponential backoff (1min base, 5 attempts max), permanent ones are recorded once, and `verify_email` rows are RE-ISSUED at delivery time (fresh code + hash) instead of a one-time code ever reaching the table; the scheduler gained an `email-outbox` job on its 5-minute tick (mirrors `webhook-retry`, and `e2e/scheduler-status-card.spec.ts` pins the registry). Routes now return `emailQueued` beside `emailSent`, plus `mailMisconfigured` when the configuration cannot reach real recipients — register/login warn instead of promising an inbox message (new i18n key `auth.emailDeliveryMisconfigured` ×4) and the verify-email route stops printing a one-time code to the server log when the message is merely queued. `.env.example` was GITIGNORED (`.env*` with no negative rule), which is why a fresh clone never learned the mail keys existed — it now documents them and is tracked again. TESTS: `src/lib/__tests__/email-transport.test.ts` (11 — sandbox rescue, override preserved, ECONNRESET retried ×3, 550 not retried, Resend 429 retried ×3) + `src/lib/__tests__/email-outbox.test.ts` (11 — durability before transport, supersede of an older code, SENT / PENDING+backoff / FAILED-permanent / exhausted, stored hash matches the code actually sent, lost claim skipped, lease reclaim, health counters). Two real bugs found by writing those tests: `deliverRow` dropped the transport's failure reason (so nothing could be classified or recorded), and the SMTP rescue would have sent AS the `@resend.dev` placeholder. 731 API tests, 170 i18n tests, `tsc` clean.
- [x] MFA-verification status tracked via `MFA_VERIFIED` security event (logged on TOTP/backup-code login + step-up TOTP) → `mfaVerifiedRecently` feeds the security score
- [x] Passkeys card warns before removing the last remaining passkey + hints to add a backup key
- [x] Email verification built end-to-end: send/confirm routes, Security Center card, score weight, `EMAIL_VERIFIED` event, toast-on-return, fresh-user E2E flow
- [x] Resend cooldown (60s) on the email-verification card: countdown button + note, localStorage-persisted so refresh can't bypass it, unit-tested (blocked-storage safe)
- [x] `useResendCooldown` made configurable (`{ durationSeconds?, storageKey? }`, defaults preserved) with 6 dedicated hook tests; forgot-password page reuses it with its own storage key — submit disabled during cooldown, sent view gains a Resend Link action that re-POSTs and restarts the countdown, restored cooldown blocks resubmit on refresh; 5 page tests + auth-namespace i18n keys in all 4 locales
- [x] `profile-email-verification.spec.ts` E2E: fresh user (registers + skips signup OTP) → profile shows unverified card → send → inline dev link + 60s cooldown → confirm-link redirect back to the profile (`/en/profile?verified=true`) + success toast → verified badge / "Verified on" / green card; invalid-token test redirects to the profile with `?verified=invalid` + error toast, still unverified (uses `exact: true` because "Unverified" substring-matches "Verified"; asserts the profile path, not the query, because the page strips it via `history.replaceState`); also covers the `?verified=true` handler directly — server-side OTP verification (via `page.request` sharing the session cookie: `/send` returns `devOtp`, then `/otp` with `{ code }`) + direct `?verified=true` navigation shows the toast, strips the param (`/en/profile$`), and shows the verified UI, plus a negative test proving the param alone never fakes verification (status is server-truth from the re-fetch)
- [x] Origin-aware email-verification redirect: `verify-email/send` accepts a whitelisted `from` hint ("profile" | "security") and forwards it into the confirm URL; `verify-email/confirm` redirects to `/{locale}/{from}?verified=...` (success + failure) instead of always the Security Center. Whitelist lives in `src/lib/email-verification.ts` (`VERIFY_EMAIL_REDIRECT_PAGES` + `sanitizeVerifyEmailRedirect`, fallback `security` for unknown/missing values → register-page resend + old links stay backward compatible, no open redirect). Profile page sends `from: "profile"`, Security Center card sends `from: "security"`; 3 lib sanitizer tests, component tests updated for the request body
- [x] Profile page email-verification status fully wired to the new routes: sends `{ locale }` (correct-language confirm link), handles `?verified=true|invalid` toasts, shares the cooldown hook with the Security Center card (one localStorage key blocks both surfaces), `alreadyVerified` short-circuits without a cooldown; 4 new unit tests
- [x] Real email verification (SMTP-first + 6-digit OTP): `src/lib/email-otp.ts` (SHA-256 hash, timing-safe verify, 10-min TTL, 5-attempt cap) + `src/lib/email.ts` SMTP transport (nodemailer, lazy import) → Resend → console fallback (`sendOtpEmail`/`sendPasswordResetEmail`; dead `sendVerificationEmail` removed), `src/lib/email-verification.ts` `issueEmailOtp`/`isDevFallbackAllowed`; User schema + `emailOtpHash/emailOtpExpires/emailOtpAttempts`; register issues an OTP best-effort + returns `emailOtpRequired`/`devOtp`, verify-email send issues OTP+link, new `/api/auth/verify-email/otp` route (error codes OTP_INVALID/EXPIRED/TOO_MANY_ATTEMPTS/NOT_REQUESTED + attemptsLeft); register page inline OTP step with dev-code display + "Skip for now" soft gate; Security Center card OTP entry + unverified-email alert banner; register response strips all secrets (password/totpSecret/verificationToken/emailOtp*)
- [x] Full locale-parity test (`src/i18n/__tests__/locales-parity.test.ts`) guards every namespace across en/id/ja/zh (fixed pre-existing gaps: `pricing` namespace + `orders` keys missing in ja/zh)
- [x] i18n sweep: all dashboard pages (sales/inventory/customers/products/marketing) + shared `DataExportButton` fully localized
- [x] E2E workflow verified locally with `act` v0.2.89: full `e2e.yml` job run in a Docker container (Postgres 16 service → npm ci → prisma db push → playwright install → db:seed → test:e2e) = **34/34 pass**, artifact uploads included (needs `--artifact-server-path`). The run exposed a fresh-DB bug that would have failed real CI: seed created no tenant → SSO connections 400'd on a fresh DB (masked locally by leftover dev tenants). `prisma/seed.ts` now creates the default tenant and assigns seeded users to it
- [x] Dedicated i18n locale-parity CI job (`.github/workflows/i18n.yml` + `test:i18n` script): catches missing translations on every push/PR in ~1 min instead of only via the full component suite or main-only ci.yml. Verified with act (Job succeeded). Note: parity tests run under `vitest.components.config.ts` because the node config excludes `**/__tests__/**`
- [x] E2E gates semantic-release: ci.yml gains a main-push-only `e2e` job ("Playwright E2E (release gate)") added to `release.needs` — a failed E2E run blocks the release. Kept e2e.yml for every-branch coverage (cross-workflow `needs` unsupported; suite intentionally runs twice on main pushes). Validated: YAML parses, all `needs` references resolve, `act -l` lists the new job. Later deduped: the e2e job body moved to `.github/workflows/e2e-reusable.yml` (`workflow_call`, inputs for node-version/artifact-suffix/DB+secret placeholders) and both e2e.yml + the ci.yml gate call it (gate uses `artifact-suffix: "-gate"`) — verified end-to-end with act through the caller→reusable chain (Job succeeded; 34 tests: 33 passed + 1 known-flaky forgot-password full-flow)
- [x] Fixed the flaky `forgot-password` full-flow E2E test (was the last remaining flake in the container run): `requestResetLink` now sets up `page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/api/auth/forgot-password'))` BEFORE clicking, awaits it, asserts `response.ok()`, then asserts the sent view — the response wait rides the 30s+ test timeout while `expect` caps at 10s, so the cold-container first-hit route compile can't blow the assertion anymore; the full-flow test also calls `test.setTimeout(45_000)`. Verified: eslint + spec-level tsc clean, 4/4 local pass, and a full act container run = **34 passed, 0 flaky, 0 failed** (full-flow passed first attempt at 17.4s, no retry)
- [x] Option 1: Customer Cohort Retention & LTV:CAC Heatmap Engine (`/analytics`): dynamic 12-month cohort retention matrix ($M_0 \to M_{11}$), LTV vs. CAC payback curve with payback period calculation, RFM segmentation (`Champions`, `Loyalists`, `Potential`, `At-Risk`, `Hibernating`), `src/lib/cohort-analytics.ts`, `src/components/analytics/cohort-retention-heatmap.tsx`, and `/api/analytics/cohorts` endpoint; 9 unit tests passing.
- [x] Option 2: Team Chat Alert Hub for Slack & Discord (`/integrations` & `/notifications`): outgoing webhook connectors with Block Kit & Discord Embed formats, automated trigger rules (Critical Stockout, VIP Order, Payment Settlement Failure, Daily Standup Digest), interactive test dispatcher, persistent audit trail (`data/chat-alerts.json`), `src/lib/chat-alerts.ts`, `src/lib/chat-alerts-store.ts`, `src/components/integrations/chat-alerts-hub.tsx`, and `/api/integrations/chat-alerts` + `/test` endpoints.
- [x] Option 3: Global Multi-Currency & Real-Time FX Conversion Engine: multi-currency support for USD ($), IDR (Rp), JPY (¥), EUR (€), SGD (S$), `src/lib/currency.ts`, `CurrencyProvider` context & `useCurrency` hook with `localStorage` persistence, interactive currency switcher dropdown in header (`src/components/layout/currency-switcher.tsx`).
- [x] Option 4: Production Health Check & Telemetry API (`/api/health`): health check endpoint returning status, database connectivity & query latency, Node version, memory heap metrics (used/total), uptime, and table counts (`?deep=true`); full production build (`npm run build`) passing clean in Next.js 16 (Turbopack) with 0 errors.
- [x] Track 1: Autonomous AI Executive Copilot & 1-Click Action Proposals (`/dashboard` & Command Palette): natural language intent matching for at-risk VIP customers, ROAS performance, and inventory replenishment; dynamic 1-click action proposals (`LAUNCH_DISCOUNT`, `CREATE_PURCHASE_ORDER`), action proposal card UI, streaming drawer (`Cmd+J` / `Ctrl+J`), and authenticated execution endpoint (`/api/ai/actions/execute`).
- [x] Track 2: Omnichannel Inbound Webhook Sync Engine & Dead-Letter Queue (DLQ) (`/integrations` & `/orders`): HMAC-SHA256 signature verification for Shopify, TikTok Shop, Shopee, WooCommerce; normalized order ingestion; persistent DLQ store (`data/webhook-dlq.json`); test simulator, inspector, and replay API (`/api/webhooks/inbound/dlq`).
- [x] Track 3: Granular RBAC Matrix & SOC2 / ISO 27001 Compliance Center (`/security` & `/roles`): 7-action granular permissions matrix (`canPerformGranularAction`), impossible travel anomaly detector ($>900\text{ km/h}$), SHA-256 Merkle chain validation, and downloadable SOC2 compliance pack & printable certificate (`/api/security/audit/compliance-pack`).
- [x] Track 4: Containerized Cloud Deployment & Production Hardening: multi-stage Alpine Node 20 `Dockerfile`, `docker-compose.production.yml`, security headers in `next.config.ts` (HSTS, CSP, X-Frame-Options, X-Content-Type-Options), and automated deployment smoke test runner (`scripts/production-smoke-test.mjs`).
- [x] E2E Comprehensive Suite: `e2e/comprehensive-journey.spec.ts` expanded to 16 complete user journeys — all 16 passing (100% in 2.1m). 100% key parity across all 4 locales (`en`, `id`, `ja`, `zh`) verified by `npm run test:i18n`. All 601 API tests passing across 17 test files (`npm run test:api`). Full production build (`npm run build`) verified clean.

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
npm run dev              # Start dev server → http://localhost:3010
npm run build            # Production build
npm test                 # Unit tests
npm run test:components  # Component tests
npm run test:all         # All tests
npm run coverage:all     # All tests + coverage report
```

### Port Convention
- **Dev server runs on port 3010** (not 3000). Configured via `-p 3010` in `package.json`'s `dev` script.
- This avoids conflicts with other local apps that commonly use port 3000.
- All config references (`NEXTAUTH_URL` in CI, README links, etc.) must use port 3010.

### Project Structure
```
src/
├── app/
│   ├── [locale]/
│   │   ├── (dashboard)/  # 19 dashboard pages
│   │   └── (marketing)/  # 5 marketing pages + tests
│   ├── api/              # 28 data routes + auth/SAML/AI
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
├── hooks/                # 5 custom hooks (auth, analytics, realtime, saas, ai-chat)
├── lib/                  # Utilities, auth0 stub, api-guard, permissions
├── i18n/                 # Locale config + en.json, id.json, ja.json, zh.json
└── middleware.ts         # i18n routing only
```

# CLAUDE.md - Development & Architecture Guide

## Overview
Next.js 16 (App Router, React 19) multi-tenant commercial analytics, billing, and enterprise operations dashboard with 100% full internationalization across English, Indonesian, Japanese, and Chinese.

## Core Commands
- `npm run dev`: Start Next.js development server on **port 3010** (`http://localhost:3010`) against the **local Postgres mirror** (`localhost:5432/nextdashboard`)
- `npm run build`: Production build with Turbopack
- `npm run test:i18n`: Verify 100% namespace and key parity across all 4 locales (`en`, `id`, `ja`, `zh`)
- `npx vitest run src/i18n/__tests__/ src/components/billing/__tests__/`: Run core component tests
- `npm run test:api`: Run API test suite
- `npm run test:all`: Run complete test suite across unit, component, and API tests
- `node scripts/production-smoke-test.mjs`: Execute production endpoint smoke tests
- **Database policy**: local development, seeding, and all CI run against the local Postgres mirror (`db:provision:local` provisions it). The remote Supabase Postgres is reserved for production deploys only — never point `.env.local` at the pooler for day-to-day dev (transaction-mode PgBouncer stalls Prisma introspection and brownouts break seeds).

## Architecture & Conventions

### 1. Mandatory i18n Protocol (Zero Exceptions)
- Supported locales: `en`, `id`, `ja`, `zh`.
- Default locale: `en`.
- Every user-facing string, modal, button, tooltip, and toast MUST be registered in `src/i18n/locales/{locale}.json` and consumed via `useTranslations` from `next-intl`.
- Every PR/commit must pass `npm run test:i18n` with 100% key parity across all 4 locales.

### 2. Standalone QRIS Commerce Engine & SSE Stream
- `src/lib/qris-engine.ts`: ASPI / Bank Indonesia standard QR code generation (`00020101021226...`), CRC16-CCITT checksum validation, transaction ledger, and fee calculation.
- `/api/billing/qris/stream`: Real-time Server-Sent Events (SSE) broadcasting `payment_confirmed`, `transaction_created`, and `withdrawal_completed` events.
- `/orders/[id]/pay`: Standalone customer checkout page with live countdown, ASPI QR, and auto-sensing payment confirmation.
- Counter Standee: Printable A5/A6 tabletop standee with Bank Indonesia / ASPI branding and NMID `ID1020084729101`.
- Disbursements: Supports Indonesian e-wallets (DANA, OVO, GoPay), national banks (BCA, Mandiri, BRI, BNI), and international rails (Visa/Mastercard OCT in USD, Alipay in CNY).

### 3. Media & Upload Architecture
- Maximum upload file size: **10MB** (`10 * 1024 * 1024` bytes).
- Supported formats: SVG (`image/svg+xml`), WebP, AVIF, PNG, JPEG, GIF.
- Vector SVG files must be preserved directly without rasterization to maintain crisp vector rendering on high-DPI displays.
- Upload routes: `/api/profile/avatar` and `src/components/product-image-manager.tsx`.

### 4. Vector Barcode & Dynamic Invoicing
- `src/lib/barcode.ts`: Pure TypeScript Code128-B vector barcode engine generating SVG and DataURLs without external dependencies.
- `src/components/billing/invoice-customizer-dialog.tsx`: Visual invoice template customizer in Billing -> Invoices tab.
- `/api/orders/[id]/invoice`: Renders high-res printable invoice with Code128 vector barcode, verification QR code, custom NPWP, and direct QRIS checkout link.

### 5. UI/UX & Appearance Synchronization
- Dynamic entity accents: Customer names, order numbers (`#orderNumber`), product titles, and campaign names dynamically inherit the user's custom accent color configured in Settings -> Appearance (`text-primary hover:underline font-semibold transition-colors`).
- Dropdown Menus: Radix UI `DropdownMenu` defaults to `modal={false}` and intercepts `onCloseAutoFocus` with `e.preventDefault()` to prevent body scroll locking and viewport auto-scrolling to top.

### 6. Multi-Currency Engine
- Supported currencies: USD ($), IDR (Rp), JPY (¥), EUR (€), SGD (S$), CNY (¥).
- Defined in `src/lib/currency.ts` with real-time conversion helper `convertAmount`.

### 7. Strict Anti-AI-Slop & Dynamic Theme Protocol
- No generic pill gradients (`from-indigo-500 to-purple-600`), no static hardcoded indigo/violet colors on custom surfaces.
- All cards, badges, buttons, borders, and rings must dynamically link to `--primary` design tokens (`text-primary`, `bg-primary`, `border-primary`, `ring-primary`).
- Natural language microcopy only — no robotic filler or unlocalized strings.

### 8. Indonesian Banking Directory & Beneficiary Tracking
- `src/lib/indonesian-banks.ts`: 50+ banks classified into 4 regions/categories (Himbara BUMN, Swasta Nasional, BPD 4 Macro-Regions, Digital Neobanks).
- `src/lib/account-validator.ts`: Real-time phone carrier detection (DANA, OVO, GoPay, LinkAja) and card BIN/Luhn check (Visa, Mastercard, GPN, JCB).
- `src/components/ui/bank-card-visual.tsx` & `src/components/ui/emoney-wallet-pass.tsx`: Tactile EMV physical card and mobile wallet pass design system.


### 9. Context7 (Up-to-Date API Reference) — Mandatory for Library Work
- The Context7 MCP server is configured in `.vscode/mcp.json` (`context7` server, run via `npx -y @upstash/context7-mcp@latest`). It resolves library IDs (`resolve-library-id`) and pulls version-matched docs/code samples (`query-docs`, e.g. libraryId `/vercel/next.js`, `/prisma/prisma`, `/tailwindcss/tailwindcss`).
- BEFORE writing code against any framework/package API (Next.js, Prisma, next-intl, Radix UI, framer-motion, recharts, stripe, midtrans, @react-pdf/renderer…), query Context7 to confirm the current signature instead of relying on training memory. If Context7 is unavailable, prefer reading `node_modules/<pkg>/README.md` and `*.d.ts` over guessing.
- Never invent icons/APIs that do not exist: brand artwork comes from the installed `thesvg` package (`node_modules/thesvg/dist/*.js`, verified slugs only); icon components live in `src/components/ui/brand-icons.tsx`.
# Changelog

All notable changes to this project are documented in this file.

## v2.0.0 — 2026-09-22

### 🔐 Login & Second-Factor Security

- **Verification-method chooser at sign-in** — accounts with more than one
  second factor pick how to verify: authenticator app, email one-time code,
  passkey, or a trusted device
- **Trusted devices** — "remember this device for 30 days" skips 2FA on
  sign-in; trust binds to the device + browser profile, is revocable from the
  Security Center, and a stolen cookie is useless on any other machine
- **Passkey second factor** — WebAuthn credential can be enrolled and used as
  a sign-in or step-up factor alongside TOTP
- **Single-use TOTP codes** — every accepted code claims its time step via a
  conditional write (per secret), so a replay answers `TOTP_REPLAY` and is
  logged as `MFA_CODE_REPLAYED` instead of "invalid"; one step of drift
  tolerance prevents 30-second clock-skew lockouts
- **Backup recovery authenticator** — enroll a spare TOTP secret so losing a
  phone no longer forces emailed account recovery
- **Recovery-code UX** — low/exhausted codes warn with one-click regeneration;
  retyping a code keeps it in the input after a rejection
- **Step-up account recovery** — a recovery flow for users who lost both
  their authenticator and recovery codes, with "this wasn't me" revoke mail
  whose confirm page can't be consumed by link prefetching
- **Destructive-action guards** — disabling 2FA or removing the last recovery
  path warns, shows the post-change readiness verdict, and requires an
  explicit acknowledgement (enforced server-side with `428
  RECOVERY_ACKNOWLEDGEMENT_REQUIRED`)
- Double-submit on the second-factor form is no longer possible

### 📈 Recovery Readiness Over Time

- `RecoveryReadinessSnapshot` records one verdict per account per day; a
  nightly `recovery-drift` job sweeps every account (visible in Settings and
  System health)
- Security Center panel shows a **30-day readiness sparkline** with gaps for
  missing days (no interpolation)
- Dropping from covered → fragile sends a same-day, deduped alert and records
  `RECOVERY_READINESS_DROPPED` in the activity feed
- **Readiness check** names the single next thing to fix (spare
  authenticator, usable codes, or verified email)

### 💱 Live Market-Rate Pricing

- **Mid-market FX from a three-provider chain** (ExchangeRate-API →
  currency-api → Frankfurter) with 10-minute caching, last-good fallback, and
  an all-six-currencies acceptance rule; the bundled table is flagged stale
  when the feed is down
- **Settlement-rail intelligence** — prices what a buyer actually pays
  (transfer service, e-wallet, bank TT, cross-border card, and the four
  national banks), recommending the cheapest rail with indicative spreads
- **Live rates app-wide** — dashboard stat cards, the ~38 `formatCurrency`
  call sites, the currency switcher (with live-rate provenance tooltip), and
  the invoice customizer all convert at the market number
- Pricing page gains a currency selector defaulting from the visitor's locale

### 🌐 Internationalization

- 100% namespace/key parity maintained across `en`, `id`, `ja`, `zh`; new
  surfaces localized at birth
- **Orphan-key guard** — CI fails when a component references a translation
  key no locale defines; a key absent from all four locales can't ship
- Localized transactional email layouts (verification mail)

### 🏗 Platform, CI & Ops

- **Postgres migration** of the JSON stores, tenant-scoped, with invoice
  snapshots; public API v1 surface with CSRF, trial and ops routes
- **PWA guard** — CI fails if a service worker registers outside a production
  build; API responses are never cached
- **Login-throttle-aware E2E** — helpers wait out the Retry-After window and
  auth specs spread across per-IP windows instead of contending
- **CI gate** — unit, component, i18n, and hermetic E2E suites run on every
  push; audit hash chain survives login throttling
- Theme reveal transitions verified from the dashboard header trio and the
  command palette (pinned by E2E)
- Brand-icon SSR/client markup pinned byte-equal by a regression test, with a
  dev-mode guard surfacing any live mismatch

### 🐛 Notable Fixes

- Fixed the login-throttle window breaking the security-audit hash chain
- Fixed hydration mismatches: footer `srcSet`, clock/random reads in render,
  thesvg markup drift
- Fixed keyboard semantics on the marketing FAQ
- Command-palette hover radius and language/notification tooltip polish

## v1.0.0 — 2026-07-22

### ✨ Design Token Documentation

- Created `DESIGN_TOKENS.md` — comprehensive reference for the premium design system
  - 14 sections covering all CSS custom properties, component classes, and usage patterns
  - Complete dark mode reference with light/dark value tables for every token
  - Appendix with file map and Tailwind v3/v4 compatibility note

### 🎨 Premium Design System (globals.css)

- **Vengeance UI classes:** `.vengeance-card`, `.vengeance-glass`, `.vengeance-card::before`
- **21st.dev-inspired classes:** `.gradient-border-card`, `.spotlight-card`, `.badge-premium`, `.glow-border`
- **Dashboard classes:** `.dashboard-card`, `.stat-card-premium`, `.double-bezel`, `.double-bezel-inner`
- **Surface layer classes:** `.fb-surface-*`, `.motion-spring-*`, `.shimmer`, `.press-scale`
- **Effect classes:** `.ambient-glow-indigo`, `.ambient-glow-purple`, `.pulse-dot`, `.mesh-gradient-dark/light`
- **Premium text gradients:** `.text-gradient-premium`, `.text-gradient-warm`, `.text-gradient-cool`, `.text-gradient-earth`
- **Sidebar:** `.sidebar-item`, `.sidebar-item-active`
- 20+ keyframe animations for hover states, shimmer, glow, and view transitions
- Dark mode overrides for every premium class
- Tailwind v4 `@theme inline` block for ShimmerButton animations

### 🧩 Enhanced Components

- **Button** (`button.tsx`): Added `premium` (gradient) and `glass` (frosted) variants, `xl` size
- **Card** (`card.tsx`): Refactored to use `.dashboard-card` CSS class with hover glow
- **Sidebar** (`sidebar.tsx`): Premium navigation with gradient icon, Pro badge, active state accent bar
- **Header** (`header.tsx`): Glass header with interactive particle background
- **Marketing page**: Premium hero with Particles, spotlight feature cards, gradient border CTA
- **Dashboard page**: Stat cards with gradient top bars, animated counters, spring-animated quick actions

### 🌗 Dark Mode Refinements

- Richer dark mode surfaces and brighter borders
- Lightened premium gradient for dark backgrounds
- Brighter ambient glows, glass effects, and hover states
- all premium component classes have complete `.dark` overrides

### ✨ Smooth Theme Transitions

- `ThemeTransitionWatcher` component detects `.dark` class toggles via MutationObserver
- All theme-affected properties transition smoothly in 350ms using `cubic-bezier(0.16, 1, 0.3, 1)`
- Removed `disableTransitionOnChange` from next-themes provider
- Transitions activate only during user-initiated theme switches
- CSS transitions applied to `background-color`, `border-color`, `color`, `box-shadow`, `background-image`, `fill`, `stroke`

### 🔍 Token Inspection

- `TokenInspector` component — Figma-style visual catalog of 28 premium tokens/classes
- Search filter, Light/Dark/System toggle, grid/list view modes, split view
- Available at `/en/design-tokens` route
- `ThemeShowcase` component with tabs for live preview, tokens, and component demos

### 📚 Storybook Integration

- Added Storybook with `@storybook/nextjs-vite` framework
- Dark mode decorator with toolbar toggle (Light/Dark)
- Viewport presets (mobile 375, tablet 768, desktop 1280)
- **Button stories:** 10 stories covering all 8 variants, 5 sizes, and design token annotations
- **Card stories:** 6 stories for subcomponents, dashboard-card, stat-card-premium, double-bezel, KPI row
- **Glass stories:** 6 stories for vengeance-glass, glass-panel, vengeance-card, gradient-border-card, spotlight-card
- **Design Tokens MDX:** Full documentation page with token catalog, class table, and usage patterns

### 🐛 Bug Fixes

- Fixed `ThemeTransitionWatcher` production bug: `initialized` ref caused MutationObserver to never be created on single mount
- Cleaned up unused CSS rule (dead `.dark .mesh-gradient` with no base class)
- Various unused import cleanups across components

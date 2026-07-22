# Changelog

All notable changes to the design system and premium UI components are documented in this file.

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

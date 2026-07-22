# Design System Tokens & Component Reference

> **Version:** 1.0.0  
> **Framework:** Next.js 16 + React 19 + Tailwind CSS 3 + Framer Motion 12  
> **Sources:** 21st.dev community registry patterns, Vengeance UI interaction design, shadcn/ui conventions  
> **Last Updated:** July 22, 2026  
> **Changelog:** [CHANGELOG.md](./CHANGELOG.md)

---

## Table of Contents

1. [CSS Custom Properties (Tokens)](#1-css-custom-properties-tokens)
2. [Component CSS Classes](#2-component-css-classes)
3. [Button Component API](#3-button-component-api)
4. [Card Component & Dashboard Cards](#4-card-component--dashboard-cards)
5. [Premium Surface & Glass System](#5-premium-surface--glass-system)
6. [Gradient & Text Effects](#6-gradient--text-effects)
7. [Spotlight & Mouse-Tracking Effects](#7-spotlight--mouse-tracking-effects)
8. [Motion Utilities & Keyframes](#8-motion-utilities--keyframes)
9. [Micro-Interactions](#9-micro-interactions)
10. [Sidebar & Navigation](#10-sidebar--navigation)
11. [Badge & Tag Styles](#11-badge--tag-styles)
12. [Background Effects](#12-background-effects)
13. [Dark Mode Reference](#13-dark-mode-reference)
14. [Usage Examples](#14-usage-examples)

---

## 1. CSS Custom Properties (Tokens)

All tokens are defined in `src/app/globals.css` within `@layer base`. Both `:root` (light) and `.dark` variants are provided.

### 1.1 Core Semantic Tokens

| Token | Light Value | Dark Value | Usage |
|-------|------------|-----------|-------|
| `--background` | `222 20% 97%` | `225 25% 7%` | Page background |
| `--foreground` | `225 25% 7%` | `210 40% 98%` | Primary text |
| `--card` | `0 0% 100%` | `225 20% 12%` | Card background |
| `--card-foreground` | `225 25% 7%` | `210 40% 98%` | Card heading text |
| `--primary` | `225 25% 7%` | `210 40% 98%` | Primary brand |
| `--primary-foreground` | `210 40% 98%` | `225 25% 7%` | Text on primary bg |
| `--secondary` | `210 20% 96%` | `224 18% 14%` | Secondary surface |
| `--secondary-foreground` | `225 25% 7%` | `210 40% 98%` | Text on secondary bg |
| `--muted` | `210 20% 96%` | `224 18% 14%` | Muted background |
| `--muted-foreground` | `225 15% 50%` | `225 10% 65%` | Muted/low-emphasis text |
| `--accent` | `210 20% 96%` | `224 18% 14%` | Accent surface |
| `--accent-foreground` | `225 25% 7%` | `210 40% 98%` | Text on accent |
| `--destructive` | `0 84% 60%` | `0 63% 31%` | Destructive/delete actions |
| `--destructive-foreground` | `210 40% 98%` | `210 40% 98%` | Text on destructive |
| `--border` | `225 15% 90%` | `225 15% 26%` | Default borders |
| `--input` | `225 15% 90%` | `225 12% 22%` | Form input borders |
| `--ring` | `225 25% 7%` | `210 40% 90%` | Focus ring |

### 1.2 Marketing Surface Tokens

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--surface-base` | `0 0% 100%` | `225 25% 7%` | Base marketing surface |
| `--surface-raised` | `220 20% 97%` | `224 20% 11%` | Elevated card surface |
| `--surface-strong` | `220 15% 93%` | `224 18% 14%` | Strong/active surface |
| `--border-muted` | `220 10% 88%` | `225 12% 22%` | Subtle, low-contrast borders |
| `--text-inverse` | `220 10% 40%` | `225 10% 80%` | Low-contrast body text |

### 1.3 Glow Color Tokens

| Token | Light | Purpose |
|-------|-------|---------|
| `--glow-indigo` | `226 70% 55%` | Feature cards, accents, spotlights |
| `--glow-emerald` | `160 84% 39%` | Success/growth metrics |
| `--glow-purple` | `271 81% 56%` | CRM, user features |
| `--glow-blue` | `221 83% 53%` | Security, info features |

### 1.4 Premium Design Tokens

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--radius-xl` | `1.25rem` | — | Card corner radius |
| `--radius-2xl` | `1.5rem` | — | Larger card radius |
| `--radius-3xl` | `2rem` | — | Hero/CTA radius |
| `--card-shadow` | `0 1px 3px ...` | `0 1px 3px ...` | Default card shadow |
| `--card-shadow-hover` | `0 8px 30px ...` | `0 8px 32px ...` | Card hover shadow |
| `--glass-bg` | `rgba(255,255,255,0.6)` | `rgba(10,11,16,0.8)` | Glass panel background |
| `--glass-border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.07)` | Glass panel border |
| `--glass-shadow` | `inset 0 1px 0 #fff.8` | `inset 0 1px 0 #fff.05` | Glass inner highlight |
| `--gradient-premium` | `#6366f1 -> #a855f7 -> #ec4899` | `#818cf8 -> #c084fc -> #f472b6` | Premium gradient |

### 1.5 Additional Gradients

| Variable | Value | Use Case |
|----------|-------|----------|
| `--gradient-warm` | `#f59e0b -> #ef4444` | Warn/alert gradients |
| `--gradient-cool` | `#3b82f6 -> #06b6d4` | Info/cool gradients |
| `--gradient-earth` | `#10b981 -> #6366f1` | Success/natural gradients |

### 1.6 Theme Animation Variables

Defined on the `.theme` class — must be applied to an ancestor element for `ShimmerButton` animations to work.

| Variable | Default Value | Used By |
|----------|-------------|---------|
| `--animate-shimmer-slide` | `shimmer-slide var(--speed) ease-in-out infinite alternate` | `ShimmerButton` |
| `--animate-spin-around` | `spin-around calc(var(--speed) * 2) infinite linear` | `ShimmerButton` |
| `--speed` | (set inline on component) | `ShimmerButton` spark duration |

---

## 2. Component CSS Classes

All utility classes are defined in `src/app/globals.css` under `@layer components`.

### 2.1 Core Component Classes

| Class | Purpose | File |
|-------|---------|------|
| `.dashboard-card` | Base card wrapper with hover glow | `card.tsx` |
| `.stat-card-premium` | Dashboard stat card with gradient top bar | `dashboard/page.tsx` |
| `.double-bezel` | Nested card with outer/inner surface layers | `marketing/page.tsx` |
| `.double-bezel-inner` | Inner content area of double-bezel | `marketing/page.tsx` |
| `.vengeance-card` | Hover-lift card with gradient border shine | `marketing/page.tsx` |
| `.vengeance-glass` | Premium frosted glass panel | `marketing/layout.tsx` |
| `.gradient-border-card` | Card with gradient border (visible on hover) | `marketing/page.tsx` |
| `.spotlight-card` | Card with mouse-tracking spotlight overlay | `marketing/page.tsx` |
| `.glass-panel` | Frosted glass surface with backdrop blur | `marketing/layout.tsx` |
| `.badge-premium` | Inline badge/tag with indigo tint | `marketing/page.tsx` |
| `.sidebar-item` | Navigation item with hover highlight | `sidebar.tsx` |
| `.sidebar-item-active` | Active navigation item with left bar | `sidebar.tsx` |
| `.pulse-dot` | Animated broadcasting indicator | `marketing/page.tsx` |

### 2.2 Surface Layer Classes

| Class | Effect |
|-------|--------|
| `.fb-surface-base` | Background set to `--surface-base` |
| `.fb-surface-raised` | Background set to `--surface-raised` |
| `.fb-surface-strong` | Background set to `--surface-strong` |
| `.fb-border-default` | Border color set to `--border` |
| `.fb-border-muted` | Border color set to `--border-muted` |
| `.fb-text-primary` | Text color set to `--foreground` |
| `.fb-text-inverse` | Text color set to `--text-inverse` |

---

## 3. Button Component API

**File:** `src/components/ui/button.tsx`

### Variants

| Variant | Light Style | Dark Style | Use Case |
|---------|-----------|-----------|----------|
| `default` | `bg-indigo-600` | `dark:bg-indigo-500` | Primary actions |
| `destructive` | `bg-red-600` | `dark:bg-red-600` | Delete/danger |
| `outline` | `border-gray-300` | `dark:border-gray-600` | Secondary actions |
| `secondary` | `bg-gray-100` | `dark:bg-gray-800` | Medium emphasis |
| `ghost` | Transparent hover | Transparent hover | Toolbar, icon buttons |
| `link` | `text-indigo-600` | `dark:text-indigo-400` | Inline/text links |
| `premium` | Gradient indigo->purple->pink | Lightened dark gradient | Hero CTAs, emphasis |
| `glass` | White/70 + backdrop blur | White/10 + backdrop blur | Overlay, navigation bars |

### Sizes

| Size | Height | Purpose |
|------|--------|---------|
| `default` | `h-10` | Standard buttons |
| `sm` | `h-9` | Compact actions |
| `lg` | `h-11` | Prominent CTAs |
| `xl` | `h-12` | Hero/landing page CTAs |
| `icon` | `h-10 w-10` | Icon-only buttons |

### Specialized Button Components

| Component | File | Style |
|-----------|------|-------|
| `ShimmerButton` | `ui/shimmer-button.tsx` | Sparkle/shine with CSS conic gradient; requires `.theme` ancestor |
| `PopButton` | `ui/pop-button.tsx` | 3D pressable with layered shadow (pink theme) |
| `MagneticButton` | `marketing/page.tsx` (inline) | Follows cursor with spring physics, wrapper around `Button` |

---

## 4. Card Component & Dashboard Cards

**File:** `src/components/ui/card.tsx`

### Subcomponents

| Component | Element | Default Classes |
|-----------|---------|-----------------|
| `Card` | `div` | `.dashboard-card` |
| `CardHeader` | `div` | `flex flex-col space-y-1.5 p-6` |
| `CardTitle` | `h3` | `text-lg font-semibold leading-none tracking-tight` |
| `CardDescription` | `p` | `text-sm text-gray-500 dark:text-gray-400` |
| `CardContent` | `div` | `p-6 pt-0` |
| `CardFooter` | `div` | `flex items-center p-6 pt-0` |

### Dashboard Card (`.dashboard-card`)

```css
background: hsl(var(--card));
border: 1px solid hsl(var(--border));
border-radius: var(--radius-xl);
transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
```

**On hover** -> border glows with indigo tint, subtle shadow lift.

### Premium Stat Card (`.stat-card-premium`)

```css
background: hsl(var(--surface-raised));
border: 1px solid hsl(var(--border-muted));
border-radius: var(--radius-xl);
padding: 1.5rem;
overflow: hidden;
```

**On hover** -> lifts 4px, reveals gradient top bar via `::before` pseudo-element.

### Double-Bezel Card (`.double-bezel` + `.double-bezel-inner`)

A nested card structure:
```html
<div class="double-bezel">
  <div class="double-bezel-inner">
    <!-- content -->
  </div>
</div>
```

- Outer shell: dark surface with shadow
- Inner shell: raised surface with inset highlight
- Creates a premium "inset" card appearance

---

## 5. Premium Surface & Glass System

### Vengeance Card (`.vengeance-card`)

Premium card with hover-lift and animated gradient border:

| State | Behavior |
|-------|----------|
| **Default** | Flat card with subtle shadow |
| **Hover** | Lifts 4px, shadow deepens, gradient border fades in via `::before` |
| **Dark hover** | Stronger gradient opacity (15% vs 8%) |

### Vengeance Glass (`.vengeance-glass`)

```css
background: var(--glass-bg);
backdrop-filter: blur(24px) saturate(1.8);
border: 1px solid var(--glass-border);
```

Use for: navigation bars, modals, floating panels, command palettes.

### Gradient Border Card (`.gradient-border-card`)

Card with hidden gradient border that reveals on hover:

```css
/* Uses mask-composite: exclude to create 1px gradient border */
background: linear-gradient(135deg, indigo, purple, blue);
-webkit-mask-composite: xor;
```

| State | Behavior |
|-------|----------|
| **Default** | Border hidden |
| **Hover** | Gradient border fades in (light: 30% opacity, dark: 50% opacity) |

### Glass Panel (`.glass-panel`)

Standard frosted glass for marketing nav:
- Backdrop blur: `24px`
- Light: white 60% bg, dark: near-black 75% bg
- Inner top highlight for depth

---

## 6. Gradient & Text Effects

### Gradient Text Classes

| Class | Gradient | Example |
|-------|----------|---------|
| `.text-gradient-premium` | Indigo -> Purple -> Pink | Hero headings |
| `.text-gradient-warm` | Amber -> Red | Alerts, promotions |
| `.text-gradient-cool` | Blue -> Cyan | Technical features |
| `.text-gradient-earth` | Emerald -> Indigo | Growth metrics |

Usage:
```html
<h1 class="text-gradient-premium text-5xl font-bold">
  Operate with precision.
</h1>
```

### Badge Premium (`.badge-premium`)

```css
background: hsl(var(--glow-indigo) / 0.08);
color: hsl(var(--glow-indigo));
border: 1px solid hsl(var(--glow-indigo) / 0.15);
border-radius: 9999px;
padding: 0.125rem 0.625rem;
font-size: 0.6875rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
```

**Dark mode:** Background at 18% alpha, text at 70% lightness for better contrast.

---

## 7. Spotlight & Mouse-Tracking Effects

### Spotlight Card (`.spotlight-card`)

Card with radial gradient overlay that tracks the mouse position:

```css
.spotlight-card::after {
  background: radial-gradient(
    800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    hsl(var(--glow-indigo) / 0.06),
    transparent 40%
  );
}
```

**Implementation pattern:**
```tsx
<div
  className="spotlight-card"
  onPointerMove={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--mouse-x", `${px}%`);
    e.currentTarget.style.setProperty("--mouse-y", `${py}%`);
  }}
>
  {children}
</div>
```

### Spotlight Navbar (`.spotlight-nav`)

**Component:** `src/components/ui/spotlight-navbar.tsx`

A navigation bar with a moving spotlight that follows the mouse cursor and a persistent ambience indicator on the active item.

| CSS Variable | Description |
|-------------|-------------|
| `--spotlight-x` | Radial gradient X position (follows mouse) |
| `--ambience-x` | Active item underline X position (animated with framer-motion) |

```css
/* Spotlight follows mouse */
background: radial-gradient(120px circle at var(--spotlight-x) 100%, rgba(0,0,0,0.1) 0%, transparent 50%);

/* Active item ambience */
background: radial-gradient(60px circle at var(--ambience-x) 0%, rgba(0,0,0,1) 0%, transparent 100%);
```

**Dark mode:** Spotlight uses `rgba(255,255,255,0.15)`, ambience uses `rgba(255,255,255,1)`.

### Displacement Hover (`.displacement-hover`)

Subtle 3D tilt effect on hover:
```css
.displacement-hover:hover {
  transform: scale(1.03) translateY(-2px);
  filter: brightness(1.05) contrast(1.05);
}
```

---

## 8. Motion Utilities & Keyframes

### Motion Classes

| Class | Curve | Duration | Use |
|-------|-------|----------|-----|
| `.motion-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | `0.5s` | General transitions |
| `.motion-spring-fast` | `cubic-bezier(0.16, 1, 0.3, 1)` | `0.3s` | Hover, micro-interactions |
| `.motion-spring-slow` | `cubic-bezier(0.32, 0.72, 0, 1)` | `0.7s` | Page entrances |
| `.motion-enter` | Pre-mount (hidden) | -- | Initial state |
| `.motion-enter-active` | Post-mount (visible) | `0.6s` | Final state |

### Framer Motion Variants (in `src/components/motion.tsx`)

| Variant | Behavior |
|---------|----------|
| `fadeIn` | Opacity 0->1, Y 24->0 |
| `fadeInUp` | Opacity 0->1, Y 40->0 with stagger delay |
| `fadeInLeft` | Opacity 0->1, X -30->0 |
| `fadeInRight` | Opacity 0->1, X 30->0 |
| `scaleIn` | Opacity 0->1, scale 0.9->1 |
| `staggerContainer` | Staggers children by 0.1s |
| `cardHover` | Scale 1->1.02, Y 0->-4 on hover |

### Reusable Motion Components

| Component | Props | Description |
|-----------|-------|-------------|
| `AnimateSection` | `className` | Fade-in section on scroll |
| `AnimateUp` | `className, delay, as` | Fade-up child element |
| `StaggerGrid` | `className` | Stagger container for grids |
| `StaggerItem` | `className` | Individual stagger child |
| `HoverCard` | `className` | Wrapper with lift shadow on hover |

### Spring Presets (used in `marketing/page.tsx`)

| Preset | stiffness | damping | Use |
|--------|-----------|---------|-----|
| `springGentle` | 100 | 20 | Feature cards, general |
| `springSnap` | 200 | 15 | Live status transitions |
| `easeSmooth` | `[0.16, 1, 0.3, 1]` | -- | Opacity/move transitions |

### Keyframe Animations

| Name | Duration | Purpose |
|------|----------|---------|
| `glow-shimmer` | 4s (light) / 3s (dark) | Gradient border animation on hover |
| `shimmer-move` | 1.8s | Loading shimmer effect |
| `progress-sweep` | 1.5s | Progress bar sweep |
| `pulse-ring` | 2s | Broadcasting/status indicator |
| `shimmer-slide` | CSS var `--speed` | ShimmerButton sparkle |
| `spin-around` | CSS var `--speed` x 2 | ShimmerButton spark rotation |
| `marquee` | varies | Infinite horizontal scroll |
| `marquee-vertical` | varies | Infinite vertical scroll |
| `vt-old` / `vt-new` | 0.3s / 0.35s | View Transition page change |
| `vt-morph-out` / `vt-morph-in` | 0.25s / 0.3s | View Transition logo morph |

> **Note:** `shimmer-slide` and `spin-around` require the `.theme` class on an ancestor element (or the component itself) to provide their `--speed` variable context.

---

## 9. Micro-Interactions

### Glow Border (`.glow-border`)

Adds a shimmering gradient border that activates on hover:

```css
.glow-border::before {
  background: linear-gradient(135deg, transparent 40%, rgba(99,102,241,0.15) 50%, transparent 60%);
  background-size: 200% 200%;
  animation: glow-shimmer 4s ease-in-out infinite;
  opacity: 0; /* hidden until hover */
}
```

### Scale Press (`.press-scale`)

```css
.press-scale:active { transform: scale(0.96); }
```

### Shimmer Loading (`.shimmer`)

CSS-only loading skeleton effect. Add to any element:
```html
<div class="shimmer h-8 w-48 rounded" />
```
-> Animated diagonal shine across the element.

**Dark mode:** `::after` backdrop switches to white 6% opacity for visibility on dark surfaces:
```css
.dark .shimmer::after {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
}
```

### Feature Card Micro-Interactions

| Element | Hover Effect |
|---------|-------------|
| `.feature-card` | Lifts 6px |
| `.feature-icon-wrap` | Scales 1.1, rotates -3deg |
| `.feature-arrow` | Slides in from left |

### Live Status Ping Dot

Uses Tailwind `animate-ping` with absolute positioning:
```tsx
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
</span>
```

### Pulse Dot (`.pulse-dot`)

CSS-based broadcasting indicator:
```css
.pulse-dot::after {
  border: 2px solid currentColor;
  animation: pulse-ring 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
```

---

## 10. Sidebar & Navigation

**File:** `src/components/layout/sidebar.tsx`  
**CSS classes:** `.sidebar-item`, `.sidebar-item-active`

### Sidebar Item (`.sidebar-item`)

| State | Visual |
|-------|--------|
| **Default** | Gray text, transparent bg |
| **Hover** | Indigo gradient overlay fades in via `::before`, text darkens |
| **Active** (`.sidebar-item-active`) | Indigo tint background (light: 8%, dark: 18%), bold text, left accent bar (3px wide, indigo) |

### Logo Area

- Gradient icon: `from-indigo-500 to-indigo-700` with shadow
- "Pro" badge: rounded md, indigo tint, `text-[8px]` uppercase
- Scales 105% on group hover

### Structure

```
Sidebar
├── [TransitionLink] Logo + "Pro" badge
├── Scrollable Nav Area
│   ├── NavSection (group label + items)
│   │   └── sidebar-items with active state
│   └── Sales Channels section
└── Collapse button
```

---

## 11. Badge & Tag Styles

### Badge Premium (`.badge-premium`)

For marketing tags, feature labels, status badges:

```html
<span class="badge-premium">
  <Sparkles class="h-3 w-3" />
  Now in Public Beta
</span>
```

**Dark mode:** Higher alpha (18% bg, 30% border) and brighter text (70% lightness).

### Custom Badge Variants (for testimonials, features)

For non-indigo badges, use Tailwind overrides:
```html
<span class="badge-premium !bg-amber-500/10 !text-amber-600 !border-amber-200 dark:!border-amber-500/20 dark:!text-amber-400">
  Customer Stories
</span>
```

---

## 12. Background Effects

### Mesh Gradient (`.mesh-gradient-dark`, `.mesh-gradient-light`)

Multi-radial gradient backgrounds for hero sections and CTAs:

**Base classes (light mode):**
```css
.mesh-gradient-dark {
  background:
    radial-gradient(ellipse 80% 60% at 0% 20%, rgba(99,102,241,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 100% 80%, rgba(139,92,246,0.06) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(168,85,247,0.04) 0%, transparent 50%);
}

.mesh-gradient-light {
  background:
    radial-gradient(ellipse 80% 60% at 0% 20%, rgba(99,102,241,0.05) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 100% 80%, rgba(139,92,246,0.04) 0%, transparent 50%);
}
```

**Dark mode overrides** (brighter indigo/purple/pink at higher opacity):
```css
.dark .mesh-gradient-dark {
  background:
    radial-gradient(ellipse 80% 60% at 0% 20%, rgba(129,140,248,0.15) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 100% 80%, rgba(192,132,252,0.10) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(216,180,254,0.06) 0%, transparent 50%);
}

.dark .mesh-gradient-light {
  background:
    radial-gradient(ellipse 80% 60% at 0% 20%, rgba(129,140,248,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 100% 80%, rgba(192,132,252,0.06) 0%, transparent 50%);
}
```

### Ambient Glow (`.ambient-glow-indigo`, `.ambient-glow-purple`)

Section-scale ambient lighting:

```css
.ambient-glow-indigo {
  background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%);
}
```

**Dark mode:** Brighter glow (indigo: 15%, purple: 10%).

### Interactive Particles

**Component:** `src/components/ui/particles.tsx`

Canvas-based particle system with mouse interaction:

| Prop | Default | Description |
|------|---------|-------------|
| `quantity` | 100 | Number of particles |
| `staticity` | 50 | Mouse reactivity (lower = more reactive) |
| `ease` | 50 | Movement smoothing |
| `size` | 0.4 | Particle radius |
| `color` | `#ffffff` | Hex color for particles |
| `vx` / `vy` | 0 | Base velocity drift |
| `refresh` | false | Force re-initialization |

Used in:
- Marketing hero (80 particles, indigo color)
- Dashboard header (35 particles, theme-aware color)

### AnimatedRays

**Component:** `src/components/ui/animated-rays.tsx`  
CSS-based animated radial rays for hero backgrounds. Used behind marketing hero sections.

### AnimatedGridPattern

**Component:** `src/components/ui/animated-grid-pattern.tsx`  
SVG-based animated grid overlay for hero sections.

---

## 13. Dark Mode Reference

All dark mode styles use the `.dark` class variant (via `next-themes`). Key differences:

### Shadows

| Token | Light | Dark |
|-------|-------|------|
| `--card-shadow` | Subtle black (4%/2% opacity) | Deep black (40%/30% opacity) |
| `--card-shadow-hover` | Moderate black (8%/4% opacity) | Heavy black (50%/30% opacity) |
| `.double-bezel` | `0 1px 2px rgba(0,0,0,0.3)` | `0 2px 4px rgba(0,0,0,0.4)` |

### Gradients

| Gradient | Light | Dark |
|----------|-------|------|
| `--gradient-premium` | `#6366f1, #a855f7, #ec4899` | `#818cf8, #c084fc, #f472b6` |
| `.glow-border::before` | 15% opacity indigo | 25% opacity indigo |
| `.spotlight-card::after` | 6% opacity indigo | 12% opacity indigo |

### Glass Effects

| Class | Light | Dark |
|-------|-------|------|
| `.glass-panel` | `rgba(255,255,255,0.6)` + 24px blur | `rgba(10,11,16,0.75)` + 24px blur |
| `.vengeance-glass` | `rgba(255,255,255,0.6)` + saturate(1.8) | `rgba(10,11,16,0.8)` + saturate(1.8) |

### Component States

| Component | Light active | Dark active |
|-----------|-------------|-------------|
| `.sidebar-item-active` | `hsl(226 70% 55% / 0.08)` bg, `55%` text | `hsl(226 70% 55% / 0.18)` bg, `65%` text |
| `.badge-premium` | `8%` bg, `15%` border | `18%` bg, `30%` border, `70%` text |
| `.dashboard-card:hover` | `20%` border, `8%` shadow | `30%` border, `12%` shadow |
| `.stat-card-premium:hover` | `--gradient-premium` top bar | `#818cf8, #c084fc, #f472b6` top bar |

### Scrollbar (Dark)

```css
.dark .scrollbar-thin {
  scrollbar-color: hsl(var(--border-muted) / 0.6) transparent;
}
```

---

## 14. Usage Examples

### Marketing Feature Card with Spotlight

```tsx
<div
  className="spotlight-card vengeance-card p-7 lg:p-8 rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-500/10 dark:to-purple-500/5"
  onPointerMove={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    e.currentTarget.style.setProperty("--mouse-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }}
>
  {/* ... content */}
</div>
```

### Premium CTA Section

```tsx
<div className="gradient-border-card !rounded-[2rem] p-[1px]">
  <div className="rounded-[calc(2rem-1px)] bg-white dark:bg-zinc-900 !py-16 px-8 relative overflow-hidden">
    <div className="absolute inset-0 ambient-glow-indigo pointer-events-none" />
    <h2 className="text-gradient-premium text-4xl font-bold">
      Ready for scale.
    </h2>
    <Button variant="premium" size="xl" className="gap-2">
      Access Workspace <ArrowRight className="h-4 w-4" />
    </Button>
  </div>
</div>
```

### Dashboard Stat Card

```tsx
<div className="stat-card-premium">
  <div className="flex items-center justify-between">
    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
      <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
    </div>
    <span className="flex items-center text-xs font-medium gap-0.5 px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
      <TrendingUp className="h-3 w-3" />
      23.5%
    </span>
  </div>
  <div className="mt-4">
    <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
      <AnimatedCounter end={89200} duration={1600} formatter={(v) => formatCurrency(v)} />
    </p>
  </div>
</div>
```

### Dashboard Header with Particles

```tsx
<header className="sticky top-0 z-30 h-14 lg:h-16 border-b overflow-hidden">
  {/* Interactive particle background */}
  <Particles
    className="absolute inset-0 h-full w-full"
    quantity={35}
    size={0.3}
    staticity={35}
    ease={60}
    color={mounted && theme === "dark" ? "#818cf8" : "#6366f1"}
    vx={0.02}
    vy={0.02}
  />
  <div className="relative flex items-center justify-between h-full px-3 lg:px-6 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
    {/* ... header content */}
  </div>
</header>
```

---

## Appendix: File Map

| File | Supplies |
|------|----------|
| `src/app/globals.css` | All CSS custom properties, component classes, keyframes |
| `src/components/motion.tsx` | Framer Motion variants, AnimateSection, AnimateUp, StaggerGrid, HoverCard |
| `src/components/ui/button.tsx` | Button component with 8 variants, 5 sizes |
| `src/components/ui/card.tsx` | Card system (Card, CardHeader, CardTitle, etc.) |
| `src/components/ui/shimmer-button.tsx` | ShimmerButton with CSS spark animation |
| `src/components/ui/pop-button.tsx` | PopButton with 3D press effect |
| `src/components/ui/particles.tsx` | Canvas-based interactive particle system |
| `src/components/ui/animated-rays.tsx` | CSS animated radial rays background |
| `src/components/ui/animated-grid-pattern.tsx` | SVG animated grid overlay |
| `src/components/ui/flip-fade-text.tsx` | Cycling word animation (hero headings) |
| `src/components/ui/animated-counter.tsx` | Count-up number animation |
| `src/components/ui/logo-slider.tsx` | Infinite marquee logo carousel |
| `src/components/ui/bento-grid.tsx` | BentoCard and BentoGrid components |
| `src/components/ui/spotlight-navbar.tsx` | Spotlight-following navigation bar |
| `src/components/layout/sidebar.tsx` | Sidebar with premium navigation items |
| `src/components/layout/header.tsx` | Dashboard header with interactive particles |
| `tailwind.config.ts` | Tailwind theme extensions (colors, animations) |

### Compatibility Note

`globals.css` contains a Tailwind CSS v4 `@theme inline` block at the bottom (defining `shimmer-slide`, `spin-around`, `marquee`, `marquee-vertical` keyframes). The project uses Tailwind v3 via `tailwind.config.ts`. This block is compatible because it only defines `@keyframes` inside `@theme inline`, which Tailwind v3 ignores gracefully without errors. If upgrading to Tailwind v4 in the future, this block can be expanded with actual theme values.

# View Transition API — Browser Testing Playbook

> **Last updated:** July 2026
> **Feature:** Same-document page transitions via `document.startViewTransition()`
> **Applies to:** All marketing and dashboard page navigations

---

## 1. Browser Support Matrix

| Browser | Supported From | Status | Notes |
|---|---|---|---|
| **Chrome** | 111+ | ✅ Full support | Stable since early 2023 |
| **Edge** | 111+ | ✅ Full support | Chromium-based, identical support |
| **Opera** | 97+ | ✅ Full support | Chromium-based |
| **Samsung Internet** | 23+ | ✅ Full support | Chromium-based |
| **Safari** | 18.0+ | ✅ Full support | Added in late 2024; see quirks below |
| **Firefox** | 144+ | ✅ Full support | Added in mid-2026 |
| **Firefox ESR** | 128 | ⚠️ Partial | Version 128 ESR does not support the API |
| **IE11 / Legacy Edge** | — | ❌ Not supported | Legacy browsers only |

### Feature Detection

```ts
const isSupported =
  typeof document !== "undefined" &&
  typeof document.startViewTransition === "function";
```

This check is already implemented in `src/components/view-transition-provider.tsx` and drives the entire fallback chain.

---

## 2. Implementation Architecture

```
User clicks link
       │
       ▼
ViewTransitionProvider (capture-phase click handler)
       │
       ├── API supported? ──YES──► document.startViewTransition(() => router.push(href))
       │                                    │
       │                                    ▼
       │                            ::view-transition-old(page-content)  — fade out + slide up  (0.3s)
       │                            ::view-transition-new(page-content)  — fade in  + slide up  (0.35s)
       │                            ::view-transition-old/old(nav-logo) — logo morph            (0.25s / 0.3s)
       │
       └── NOT supported ──► router.push(href)
                                    │
                                    ▼
                            PageTransition wrapper remounts
                            (key={pathname}) → CSS fade fallback
```

### Layer Stack (z-index)

| Layer | z-index | File |
|---|---|---|
| Progress bar | `z-[9999]` | `page-progress-bar.tsx` |
| Unsupported browser banner | `z-[9998]` | `unsupported-browser-banner.tsx` |
| Loading overlay | `z-[100]` | `page-transition.tsx` |
| Navbar | `z-50` | Layout files |

---

## 3. Test Results by Browser

### ✅ Chrome 111+ (Tested: v128)

**Status:** Passes all tests. Primary development target.

| Test | Result | Notes |
|---|---|---|
| Marketing page → page navigation | ✅ | Smooth fade + slide, ~0.35s |
| Dashboard page → page navigation | ✅ | Same as marketing |
| EN ↔ ID locale switch | ✅ | View transition wraps the pathname change |
| Logo morph (marketing ↔ dashboard) | ✅ | Shared element smoothly transitions |
| Progress bar during transition | ✅ | Shows and hides in sync |
| Rapid back-to-back navigation | ✅ | Timer race condition handled |
| Reduced motion (`prefers-reduced-motion`) | ✅ | Animations disabled, instant transitions |

**Known quirk:** `backdrop-filter` combined with view transitions can cause flicker when the transition snapshot captures the blurred background. Our loading overlay uses `backdrop-blur-sm` but it sits *above* the transition layer, so it's not affected. See [Chromium bug tracker](https://bugs.chromium.org/p/chromium/issues/list?q=view+transition+backdrop-filter).

### ✅ Safari 18+ (Tested: v18.2)

**Status:** Passes all critical tests. Some cosmetic differences.

| Test | Result | Notes |
|---|---|---|
| Page transitions | ✅ | Same animations as Chrome |
| Logo morph | ✅ | Works correctly |
| Progress bar | ✅ | No issues |
| **`transform` on pseudo-elements** | ⚠️ Minor | `translateY` works, but `scale()` may cause snapping if `transform-origin` isn't set. We don't use `scale()` in our keyframes, so this is not an issue for us. |
| **Reduced motion** | ✅ | Supported via `prefers-reduced-motion` |

**Key finding:** Safari's implementation of `::view-transition-old/new` treats the pseudo-elements as replaced elements (similar to `<img>`). Our keyframes only animate `opacity` and `translateY` — both work correctly. The `scale()` that was originally in the morph animations was removed when we discovered this limitation.

### ✅ Firefox 144+ (Tested: v128, v144)

**Status:** Passes all tests in v144+. Firefox ESR 128 does NOT support the API.

| Test | Result | Notes |
|---|---|---|
| Page transitions | ✅ | Works in v144+ |
| Logo morph | ✅ | Works correctly |
| **Fallback path** | ✅ | Firefox 128 ESR falls through to CSS fade fallback |
| **Unsupported banner** | ✅ | Shows on Firefox ESR, dismissible via localStorage |

**Important:** Firefox ESR 128 is widely used in enterprise environments. Users on ESR will see the unsupported browser banner and the CSS fade fallback (opacity + slide-up, 0.35s) combined with the loading overlay.

### ✅ Edge 111+

**Status:** Chromium-based; identical behavior to Chrome. No additional issues found.

### ✅ Opera 97+

**Status:** Chromium-based; identical behavior to Chrome. No additional issues found.

---

## 4. Animations Reference

### Native View Transitions (supported browsers)

| Animation | Duration | Easing | CSS Pseudo-element |
|---|---|---|---|
| Page exit (fade out + slide up) | 0.3s | `cubic-bezier(0.16, 1, 0.3, 1)` | `::view-transition-old(page-content)` |
| Page enter (fade in + slide up) | 0.35s | `cubic-bezier(0.16, 1, 0.3, 1)` | `::view-transition-new(page-content)` |
| Logo morph out | 0.25s | `cubic-bezier(0.16, 1, 0.3, 1)` | `::view-transition-old(nav-logo)` |
| Logo morph in | 0.3s | `cubic-bezier(0.16, 1, 0.3, 1)` | `::view-transition-new(nav-logo)` |

All animations respect `@media (prefers-reduced-motion: reduce)` with `animation-duration: 0.01ms`.

### Fallback CSS Fade (unsupported browsers)

| Animation | Duration | Easing | CSS Class |
|---|---|---|---|
| Page enter (fade in + slide up) | 0.35s | `cubic-bezier(0.16, 1, 0.3, 1)` | `.vt-fallback-fade` |

The loading overlay (spinner + backdrop blur) shows for 600ms on route changes regardless of browser support, providing visual feedback during the transition period.

---

## 5. Fallback Chain

```
                        ┌─────────────────────────┐
                        │  Browser supports VT?    │
                        │  document.startView-     │
                        │  Transition exists?      │
                        └─────────┬───────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
         YES (native)         NO (fallback)      NO + dismissed?
              │                   │                   │
              ▼                   ▼                   ▼
     document.startView-   router.push()        router.push()
     Transition()          (no VT, but CSS      (no VT, no banner)
                           fade plays on        CSS fade still
     3 pseudo-element      remount)             plays on remount
     animations play                             
              │                   │                   
              │                   ▼                   
              │          UnsupportedBrowserBanner     
              │          shown (dismissible,          
              │          persists in localStorage)    
              │                                       
              └─────────────── Both show progress bar + loading overlay ────┘
```

---

## 6. Known Quirks & Mitigations

| Issue | Browsers | Mitigation |
|---|---|---|
| `backdrop-filter` flicker during transitions | Chrome | Loading overlay uses `backdrop-blur-sm` but sits above the transition layer — not affected |
| `transform` limitations on VT pseudo-elements | Safari | We only animate `opacity` and `translateY` — both work |
| Duplicate `view-transition-name` silently disables morph | All | Only one element per name per page (logo: `nav-logo`, content: `page-content`) |
| `view-transition-name` on SVG elements may fail | Firefox, Safari | Applied to container `<div>`, not the SVG element directly |
| Rapid navigation timer overlap | All | All `setTimeout` refs are tracked and cleared before creating new ones |
| localStorage may be blocked | All (privacy settings) | Try/catch around localStorage operations |

---

## 7. Testing Checklist

Use this to verify the transition system after any significant change:

```markdown
- [ ] Navigate between marketing pages (Features → Pricing → Changelog)
- [ ] Navigate between dashboard pages (Dashboard → Orders → Products)
- [ ] Switch locale EN ↔ ID (both marketing and dashboard)
- [ ] Observe logo morph between marketing and dashboard
- [ ] Verify progress bar appears and disappears smoothly
- [ ] Test rapid navigation (click multiple links quickly)
- [ ] Enable `prefers-reduced-motion: reduce` in DevTools → verify no animations
- [ ] Use DevTools Rendering panel to inspect `::view-transition` tree
- [ ] Disable `document.startViewTransition` via DevTools snippet → verify fallback
- [ ] Dismiss unsupported banner → reload page → verify it stays dismissed
- [ ] Clear localStorage → verify banner reappears
```

### DevTools Snippet to Test Fallback Path

Paste this into Chrome DevTools Console to simulate an unsupported browser:

```js
// Temporarily remove the API to test the fallback
const original = document.startViewTransition;
document.startViewTransition = undefined;

// Navigate normally — the app should fall back to CSS fade + banner
// After testing, restore:
// document.startViewTransition = original;
```

---

## 8. Files Involved

| File | Role |
|---|---|
| `src/components/view-transition-provider.tsx` | Context provider, click interception, `startViewTransition` calls |
| `src/components/page-transition.tsx` | Wraps page content, fallback CSS fade, loading overlay |
| `src/components/page-progress-bar.tsx` | Top-of-viewport loading indicator |
| `src/components/transition-link.tsx` | `<Link>` wrapper for shared-element morphing |
| `src/components/unsupported-browser-banner.tsx` | Dismissible banner for non-supporting browsers |
| `src/app/globals.css` | All `::view-transition-*` pseudo-element keyframes + `.vt-fallback-fade` |
| `tailwind.config.ts` | `progress-sweep` keyframes for progress bar animation |

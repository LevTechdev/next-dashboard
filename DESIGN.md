# Design Architecture & Standards

This document establishes the frontend aesthetic rules and configurations for this SaaS project, explicitly adopting the `design-taste-frontend` agent skills anti-slop guidelines.

## 0. Design Read
**"B2B SaaS landing for business operators, with a modern, high-contrast language leaning toward Tailwind + Radix UI + restrained motion."**

## 1. Core Dials
- `DESIGN_VARIANCE`: **7** (Dynamic Layouts, avoiding the generic centered hero and repetitive 3-column feature grids).
- `MOTION_INTENSITY`: **6** (Fluid transitions and purposeful scroll-reveals; infinite loops only when communicating real-time state).
- `VISUAL_DENSITY`: **4** (Balanced whitespace, focusing on clarity over extreme density for marketing pages).

## 2. Typography & Colors
- **Fonts**: Utilize Geist or Inter for clean, technical legibility. Absolutely **NO SERIFS** for this B2B SaaS context unless deliberately required for an editorial section.
- **Palette Ban**: Do not use the beige/brass "AI Premium" palette.
- **Allowed Accents**: High-contrast, monochromatic bases (Slate/Zinc 900) with singular vivid accents (e.g., Electric Blue or Emerald Green). No generic AI purple gradients unless specifically requested.

## 3. Structural Rules
- **Anti-Center Bias**: Heroes should prefer split-screen or asymmetric alignments.
- **Eyebrow Restraint**: Maximum 1 eyebrow label per 3 sections.
- **Feature Grids**: Bento grids must have distinct content in each cell. Avoid "6 identical white cards with different icons" patterns.

## 4. Auth Integration
- This project leverages `@auth0/nextjs-auth0` for authentication.
- All auth-protected components must interact through standardized hooks in `src/hooks/use-auth.ts`.

# Meal Decider Design System — Template (v0.1)

> **Status:** Reference template / proposal only. Nothing in this document is
> wired into the app yet — it's a foundation to design against and a target
> to migrate toward incrementally.
>
> **Why this exists:** the app currently has ~240 hardcoded hex colors spread
> across 15+ CSS files with no shared tokens, font scale, spacing scale, or
> documented component states. That's why it reads as "default/stock" —
> nothing is wrong individually, but nothing is *unified*. This document
> names the existing visual language, fills the gaps, and proposes a few
> signature touches so the app has a recognizable identity.

---

## 1. Brand Identity

**Name:** AI Meal Decider 🎰
**Core metaphor:** a slot machine for dinner — input (pantry) → randomness
(spin) → reward (recipe). The design system should lean into this "arcade /
night-casino" feeling rather than looking like a generic SaaS dashboard.

**Working theme name:** *"Midnight Jackpot"* — a dark, neon-accented theme
where warm gold/red "winning" colors pop against a deep indigo-black
background, echoing a casino at night.

### Brand principles

1. **Playful, not childish.** Bold color and motion, but typography and
   layout stay clean/legible — playfulness comes from accents and motion,
   not from cartoonish chrome.
2. **Dark-first.** The app is designed dark; light mode (if ever added) is a
   derived theme, not the primary design surface.
3. **One moment of delight per screen.** The wheel, the "winning" badge, the
   recipe reveal — each step should have *one* small flourish (glow, motion,
   color pop), not constant animation everywhere.
4. **Low-friction, mobile-first.** Single-column, big tap targets, minimal
   text — most sessions are "what's for dinner *right now*" on a phone.
5. **Consistency over novelty.** Every new screen reuses the same handful of
   surfaces, radii, and accent colors rather than introducing new ones.

---

## 2. Design Tokens

These formalize the colors/values already in use (so existing screens map
cleanly onto them) and fill in gaps (shadows, motion, type scale) that don't
exist yet. Proposed as CSS custom properties on `:root` in a future
`app/styles/tokens.css`.

### 2.1 Color — Surfaces & Structure

| Token | Value | Current usage |
|---|---|---|
| `--color-bg` | `#0f0f1a` | page background, inset surfaces |
| `--color-surface` | `#16162a` | cards, modals |
| `--color-surface-raised` | `#1e1e3a` | secondary buttons, history recipe blocks |
| `--color-border` | `#2a2a4a` | card/input/chip borders |
| `--color-border-hover` | `#3a3a6a` | hover state borders |

### 2.2 Color — Text

| Token | Value | Current usage |
|---|---|---|
| `--color-text` | `#eee` / `#fff` | primary text, headings |
| `--color-text-secondary` | `#ccc` / `#ddd` | recipe body, history meal names |
| `--color-text-muted` | `#888` / `#aaa` | labels, meta text, secondary buttons |
| `--color-text-faint` | `#555` / `#444` | placeholders, disabled/empty states |

### 2.3 Color — Brand Accents

| Token | Value | Current usage |
|---|---|---|
| `--color-accent` | `#6c6cff` | primary buttons, focus borders, links, active chips |
| `--color-accent-hover` | `#7d7dff` | primary button hover |
| `--color-accent-purple` | `#a855f7` | share/sign-up gradient pair with accent |
| `--color-gold` | `#f7c948` | meal names, "winning" highlights, recipe headers, cuisine active chips |

### 2.4 Color — Semantic / Status

| Token | Value | Current usage |
|---|---|---|
| `--color-success` | `#2ecc71` | "Get Recipe" button |
| `--color-success-hover` | `#3dd880` | hover |
| `--color-danger` | `#ff6b6b` | error text, spin-button gradient |
| `--color-danger-strong` | `#e74c3c` | wheel pointer |

### 2.5 Color — Wheel Palette

A dedicated, decorative palette — kept separate from semantic tokens since
slices are assigned by index, not meaning.

```
--wheel-1: #FF6B6B   --wheel-5: #FFEAA7
--wheel-2: #4ECDC4   --wheel-6: #DDA0DD
--wheel-3: #45B7D1   --wheel-7: #98D8C8
--wheel-4: #96CEB4   --wheel-8: #F7DC6F
```

### 2.6 Typography

Current: `'Segoe UI', system-ui, sans-serif` everywhere, sizes set ad hoc
(`0.8rem`–`2rem`). Proposal: keep the system font for body text (fast,
native feel on mobile) but introduce **one distinct display font** for
headings/brand moments to break the "default OS UI" feel.

| Token | Value |
|---|---|
| `--font-body` | `'Segoe UI', system-ui, sans-serif` |
| `--font-display` | *(proposal)* a rounded geometric sans for headlines — e.g. **Poppins**, **Fredoka**, or **Space Grotesk** — used only for `h1`/brand wordmark and the "winning meal" reveal |

**Type scale:**

| Token | Size | Weight | Used for |
|---|---|---|---|
| `--text-display` | 2rem (1.5rem mobile) | 800 | App title `h1` |
| `--text-lg` | 1.2rem | 700 | Selected meal name |
| `--text-base` | 0.95rem | 400 | Body, inputs, buttons |
| `--text-sm` | 0.85–0.9rem | 500–700 | Secondary buttons, chips |
| `--text-xs` | 0.75–0.8rem | 600 | Uppercase labels, meta text |

### 2.7 Spacing Scale

Current values in use: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 48, 64 (px) —
too many near-duplicates (6/8/10/14/18). Proposed consolidated scale:

```
--space-1: 4px    --space-4: 16px   --space-7: 40px
--space-2: 8px    --space-5: 20px   --space-8: 48px
--space-3: 12px   --space-6: 32px   --space-9: 64px
```

### 2.8 Radius Scale

| Token | Value | Used for |
|---|---|---|
| `--radius-sm` | 8px | history recipe blocks |
| `--radius-md` | 10–12px | inputs, buttons, badges |
| `--radius-lg` | 16px | cards, modals |
| `--radius-pill` | 50px | spin button, sign-up CTA |
| `--radius-chip` | 20px | filter chips, tabs |
| `--radius-full` | 50% | wheel, spinner, avatar |

### 2.9 Elevation / Glow

Currently almost unused (one canvas glow). Proposed elevation system to give
depth without literal drop shadows (which read poorly on dark backgrounds):

| Token | Value | Used for |
|---|---|---|
| `--glow-accent` | `0 0 30px rgba(108,108,255,0.2)` | wheel canvas (existing) |
| `--glow-gold` | `0 0 24px rgba(247,201,72,0.25)` | *(new)* "winning" badge reveal, jackpot moments |
| `--shadow-modal` | `0 12px 40px rgba(0,0,0,0.5)` | *(new)* modals, to lift them off the page |

### 2.10 Motion

| Token | Value | Used for |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | default transitions |
| `--duration-fast` | `0.15s` | chip/border hover |
| `--duration-base` | `0.2s` | button hover/opacity |
| `--duration-press` | `0.1s` | button active scale (0.97) |
| `--duration-reveal` | `0.4s` | *(new)* selected-meal badge / recipe card entrance |

### 2.11 Breakpoints

| Token | Value |
|---|---|
| `--bp-mobile` | `480px` (existing single breakpoint) |

---

## 3. Component Inventory

For each component: purpose, states, and which tokens apply. This is meant
as a checklist when (re)building components so every state is intentional,
not accidental.

### 3.1 Button

Variants observed: `btnPrimary`, `btnSpin`, `btnRecipe`, `btnShare`,
`btnSave`/`btnPantry`, `btnSignUpGate`.

| State | Tokens |
|---|---|
| Default | variant-specific bg, `--radius-md`, `--text-base`/`--text-sm`, weight 700 |
| Hover | lighten bg or `opacity: 0.88–0.9` |
| Active/press | `transform: scale(0.97)`, `--duration-press` |
| Disabled | `opacity: 0.4`, `cursor: not-allowed` |
| Focus *(missing today)* | add visible focus ring, e.g. `outline: 2px solid var(--color-accent)` |

**Proposal:** consolidate 6 button variants into a smaller set —
`primary` (accent), `success` (recipe/confirm), `ghost` (save/pantry/cancel),
`gradient-cta` (spin + share + sign-up, all currently near-identical
gradients) — to reduce one-off styling.

### 3.2 Card

`background: var(--color-surface)`, `border: 1px solid var(--color-border)`,
`border-radius: var(--radius-lg)`, `padding: var(--space-4)` (≈20px).
Single elevation level — no nested-card shadow needed.

### 3.3 Input

`background: var(--color-bg)`, border `--color-border` → `--color-accent` on
focus, `--radius-md`, placeholder `--color-text-faint`.
**Missing:** error state (red border + helper text) — not currently defined
anywhere in the app.

### 3.4 Filter Chip / Pill

Two flavors today: dietary chips (accent-active) and cuisine chips
(gold-active) — same shape, different active color. Keep both as intentional
variants (`chip-accent`, `chip-gold`) rather than accidental drift.

| State | Tokens |
|---|---|
| Default | `--color-bg` bg, `--color-border`, `--color-text-muted`, `--radius-chip` |
| Hover | `--color-border-hover`, lighter text |
| Active | tinted bg (`accent22`/`gold22`), colored border + text, weight 600 |

### 3.5 Tabs (Pantry list tabs)

Same shape language as chips but `--radius-chip`, active = accent tint.
Could be merged with chip styles as a `pill` primitive with `tab` and
`filter` usages.

### 3.6 Modal

Overlay `rgba(0,0,0,0.6)`, panel = Card + `--shadow-modal` *(new)*,
`max-width: 440px`, `max-height: 80vh`. Header/body/footer slots already
consistent between Pantry modal and guest nudge — good candidate for a
shared `Modal` component.

### 3.7 Selected Meal Badge

Gradient tint background (`accent22` → `gold22`), border `accent44`,
`--radius-lg`. This is a "moment of delight" surface — candidate for
`--glow-gold` + `--duration-reveal` entrance animation.

### 3.8 The Wheel

Signature component. Canvas-rendered, `--wheel-1..8` palette,
`--glow-accent` halo, gold/red pointer (`--color-gold`/`--color-danger-strong`).
Future signature touches (not implemented): tick sound + haptic on slice
boundaries, confetti burst on landing, `--glow-gold` pulse on the winning
slice.

### 3.9 Recipe Display

Markdown-lite renderer (`renderRecipe`) — headings/bold → `--color-gold`,
body → `--color-text-secondary`, `line-height: 1.7`. Consistent across main
page, history, profile, and shared `/r` page — keep these in sync if tokens
change.

### 3.10 Loading Spinner

`16px` ring, border `--color-border-hover`-ish with `--color-accent` top,
`0.7s linear` spin. Fine as-is; just needs token-ification.

### 3.11 History Item

Row with bottom border (`--color-surface-raised` divider), expandable
recipe block on tap (`--color-bg` inset, `--radius-sm`).

---

## 4. Iconography & Imagery

- **Current approach:** emoji (🎰 📋 ⬇️ ⚠️ 🎲 🔗 🔒) + one custom SVG
  (`FridgeIcon`).
- **Recommendation:** keep emoji for personality/low-effort — it fits the
  playful brand — but build a **small custom SVG set** (in the style of
  `FridgeIcon`) for the 4–5 icons that appear most often (fridge/pantry,
  share, download, spin/dice, lock) so the chrome feels designed rather than
  default-emoji. Emoji can remain for one-off accents (⚠️, ✓, ×).
- **Meal images:** not currently present. If added later (see brainstorm),
  define a consistent aspect ratio (e.g. 4:3) and corner radius
  (`--radius-md`) up front so the grid stays uniform.

---

## 5. Accessibility Notes (gaps to address when implementing)

- `--color-text-faint` (#555/#444) on `--color-bg` (#0f0f1a) is **below
  WCAG AA** for body text — fine for placeholders/disabled states, not for
  anything readable.
- No visible **focus states** on buttons, links, or chips — only inputs.
  Needs a consistent focus ring token before any redesign ships.
- Wheel result is communicated visually + via the badge text — good; ensure
  any future sound/confetti additions don't become the *only* signal.
- Tap targets: chips and small buttons (`8px`/`14px` padding) are close to
  the 44px minimum on mobile — worth checking once spacing tokens are
  applied.

---

## 6. Proposed File Structure (future implementation)

```
app/
  styles/
    tokens.css        # all custom properties from §2
    primitives.css     # .btn, .card, .chip, .modal base classes
  page.module.css       # screen-specific layout only, references tokens
  profile/profile.module.css
  ...
```

Migration would be incremental: introduce `tokens.css`, then replace
hardcoded hex values file-by-file with `var(--token)` equivalents — no visual
change in step 1, then apply signature touches (display font, glow, gradient
consolidation) in step 2.

---

## 7. Open Questions for Next Pass

1. Pick a display font for `--font-display` (headline-only) — Poppins,
   Fredoka, Space Grotesk, or something else?
2. Consolidate the 3 near-identical gradient buttons (spin / share / sign-up
   gate) into one `gradient-cta` style, or keep distinct per-context colors?
3. Define an error/validation style for inputs (currently absent anywhere).
4. Decide whether wheel "win" moments get a `--glow-gold` pulse + optional
   confetti (ties into the earlier brainstorm).
5. Is a light theme ever in scope, or is dark-only a permanent decision?

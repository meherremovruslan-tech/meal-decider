# Share Recipe — Design Spec

**Date:** 2026-06-05
**Goal:** Let users share their recipe via a link that opens a branded read-only page in the app.

---

## Approach

URL-encoded data (no database). The recipe payload is JSON-serialised and base64-encoded into the URL query param `d`. No backend storage required.

URL format: `/r?d=<base64url-encoded-json>`

Payload shape: `{ meal: string, recipe: string }`

---

## Share Button

- Added to the recipe card alongside the existing Copy and Download buttons (reuses `.btnSave` style)
- Label: `🔗 Share`
- On click: encodes `{ meal, recipe }` as base64url, builds the full URL, copies it to clipboard
- Button label changes to `✓ Copied!` for 2 seconds, then resets

---

## Shared Recipe Page (`/r`)

New Next.js page at `app/r/page.js`. Client component.

**On load:**
1. Read `d` from URL search params
2. Base64-decode → JSON parse → extract `{ meal, recipe }`
3. If missing or invalid: show friendly error state with CTA to main app

**Layout (top to bottom):**
1. Logo (SVG inlined, `viewBox="200 55 280 320"`, 160px wide) — wheel + "meal decider" + "spin. cook. eat."
2. "A recipe was shared with you" badge
3. Recipe card — identical styling to main app (`.card`, `.label`, `.recipe`, `renderRecipe()` formatter, `buy-alert` pill for "may need to buy" lines)
4. CTA button — "🎰 Decide your own meal →" links to `/`
5. Subtext — "Enter what's in your fridge and let the wheel decide"

**Error state:** Same page layout, card shows "This recipe link is invalid or expired." with CTA still visible.

---

## Files

| File | Change |
|------|--------|
| `app/page.js` | Add `shareRecipe` handler, Share button in recipe card |
| `app/page.module.css` | Add `.btnShare` (reuses `.btnSave` base, adds share-specific hover) |
| `app/r/page.js` | New — shared recipe page |
| `app/r/page.module.css` | New — styles for share page (logo, shared-by badge, CTA) |

`renderRecipe` and the `buy-alert` pill logic are duplicated into `app/r/page.js` (no shared module needed — two callsites only).

---

## Error Handling

- Clipboard API failure on share: show `⚠ Copy failed` on button, same 2s reset
- Invalid `d` param on `/r`: render error card, CTA still works
- Recipe too large for URL: not a concern — recipes are ~600–900 chars, base64 ~1200 chars, well within browser URL limits

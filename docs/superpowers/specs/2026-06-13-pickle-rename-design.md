# Pick'le — Product Rename Design

**Date:** 2026-06-13
**Status:** Approved by CEO (2026-06-13)
**Decision maker:** Ruslan (CEO & founder)

## Summary

"Meal Decider" is renamed to **Pick'le**. The motivation: "Meal Decider" is
generic and forgettable; Pick'le is a memorable brand with the product's
function built into the name.

## Why Pick'le

Triple meaning packed into one word:

1. **Pick** — the app *picks* your meal (core function, front-loaded).
2. **"In a pickle"** — stuck on a decision; exactly the user's problem.
3. Pickle the food — keeps the name clearly food-related.

The apostrophe visually separates "Pick" so the function reads at first
glance, addressing the CEO's concern that a plain "Pickle" hides what the
app does.

## Name usage rules

| Context | Form |
|---|---|
| Display name (UI, titles, emails, store listings) | **Pick'le** |
| Technical identifiers (code, slugs, future domain/handles) | `pickle` (apostrophes not allowed there) |
| Spoken | "pickle" |

## Brand elements (kept, not redesigned)

- **Logo:** the existing 6-segment color wheel with fork & knife hub and
  pointer triangle stays exactly as-is (CEO chose "classic swap" — concept B
  in `mockups/pickle-logo-mockup.html`). Only the wordmark under it changes
  from "meal decider" to **Pick'le**.
- **Motto:** "spin. cook. eat." stays unchanged — it already explains the
  function and pairs with the name everywhere the logo appears.
- **No cucumber/gherkin imagery anywhere.** The brand never illustrates the
  food "pickle"; the wheel is the only mark.
- Wordmark style per mockup: Baloo 2 (rounded, friendly), bold, charcoal
  `#3a3a3a`; motto in light gray below.
- **App icon / favicon:** the wheel *including* the fork & knife in the
  white hub — same mark at every size (CEO request 2026-06-13). At very
  small favicon sizes (16px) the hub may render empty if the utensils
  become illegible; judge during implementation.

## Scope of changes (rename touchpoints)

Text/asset-level only — no functional changes:

1. `app/components/Header.js` — header brand text.
2. `app/layout.js` (or wherever `metadata.title` lives) — browser tab /
   SEO title and description.
3. Main page wordmark under the wheel (`app/page.js`) — "meal decider" →
   "Pick'le".
4. Mobile shell (`app/components/mobile/`) — any visible app-name strings.
5. Recipe share page (`app/r/`) — page title and any "Meal Decider" text.
6. PDF export — header/footer branding in the jspdf output.
7. Auth emails (verification, password reset) — sender/display text.
8. `package.json` name → `pickle` (cosmetic).
9. Wordmark font: add Baloo 2 for the logo lockup only (body fonts
   unchanged).
10. Favicon / app icon assets — regenerate from the wheel with fork &
    knife hub (see Brand elements).

## Explicitly out of scope (for now)

- **Vercel project / URL stays `meal-decider-alpha.vercel.app`.** Renaming
  the project would break every already-shared recipe link (`/r/...`).
  When a real domain is purchased later, it is pointed at the same project
  so old links keep working.
- Domain and social-handle acquisition — deferred by CEO ("doesn't matter
  yet"). Candidates when ready: pickle.app, getpickle.com, @pickleapp.
- Any change to the wheel visuals, colors, or motto.

## Risks accepted by CEO

- Apostrophe in display name: users will type/search "pickle"; technical
  surfaces use the plain spelling, so discovery still works.
- "Pickle" name collisions exist elsewhere (e.g., a meeting-notes startup
  "Spinach", pickleball apps) — judged acceptable at current product stage;
  revisit before paid marketing.

## Reference

- Logo concept mockup: `mockups/pickle-logo-mockup.html` (concept B chosen).
- Previous name: Meal Decider (live since alpha).

# Meal Time Choice (replacing Dietary Filters) — Design

**Date:** 2026-06-13
**Status:** Approved by CEO (mockup `mockups/meal-time-mockup.html`: desktop chips + mobile option B)
**Decision maker:** Ruslan (CEO & founder)

## Summary

The four dietary filter chips (Vegetarian, Vegan, Gluten-free, Dairy-free) are
removed from both desktop and mobile. In their place users choose what meal
they're deciding: **Breakfast / Lunch / Dinner**. The choice steers the AI's
suggestions ("suggest only breakfast meals"). CEO rationale: diets aren't
needed at this stage; meal-of-day is the more useful everyday lever.

## Behavior

- **Single-select** (a meal can't be two types), **deselectable** (tap the
  active option again → no preference, AI suggests anything).
- **Smart default by clock** (CEO-approved): on load, the option matching the
  user's local time is pre-selected:
  - 04:00–10:59 → Breakfast
  - 11:00–15:59 → Lunch
  - 16:00–03:59 → Dinner
- **The default must be self-explanatory** (CEO requirement: "for UX it must
  be totally understandable"):
  - The auto-selected option carries a small yellow **AUTO** badge.
  - A hint line under the options explains it: "✨ We picked **Lunch** for
    you — it's midday. Tap another to change."
  - On any manual tap the AUTO badge disappears and the hint becomes a plain
    confirmation: "Dinner it is. The AI will suggest dinner meals." /
    deselected: "No preference — the AI will suggest any kind of meal."
- Available to **everyone** (guests included), like the diet chips were.
  Cuisine selection stays signed-in-only and unchanged.

## UI

- **Desktop (Step 1 card):** the diet chip row is replaced by a labeled
  section "🍽️ What meal are we deciding?" with three chips
  (🍳 Breakfast · 🥗 Lunch · 🍲 Dinner) + hint line. Existing chip styling.
- **Mobile (Decide tab):** the diet filter row is replaced by **option B
  from the mockup** — three equal-width stacked segments (emoji on top,
  label below), all always visible, **no horizontal scrolling** (CEO UX
  concern: a primary choice must never hide an option off-screen). AUTO
  badge sits on the top-right corner of the active segment; hint line below.

## Data flow

- Client state: `mealTime` (string or null) replaces the `filters` array.
- `/api/suggest`: accepts `mealTime`, validates against the allowed three,
  adds to prompt: "Meal type: suggest only ${mealTime} meals." The dietary
  `filters` prompt block is removed.
- `/api/recipe`: dietary `filters` prompt block removed; `mealTime` is NOT
  sent (the meal is already chosen — the recipe doesn't need it). History
  insert keeps writing `dietary_filters: []` so the DB schema is untouched.
- **No DB migration.** `recipe_history.dietary_filters` column stays (old
  rows keep their data; it was never displayed in any UI). Meal time is not
  persisted in v1 — YAGNI until a feature needs it.
- **Analytics:** `suggestions_received` and `spin` events gain a
  `meal_time` property (Breakfast/Lunch/Dinner/none + whether it was auto),
  so PostHog can tell us if people use or change the smart default.

## Out of scope

- Persisting meal time to history / profile defaults.
- Snacks/dessert categories (add later if users ask).
- Any change to cuisine selection, pantry, scan, wheel.

## Reference

- Mockup: `mockups/meal-time-mockup.html` (desktop chips; mobile = option B).
- Removed constant: `DIETARY_FILTERS` in `lib/filters.js` → replaced by
  `MEAL_TIMES`.

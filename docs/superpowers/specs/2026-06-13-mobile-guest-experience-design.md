# Mobile Guest Experience & Public Homepage — Design

**Date:** 2026-06-13
**Status:** Approved by CEO (mockups: `mockups/login-wall-mockup.html`, `mockups/guest-bottombar-mockup.html`)
**Decision maker:** Ruslan (CEO & founder)

## Summary

Removes the login wall and makes the guest experience on mobile consistent
and friendly. Two parts:

1. **Public homepage (`/`)** — `middleware.js` no longer redirects
   unauthenticated visitors to `/login`. Anyone (signed in, guest, or
   brand-new visitor) lands directly on the decider. This fixes the
   shared-recipe growth loop (recipient taps "Decide your own meal →" →
   today bounces to `/login`). `/` is shared by desktop and mobile layouts,
   so this applies to both — but it's purely a gate removal, no desktop UI
   changes.

2. **Mobile guest UX polish** (mobile-only — desktop has no bottom bar and
   these screens don't exist there):
   - Decide tab: quiet "free spins left" hint + confirms the SPIN button's
     activation state, guest-only.
   - One unified, friendly "sign up or sign in" gate used consistently
     across Pantry, Scan, Profile, and (new) empty History.

## Part 1 — Public homepage

- `middleware.js`: add `pathname === '/'` to the existing always-allowed
  condition (same list as `/login`, `/r`, etc.), so root is never redirected.
- No change to the `guest_mode` cookie, `guest_session_id`, or
  `/api/spin-check` — the guest spin limit (3/day) keeps working exactly as
  today, independent of this gate.
- `/login`, `/register`, etc. remain reachable and are still how people sign
  in — just no longer the forced first stop.

## Part 2 — Decide tab: spin hint + button state (guest-only)

- New hint line, placed directly **below** the SPIN button:
  "🎲 {n} free spins left today" — small plain gold text, no border or
  background pill.
- Shown **only when `!isSignedIn`**. Signed-in users never see it (unlimited
  spins).
- Initial value: 3 (the existing `DAILY_LIMIT` in
  `app/api/spin-check/route.js`). After each spin, update from the
  `spinsLeft` value that endpoint already returns — no new API needed.
- SPIN button keeps its existing disabled-until-typed behavior
  (`disabled={!ingredients.trim() || loadingSuggest}`, already styled at
  `opacity: 0.4` when disabled). This *is* the "inactive by default,
  activates when typing" behavior — confirmed, no change needed beyond
  verifying it still reads correctly with the hint underneath.

## Part 3 — Unified guest gate

New shared presentational component `app/components/mobile/GuestGate.js`
(+ module CSS): a soft icon badge in a circle, bold title, one-line
description, then **two buttons**:

- Primary (gold gradient): "Sign Up — It's Free" → `/register`
- Secondary (outline): "Already have an account? Sign In" → `/login`

Replaces the current single-button gates. Applied to:

| Screen | Trigger | Icon | Title | Description |
|---|---|---|---|---|
| Pantry tab | guest, always | 🧺 | Your Pantry is waiting | Save ingredient lists and load them into the decider with one tap. Free, takes about 30 seconds. |
| Profile tab | guest, always | 👤 | Make it yours | Sign in to see your profile, meal history, and pantry — or create a free account in seconds. |
| Scan (center button) | guest taps 📸 | 📸 | Snap a photo, skip the typing | AI reads your fridge photo and fills in the ingredient list for you. Free, takes about 30 seconds. |
| History tab — empty state | guest with zero saved meals | 📒 | Remember every meal | Sign up free and we'll keep a running history of everything you decide — synced across your devices. |

For History: a guest who **already has** local history keeps seeing it
normally — no change. The gate only replaces today's plain
"No meals yet — spin the wheel! 🎡" message, and only for guests. Signed-in
users with empty history keep seeing that plain message unchanged.

The Scan gate stays inside its existing modal/popup in `page.js` — only its
inner content switches to the new template.

## Out of scope

- Desktop UI — unaffected (these components/screens don't exist on desktop).
- Spin-limit logic / guest session tracking — unchanged.
- Any redesign of signed-in screens.

## Reference

- Mockups: `mockups/login-wall-mockup.html` (Option 1 — public homepage +
  spin hint), `mockups/guest-bottombar-mockup.html` (all 5 bottom-bar flows
  + unified gate + history empty state).

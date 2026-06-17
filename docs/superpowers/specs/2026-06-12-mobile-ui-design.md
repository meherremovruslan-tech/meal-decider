# Mobile UI — App-Style Shell Design

**Date:** 2026-06-12
**Status:** Approved by PO (mockups: `mockups/mobile-ui-mockup.html`, `mockups/mobile-app-tabs-mockup.html` v2)

## Goal

Give phone users a genuinely mobile experience instead of a compressed desktop page. Mobile is the primary platform for this product (users stand in the kitchen, phone in hand; Fridge Photo Scan only makes sense there). Desktop UI stays exactly as it is today.

## How mobile is detected

No user-agent sniffing. Viewport width decides the layout:

- **< 768px** → mobile app shell (this spec)
- **≥ 768px** → existing desktop layout, untouched

Implementation: a `useIsMobile()` hook backed by `window.matchMedia('(max-width: 767px)')`, plus CSS media queries for purely visual differences. To avoid hydration mismatch, the shell renders after mount (`useEffect`); the brief first paint uses the CSS-only responsive layout that exists today. Resizing a desktop window below the threshold switches layouts live — same React state, no reload, nothing lost.

## App shell

A persistent bottom bar with four tabs and a raised center scan button:

```
 🎡 Decide | 📒 History | (📸 SCAN) | 🧺 Pantry | 👤 Profile
```

- Tab bar: fixed to bottom, `#13131f` background, active tab tinted `#8c8cff`.
- **Center scan button:** 56px raised green-gradient circle (`#2ecc71 → #1abc9c`), labeled "Scan". The app's most prominent control.
- Tabs are client-side state in a `MobileShell` component — no route changes, no page reloads when switching. Existing pages/components are reused inside tabs.
- New components live in `app/components/mobile/` (e.g. `MobileShell.js`, `TabBar.js`), each with its own CSS module. `page.js` renders `MobileShell` when `useIsMobile()` is true, current JSX otherwise.

## Tab 1 — Decide

The existing Step 1 flow, restructured for thumbs:

- Header: logo + small avatar (avatar taps through to Profile tab).
- Ingredients card: existing chips + text input, then full-width **📸 Scan your fridge** and **🧺 Load from pantry** buttons.
- Diet and cuisine chips: horizontal scroll rows (no wrapping), 44px+ touch targets.
- **Sticky SPIN button:** full-width gradient pill pinned above the tab bar, always reachable without scrolling. Disabled state mirrors current rules (needs ≥ 2 ingredients).

### Full-screen spin moment

Tapping SPIN opens a full-screen overlay: the existing canvas wheel rendered large (~290px), pointer on top, ✕ to dismiss. After the spin animation, the result badge ("The wheel chose… 🍝 Chicken Alfredo") fades in with **Get Recipe** and the existing spin-again rules. Get Recipe shows the recipe as a full-screen card with the existing `RecipeActions` row (Share / Copy / Save). Guest spin-gate behavior is unchanged — guests hitting the gate see the existing sign-up nudge instead of the wheel.

## Tab 2 — History

Replaces "Recent Meals" (main page) and the history card (profile page) on mobile:

- Search field at top — client-side filter on meal name (new, mobile-only for now).
- Meals grouped by recency ("This week", "Last week", "Earlier").
- Each meal is a card: tap to expand → recipe preview + action row: 🔗 Share, 📋 Copy, ⬇️ Save (reuse `RecipeActions`), 🗑 Delete.
- Delete uses the existing flow: `DELETE /api/history/[id]` + 5s `UndoToast`, undo re-inserts via POST with original `created_at`. Guests: localStorage, same as today.
- Data source unchanged: `GET /api/history` for signed-in users, localStorage for guests.

## Tab 3 — Pantry

Brings pantry management (today buried in the profile page) to a first-class tab:

- One card per pantry list: emoji + name, ingredient chips with ✕ remove, add-ingredient input, and a primary **🎡 Use in decider** button.
- "Use in decider" merges that list's ingredients into Decide's Step 1 (same merge rules as the existing pantry picker modal) and switches to the Decide tab.
- **＋ New pantry list** dashed button; 3-list limit enforced with "X of 3 lists used" counter (existing API rules).
- Rename/delete list via the ⋯ menu on each card (existing endpoints).
- Guests see the existing sign-up gate copy ("Create up to 3 pantry lists…").
- All CRUD reuses existing `/api/pantry` endpoints — no API changes.

## Tab 4 — Profile

Simplified for mobile. **No favorite-cuisines section** (PO decision — cuisine choice lives on the Decide screen only).

- Hero: large avatar (tap cycles through `AVATAR_POOL` and saves via existing profile API), display name, email, account-type badge (Google / Email).
- Settings rows, native-app style:
  - ✏️ Display name → inline edit
  - 🔒 Change password → existing form, shown as a sub-screen (email accounts only)
  - 📒 Meal history → jumps to History tab
  - 🧺 Pantry lists → jumps to Pantry tab
- Sign out row, visually separated.

## Center scan button

Available from every tab:

- Tap → existing scan flow (Android camera/gallery chooser, resize to 1568px, `POST /api/scan`, claude-haiku-4-5) presented as a full-screen overlay: scanning animation → review chips (tap to exclude) → **Add to decider ✓** merges ingredients into Step 1 and lands on the Decide tab.
- Guests: scan is signed-in only today; tapping shows the existing sign-up nudge modal.

## Error handling

No new failure modes — every data operation reuses existing endpoints and their existing error states (inline error text, disabled buttons while saving). The shell itself has no server dependency. If `matchMedia` is unavailable (ancient browser), the CSS-only responsive layout is the fallback.

## Out of scope (explicitly)

- PWA / "Add to Home Screen" packaging — natural follow-up, separate spec.
- Push notifications.
- Swipe gestures (delete stays button-based in v1; swipe can come later).
- Any desktop layout changes.

## Testing

- `npm run build` must pass before deploy (standard).
- Manual pass on a real Android phone (PO's device) and Chrome DevTools iPhone emulation: all four tabs, scan from each tab, spin overlay, guest mode for each gated feature, history delete + undo, pantry CRUD, rotation/resize across the 768px threshold.
- Desktop regression check: ≥ 768px renders exactly the current UI.

## Build order (staged)

1. **Shell + Decide tab** — `useIsMobile`, `MobileShell`, tab bar with scan button, restructured Decide flow, sticky spin. Biggest visible win.
2. **History + Pantry tabs** — mostly re-housing existing components/endpoints.
3. **Profile tab + full-screen spin polish** — settings rows, avatar tap-to-cycle, spin overlay transitions.

Each stage is deployable on its own (`vercel --prod`).

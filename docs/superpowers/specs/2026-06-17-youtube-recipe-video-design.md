# YouTube Recipe Video — Design

**Date:** 2026-06-17
**Status:** Approved by CEO
**Decision maker:** Ruslan (CEO & founder)

## Summary

When a signed-in user generates a recipe, the server searches YouTube for a
matching video and — if found — surfaces a "▶ Watch Video" button alongside
the existing Share/Copy/Save actions. Tapping it opens an in-app modal that
plays the video via YouTube's embed player; nothing is loaded until the user
taps. Guests never see the button. Past recipes in history get the same
button, using the video found back when that recipe was first generated.

## Why these choices

- **YouTube Data API search, not an AI-guessed link.** Claude has no live
  YouTube access — asking it to name a video risks a confident link to
  something that doesn't exist. The Data API's `search.list` returns a real
  video ID.
- **Signed-in only.** The YouTube Data API free quota (10,000 units/day;
  `search.list` costs 100 units → ~100 searches/day) is shared across the
  *entire app*, not per-user — unlike the Claude usage, which is metered
  per-request. Guests already have a quota system (`lib/guestQuota.js`) for
  Claude calls, but a single abusive guest spamming "Watch Video" across many
  different meals could exhaust the whole day's video quota for everyone,
  including signed-up users. Restricting to signed-in sidesteps this
  entirely rather than building a second guest-quota dimension for it.
- **No preview on the recipe card, just a button.** Keeps the always-visible
  recipe card exactly as light as it is today. No thumbnail fetch, no
  YouTube script loaded until the user actually wants the video.
- **Modal with embedded player on click, not a new tab.** The user explicitly
  wants this to feel like a future mobile app, where leaving to an external
  browser/app breaks immersion. Since the embed only loads on click (not on
  page load), this costs nothing extra for users who never click it — the
  "page weight" concern that ruled out an always-visible embed doesn't apply
  here. Playing the embedded video does not consume YouTube Data API quota
  (only the search call does).
- **Fail silent, not fail loud.** Any error, empty result, or exhausted
  quota collapses to "no video" — the button just doesn't render. No new
  error-state UI, and a YouTube outage or quota exhaustion never blocks
  recipe generation itself.

## Backend

- **New `lib/youtube.js`:**
  ```
  async function searchRecipeVideo(mealName): Promise<{ videoId, videoTitle } | null>
  ```
  Calls `GET https://www.googleapis.com/youtube/v3/search` with:
  - `q`: `"${mealName} recipe"`
  - `type=video`
  - `videoDuration=medium` (excludes Shorts/very long videos)
  - `safeSearch=strict`
  - `maxResults=1`
  - `key`: `process.env.YOUTUBE_API_KEY`

  Any non-200 response, network error, or empty `items` array returns `null`.
  Never throws — callers don't need a try/catch around it.

- **`/api/recipe` (`app/api/recipe/route.js`):** after the Claude recipe call
  succeeds, if `session` exists (signed-in), call `searchRecipeVideo(meal)`
  and include the result in the JSON response (`videoId`, `videoTitle`, both
  omitted/null if not found). Guests get no video fields at all. The
  YouTube call must not block or fail the recipe response — wrap it so any
  error there is swallowed and logged, same as `searchRecipeVideo`'s own
  internal contract.

- **New env var:** `YOUTUBE_API_KEY` (server-only, alongside
  `ANTHROPIC_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`). Already
  added locally; **must be added to Vercel's production env vars before
  deploying this feature** (same step as the existing keys).

## Data

- **Migration (run in Supabase SQL editor, no ORM in this project):**
  ```sql
  alter table recipe_history add column video_id text;
  ```
  Nullable, no default, no backfill — existing rows simply have
  `video_id = null` and show no button.
- When `/api/recipe` saves to `recipe_history` for a signed-in user, also
  write `video_id` (null if no video was found).
- `/api/history` (GET) selects `video_id` so history items can render the
  button.
- `video_title` is **not** persisted — it's only used transiently for modal
  display and can be re-derived from `videoId` if ever needed; storing it
  doubles the column count for no behavior gain (YAGNI).

## Frontend

- **`RecipeActions.js`** gains two new optional props: `videoId`,
  `videoTitle`. If `videoId` is present, render a 4th pill button
  `▶ Watch Video` in the same row as Share/Copy/Save. Clicking it opens the
  new `VideoModal`.
- **New `VideoModal` component** (`app/components/VideoModal.js` +
  `.module.css`):
  - Props: `videoId`, `videoTitle`, `onClose`.
  - Renders `<iframe src="https://www.youtube.com/embed/{videoId}">` only
    while mounted — mounted on open, unmounted on close (which stops
    playback, no separate pause logic needed).
  - **Mobile (`<768px`, same breakpoint as the rest of the mobile shell):**
    full-screen takeover, matching the existing `SpinOverlay` convention —
    X button top corner to close.
  - **Desktop:** centered dialog with a dimmed backdrop; X button or
    clicking the backdrop closes it.
- **Wiring:** `videoId` (and `videoTitle`, when available) flow from the
  `/api/recipe` response into `RecipeActions` for the just-generated recipe.
  History rows only carry `h.video_id` (`video_title` isn't persisted, per
  the Data section) — `VideoModal` treats `videoTitle` as optional and falls
  back to the meal name in its header when absent. Wired at all four
  existing call sites:
  - `app/page.js` (desktop current recipe + desktop history items)
  - `app/components/mobile/SpinOverlay.js` (mobile current recipe)
  - `app/components/mobile/HistoryTab.js` (mobile history items)
  - `app/profile/page.js` (profile history items)
- **Analytics:** new `video_watched` event (meal name), fired on modal open,
  following the existing `track(...)` pattern used by Share/Copy/Save.
- Guests: no client-side gating needed. Since the server only searches for
  signed-in sessions, `videoId` is simply `undefined` for guests, so the
  button never renders.

## Error handling

| Failure | Behavior |
|---|---|
| `YOUTUBE_API_KEY` missing/invalid | `searchRecipeVideo` returns `null`; logged server-side; no button shown |
| YouTube API quota exhausted | Same — returns `null`, no button, recipe still returns normally |
| No results for the meal name | Same — `null`, no button |
| Network/timeout calling YouTube | Same — `null`, no button |

No scenario surfaces an error to the user or blocks recipe generation.

## Testing plan

- `npm run build` after implementation.
- Manual, signed-in, with the real `YOUTUBE_API_KEY`: generate a few recipes
  (e.g. "Chicken Stir Fry", "Pancakes") and confirm a sensible video comes
  back and the button appears.
- Confirm guest `/api/recipe` response has no `videoId` and no button shows.
- Confirm a freshly generated recipe's video persists and shows up correctly
  when revisiting History (main + profile).
- Confirm pre-existing history rows (`video_id = null`, from before this
  migration) render with no button and no errors.
- Confirm modal: full-screen on mobile viewport, centered dialog on desktop;
  closing stops playback (no audio continuing in the background).
- Temporarily break the API key to confirm the failure path: recipe still
  generates successfully, just with no video button.

## Out of scope

- Guest access to the video feature (signed-in only, see rationale above).
- Thumbnail/title preview on the recipe card itself (no preview at all —
  just the button, per the chosen UI option).
- Persisting `video_title` to the database.
- A dedicated/global daily cap or circuit breaker on top of the YouTube
  API's own quota — quota exhaustion already degrades gracefully (no
  button) via the existing error-handling contract.
- Any change to the recipe generation prompt, Claude call, or existing
  guest quota system (`lib/guestQuota.js`) for `/api/suggest` / `/api/recipe`.

## Reference

- Mockups (visual companion session): UI placement comparison (thumbnail
  card vs full embed vs pill button — pill button chosen) and modal layout
  comparison (adaptive full-screen-mobile/centered-desktop vs uniform small
  dialog — adaptive chosen). Not saved as standalone files; decisions
  captured above.

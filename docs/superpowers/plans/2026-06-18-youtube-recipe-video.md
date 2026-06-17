# YouTube Recipe Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a signed-in user generates a recipe, search YouTube for a matching video and let them watch it in an in-app modal via a "▶ Watch Video" button, without affecting guests, page weight, or existing recipe generation.

**Architecture:** A new `lib/youtube.js` helper wraps the YouTube Data API v3 search call and is invoked server-side from `/api/recipe` only when the requester is signed in. The found `videoId`/`videoTitle` flow through the existing recipe JSON response and `recipe_history` row into `RecipeActions`, which renders a 4th pill button that opens a new `VideoModal` (full-screen on mobile, centered dialog on desktop) — the YouTube `<iframe>` embed is only mounted when that modal opens, never eagerly.

**Tech Stack:** Next.js 15 App Router (route handlers in `app/api/*/route.js`), React 19 client components, Supabase (Postgres via `@supabase/supabase-js`), YouTube Data API v3 (REST, no SDK).

## Global Constraints

- Signed-in users only — guests never see the button or trigger a YouTube search (see spec rationale: shared global API quota).
- Any YouTube API failure, missing key, or empty result must degrade to "no button," never an error shown to the user, and must never block recipe generation.
- No new guest-quota plumbing (`lib/guestQuota.js` is untouched).
- `video_title` is not persisted to the database — only `video_id`.
- This project has no test runner (`package.json` has no test script/framework). "Tests" in this plan mean: `npm run build` for compile correctness, `curl` against the dev server for API-route behavior, and manual browser verification (sign in, click through) for UI/auth-gated behavior — this matches how every other feature in this codebase has been verified.
- The codebase has no migration tool — schema changes are run by hand in the Supabase SQL Editor (same pattern used for every prior schema change in this project).

---

## Task 1: Add `video_id` column to `recipe_history`

**Files:** None (database schema change, run manually in Supabase).

**Interfaces:**
- Produces: a nullable `video_id text` column on `recipe_history`, used by Tasks 3 and 4.

- [ ] **Step 1: Give the user the exact migration SQL to run**

Tell the user (Ruslan) to open the Supabase SQL Editor for this project and run:

```sql
alter table recipe_history add column video_id text;
```

- [ ] **Step 2: Wait for confirmation, then verify the column exists**

Ask the user to confirm the query succeeded. Then verify independently by selecting it through the existing service-role client — run this from the project root with the dev server NOT required (plain Node check is unnecessary; instead verify in Task 4's curl step, which will fail loudly with a Postgres "column does not exist" error if this step was skipped). If the user reports an error, read it back to them and resolve before continuing (e.g. "column already exists" is fine to ignore; anything else, stop and investigate).

- [ ] **Step 3: Commit**

No files changed in this task — nothing to commit. Proceed to Task 2.

---

## Task 2: `lib/youtube.js` — YouTube search helper

**Files:**
- Create: `lib/youtube.js`

**Interfaces:**
- Produces: `async function searchRecipeVideo(mealName: string): Promise<{ videoId: string, videoTitle: string } | null>` — never throws. Consumed by Task 3.

- [ ] **Step 1: Confirm the real API response shape with curl**

Run this with the real key from `.env.local` (replace `YOUR_KEY` with the actual `YOUTUBE_API_KEY` value):

```bash
curl -s "https://www.googleapis.com/youtube/v3/search?part=snippet&q=Chicken%20Stir%20Fry%20recipe&type=video&videoDuration=medium&safeSearch=strict&maxResults=1&key=YOUR_KEY"
```

Expected: a JSON object with an `items` array of length 1, where `items[0].id.videoId` is a string and `items[0].snippet.title` is a string. If you get an error JSON instead (e.g. `"error": {"code": 403...}`), stop and resolve the API key/quota issue before continuing — the field names below depend on this shape being correct.

- [ ] **Step 2: Write `lib/youtube.js`**

```js
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// Always resolves — any error, missing key, or empty result returns null
// so callers never need a try/catch around this.
export async function searchRecipeVideo(mealName) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${mealName} recipe`,
    type: 'video',
    videoDuration: 'medium',
    safeSearch: 'strict',
    maxResults: '1',
    key: apiKey,
  });

  try {
    const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`);
    if (!res.ok) {
      console.error('YouTube search failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    return { videoId: item.id.videoId, videoTitle: item.snippet.title };
  } catch (e) {
    console.error('YouTube search error:', e.message);
    return null;
  }
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: compiles successfully (this file isn't wired in yet, so this just confirms no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add lib/youtube.js
git commit -m "feat: add YouTube search helper for recipe videos"
```

---

## Task 3: Wire video search into `/api/recipe`

**Files:**
- Modify: `app/api/recipe/route.js` (full file, shown below)

**Interfaces:**
- Consumes: `searchRecipeVideo(mealName: string)` from Task 2.
- Produces: `/api/recipe` POST response now includes `videoId: string | null` and `videoTitle: string | null`. Consumed by Task 7 (page.js).

- [ ] **Step 1: Replace the full contents of `app/api/recipe/route.js`**

```js
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getGuestSessionId, attachGuestSessionCookie } from '@/lib/guestSession';
import { consumeGuestQuota } from '@/lib/guestQuota';
import { searchRecipeVideo } from '@/lib/youtube';

const client = new Anthropic();
const ALLOWED_CUISINES = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

export async function POST(req) {
  let session, guestSessionId, guestIsNew;
  try {
    session = await getServerSession(authOptions);
    if (!session) {
      ({ sessionId: guestSessionId, isNew: guestIsNew } = await getGuestSessionId());
      const { allowed } = await consumeGuestQuota(guestSessionId, 'recipe');
      if (!allowed) {
        const res = NextResponse.json({ error: 'Daily free limit reached. Sign up for unlimited recipes.' }, { status: 429 });
        if (guestIsNew) attachGuestSessionCookie(res, guestSessionId);
        return res;
      }
    }

    const { meal, ingredients, cuisine } = await req.json();
    if (!meal) {
      return Response.json({ error: 'No meal provided' }, { status: 400 });
    }

    const safeCuisines = Array.isArray(cuisine)
      ? cuisine.filter(c => ALLOWED_CUISINES.includes(c))
      : [];

    const cuisineText = safeCuisines.length
      ? `\nCuisine style: ${safeCuisines.join(', ')}.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Write a concise recipe for: ${meal}${cuisineText}
Available ingredients the user has: ${ingredients}

Format the recipe with these sections:
## Ingredients
(list what's needed, mark anything the user may need to buy)

## Steps
(numbered steps, keep them short and clear)

## Tips
(1-2 practical cooking tips)

Keep it practical and under 400 words.`,
      }],
    });

    const recipe = message.content[0].text;

    let videoId = null;
    let videoTitle = null;
    if (session?.user?.id) {
      const video = await searchRecipeVideo(meal);
      if (video) {
        videoId = video.videoId;
        videoTitle = video.videoTitle;
      }
    }

    if (session?.user?.id) {
      const { error: historyError } = await supabase.from('recipe_history').insert({
        user_id: session.user.id,
        meal_name: meal,
        recipe,
        ingredients: ingredients || '',
        dietary_filters: [],
        cuisine: safeCuisines.length ? safeCuisines.join(',') : null,
        video_id: videoId,
      });
      if (historyError) console.error('History save failed:', historyError.code, historyError.message);
    }

    const res = NextResponse.json({ recipe, videoId, videoTitle });
    if (!session && guestIsNew) attachGuestSessionCookie(res, guestSessionId);
    return res;
  } catch (e) {
    console.error(e);
    const res = NextResponse.json({ error: e.message }, { status: 500 });
    if (!session && guestIsNew) attachGuestSessionCookie(res, guestSessionId);
    return res;
  }
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 3: Start the dev server and verify the guest path**

Run: `npm run dev` (note the port it prints — it may not be 3000 if something else is already running)

```bash
curl -s -c /tmp/cj.txt -X POST http://localhost:PORT/api/recipe \
  -H "Content-Type: application/json" \
  -d '{"meal":"Chicken Stir Fry","ingredients":"chicken, rice"}'
```

Expected: JSON response with a `recipe` field, and `videoId: null`, `videoTitle: null` (guests never get a video, even though the route ran fine). If `ANTHROPIC_API_KEY` is empty in `.env.local` (it has been a placeholder before), this will 500 on the Claude call before reaching the video logic — that's fine, it confirms the route still loads; full signed-in verification happens in Step 4 via the browser regardless.

- [ ] **Step 4: Verify the signed-in path in the browser**

Sign in at `http://localhost:PORT/login` with a real test account, go through Decide → Spin → Get Recipe for a well-known meal (e.g. "Pancakes"). Open browser DevTools → Network tab, find the `/api/recipe` request, and confirm the response JSON has a non-null `videoId` and `videoTitle` that plausibly match the meal. (The button itself isn't wired up yet — that's Tasks 6/7 — so just confirm the API response shape here.)

- [ ] **Step 5: Verify the fail-silent path by temporarily breaking the key**

In `.env.local`, temporarily change `YOUTUBE_API_KEY` to an invalid value (e.g. append `-broken` to it), restart the dev server, and repeat Step 4's signed-in recipe generation. Expected: the recipe still generates successfully and the response has `videoId: null`, `videoTitle: null` — no error surfaces to the user, and the server console logs a "YouTube search failed" or "YouTube search error" line (from `lib/youtube.js`). Then restore the correct key in `.env.local` and restart the dev server again before continuing.

- [ ] **Step 6: Commit**

```bash
git add app/api/recipe/route.js
git commit -m "feat: search YouTube for a matching recipe video on signed-in recipe generation"
```

---

## Task 4: Wire `video_id` into `/api/history`

**Files:**
- Modify: `app/api/history/route.js` (full file, shown below)

**Interfaces:**
- Produces: `/api/history` GET response rows now include `video_id`. POST now accepts an optional `video_id` field (needed so the undo-restore flow in Task 7/8 doesn't drop the video link when a deleted history item is restored).

- [ ] **Step 1: Replace the full contents of `app/api/history/route.js`**

```js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('recipe_history')
    .select('id, meal_name, ingredients, dietary_filters, cuisine, recipe, video_id, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ history: data });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { meal_name, recipe, ingredients, dietary_filters, cuisine, video_id, created_at } = await req.json();
  if (!meal_name) return Response.json({ error: 'meal_name required' }, { status: 400 });

  const row = {
    user_id: session.user.id,
    meal_name,
    recipe: recipe || '',
    ingredients: ingredients || '',
    dietary_filters: dietary_filters || [],
    cuisine: cuisine || null,
    video_id: video_id || null,
  };
  // Restoring a deleted entry (undo) keeps its original date
  if (created_at && !Number.isNaN(Date.parse(created_at))) row.created_at = created_at;

  const { error } = await supabase.from('recipe_history').insert(row);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 3: Verify with curl against a signed-in session**

Reuse the cookie jar from a browser login (DevTools → Application/Storage → Cookies → copy the `next-auth.session-token` value), or simpler: while signed in from Task 3's Step 4, open a new terminal and run this (replace `YOUR_SESSION_COOKIE` with that value):

```bash
curl -s http://localhost:PORT/api/history -H "Cookie: next-auth.session-token=YOUR_SESSION_COOKIE" | head -c 500
```

Expected: JSON with a `history` array where at least one row (the one from Task 3 Step 4) has a non-null `video_id`. If this errors with something mentioning `video_id` and "column does not exist," go back to Task 1 — the migration wasn't applied.

- [ ] **Step 4: Commit**

```bash
git add app/api/history/route.js
git commit -m "feat: include video_id in recipe history reads and writes"
```

---

## Task 5: `VideoModal` component

**Files:**
- Create: `app/components/VideoModal.js`
- Create: `app/components/VideoModal.module.css`

**Interfaces:**
- Produces: `export default function VideoModal({ videoId: string, title?: string, onClose: () => void })`. Renders nothing if `videoId` is falsy. Consumed by Task 6.

- [ ] **Step 1: Write `app/components/VideoModal.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 200; /* above SpinOverlay (95) / UndoToast & other modals (100) */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.dialog {
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  width: 100%;
  max-width: 640px;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
}

.title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close {
  background: none;
  border: none;
  color: #888;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.close:hover { color: #fff; }

.frameWrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* Mobile: full-screen takeover, matching SpinOverlay's existing convention */
@media (max-width: 767px) {
  .overlay { padding: 0; }
  .dialog {
    max-width: none;
    width: 100%;
    height: 100%;
    border-radius: 0;
    border: none;
    display: flex;
    flex-direction: column;
  }
  .frameWrap {
    flex: 1;
    aspect-ratio: auto;
  }
}
```

- [ ] **Step 2: Write `app/components/VideoModal.js`**

```js
'use client';
import styles from './VideoModal.module.css';

export default function VideoModal({ videoId, title, onClose }) {
  if (!videoId) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{title || 'Recipe Video'}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.frameWrap}>
          <iframe
            className={styles.frame}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title || 'Recipe video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: compiles successfully (not wired into any page yet — this just confirms no syntax errors).

- [ ] **Step 4: Commit**

```bash
git add app/components/VideoModal.js app/components/VideoModal.module.css
git commit -m "feat: add VideoModal component for in-app YouTube playback"
```

---

## Task 6: "Watch Video" button in `RecipeActions`

**Files:**
- Modify: `app/components/RecipeActions.js`
- Modify: `app/components/RecipeActions.module.css`

**Interfaces:**
- Consumes: `VideoModal` from Task 5.
- Produces: `RecipeActions` now accepts two new optional props, `videoId: string` and `videoTitle: string`. Existing `meal`/`recipe` props unchanged. Consumed by Tasks 7 and 8.

- [ ] **Step 1: Add the `.watch` button style to `app/components/RecipeActions.module.css`**

Append to the end of the file:

```css

.watch {
  background: linear-gradient(135deg, #ff4d4d, #cc0000);
  border: none;
  color: #fff;
  font-weight: 700;
}

.watch:hover:not(:disabled) {
  opacity: 0.88;
  background: linear-gradient(135deg, #ff4d4d, #cc0000);
  color: #fff;
}
```

- [ ] **Step 2: Modify `app/components/RecipeActions.js`**

Add the import (after the existing `track` import):

```js
import VideoModal from './VideoModal';
```

Change the function signature:

```js
export default function RecipeActions({ meal, recipe, videoId, videoTitle }) {
```

Add new state right after the existing `useState`/`useRef` declarations (after the `pdfRef` line):

```js
  const [showVideo, setShowVideo] = useState(false);

  const watchVideo = (e) => {
    e.stopPropagation();
    setShowVideo(true);
    track('video_watched', { meal });
  };
```

In the returned JSX, add the new button right after the Save button (inside the existing `.row` div, after the `</button>` that closes the Save button and before the closing `</div>` of that row):

```jsx
        {videoId && (
          <button type="button" className={`${styles.btn} ${styles.watch}`} onClick={watchVideo}>
            ▶ Watch Video
          </button>
        )}
```

Add the modal render right after the closing `</div>` of the `.row` div (sibling to it, still inside the outer `<>` fragment, before the off-screen PDF capture `<div>`):

```jsx
      {showVideo && (
        <VideoModal videoId={videoId} title={videoTitle} onClose={() => setShowVideo(false)} />
      )}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Manual verification**

`RecipeActions` isn't receiving `videoId` from any caller yet (that's Tasks 7/8), so there's nothing visible to click yet — this step just confirms the build is clean and `RecipeActions` still renders Share/Copy/Save exactly as before with no `videoId` passed (the new button correctly stays hidden when `videoId` is undefined). Run `npm run dev`, open the app, generate any recipe, confirm Share/Copy/Save still work exactly as before and no "Watch Video" button appears yet.

- [ ] **Step 5: Commit**

```bash
git add app/components/RecipeActions.js app/components/RecipeActions.module.css
git commit -m "feat: add Watch Video button and modal wiring to RecipeActions"
```

---

## Task 7: Wire `videoId`/`videoTitle` through `app/page.js`

**Files:**
- Modify: `app/page.js`

**Interfaces:**
- Consumes: `videoId`/`videoTitle` fields from `/api/recipe` response (Task 3), `video_id` field from `/api/history` rows (Task 4), `videoId`/`videoTitle` props on `RecipeActions` (Task 6).
- Produces: new `videoId`/`videoTitle` props passed into the `<SpinOverlay>` component — `SpinOverlay.js` itself is modified in this same task to accept and forward them.

- [ ] **Step 1: Add `recipeVideo` state**

In the state declarations block (right after `const [recipe, setRecipe] = useState('');` at line 56):

```js
  const [recipeVideo, setRecipeVideo] = useState(null); // { videoId, videoTitle } | null
```

- [ ] **Step 2: Reset `recipeVideo` everywhere `setRecipe('')` resets the current recipe**

There are 5 places in `app/page.js` that call `setRecipe('')` to clear a stale recipe. Add `setRecipeVideo(null);` immediately after each one:

1. Inside the `useEffect` that resets meals when meal time/cuisine change:
```js
      if (prev.length > 0) { setSelectedMeal(null); setRecipe(''); setRecipeVideo(null); }
```
2. In `suggestMeals()`:
```js
    setRecipe('');
    setRecipeVideo(null);
    setError('');
```
3. In `handleMobileSpin()`:
```js
    if (recipe) {
      setRecipe('');
      setRecipeVideo(null);
      setSelectedMeal(null);
    }
```
4. In `spin()`:
```js
    setSpinning(true);
    setSelectedMeal(null);
    setRecipe('');
    setRecipeVideo(null);
```
5. At the start of `getRecipe()`:
```js
    setLoadingRecipe(true);
    setRecipe('');
    setRecipeVideo(null);
    setError('');
```

- [ ] **Step 3: Set `recipeVideo` when a recipe is successfully fetched**

In `getRecipe()`, immediately after `setRecipe(data.recipe);`:

```js
      setRecipe(data.recipe);
      setRecipeVideo(data.videoId ? { videoId: data.videoId, videoTitle: data.videoTitle } : null);
```

- [ ] **Step 4: Add `videoId` to the history mapping**

In `mapServerHistory`, add a new field:

```js
const mapServerHistory = (rows) => rows.map(h => ({
  id: h.id,
  meal: h.meal_name,
  date: new Date(h.created_at).toLocaleDateString(),
  ingredients: h.ingredients,
  recipe: h.recipe,
  dietary_filters: h.dietary_filters,
  cuisine: h.cuisine,
  videoId: h.video_id,
  created_at: h.created_at,
}));
```

- [ ] **Step 5: Pass video props into the desktop recipe card and history items**

The desktop "Step 4: Recipe" card's `RecipeActions` call:

```jsx
            <RecipeActions meal={selectedMeal} recipe={recipe} videoId={recipeVideo?.videoId} videoTitle={recipeVideo?.videoTitle} />
```

The "Recent Meals" history item's `RecipeActions` call:

```jsx
                    <RecipeActions meal={h.meal} recipe={h.recipe} videoId={h.videoId} />
```

- [ ] **Step 6: Pass video props through to `SpinOverlay`**

In the `<SpinOverlay ... />` invocation, add two new props:

```jsx
      <SpinOverlay
        open={isMobile && spinOverlayOpen}
        onClose={() => setSpinOverlayOpen(false)}
        canvasRef={canvasRef}
        canvasSize={canvasSize}
        meals={meals}
        loadingSuggest={loadingSuggest}
        spinning={spinning}
        spinGate={spinGate}
        selectedMeal={selectedMeal}
        intro={mealIntro(mealTime)}
        recipe={recipe}
        videoId={recipeVideo?.videoId}
        videoTitle={recipeVideo?.videoTitle}
        loadingRecipe={loadingRecipe}
        error={error}
        onSpin={spin}
        onGetRecipe={getRecipe}
      />
```

- [ ] **Step 7: Update `undoHistoryDelete` so restoring a deleted item keeps its video link**

In `undoHistoryDelete()`, add `video_id` to the POST body:

```js
        body: JSON.stringify({
          meal_name: item.meal,
          recipe: item.recipe || '',
          ingredients: item.ingredients || '',
          dietary_filters: item.dietary_filters || [],
          cuisine: item.cuisine || null,
          video_id: item.videoId || null,
          created_at: item.created_at,
        }),
```

- [ ] **Step 8: Modify `app/components/mobile/SpinOverlay.js` to accept and forward the new props**

Change the destructured props:

```js
export default function SpinOverlay({
  open, onClose,
  canvasRef, canvasSize,
  meals, loadingSuggest, spinning, spinGate,
  selectedMeal, intro, recipe, videoId, videoTitle, loadingRecipe, error,
  onSpin, onGetRecipe,
}) {
```

Change its internal `RecipeActions` call:

```jsx
            <RecipeActions meal={selectedMeal} recipe={recipe} videoId={videoId} videoTitle={videoTitle} />
```

- [ ] **Step 9: Build check**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 10: Manual verification in the browser**

Run `npm run dev`, sign in, go through Decide → Spin → Get Recipe on desktop viewport. Confirm the "▶ Watch Video" button appears next to Share/Copy/Save, and clicking it opens the modal (centered dialog, dark backdrop) with the video playing. Close it and confirm the video stops (no audio continues). Resize the window below 767px width (or use DevTools device toolbar) and repeat — confirm the modal is now full-screen. Then check "Recent Meals" history — expand the entry you just created and confirm the Watch Video button is there too. If this test account has any history entries from before Task 1's migration (recipes generated prior to this implementation), expand one of those too and confirm it renders normally with no Watch Video button and no console error — those rows have `video_id = null` since there was no backfill.

- [ ] **Step 11: Commit**

```bash
git add app/page.js app/components/mobile/SpinOverlay.js
git commit -m "feat: wire recipe video through desktop and mobile recipe views"
```

---

## Task 8: Wire `video_id` through mobile History tab and profile page

**Files:**
- Modify: `app/components/mobile/HistoryTab.js`
- Modify: `app/profile/page.js`

**Interfaces:**
- Consumes: `videoId` field already present on the shared `history` array from Task 7 (for `HistoryTab.js`); raw `video_id` field from `/api/history` (for `profile/page.js`, which doesn't go through `mapServerHistory`).

- [ ] **Step 1: Modify `app/components/mobile/HistoryTab.js`**

The `history` array passed into this component is the same one `mapServerHistory` produces in `app/page.js` (Task 7, Step 4), so each item already has `.videoId`. Update the `RecipeActions` call:

```jsx
                      {h.recipe
                        ? <RecipeActions meal={h.meal} recipe={h.recipe} videoId={h.videoId} />
                        : <span className={styles.noRecipe}>No saved recipe for this meal.</span>}
```

- [ ] **Step 2: Modify `app/profile/page.js` — `RecipeActions` call**

This page fetches `/api/history` directly without mapping, so the raw field name is `video_id`:

```jsx
                    <RecipeActions meal={h.meal_name} recipe={h.recipe} videoId={h.video_id} />
```

- [ ] **Step 3: Modify `app/profile/page.js` — undo restore payload**

So restoring a deleted profile history item doesn't drop its video link, add `video_id` to the POST body in `undoHistoryDelete()`:

```js
      body: JSON.stringify({
        meal_name: item.meal_name,
        recipe: item.recipe || '',
        ingredients: item.ingredients || '',
        dietary_filters: item.dietary_filters || [],
        cuisine: item.cuisine || null,
        video_id: item.video_id || null,
        created_at: item.created_at,
      }),
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 5: Manual verification in the browser**

Sign in, switch to a mobile viewport (DevTools device toolbar, <768px), go to the History tab, expand the recipe created in Task 7's verification, confirm "▶ Watch Video" appears and opens the full-screen modal. Then visit `/profile`, expand the same history entry there, confirm the button appears and works there too.

- [ ] **Step 6: Commit**

```bash
git add app/components/mobile/HistoryTab.js app/profile/page.js
git commit -m "feat: show Watch Video button in mobile history and profile history"
```

---

## Task 9: Production env var and final end-to-end check

**Files:** None (deployment configuration + manual verification).

- [ ] **Step 1: Add `YOUTUBE_API_KEY` to Vercel**

Tell the user to add `YOUTUBE_API_KEY` to the Vercel project's production environment variables (same place `ANTHROPIC_API_KEY` and the others live), using the same key value already in `.env.local`. This must happen before deploying, or signed-in users in production will simply get no video button (fails silent, per design — not a broken deploy, but the feature won't work until this is set).

- [ ] **Step 2: Full local regression pass**

Run `npm run build` one final time to confirm a clean production build with all changes from Tasks 1–8 together.
Expected: builds successfully with no new warnings.

- [ ] **Step 3: Final manual pass before handing back for deploy approval**

In the browser (dev server running): repeat the signed-in desktop and mobile checks from Task 7/8 once more end-to-end (new recipe → button appears → modal opens/closes correctly on both viewport sizes), then confirm as a guest (signed out) that generating a recipe shows no Watch Video button anywhere and no console errors appear.

- [ ] **Step 4: Report back**

Summarize to the user that implementation is complete and ask whether they want to deploy to production now (do not run `vercel --prod` without that explicit go-ahead, consistent with how every previous deploy in this project has been handled).

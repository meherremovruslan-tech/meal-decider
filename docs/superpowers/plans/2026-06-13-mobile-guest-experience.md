# Mobile Guest Experience & Public Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` publicly accessible (no login wall), and give mobile guests a consistent, friendly "sign up or sign in" nudge everywhere they currently hit an account wall.

**Architecture:** One `middleware.js` allow-list change opens the homepage to everyone. A new shared `GuestGate` presentational component (icon badge + title + description + "Sign Up" / "Sign In" buttons) replaces four existing single-purpose gate UIs (Pantry tab, Profile tab, Scan popup, History empty state). The Decide tab gains a guest-only "free spins left" hint wired to the `spinsLeft` value already returned by `/api/spin-check`.

**Tech Stack:** Next.js 15 App Router, React 19, CSS Modules.

**Notes on verification:** This project has no automated test suite and no git repo (`npm run build` / `npm run dev` / `vercel --prod` are the existing workflow — see `package.json`). Each task below is verified with `npm run build` (catches JSX/type errors) plus a manual check in the browser at a mobile viewport (Chrome DevTools responsive mode, width < 768px, e.g. 390px). There are no commit steps.

---

### Task 1: Open the homepage (`middleware.js`)

**Files:**
- Modify: `middleware.js:7-20`

- [ ] **Step 1: Add `/` to the always-allowed paths**

Current (`middleware.js:7-20`):

```js
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/r') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname === '/icon.svg'
  ) {
    return NextResponse.next();
  }
```

Replace with:

```js
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/r') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname === '/icon.svg'
  ) {
    return NextResponse.next();
  }
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manual check**

Run `npm run dev`, then in an incognito/private browser window (no `guest_mode` or session cookies):

- Visit `http://localhost:3000/` — the decider loads directly, no redirect to `/login`.
- Visit `http://localhost:3000/login` — still loads the login page normally (sign-in flow untouched).

---

### Task 2: Create the shared `GuestGate` component

**Files:**
- Create: `app/components/mobile/GuestGate.js`
- Create: `app/components/mobile/GuestGate.module.css`

- [ ] **Step 1: Create `GuestGate.js`**

```js
'use client';
import Link from 'next/link';
import styles from './GuestGate.module.css';

// Shared "sign up or sign in" prompt for guest-only screens (Pantry, Profile,
// Scan popup, empty History). Always offers both paths so a returning guest
// who already has an account isn't funneled only toward Sign Up.
export default function GuestGate({ icon, title, description }) {
  return (
    <div className={styles.gate}>
      <div className={styles.iconCircle}>{icon}</div>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{description}</p>
      <Link href="/register" className={styles.primaryBtn}>Sign Up — It&rsquo;s Free</Link>
      <Link href="/login" className={styles.secondaryBtn}>Already have an account? Sign In</Link>
    </div>
  );
}
```

- [ ] **Step 2: Create `GuestGate.module.css`**

```css
.gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 30px 24px 6px;
}

.iconCircle {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(247, 201, 72, 0.18), rgba(255, 107, 107, 0.14));
  border: 1px solid rgba(247, 201, 72, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.9rem;
  margin-bottom: 16px;
}

.title {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
  margin: 0 0 8px;
}

.text {
  font-size: 0.9rem;
  color: #999;
  line-height: 1.6;
  margin: 0 0 20px;
  max-width: 260px;
}

.primaryBtn {
  display: block;
  width: 100%;
  max-width: 240px;
  background: linear-gradient(135deg, #f7c948, #ff6b6b);
  color: #1a1a1a;
  font-weight: 800;
  font-size: 0.9rem;
  border-radius: 50px;
  padding: 13px;
  text-align: center;
  text-decoration: none;
  box-shadow: 0 4px 18px rgba(247, 201, 72, 0.22);
  margin-bottom: 10px;
}

.secondaryBtn {
  display: block;
  width: 100%;
  max-width: 240px;
  background: transparent;
  border: 1px solid #3a3a5a;
  color: #ccc;
  font-weight: 700;
  font-size: 0.88rem;
  border-radius: 50px;
  padding: 11px;
  text-align: center;
  text-decoration: none;
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds (the component isn't used anywhere yet, so no visible change).

---

### Task 3: Decide tab — guest-only spin hint + `spinsLeft` wiring

**Files:**
- Modify: `app/components/mobile/DecideTab.js:12-48`
- Modify: `app/components/mobile/DecideTab.module.css:58-76`
- Modify: `app/page.js` (state near `:67`, `spin()` near `:255-266`, DecideTab render near `:737-751`)

- [ ] **Step 1: Add `spinsLeft` prop and hint to `DecideTab.js`**

Current (`app/components/mobile/DecideTab.js:12-48`):

```jsx
export default function DecideTab({
  ingredients, setIngredients,
  mealTime, mealTimeAuto, onMealTime, mealTimeHint,
  cuisine, toggleCuisine,
  isSignedIn, loadingSuggest, error,
  onPantry, onSpin,
}) {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.logo}>🎰 Meal <span>Decider</span></h1>
        {!isSignedIn && (
          <Link href="/register" className={styles.signUpBtn}>Sign Up</Link>
        )}
      </header>

      <section className={styles.card}>
        <span className={styles.label}>What&rsquo;s in your fridge?</span>
        <input
          className={styles.input}
          placeholder="e.g. chicken, rice, tomatoes, garlic…"
          enterKeyHint="done"
          value={ingredients}
          onChange={e => setIngredients(e.target.value)}
        />
        <button
          type="button"
          className={styles.spinCta}
          onClick={onSpin}
          disabled={!ingredients.trim() || loadingSuggest}
        >
          {loadingSuggest ? 'Thinking…' : '🎡 SPIN THE WHEEL'}
        </button>
        <button type="button" className={styles.pantryBtn} onClick={onPantry}>
          <FridgeIcon /> Load from pantry{!isSignedIn && ' 🔒'}
        </button>
      </section>
```

Replace with:

```jsx
export default function DecideTab({
  ingredients, setIngredients,
  mealTime, mealTimeAuto, onMealTime, mealTimeHint,
  cuisine, toggleCuisine,
  isSignedIn, loadingSuggest, error,
  onPantry, onSpin, spinsLeft,
}) {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.logo}>🎰 Meal <span>Decider</span></h1>
        {!isSignedIn && (
          <Link href="/register" className={styles.signUpBtn}>Sign Up</Link>
        )}
      </header>

      <section className={styles.card}>
        <span className={styles.label}>What&rsquo;s in your fridge?</span>
        <input
          className={styles.input}
          placeholder="e.g. chicken, rice, tomatoes, garlic…"
          enterKeyHint="done"
          value={ingredients}
          onChange={e => setIngredients(e.target.value)}
        />
        <button
          type="button"
          className={styles.spinCta}
          onClick={onSpin}
          disabled={!ingredients.trim() || loadingSuggest}
        >
          {loadingSuggest ? 'Thinking…' : '🎡 SPIN THE WHEEL'}
        </button>
        {!isSignedIn && (
          <p className={styles.spinHint}>
            🎲 {spinsLeft} free spin{spinsLeft === 1 ? '' : 's'} left today
          </p>
        )}
        <button type="button" className={styles.pantryBtn} onClick={onPantry}>
          <FridgeIcon /> Load from pantry{!isSignedIn && ' 🔒'}
        </button>
      </section>
```

- [ ] **Step 2: Add `.spinHint` style to `DecideTab.module.css`**

Current (`app/components/mobile/DecideTab.module.css:58-76`):

```css
.spinCta {
  width: 100%;
  border: none;
  border-radius: 50px;
  padding: 15px;
  background: linear-gradient(135deg, #f7c948, #ff6b6b);
  color: #1a1a1a;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(247, 201, 72, 0.22);
  font-family: inherit;
  margin-bottom: 8px;
}
.spinCta:active { transform: scale(0.97); }
.spinCta:disabled { opacity: 0.4; }

.pantryBtn {
```

Replace with:

```css
.spinCta {
  width: 100%;
  border: none;
  border-radius: 50px;
  padding: 15px;
  background: linear-gradient(135deg, #f7c948, #ff6b6b);
  color: #1a1a1a;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(247, 201, 72, 0.22);
  font-family: inherit;
  margin-bottom: 8px;
}
.spinCta:active { transform: scale(0.97); }
.spinCta:disabled { opacity: 0.4; }

.spinHint {
  text-align: center;
  font-size: 0.78rem;
  color: #f7c948;
  margin: 4px 0 12px;
}

.pantryBtn {
```

- [ ] **Step 3: Add `spinsLeft` state to `page.js`**

Current (`app/page.js:67`):

```js
  const [spinGate, setSpinGate] = useState(false);
```

Replace with:

```js
  const [spinGate, setSpinGate] = useState(false);
  // Initial guest quota shown before the first spin; must match
  // DAILY_LIMIT in app/api/spin-check/route.js.
  const [spinsLeft, setSpinsLeft] = useState(3);
```

- [ ] **Step 4: Update `spinsLeft` from the spin-check response in `spin()`**

Current (`app/page.js:255-266`):

```js
    if (!isSignedIn) {
      try {
        const res = await fetch('/api/spin-check', { method: 'POST' });
        const data = await res.json();
        if (!data.allowed) {
          setSpinGate(true);
          return;
        }
      } catch {
        // Network error: allow spin rather than blocking user
      }
    }
```

Replace with:

```js
    if (!isSignedIn) {
      try {
        const res = await fetch('/api/spin-check', { method: 'POST' });
        const data = await res.json();
        if (typeof data.spinsLeft === 'number') setSpinsLeft(data.spinsLeft);
        if (!data.allowed) {
          setSpinGate(true);
          return;
        }
      } catch {
        // Network error: allow spin rather than blocking user
      }
    }
```

- [ ] **Step 5: Pass `spinsLeft` to `DecideTab`**

Current (`app/page.js:737-751`):

```jsx
            <DecideTab
              ingredients={ingredients}
              setIngredients={setIngredients}
              mealTime={mealTime}
              mealTimeAuto={mealTimeAuto}
              onMealTime={selectMealTime}
              mealTimeHint={mealTimeHint}
              cuisine={cuisine}
              toggleCuisine={toggleCuisine}
              isSignedIn={isSignedIn}
              loadingSuggest={loadingSuggest}
              error={error}
              onPantry={openPantryModal}
              onSpin={handleMobileSpin}
            />
```

Replace with:

```jsx
            <DecideTab
              ingredients={ingredients}
              setIngredients={setIngredients}
              mealTime={mealTime}
              mealTimeAuto={mealTimeAuto}
              onMealTime={selectMealTime}
              mealTimeHint={mealTimeHint}
              cuisine={cuisine}
              toggleCuisine={toggleCuisine}
              isSignedIn={isSignedIn}
              loadingSuggest={loadingSuggest}
              error={error}
              onPantry={openPantryModal}
              onSpin={handleMobileSpin}
              spinsLeft={spinsLeft}
            />
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 7: Manual check**

Run `npm run dev`, open Chrome DevTools responsive mode at 390px width, in an incognito window (guest):

- Decide tab loads with the ingredients field empty — the SPIN button is visibly greyed out (disabled), and directly below it reads "🎲 3 free spins left today".
- Type something into the ingredients field — the SPIN button becomes fully colored/active.
- Tap SPIN, let the wheel spin and close the overlay — the hint now reads "🎲 2 free spins left today".
- Sign in (or check while signed in) — the hint is not shown at all.

---

### Task 4: Pantry tab guest gate

**Files:**
- Modify: `app/components/mobile/PantryTab.js:2-4, 129-143`
- Modify: `app/components/mobile/PantryTab.module.css:145-161`

- [ ] **Step 1: Swap imports**

Current (`app/components/mobile/PantryTab.js:1-4`):

```js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PantryTab.module.css';
```

Replace with:

```js
'use client';
import { useEffect, useState } from 'react';
import GuestGate from './GuestGate';
import styles from './PantryTab.module.css';
```

- [ ] **Step 2: Replace the guest gate JSX**

Current (`app/components/mobile/PantryTab.js:129-143`):

```jsx
  if (!isSignedIn) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}><h1 className={styles.logo}>My Pantry</h1></header>
        <div className={styles.gate}>
          <span className={styles.gateIcon}>🧺</span>
          <p className={styles.gateTitle}>Save your ingredients to Pantry</p>
          <p className={styles.gateText}>
            Create up to 3 pantry lists and load them into the decider with one tap — sign up free to start.
          </p>
          <Link href="/register" className={styles.gateBtn}>Sign Up — It&rsquo;s Free</Link>
        </div>
      </div>
    );
  }
```

Replace with:

```jsx
  if (!isSignedIn) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}><h1 className={styles.logo}>My Pantry</h1></header>
        <GuestGate
          icon="🧺"
          title="Your Pantry is waiting"
          description="Save ingredient lists and load them into the decider with one tap. Free, takes about 30 seconds."
        />
      </div>
    );
  }
```

- [ ] **Step 3: Remove the now-unused gate styles**

Current (`app/components/mobile/PantryTab.module.css:145-161`, end of file):

```css
.gate {
  text-align: center;
  padding: 60px 30px;
}
.gateIcon { font-size: 2.6rem; display: block; margin-bottom: 10px; }
.gateTitle { font-size: 1.05rem; font-weight: 700; color: #fff; margin: 0 0 8px; }
.gateText { color: #888; font-size: 0.9rem; line-height: 1.6; margin: 0 0 16px; }
.gateBtn {
  display: inline-block;
  background: linear-gradient(135deg, #6c6cff, #a855f7);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 10px 24px;
  border-radius: 50px;
  text-decoration: none;
}
```

Delete this block entirely (it's the last block in the file — leave the preceding `.limit { ... }` rule as the new end of file).

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors (and no "unused import" issues for `Link`).

- [ ] **Step 5: Manual check**

In an incognito browser at 390px width, as a guest, tap the **Pantry** tab. Confirm:

- The new gate shows: 🧺 icon in a circle badge, "Your Pantry is waiting" title, description, and two buttons — "Sign Up — It's Free" (gold) and "Already have an account? Sign In" (outline).
- Both buttons link correctly (Sign Up → `/register`, Sign In → `/login`).

---

### Task 5: Profile tab guest gate

**Files:**
- Modify: `app/components/mobile/ProfileTab.js:1-6, 95-107`
- Modify: `app/components/mobile/ProfileTab.module.css:121-135`

- [ ] **Step 1: Swap imports**

Current (`app/components/mobile/ProfileTab.js:1-6`):

```js
'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { AVATAR_POOL } from '@/lib/avatars';
import styles from './ProfileTab.module.css';
```

Replace with:

```js
'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { AVATAR_POOL } from '@/lib/avatars';
import GuestGate from './GuestGate';
import styles from './ProfileTab.module.css';
```

- [ ] **Step 2: Replace the guest gate JSX**

Current (`app/components/mobile/ProfileTab.js:95-107`):

```jsx
  if (!isSignedIn) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}><h1 className={styles.logo}>Profile</h1></header>
        <div className={styles.gate}>
          <span className={styles.gateIcon}>👤</span>
          <p className={styles.gateText}>Sign in to manage your profile,<br />history, and pantry.</p>
          <Link href="/login" className={styles.gateBtn}>Sign In</Link>
          <Link href="/register" className={styles.gateLink}>or create a free account</Link>
        </div>
      </div>
    );
  }
```

Replace with:

```jsx
  if (!isSignedIn) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}><h1 className={styles.logo}>Profile</h1></header>
        <GuestGate
          icon="👤"
          title="Make it yours"
          description="Sign in to see your profile, meal history, and pantry — or create a free account in seconds."
        />
      </div>
    );
  }
```

- [ ] **Step 3: Remove the now-unused gate styles**

Current (`app/components/mobile/ProfileTab.module.css:121-135`, end of file):

```css
.gate { text-align: center; padding: 60px 30px; }
.gateIcon { font-size: 2.6rem; display: block; margin-bottom: 10px; }
.gateText { color: #888; font-size: 0.9rem; line-height: 1.6; margin: 0 0 16px; }
.gateBtn {
  display: inline-block;
  background: linear-gradient(135deg, #6c6cff, #a855f7);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 10px 24px;
  border-radius: 50px;
  text-decoration: none;
}
.gateLink { display: block; margin-top: 12px; color: #6c8cff; font-size: 0.85rem; text-decoration: none; }
```

Delete this block entirely (it's the last block in the file — leave the preceding `.pwBtn:disabled { opacity: 0.4; }` rule as the new end of file).

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Manual check**

In an incognito browser at 390px width, as a guest, tap the **Profile** tab. Confirm:

- The new gate shows: 👤 icon in a circle badge, "Make it yours" title, description, and the same two-button layout (Sign Up / Sign In).

---

### Task 6: Scan popup guest gate

**Files:**
- Modify: `app/page.js` (import near `:19-20`, guest scan nudge modal near `:1025-1046`)

- [ ] **Step 1: Import `GuestGate`**

Current (`app/page.js:19-20`):

```js
import ProfileTab from './components/mobile/ProfileTab';
import SpinOverlay from './components/mobile/SpinOverlay';
```

Replace with:

```js
import ProfileTab from './components/mobile/ProfileTab';
import GuestGate from './components/mobile/GuestGate';
import SpinOverlay from './components/mobile/SpinOverlay';
```

- [ ] **Step 2: Replace the guest scan nudge body**

Current (`app/page.js:1025-1046`):

```jsx
      {showGuestScanNudge && (
        <div className={styles.modalOverlay} onClick={() => setShowGuestScanNudge(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>📸 Fridge Scan</span>
              <button type="button" className={styles.modalClose} onClick={() => setShowGuestScanNudge(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalTitle}>Snap a photo, get your ingredients</p>
              <p className={styles.modalSubtitle}>
                Photograph your open fridge and AI fills in the ingredient list for you — sign up free to use it.
              </p>
              <Link
                href="/register"
                className={`${styles.btn} ${styles.btnSignUpGate}`}
                style={{ width: '100%', textAlign: 'center', display: 'block', marginTop: 16, boxSizing: 'border-box' }}
              >
                Sign Up — It's Free
              </Link>
            </div>
          </div>
        </div>
      )}
```

Replace with:

```jsx
      {showGuestScanNudge && (
        <div className={styles.modalOverlay} onClick={() => setShowGuestScanNudge(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>📸 Fridge Scan</span>
              <button type="button" className={styles.modalClose} onClick={() => setShowGuestScanNudge(false)}>×</button>
            </div>
            <GuestGate
              icon="📸"
              title="Snap a photo, skip the typing"
              description="AI reads your fridge photo and fills in the ingredient list for you. Free, takes about 30 seconds."
            />
          </div>
        </div>
      )}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual check**

In an incognito browser at 390px width, as a guest, tap the center **📸 Scan** button on the tab bar. Confirm:

- The popup shows its existing "📸 Fridge Scan" header with close (×) button, followed by the new gate: 📸 icon badge, "Snap a photo, skip the typing" title, description, and the two Sign Up / Sign In buttons.
- The × button and tapping outside the popup still close it.

---

### Task 7: History tab — empty state for guests

**Files:**
- Modify: `app/components/mobile/HistoryTab.js:1-5, 20, 49`
- Modify: `app/page.js` (HistoryTab render near `:753-760`)

- [ ] **Step 1: Import `GuestGate`**

Current (`app/components/mobile/HistoryTab.js:1-5`):

```js
'use client';
import { useState } from 'react';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import styles from './HistoryTab.module.css';
```

Replace with:

```js
'use client';
import { useState } from 'react';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import GuestGate from './GuestGate';
import styles from './HistoryTab.module.css';
```

- [ ] **Step 2: Accept `isSignedIn` prop**

Current (`app/components/mobile/HistoryTab.js:20`):

```jsx
export default function HistoryTab({ history, expandedId, onToggle, onDelete }) {
```

Replace with:

```jsx
export default function HistoryTab({ history, expandedId, onToggle, onDelete, isSignedIn }) {
```

- [ ] **Step 3: Branch the empty state**

Current (`app/components/mobile/HistoryTab.js:49`):

```jsx
      {history.length === 0 && <p className={styles.empty}>No meals yet — spin the wheel! 🎡</p>}
```

Replace with:

```jsx
      {history.length === 0 && (
        isSignedIn ? (
          <p className={styles.empty}>No meals yet — spin the wheel! 🎡</p>
        ) : (
          <GuestGate
            icon="📒"
            title="Remember every meal"
            description="Sign up free and we'll keep a running history of everything you decide — synced across your devices."
          />
        )
      )}
```

- [ ] **Step 4: Pass `isSignedIn` from `page.js`**

Current (`app/page.js:753-760`):

```jsx
            <HistoryTab
              history={history}
              expandedId={expandedHistoryId}
              onToggle={(id) => setExpandedHistoryId(prev => (prev === id ? null : id))}
              onDelete={deleteHistoryItem}
            />
```

Replace with:

```jsx
            <HistoryTab
              history={history}
              expandedId={expandedHistoryId}
              onToggle={(id) => setExpandedHistoryId(prev => (prev === id ? null : id))}
              onDelete={deleteHistoryItem}
              isSignedIn={isSignedIn}
            />
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Manual check**

In an incognito browser at 390px width:

- As a **guest with no history yet** (clear `mealHistory` from localStorage if needed), tap the **History** tab. Confirm the new gate shows: 📒 icon badge, "Remember every meal" title, description, and the Sign Up / Sign In buttons.
- Spin the wheel once (consuming a free spin) and check History again — it now shows the saved meal normally (gate gone), unchanged from before.
- If signed in with no history, History still shows the plain "No meals yet — spin the wheel! 🎡" message (unchanged).

---

## Self-review

- **Spec coverage:** Part 1 → Task 1. Part 2 → Task 3. Part 3 (Pantry/Profile/Scan/History gates + shared component) → Tasks 2, 4, 5, 6, 7. All spec sections have a corresponding task.
- **Consistency:** `GuestGate` is created once in Task 2 with props `icon`, `title`, `description`, and every later task (4–7) calls it with exactly that shape. `spinsLeft` is introduced in Task 3 (`page.js` state, `spin()` update, `DecideTab` prop) and consumed the same task — no later task depends on it.
- **No desktop changes:** every modified file under `app/components/mobile/` plus `middleware.js` and the mobile-only parts of `page.js` (the `showGuestScanNudge` modal only renders via `openScan()`, which mobile's `TabBar` triggers). Desktop rendering (`mainContent`) is untouched.

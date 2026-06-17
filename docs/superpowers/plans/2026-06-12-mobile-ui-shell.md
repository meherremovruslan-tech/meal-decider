# Mobile UI App-Style Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phones (< 768px) get an app-style shell — bottom tab bar (Decide / History / Pantry / Profile) with a raised center 📸 Scan button and a full-screen spin moment — while desktop stays pixel-identical.

**Architecture:** `app/page.js` keeps ALL state and handlers (single source of truth). A `useIsMobile()` matchMedia hook branches the rendered JSX: mobile gets new components under `app/components/mobile/`, desktop gets the existing JSX untouched. Shared overlays (pantry/scan modals, nudges, UndoToast) render once outside the branch — they're `position: fixed` so they work in both layouts. History/Decide tabs are fed by page.js state via props; Pantry and Profile tabs are self-contained (own fetch + CRUD against existing APIs).

**Tech Stack:** Next.js 15 App Router, React 19, CSS Modules, Canvas API, NextAuth v4, existing REST routes.

**Spec:** `docs/superpowers/specs/2026-06-12-mobile-ui-design.md`

**Project adaptations (read first):**
- **No git repo.** Skip all commit steps. The verification gate for every task is `npm run build` passing (run from `C:\Users\User\.local\bin\meal-decider`).
- **No test framework.** Each task ends with an explicit manual check in Chrome DevTools device emulation (F12 → device toolbar → iPhone 12 Pro or similar, width < 768px) against `npm run dev`.
- **One spec correction:** there is no API to change avatars today (assigned randomly at signup, never updated). Task 7 extends `PATCH /api/profile` to accept `avatar_emoji`. Everything else uses existing endpoints unchanged.
- **PowerShell 5.1 caution (from project memory):** never edit the emoji-containing files with `Get-Content`/`Set-Content` — it mojibakes UTF-8. Use the Edit/Write tools only.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/wheel.js` | Create | `drawWheel`, `getSelectedIndex` — shared by desktop page + mobile SpinOverlay |
| `lib/filters.js` | Create | `DIETARY_FILTERS`, `CUISINE_FILTERS` — shared by desktop page + DecideTab |
| `app/components/mobile/useIsMobile.js` | Create | Viewport detection hook |
| `app/components/mobile/TabBar.js` + `.module.css` | Create | Bottom nav with center scan button |
| `app/components/mobile/shell.module.css` | Create | Shell wrapper + placeholder styles |
| `app/components/mobile/DecideTab.js` + `.module.css` | Create | Mobile decide flow (chips, scan/pantry, filters, sticky spin) |
| `app/components/mobile/SpinOverlay.js` + `.module.css` | Create | Full-screen wheel → result → recipe |
| `app/components/mobile/HistoryTab.js` + `.module.css` | Create | Search + grouped expandable history |
| `app/components/mobile/PantryTab.js` + `.module.css` | Create | Self-contained pantry CRUD + "Use in decider" |
| `app/components/mobile/ProfileTab.js` + `.module.css` | Create | Hero, avatar cycle, settings rows, password sub-view |
| `app/page.js` | Modify | Branch on `isMobile`, add `mobileTab` + `spinOverlayOpen` state |
| `app/api/profile/route.js` | Modify | PATCH accepts `avatar_emoji` |
| `app/components/Header.js` + `.module.css` | Modify | Hide global header on mobile root page |
| `app/components/UndoToast.module.css` | Modify | Raise toast above tab bar on mobile |

---

## Stage 1 — Shell + Decide tab

### Task 1: Extract shared wheel + filter modules

The wheel drawing code and filter constants currently live inside `page.js`; the mobile components need them too.

**Files:**
- Create: `lib/wheel.js`
- Create: `lib/filters.js`
- Modify: `app/page.js`

- [ ] **Step 1: Create `lib/wheel.js`** — move (cut, don't copy) `COLORS`, `drawWheel`, `getSelectedIndex` from `app/page.js:37-107`, exactly as they are, with exports:

```js
// Canvas wheel rendering + selection math.
// Shared by the desktop page (app/page.js) and mobile SpinOverlay.
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];

export function drawWheel(canvas, meals, angle) {
  // …body unchanged from page.js lines 41-101…
}

export function getSelectedIndex(angle, n) {
  const slice = (2 * Math.PI) / n;
  const norm = ((-angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(norm / slice) % n;
}
```

(The `drawWheel` body is moved verbatim — it draws slices, labels, hub, and the red pointer triangle. No edits inside it.)

- [ ] **Step 2: Create `lib/filters.js`** — move the two constant arrays from `app/page.js:38-39`:

```js
// Filter chip constants shared by the desktop page and mobile DecideTab.
export const DIETARY_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free'];
export const CUISINE_FILTERS = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];
```

- [ ] **Step 3: Update `app/page.js`** — delete the moved code (lines 37-107 minus the `mapServerHistory` helper above them) and add imports after the existing import block:

```js
import { drawWheel, getSelectedIndex } from '@/lib/wheel';
import { DIETARY_FILTERS, CUISINE_FILTERS } from '@/lib/filters';
```

- [ ] **Step 4: Verify** — Run: `npm run build`. Expected: "✓ Compiled successfully". Then `npm run dev`, open http://localhost:3000, enter ingredients, Suggest, spin the wheel — identical behavior to before.

### Task 2: `useIsMobile` hook

**Files:**
- Create: `app/components/mobile/useIsMobile.js`

- [ ] **Step 1: Create the hook:**

```js
'use client';
import { useState, useEffect } from 'react';

// Spec: < 768px viewport = mobile shell. No user-agent sniffing.
// Returns false on first render (SSR-safe — brief desktop-first paint per spec),
// then tracks live matchMedia changes so window resize switches layouts.
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return; // ancient browser: CSS-only fallback
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Verify** — `npm run build` passes (hook not yet consumed; this just guards syntax).

### Task 3: Tab bar + shell wiring in page.js

After this task, phones show the bottom bar with the working scan button; Decide tab temporarily reuses today's layout; the other three tabs show placeholders.

**Files:**
- Create: `app/components/mobile/TabBar.js`, `app/components/mobile/TabBar.module.css`, `app/components/mobile/shell.module.css`
- Modify: `app/page.js`, `app/components/UndoToast.module.css`

- [ ] **Step 1: Create `app/components/mobile/TabBar.js`:**

```js
'use client';
import styles from './TabBar.module.css';

const LEFT = [
  { id: 'decide', icon: '🎡', label: 'Decide' },
  { id: 'history', icon: '📒', label: 'History' },
];
const RIGHT = [
  { id: 'pantry', icon: '🧺', label: 'Pantry' },
  { id: 'profile', icon: '👤', label: 'Profile' },
];

// Bottom navigation: Decide | History | (📸 scan) | Pantry | Profile.
// The raised center button triggers the existing scan flow from any tab.
export default function TabBar({ active, onTab, onScan }) {
  const tab = (t) => (
    <button
      key={t.id}
      type="button"
      className={`${styles.tab} ${active === t.id ? styles.active : ''}`}
      onClick={() => onTab(t.id)}
    >
      <span className={styles.ico}>{t.icon}</span>
      {t.label}
    </button>
  );
  return (
    <nav className={styles.bar}>
      {LEFT.map(tab)}
      <div className={styles.scanWrap}>
        <button type="button" className={styles.scanBtn} onClick={onScan} aria-label="Scan your fridge">
          📸
        </button>
        <span className={styles.scanLbl}>Scan</span>
      </div>
      {RIGHT.map(tab)}
    </nav>
  );
}
```

- [ ] **Step 2: Create `app/components/mobile/TabBar.module.css`:**

```css
.bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #13131f;
  border-top: 1px solid #23233a;
  padding: 8px 0 max(14px, env(safe-area-inset-bottom));
  z-index: 90;
}

.tab {
  flex: 1;
  background: none;
  border: none;
  text-align: center;
  font-size: 0.68rem;
  color: #666;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
}

.ico {
  font-size: 1.35rem;
  display: block;
  margin-bottom: 2px;
  filter: grayscale(1) opacity(0.55);
}

.active { color: #8c8cff; }
.active .ico { filter: none; }

.scanWrap { flex: 1; text-align: center; }

.scanBtn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 4px solid #0f0f1a;
  background: linear-gradient(135deg, #2ecc71, #1abc9c);
  font-size: 1.5rem;
  cursor: pointer;
  margin-top: -26px;
  box-shadow: 0 4px 18px rgba(46, 204, 113, 0.35);
  transition: transform 0.1s;
}
.scanBtn:active { transform: scale(0.92); }

.scanLbl {
  display: block;
  font-size: 0.68rem;
  color: #2ecc71;
  font-weight: 600;
  margin-top: -2px;
}
```

- [ ] **Step 3: Create `app/components/mobile/shell.module.css`:**

```css
.shell {
  min-height: 100vh;
  padding-bottom: 96px; /* keep content clear of the fixed tab bar */
}

.placeholder {
  text-align: center;
  color: #555;
  padding: 120px 30px;
  font-size: 0.9rem;
  line-height: 1.8;
}
```

- [ ] **Step 4: Wire into `app/page.js`.** Add imports:

```js
import useIsMobile from './components/mobile/useIsMobile';
import TabBar from './components/mobile/TabBar';
import shell from './components/mobile/shell.module.css';
```

Inside `MealDecider()`, next to the other `useState` calls, add:

```js
const isMobile = useIsMobile();
const [mobileTab, setMobileTab] = useState('decide');
```

Restructure the `return`. Today it returns one `<div className={styles.container}>` containing: header, Steps 1–4, error, Recent Meals, then the pantry modal, guest pantry nudge, scan modal, guest scan nudge, and UndoToast. Split it:

```jsx
// Everything that is in the container today EXCEPT the four modals and UndoToast:
const mainContent = (
  <div className={styles.container}>
    {/* header, Step 1-4 cards, error, Recent Meals — existing JSX, unchanged */}
  </div>
);

return (
  <>
    {isMobile ? (
      <div className={shell.shell}>
        {mobileTab === 'decide' && mainContent}
        {mobileTab === 'history' && <div className={shell.placeholder}>📒 Meal History<br />(coming in Stage 2)</div>}
        {mobileTab === 'pantry' && <div className={shell.placeholder}>🧺 My Pantry<br />(coming in Stage 2)</div>}
        {mobileTab === 'profile' && <div className={shell.placeholder}>👤 Profile<br />(coming in Stage 3)</div>}
        <TabBar active={mobileTab} onTab={setMobileTab} onScan={openScan} />
      </div>
    ) : (
      mainContent
    )}

    {/* The four modal blocks and {pendingUndo && <UndoToast …/>} move here, unchanged. */}
  </>
);
```

The modal JSX blocks (`showPantryModal`, `showGuestPantryNudge`, `showScanModal`, `showGuestScanNudge`) and the UndoToast move verbatim — they are fixed-position overlays and now serve both layouts.

- [ ] **Step 5: Raise UndoToast above the tab bar.** Append to `app/components/UndoToast.module.css`:

```css
@media (max-width: 767px) {
  .toast { bottom: 96px; }
}
```

- [ ] **Step 6: Verify** — `npm run build` passes. `npm run dev` + DevTools iPhone emulation: tab bar visible, center scan button opens the scan modal (signed in) or the sign-up nudge (guest), History/Pantry/Profile show placeholders, Decide shows the current UI. Desktop width: zero visual change, no tab bar.

### Task 4: DecideTab + SpinOverlay (the core mobile experience)

**Files:**
- Create: `app/components/mobile/DecideTab.js`, `app/components/mobile/DecideTab.module.css`
- Create: `app/components/mobile/SpinOverlay.js`, `app/components/mobile/SpinOverlay.module.css`
- Modify: `app/page.js`

- [ ] **Step 1: Create `app/components/mobile/DecideTab.js`.** Ingredients stay a comma-separated string in page.js state; this component renders them as chips:

```js
'use client';
import { DIETARY_FILTERS, CUISINE_FILTERS } from '@/lib/filters';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import FridgeIcon from '../FridgeIcon';
import styles from './DecideTab.module.css';

const parse = (s) => s.split(',').map(x => x.trim()).filter(Boolean);

// Mobile decide flow: chip-based ingredient entry, scan/pantry shortcuts,
// horizontally scrolling filter rows, and a sticky SPIN call-to-action.
export default function DecideTab({
  ingredients, setIngredients,
  filters, toggleFilter, cuisine, toggleCuisine,
  isSignedIn, loadingSuggest, error,
  selectedMeal, recipe,
  onScan, onPantry, onSpin,
}) {
  const list = parse(ingredients);

  const addIngredient = (value) => {
    const items = parse(value);
    const lower = list.map(x => x.toLowerCase());
    const toAdd = items.filter(x => !lower.includes(x.toLowerCase()));
    if (toAdd.length > 0) setIngredients([...list, ...toAdd].join(', '));
  };

  const removeIngredient = (ing) => setIngredients(list.filter(x => x !== ing).join(', '));

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.logo}>🎰 Meal <span>Decider</span></h1>
      </header>

      <section className={styles.card}>
        <span className={styles.label}>What&rsquo;s in your fridge?</span>
        {list.length > 0 && (
          <div className={styles.chips}>
            {list.map(ing => (
              <span key={ing} className={styles.ingChip}>
                {ing}
                <button type="button" onClick={() => removeIngredient(ing)} aria-label={`Remove ${ing}`}>✕</button>
              </span>
            ))}
          </div>
        )}
        <input
          className={styles.input}
          placeholder="Type an ingredient, press Enter…"
          enterKeyHint="done"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              addIngredient(e.target.value);
              e.target.value = '';
            }
          }}
        />
        <button type="button" className={styles.scanBtn} onClick={onScan}>
          📸 Scan your fridge{!isSignedIn && ' 🔒'}
        </button>
        <button type="button" className={styles.pantryBtn} onClick={onPantry}>
          <FridgeIcon /> Load from pantry{!isSignedIn && ' 🔒'}
        </button>
      </section>

      <section className={styles.card}>
        <span className={styles.label}>Diet</span>
        <div className={styles.chipRow}>
          {DIETARY_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              className={`${styles.chip} ${filters.includes(f) ? styles.chipOn : ''}`}
              onClick={() => toggleFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {isSignedIn && (
          <>
            <span className={styles.label} style={{ marginTop: 14 }}>Cuisine</span>
            <div className={styles.chipRow}>
              {CUISINE_FILTERS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.chip} ${cuisine.includes(c) ? styles.chipCuisineOn : ''}`}
                  onClick={() => toggleCuisine(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {error && <p className={styles.error}>⚠️ {error}</p>}

      {recipe && (
        <section className={styles.card}>
          <div className={styles.recipeHead}>
            <span className={styles.label}>Your recipe</span>
            <RecipeActions meal={selectedMeal} recipe={recipe} />
          </div>
          <div className={styles.recipe}>{renderRecipe(recipe)}</div>
        </section>
      )}

      <div className={styles.spinDock}>
        <button
          type="button"
          className={styles.spinCta}
          onClick={onSpin}
          disabled={list.length === 0 || loadingSuggest}
        >
          {loadingSuggest ? 'Thinking…' : '🎡 SPIN THE WHEEL'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/components/mobile/DecideTab.module.css`:**

```css
.wrap { padding-bottom: 78px; /* room for the spin dock */ }

.head { padding: 18px 20px 8px; }
.logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px; }
.logo span { color: #f7c948; }

.card {
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  padding: 16px;
  margin: 0 16px 14px;
}

.label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #8888bb;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }

.ingChip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #6c6cff22;
  border: 1px solid #6c6cff55;
  color: #aaaaff;
  border-radius: 20px;
  padding: 8px 14px;
  font-size: 0.9rem;
}
.ingChip button {
  background: none;
  border: none;
  color: #7777cc;
  cursor: pointer;
  padding: 0;
  font-size: 0.9rem;
}

.input {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 14px;
  padding: 14px 16px;
  color: #eee;
  font-size: 1rem;
  outline: none;
  margin-bottom: 12px;
}
.input:focus { border-color: #6c6cff; }
.input::placeholder { color: #555; }

.scanBtn {
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 15px;
  background: linear-gradient(135deg, #2ecc71, #1abc9c);
  color: #06281a;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  margin-bottom: 8px;
}

.pantryBtn {
  width: 100%;
  border: 1px solid #2a2a4a;
  border-radius: 14px;
  padding: 13px;
  background: #1e1e3a;
  color: #aaa;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.chipRow {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.chipRow::-webkit-scrollbar { display: none; }

.chip {
  flex-shrink: 0;
  padding: 9px 16px;
  border-radius: 22px;
  border: 1px solid #2a2a4a;
  background: #0f0f1a;
  color: #999;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}
.chipOn { background: #6c6cff22; border-color: #6c6cff; color: #8c8cff; font-weight: 600; }
.chipCuisineOn { background: #f7c94822; border-color: #f7c948; color: #f7c948; font-weight: 600; }

.error { color: #ff6b6b; font-size: 0.9rem; text-align: center; margin: 0 16px 14px; }

.recipeHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.recipeHead .label { margin-bottom: 0; }

.recipe { white-space: pre-wrap; line-height: 1.7; font-size: 0.92rem; color: #ccc; }
.recipe strong { color: #f7c948; }

.spinDock {
  position: fixed;
  bottom: 78px;
  left: 0;
  right: 0;
  padding: 12px 16px 10px;
  background: linear-gradient(transparent, #0f0f1a 35%);
  z-index: 80;
}

.spinCta {
  width: 100%;
  border: none;
  border-radius: 50px;
  padding: 17px;
  background: linear-gradient(135deg, #f7c948, #ff6b6b);
  color: #1a1a1a;
  font-weight: 800;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 6px 24px rgba(247, 201, 72, 0.25);
  font-family: inherit;
}
.spinCta:active { transform: scale(0.97); }
.spinCta:disabled { opacity: 0.4; }
```

- [ ] **Step 3: Create `app/components/mobile/SpinOverlay.js`.** The canvas pointer is drawn by `drawWheel` itself, so no extra pointer element:

```js
'use client';
import Link from 'next/link';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import styles from './SpinOverlay.module.css';

// Full-screen spin moment: suggest-loading → wheel + SPIN (or guest gate)
// → result badge → recipe view. State machine is driven entirely by props
// from page.js — this component is presentational.
export default function SpinOverlay({
  open, onClose,
  canvasRef, canvasSize,
  meals, loadingSuggest, spinning, spinGate,
  selectedMeal, recipe, loadingRecipe, error,
  onSpin, onGetRecipe,
}) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>

      {loadingSuggest && (
        <div className={styles.center}>
          <span className={styles.spinner} />
          <p className={styles.hint}>AI is thinking of meals…</p>
        </div>
      )}

      {!loadingSuggest && meals.length === 0 && (
        <div className={styles.center}>
          <p className={styles.hint}>{error ? `⚠️ ${error}` : 'Add ingredients first, then spin!'}</p>
        </div>
      )}

      {!loadingSuggest && meals.length > 0 && !recipe && (
        <div className={styles.center}>
          <canvas ref={canvasRef} className={styles.canvas} width={canvasSize} height={canvasSize} />

          {spinGate ? (
            <div className={styles.gate}>
              <p>You&rsquo;ve used your 3 free spins today.<br />Sign up to spin unlimited.</p>
              <Link href="/register" className={styles.gateBtn}>Sign Up — It&rsquo;s Free</Link>
            </div>
          ) : (
            <button type="button" className={styles.spinBtn} onClick={onSpin} disabled={spinning}>
              {spinning ? 'Spinning…' : '🎲 SPIN'}
            </button>
          )}

          {selectedMeal && !spinning && !spinGate && (
            <div className={styles.result}>
              <div className={styles.resultSub}>THE WHEEL CHOSE…</div>
              <div className={styles.resultMeal}>{selectedMeal}</div>
              <button type="button" className={styles.recipeBtn} onClick={onGetRecipe} disabled={loadingRecipe}>
                {loadingRecipe ? 'Writing your recipe…' : 'Get Recipe 👨‍🍳'}
              </button>
            </div>
          )}

          {error && <p className={styles.hint}>⚠️ {error}</p>}
        </div>
      )}

      {recipe && (
        <div className={styles.recipeView}>
          <div className={styles.recipeHead}>
            <span className={styles.resultSub}>YOUR RECIPE</span>
            <RecipeActions meal={selectedMeal} recipe={recipe} />
          </div>
          <div className={styles.recipeText}>{renderRecipe(recipe)}</div>
          <button type="button" className={styles.doneBtn} onClick={onClose}>Done ✓</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/components/mobile/SpinOverlay.module.css`:**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: #0f0f1a;
  z-index: 95; /* above spin dock + tab bar, below UndoToast (100) */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.close {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  color: #888;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 2;
}

.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
  width: 100%;
}

.canvas {
  border-radius: 50%;
  box-shadow: 0 0 50px rgba(108, 108, 255, 0.25);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #333;
  border-top-color: #6c6cff;
  border-radius: 50%;
  animation: overlaySpin 0.7s linear infinite;
}
@keyframes overlaySpin { to { transform: rotate(360deg); } }

.hint { color: #888; font-size: 0.9rem; text-align: center; line-height: 1.7; }

.spinBtn {
  border: none;
  border-radius: 50px;
  padding: 15px 48px;
  background: linear-gradient(135deg, #f7c948, #ff6b6b);
  color: #1a1a1a;
  font-weight: 800;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
  cursor: pointer;
  font-family: inherit;
}
.spinBtn:active { transform: scale(0.97); }
.spinBtn:disabled { opacity: 0.4; }

.gate {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  margin: 0 24px;
}
.gate p { color: #aaa; font-size: 0.9rem; line-height: 1.7; margin: 0 0 14px; }
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

.result {
  background: linear-gradient(135deg, #6c6cff22, #f7c94822);
  border: 1px solid #6c6cff44;
  border-radius: 14px;
  padding: 16px 26px;
  text-align: center;
}
.resultSub { font-size: 0.72rem; color: #888; letter-spacing: 1px; }
.resultMeal { font-size: 1.25rem; font-weight: 700; color: #f7c948; margin: 4px 0 12px; }

.recipeBtn {
  border: none;
  border-radius: 50px;
  padding: 13px 32px;
  background: #2ecc71;
  color: #0f1a10;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  font-family: inherit;
}
.recipeBtn:disabled { opacity: 0.5; }

.recipeView {
  width: 100%;
  max-height: 100vh;
  overflow-y: auto;
  padding: 56px 20px 32px;
}
.recipeHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.recipeText { white-space: pre-wrap; line-height: 1.7; font-size: 0.92rem; color: #ccc; }
.recipeText strong { color: #f7c948; }

.doneBtn {
  width: 100%;
  margin-top: 20px;
  border: none;
  border-radius: 14px;
  padding: 15px;
  background: #6c6cff;
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  font-family: inherit;
}
```

- [ ] **Step 5: Wire both into `app/page.js`.** Add imports:

```js
import DecideTab from './components/mobile/DecideTab';
import SpinOverlay from './components/mobile/SpinOverlay';
```

Add state + handler near `mobileTab`:

```js
const [spinOverlayOpen, setSpinOverlayOpen] = useState(false);

// Sticky CTA: one tap fetches suggestions (if needed) and opens the wheel.
const handleMobileSpin = () => {
  setSpinOverlayOpen(true);
  if (meals.length === 0) suggestMeals();
};
```

Extend the wheel-draw effect so the canvas repaints when the overlay (re)mounts it:

```js
useEffect(() => {
  if (meals.length > 0) drawWheel(canvasRef.current, meals, angleRef.current);
}, [meals, canvasSize, spinOverlayOpen]);
```

Replace the mobile decide branch (`{mobileTab === 'decide' && mainContent}`) with:

```jsx
{mobileTab === 'decide' && (
  <DecideTab
    ingredients={ingredients}
    setIngredients={setIngredients}
    filters={filters}
    toggleFilter={toggleFilter}
    cuisine={cuisine}
    toggleCuisine={toggleCuisine}
    isSignedIn={isSignedIn}
    loadingSuggest={loadingSuggest}
    error={error}
    selectedMeal={selectedMeal}
    recipe={recipe}
    onScan={openScan}
    onPantry={openPantryModal}
    onSpin={handleMobileSpin}
  />
)}
```

Add the overlay next to the shared modals (after the branch):

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
  recipe={recipe}
  loadingRecipe={loadingRecipe}
  error={error}
  onSpin={spin}
  onGetRecipe={getRecipe}
/>
```

Note: only one `<canvas>` is mounted at a time (desktop's renders only in the `!isMobile` branch, mobile's only inside the open overlay), so the shared `canvasRef` is safe.

- [ ] **Step 6: Verify** — `npm run build` passes. Emulation walkthrough: add ingredients as chips (Enter adds, ✕ removes), toggle diet/cuisine chips (horizontal scroll), tap SPIN THE WHEEL → overlay shows "thinking" → wheel appears → SPIN → result badge → Get Recipe → recipe view with Share/Copy/Save → Done returns to Decide with the recipe card visible. Guest after 3 spins: gate appears inside the overlay. Desktop: unchanged.

## Stage 2 — History + Pantry tabs

### Task 5: HistoryTab

**Files:**
- Create: `app/components/mobile/HistoryTab.js`, `app/components/mobile/HistoryTab.module.css`
- Modify: `app/page.js`

- [ ] **Step 1: Create `app/components/mobile/HistoryTab.js`.** Receives page.js state; search and grouping are internal. `idx` passed to `onDelete` is the index in the FULL history array (computed before filtering) because `deleteHistoryItem`/undo splice by that index:

```js
'use client';
import { useState } from 'react';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import styles from './HistoryTab.module.css';

const DAY = 24 * 60 * 60 * 1000;

// Server rows have created_at; guest localStorage rows only have a locale
// date string. Anything unparseable lands in "Earlier".
function groupLabel(h) {
  const ts = h.created_at ? new Date(h.created_at) : new Date(h.date);
  if (isNaN(ts.getTime())) return 'Earlier';
  const days = (Date.now() - ts.getTime()) / DAY;
  if (days < 7) return 'This week';
  if (days < 14) return 'Last week';
  return 'Earlier';
}

export default function HistoryTab({ history, expandedId, onToggle, onDelete }) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const indexed = history.map((h, idx) => ({ h, idx }));
  const visible = q ? indexed.filter(({ h }) => h.meal.toLowerCase().includes(q)) : indexed;

  // history is newest-first, so consecutive items share groups
  const groups = [];
  for (const entry of visible) {
    const label = groupLabel(entry.h);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.logo}>Meal History</h1>
      </header>

      <input
        className={styles.search}
        placeholder="🔍 Search meals…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {history.length === 0 && <p className={styles.empty}>No meals yet — spin the wheel! 🎡</p>}
      {history.length > 0 && visible.length === 0 && (
        <p className={styles.empty}>Nothing matches &ldquo;{query}&rdquo;.</p>
      )}

      {groups.map(g => (
        <section key={`${g.label}-${g.items[0].idx}`}>
          <div className={styles.group}>{g.label}</div>
          {g.items.map(({ h, idx }) => {
            const id = h.id ?? h.meal;
            const open = expandedId === id;
            return (
              <div key={id} className={`${styles.item} ${open ? styles.open : ''}`}>
                <button type="button" className={styles.itemTop} onClick={() => onToggle(id)}>
                  <span className={styles.meal}>{h.meal}</span>
                  <span className={styles.when}>{h.date}</span>
                  <span className={styles.chev}>▼</span>
                </button>
                {open && (
                  <div className={styles.itemBody}>
                    {h.recipe && <div className={styles.recipe}>{renderRecipe(h.recipe)}</div>}
                    <div className={styles.actions}>
                      {h.recipe
                        ? <RecipeActions meal={h.meal} recipe={h.recipe} />
                        : <span className={styles.noRecipe}>No saved recipe for this meal.</span>}
                      <button
                        type="button"
                        className={styles.delete}
                        onClick={(e) => onDelete(e, h, idx)}
                        aria-label={`Delete ${h.meal}`}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/components/mobile/HistoryTab.module.css`:**

```css
.wrap { padding-bottom: 16px; }

.head { padding: 18px 20px 8px; }
.logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px; }

.search {
  display: block;
  width: calc(100% - 32px);
  margin: 4px 16px 12px;
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 12px 14px;
  color: #eee;
  font-size: 0.9rem;
  outline: none;
}
.search:focus { border-color: #6c6cff; }
.search::placeholder { color: #555; }

.empty { text-align: center; color: #555; font-size: 0.9rem; padding: 40px 30px; }

.group {
  padding: 8px 20px 6px;
  color: #666;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.item {
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 14px;
  margin: 0 16px 10px;
  overflow: hidden;
}
.item.open { border-color: #6c6cff55; }

.itemTop {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.meal { flex: 1; font-size: 0.95rem; color: #ddd; font-weight: 600; }
.when { color: #777; font-size: 0.75rem; margin-right: 8px; }
.chev { color: #555; font-size: 0.8rem; transition: transform 0.2s; }
.open .chev { transform: rotate(180deg); }

.itemBody { padding: 0 16px 14px; }

.recipe {
  background: #0f0f1a;
  border-radius: 10px;
  padding: 12px;
  font-size: 0.8rem;
  color: #bbb;
  line-height: 1.65;
  margin-bottom: 10px;
  white-space: pre-wrap;
}
.recipe strong { color: #f7c948; }

.actions { display: flex; align-items: center; gap: 8px; }
.noRecipe { color: #555; font-size: 0.8rem; flex: 1; }

.delete {
  margin-left: auto;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid #ff6b6b33;
  background: #1e1e3a;
  color: #ff8888;
  font-size: 0.95rem;
  cursor: pointer;
}
```

- [ ] **Step 3: Wire into `app/page.js`.** Import `HistoryTab` and replace the history placeholder:

```jsx
{mobileTab === 'history' && (
  <HistoryTab
    history={history}
    expandedId={expandedHistoryId}
    onToggle={(id) => setExpandedHistoryId(prev => (prev === id ? null : id))}
    onDelete={deleteHistoryItem}
  />
)}
```

- [ ] **Step 4: Verify** — `npm run build` passes. Emulation: History tab lists meals grouped by week, search filters live, expanding shows recipe + Share/Copy/Save + 🗑, delete shows the undo toast above the tab bar, UNDO restores the meal at the right position. Works signed-in (server data) and as guest (localStorage).

### Task 6: PantryTab

**Files:**
- Create: `app/components/mobile/PantryTab.js`, `app/components/mobile/PantryTab.module.css`
- Modify: `app/page.js`

- [ ] **Step 1: Create `app/components/mobile/PantryTab.js`.** Self-contained: fetches and mutates via the existing `/api/pantry` routes (same request shapes as `app/profile/page.js`). Rename = tap the name (inline input, saves on blur/Enter); delete = 🗑 button:

```js
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PantryTab.module.css';

const MAX_LISTS = 3;

export default function PantryTab({ isSignedIn, onUse }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [busyIds, setBusyIds] = useState(new Set());

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/pantry')
      .then(r => r.json())
      .then(data => {
        if (data.lists) setLists(data.lists);
        else setError(data.error || 'Failed to load pantry lists');
      })
      .catch(() => setError('Failed to load pantry lists'))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const markBusy = (id, busy) => setBusyIds(prev => {
    const next = new Set(prev);
    busy ? next.add(id) : next.delete(id);
    return next;
  });

  const createList = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create list');
      setLists(prev => [...prev, data.list]);
      setNewName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const renameList = async (id) => {
    const name = editingName.trim();
    setEditingId(null);
    const list = lists.find(l => l.id === id);
    if (!name || !list || name === list.name) return;
    setError('');
    try {
      const res = await fetch(`/api/pantry/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');
      setLists(prev => prev.map(l => (l.id === id ? data.list : l)));
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteList = async (list) => {
    setError('');
    setLists(prev => prev.filter(l => l.id !== list.id));
    try {
      const res = await fetch(`/api/pantry/${list.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
    } catch (e) {
      setError(e.message);
      setLists(prev => [...prev, list]); // restore on failure
    }
  };

  const updateIngredients = async (list, ingredients) => {
    markBusy(list.id, true);
    setError('');
    try {
      const res = await fetch(`/api/pantry/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update list');
      setLists(prev => prev.map(l => (l.id === list.id ? data.list : l)));
    } catch (e) {
      setError(e.message);
    } finally {
      markBusy(list.id, false);
    }
  };

  const addIngredient = (list, raw) => {
    const seen = new Set(list.ingredients.map(x => x.toLowerCase()));
    const toAdd = [];
    for (const piece of raw.split(',')) {
      const value = piece.trim();
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      toAdd.push(value);
    }
    if (toAdd.length > 0) updateIngredients(list, [...list.ingredients, ...toAdd]);
  };

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

  return (
    <div className={styles.wrap}>
      <header className={styles.head}><h1 className={styles.logo}>My Pantry</h1></header>

      {error && <p className={styles.error}>⚠️ {error}</p>}
      {loading && <p className={styles.empty}>Loading…</p>}

      {!loading && lists.map(list => (
        <section key={list.id} className={styles.card}>
          <div className={styles.cardHead}>
            {editingId === list.id ? (
              <input
                className={styles.nameInput}
                value={editingName}
                autoFocus
                maxLength={40}
                onChange={e => setEditingName(e.target.value)}
                onBlur={() => renameList(list.id)}
                onKeyDown={e => e.key === 'Enter' && renameList(list.id)}
              />
            ) : (
              <button
                type="button"
                className={styles.name}
                onClick={() => { setEditingId(list.id); setEditingName(list.name); }}
                title="Tap to rename"
              >
                {list.name}
              </button>
            )}
            <span className={styles.count}>{list.ingredients.length} items</span>
            <button type="button" className={styles.deleteList} onClick={() => deleteList(list)} aria-label={`Delete ${list.name}`}>🗑</button>
          </div>

          <div className={styles.chips}>
            {list.ingredients.map(ing => (
              <span key={ing} className={styles.ingChip}>
                {ing}
                <button
                  type="button"
                  disabled={busyIds.has(list.id)}
                  onClick={() => updateIngredients(list, list.ingredients.filter(i => i !== ing))}
                  aria-label={`Remove ${ing}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {list.ingredients.length === 0 && <span className={styles.emptyList}>No ingredients yet.</span>}
          </div>

          <input
            className={styles.addInput}
            placeholder="Add ingredient, press Enter…"
            enterKeyHint="done"
            disabled={busyIds.has(list.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                addIngredient(list, e.target.value);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            className={styles.useBtn}
            disabled={list.ingredients.length === 0}
            onClick={() => onUse(list.ingredients)}
          >
            🎡 Use in decider
          </button>
        </section>
      ))}

      {!loading && lists.length < MAX_LISTS && (
        <div className={styles.newRow}>
          <input
            className={styles.addInput}
            placeholder="New list name…"
            value={newName}
            maxLength={40}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createList()}
          />
          <button type="button" className={styles.newBtn} onClick={createList} disabled={creating || !newName.trim()}>
            ＋ Create
          </button>
        </div>
      )}
      {!loading && <p className={styles.limit}>{lists.length} of {MAX_LISTS} lists used</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/components/mobile/PantryTab.module.css`:**

```css
.wrap { padding-bottom: 16px; }

.head { padding: 18px 20px 8px; }
.logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px; }

.error { color: #ff6b6b; font-size: 0.85rem; text-align: center; margin: 0 16px 10px; }
.empty { text-align: center; color: #555; font-size: 0.9rem; padding: 40px 30px; }

.card {
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  padding: 16px;
  margin: 0 16px 14px;
}

.cardHead { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }

.name {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

.nameInput {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #6c6cff;
  border-radius: 8px;
  padding: 6px 10px;
  color: #eee;
  font-size: 0.95rem;
  font-weight: 700;
  outline: none;
  font-family: inherit;
}

.count { color: #666; font-size: 0.75rem; flex-shrink: 0; }

.deleteList {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid #ff6b6b33;
  background: #1e1e3a;
  color: #ff8888;
  font-size: 0.9rem;
  cursor: pointer;
}

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.emptyList { color: #555; font-size: 0.85rem; }

.ingChip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #6c6cff22;
  border: 1px solid #6c6cff55;
  color: #aaaaff;
  border-radius: 20px;
  padding: 8px 14px;
  font-size: 0.85rem;
}
.ingChip button {
  background: none;
  border: none;
  color: #7777cc;
  cursor: pointer;
  padding: 0;
  font-size: 0.85rem;
}
.ingChip button:disabled { opacity: 0.4; }

.addInput {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 11px 14px;
  color: #eee;
  font-size: 0.9rem;
  outline: none;
  margin-bottom: 12px;
}
.addInput:focus { border-color: #6c6cff; }
.addInput::placeholder { color: #555; }

.useBtn {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 13px;
  background: #6c6cff;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  font-family: inherit;
}
.useBtn:active { transform: scale(0.98); }
.useBtn:disabled { opacity: 0.4; }

.newRow { display: flex; gap: 8px; margin: 0 16px; }
.newRow .addInput { margin-bottom: 0; flex: 1; }

.newBtn {
  flex-shrink: 0;
  border: 2px dashed #2a2a4a;
  background: transparent;
  border-radius: 12px;
  color: #777;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0 16px;
  cursor: pointer;
  font-family: inherit;
}
.newBtn:disabled { opacity: 0.5; }

.limit { text-align: center; color: #555; font-size: 0.75rem; padding: 10px 0; }

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

- [ ] **Step 3: Wire into `app/page.js`.** Import `PantryTab`, add the merge-and-switch handler near `handleMobileSpin` (same dedupe rule as `confirmPantrySelection`):

```js
// Pantry tab "Use in decider": merge a list's ingredients and jump to Decide.
const usePantryList = (listIngredients) => {
  const existing = ingredients.split(',').map(s => s.trim()).filter(Boolean);
  const existingLower = existing.map(s => s.toLowerCase());
  const toAdd = listIngredients.filter(ing => !existingLower.includes(ing.toLowerCase()));
  setIngredients([...existing, ...toAdd].join(', '));
  setMobileTab('decide');
};
```

Replace the pantry placeholder:

```jsx
{mobileTab === 'pantry' && <PantryTab isSignedIn={isSignedIn} onUse={usePantryList} />}
```

- [ ] **Step 4: Verify** — `npm run build` passes. Emulation (signed in): lists load, add/remove ingredients persists (check by switching tabs and back), tap name → rename, 🗑 deletes, create respects the 3-list limit, "Use in decider" lands on Decide with merged chips. Guest: sign-up gate. Desktop profile page pantry still works (shared API, untouched).

## Stage 3 — Profile tab + polish

### Task 7: Avatar support in profile API + ProfileTab

**Files:**
- Modify: `app/api/profile/route.js`
- Create: `app/components/mobile/ProfileTab.js`, `app/components/mobile/ProfileTab.module.css`
- Modify: `app/page.js`

- [ ] **Step 1: Extend `PATCH` in `app/api/profile/route.js`** to accept `avatar_emoji` (validated against the pool) alongside `display_name`. Replace the PATCH function body:

```js
import { AVATAR_POOL } from '@/lib/avatars';   // add to imports at top

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { display_name, avatar_emoji } = await req.json();
  const updates = {};

  if (display_name !== undefined) {
    if (typeof display_name !== 'string') {
      return Response.json({ error: 'display_name must be a string' }, { status: 400 });
    }
    updates.display_name = display_name.trim().slice(0, 50) || null;
  }

  if (avatar_emoji !== undefined) {
    if (!AVATAR_POOL.includes(avatar_emoji)) {
      return Response.json({ error: 'Invalid avatar' }, { status: 400 });
    }
    updates.avatar_emoji = avatar_emoji;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', session.user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
```

Also extend the GET select to include the avatar already returned (`avatar_emoji` is already selected — no change needed there).

Known limitation (accepted): the NextAuth JWT caches `avatar_emoji`, so the desktop header avatar updates on next sign-in, not instantly. The mobile Profile tab shows its own freshly-fetched copy.

- [ ] **Step 2: Create `app/components/mobile/ProfileTab.js`:**

```js
'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { AVATAR_POOL } from '@/lib/avatars';
import styles from './ProfileTab.module.css';

const PASSWORD_HINT = 'At least 8 characters with 1 uppercase letter and 1 number.';

export default function ProfileTab({ isSignedIn, onGoTab }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.email) setProfile(data);
        else setError(data.error || 'Failed to load profile');
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const cycleAvatar = async () => {
    if (!profile) return;
    const idx = AVATAR_POOL.indexOf(profile.avatar_emoji);
    const next = AVATAR_POOL[(idx + 1) % AVATAR_POOL.length];
    setProfile(p => ({ ...p, avatar_emoji: next })); // optimistic
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_emoji: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Could not save avatar — try again.');
    }
  };

  const saveName = async () => {
    setEditingName(false);
    const name = nameDraft.trim();
    if (!profile || name === (profile.display_name || '')) return;
    setProfile(p => ({ ...p, display_name: name || null }));
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Could not save name — try again.');
    }
  };

  const changePassword = async () => {
    if (pwNew !== pwConfirm) {
      setPwStatus('error:Passwords do not match.');
      return;
    }
    setSavingPw(true);
    setPwStatus('');
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPwStatus('success:Password updated!');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (e) {
      setPwStatus(`error:${e.message}`);
    } finally {
      setSavingPw(false);
    }
  };

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

  return (
    <div className={styles.wrap}>
      <header className={styles.head}><h1 className={styles.logo}>Profile</h1></header>

      {error && <p className={styles.error}>⚠️ {error}</p>}
      {loading && <p className={styles.empty}>Loading…</p>}

      {profile && (
        <>
          <div className={styles.hero}>
            <button type="button" className={styles.avatar} onClick={cycleAvatar}>
              {profile.avatar_emoji || '👤'}
            </button>
            <div className={styles.avatarHint}>tap to change avatar</div>
            <div className={styles.name}>{profile.display_name || profile.email.split('@')[0]}</div>
            <div className={styles.email}>{profile.email}</div>
            <span className={styles.badge}>
              {profile.provider === 'google' ? 'Google account' : 'Email account'}
            </span>
          </div>

          <div className={styles.list}>
            <div className={styles.row}>
              <span className={styles.rowIco}>✏️</span>
              {editingName ? (
                <input
                  className={styles.nameInput}
                  value={nameDraft}
                  autoFocus
                  maxLength={50}
                  placeholder="Display name"
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                />
              ) : (
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => { setEditingName(true); setNameDraft(profile.display_name || ''); }}
                >
                  <span className={styles.rowTxt}>Display name</span>
                  <span className={styles.rowVal}>{profile.display_name || 'not set'} ›</span>
                </button>
              )}
            </div>

            {profile.provider === 'email' && (
              <div className={styles.row}>
                <span className={styles.rowIco}>🔒</span>
                <button type="button" className={styles.rowBtn} onClick={() => setShowPw(v => !v)}>
                  <span className={styles.rowTxt}>Change password</span>
                  <span className={styles.rowVal}>{showPw ? '▲' : '›'}</span>
                </button>
              </div>
            )}
            {showPw && profile.provider === 'email' && (
              <div className={styles.pwForm}>
                <input className={styles.pwInput} type="password" placeholder="Current password"
                  value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} />
                <input className={styles.pwInput} type="password" placeholder="New password"
                  value={pwNew} onChange={e => setPwNew(e.target.value)} />
                <input className={styles.pwInput} type="password" placeholder="Confirm new password"
                  value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} />
                <p className={styles.pwHint}>{PASSWORD_HINT}</p>
                {pwStatus && (
                  <p className={pwStatus.startsWith('success') ? styles.pwOk : styles.pwErr}>
                    {pwStatus.split(':').slice(1).join(':')}
                  </p>
                )}
                <button
                  type="button"
                  className={styles.pwBtn}
                  onClick={changePassword}
                  disabled={savingPw || !pwCurrent || !pwNew || !pwConfirm}
                >
                  {savingPw ? 'Saving…' : 'Update password'}
                </button>
              </div>
            )}

            <div className={styles.row}>
              <span className={styles.rowIco}>📒</span>
              <button type="button" className={styles.rowBtn} onClick={() => onGoTab('history')}>
                <span className={styles.rowTxt}>Meal history</span>
                <span className={styles.rowVal}>›</span>
              </button>
            </div>

            <div className={styles.row}>
              <span className={styles.rowIco}>🧺</span>
              <button type="button" className={styles.rowBtn} onClick={() => onGoTab('pantry')}>
                <span className={styles.rowTxt}>Pantry lists</span>
                <span className={styles.rowVal}>›</span>
              </button>
            </div>
          </div>

          <div className={styles.list}>
            <div className={styles.row}>
              <span className={styles.rowIco}>🚪</span>
              <button
                type="button"
                className={styles.rowBtn}
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <span className={`${styles.rowTxt} ${styles.signout}`}>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/components/mobile/ProfileTab.module.css`:**

```css
.wrap { padding-bottom: 16px; }

.head { padding: 18px 20px 8px; }
.logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px; }

.error { color: #ff6b6b; font-size: 0.85rem; text-align: center; margin: 0 16px 10px; }
.empty { text-align: center; color: #555; font-size: 0.9rem; padding: 40px 30px; }

.hero { text-align: center; padding: 10px 16px 6px; }

.avatar {
  width: 86px;
  height: 86px;
  border-radius: 50%;
  margin: 0 auto;
  background: linear-gradient(135deg, #1e1e3a, #2a2a4a);
  border: 2px solid #6c6cff55;
  font-size: 2.6rem;
  cursor: pointer;
  transition: transform 0.1s;
}
.avatar:active { transform: scale(0.94); }

.avatarHint { color: #555; font-size: 0.7rem; margin: 8px 0 6px; }
.name { font-size: 1.2rem; font-weight: 800; }
.email { color: #888; font-size: 0.82rem; margin-top: 2px; }

.badge {
  display: inline-block;
  margin-top: 8px;
  background: #1e1e3a;
  border: 1px solid #2a2a4a;
  color: #999;
  font-size: 0.7rem;
  padding: 3px 12px;
  border-radius: 20px;
}

.list {
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  margin: 14px 16px 0;
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #1e1e3a;
  padding: 0 16px;
}
.row:last-child { border-bottom: none; }

.rowIco { width: 30px; font-size: 1.05rem; flex-shrink: 0; }

.rowBtn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  padding: 15px 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.92rem;
  text-align: left;
}
.rowTxt { color: #ddd; }
.rowVal { color: #555; font-size: 0.85rem; }
.signout { color: #ff8888; }

.nameInput {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #6c6cff;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 8px 0;
  color: #eee;
  font-size: 0.9rem;
  outline: none;
  font-family: inherit;
}

.pwForm { padding: 4px 16px 14px 46px; }

.pwInput {
  display: block;
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 10px;
  padding: 11px 14px;
  color: #eee;
  font-size: 0.9rem;
  outline: none;
  margin-bottom: 8px;
}
.pwInput:focus { border-color: #6c6cff; }

.pwHint { color: #555; font-size: 0.72rem; margin: 0 0 8px; }
.pwOk { color: #2ecc71; font-size: 0.8rem; margin: 0 0 8px; }
.pwErr { color: #ff6b6b; font-size: 0.8rem; margin: 0 0 8px; }

.pwBtn {
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 12px;
  background: #6c6cff;
  color: #fff;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  font-family: inherit;
}
.pwBtn:disabled { opacity: 0.4; }

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

- [ ] **Step 4: Wire into `app/page.js`.** Import `ProfileTab`, replace the profile placeholder:

```jsx
{mobileTab === 'profile' && <ProfileTab isSignedIn={isSignedIn} onGoTab={setMobileTab} />}
```

- [ ] **Step 5: Verify** — `npm run build` passes. Emulation: avatar taps through the 10-emoji pool and persists after reload; display name edits and persists; change password works on an email account and is hidden for Google accounts; history/pantry rows switch tabs; sign out redirects to /login. Guest sees the sign-in gate. Desktop profile page (`/profile`) still works — same API, backward-compatible PATCH.

### Task 8: Hide global header on mobile root + final regression + deploy

**Files:**
- Modify: `app/components/Header.js`, `app/components/Header.module.css`

- [ ] **Step 1: Hide the global header on the mobile root page** (the shell has its own per-tab headers; other routes like /login and /profile keep the header). In `app/components/Header.js`, add to imports:

```js
import { usePathname } from 'next/navigation';
```

In the component body:

```js
const pathname = usePathname();
```

Change the `<header>` element:

```jsx
<header className={`${styles.header} ${pathname === '/' ? styles.hideOnMobileRoot : ''}`}>
```

- [ ] **Step 2: Add to `app/components/Header.module.css`:**

```css
@media (max-width: 767px) {
  .hideOnMobileRoot { display: none; }
}
```

- [ ] **Step 3: Full regression pass** (`npm run dev`, DevTools emulation + desktop width):
  - Mobile: all four tabs render; scan from each tab; spin overlay end-to-end (suggest → spin → result → recipe → Done); guest gates (spin gate in overlay, scan nudge, pantry gate, profile gate); history search/expand/delete/undo; pantry CRUD + use-in-decider; profile avatar/name/password; UndoToast sits above the tab bar.
  - Resize across 768px in both directions mid-session: layout switches live, ingredients/recipe state survives.
  - Desktop: pixel-identical to today — header visible, no tab bar, wheel inline, profile page works.
  - `/login`, `/register`, `/profile`, `/r` on mobile width: global header still visible, pages unaffected.

- [ ] **Step 4: Build + deploy** — `npm run build` passes, then confirm with the PO before running `vercel --prod --cwd C:\Users\User\.local\bin\meal-decider`.

---

## Self-review notes (done at plan time)

- **Spec coverage:** detection (Task 2), shell + center scan (Task 3), Decide + sticky spin + full-screen wheel + gate (Task 4), History incl. search/groups/undo (Task 5), Pantry incl. 3-list limit + guest gate (Task 6), Profile minus cuisines + avatar + password (Task 7), header behavior + desktop regression (Task 8). Out-of-scope items (PWA, push, swipe) appear in no task. ✓
- **Spec deviations, both flagged above:** (1) `PATCH /api/profile` extended for `avatar_emoji` — spec wrongly assumed it existed; (2) pantry rename via tap-the-name instead of a ⋯ menu — fewer moving parts, same capability. "MobileShell.js" from the spec became `TabBar.js` + a switch in page.js — page.js owns all state, so a pass-through wrapper added nothing.
- **Type consistency:** `onTab(id)`/`onGoTab(id)` use the same tab ids (`'decide' | 'history' | 'pantry' | 'profile'`); `deleteHistoryItem(e, h, idx)` signature matches existing page.js usage; pantry API shapes match `app/profile/page.js` usage; `RecipeActions` always called as `meal`/`recipe` props. ✓
- **Single canvas invariant:** desktop canvas renders only in `!isMobile` branch; mobile canvas only inside open SpinOverlay — shared `canvasRef` never double-mounts. ✓

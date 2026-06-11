# Share Recipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share button to the recipe card that generates a link; clicking the link opens a branded read-only recipe page in the app.

**Architecture:** Recipe data (`{ meal, recipe }`) is JSON-serialised and base64-encoded into the URL query param `d`. A new Next.js client page at `/r` decodes and renders it. No database needed. The share button sits in the existing `saveRow` alongside Copy and Download.

**Tech Stack:** Next.js 15, React 19, `useSearchParams` (wrapped in Suspense), `btoa`/`atob`, Clipboard API

---

## File Map

| File | Change |
|------|--------|
| `app/page.js` | Add `shareLabel` state, `shareRecipe` handler, Share button in recipe card |
| `app/page.module.css` | Add `.btnShare` style |
| `app/r/page.js` | New — shared recipe page (logo, recipe card, CTA) |
| `app/r/page.module.css` | New — styles for share page |

---

### Task 1: Share button in the recipe card

**Files:**
- Modify: `app/page.js`
- Modify: `app/page.module.css`

- [ ] **Step 1: Add `shareLabel` state**

Inside `MealDecider`, after the `[history, setHistory]` state line, add:
```js
const [shareLabel, setShareLabel] = useState('🔗 Share');
```

- [ ] **Step 2: Add `shareRecipe` handler**

After the `downloadRecipe` function, add:
```js
const shareRecipe = async () => {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ meal: selectedMeal, recipe }))));
  const url = `${window.location.origin}/r?d=${payload}`;
  try {
    await navigator.clipboard.writeText(url);
    setShareLabel('✓ Copied!');
  } catch {
    setShareLabel('⚠ Failed');
  }
  setTimeout(() => setShareLabel('🔗 Share'), 2000);
};
```

Note: `btoa(unescape(encodeURIComponent(...)))` safely handles non-ASCII characters (accented letters in meal names or recipe text).

- [ ] **Step 3: Add Share button to the recipe card JSX**

Find the `saveRow` div in the recipe card:
```jsx
          <div className={styles.saveRow}>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={copyRecipe}>
              📋 Copy
            </button>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={downloadRecipe}>
              ⬇️ Download .txt
            </button>
          </div>
```

Replace with:
```jsx
          <div className={styles.saveRow}>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={copyRecipe}>
              📋 Copy
            </button>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={downloadRecipe}>
              ⬇️ Download .txt
            </button>
            <button className={`${styles.btn} ${styles.btnShare}`} onClick={shareRecipe}>
              {shareLabel}
            </button>
          </div>
```

- [ ] **Step 4: Add `.btnShare` style to `app/page.module.css`**

Append to end of file:
```css
.btnShare {
  background: #1a1a3a;
  border: 1px solid #6c6cff44;
  color: #6c6cff;
  font-size: 0.85rem;
  padding: 8px 16px;
}

.btnShare:hover {
  background: #6c6cff22;
  border-color: #6c6cff;
}
```

- [ ] **Step 5: Verify**

1. Start the dev server: `npm run dev`
2. Enter ingredients, suggest meals, spin, get a recipe.
3. Confirm three buttons appear: Copy, Download .txt, 🔗 Share.
4. Click Share — button should flash "✓ Copied!" then return to "🔗 Share".
5. Paste the clipboard into a browser address bar — URL should look like `http://localhost:3000/r?d=eyJtZW...`.

- [ ] **Step 6: Commit**
```bash
git add app/page.js app/page.module.css
git commit -m "feat: add share button that copies encoded recipe link to clipboard"
```

---

### Task 2: Shared recipe page

**Files:**
- Create: `app/r/page.js`
- Create: `app/r/page.module.css`

- [ ] **Step 1: Create `app/r/page.module.css`**

```css
.container {
  max-width: 520px;
  margin: 0 auto;
  padding: 48px 16px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logoWrap {
  width: 160px;
  margin-bottom: 24px;
}

.sharedBy {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  color: #555;
  margin-bottom: 20px;
}

.card {
  width: 100%;
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #8888bb;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.mealName {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f7c948;
  margin-bottom: 14px;
}

.recipe {
  line-height: 1.7;
  font-size: 0.92rem;
  color: #ccc;
}

.errorText {
  color: #888;
  font-size: 0.92rem;
  line-height: 1.6;
}

.ctaWrap {
  width: 100%;
  margin-top: 4px;
}

.ctaBtn {
  display: block;
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #6c6cff, #a855f7);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 14px;
  text-align: center;
  text-decoration: none;
  letter-spacing: 0.2px;
  transition: opacity 0.2s;
}

.ctaBtn:hover { opacity: 0.9; }

.ctaSub {
  text-align: center;
  color: #555;
  font-size: 0.8rem;
  margin-top: 10px;
}
```

- [ ] **Step 2: Create `app/r/page.js`**

```js
'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './page.module.css';
import '../globals.css';

function renderRecipe(text) {
  return text.split('\n').map((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      return <div key={i} style={{ color: '#f7c948', fontWeight: 700, marginTop: 12, marginBottom: 4 }}>{line.replace(/^#+\s/, '')}</div>;
    }
    if (/^\*\*(.+)\*\*$/.test(line)) {
      return <div key={i} style={{ color: '#f7c948', fontWeight: 700, marginTop: 10, marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>;
    }
    if (/^[-•*]\s/.test(line)) {
      return <div key={i} style={{ paddingLeft: 12 }}>• {line.replace(/^[-•*]\s/, '')}</div>;
    }
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{line}</div>;
  });
}

function SharedRecipe() {
  const params = useSearchParams();
  const d = params.get('d');

  let meal = null, recipe = null, error = false;

  try {
    if (!d) throw new Error();
    const decoded = JSON.parse(decodeURIComponent(escape(atob(d))));
    meal = decoded.meal;
    recipe = decoded.recipe;
    if (!meal || !recipe) throw new Error();
  } catch {
    error = true;
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoWrap}>
        <svg width="100%" viewBox="200 55 280 320" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(340,175)">
            <path d="M0,0 L0,-100 A100,100 0 0,1 86.6,-50 Z" fill="#FF6B35" opacity="0.92"/>
            <path d="M0,0 L86.6,-50 A100,100 0 0,1 86.6,50 Z" fill="#F7C948" opacity="0.92"/>
            <path d="M0,0 L86.6,50 A100,100 0 0,1 0,100 Z" fill="#4CAF82" opacity="0.92"/>
            <path d="M0,0 L0,100 A100,100 0 0,1 -86.6,50 Z" fill="#5B9BD5" opacity="0.92"/>
            <path d="M0,0 L-86.6,50 A100,100 0 0,1 -86.6,-50 Z" fill="#C65DB1" opacity="0.92"/>
            <path d="M0,0 L-86.6,-50 A100,100 0 0,1 0,-100 Z" fill="#FF8C5A" opacity="0.92"/>
            <circle cx="0" cy="0" r="100" fill="none" stroke="white" strokeWidth="2.5"/>
            <circle cx="0" cy="0" r="40" fill="white" stroke="#eee" strokeWidth="1"/>
            <g transform="rotate(-15)">
              <line x1="-10" y1="28" x2="-10" y2="-10" stroke="#444" strokeWidth="3" strokeLinecap="round"/>
              <line x1="-16" y1="-10" x2="-16" y2="-28" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="-10" y1="-10" x2="-10" y2="-28" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="-4" y1="-10" x2="-4" y2="-28" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M-16,-10 Q-10,-4 -4,-10" stroke="#444" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </g>
            <g transform="rotate(15)">
              <rect x="7" y="8" width="6" height="20" rx="3" fill="#444"/>
              <rect x="6" y="4" width="8" height="5" rx="1" fill="#555"/>
              <path d="M8,4 L8,-26 Q18,-20 12,4 Z" fill="#444"/>
            </g>
            <polygon points="0,-92 -9,-108 9,-108" fill="#2D2D2D"/>
          </g>
          <text x="340" y="318" textAnchor="middle" fontSize="44" fill="#faf9f5" fontFamily="-apple-system, sans-serif" fontWeight="500">meal decider</text>
          <text x="340" y="350" textAnchor="middle" fill="#c2c0b6" fontSize="24" fontFamily="-apple-system, sans-serif">spin. cook. eat.</text>
        </svg>
      </div>

      <div className={styles.sharedBy}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        A recipe was shared with you
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Your Recipe</span>
        {error ? (
          <p className={styles.errorText}>This recipe link is invalid or expired.</p>
        ) : (
          <>
            <div className={styles.mealName}>{meal}</div>
            <div className={styles.recipe}>{renderRecipe(recipe)}</div>
          </>
        )}
      </div>

      <div className={styles.ctaWrap}>
        <a href="/" className={styles.ctaBtn}>🎰 Decide your own meal →</a>
        <p className={styles.ctaSub}>Enter what's in your fridge and let the wheel decide</p>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <SharedRecipe />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify — happy path**

1. In the main app, get a recipe and click Share.
2. Paste the copied URL into the browser — should open `/r?d=...`.
3. Confirm: logo appears, "A recipe was shared with you" badge, meal name in gold, full recipe formatted correctly, CTA button at bottom.
4. Click "Decide your own meal →" — should navigate to `/`.

- [ ] **Step 4: Verify — error path**

1. Navigate to `http://localhost:3000/r?d=invaliddatahere`.
2. Confirm: same page layout, card shows "This recipe link is invalid or expired.", CTA button still visible and working.

- [ ] **Step 5: Commit**
```bash
git add app/r/page.js app/r/page.module.css
git commit -m "feat: add shared recipe page at /r with logo, recipe card, and app CTA"
```

---

## Self-Review

**Spec coverage:**
- ✅ Share button with "✓ Copied!" feedback — Task 1
- ✅ URL-encoded payload `{ meal, recipe }` — Task 1 Step 2
- ✅ Logo with correct viewBox and text sizing — Task 2 Step 2
- ✅ "A recipe was shared with you" badge — Task 2 Step 2
- ✅ Recipe card identical to main app — Task 2 Step 2 (`renderRecipe` duplicated)
- ✅ CTA button → `/` — Task 2 Step 2
- ✅ Error state for invalid link — Task 2 Step 2 + Step 4
- ✅ Clipboard failure handling — Task 1 Step 2 (`⚠ Failed` label)

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:** `shareLabel` is `string` throughout. Payload shape `{ meal: string, recipe: string }` consistent between encode (Task 1) and decode (Task 2). `btoa`/`atob` encoding pair matches exactly.

**Note:** No test framework in this project — verification is manual browser steps only.

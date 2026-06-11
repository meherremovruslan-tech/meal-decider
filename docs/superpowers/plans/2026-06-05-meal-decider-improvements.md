# Meal Decider Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dietary filters, save recipe, meal history, mobile-responsive canvas, and increase recipe token limit.

**Architecture:** All UI changes live in `app/page.js` and `app/page.module.css`. The dietary filters also touch `app/api/suggest/route.js`. Token limit touches `app/api/recipe/route.js`. No new files or libraries needed — meal history uses `localStorage`, save-recipe uses native browser APIs.

**Tech Stack:** Next.js 15, React 19, Canvas API, localStorage, Clipboard API, Blob/URL API

---

## File Map

| File | Change |
|------|--------|
| `app/api/recipe/route.js` | Increase `max_tokens` from 800 → 1200 |
| `app/api/suggest/route.js` | Accept `filters` array, inject into Claude prompt |
| `app/page.js` | Add filter state + UI, mobile canvas sizing, save buttons, history state + UI |
| `app/page.module.css` | Styles for filter chips, save buttons, history items, mobile media query |

---

### Task 1: Increase recipe token limit

**Files:**
- Modify: `app/api/recipe/route.js:13`

- [ ] **Step 1: Edit the token limit**

In `app/api/recipe/route.js`, change line 14:
```js
// Before
      max_tokens: 800,

// After
      max_tokens: 1200,
```

- [ ] **Step 2: Verify**

Start the dev server (`npm run dev`) and request a complex recipe (e.g. "chicken biryani"). Confirm the recipe is longer and not cut off mid-sentence.

- [ ] **Step 3: Commit**
```bash
git add app/api/recipe/route.js
git commit -m "feat: increase recipe token limit to 1200"
```

---

### Task 2: Dietary filters

**Files:**
- Modify: `app/api/suggest/route.js` — accept `filters`, inject into prompt
- Modify: `app/page.js` — add filter state, filter UI, pass filters to fetch
- Modify: `app/page.module.css` — filter chip styles

- [ ] **Step 1: Update the suggest API route**

Replace the entire contents of `app/api/suggest/route.js`:
```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { ingredients, filters } = await req.json();
    if (!ingredients?.trim()) {
      return Response.json({ error: 'No ingredients provided' }, { status: 400 });
    }

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `I have these ingredients: ${ingredients}.${filterText}
Suggest exactly 6 meal names I can realistically make with some or all of these.
Return ONLY a valid JSON array of 6 short meal name strings, nothing else.
Example format: ["Meal One", "Meal Two", "Meal Three", "Meal Four", "Meal Five", "Meal Six"]`,
      }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const meals = JSON.parse(text);

    return Response.json({ meals });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add filter constants and state to `app/page.js`**

After the `COLORS` constant at the top of `page.js`, add:
```js
const DIETARY_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free'];
```

Inside the `MealDecider` component, after the existing state declarations, add:
```js
const [filters, setFilters] = useState([]);
```

Add the toggle handler after the `filters` state line:
```js
const toggleFilter = (f) =>
  setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
```

- [ ] **Step 3: Pass filters to the suggest fetch**

In `suggestMeals`, find the fetch body and add `filters`:
```js
// Before
        body: JSON.stringify({ ingredients }),

// After
        body: JSON.stringify({ ingredients, filters }),
```

- [ ] **Step 4: Add filter UI to Step 1 card**

In the JSX, inside the Step 1 card, after the closing `</div>` of `inputRow`, add:
```jsx
        <div className={styles.filterRow}>
          {DIETARY_FILTERS.map(f => (
            <label
              key={f}
              className={`${styles.filterChip} ${filters.includes(f) ? styles.filterChipActive : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.includes(f)}
                onChange={() => toggleFilter(f)}
                style={{ display: 'none' }}
              />
              {f}
            </label>
          ))}
        </div>
```

- [ ] **Step 5: Add filter styles to `app/page.module.css`**

Append to end of file:
```css
.filterRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.filterChip {
  padding: 4px 14px;
  border-radius: 20px;
  border: 1px solid #2a2a4a;
  font-size: 0.8rem;
  cursor: pointer;
  color: #888;
  background: #0f0f1a;
  transition: all 0.15s;
  user-select: none;
}

.filterChipActive {
  background: #6c6cff22;
  border-color: #6c6cff;
  color: #6c6cff;
  font-weight: 600;
}
```

- [ ] **Step 6: Verify**

1. Open the app. Check the 4 filter chips appear below the ingredient input.
2. Click "Vegan" — chip should highlight purple.
3. Enter "rice, lentils, tomatoes" with Vegan selected → click Suggest.
4. Confirm all 6 suggested meals are vegan (no meat/dairy).
5. Deselect and re-suggest — should get non-vegan options back.

- [ ] **Step 7: Commit**
```bash
git add app/api/suggest/route.js app/page.js app/page.module.css
git commit -m "feat: add dietary filter chips (vegetarian, vegan, gluten-free, dairy-free)"
```

---

### Task 3: Mobile-responsive canvas

**Files:**
- Modify: `app/page.js` — dynamic canvas size based on window width
- Modify: `app/page.module.css` — mobile media query for layout

- [ ] **Step 1: Add canvas size state to `app/page.js`**

Inside `MealDecider`, after the existing state declarations, add:
```js
const [canvasSize, setCanvasSize] = useState(340);
```

- [ ] **Step 2: Add resize effect**

After the existing `useEffect` hooks, add:
```js
useEffect(() => {
  const update = () => setCanvasSize(Math.min(window.innerWidth - 48, 340));
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
}, []);
```

- [ ] **Step 3: Redraw wheel on size change**

Find the existing effect that draws the wheel:
```js
useEffect(() => {
  if (meals.length > 0) drawWheel(canvasRef.current, meals, angleRef.current);
}, [meals]);
```

Add `canvasSize` to the dependency array:
```js
useEffect(() => {
  if (meals.length > 0) drawWheel(canvasRef.current, meals, angleRef.current);
}, [meals, canvasSize]);
```

- [ ] **Step 4: Use dynamic canvas size in JSX**

Find the canvas element:
```jsx
// Before
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={340}
              height={340}
            />

// After
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={canvasSize}
              height={canvasSize}
            />
```

- [ ] **Step 5: Add mobile media query to `app/page.module.css`**

Append to end of file:
```css
@media (max-width: 480px) {
  .container {
    padding: 16px 12px 48px;
    gap: 20px;
  }
  .card {
    padding: 14px;
    border-radius: 12px;
  }
  .header h1 {
    font-size: 1.5rem;
  }
  .btnSpin {
    padding: 10px 24px;
    font-size: 1rem;
  }
  .input {
    font-size: 0.9rem;
  }
}
```

- [ ] **Step 6: Verify**

1. Open DevTools → toggle mobile view (e.g. iPhone SE, 375px wide).
2. Suggest some meals → wheel should be ~327px (375 - 48), not overflowing.
3. Resize back to desktop → wheel should return to 340px.
4. Wheel should draw and spin correctly at both sizes.

- [ ] **Step 7: Commit**
```bash
git add app/page.js app/page.module.css
git commit -m "feat: responsive canvas that adapts to mobile screen width"
```

---

### Task 4: Save recipe (copy + download)

**Files:**
- Modify: `app/page.js` — add `copyRecipe` and `downloadRecipe` handlers, save buttons in recipe card
- Modify: `app/page.module.css` — save button row styles

- [ ] **Step 1: Add save handlers to `app/page.js`**

After the `getRecipe` function, add:
```js
const copyRecipe = () => {
  navigator.clipboard.writeText(`${selectedMeal}\n\n${recipe}`);
};

const downloadRecipe = () => {
  const blob = new Blob([`${selectedMeal}\n\n${recipe}`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selectedMeal.replace(/\s+/g, '-').toLowerCase()}-recipe.txt`;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 2: Add save buttons to the recipe card in JSX**

Find the recipe card in JSX:
```jsx
      {recipe && (
        <div className={styles.card}>
          <span className={styles.label}>Your Recipe</span>
          <div className={styles.recipe}>{renderRecipe(recipe)}</div>
        </div>
      )}
```

Replace with:
```jsx
      {recipe && (
        <div className={styles.card}>
          <span className={styles.label}>Your Recipe</span>
          <div className={styles.recipe}>{renderRecipe(recipe)}</div>
          <div className={styles.saveRow}>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={copyRecipe}>
              📋 Copy
            </button>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={downloadRecipe}>
              ⬇️ Download .txt
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Add save button styles to `app/page.module.css`**

Append to end of file:
```css
.saveRow {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btnSave {
  background: #1e1e3a;
  border: 1px solid #2a2a4a;
  color: #aaa;
  font-size: 0.85rem;
  padding: 8px 16px;
}

.btnSave:hover {
  background: #252545;
  color: #eee;
  border-color: #6c6cff44;
}
```

- [ ] **Step 4: Verify**

1. Get a recipe for any meal.
2. Click "Copy" — paste into a text editor to confirm the meal name + full recipe is there.
3. Click "Download .txt" — file should download named `{meal-name}-recipe.txt` with the recipe text inside.

- [ ] **Step 5: Commit**
```bash
git add app/page.js app/page.module.css
git commit -m "feat: add copy-to-clipboard and download-as-txt for recipes"
```

---

### Task 5: Meal history (last 10 spins, localStorage)

**Files:**
- Modify: `app/page.js` — history state, load from localStorage on mount, save on spin, render history section
- Modify: `app/page.module.css` — history item styles

- [ ] **Step 1: Add history state and load from localStorage**

Inside `MealDecider`, after the `canvasSize` state, add:
```js
const [history, setHistory] = useState([]);
```

After the resize `useEffect`, add:
```js
useEffect(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('mealHistory') || '[]');
    setHistory(stored);
  } catch {}
}, []);
```

- [ ] **Step 2: Add `saveToHistory` function**

After the `downloadRecipe` function, add:
```js
const saveToHistory = useCallback((meal, currentIngredients) => {
  setHistory(prev => {
    const entry = {
      meal,
      date: new Date().toLocaleDateString(),
      ingredients: currentIngredients,
    };
    const updated = [entry, ...prev.filter(h => h.meal !== meal)].slice(0, 10);
    localStorage.setItem('mealHistory', JSON.stringify(updated));
    return updated;
  });
}, []);
```

Note: `useCallback` is already imported at the top of the file.

- [ ] **Step 3: Call `saveToHistory` after spin resolves**

In the `spin` function, capture `ingredients` at spin time and call `saveToHistory` when the wheel stops:

Find this block inside `spin`:
```js
  velocityRef.current = Math.random() * 0.15 + 0.22;

  const animate = () => {
```

Replace with:
```js
  velocityRef.current = Math.random() * 0.15 + 0.22;
  const currentIngredients = ingredients;

  const animate = () => {
```

Then find:
```js
        setSelectedMeal(mealsRef.current[idx]);
        setSpinning(false);
```

Replace with:
```js
        const winner = mealsRef.current[idx];
        setSelectedMeal(winner);
        setSpinning(false);
        saveToHistory(winner, currentIngredients);
```

- [ ] **Step 4: Add history section to JSX**

In the JSX return, after the error block at the bottom, add:
```jsx
      {history.length > 0 && (
        <div className={styles.card}>
          <span className={styles.label}>Recent Meals</span>
          {history.map((h, i) => (
            <div key={i} className={styles.historyItem}>
              <span className={styles.historyMeal}>{h.meal}</span>
              <span className={styles.historyMeta}>{h.date}</span>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 5: Add history styles to `app/page.module.css`**

Append to end of file:
```css
.historyItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #1e1e3a;
  font-size: 0.9rem;
}

.historyItem:last-child {
  border-bottom: none;
}

.historyMeal {
  color: #ddd;
}

.historyMeta {
  color: #555;
  font-size: 0.8rem;
}
```

- [ ] **Step 6: Verify**

1. Spin the wheel → confirm the winning meal appears in "Recent Meals" at the bottom.
2. Spin again with a different meal → it should appear at the top of the list.
3. Spin the same meal again → it should move to the top (no duplicates).
4. Refresh the page → history should persist (loaded from localStorage).
5. Spin 11 times → confirm the list never exceeds 10 items.

- [ ] **Step 7: Commit**
```bash
git add app/page.js app/page.module.css
git commit -m "feat: add meal history panel with localStorage persistence (last 10 spins)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dietary filters — Task 2
- ✅ Save recipe (copy + download) — Task 4
- ✅ Meal history (last 10, this week) — Task 5
- ✅ Mobile canvas — Task 3
- ✅ Token limit 800 → 1200 — Task 1

**Placeholder scan:** No TBDs, no "similar to Task N", all code blocks complete.

**Type consistency:** `filters` is `string[]` throughout. `history` entry shape `{meal, date, ingredients}` consistent between write (Task 5 Step 2) and read (Task 5 Step 4).

**Note on testing:** This project has no test framework configured. Verification steps are manual browser checks — follow them exactly before each commit.

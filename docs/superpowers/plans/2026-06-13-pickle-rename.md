# Pick'le Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product from "Meal Decider" to "Pick'le" everywhere users see the name, add the Baloo 2 brand font for wordmarks, and create a favicon/app icon from the existing wheel + fork & knife mark.

**Architecture:** A single source of truth `lib/brand.js` exports `APP_NAME = "Pick'le"`; every JS surface imports it (avoids unescaped-apostrophe lint issues in JSX and makes any future rename a one-line change). Baloo 2 is loaded via `next/font/google` in the root layout and exposed as CSS variable `--font-brand`, which the wordmark CSS rules consume. The app icon is a static `app/icon.svg` (Next.js App Router picks it up automatically as the favicon) reusing the wheel SVG paths from the share page.

**Tech Stack:** Next.js 15 App Router, `next/font/google`, CSS Modules. No test framework in this repo and **no git repo** — skip all commit steps; the verification gate for every task is `npm run build` passing (run from `C:\Users\User\.local\bin\meal-decider`).

**Spec:** `docs/superpowers/specs/2026-06-13-pickle-rename-design.md`

**Out of scope (per spec):** Vercel project name / URL (stays `meal-decider-alpha.vercel.app`), domains, social handles, wheel visuals, motto. Historical docs/plans/mockups keep the old name. The `MealDecider` React component name in `app/page.js` is internal and stays.

---

### Task 1: Brand constant + font + metadata title

**Files:**
- Create: `lib/brand.js`
- Modify: `app/layout.js`

- [ ] **Step 1: Create `lib/brand.js`**

```js
// Single source of truth for the product name. Display form uses the
// apostrophe; technical identifiers (domains, slugs) use plain "pickle".
export const APP_NAME = "Pick'le";
export const MOTTO = 'spin. cook. eat.';
```

- [ ] **Step 2: Replace `app/layout.js` entirely**

```js
import './globals.css';
import { Baloo_2 } from 'next/font/google';
import Providers from './components/Providers';
import Header from './components/Header';
import { APP_NAME, MOTTO } from '@/lib/brand';

const brandFont = Baloo_2({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-brand',
});

export const metadata = {
  title: `${APP_NAME} — ${MOTTO}`,
  description: "Tell AI what's in your fridge, spin the wheel, get a recipe.",
};

export default function RootLayout({ children }) {
  return (
    <Providers>
      <html lang="en">
        <body className={brandFont.variable}>
          <Header />
          {children}
        </body>
      </html>
    </Providers>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build` (from `C:\Users\User\.local\bin\meal-decider`)
Expected: build succeeds. (Header still says "Meal Decider" — fixed in Task 2.)

### Task 2: Desktop header wordmark

**Files:**
- Modify: `app/components/Header.js:27`
- Modify: `app/components/Header.module.css:11-16`

- [ ] **Step 1: In `app/components/Header.js`, add the import (after line 6 `import styles from './Header.module.css';`)**

```js
import { APP_NAME } from '@/lib/brand';
```

- [ ] **Step 2: Replace line 27**

Old:
```jsx
      <span className={styles.logo}>🎰 Meal Decider</span>
```
New:
```jsx
      <span className={styles.logo}>🎰 {APP_NAME}</span>
```

- [ ] **Step 3: In `app/components/Header.module.css`, add the brand font to `.logo`**

Old:
```css
.logo {
  font-size: 1rem;
  font-weight: 800;
  color: #f7c948;
  letter-spacing: -0.3px;
}
```
New:
```css
.logo {
  font-family: var(--font-brand), system-ui, sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f7c948;
  letter-spacing: 0;
}
```

(Baloo 2 has no 800 weight — use 700. Its rounded letterforms don't need negative letter-spacing.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 3: Main page wordmark (desktop)

**Files:**
- Modify: `app/page.js:511`
- Modify: `app/page.module.css:12`

- [ ] **Step 1: In `app/page.js`, add the import next to the other `@/lib` imports at the top of the file**

```js
import { APP_NAME } from '@/lib/brand';
```

- [ ] **Step 2: Replace line 511**

Old:
```jsx
        <h1><span>🎰</span> AI Meal Decider</h1>
```
New:
```jsx
        <h1><span>🎰</span> {APP_NAME}</h1>
```

(The "AI" prefix is dropped — the brand is just Pick'le; the subtitle below already says AI.)

- [ ] **Step 3: In `app/page.module.css`, add the brand font to the h1 rule (line 12)**

Old:
```css
.header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; }
```
New:
```css
.header h1 { font-family: var(--font-brand), system-ui, sans-serif; font-size: 2rem; font-weight: 700; letter-spacing: 0; }
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 4: Mobile Decide tab wordmark

**Files:**
- Modify: `app/components/mobile/DecideTab.js:20`
- Modify: `app/components/mobile/DecideTab.module.css:10`

- [ ] **Step 1: Replace line 20 of `app/components/mobile/DecideTab.js`**

Old:
```jsx
        <h1 className={styles.logo}>🎰 Meal <span>Decider</span></h1>
```
New:
```jsx
        <h1 className={styles.logo}>🎰 <span>Pick</span>&apos;le</h1>
```

(The yellow `<span>` accent moves to "Pick" so the function reads first — per spec, the apostrophe separates "Pick" visually. `&apos;` avoids unescaped-entity lint in raw JSX text; no import needed here.)

- [ ] **Step 2: In `app/components/mobile/DecideTab.module.css`, add the brand font to `.logo` (line 10)**

Old:
```css
.logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px; }
```
New:
```css
.logo { font-family: var(--font-brand), system-ui, sans-serif; font-size: 1.3rem; font-weight: 700; letter-spacing: 0; }
```

(Do NOT touch the `.logo` rules in HistoryTab/PantryTab/ProfileTab css — those headers say "Meal History" / "My Pantry" / "Profile", which are screen titles, not the brand.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 5: Auth pages (login, register, forgot-password, reset-password)

**Files:**
- Modify: `app/login/page.js:76`
- Modify: `app/register/page.js:64`
- Modify: `app/forgot-password/page.js:48`
- Modify: `app/reset-password/page.js:76`
- Modify: `app/auth.module.css:21-27`

- [ ] **Step 1: In each of the four page files, add the import below the existing imports at the top**

```js
import { APP_NAME } from '@/lib/brand';
```

- [ ] **Step 2: In each of the four files, replace the logo line**

Old (identical in all four, at the line numbers listed above):
```jsx
        <div className={styles.logo}>🎰 Meal Decider</div>
```
New:
```jsx
        <div className={styles.logo}>🎰 {APP_NAME}</div>
```

- [ ] **Step 3: In `app/auth.module.css`, add the brand font to `.logo`**

Old:
```css
.logo {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}
```
New:
```css
.logo {
  font-family: var(--font-brand), system-ui, sans-serif;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 6: Auth emails

**Files:**
- Modify: `lib/email.js`

- [ ] **Step 1: Add the import after line 2 (`import { Resend } from 'resend';`)**

```js
import { APP_NAME } from '@/lib/brand';
```

- [ ] **Step 2: Replace the four branded strings**

Line 14 old: `subject: 'Verify your Meal Decider account',`
Line 14 new:
```js
    subject: `Verify your ${APP_NAME} account`,
```

Line 17 old: `<h2 style="margin-top:0">🎰 Meal Decider</h2>`
Line 17 new (inside the existing html template literal):
```js
        <h2 style="margin-top:0">🎰 ${APP_NAME}</h2>
```

Line 32 old: `subject: 'Reset your Meal Decider password',`
Line 32 new:
```js
    subject: `Reset your ${APP_NAME} password`,
```

Line 35 old: `<h2 style="margin-top:0">🎰 Meal Decider</h2>`
Line 35 new:
```js
        <h2 style="margin-top:0">🎰 ${APP_NAME}</h2>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 7: PDF export header

**Files:**
- Modify: `app/components/RecipeActions.js:141`

- [ ] **Step 1: Add the import below the existing imports at the top of the file**

```js
import { APP_NAME } from '@/lib/brand';
```

- [ ] **Step 2: Replace line 141**

Old:
```jsx
          Meal Decider — Your Recipe
```
New:
```jsx
          {APP_NAME} — Your Recipe
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 8: Recipe share page wordmark

**Files:**
- Modify: `app/r/page.js:51`

- [ ] **Step 1: Add the import below line 6 (`import { renderRecipe, stripTitle } from '@/lib/renderRecipe';`)**

```js
import { APP_NAME } from '@/lib/brand';
```

- [ ] **Step 2: Replace line 51 (the SVG wordmark; motto line 52 stays untouched)**

Old:
```jsx
          <text x="340" y="318" textAnchor="middle" fontSize="44" fill="#faf9f5" fontFamily="-apple-system, sans-serif" fontWeight="500">meal decider</text>
```
New:
```jsx
          <text x="340" y="318" textAnchor="middle" fontSize="44" fill="#faf9f5" fontFamily="var(--font-brand), -apple-system, sans-serif" fontWeight="700">{APP_NAME}</text>
```

(The share page renders inside `<body>`, so the `--font-brand` CSS variable resolves in inline SVG; the system-font fallback keeps it safe.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 9: App icon / favicon

**Files:**
- Create: `app/icon.svg`

- [ ] **Step 1: Create `app/icon.svg`** — the wheel with fork & knife hub and pointer, extracted from the share-page SVG (attributes converted from JSX camelCase to standard SVG kebab-case). Next.js App Router automatically serves `app/icon.svg` as the favicon and injects the `<link rel="icon">` tag.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="232 63 216 216">
  <g transform="translate(340,175)">
    <path d="M0,0 L0,-100 A100,100 0 0,1 86.6,-50 Z" fill="#FF6B35" opacity="0.92"/>
    <path d="M0,0 L86.6,-50 A100,100 0 0,1 86.6,50 Z" fill="#F7C948" opacity="0.92"/>
    <path d="M0,0 L86.6,50 A100,100 0 0,1 0,100 Z" fill="#4CAF82" opacity="0.92"/>
    <path d="M0,0 L0,100 A100,100 0 0,1 -86.6,50 Z" fill="#5B9BD5" opacity="0.92"/>
    <path d="M0,0 L-86.6,50 A100,100 0 0,1 -86.6,-50 Z" fill="#C65DB1" opacity="0.92"/>
    <path d="M0,0 L-86.6,-50 A100,100 0 0,1 0,-100 Z" fill="#FF8C5A" opacity="0.92"/>
    <circle cx="0" cy="0" r="100" fill="none" stroke="white" stroke-width="2.5"/>
    <circle cx="0" cy="0" r="40" fill="white" stroke="#eee" stroke-width="1"/>
    <g transform="rotate(-15)">
      <line x1="-10" y1="28" x2="-10" y2="-10" stroke="#444" stroke-width="3" stroke-linecap="round"/>
      <line x1="-16" y1="-10" x2="-16" y2="-28" stroke="#444" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="-10" y1="-10" x2="-10" y2="-28" stroke="#444" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="-4" y1="-10" x2="-4" y2="-28" stroke="#444" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M-16,-10 Q-10,-4 -4,-10" stroke="#444" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
    <g transform="rotate(15)">
      <rect x="7" y="8" width="6" height="20" rx="3" fill="#444"/>
      <rect x="6" y="4" width="8" height="5" rx="1" fill="#555"/>
      <path d="M8,4 L8,-26 Q18,-20 12,4 Z" fill="#444"/>
    </g>
    <polygon points="0,-92 -9,-108 9,-108" fill="#2D2D2D"/>
  </g>
</svg>
```

(Spec note on tiny sizes: SVG favicons scale by the browser; the fork & knife may blur at 16px — accepted, ship as-is and judge in the browser tab. No raster fallback needed yet.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds; the build output's route list includes `/icon.svg`.

### Task 10: package.json name

**Files:**
- Modify: `package.json:2`

- [ ] **Step 1: Change the name field**

Old:
```json
  "name": "meal-decider",
```
New:
```json
  "name": "pickle",
```

(Do not edit `package-lock.json` by hand — run `npm install` after the change so npm rewrites the two name fields in the lockfile itself.)

- [ ] **Step 2: Run `npm install`**

Run: `npm install`
Expected: completes; `package-lock.json` now says `"name": "pickle"`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

### Task 11: Final verification + deploy (CEO gate)

- [ ] **Step 1: Full build**

Run: `npm run build` (from `C:\Users\User\.local\bin\meal-decider`)
Expected: clean build, no warnings about missing modules or fonts.

- [ ] **Step 2: Visual smoke test on dev server**

Run: `npm run dev`, open http://localhost:3000 and verify:
1. Browser tab shows the wheel favicon and title "Pick'le — spin. cook. eat."
2. Desktop header reads "🎰 Pick'le" in the rounded Baloo 2 font.
3. Main page h1 reads "🎰 Pick'le".
4. `/login`, `/register`, `/forgot-password`, `/reset-password` logos read "🎰 Pick'le".
5. Narrow the window below 768px: mobile Decide tab header reads "🎰 **Pick**'le" with "Pick" in yellow.
6. Open a shared recipe link (`/r?d=...` from history) — SVG logo reads "Pick'le" above "spin. cook. eat.".
7. Download a recipe PDF — header reads "Pick'le — Your Recipe".

- [ ] **Step 3: Confirm with the CEO, then deploy**

Run: `vercel --prod --cwd C:\Users\User\.local\bin\meal-decider`
Expected: deploy succeeds at https://meal-decider-alpha.vercel.app showing the new name.

# Login Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk authentication and Supabase persistence to Meal Decider — guest hard gate (3 spins/day), logged-in unlimited spins with server-side history and cuisine filter.

**Architecture:** Clerk handles auth via modals (no separate sign-in page needed). All Supabase access goes through Next.js API routes using the service role key — never exposed to the browser. Guest spin sessions are tracked server-side via an httpOnly cookie so users cannot bypass the limit by clearing local storage.

**Tech Stack:** `@clerk/nextjs` v5, `@supabase/supabase-js` v2, Supabase Postgres, Next.js 15 App Router.

---

## File Map

**New files:**
- `jsconfig.json` — enables `@/` path alias for clean imports
- `middleware.js` — Clerk session middleware (project root)
- `lib/supabase.js` — Supabase admin client (server-only, never imported in client components)
- `app/components/Header.js` — top bar with Clerk auth buttons
- `app/components/Header.module.css` — header styles
- `app/api/spin-check/route.js` — guest spin gate: reads/sets session cookie, enforces daily limit
- `app/api/history/route.js` — GET/POST user recipe history from Supabase

**Modified files:**
- `package.json` — add `@clerk/nextjs`, `@supabase/supabase-js`
- `app/layout.js` — wrap in `<ClerkProvider>`, mount `<Header>`
- `app/api/suggest/route.js` — accept optional `cuisine` param, pass to Claude prompt
- `app/api/recipe/route.js` — accept `cuisine`, save history to Supabase for logged-in users
- `app/page.js` — auth state, cuisine filter (logged-in only), spin gate UI, Supabase history
- `app/page.module.css` — new styles for cuisine filter and spin gate

---

### Task 1: Install packages and configure project

**Files:**
- Modify: `package.json`
- Create: `jsconfig.json`
- Create: `.env.local` (already gitignored)

- [ ] **Step 1: Install packages**

```bash
npm install @clerk/nextjs @supabase/supabase-js
```

Expected output: packages installed, no peer-dep errors.

- [ ] **Step 2: Create jsconfig.json**

Create `jsconfig.json` at project root:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 3: Create .env.local**

Create `.env.local` at project root. Fill in real values from Clerk dashboard → API Keys, and Supabase dashboard → Project Settings → API:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME
SUPABASE_URL=https://REPLACE_ME.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJREPLACE_ME
```

`SUPABASE_SERVICE_ROLE_KEY` must NOT start with `NEXT_PUBLIC_` — it must stay server-only.

- [ ] **Step 4: Verify app still runs**

```bash
npm run dev
```

Open http://localhost:3000. App should load and behave exactly as before.

- [ ] **Step 5: Commit**

```bash
git add jsconfig.json package.json package-lock.json
git commit -m "chore: install @clerk/nextjs and @supabase/supabase-js"
```

---

### Task 2: Create Supabase database tables

**Files:** SQL run in Supabase dashboard — no code files.

- [ ] **Step 1: Create guest_sessions table**

In the Supabase dashboard, open SQL Editor and run:
```sql
create table guest_sessions (
  session_id uuid primary key,
  spin_count int not null default 0,
  spin_date date not null,
  created_at timestamptz not null default now()
);

alter table guest_sessions enable row level security;
```

- [ ] **Step 2: Create recipe_history table**

In the same SQL Editor, run:
```sql
create table recipe_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  meal_name text not null,
  recipe text not null default '',
  ingredients text not null default '',
  dietary_filters text[] not null default '{}',
  cuisine text,
  created_at timestamptz not null default now()
);

alter table recipe_history enable row level security;

create index recipe_history_user_id_idx on recipe_history(user_id);
```

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor. Confirm both `guest_sessions` and `recipe_history` appear with the correct columns.

---

### Task 3: Create Supabase admin client

**Files:**
- Create: `lib/supabase.js`

- [ ] **Step 1: Create lib/supabase.js**

Create `lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

The service role key bypasses RLS — this is intentional and safe because this file is only imported in server-side API routes, never in client components.

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.js
git commit -m "feat: add Supabase admin client (server-only)"
```

---

### Task 4: Set up Clerk middleware

**Files:**
- Create: `middleware.js` (project root, next to `package.json`)

- [ ] **Step 1: Create middleware.js**

```js
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Verify app loads**

```bash
npm run dev
```

Open http://localhost:3000. The app must load without errors. If Clerk throws about missing keys, confirm `.env.local` has valid keys.

- [ ] **Step 3: Commit**

```bash
git add middleware.js
git commit -m "feat: add Clerk middleware for session context"
```

---

### Task 5: Create Header component

**Files:**
- Create: `app/components/Header.module.css`
- Create: `app/components/Header.js`

- [ ] **Step 1: Create Header.module.css**

Create `app/components/Header.module.css`:
```css
.header {
  width: 100%;
  background: #0f0f1a;
  border-bottom: 1px solid #2a2a4a;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 1rem;
  font-weight: 800;
  color: #f7c948;
  letter-spacing: -0.3px;
}

.authRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btnSignIn {
  background: transparent;
  border: 1px solid #2a2a4a;
  color: #888;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.btnSignIn:hover { border-color: #6c6cff; color: #aaa; }

.btnSignUp {
  background: #6c6cff;
  border: none;
  color: #fff;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btnSignUp:hover { opacity: 0.88; }
```

- [ ] **Step 2: Create Header.js**

Create `app/components/Header.js`:
```jsx
'use client';
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import styles from './Header.module.css';

export default function Header() {
  const { isSignedIn } = useUser();

  return (
    <header className={styles.header}>
      <span className={styles.logo}>🎰 Meal Decider</span>
      <div className={styles.authRow}>
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <>
            <SignInButton mode="modal">
              <button className={styles.btnSignIn}>Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={styles.btnSignUp}>Sign Up</button>
            </SignUpButton>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Header.js app/components/Header.module.css
git commit -m "feat: add Header component with Clerk sign in/up/out"
```

---

### Task 6: Wrap app in ClerkProvider and mount Header

**Files:**
- Modify: `app/layout.js`

- [ ] **Step 1: Replace layout.js**

Replace the entire contents of `app/layout.js`:
```jsx
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import Header from './components/Header';

export const metadata = {
  title: 'AI Meal Decider',
  description: "Tell AI what's in your fridge, spin the wheel, get a recipe.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en">
        <body>
          <Header />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Dark header bar at the top with "🎰 Meal Decider" left, "Sign In" and "Sign Up" buttons right
- Main app still works fully below the header
- Clicking "Sign In" opens a dark-themed Clerk modal

- [ ] **Step 3: Commit**

```bash
git add app/layout.js
git commit -m "feat: wrap app in ClerkProvider with dark theme, mount Header"
```

---

### Task 7: Create spin-check API route

**Files:**
- Create: `app/api/spin-check/route.js`

- [ ] **Step 1: Create spin-check route**

Create `app/api/spin-check/route.js`:
```js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

const DAILY_LIMIT = 3;

export async function POST() {
  // Logged-in users are always allowed — skip guest logic
  const { userId } = await auth();
  if (userId) return Response.json({ allowed: true, spinsLeft: null });

  const cookieStore = await cookies();
  let sessionId = cookieStore.get('guest_session_id')?.value;
  const isNewSession = !sessionId;
  if (isNewSession) sessionId = crypto.randomUUID();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC

  const { data } = await supabase
    .from('guest_sessions')
    .select('spin_count, spin_date')
    .eq('session_id', sessionId)
    .maybeSingle();

  let newCount;

  if (!data || data.spin_date !== today) {
    // First spin today — reset to 1
    newCount = 1;
    await supabase.from('guest_sessions').upsert({
      session_id: sessionId,
      spin_count: newCount,
      spin_date: today,
    });
  } else if (data.spin_count >= DAILY_LIMIT) {
    // Already at limit — deny without incrementing
    const res = NextResponse.json({ allowed: false, spinsLeft: 0 });
    if (isNewSession) attachSessionCookie(res, sessionId);
    return res;
  } else {
    // Increment
    newCount = data.spin_count + 1;
    await supabase
      .from('guest_sessions')
      .update({ spin_count: newCount })
      .eq('session_id', sessionId);
  }

  const res = NextResponse.json({
    allowed: true,
    spinsLeft: DAILY_LIMIT - newCount,
  });
  if (isNewSession) attachSessionCookie(res, sessionId);
  return res;
}

function attachSessionCookie(response, sessionId) {
  response.cookies.set('guest_session_id', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
```

- [ ] **Step 2: Test first call (expect new session cookie)**

With `npm run dev` running:
```bash
curl -X POST http://localhost:3000/api/spin-check -v 2>&1 | grep -E "allowed|Set-Cookie|spinsLeft"
```

Expected response body: `{"allowed":true,"spinsLeft":2}`
Expected header: `Set-Cookie: guest_session_id=<uuid>; Path=/; ...`

- [ ] **Step 3: Test limit enforcement**

Copy the `guest_session_id` UUID from the previous response and run 3 more times:
```bash
curl -X POST http://localhost:3000/api/spin-check \
  -H "Cookie: guest_session_id=PASTE_UUID_HERE"
```

After the 3rd total call (2nd with cookie), response should be `{"allowed":true,"spinsLeft":0}`.
4th call: `{"allowed":false,"spinsLeft":0}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/spin-check/route.js
git commit -m "feat: add guest spin-check route with daily limit via session cookie"
```

---

### Task 8: Create history API route

**Files:**
- Create: `app/api/history/route.js`

- [ ] **Step 1: Create history route**

Create `app/api/history/route.js`:
```js
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('recipe_history')
    .select('id, meal_name, ingredients, dietary_filters, cuisine, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ history: data });
}

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { meal_name, recipe, ingredients, dietary_filters, cuisine } = await req.json();
  if (!meal_name) return Response.json({ error: 'meal_name required' }, { status: 400 });

  const { error } = await supabase.from('recipe_history').insert({
    user_id: userId,
    meal_name,
    recipe: recipe || '',
    ingredients: ingredients || '',
    dietary_filters: dietary_filters || [],
    cuisine: cuisine || null,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
```

- [ ] **Step 2: Test auth guard**

```bash
curl http://localhost:3000/api/history
```

Expected: `{"error":"Unauthorized"}` with HTTP 401. Confirms unauthenticated users cannot read history.

- [ ] **Step 3: Commit**

```bash
git add app/api/history/route.js
git commit -m "feat: add history API route with Clerk auth guard (GET/POST)"
```

---

### Task 9: Update suggest route with cuisine support

**Files:**
- Modify: `app/api/suggest/route.js`

- [ ] **Step 1: Replace suggest route**

Replace the entire contents of `app/api/suggest/route.js`:
```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { ingredients, filters, cuisine } = await req.json();
    if (!ingredients?.trim()) {
      return Response.json({ error: 'No ingredients provided' }, { status: 400 });
    }

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const cuisineText = cuisine
      ? `\nCuisine style: ${cuisine} cuisine only.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `I have these ingredients: ${ingredients}.${filterText}${cuisineText}
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

- [ ] **Step 2: Test without cuisine (backward compatibility)**

```bash
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{"ingredients":"chicken, rice"}'
```

Expected: JSON array of 6 meal names. No cuisine applied.

- [ ] **Step 3: Test with cuisine**

```bash
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{"ingredients":"chicken, rice","cuisine":"Italian"}'
```

Expected: 6 Italian-style meal names (e.g. Chicken Risotto, Arancini...).

- [ ] **Step 4: Commit**

```bash
git add app/api/suggest/route.js
git commit -m "feat: add cuisine filter support to suggest API"
```

---

### Task 10: Update recipe route with cuisine and history save

**Files:**
- Modify: `app/api/recipe/route.js`

- [ ] **Step 1: Replace recipe route**

Replace the entire contents of `app/api/recipe/route.js`:
```js
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

const client = new Anthropic();

export async function POST(req) {
  try {
    const { meal, ingredients, filters, cuisine } = await req.json();
    if (!meal) {
      return Response.json({ error: 'No meal provided' }, { status: 400 });
    }

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const cuisineText = cuisine
      ? `\nCuisine style: ${cuisine}.`
      : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Write a concise recipe for: ${meal}${filterText}${cuisineText}
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

    // Save to Supabase for logged-in users — fire-and-forget, don't block the response
    const { userId } = await auth();
    if (userId) {
      supabase.from('recipe_history').insert({
        user_id: userId,
        meal_name: meal,
        recipe,
        ingredients: ingredients || '',
        dietary_filters: filters || [],
        cuisine: cuisine || null,
      }).then(({ error }) => {
        if (error) console.error('History save failed:', error.message);
      });
    }

    return Response.json({ recipe });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify backward compatibility**

```bash
curl -X POST http://localhost:3000/api/recipe \
  -H "Content-Type: application/json" \
  -d '{"meal":"Chicken Fried Rice","ingredients":"chicken, rice, egg"}'
```

Expected: `{"recipe":"..."}` with full recipe text. Should work for guests (no history saved) and logged-in users (history saved to Supabase).

- [ ] **Step 3: Commit**

```bash
git add app/api/recipe/route.js
git commit -m "feat: add cuisine to recipe API, save history to Supabase for logged-in users"
```

---

### Task 11: Update page.js with auth, spin gate, cuisine filter, and Supabase history

**Files:**
- Modify: `app/page.js`

- [ ] **Step 1: Replace page.js**

Replace the entire contents of `app/page.js`:
```jsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useUser, SignUpButton } from '@clerk/nextjs';
import styles from './page.module.css';
import './globals.css';

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];
const DIETARY_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free'];
const CUISINE_FILTERS = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

function drawWheel(canvas, meals, angle) {
  if (!canvas || meals.length === 0) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(cx, cy) - 12;
  const n = meals.length;
  const slice = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < n; i++) {
    const start = angle + i * slice;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1a1a2e';
    ctx.font = `bold ${n > 6 ? 11 : 13}px sans-serif`;
    const t = meals[i].length > 17 ? meals[i].slice(0, 16) + '…' : meals[i];
    ctx.fillText(t, r - 10, 5);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = '#e74c3c';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(W - 4, cy - 13);
  ctx.lineTo(W - 4, cy + 13);
  ctx.lineTo(W - 34, cy);
  ctx.closePath();
  ctx.fillStyle = '#e74c3c';
  ctx.fill();
  ctx.restore();
}

function getSelectedIndex(angle, n) {
  const slice = (2 * Math.PI) / n;
  const norm = ((-angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(norm / slice) % n;
}

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

export default function MealDecider() {
  const { isSignedIn } = useUser();

  const [ingredients, setIngredients] = useState('');
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipe, setRecipe] = useState('');
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState([]);
  const [cuisine, setCuisine] = useState('');
  const [canvasSize, setCanvasSize] = useState(340);
  const [history, setHistory] = useState([]);
  const [shareLabel, setShareLabel] = useState('🔗 Share');
  const [spinGate, setSpinGate] = useState(false);

  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const animRef = useRef(null);
  const mealsRef = useRef([]);
  const isInitialHistoryMount = useRef(true);

  const toggleFilter = (f) =>
    setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const toggleCuisine = (c) =>
    setCuisine(prev => prev === c ? '' : c);

  useEffect(() => { mealsRef.current = meals; }, [meals]);

  // Reset meals when filters or cuisine change
  useEffect(() => {
    setMeals(prev => {
      if (prev.length > 0) { setSelectedMeal(null); setRecipe(''); }
      return [];
    });
  }, [filters, cuisine]);

  useEffect(() => {
    const update = () => setCanvasSize(Math.min(window.innerWidth - 48, 340));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Load history from correct source when auth state resolves
  useEffect(() => {
    if (isSignedIn === undefined) return; // Clerk still loading

    if (isSignedIn) {
      setSpinGate(false);
      fetch('/api/history')
        .then(r => r.json())
        .then(data => {
          if (data.history) {
            setHistory(data.history.map(h => ({
              meal: h.meal_name,
              date: new Date(h.created_at).toLocaleDateString(),
              ingredients: h.ingredients,
            })));
          }
        })
        .catch(() => {});

      // Migrate any existing localStorage history to Supabase silently
      try {
        const local = JSON.parse(localStorage.getItem('mealHistory') || '[]');
        if (local.length > 0) {
          Promise.all(
            local.map(h =>
              fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  meal_name: h.meal,
                  recipe: '',
                  ingredients: h.ingredients || '',
                  dietary_filters: [],
                  cuisine: null,
                }),
              })
            )
          )
            .then(() => localStorage.removeItem('mealHistory'))
            .catch(() => {});
        }
      } catch {}
    } else {
      // Guest: load from localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('mealHistory') || '[]');
        setHistory(stored);
      } catch {}
      isInitialHistoryMount.current = false;
    }
  }, [isSignedIn]);

  // Persist guest history to localStorage (skipped for logged-in users)
  useEffect(() => {
    if (isSignedIn || isInitialHistoryMount.current) return;
    localStorage.setItem('mealHistory', JSON.stringify(history));
  }, [history, isSignedIn]);

  useEffect(() => {
    if (meals.length > 0) drawWheel(canvasRef.current, meals, angleRef.current);
  }, [meals, canvasSize]);

  const suggestMeals = async () => {
    if (!ingredients.trim()) return;
    setLoadingSuggest(true);
    setMeals([]);
    setSelectedMeal(null);
    setRecipe('');
    setError('');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          filters,
          cuisine: isSignedIn ? cuisine : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get suggestions');
      setMeals(data.meals);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSuggest(false);
    }
  };

  const spin = async () => {
    if (spinning || meals.length === 0) return;

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

    setSpinning(true);
    setSelectedMeal(null);
    setRecipe('');
    velocityRef.current = Math.random() * 0.15 + 0.22;

    const animate = () => {
      angleRef.current += velocityRef.current;
      velocityRef.current *= 0.988;
      drawWheel(canvasRef.current, mealsRef.current, angleRef.current);
      if (velocityRef.current > 0.002) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const idx = getSelectedIndex(angleRef.current, mealsRef.current.length);
        setSelectedMeal(mealsRef.current[idx]);
        setSpinning(false);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const getRecipe = async () => {
    if (!selectedMeal) return;
    setLoadingRecipe(true);
    setRecipe('');
    setError('');
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal: selectedMeal,
          ingredients,
          filters,
          cuisine: isSignedIn ? cuisine : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get recipe');
      setRecipe(data.recipe);

      if (!isSignedIn) {
        // Update guest localStorage history
        setHistory(prev => {
          const entry = { meal: selectedMeal, date: new Date().toLocaleDateString(), ingredients };
          return [entry, ...prev.filter(h => h.meal !== selectedMeal)].slice(0, 10);
        });
      } else {
        // Refresh Supabase history after save (500ms to let the insert complete)
        setTimeout(() => {
          fetch('/api/history')
            .then(r => r.json())
            .then(data => {
              if (data.history) {
                setHistory(data.history.map(h => ({
                  meal: h.meal_name,
                  date: new Date(h.created_at).toLocaleDateString(),
                  ingredients: h.ingredients,
                })));
              }
            })
            .catch(() => {});
        }, 500);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingRecipe(false);
    }
  };

  const copyRecipe = () => {
    navigator.clipboard.writeText(`${selectedMeal}\n\n${recipe}`)
      .catch(() => setError('Copy failed — please copy the recipe manually.'));
  };

  const shareRecipe = async () => {
    const payload = btoa(encodeURIComponent(JSON.stringify({ meal: selectedMeal, recipe })));
    const url = `${window.location.origin}/r?d=${encodeURIComponent(payload)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('✓ Copied!');
    } catch {
      setShareLabel('⚠ Failed');
    }
    setTimeout(() => setShareLabel('🔗 Share'), 2000);
  };

  const downloadRecipe = () => {
    const blob = new Blob([`${selectedMeal}\n\n${recipe}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMeal.replace(/\s+/g, '-').toLowerCase()}-recipe.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1><span>🎰</span> AI Meal Decider</h1>
        <p>Tell AI what's in your fridge → spin the wheel → get a recipe</p>
      </div>

      {/* Step 1: Ingredients */}
      <div className={styles.card}>
        <span className={styles.label}>Step 1 — What's in your fridge?</span>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="e.g. chicken, rice, tomatoes, garlic..."
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && suggestMeals()}
          />
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={suggestMeals}
            disabled={loadingSuggest || !ingredients.trim()}
          >
            {loadingSuggest ? '...' : 'Suggest'}
          </button>
        </div>

        {/* Dietary filters — all users */}
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

        {/* Cuisine filter — logged-in users only */}
        {isSignedIn && (
          <div className={styles.cuisineSection}>
            <span className={styles.cuisineLabel}>Cuisine</span>
            <div className={styles.filterRow}>
              {CUISINE_FILTERS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.filterChip} ${styles.cuisineChip} ${cuisine === c ? styles.cuisineChipActive : ''}`}
                  onClick={() => toggleCuisine(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingSuggest && (
          <div className={styles.loading} style={{ marginTop: 12 }}>
            <span className={styles.spinner} /> AI is thinking of meals...
          </div>
        )}
      </div>

      {/* Step 2: Wheel */}
      {meals.length > 0 && (
        <div className={styles.card}>
          <span className={styles.label}>Step 2 — Spin the wheel!</span>
          <div className={styles.wheelWrap}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={canvasSize}
              height={canvasSize}
            />

            {spinGate ? (
              <div className={styles.spinGate}>
                <p className={styles.spinGateText}>
                  You've used your 3 free spins today.<br />
                  Sign up to spin unlimited.
                </p>
                <SignUpButton mode="modal">
                  <button className={`${styles.btn} ${styles.btnSignUpGate}`}>
                    Sign Up — It's Free
                  </button>
                </SignUpButton>
              </div>
            ) : (
              <button
                className={`${styles.btn} ${styles.btnSpin}`}
                onClick={spin}
                disabled={spinning}
              >
                {spinning ? 'Spinning...' : '🎲 SPIN'}
              </button>
            )}

            {selectedMeal && !spinning && !spinGate && (
              <p className={styles.spinHint}>Not feeling it? Spin again!</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Selected meal */}
      {selectedMeal && (
        <div className={styles.card}>
          <span className={styles.label}>Step 3 — The wheel chose...</span>
          <div className={styles.selectedBadge}>
            <div className={styles.subtext}>Tonight you're making</div>
            <div className={styles.mealName}>{selectedMeal}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className={`${styles.btn} ${styles.btnRecipe}`}
              onClick={getRecipe}
              disabled={loadingRecipe}
              style={{ width: '100%' }}
            >
              {loadingRecipe ? '...' : '📋 Get Recipe'}
            </button>
          </div>
          {loadingRecipe && (
            <div className={styles.loading} style={{ marginTop: 12 }}>
              <span className={styles.spinner} /> Generating your recipe...
            </div>
          )}
        </div>
      )}

      {/* Step 4: Recipe */}
      {recipe && (
        <div className={styles.card}>
          <div className={styles.recipeHeader}>
            <span className={styles.label}>Your Recipe</span>
            <button className={`${styles.btn} ${styles.btnShare}`} onClick={shareRecipe}>
              {shareLabel}
            </button>
          </div>
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

      {error && (
        <div style={{ color: '#ff6b6b', fontSize: '0.9rem', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {history.length > 0 && (
        <div className={styles.card}>
          <span className={styles.label}>Recent Meals</span>
          {history.map((h) => (
            <div key={h.meal} className={styles.historyItem}>
              <span className={styles.historyMeal}>{h.meal}</span>
              <span className={styles.historyMeta}>{h.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify as guest**

Open http://localhost:3000. Confirm:
- No cuisine filter visible
- Enter ingredients → Suggest → spin 3 times: all succeed
- 4th spin: spin gate box appears with "Sign Up — It's Free" button
- Share, Copy, Download still work after getting a recipe

- [ ] **Step 3: Verify as logged-in user**

Sign up via the header. Confirm:
- Cuisine filter chips appear below dietary filters (Asian, Italian, Turkish, Mexican, Mediterranean)
- Selecting Italian → Suggest → meals are Italian-style
- Get Recipe → recipe appears → history panel at bottom updates
- Reload page → history still there (from Supabase)
- No spin gate at any point

- [ ] **Step 4: Commit**

```bash
git add app/page.js
git commit -m "feat: add auth state, spin gate, cuisine filter, and Supabase history to main page"
```

---

### Task 12: Add CSS for new UI elements

**Files:**
- Modify: `app/page.module.css`

- [ ] **Step 1: Append new styles to end of page.module.css**

Add to the bottom of `app/page.module.css`:
```css
/* Cuisine filter section */
.cuisineSection {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #1e1e3a;
}

.cuisineLabel {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #8888bb;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.cuisineChip {
  appearance: none;
  font-family: inherit;
}

.cuisineChipActive {
  background: #f7c94822;
  border-color: #f7c948;
  color: #f7c948;
  font-weight: 600;
}

/* Spin gate */
.spinGate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 20px 16px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  text-align: center;
  width: 100%;
}

.spinGateText {
  color: #aaa;
  font-size: 0.9rem;
  line-height: 1.7;
  margin: 0;
}

.btnSignUpGate {
  background: linear-gradient(135deg, #6c6cff, #a855f7);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 10px 24px;
  border-radius: 50px;
  letter-spacing: 0.3px;
}
.btnSignUpGate:hover:not(:disabled) { opacity: 0.88; }
```

- [ ] **Step 2: Verify visual appearance**

Open http://localhost:3000 as a guest, enter ingredients, suggest, spin 3 times. On 4th attempt the spin gate box should look polished — clean card with gradient button.

Sign in, confirm cuisine chips appear with gold highlight when selected.

- [ ] **Step 3: Commit**

```bash
git add app/page.module.css
git commit -m "feat: add CSS for cuisine filter and spin gate"
```

---

## Done

All tasks complete. The app now has:
- Header with Sign In / Sign Up / Profile buttons matching the dark theme
- Guest hard gate: 3 spins/day tracked server-side via httpOnly cookie — cannot be bypassed
- Logged-in: unlimited spins, server-side recipe history, cuisine filter (Asian/Italian/Turkish/Mexican/Mediterranean)
- All API credentials server-only, RLS enabled on both Supabase tables
- LocalStorage history migrated to Supabase silently on first sign-in

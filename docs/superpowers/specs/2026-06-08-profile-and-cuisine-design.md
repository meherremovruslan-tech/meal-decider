# Profile Section & Cuisine Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a profile page (avatar, info, history, settings) and fix cuisine to allow unlimited multi-select.

**Architecture:** Kitchen gadget emoji assigned at registration, stored in Supabase. Header avatar opens a dropdown. `/profile` page is one scrollable page with three sections. Cuisine state changes from string to array throughout the stack.

**Tech Stack:** Next.js 15 App Router, NextAuth v4, Supabase (PostgreSQL), CSS Modules, existing dark theme.

---

## Feature 1 — Kitchen Gadget Avatar

### Avatar pool
Ten emojis randomly assigned at registration:
```
🍳 🥄 🔪 🫕 🍴 🥢 🧂 📟 🥣 🫙
```

### DB changes (user runs in Supabase SQL Editor)
```sql
ALTER TABLE public.users ADD COLUMN avatar_emoji TEXT;
ALTER TABLE public.users ADD COLUMN display_name TEXT;
```

### Assignment logic
- **Email registration** (`/api/auth/register`): pick a random emoji from the pool, include in the `INSERT` into `users`.
- **Google sign-in** (`lib/auth.js` signIn callback): pick a random emoji, include in the `INSERT` into `users` for new Google users. Existing Google users without an emoji get one assigned on their next sign-in (fallback).

### Session
The `avatar_emoji` and `display_name` are fetched from Supabase in the NextAuth `session` callback and added to `session.user` so components can read them without extra API calls.

---

## Feature 2 — Header Dropdown

### Header changes (`app/components/Header.js`)
- Replace the email text + sign out button with a circular avatar showing the emoji.
- Clicking the avatar toggles a dropdown menu.
- Dropdown items: **Profile** (`/profile`) · **Sign Out**.
- Dropdown closes on outside click.

### CSS (`app/components/Header.module.css`)
- `.avatar` — 36px circle, dark background, border, emoji centered.
- `.dropdown` — absolute positioned card, dark bg, border, rounded, z-index above content.
- `.dropdownItem` — hover highlight, cursor pointer.
- `.dropdownDivider` — thin border separator before Sign Out.

---

## Feature 3 — Profile Page (`/profile`)

### Route: `app/profile/page.js`
Server component that fetches user data and history, renders three section cards.

### API route: `GET /api/profile`
Returns `{ avatar_emoji, display_name, email, created_at, provider }` for the logged-in user.

### API route: `PATCH /api/profile`
Accepts `{ display_name }` and updates `users` table. Returns `{ success: true }`.

### API route: `PATCH /api/profile/change-password`
Email-account users only. Accepts `{ current_password, new_password }`. Verifies current password with bcrypt, hashes and saves new password. Returns `{ success: true }` or error.

### Page sections

**Info card**
- Large avatar emoji (48px circle)
- Display name (shown as text, with an edit pencil icon)
- Email (read-only)
- Account type: "Google account" or "Email account"
- Joined date formatted as "Member since Jun 2026"

**Settings card**
- Display name input + Save button (all users)
- Change password form — Current password, New password, Confirm new password inputs + Save button (email accounts only, hidden for Google users)
- Inline success/error messages per section

**History card**
- Heading "Meal History" with count badge
- List of meals: meal name on left, date on right
- Clicking a meal toggles an inline accordion showing the stored recipe text
- Rendered with the same `renderRecipe()` formatter used on the main page
- Empty state: "No meals yet — go spin the wheel!"

### Shared utility: `lib/renderRecipe.js`
Extract the `renderRecipe()` function from `app/page.js` into a shared module so both the main page and the profile history accordion can use it.

### CSS: `app/profile/profile.module.css`
Follows existing dark card pattern from `app/auth.module.css` and `app/page.module.css`.

---

## Feature 4 — Cuisine Multi-Select

### `app/page.js`
- `cuisine` state: `string` → `string[]` (default `[]`)
- `toggleCuisine(c)`: toggle item in array (add if absent, remove if present)
- Reset effect: depends on `filters` and `cuisine` array (use `JSON.stringify(cuisine)` in dependency array)
- Pass `cuisine` array to `/api/suggest` and `/api/recipe`

### `app/api/suggest/route.js`
- Accept `cuisine` as `string[]`
- Validate each against `ALLOWED_CUISINES`
- Build prompt text: `"Cuisine style: Asian, Turkish cuisine only."` (join with `, `)
- If array is empty, no cuisine text added

### `app/api/recipe/route.js`
- Same change as suggest — accept and handle `cuisine` as array

### `app/api/history/route.js` (POST)
- `cuisine` field: serialize array to comma-separated string before storing (no DB schema change)
- `cuisine` field (GET): return as-is (string), no parsing needed on client

### Chip UI
- All 5 cuisine chips are toggleable (no max limit)
- Active chips: filled purple background (`#667eea`), white text
- Inactive chips: dark background, muted text
- Multiple chips can be active simultaneously

---

## Out of scope
- Avatar customisation (changing your assigned emoji) — not in this version
- Deleting history entries — not in this version
- Pagination of history — shows last 50 (already the API limit)

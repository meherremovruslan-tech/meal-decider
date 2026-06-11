# Pantry Feature — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let signed-in users save up to 3 named ingredient lists ("Pantry lists") and pull from them with one tap when deciding what to make, instead of retyping ingredients every time. For guests, use it as a sign-up hook.

**Architecture:** New `pantry_lists` table in Supabase, one row per list (`user_id`, `name`, `ingredients[]`). A new `/api/pantry` route family provides CRUD, with every UI action auto-saving via PATCH/POST/DELETE — no separate save step. Management UI lives in the existing Profile page; a "Load from Pantry" button + modal on the main page lets users pull saved ingredients into Step 1.

**Tech Stack:** Next.js 15 App Router, NextAuth v4 (`getServerSession`), Supabase (PostgreSQL), CSS Modules, existing dark theme tokens (`#0f0f1a` bg / `#16162a` cards / `#2a2a4a` borders / `#6c6cff` accent — matches `app/page.module.css` and `app/profile/profile.module.css`).

---

## Data Model

### New table: `pantry_lists` (user runs in Supabase SQL Editor)
```sql
create table public.pantry_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  ingredients text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index pantry_lists_user_id_idx on public.pantry_lists(user_id);
```
- Max 3 lists per user is enforced at the API layer (count check before insert), not a DB constraint.
- `ingredients` is a Postgres text array — supabase-js reads/writes it as a plain JS array.
- Lists are returned ordered by `created_at asc` (creation order = tab order).

---

## API Routes (`app/api/pantry/`)

All routes require `getServerSession` and operate only on rows where `user_id = session.user.id`.

### `GET /api/pantry`
Returns `{ lists: [{ id, name, ingredients, created_at }] }` for the current user.

### `POST /api/pantry`
Body: `{ name }`. Validates `name` is a non-empty trimmed string ≤ 30 chars. If the user already has 3 lists, returns `409 { error: 'Maximum 3 lists reached' }`. Otherwise inserts `{ user_id, name, ingredients: [] }` and returns the new list.

### `PATCH /api/pantry/[id]`
Body: `{ name? , ingredients? }` (at least one). Used for rename (`{ name }`) and ingredient add/remove (`{ ingredients }`, full replacement array). Validates:
- `name`: non-empty trimmed, ≤ 30 chars
- each item in `ingredients`: non-empty trimmed, ≤ 40 chars; array deduped case-insensitively

Returns the updated list. 404 if the list doesn't belong to the user.

### `DELETE /api/pantry/[id]`
Deletes the list if owned by the user. Returns `{ success: true }`. 404 if not found/not owned.

---

## Profile Page — "Pantry lists" Section

New card in `app/profile/page.js`, placed after the Settings card.

**Header:** 🔖 "Pantry lists" + a "New list" button (top right).

**Each list as a card:**
- Name + ingredient count badge (reuse `.countBadge` style)
- ✏️ Rename — toggles the name into an inline text input; saves via `PATCH /api/pantry/[id]` on blur/Enter
- 🗑️ Delete — `confirm("Delete \"<name>\" and its N ingredients?")`, then `DELETE /api/pantry/[id]`
- Ingredients as removable chip tags (style like `.filterChip`), each with `×` → `PATCH` with the ingredient filtered out
- "+ Add ingredient" — reveals a small inline input + Add button; on submit, trims/validates and `PATCH`es the appended array, then clears the input (stays open for rapid entry)

**"New list" button:**
- If < 3 lists: reveals inline form (name input + Create) → `POST /api/pantry`, new card appears empty
- If 3 lists: replaced with static text "Maximum 3 lists reached"

**States:**
- Loading: skeleton/"Loading…" text while `GET /api/pantry` resolves
- Empty (0 lists): card shows "No pantry lists yet" plus the New list control
- Errors from any pantry API call show inline using the existing `.msgError` style

---

## Main Page — "Load from Pantry"

### Button (`app/page.js`, in `.inputRow` next to Suggest)
- Signed-in: 🔖 "Load from Pantry" — opens the picker modal (lazy-fetches `GET /api/pantry` on first open)
- Guest (`!isSignedIn`): 🔖🔒 "Load from Pantry" — opens the guest nudge instead (no API call)

### Picker modal (signed-in)
Dark overlay (click to dismiss); modal closes via `×`, "Cancel", or overlay click.

- **Header:** 🔖 "Load from Pantry" + `×`
- **Tabs:** one per pantry list, labeled with the list's name; first list active by default
- **Chips:** ingredients of the active list, toggleable. Selection state is a single `Set<string>` shared across all tabs, so switching tabs preserves prior picks. Selected chips show a check + accent border/background.
- **Extra ingredients row:** always-visible text input + `+` button. Each submission trims the text and adds it as its own removable chip in an "Extra" row, also added to the selection set.
- **Footer:** "Cancel" (discard everything, close) and **"Confirm — load N ingredients"** where N = size of the selection set. Disabled when N = 0.

**On Confirm:**
- Take the current Step 1 input, split on commas, trim, lowercase-compare for dedup
- Append any selected ingredients not already present, comma-joined, to the existing input (does not replace)
- Close modal and clear selection state

**Empty state (0 pantry lists):** modal shows "No pantry lists yet. Add them from your Profile." with a link to `/profile`. Only `×`/overlay to dismiss (no tabs/footer).

### Guest nudge (`!isSignedIn`)
Same overlay/modal chrome, simplified content:
- "Save your ingredients to Pantry" + one line of copy ("Create up to 3 pantry lists and load them into Step 1 with one tap — sign up free to start.")
- Single button: "Sign Up — It's Free" → `/register`
- `×` / overlay-click to dismiss (no "Maybe later" button)

---

## Validation & Edge Cases
- Ownership checked on every `PATCH`/`DELETE` via `user_id = session.user.id` in the query, not just by id
- Ingredient/list-name length caps (40 / 30 chars) prevent layout breakage from pasted text
- Case-insensitive de-duplication: within a pantry list (when adding), and when appending picker selections to Step 1's input
- 3-list limit enforced server-side (`POST /api/pantry` returns 409) in addition to hiding the UI control

## Out of Scope
- Reordering pantry lists or ingredients within a list
- Bulk paste / comma-separated import into a pantry list (one-at-a-time add only)
- Sharing pantry lists between users
- Editing an "extra ingredient" chip after adding (remove and re-add instead)

# Login Feature — Design Spec
**Date:** 2026-06-08  
**Status:** Approved

---

## What We're Building

Two modes for the Meal Decider app:

- **Guest mode** — limited access, drives sign-ups
- **Logged-in mode** — full access, personalized experience

---

## Guest Mode

Guests can use the app freely with one constraint: **3 spins per day**, resetting at midnight.

- Spins 1–3: full experience, no interruption
- On spin 4 attempt: spin button is disabled, a clear message appears — *"You've used your 3 free spins today. Sign up to spin unlimited."* with a Sign Up button
- Counter resets every midnight (daily limit, not rolling 24h)
- The limit cannot be bypassed by clearing the browser — it is tracked server-side
- Guests retain: spin, get recipe, share recipe, download recipe

---

## Logged-In Mode

Users who sign up or log in get:

1. **Unlimited spins** — no daily cap
2. **Persistent history** — recipe history saved to their account, accessible from any device (replaces the current browser-only history)
3. **Cuisine filter** — an additional filter before spinning: Asian, Italian, Turkish, Mexican, Mediterranean. Combined with existing dietary filters (vegan, gluten-free, etc.)

---

## Sign In / Sign Up Experience

- A small header bar sits at the top of the app
- Shows a **Sign In** button for guests
- After signing in: shows the user's profile icon with a dropdown to sign out
- Sign up supports email/password and Google (social login)

---

## Security Guarantees

- All AI API keys and database credentials are server-only — never visible in the browser
- Every logged-in action is verified on the server — the client cannot fake a logged-in state
- Guest spin counts are tracked server-side — cannot be gamed by the user
- User data is private and isolated — no user can access another user's history

---

## What Is NOT in This Step

The following features are planned for future steps and are explicitly out of scope here:

- Meal ratings and user notes
- Saved ingredient presets
- Trending meals / social features
- PWA manifest / Google Play publishing

---

## Tech Stack Additions

*(For CTO reference — not for CEO review)*

- **Auth:** Clerk (`@clerk/nextjs`) — handles sign up, sign in, session management
- **Database:** Supabase (Postgres) — stores guest spin sessions and logged-in user history
- **Guest spin tracking:** Anonymous session cookie (UUID) set on first visit, spin count stored in Supabase, resets daily
- **All DB access:** Server-side only via Next.js API routes — Supabase service key never sent to browser
- **History migration:** On first login, existing localStorage history is migrated to Supabase silently

---

## Database Schema

### `guest_sessions`
| Column | Type | Notes |
|--------|------|-------|
| session_id | uuid (PK) | Set as httpOnly cookie |
| spin_count | int | Resets daily |
| spin_date | date | Date of last spin (for daily reset) |
| created_at | timestamp | |

### `recipe_history`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | text | Clerk user ID |
| meal_name | text | |
| recipe | text | Full recipe text |
| ingredients | text | Input ingredients |
| dietary_filters | text[] | e.g. ["vegan", "gluten-free"] |
| cuisine | text | e.g. "Italian" (null if not set) |
| created_at | timestamp | |

---

## User Flow

```
Guest arrives
  → Session cookie assigned (invisible to user)
  → Spins 1-3: normal experience
  → Spin 4 attempt: gate shown → Sign Up CTA

User signs up / logs in
  → Header updates to show profile icon
  → Cuisine filter appears below dietary filters
  → History loads from account (all devices)
  → Unlimited spins
```

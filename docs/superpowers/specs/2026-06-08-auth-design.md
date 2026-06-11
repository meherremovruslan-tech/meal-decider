# Auth System Design — Meal Decider
Date: 2026-06-08

## Overview

Replace Clerk with a custom email/password auth system built on NextAuth.js v5, Supabase, bcrypt, and Resend. Users can also use the app as a guest (3 spins/day). Email verification is required before login.

---

## Tech Stack

| Concern | Library |
|---|---|
| Session management | NextAuth.js v5 (JWT sessions) |
| Password hashing | bcrypt |
| Transactional email | Resend |
| User storage | Supabase (`users` table) |
| Token storage | Supabase (`verification_tokens`, `password_reset_tokens`) |

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key, default gen_random_uuid() |
| email | text | unique, not null |
| password_hash | text | not null |
| email_verified | boolean | default false |
| created_at | timestamptz | default now() |

### `verification_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| user_id | uuid | FK → users.id, on delete cascade |
| token | text | unique, random 64-char hex |
| expires_at | timestamptz | now() + 24 hours |

### `password_reset_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| user_id | uuid | FK → users.id, on delete cascade |
| token | text | unique, random 64-char hex |
| expires_at | timestamptz | now() + 1 hour |
| used | boolean | default false |

---

## Pages

### `/login`
- Fields: Email, Password
- "Forgot password?" link next to Password label → `/forgot-password`
- "Don't have an account? Register" link → `/register`
- Subtle "→ Continue as guest (3 spins/day)" text link below a divider
- On submit: validates fields → calls NextAuth `signIn('credentials')` → on success redirects to `/`
- Error states: invalid credentials (single message: "Invalid email or password"), unverified email ("Please verify your email before signing in. Resend verification email?")

### `/register`
- Fields: Email, Password, Confirm Password
- Password hint shown inline: "min 8 characters, 1 uppercase, 1 number"
- "Already have an account? Sign in" link → `/login`
- On submit: validates → creates user in Supabase with hashed password → sends verification email via Resend → redirects to `/verify-email?email=...`

### `/verify-email`
- Shows email address the link was sent to
- "Resend email" button (rate-limited: once per 60 seconds)
- When user clicks link from email → `/api/auth/verify?token=...` → marks `email_verified = true` → redirects to `/login?verified=true`
- `/login` shows a success banner: "Email verified! You can now sign in."

### `/forgot-password`
- Field: Email
- "← Back to login" link
- On submit: always shows success message regardless of whether email exists (prevents user enumeration)
- Behind the scenes: if email exists and is verified, create `password_reset_tokens` record and send reset email via Resend

### `/reset-password?token=...`
- Fields: New Password, Confirm New Password
- On load: validates token exists, not expired, not used — if invalid shows "This link has expired. Request a new one → /forgot-password"
- On submit: validates password rules → hashes new password → updates `users.password_hash` → marks token `used = true` → deletes all other reset tokens for that user → redirects to `/login?reset=true`
- `/login` shows success banner: "Password reset! Sign in with your new password."

---

## Validation Rules

### Email
- Required
- Valid email format (regex)
- On register: not already in use (checked server-side)

### Password (register + reset)
- Required
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- Confirm password must match

### Password (login)
- Required only (no strength rules — user may have old password)

---

## Email Templates (Resend)

### Verification email
- Subject: "Verify your Meal Decider account"
- Body: brief message + prominent "Verify Email" button → `/api/auth/verify?token=...`
- Token expires in 24 hours

### Password reset email
- Subject: "Reset your Meal Decider password"
- Body: brief message + prominent "Reset Password" button → `/reset-password?token=...`
- Token expires in 1 hour
- Note: if user didn't request this, they can ignore it

---

## Security Decisions

- Passwords hashed with bcrypt (salt rounds: 12)
- Tokens are 64-char cryptographically random hex strings
- Forgot password never reveals whether an email is registered
- Reset tokens are single-use (marked `used = true` on consumption)
- All other reset tokens for a user are deleted when one is used
- Expired tokens are rejected server-side regardless of `used` flag
- Sessions use JWT (no database session storage required)
- All auth API routes validate input server-side — client validation is UX only

---

## Clerk Removal

The following must be removed/replaced:
- `middleware.js` — replace `clerkMiddleware()` with NextAuth session middleware
- `app/layout.js` — remove `ClerkProvider`, add `SessionProvider` (NextAuth)
- `app/components/Header.js` — replace Clerk hooks/components with NextAuth `useSession`
- `app/page.js` — replace `useUser` / `SignUpButton` with NextAuth equivalents
- `app/api/history/route.js` — replace Clerk `auth()` with NextAuth v5 `auth()` from `@/lib/auth`
- `app/api/recipe/route.js` — same
- `app/api/spin-check/route.js` — same
- Remove `@clerk/nextjs`, `@clerk/themes` from `package.json`
- Remove `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from Vercel env vars
- Update `recipe_history.user_id` references: values will now be UUIDs from `users.id` (no existing production data to migrate — Clerk auth was non-functional on production)

---

## Environment Variables Required

| Variable | Where set | Purpose |
|---|---|---|
| `NEXTAUTH_SECRET` | Vercel + `.env.local` | Signs JWT tokens — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Vercel + `.env.local` | Base URL of app (e.g. `https://meal-decider-alpha.vercel.app`) |
| `RESEND_API_KEY` | Vercel + `.env.local` | Resend API key from resend.com dashboard |
| `RESEND_FROM_EMAIL` | Vercel + `.env.local` | Sender address (e.g. `noreply@meal-decider-alpha.vercel.app` or verified domain) |

---

## User Flows

### New user
Register → verify email (24h link) → login → app (full access, history saved)

### Returning user
Visit site → `/login` → sign in → app

### Guest
Visit site → `/login` → "Continue as guest" → app (3 spins/day, no history)

### Forgot password
Login page → "Forgot password?" → enter email → check inbox → click link (1h) → set new password → login

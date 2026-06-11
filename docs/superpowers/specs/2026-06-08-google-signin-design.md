# Google Sign In — Design Spec

**Date:** 2026-06-08
**Status:** Approved

---

## Goal

Add "Continue with Google" as a second sign-in option alongside the existing email/password flow. Users who sign in with Google are stored in the same `users` table. Account linking is done by email — if the Google email matches an existing account, the user is logged into that account.

---

## Architecture

**Provider:** NextAuth v4 `GoogleProvider` added alongside the existing `CredentialsProvider` in `lib/auth.js`.

**User storage:** Same `users` table in Supabase. Google users have `password_hash = null` and `email_verified = true` (Google verifies emails). One SQL migration: make `password_hash` nullable.

**Account linking:** In the NextAuth `signIn` callback, when a Google sign-in arrives, we upsert the user by email:
- If email exists → return the existing user's id into the JWT
- If email doesn't exist → insert new row with `email_verified = true`, no password

**Session:** Same JWT strategy as email/password. `session.user.id` is the Supabase user UUID in both cases.

---

## SQL Migration

```sql
alter table public.users
  alter column password_hash drop not null;
```

Run in Supabase SQL Editor.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/auth.js` | Add `GoogleProvider`, add `signIn` callback for upsert logic |
| `app/login/page.js` | Add Google button below divider, above guest link |
| `app/register/page.js` | Add Google button below divider |
| `app/auth.module.css` | Add `.btnGoogle` style |
| `.env.local` | Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ✓ (done) |
| Vercel env vars | Add same two vars to Production |

---

## UI Layout

**Login page (bottom of card):**
```
  [ Sign In button ]
  Don't have an account? Register
  ──────────── or ────────────
  [ G  Continue with Google ]
  → Continue as guest (3 spins/day)
```

**Register page (bottom of card):**
```
  [ Create Account button ]
  Already have an account? Sign in
  ──────────── or ────────────
  [ G  Continue with Google ]
```

**Google button style:** White background, Google logo SVG, dark text — standard Google branding.

---

## Error Handling

- If Google OAuth fails or is cancelled → NextAuth redirects to `/login?error=OAuthSignin`, login page shows a generic error banner.
- No email verification step for Google users (Google already verified the email).

---

## Environment Variables

| Name | Where |
|------|-------|
| `GOOGLE_CLIENT_ID` | `.env.local` + Vercel Production |
| `GOOGLE_CLIENT_SECRET` | `.env.local` + Vercel Production |

Redirect URIs registered in Google Cloud Console:
- `http://localhost:3000/api/auth/callback/google`
- `https://meal-decider-alpha.vercel.app/api/auth/callback/google`

---

## Out of Scope

- Showing which provider was used to sign in
- Unlinking Google from an account
- Other OAuth providers (GitHub, etc.)

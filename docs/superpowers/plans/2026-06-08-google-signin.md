# Google Sign In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" to the login and register pages using NextAuth v4 GoogleProvider, storing Google users in the existing Supabase `users` table with account linking by email.

**Architecture:** GoogleProvider is added to `lib/auth.js` alongside the existing CredentialsProvider. The `signIn` callback handles the Supabase upsert — finding or creating the user by email and setting `user.id` so the JWT callback can store it. No new tables needed; `password_hash` is made nullable for Google users.

**Tech Stack:** `next-auth@4` (GoogleProvider built-in), Supabase, Next.js 15 App Router

---

## File Map

**Modify:**
- `lib/auth.js` — add GoogleProvider + signIn callback for upsert
- `app/auth.module.css` — add `.btnGoogle` style
- `app/login/page.js` — add Google button + handle OAuthSignin error
- `app/register/page.js` — add Google button

**No new files needed.**

---

## Task 1: SQL migration — make password_hash nullable

- [ ] **Step 1: Run migration in Supabase SQL Editor**

Go to Supabase dashboard → SQL Editor → New query. Run:

```sql
alter table public.users
  alter column password_hash drop not null;
```

- [ ] **Step 2: Verify**

In Supabase → Table Editor → `users` table → click the `password_hash` column. Confirm it no longer shows "NOT NULL".

---

## Task 2: Add GoogleProvider and signIn callback to lib/auth.js

**Files:**
- Modify: `lib/auth.js`

- [ ] **Step 1: Replace `lib/auth.js` entirely**

```js
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data: user } = await supabase
          .from('users')
          .select('id, email, password_hash, email_verified')
          .eq('email', credentials.email.toLowerCase().trim())
          .single();

        if (!user) return null;

        if (!user.email_verified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (existing) {
          user.id = existing.id;
          return true;
        }

        const { data: newUser, error } = await supabase
          .from('users')
          .insert({ email, email_verified: true })
          .select('id')
          .single();

        if (error || !newUser) return false;
        user.id = newUser.id;
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
cd C:\Users\User\.local\bin\meal-decider
npm run dev
```

Expected: Server starts on localhost:3000. No import errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.js
git commit -m "feat: add GoogleProvider with Supabase upsert signIn callback"
```

---

## Task 3: Add Google button style to auth.module.css

**Files:**
- Modify: `app/auth.module.css`

- [ ] **Step 1: Append `.btnGoogle` to the end of `app/auth.module.css`**

```css
.btnGoogle {
  width: 100%;
  padding: 11px;
  background: #fff;
  color: #3c4043;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: background 0.15s, box-shadow 0.15s;
  margin-top: 0;
}

.btnGoogle:hover {
  background: #f8f9fa;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth.module.css
git commit -m "feat: add Google button style to auth module CSS"
```

---

## Task 4: Update login page — add Google button and OAuthSignin error

**Files:**
- Modify: `app/login/page.js`

- [ ] **Step 1: Add OAuthSignin error handling to the useEffect**

Find this block in `LoginForm`:
```js
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setBanner('success:Email verified! You can now sign in.');
    } else if (searchParams.get('reset') === 'true') {
      setBanner('success:Password reset! Sign in with your new password.');
    } else if (searchParams.get('error') === 'token_expired') {
      setBanner('error:Verification link has expired. Please register again or request a new link.');
    } else if (searchParams.get('error') === 'invalid_token') {
      setBanner('error:Invalid verification link.');
    }
  }, [searchParams]);
```

Replace with:
```js
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setBanner('success:Email verified! You can now sign in.');
    } else if (searchParams.get('reset') === 'true') {
      setBanner('success:Password reset! Sign in with your new password.');
    } else if (searchParams.get('error') === 'token_expired') {
      setBanner('error:Verification link has expired. Please register again or request a new link.');
    } else if (searchParams.get('error') === 'invalid_token') {
      setBanner('error:Invalid verification link.');
    } else if (searchParams.get('error') === 'OAuthSignin' || searchParams.get('error') === 'OAuthCallback') {
      setBanner('error:Google sign in failed. Please try again.');
    }
  }, [searchParams]);
```

- [ ] **Step 2: Add Google button between the links div and the divider**

Find this block:
```js
        <div className={styles.links}>
          Don't have an account? <Link href="/register">Register</Link>
        </div>

        <hr className={styles.divider} />

        <button className={styles.guestLink} onClick={handleGuest}>
          → Continue as guest <span style={{ fontSize: '11px', color: '#444' }}>(3 spins/day)</span>
        </button>
```

Replace with:
```js
        <div className={styles.links}>
          Don't have an account? <Link href="/register">Register</Link>
        </div>

        <hr className={styles.divider} />

        <button
          className={styles.btnGoogle}
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Continue with Google
        </button>

        <button className={styles.guestLink} onClick={handleGuest}>
          → Continue as guest <span style={{ fontSize: '11px', color: '#444' }}>(3 spins/day)</span>
        </button>
```

- [ ] **Step 3: Verify login page renders correctly**

With `npm run dev` running, open http://localhost:3000/login. Confirm:
- Google button appears between the "Register" link and the guest link
- Button is white with the Google logo and "Continue with Google" text

- [ ] **Step 4: Commit**

```bash
git add app/login/page.js
git commit -m "feat: add Google sign in button to login page"
```

---

## Task 5: Update register page — add Google button

**Files:**
- Modify: `app/register/page.js`

- [ ] **Step 1: Add signIn import**

Find the top of the file:
```js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
```

Replace with:
```js
'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
```

- [ ] **Step 2: Add Google button below the links div**

Find:
```js
        <div className={styles.links}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
```

Replace with:
```js
        <div className={styles.links}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>

        <hr className={styles.divider} />

        <button
          className={styles.btnGoogle}
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify register page renders correctly**

Open http://localhost:3000/register. Confirm Google button appears below the "Sign in" link with a divider above it.

- [ ] **Step 4: Commit**

```bash
git add app/register/page.js
git commit -m "feat: add Google sign in button to register page"
```

---

## Task 6: Add Vercel env vars and deploy

- [ ] **Step 1: Add GOOGLE_CLIENT_ID to Vercel Production (interactive — paste value when prompted)**

```bash
cd C:\Users\User\.local\bin\meal-decider
vercel env add GOOGLE_CLIENT_ID production
```

- [ ] **Step 2: Add GOOGLE_CLIENT_SECRET to Vercel Production (interactive — paste value when prompted)**

```bash
vercel env add GOOGLE_CLIENT_SECRET production
```

- [ ] **Step 3: Verify env vars are set**

```bash
vercel env ls
```

Expected: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` appear in the Production column.

- [ ] **Step 4: Deploy to production**

```bash
vercel --prod
```

Expected: Build succeeds, deployed to https://meal-decider-alpha.vercel.app.

- [ ] **Step 5: Smoke test**

1. Visit https://meal-decider-alpha.vercel.app/login — Google button visible
2. Click "Continue with Google" — Google OAuth screen appears
3. Sign in with a Google account — redirected to main app
4. Header shows the Google account's email + Sign Out button
5. Visit /login again and click Google with the same account — logs in without creating a duplicate

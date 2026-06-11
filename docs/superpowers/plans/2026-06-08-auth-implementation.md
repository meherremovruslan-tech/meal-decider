# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk with a custom email/password auth system using NextAuth.js v4, bcryptjs, and Resend — covering registration, login, email verification, and forgot/reset password flows.

**Architecture:** NextAuth v4 Credentials provider handles session management via JWT. Users are stored in Supabase. Email verification and password reset tokens are stored in Supabase with expiry. Resend delivers transactional emails. Middleware redirects unauthenticated, non-guest visitors to `/login`.

**Tech Stack:** `next-auth@4`, `bcryptjs`, `resend`, Supabase (existing), Next.js 15 App Router

---

## File Map

**Create:**
- `lib/auth.js` — NextAuth config (authOptions + authorize logic)
- `lib/tokens.js` — Cryptographic token generation
- `lib/email.js` — Resend email sending (verification + reset)
- `app/api/auth/[...nextauth]/route.js` — NextAuth catch-all route handler
- `app/api/auth/register/route.js` — POST: create user + send verification email
- `app/api/auth/verify/route.js` — GET: verify email token → activate account
- `app/api/auth/resend-verification/route.js` — POST: resend verification email
- `app/api/auth/forgot-password/route.js` — POST: send password reset email
- `app/api/auth/reset-password/route.js` — POST: apply new password via token
- `app/components/Providers.js` — Client wrapper for SessionProvider
- `app/auth.module.css` — Shared styles for all auth pages
- `app/login/page.js` — Login page
- `app/register/page.js` — Register page
- `app/verify-email/page.js` — "Check your email" page
- `app/forgot-password/page.js` — Forgot password page
- `app/reset-password/page.js` — Reset password page

**Modify:**
- `middleware.js` — Replace clerkMiddleware with getToken-based redirect logic
- `app/layout.js` — Replace ClerkProvider with Providers (SessionProvider)
- `app/components/Header.js` — Replace Clerk hooks with useSession
- `app/components/Header.module.css` — No structural change needed
- `app/page.js` — Replace useUser/SignUpButton with useSession
- `app/api/history/route.js` — Replace Clerk auth() with getServerSession()
- `app/api/recipe/route.js` — Replace Clerk auth() with getServerSession()
- `app/api/spin-check/route.js` — Replace Clerk auth() with getServerSession()
- `package.json` — Remove @clerk/nextjs, @clerk/themes; add next-auth, bcryptjs, resend
- `.env.local` — Add NEXTAUTH_SECRET, NEXTAUTH_URL, RESEND_API_KEY, RESEND_FROM_EMAIL

---

## Task 1: Install dependencies & update environment

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: Remove Clerk packages, install auth packages**

```bash
cd C:\Users\User\.local\bin\meal-decider
npm uninstall @clerk/nextjs @clerk/themes
npm install next-auth@^4 bcryptjs resend
npm install --save-dev @types/bcryptjs
```

Expected: No errors. `package.json` dependencies now include `next-auth`, `bcryptjs`, `resend`.

- [ ] **Step 2: Add env vars to `.env.local`**

Generate a secret first:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add to `.env.local` (keep existing SUPABASE and ANTHROPIC lines, add these):
```
NEXTAUTH_SECRET=<output from above command>
NEXTAUTH_URL=http://localhost:3000
RESEND_API_KEY=<your Resend API key from resend.com>
RESEND_FROM_EMAIL=onboarding@resend.dev
```

- [ ] **Step 3: Verify build still starts**

```bash
npm run dev
```

Expected: Server starts on localhost:3000. It will error on pages that still import from `@clerk/nextjs` — that's expected and will be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: swap Clerk for next-auth + bcryptjs + resend"
```

---

## Task 2: Create Supabase database tables

**Files:** (Supabase SQL editor — no local files)

- [ ] **Step 1: Open Supabase SQL editor**

Go to https://supabase.com/dashboard → your project → SQL Editor → New query.

- [ ] **Step 2: Run this SQL to create all three tables**

```sql
-- Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Verification tokens (email confirmation)
create table if not exists public.verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null
);

-- Password reset tokens
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  used boolean not null default false
);

-- Index for token lookups (both tables do token → record lookups)
create index if not exists verification_tokens_token_idx on public.verification_tokens(token);
create index if not exists password_reset_tokens_token_idx on public.password_reset_tokens(token);
```

- [ ] **Step 3: Verify tables exist**

In Supabase → Table Editor, confirm you see `users`, `verification_tokens`, `password_reset_tokens`.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: create users and auth token tables in Supabase"
```

---

## Task 3: Create NextAuth config and route handler

**Files:**
- Create: `lib/auth.js`
- Create: `app/api/auth/[...nextauth]/route.js`

- [ ] **Step 1: Create `lib/auth.js`**

```js
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

export const authOptions = {
  providers: [
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

- [ ] **Step 2: Create `app/api/auth/[...nextauth]/route.js`**

```bash
mkdir -p "app/api/auth/[...nextauth]"
```

```js
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | grep -i error
```

Expected: Errors only from files still importing `@clerk/nextjs` (those get fixed later). No errors in `lib/auth.js` or the new route.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.js "app/api/auth/[...nextauth]/route.js"
git commit -m "feat: add NextAuth config with credentials provider"
```

---

## Task 4: Create token and email utilities

**Files:**
- Create: `lib/tokens.js`
- Create: `lib/email.js`

- [ ] **Step 1: Create `lib/tokens.js`**

```js
import 'server-only';
import crypto from 'crypto';
import { supabase } from './supabase';

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createVerificationToken(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await supabase.from('verification_tokens').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function createPasswordResetToken(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await supabase.from('password_reset_tokens').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}
```

- [ ] **Step 2: Create `lib/email.js`**

```js
import 'server-only';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL;
const BASE_URL = process.env.NEXTAUTH_URL;

export async function sendVerificationEmail(email, token) {
  const link = `${BASE_URL}/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your Meal Decider account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:12px">
        <h2 style="margin-top:0">🎰 Meal Decider</h2>
        <p>Thanks for signing up! Click the button below to verify your email address.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Verify Email</a>
        <p style="color:#888;font-size:13px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your Meal Decider password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:12px">
        <h2 style="margin-top:0">🎰 Meal Decider</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <a href="${link}" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
        <p style="color:#888;font-size:13px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Verify no compile errors**

```bash
npm run build 2>&1 | grep "lib/tokens\|lib/email"
```

Expected: No output (no errors in these files).

- [ ] **Step 4: Commit**

```bash
git add lib/tokens.js lib/email.js
git commit -m "feat: add token generation and Resend email utilities"
```

---

## Task 5: Registration API

**Files:**
- Create: `app/api/auth/register/route.js`

- [ ] **Step 1: Create `app/api/auth/register/route.js`**

```js
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { createVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req) {
  try {
    const { email, password, confirmPassword } = await req.json();

    // Validate
    if (!email || !password || !confirmPassword) {
      return Response.json({ error: 'All fields are required.' }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return Response.json(
        { error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number.' },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return Response.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check existing user
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    // Hash password and create user
    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({ email: normalizedEmail, password_hash })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Send verification email
    const token = await createVerificationToken(user.id);
    await sendVerificationEmail(normalizedEmail, token);

    return Response.json({ success: true });
  } catch (e) {
    console.error('Register error:', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compile**

```bash
npm run build 2>&1 | grep "api/auth/register"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/register/route.js
git commit -m "feat: add registration API with email verification"
```

---

## Task 6: Email verification and resend APIs

**Files:**
- Create: `app/api/auth/verify/route.js`
- Create: `app/api/auth/resend-verification/route.js`

- [ ] **Step 1: Create `app/api/auth/verify/route.js`**

```js
import { supabase } from '@/lib/supabase';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return Response.redirect(new URL('/login?error=invalid_token', req.url));
  }

  const { data: record } = await supabase
    .from('verification_tokens')
    .select('id, user_id, expires_at')
    .eq('token', token)
    .single();

  if (!record) {
    return Response.redirect(new URL('/login?error=invalid_token', req.url));
  }

  if (new Date(record.expires_at) < new Date()) {
    await supabase.from('verification_tokens').delete().eq('id', record.id);
    return Response.redirect(new URL('/login?error=token_expired', req.url));
  }

  // Activate account and delete token
  await supabase.from('users').update({ email_verified: true }).eq('id', record.user_id);
  await supabase.from('verification_tokens').delete().eq('id', record.id);

  return Response.redirect(new URL('/login?verified=true', req.url));
}
```

- [ ] **Step 2: Create `app/api/auth/resend-verification/route.js`**

```js
import { supabase } from '@/lib/supabase';
import { createVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Email required.' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', normalizedEmail)
      .single();

    // Always return success to prevent user enumeration
    if (!user || user.email_verified) {
      return Response.json({ success: true });
    }

    // Delete existing tokens for this user before creating new one
    await supabase.from('verification_tokens').delete().eq('user_id', user.id);

    const token = await createVerificationToken(user.id);
    await sendVerificationEmail(normalizedEmail, token);

    return Response.json({ success: true });
  } catch (e) {
    console.error('Resend verification error:', e);
    return Response.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify compile**

```bash
npm run build 2>&1 | grep "api/auth/verify\|api/auth/resend"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/verify/route.js app/api/auth/resend-verification/route.js
git commit -m "feat: add email verification and resend verification APIs"
```

---

## Task 7: Forgot password API

**Files:**
- Create: `app/api/auth/forgot-password/route.js`

- [ ] **Step 1: Create `app/api/auth/forgot-password/route.js`**

```js
import { supabase } from '@/lib/supabase';
import { createPasswordResetToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !EMAIL_REGEX.test(email)) {
      // Always return success — never reveal if email exists
      return Response.json({ success: true });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from('users')
      .select('id, email_verified')
      .eq('email', normalizedEmail)
      .single();

    // Only send email if user exists and is verified
    if (user && user.email_verified) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(normalizedEmail, token);
    }

    // Always return success (prevents user enumeration)
    return Response.json({ success: true });
  } catch (e) {
    console.error('Forgot password error:', e);
    return Response.json({ success: true }); // Still return success on error
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/forgot-password/route.js
git commit -m "feat: add forgot password API"
```

---

## Task 8: Reset password API

**Files:**
- Create: `app/api/auth/reset-password/route.js`

- [ ] **Step 1: Create `app/api/auth/reset-password/route.js`**

```js
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req) {
  try {
    const { token, password, confirmPassword } = await req.json();

    if (!token) {
      return Response.json({ error: 'Invalid reset link.' }, { status: 400 });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return Response.json(
        { error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number.' },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return Response.json({ error: 'Passwords do not match.' }, { status: 400 });
    }

    const { data: record } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (!record || record.used) {
      return Response.json({ error: 'This reset link is invalid or has already been used.' }, { status: 400 });
    }
    if (new Date(record.expires_at) < new Date()) {
      return Response.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Update password
    await supabase.from('users').update({ password_hash }).eq('id', record.user_id);

    // Mark token used and delete all other reset tokens for this user
    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', record.id);
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', record.user_id)
      .neq('id', record.id);

    return Response.json({ success: true });
  } catch (e) {
    console.error('Reset password error:', e);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/reset-password/route.js
git commit -m "feat: add reset password API"
```

---

## Task 9: Update middleware

**Files:**
- Modify: `middleware.js`

- [ ] **Step 1: Replace `middleware.js` entirely**

```js
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always allow: auth pages, API routes, share page, static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/r') ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  // Allow authenticated users (valid NextAuth JWT)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  // Allow users who chose guest mode
  const guestMode = req.cookies.get('guest_mode')?.value === '1';
  if (guestMode) return NextResponse.next();

  // Redirect everyone else to login
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "middleware"
```

Expected: No errors for middleware.js.

- [ ] **Step 3: Commit**

```bash
git add middleware.js
git commit -m "feat: replace Clerk middleware with NextAuth JWT-based redirect"
```

---

## Task 10: Shared auth styles

**Files:**
- Create: `app/auth.module.css`

- [ ] **Step 1: Create `app/auth.module.css`**

```css
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f1a;
  padding: 20px;
}

.card {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
}

.logo {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.subtitle {
  text-align: center;
  font-size: 13px;
  color: #888;
  margin-bottom: 24px;
}

.field {
  margin-bottom: 16px;
}

.fieldHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.label {
  font-size: 13px;
  color: #ccc;
}

.hint {
  font-size: 11px;
  color: #666;
}

.forgotLink {
  font-size: 12px;
  color: #667eea;
  text-decoration: none;
}

.forgotLink:hover {
  text-decoration: underline;
}

.input {
  width: 100%;
  padding: 10px 14px;
  background: #0f0f1a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #667eea;
}

.input.error {
  border-color: #ff6b6b;
}

.fieldError {
  font-size: 12px;
  color: #ff6b6b;
  margin-top: 5px;
}

.btn {
  width: 100%;
  padding: 11px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  margin-top: 8px;
}

.btn:hover:not(:disabled) {
  opacity: 0.88;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.links {
  text-align: center;
  margin-top: 16px;
  font-size: 13px;
  color: #888;
}

.links a {
  color: #667eea;
  text-decoration: none;
}

.links a:hover {
  text-decoration: underline;
}

.divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  margin: 20px 0;
}

.guestLink {
  display: block;
  text-align: center;
  font-size: 12px;
  color: #555;
  text-decoration: none;
  cursor: pointer;
  padding: 4px 0;
}

.guestLink:hover {
  color: #888;
}

.banner {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
  text-align: center;
}

.bannerSuccess {
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.bannerError {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.icon {
  text-align: center;
  font-size: 40px;
  margin-bottom: 12px;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth.module.css
git commit -m "feat: add shared auth page styles"
```

---

## Task 11: Login page

**Files:**
- Create: `app/login/page.js`

- [ ] **Step 1: Create `app/login/page.js`**

```js
'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result) {
      setError('Something went wrong. Please try again.');
      return;
    }

    if (result.error === 'EMAIL_NOT_VERIFIED') {
      // Redirect to verify-email page so they can resend the link
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }

    if (result.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  function handleGuest() {
    document.cookie = 'guest_mode=1; path=/; max-age=86400';
    router.push('/');
  }

  const bannerType = banner.startsWith('success:') ? 'success' : 'error';
  const bannerText = banner.replace(/^(success|error):/, '');

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🎰 Meal Decider</div>
        <div className={styles.subtitle}>Sign in to save your history</div>

        {banner && (
          <div className={`${styles.banner} ${bannerType === 'success' ? styles.bannerSuccess : styles.bannerError}`}>
            {bannerText}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <div className={styles.label}>Email</div>
            <input
              className={styles.input}
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <div className={styles.label}>Password</div>
              <Link href="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
            </div>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className={styles.fieldError}>{error}</div>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className={styles.links}>
          Don't have an account? <Link href="/register">Register</Link>
        </div>

        <hr className={styles.divider} />

        <button className={styles.guestLink} onClick={handleGuest}>
          → Continue as guest <span style={{ fontSize: '11px', color: '#444' }}>(3 spins/day)</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders (dev server must be running)**

```bash
npm run dev
```

Open http://localhost:3000/login — you should see the login form with the Meal Decider logo, email/password fields, forgot password link, register link, and guest link.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.js
git commit -m "feat: add login page"
```

---

## Task 12: Register page

**Files:**
- Create: `app/register/page.js`

- [ ] **Step 1: Create `app/register/page.js`**

```js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const e = {};
    if (!EMAIL_REGEX.test(form.email)) e.email = 'Please enter a valid email address.';
    if (!PASSWORD_REGEX.test(form.password)) e.password = 'Min 8 characters, 1 uppercase letter, 1 number.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGlobalError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setGlobalError(data.error || 'Something went wrong.');
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
  }

  function set(field) {
    return e => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🎰 Meal Decider</div>
        <div className={styles.subtitle}>Create an account to save your recipes</div>

        {globalError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>{globalError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <div className={styles.label}>Email</div>
            <input
              className={`${styles.input} ${errors.email ? styles.error : ''}`}
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
            {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <div className={styles.label}>Password</div>
              <div className={styles.hint}>min 8 chars · 1 uppercase · 1 number</div>
            </div>
            <input
              className={`${styles.input} ${errors.password ? styles.error : ''}`}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
              autoComplete="new-password"
            />
            {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Confirm Password</div>
            <input
              className={`${styles.input} ${errors.confirmPassword ? styles.error : ''}`}
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
              autoComplete="new-password"
            />
            {errors.confirmPassword && <div className={styles.fieldError}>{errors.confirmPassword}</div>}
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className={styles.links}>
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Open http://localhost:3000/register — form with Email, Password (with hint), Confirm Password, Create Account button, and "Sign in" link.

- [ ] **Step 3: Commit**

```bash
git add app/register/page.js
git commit -m "feat: add register page with client-side validation"
```

---

## Task 13: Verify email page

**Files:**
- Create: `app/verify-email/page.js`

- [ ] **Step 1: Create `app/verify-email/page.js`**

```js
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || !email) return;
    setStatus('sending');

    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStatus('sent');
      setCooldown(60);
    } else {
      setStatus('error');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>📬</div>
        <div className={styles.logo}>Check your email</div>
        <div className={styles.subtitle}>
          We sent a verification link to{' '}
          {email ? <strong style={{ color: '#ccc' }}>{email}</strong> : 'your email address'}.
          <br />Click it to activate your account.
        </div>

        <div className={`${styles.banner} ${styles.bannerSuccess}`} style={{ marginTop: 0 }}>
          Link expires in 24 hours
        </div>

        {status === 'sent' && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`}>
            Verification email resent!
          </div>
        )}
        {status === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            Failed to resend. Please try again.
          </div>
        )}

        <div className={styles.links} style={{ marginTop: 8 }}>
          Didn't get it?{' '}
          <button
            onClick={handleResend}
            disabled={cooldown > 0 || status === 'sending'}
            style={{ background: 'none', border: 'none', color: cooldown > 0 ? '#555' : '#667eea', cursor: cooldown > 0 ? 'default' : 'pointer', fontSize: 13, padding: 0 }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>
        </div>

        <div className={styles.links} style={{ marginTop: 12 }}>
          <Link href="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Open http://localhost:3000/verify-email?email=test@example.com — shows the email address, "Link expires in 24 hours" badge, and resend button.

- [ ] **Step 3: Commit**

```bash
git add app/verify-email/page.js
git commit -m "feat: add verify email page with resend cooldown"
```

---

## Task 14: Forgot password page

**Files:**
- Create: `app/forgot-password/page.js`

- [ ] **Step 1: Create `app/forgot-password/page.js`**

```js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.icon}>✉️</div>
          <div className={styles.logo}>Check your inbox</div>
          <div className={styles.subtitle}>
            If an account exists for <strong style={{ color: '#ccc' }}>{email}</strong>, we've sent a password reset link. Check your email.
          </div>
          <div className={`${styles.banner} ${styles.bannerSuccess}`} style={{ marginTop: 0 }}>
            Reset link expires in 1 hour
          </div>
          <div className={styles.links}>
            <Link href="/login">← Back to login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🎰 Meal Decider</div>
        <div className={styles.subtitle}>Enter your email and we'll send you a reset link</div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <div className={styles.label}>Email</div>
            <input
              className={styles.input}
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div className={styles.links}>
          <Link href="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Open http://localhost:3000/forgot-password — shows email field and "Send Reset Link" button. After submit shows success state.

- [ ] **Step 3: Commit**

```bash
git add app/forgot-password/page.js
git commit -m "feat: add forgot password page"
```

---

## Task 15: Reset password page

**Files:**
- Create: `app/reset-password/page.js`

- [ ] **Step 1: Create `app/reset-password/page.js`**

```js
'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.icon}>❌</div>
          <div className={styles.logo}>Invalid link</div>
          <div className={styles.subtitle}>This reset link is missing or malformed.</div>
          <div className={styles.links}><Link href="/forgot-password">Request a new link</Link></div>
        </div>
      </div>
    );
  }

  function validate() {
    const e = {};
    if (!PASSWORD_REGEX.test(form.password)) e.password = 'Min 8 characters, 1 uppercase letter, 1 number.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGlobalError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...form }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setGlobalError(data.error || 'Something went wrong.');
      return;
    }

    router.push('/login?reset=true');
  }

  function set(field) {
    return e => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🎰 Meal Decider</div>
        <div className={styles.subtitle}>Choose a new password</div>

        {globalError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            {globalError}{' '}
            {globalError.includes('expired') && (
              <Link href="/forgot-password" style={{ color: '#ff6b6b' }}>Request a new link</Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <div className={styles.label}>New Password</div>
              <div className={styles.hint}>min 8 chars · 1 uppercase · 1 number</div>
            </div>
            <input
              className={`${styles.input} ${errors.password ? styles.error : ''}`}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
              autoComplete="new-password"
            />
            {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Confirm New Password</div>
            <input
              className={`${styles.input} ${errors.confirmPassword ? styles.error : ''}`}
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
              autoComplete="new-password"
            />
            {errors.confirmPassword && <div className={styles.fieldError}>{errors.confirmPassword}</div>}
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Open http://localhost:3000/reset-password — shows "Invalid link" state (no token). Open http://localhost:3000/reset-password?token=abc — shows the password form.

- [ ] **Step 3: Commit**

```bash
git add app/reset-password/page.js
git commit -m "feat: add reset password page"
```

---

## Task 16: Update layout — add SessionProvider, remove ClerkProvider

**Files:**
- Create: `app/components/Providers.js`
- Modify: `app/layout.js`

- [ ] **Step 1: Create `app/components/Providers.js`**

```js
'use client';
import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Replace `app/layout.js`**

```js
import Providers from './components/Providers';
import Header from './components/Header';

export const metadata = {
  title: 'AI Meal Decider',
  description: "Tell AI what's in your fridge, spin the wheel, get a recipe.",
};

export default function RootLayout({ children }) {
  return (
    <Providers>
      <html lang="en">
        <body>
          <Header />
          {children}
        </body>
      </html>
    </Providers>
  );
}
```

- [ ] **Step 3: Verify build compiles (Header still has Clerk — that's ok until Task 17)**

```bash
npm run build 2>&1 | grep "layout"
```

Expected: No new errors in layout.js itself.

- [ ] **Step 4: Commit**

```bash
git add app/components/Providers.js app/layout.js
git commit -m "feat: replace ClerkProvider with NextAuth SessionProvider"
```

---

## Task 17: Update Header

**Files:**
- Modify: `app/components/Header.js`

- [ ] **Step 1: Replace `app/components/Header.js`**

```js
'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className={styles.header}>
      <span className={styles.logo}>🎰 Meal Decider</span>
      <div className={styles.authRow}>
        {session ? (
          <div className={styles.userRow}>
            <span className={styles.userEmail}>{session.user.email}</span>
            <button
              className={styles.btnSignOut}
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <Link href="/login" className={styles.btnSignIn}>Sign In</Link>
            <Link href="/register" className={styles.btnSignUp}>Sign Up</Link>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update `app/components/Header.module.css` — add missing classes**

Read the existing file first, then add to the bottom:

```css
.userRow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.userEmail {
  font-size: 13px;
  color: #888;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btnSignOut {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ccc;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.btnSignOut:hover {
  border-color: rgba(255, 255, 255, 0.35);
}
```

- [ ] **Step 3: Verify dev server shows header correctly**

```bash
npm run dev
```

Open http://localhost:3000/login — header shows "Sign In" and "Sign Up" links. After login, header shows email + Sign Out button.

- [ ] **Step 4: Commit**

```bash
git add app/components/Header.js app/components/Header.module.css
git commit -m "feat: replace Clerk header with NextAuth useSession"
```

---

## Task 18: Update main page

**Files:**
- Modify: `app/page.js`

- [ ] **Step 1: Replace Clerk imports at top of `app/page.js`**

Find and replace the top of the file. The current top is:
```js
'use client';
import { useState, useRef, useEffect } from 'react';
import { useUser, SignUpButton } from '@clerk/nextjs';
```

Replace with:
```js
'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
```

- [ ] **Step 2: Find and replace `useUser` usage in the component**

Find this line inside the `MealDecider` component:
```js
const { isSignedIn } = useUser();
```

Replace with:
```js
const { data: session } = useSession();
const isSignedIn = !!session;
```

- [ ] **Step 3: Find and replace any `SignUpButton` JSX in the page**

Search for `<SignUpButton` in `app/page.js`. Replace any such element with a plain Next.js Link:
```js
import Link from 'next/link';
// Replace <SignUpButton ...><button>...</button></SignUpButton> with:
<Link href="/register" className={styles.btnSignUp}>Sign Up for unlimited spins</Link>
```

(Check the exact JSX in the file — match the surrounding context.)

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -i "error"
```

Expected: No errors. `@clerk/nextjs` should no longer be imported anywhere.

- [ ] **Step 5: Commit**

```bash
git add app/page.js
git commit -m "feat: replace Clerk hooks in main page with NextAuth useSession"
```

---

## Task 19: Update API routes — history, recipe, spin-check

**Files:**
- Modify: `app/api/history/route.js`
- Modify: `app/api/recipe/route.js`
- Modify: `app/api/spin-check/route.js`

- [ ] **Step 1: Update `app/api/history/route.js`**

Replace the entire file:

```js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('recipe_history')
    .select('id, meal_name, ingredients, dietary_filters, cuisine, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ history: data });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { meal_name, recipe, ingredients, dietary_filters, cuisine } = await req.json();
  if (!meal_name) return Response.json({ error: 'meal_name required' }, { status: 400 });

  const { error } = await supabase.from('recipe_history').insert({
    user_id: session.user.id,
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

- [ ] **Step 2: Update `app/api/recipe/route.js`**

Replace only the auth section. Find:
```js
import { auth } from '@clerk/nextjs/server';
```
Replace with:
```js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
```

Find inside the POST handler:
```js
const { userId } = await auth();
if (userId) {
  supabase.from('recipe_history').insert({
    user_id: userId,
```
Replace with:
```js
const session = await getServerSession(authOptions);
if (session?.user?.id) {
  supabase.from('recipe_history').insert({
    user_id: session.user.id,
```

- [ ] **Step 3: Update `app/api/spin-check/route.js`**

Replace only the auth import and usage. Find:
```js
import { auth } from '@clerk/nextjs/server';
```
Replace with:
```js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
```

Find:
```js
const { userId } = await auth();
if (userId) return Response.json({ allowed: true, spinsLeft: null });
```
Replace with:
```js
const session = await getServerSession(authOptions);
if (session?.user?.id) return Response.json({ allowed: true, spinsLeft: null });
```

- [ ] **Step 4: Verify full build with no Clerk imports**

```bash
npm run build 2>&1
grep -r "@clerk" app/ lib/ middleware.js 2>/dev/null
```

Expected: Build succeeds. grep returns no output (no more Clerk imports).

- [ ] **Step 5: Commit**

```bash
git add app/api/history/route.js app/api/recipe/route.js app/api/spin-check/route.js
git commit -m "feat: replace Clerk auth in all API routes with NextAuth getServerSession"
```

---

## Task 20: Remove Clerk from package.json and deploy

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Confirm Clerk packages are gone**

```bash
npm ls @clerk/nextjs 2>&1
```

Expected: `empty` or error — not found.

If still listed:
```bash
npm uninstall @clerk/nextjs @clerk/themes
```

- [ ] **Step 2: Verify final build is clean**

```bash
npm run build
```

Expected: Build completes with no errors. All routes listed.

- [ ] **Step 3: Test the full flow locally**

With `npm run dev` running:
1. Visit http://localhost:3000 — should redirect to `/login`
2. Click "Continue as guest" — should reach the main app
3. Visit http://localhost:3000/register — fill in form, submit → redirected to `/verify-email`
4. Visit http://localhost:3000/forgot-password — enter email, submit → success state
5. Visit http://localhost:3000/reset-password?token=abc — shows form with validation

- [ ] **Step 4: Add Vercel env vars**

In Vercel dashboard → Project → Settings → Environment Variables, add:

| Name | Value | Environments |
|---|---|---|
| `NEXTAUTH_SECRET` | same value as in `.env.local` | Production, Preview |
| `NEXTAUTH_URL` | `https://meal-decider-alpha.vercel.app` | Production |
| `NEXTAUTH_URL` | `http://localhost:3000` | Development |
| `RESEND_API_KEY` | your Resend API key | Production, Preview |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | Production, Preview |

Also remove old Clerk vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

- [ ] **Step 5: Commit and deploy**

```bash
git add package.json package-lock.json
git commit -m "chore: remove Clerk packages, auth system fully migrated to NextAuth"
```

```bash
cd C:\Users\User\.local\bin\meal-decider
vercel --prod
```

Expected: Build succeeds, app live at https://meal-decider-alpha.vercel.app.

- [ ] **Step 6: Smoke test production**

1. Visit https://meal-decider-alpha.vercel.app — redirects to `/login` ✓
2. Click "Continue as guest" — app loads ✓
3. Register with a real email — verification email arrives ✓
4. Click verification link — redirected to `/login?verified=true` with success banner ✓
5. Sign in — redirected to app, header shows email + Sign Out ✓
6. Sign out — redirected to `/login` ✓

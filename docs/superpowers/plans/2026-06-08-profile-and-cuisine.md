# Profile Section & Cuisine Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a kitchen-gadget-avatar profile page (info, history, settings) with a header dropdown, and change cuisine from single-select to unlimited multi-select throughout the stack.

**Architecture:** A shared `lib/avatars.js` exports the emoji pool. Avatars are assigned at registration (email) and on first Google sign-in, stored in `users.avatar_emoji`. The session callback attaches `avatar_emoji` and `display_name` to `session.user`. The Header reads from session and shows an avatar+dropdown. `/profile` is a client-side page with three cards. Cuisine state changes from `string` to `string[]` in `page.js` and propagates through both API routes.

**Tech Stack:** Next.js 15 App Router, NextAuth v4, Supabase (PostgreSQL), bcryptjs, CSS Modules. No test framework — verify with `npm run build` and manual browser testing. No git repo — deploy with `vercel --prod`.

---

## Pre-work: Run SQL in Supabase

Before writing any code, the user must run this in the **Supabase SQL Editor**:

```sql
ALTER TABLE public.users ADD COLUMN avatar_emoji TEXT;
ALTER TABLE public.users ADD COLUMN display_name TEXT;
```

Confirm both columns appear in the `users` table before proceeding.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/avatars.js` | Create | Avatar emoji pool + random picker |
| `lib/renderRecipe.js` | Create | Shared recipe renderer (extracted from page.js) |
| `lib/auth.js` | Modify | Assign avatar on Google sign-in; attach avatar+name to session |
| `app/api/auth/register/route.js` | Modify | Assign avatar on email registration |
| `app/api/profile/route.js` | Create | GET profile data, PATCH display_name |
| `app/api/profile/change-password/route.js` | Create | PATCH password for email users |
| `app/components/Header.js` | Modify | Replace email+signout with avatar+dropdown |
| `app/components/Header.module.css` | Modify | Add avatar + dropdown styles |
| `app/profile/page.js` | Create | Profile page (info, settings, history cards) |
| `app/profile/profile.module.css` | Create | Profile page styles |
| `app/page.js` | Modify | cuisine string→array, multi-select toggle, import renderRecipe |
| `app/api/suggest/route.js` | Modify | Accept cuisine as array |
| `app/api/recipe/route.js` | Modify | Accept cuisine as array, serialize for history |

---

## Task 1: Shared utilities — avatar pool and recipe renderer

**Files:**
- Create: `lib/avatars.js`
- Create: `lib/renderRecipe.js`

- [ ] **Step 1: Create `lib/avatars.js`**

```js
export const AVATAR_POOL = ['🍳','🥄','🔪','🫕','🍴','🥢','🧂','📟','🥣','🫙'];

export function randomAvatar() {
  return AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
}
```

- [ ] **Step 2: Create `lib/renderRecipe.js`**

This is extracted from `app/page.js` (the `renderRecipe` function at line 80–94). The React import is needed because it returns JSX.

```js
import React from 'react';

export function renderRecipe(text) {
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
```

- [ ] **Step 3: Update `app/page.js` to use the shared renderer**

At the top of `app/page.js`, replace the inline `renderRecipe` function with an import:

Remove lines 80–94 (the `renderRecipe` function definition) and add this import after the existing imports:

```js
import { renderRecipe } from '@/lib/renderRecipe';
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors. The page still renders recipes correctly.

---

## Task 2: Assign avatar at email registration

**Files:**
- Modify: `app/api/auth/register/route.js`

- [ ] **Step 1: Add the avatar import at the top of `app/api/auth/register/route.js`**

Add after the existing imports:

```js
import { randomAvatar } from '@/lib/avatars';
```

- [ ] **Step 2: Add `avatar_emoji` to the INSERT**

Find this block (around line 43–46):

```js
const { data: user, error: insertError } = await supabase
  .from('users')
  .insert({ email: normalizedEmail, password_hash })
  .select('id')
  .single();
```

Replace with:

```js
const { data: user, error: insertError } = await supabase
  .from('users')
  .insert({ email: normalizedEmail, password_hash, avatar_emoji: randomAvatar() })
  .select('id')
  .single();
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no errors.

---

## Task 3: Assign avatar on Google sign-in + attach to session

**Files:**
- Modify: `lib/auth.js`

- [ ] **Step 1: Add avatar import at top of `lib/auth.js`**

```js
import { randomAvatar } from './avatars';
```

- [ ] **Step 2: Update the Google `signIn` callback to include avatar on INSERT, and fetch avatar for existing users**

Replace the entire `async signIn({ user, account })` callback with:

```js
async signIn({ user, account }) {
  if (account?.provider === 'google') {
    const email = user.email?.toLowerCase().trim();
    if (!email) return false;

    const { data: existing, error: selectError } = await supabase
      .from('users')
      .select('id, avatar_emoji')
      .eq('email', email)
      .single();

    if (selectError) {
      console.error('signIn SELECT error code:', selectError.code, 'message:', selectError.message);
    }

    if (existing) {
      user.id = existing.id;
      user.avatar_emoji = existing.avatar_emoji;
      // Backfill avatar if missing (existing users before this feature)
      if (!existing.avatar_emoji) {
        await supabase.from('users').update({ avatar_emoji: randomAvatar() }).eq('id', existing.id);
      }
      return true;
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ email, email_verified: true, avatar_emoji: randomAvatar() })
      .select('id, avatar_emoji')
      .single();

    if (insertError) {
      console.error('signIn INSERT error code:', insertError.code, 'message:', insertError.message);
      if (insertError.code === '23505') {
        const { data: retry } = await supabase
          .from('users').select('id, avatar_emoji').eq('email', email).single();
        if (retry) { user.id = retry.id; user.avatar_emoji = retry.avatar_emoji; return true; }
      }
      return false;
    }

    user.id = newUser.id;
    user.avatar_emoji = newUser.avatar_emoji;
    return true;
  }
  return true;
},
```

- [ ] **Step 3: Update the `jwt` callback to store avatar_emoji and display_name in token**

Replace:

```js
async jwt({ token, user }) {
  if (user) token.id = user.id;
  return token;
},
```

With:

```js
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    if (user.avatar_emoji) token.avatar_emoji = user.avatar_emoji;
  }
  // Fetch fresh avatar_emoji and display_name from DB on every token refresh
  if (token.id && !token.avatar_emoji) {
    const { data } = await supabase
      .from('users')
      .select('avatar_emoji, display_name')
      .eq('id', token.id)
      .single();
    if (data) {
      token.avatar_emoji = data.avatar_emoji;
      token.display_name = data.display_name;
    }
  }
  return token;
},
```

- [ ] **Step 4: Update the `session` callback to expose avatar_emoji and display_name**

Replace:

```js
async session({ session, token }) {
  if (token?.id) session.user.id = token.id;
  return session;
},
```

With:

```js
async session({ session, token }) {
  if (token?.id) session.user.id = token.id;
  if (token?.avatar_emoji) session.user.avatar_emoji = token.avatar_emoji;
  if (token?.display_name) session.user.display_name = token.display_name;
  return session;
},
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Expected: no errors.

---

## Task 4: Profile API routes

**Files:**
- Create: `app/api/profile/route.js`
- Create: `app/api/profile/change-password/route.js`

- [ ] **Step 1: Create `app/api/profile/route.js`**

```js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('users')
    .select('avatar_emoji, display_name, email, created_at, password_hash')
    .eq('id', session.user.id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    avatar_emoji: data.avatar_emoji,
    display_name: data.display_name,
    email: data.email,
    created_at: data.created_at,
    provider: data.password_hash ? 'email' : 'google',
  });
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { display_name } = await req.json();
  if (typeof display_name !== 'string') {
    return Response.json({ error: 'display_name must be a string' }, { status: 400 });
  }

  const trimmed = display_name.trim().slice(0, 50);

  const { error } = await supabase
    .from('users')
    .update({ display_name: trimmed || null })
    .eq('id', session.user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
```

- [ ] **Step 2: Create `app/api/profile/change-password/route.js`**

```js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password) {
    return Response.json({ error: 'Both passwords are required.' }, { status: 400 });
  }
  if (new_password.length < 8) {
    return Response.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', session.user.id)
    .single();

  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });
  if (!user.password_hash) {
    return Response.json({ error: 'This account uses Google sign-in. Password change not available.' }, { status: 400 });
  }

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return Response.json({ error: 'Current password is incorrect.' }, { status: 400 });

  const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!PASSWORD_REGEX.test(new_password)) {
    return Response.json(
      { error: 'New password must be at least 8 characters with 1 uppercase letter and 1 number.' },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(new_password, 12);
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', session.user.id);

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  return Response.json({ success: true });
}
```

- [ ] **Step 3: Update `app/api/history/route.js` GET to include `recipe` field**

The profile page accordion needs the recipe text. Find this line in the GET handler:

```js
.select('id, meal_name, ingredients, dietary_filters, cuisine, created_at')
```

Replace with:

```js
.select('id, meal_name, ingredients, dietary_filters, cuisine, recipe, created_at')
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors, two new API routes appear in the build output.

---

## Task 5: Header dropdown with avatar

**Files:**
- Modify: `app/components/Header.js`
- Modify: `app/components/Header.module.css`

- [ ] **Step 1: Replace `app/components/Header.js` entirely**

```js
'use client';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={styles.header}>
      <span className={styles.logo}>🎰 Meal Decider</span>
      <div className={styles.authRow}>
        {session && (
          <div className={styles.avatarWrap} ref={ref}>
            <button
              className={styles.avatar}
              onClick={() => setOpen(prev => !prev)}
              aria-label="Open profile menu"
            >
              {session.user.avatar_emoji || '🍳'}
            </button>
            {open && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownEmail}>{session.user.email}</div>
                <div className={styles.dropdownDivider} />
                <Link href="/profile" className={styles.dropdownItem} onClick={() => setOpen(false)}>
                  👤 Profile
                </Link>
                <div className={styles.dropdownDivider} />
                <button
                  className={`${styles.dropdownItem} ${styles.dropdownSignOut}`}
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Add avatar + dropdown styles to `app/components/Header.module.css`**

Append to the end of the file:

```css
.avatarWrap {
  position: relative;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1a1a2e;
  border: 2px solid #2a2a4a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: border-color 0.15s;
  padding: 0;
}
.avatar:hover { border-color: #667eea; }

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 10px;
  min-width: 200px;
  z-index: 100;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.dropdownEmail {
  padding: 10px 14px;
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdownDivider {
  border-top: 1px solid #2a2a4a;
}

.dropdownItem {
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: #ccc;
  text-decoration: none;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}
.dropdownItem:hover { background: #16162a; color: #fff; }

.dropdownSignOut { color: #ff6b6b; }
.dropdownSignOut:hover { color: #ff6b6b; }
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no errors. Load the app in a browser, sign in — avatar emoji appears in the header. Clicking opens the dropdown. Clicking outside closes it.

---

## Task 6: Profile page

**Files:**
- Create: `app/profile/page.js`
- Create: `app/profile/profile.module.css`

- [ ] **Step 1: Create `app/profile/profile.module.css`**

```css
.page {
  flex: 1;
  width: 100%;
  min-height: calc(100vh - 49px);
  background: #0f0f1a;
  padding: 32px 16px 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.container {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: #16162a;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  padding: 24px;
}

.sectionLabel {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #8888bb;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.infoRow {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.avatarLarge {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #1a1a2e;
  border: 2px solid #2a2a4a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.infoDetails { flex: 1; }

.displayName {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
}

.infoEmail {
  font-size: 13px;
  color: #888;
  margin-bottom: 2px;
}

.infoBadge {
  display: inline-block;
  font-size: 11px;
  color: #667eea;
  background: rgba(102,126,234,0.12);
  border: 1px solid rgba(102,126,234,0.25);
  border-radius: 20px;
  padding: 2px 8px;
  margin-top: 4px;
}

.infoMeta {
  font-size: 12px;
  color: #555;
  margin-top: 12px;
}

.fieldGroup { margin-bottom: 16px; }

.label {
  display: block;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 10px 14px;
  color: #fff;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.input:focus { border-color: #667eea; }

.btn {
  padding: 10px 20px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:hover:not(:disabled) { opacity: 0.88; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.msgSuccess {
  font-size: 12px;
  color: #4ecdc4;
  margin-top: 8px;
}
.msgError {
  font-size: 12px;
  color: #ff6b6b;
  margin-top: 8px;
}

.divider {
  border: none;
  border-top: 1px solid #2a2a4a;
  margin: 20px 0;
}

.historyItem {
  padding: 12px 0;
  border-bottom: 1px solid #1e1e36;
  cursor: pointer;
}
.historyItem:last-child { border-bottom: none; }

.historyTop {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.historyMeal {
  font-size: 14px;
  color: #eee;
  font-weight: 500;
}

.historyDate {
  font-size: 12px;
  color: #555;
  flex-shrink: 0;
  margin-left: 12px;
}

.historyRecipe {
  margin-top: 10px;
  padding: 12px;
  background: #0f0f1a;
  border-radius: 8px;
  font-size: 13px;
  color: #ccc;
  line-height: 1.6;
}

.emptyState {
  text-align: center;
  color: #555;
  font-size: 14px;
  padding: 16px 0;
}

.countBadge {
  display: inline-block;
  background: #2a2a4a;
  color: #888;
  font-size: 11px;
  border-radius: 20px;
  padding: 2px 8px;
  margin-left: 8px;
  font-weight: 600;
  vertical-align: middle;
}
```

- [ ] **Step 2: Create `app/profile/page.js`**

```js
'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { renderRecipe } from '@/lib/renderRecipe';
import styles from './profile.module.css';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [nameStatus, setNameStatus] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setDisplayName(data.display_name || '');
      });
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { if (data.history) setHistory(data.history); });
  }, [status]);

  async function saveName() {
    setSavingName(true);
    setNameStatus('');
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    });
    const data = await res.json();
    setSavingName(false);
    setNameStatus(res.ok ? 'success:Saved!' : `error:${data.error}`);
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      setPwStatus('error:Passwords do not match.');
      return;
    }
    setSavingPw(true);
    setPwStatus('');
    const res = await fetch('/api/profile/change-password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    const data = await res.json();
    setSavingPw(false);
    if (res.ok) {
      setPwStatus('success:Password updated!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwStatus(`error:${data.error}`);
    }
  }

  if (status === 'loading' || !profile) {
    return <div className={styles.page}><div style={{ color: '#555', marginTop: 40 }}>Loading...</div></div>;
  }

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const nameMsg = nameStatus.replace(/^(success|error):/, '');
  const nameMsgType = nameStatus.startsWith('success') ? styles.msgSuccess : styles.msgError;
  const pwMsg = pwStatus.replace(/^(success|error):/, '');
  const pwMsgType = pwStatus.startsWith('success') ? styles.msgSuccess : styles.msgError;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Info card */}
        <div className={styles.card}>
          <span className={styles.sectionLabel}>Profile</span>
          <div className={styles.infoRow}>
            <div className={styles.avatarLarge}>
              {session.user.avatar_emoji || '🍳'}
            </div>
            <div className={styles.infoDetails}>
              <div className={styles.displayName}>
                {profile.display_name || profile.email.split('@')[0]}
              </div>
              <div className={styles.infoEmail}>{profile.email}</div>
              <span className={styles.infoBadge}>
                {profile.provider === 'google' ? 'Google account' : 'Email account'}
              </span>
            </div>
          </div>
          {joinedDate && (
            <div className={styles.infoMeta}>Member since {joinedDate}</div>
          )}
        </div>

        {/* Settings card */}
        <div className={styles.card}>
          <span className={styles.sectionLabel}>Settings</span>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Display name</label>
            <input
              className={styles.input}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>
          <button className={styles.btn} onClick={saveName} disabled={savingName}>
            {savingName ? 'Saving…' : 'Save name'}
          </button>
          {nameStatus && <div className={nameMsgType}>{nameMsg}</div>}

          {profile.provider === 'email' && (
            <>
              <hr className={styles.divider} />
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Current password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>New password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Confirm new password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <button className={styles.btn} onClick={changePassword} disabled={savingPw}>
                {savingPw ? 'Saving…' : 'Change password'}
              </button>
              {pwStatus && <div className={pwMsgType}>{pwMsg}</div>}
            </>
          )}
        </div>

        {/* History card */}
        <div className={styles.card}>
          <span className={styles.sectionLabel}>
            Meal History
            {history.length > 0 && (
              <span className={styles.countBadge}>{history.length}</span>
            )}
          </span>
          {history.length === 0 && (
            <div className={styles.emptyState}>No meals yet — go spin the wheel!</div>
          )}
          {history.map(h => (
            <div
              key={h.id}
              className={styles.historyItem}
              onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
            >
              <div className={styles.historyTop}>
                <span className={styles.historyMeal}>{h.meal_name}</span>
                <span className={styles.historyDate}>
                  {new Date(h.created_at).toLocaleDateString()}
                </span>
              </div>
              {expandedId === h.id && h.recipe && (
                <div className={styles.historyRecipe}>
                  {renderRecipe(h.recipe)}
                </div>
              )}
              {expandedId === h.id && !h.recipe && (
                <div className={styles.historyRecipe} style={{ color: '#555' }}>
                  No recipe saved for this meal.
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no errors, `/profile` appears as a static route in the build output.

- [ ] **Step 4: Manual test**

Sign in, click the avatar in the header, click "Profile". Verify:
- Info card shows avatar emoji, email, account type, joined date
- Settings card shows display name input; for email accounts also shows password fields
- History card shows meals (or empty state)
- Clicking a meal with a saved recipe expands it inline

---

## Task 7: Cuisine multi-select

**Files:**
- Modify: `app/page.js`
- Modify: `app/api/suggest/route.js`
- Modify: `app/api/recipe/route.js`

- [ ] **Step 1: Update cuisine state in `app/page.js`**

Find line 109:
```js
const [cuisine, setCuisine] = useState('');
```
Replace with:
```js
const [cuisine, setCuisine] = useState([]);
```

- [ ] **Step 2: Update `toggleCuisine` in `app/page.js`**

Find:
```js
const toggleCuisine = (c) =>
  setCuisine(prev => prev === c ? '' : c);
```
Replace with:
```js
const toggleCuisine = (c) =>
  setCuisine(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
```

- [ ] **Step 3: Fix the reset effect dependency in `app/page.js`**

Find:
```js
  }, [filters, cuisine]);
```
Replace with:
```js
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, JSON.stringify(cuisine)]);
```

- [ ] **Step 4: Update the cuisine chip active class check in `app/page.js`**

Find:
```js
className={`${styles.filterChip} ${styles.cuisineChip} ${cuisine === c ? styles.cuisineChipActive : ''}`}
```
Replace with:
```js
className={`${styles.filterChip} ${styles.cuisineChip} ${cuisine.includes(c) ? styles.cuisineChipActive : ''}`}
```

- [ ] **Step 5: Update `app/api/suggest/route.js` to accept cuisine as array**

Replace the file entirely:

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const ALLOWED_CUISINES = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

export async function POST(req) {
  try {
    const { ingredients, filters, cuisine } = await req.json();
    if (!ingredients?.trim()) {
      return Response.json({ error: 'No ingredients provided' }, { status: 400 });
    }

    const safeCuisines = Array.isArray(cuisine)
      ? cuisine.filter(c => ALLOWED_CUISINES.includes(c))
      : [];

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const cuisineText = safeCuisines.length
      ? `\nCuisine style: ${safeCuisines.join(', ')} cuisine only.`
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

- [ ] **Step 6: Update `app/api/recipe/route.js` to accept cuisine as array**

Replace the file entirely:

```js
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const client = new Anthropic();
const ALLOWED_CUISINES = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

export async function POST(req) {
  try {
    const { meal, ingredients, filters, cuisine } = await req.json();
    if (!meal) {
      return Response.json({ error: 'No meal provided' }, { status: 400 });
    }

    const safeCuisines = Array.isArray(cuisine)
      ? cuisine.filter(c => ALLOWED_CUISINES.includes(c))
      : [];

    const filterText = filters?.length
      ? `\nDietary requirements (ALL meals MUST comply): ${filters.join(', ')}.`
      : '';

    const cuisineText = safeCuisines.length
      ? `\nCuisine style: ${safeCuisines.join(', ')}.`
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

    const session = await getServerSession(authOptions);
    if (session) {
      supabase.from('recipe_history').insert({
        user_id: session.user.id,
        meal_name: meal,
        recipe,
        ingredients: ingredients || '',
        dietary_filters: filters || [],
        cuisine: safeCuisines.length ? safeCuisines.join(',') : null,
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

- [ ] **Step 7: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 8: Manual test cuisine multi-select**

Sign in, go to the main page. Verify:
- Multiple cuisine chips can be active at the same time
- Clicking an active chip deactivates it
- Suggesting meals with 2+ cuisines selected produces variety

---

## Task 8: Deploy

- [ ] **Step 1: Run a final build check**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 2: Deploy to production**

```bash
vercel --prod
```

Expected: deployment completes, aliased to production URL.

- [ ] **Step 3: Smoke test in production**

1. Sign in with Google → avatar appears in header
2. Click avatar → dropdown shows "Profile" and "Sign Out"
3. Click Profile → page loads with info, settings, history
4. Click a history meal → recipe expands inline
5. Go back to main page → select multiple cuisine chips → get suggestions → verify they respect chosen cuisines

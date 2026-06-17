'use client';
import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';
import { APP_NAME } from '@/lib/brand';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setBanner('success:Account created! Sign in below.');
    } else if (searchParams.get('verified') === 'true') {
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
        <div className={styles.logo}>🎰 {APP_NAME}</div>

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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

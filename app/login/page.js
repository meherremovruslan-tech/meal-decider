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

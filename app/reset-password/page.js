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

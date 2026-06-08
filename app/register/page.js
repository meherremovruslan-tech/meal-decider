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

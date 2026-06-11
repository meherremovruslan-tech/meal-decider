'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
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

    router.push('/login?registered=true');
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

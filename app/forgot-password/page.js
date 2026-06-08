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

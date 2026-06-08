'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../auth.module.css';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState('idle');
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

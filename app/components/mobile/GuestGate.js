'use client';
import Link from 'next/link';
import styles from './GuestGate.module.css';

// Shared "sign up or sign in" prompt for guest-only screens (Pantry, Profile,
// Scan popup, empty History). Always offers both paths so a returning guest
// who already has an account isn't funneled only toward Sign Up.
export default function GuestGate({ icon, title, description }) {
  return (
    <div className={styles.gate}>
      <div className={styles.iconCircle}>{icon}</div>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{description}</p>
      <Link href="/register" className={styles.primaryBtn}>Sign Up — It&rsquo;s Free</Link>
      <Link href="/login" className={styles.secondaryBtn}>Already have an account? Sign In</Link>
    </div>
  );
}

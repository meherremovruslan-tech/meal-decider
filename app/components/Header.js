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

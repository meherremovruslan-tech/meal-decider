'use client';
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import styles from './Header.module.css';

export default function Header() {
  const { isSignedIn } = useUser();

  return (
    <header className={styles.header}>
      <span className={styles.logo}>🎰 Meal Decider</span>
      <div className={styles.authRow}>
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <>
            <SignInButton mode="modal">
              <button className={styles.btnSignIn}>Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={styles.btnSignUp}>Sign Up</button>
            </SignUpButton>
          </>
        )}
      </div>
    </header>
  );
}

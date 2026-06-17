'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import styles from './Header.module.css';
import { APP_NAME } from '@/lib/brand';

export default function Header() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <header className={`${styles.header} ${pathname === '/' ? styles.hideOnMobileRoot : ''}`}>
      <span className={styles.logo}>🎰 {APP_NAME}</span>
      <div className={styles.authRow}>
        {session ? (
          <div className={styles.avatarWrap} ref={dropdownRef}>
            <button
              className={styles.avatar}
              onClick={() => setOpen((v) => !v)}
              aria-label="Account menu"
            >
              {session.user.avatar_emoji || '👤'}
            </button>
            {open && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>
                  <span className={styles.dropdownAvatar}>
                    {session.user.avatar_emoji || '👤'}
                  </span>
                  <span className={styles.dropdownName}>
                    {session.user.display_name || session.user.email}
                  </span>
                </div>
                <div className={styles.dropdownDivider} />
                <Link
                  href="/profile"
                  className={styles.dropdownItem}
                  onClick={() => setOpen(false)}
                >
                  Profile
                </Link>
                <div className={styles.dropdownDivider} />
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className={styles.btnSignIn}>
              Sign In
            </Link>
            <Link href="/register" className={styles.btnSignUp}>
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

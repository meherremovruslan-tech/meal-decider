'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { AVATAR_POOL } from '@/lib/avatars';
import GuestGate from './GuestGate';
import styles from './ProfileTab.module.css';

const PASSWORD_HINT = 'At least 8 characters with 1 uppercase letter and 1 number.';

export default function ProfileTab({ isSignedIn, onGoTab }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        if (data.email) setProfile(data);
        else setError(data.error || 'Failed to load profile');
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const cycleAvatar = async () => {
    if (!profile) return;
    const idx = AVATAR_POOL.indexOf(profile.avatar_emoji);
    const next = AVATAR_POOL[(idx + 1) % AVATAR_POOL.length];
    setProfile(p => ({ ...p, avatar_emoji: next })); // optimistic
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_emoji: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Could not save avatar — try again.');
    }
  };

  const saveName = async () => {
    setEditingName(false);
    const name = nameDraft.trim();
    if (!profile || name === (profile.display_name || '')) return;
    setProfile(p => ({ ...p, display_name: name || null }));
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Could not save name — try again.');
    }
  };

  const changePassword = async () => {
    if (pwNew !== pwConfirm) {
      setPwStatus('error:Passwords do not match.');
      return;
    }
    setSavingPw(true);
    setPwStatus('');
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPwStatus('success:Password updated!');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (e) {
      setPwStatus(`error:${e.message}`);
    } finally {
      setSavingPw(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}><h1 className={styles.logo}>Profile</h1></header>
        <GuestGate
          icon="👤"
          title="Make it yours"
          description="Sign in to see your profile, meal history, and pantry — or create a free account in seconds."
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}><h1 className={styles.logo}>Profile</h1></header>

      {error && <p className={styles.error}>⚠️ {error}</p>}
      {loading && <p className={styles.empty}>Loading…</p>}

      {profile && (
        <>
          <div className={styles.hero}>
            <button type="button" className={styles.avatar} onClick={cycleAvatar} aria-label="Change avatar">
              {profile.avatar_emoji || '👤'}
            </button>
            <div className={styles.avatarHint}>tap to change avatar</div>
            <div className={styles.name}>{profile.display_name || profile.email.split('@')[0]}</div>
            <div className={styles.email}>{profile.email}</div>
            <span className={styles.badge}>
              {profile.provider === 'google' ? 'Google account' : 'Email account'}
            </span>
          </div>

          <div className={styles.list}>
            <div className={styles.row}>
              <span className={styles.rowIco}>✏️</span>
              {editingName ? (
                <input
                  className={styles.nameInput}
                  value={nameDraft}
                  autoFocus
                  maxLength={50}
                  placeholder="Display name"
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                />
              ) : (
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => { setEditingName(true); setNameDraft(profile.display_name || ''); }}
                >
                  <span className={styles.rowTxt}>Display name</span>
                  <span className={styles.rowVal}>{profile.display_name || 'not set'} ›</span>
                </button>
              )}
            </div>

            {profile.provider === 'email' && (
              <div className={styles.row}>
                <span className={styles.rowIco}>🔒</span>
                <button type="button" className={styles.rowBtn} onClick={() => setShowPw(v => !v)}>
                  <span className={styles.rowTxt}>Change password</span>
                  <span className={styles.rowVal}>{showPw ? '▲' : '›'}</span>
                </button>
              </div>
            )}
            {showPw && profile.provider === 'email' && (
              <div className={styles.pwForm}>
                <input className={styles.pwInput} type="password" placeholder="Current password"
                  value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} />
                <input className={styles.pwInput} type="password" placeholder="New password"
                  value={pwNew} onChange={e => setPwNew(e.target.value)} />
                <input className={styles.pwInput} type="password" placeholder="Confirm new password"
                  value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} />
                <p className={styles.pwHint}>{PASSWORD_HINT}</p>
                {pwStatus && (
                  <p className={pwStatus.startsWith('success') ? styles.pwOk : styles.pwErr}>
                    {pwStatus.split(':').slice(1).join(':')}
                  </p>
                )}
                <button
                  type="button"
                  className={styles.pwBtn}
                  onClick={changePassword}
                  disabled={savingPw || !pwCurrent || !pwNew || !pwConfirm}
                >
                  {savingPw ? 'Saving…' : 'Update password'}
                </button>
              </div>
            )}

            <div className={styles.row}>
              <span className={styles.rowIco}>📒</span>
              <button type="button" className={styles.rowBtn} onClick={() => onGoTab('history')}>
                <span className={styles.rowTxt}>Meal history</span>
                <span className={styles.rowVal}>›</span>
              </button>
            </div>

            <div className={styles.row}>
              <span className={styles.rowIco}>🧺</span>
              <button type="button" className={styles.rowBtn} onClick={() => onGoTab('pantry')}>
                <span className={styles.rowTxt}>Pantry lists</span>
                <span className={styles.rowVal}>›</span>
              </button>
            </div>
          </div>

          <div className={styles.list}>
            <div className={styles.row}>
              <span className={styles.rowIco}>🚪</span>
              <button
                type="button"
                className={styles.rowBtn}
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <span className={`${styles.rowTxt} ${styles.signout}`}>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

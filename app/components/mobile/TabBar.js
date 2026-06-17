'use client';
import styles from './TabBar.module.css';

const LEFT = [
  { id: 'decide', icon: '🎡', label: 'Decide' },
  { id: 'history', icon: '📒', label: 'History' },
];
const RIGHT = [
  { id: 'pantry', icon: '🧺', label: 'Pantry' },
  { id: 'profile', icon: '👤', label: 'Profile' },
];

// Bottom navigation: Decide | History | (📸 scan) | Pantry | Profile.
// The raised center button triggers the existing scan flow from any tab.
export default function TabBar({ active, onTab, onScan }) {
  const tab = (t) => (
    <button
      key={t.id}
      type="button"
      className={`${styles.tab} ${active === t.id ? styles.active : ''}`}
      onClick={() => onTab(t.id)}
      aria-current={active === t.id ? 'page' : undefined}
    >
      <span className={styles.ico}>{t.icon}</span>
      {t.label}
    </button>
  );
  return (
    <nav className={styles.bar}>
      {LEFT.map(tab)}
      <div className={styles.scanWrap}>
        <button type="button" className={styles.scanBtn} onClick={onScan} aria-label="Scan your fridge">
          📸
        </button>
        <span className={styles.scanLbl}>Scan</span>
      </div>
      {RIGHT.map(tab)}
    </nav>
  );
}

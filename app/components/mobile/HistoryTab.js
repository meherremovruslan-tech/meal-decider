'use client';
import { useState } from 'react';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import GuestGate from './GuestGate';
import styles from './HistoryTab.module.css';

const DAY = 24 * 60 * 60 * 1000;

// Server rows have created_at; guest localStorage rows only have a locale
// date string. Anything unparseable lands in "Earlier".
function groupLabel(h) {
  const ts = h.created_at ? new Date(h.created_at) : new Date(h.date);
  if (isNaN(ts.getTime())) return 'Earlier';
  const days = (Date.now() - ts.getTime()) / DAY;
  if (days < 7) return 'This week';
  if (days < 14) return 'Last week';
  return 'Earlier';
}

export default function HistoryTab({ history, expandedId, onToggle, onDelete, isSignedIn }) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const indexed = history.map((h, idx) => ({ h, idx }));
  const visible = q ? indexed.filter(({ h }) => h.meal.toLowerCase().includes(q)) : indexed;

  // history is newest-first, so consecutive items share groups
  const groups = [];
  for (const entry of visible) {
    const label = groupLabel(entry.h);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.logo}>Meal History</h1>
      </header>

      <input
        className={styles.search}
        placeholder="🔍 Search meals…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {history.length === 0 && (
        isSignedIn ? (
          <p className={styles.empty}>No meals yet — spin the wheel! 🎡</p>
        ) : (
          <GuestGate
            icon="📒"
            title="Remember every meal"
            description="Sign up free and we'll keep a running history of everything you decide — synced across your devices."
          />
        )
      )}
      {history.length > 0 && visible.length === 0 && (
        <p className={styles.empty}>Nothing matches &ldquo;{query}&rdquo;.</p>
      )}

      {groups.map(g => (
        <section key={`${g.label}-${g.items[0].idx}`}>
          <div className={styles.group}>{g.label}</div>
          {g.items.map(({ h, idx }) => {
            const id = h.id ?? h.meal;
            const open = expandedId === id;
            return (
              <div key={id} className={`${styles.item} ${open ? styles.open : ''}`}>
                <button type="button" className={styles.itemTop} onClick={() => onToggle(id)}>
                  <span className={styles.meal}>{h.meal}</span>
                  <span className={styles.when}>{h.date}</span>
                  <span className={styles.chev}>▼</span>
                </button>
                {open && (
                  <div className={styles.itemBody}>
                    {h.recipe && <div className={styles.recipe}>{renderRecipe(h.recipe)}</div>}
                    <div className={styles.actions}>
                      {h.recipe
                        ? <RecipeActions meal={h.meal} recipe={h.recipe} />
                        : <span className={styles.noRecipe}>No saved recipe for this meal.</span>}
                      <button
                        type="button"
                        className={styles.delete}
                        onClick={(e) => onDelete(e, h, idx)}
                        aria-label={`Delete ${h.meal}`}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

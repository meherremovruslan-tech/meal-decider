'use client';
import Link from 'next/link';
import { MEAL_TIMES, CUISINE_FILTERS } from '@/lib/filters';
import FridgeIcon from '../FridgeIcon';
import styles from './DecideTab.module.css';

// Mobile decide flow: comma-list ingredient input (same model as desktop),
// in-card SPIN call-to-action, pantry shortcut, meal-time segments (always
// fully visible — a primary choice must never hide an option off-screen),
// and a scrolling cuisine row. Scanning lives on the tab bar's center
// button; the recipe lives in the spin overlay and in History.
export default function DecideTab({
  ingredients, setIngredients,
  mealTime, mealTimeAuto, onMealTime, mealTimeHint,
  cuisine, toggleCuisine,
  isSignedIn, loadingSuggest, error,
  onPantry, onSpin, spinsLeft,
}) {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.logo}>🎰 Meal <span>Decider</span></h1>
        {!isSignedIn && (
          <Link href="/register" className={styles.signUpBtn}>Sign Up</Link>
        )}
      </header>

      <section className={styles.card}>
        <span className={styles.label}>What&rsquo;s in your fridge?</span>
        <input
          className={styles.input}
          placeholder="e.g. chicken, rice, tomatoes, garlic…"
          enterKeyHint="done"
          value={ingredients}
          onChange={e => setIngredients(e.target.value)}
        />
        <button
          type="button"
          className={styles.spinCta}
          onClick={onSpin}
          disabled={!ingredients.trim() || loadingSuggest}
        >
          {loadingSuggest ? 'Thinking…' : '🎡 SPIN THE WHEEL'}
        </button>
        {!isSignedIn && (
          <p className={styles.spinHint}>
            {spinsLeft} free spin{spinsLeft === 1 ? '' : 's'} left today
          </p>
        )}
        <button type="button" className={styles.pantryBtn} onClick={onPantry}>
          <FridgeIcon /> Load from pantry{!isSignedIn && ' 🔒'}
        </button>
      </section>

      <section className={styles.card}>
        <span className={styles.label}>What meal are we deciding?</span>
        <div className={styles.mealGrid}>
          {MEAL_TIMES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`${styles.mealCell} ${mealTime === m.id ? styles.mealCellOn : ''}`}
              onClick={() => onMealTime(m.id)}
            >
              {mealTime === m.id && mealTimeAuto && <span className={styles.autoTag}>AUTO</span>}
              <span className={styles.mealEmoji}>{m.emoji}</span>
              <span className={styles.mealText}>{m.id}</span>
            </button>
          ))}
        </div>
        <p className={styles.mealHint}>{mealTimeHint}</p>
        {isSignedIn && (
          <>
            <span className={styles.label} style={{ marginTop: 14 }}>Cuisine</span>
            <div className={styles.chipRow}>
              {CUISINE_FILTERS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.chip} ${cuisine.includes(c) ? styles.chipCuisineOn : ''}`}
                  onClick={() => toggleCuisine(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {error && <p className={styles.error}>⚠️ {error}</p>}
    </div>
  );
}

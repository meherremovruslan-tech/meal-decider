'use client';
import Link from 'next/link';
import { renderRecipe } from '@/lib/renderRecipe';
import RecipeActions from '../RecipeActions';
import styles from './SpinOverlay.module.css';

// Full-screen spin moment: suggest-loading → wheel + SPIN (or guest gate)
// → result badge → recipe view. State machine is driven entirely by props
// from page.js — this component is presentational.
export default function SpinOverlay({
  open, onClose, onDone,
  canvasRef, canvasSize,
  meals, loadingSuggest, spinning, spinGate,
  selectedMeal, intro, recipe, videoId, videoTitle, loadingRecipe, error,
  onSpin, onGetRecipe,
}) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.close} onClick={recipe ? onDone : onClose} aria-label="Close">✕</button>

      {loadingSuggest && (
        <div className={styles.center}>
          <span className={styles.spinner} />
          <p className={styles.hint}>AI is thinking of meals…</p>
        </div>
      )}

      {!loadingSuggest && meals.length === 0 && (
        <div className={styles.center}>
          <p className={styles.hint}>{error ? `⚠️ ${error}` : 'No meal ideas came back — try different ingredients.'}</p>
        </div>
      )}

      {!loadingSuggest && meals.length > 0 && !recipe && (
        <div className={styles.center}>
          <canvas ref={canvasRef} className={styles.canvas} width={canvasSize} height={canvasSize} />

          {spinGate ? (
            <div className={styles.gate}>
              <p>You&rsquo;ve used your 3 free spins today.<br />Sign up to spin unlimited.</p>
              <Link href="/register" className={styles.gateBtn}>Sign Up — It&rsquo;s Free</Link>
            </div>
          ) : (
            <button type="button" className={styles.spinBtn} onClick={onSpin} disabled={spinning}>
              {spinning ? 'Spinning…' : '🎲 SPIN'}
            </button>
          )}

          {selectedMeal && !spinning && !spinGate && (
            <div className={styles.result}>
              <div className={styles.resultSub}>THE WHEEL CHOSE…</div>
              <div className={styles.resultIntro}>{intro}</div>
              <div className={styles.resultMeal}>{selectedMeal}</div>
              <button type="button" className={styles.recipeBtn} onClick={onGetRecipe} disabled={loadingRecipe}>
                {loadingRecipe ? 'Writing your recipe…' : 'Get Recipe 👨‍🍳'}
              </button>
            </div>
          )}

          {error && <p className={styles.hint}>⚠️ {error}</p>}
        </div>
      )}

      {recipe && (
        <div className={styles.recipeView}>
          <div className={styles.recipeHead}>
            <span className={styles.resultSub}>YOUR RECIPE</span>
            <RecipeActions meal={selectedMeal} recipe={recipe} videoId={videoId} videoTitle={videoTitle} />
          </div>
          <div className={styles.recipeText}>{renderRecipe(recipe)}</div>
          <button type="button" className={styles.doneBtn} onClick={onDone}>Done ✓</button>
        </div>
      )}
    </div>
  );
}

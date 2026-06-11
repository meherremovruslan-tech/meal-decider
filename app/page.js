'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './page.module.css';
import './globals.css';
import { renderRecipe } from '@/lib/renderRecipe';
import FridgeIcon from './components/FridgeIcon';

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];
const DIETARY_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free'];
const CUISINE_FILTERS = ['Asian', 'Italian', 'Turkish', 'Mexican', 'Mediterranean'];

function drawWheel(canvas, meals, angle) {
  if (!canvas || meals.length === 0) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(cx, cy) - 12;
  const n = meals.length;
  const slice = (2 * Math.PI) / n;

  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < n; i++) {
    const start = angle + i * slice;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1a1a2e';
    ctx.font = `bold ${n > 6 ? 11 : 13}px sans-serif`;
    const t = meals[i].length > 17 ? meals[i].slice(0, 16) + '…' : meals[i];
    ctx.fillText(t, r - 10, 5);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = '#e74c3c';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(W - 4, cy - 13);
  ctx.lineTo(W - 4, cy + 13);
  ctx.lineTo(W - 34, cy);
  ctx.closePath();
  ctx.fillStyle = '#e74c3c';
  ctx.fill();
  ctx.restore();
}

function getSelectedIndex(angle, n) {
  const slice = (2 * Math.PI) / n;
  const norm = ((-angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(norm / slice) % n;
}


export default function MealDecider() {
  const { data: session } = useSession();
  const isSignedIn = !!session;

  const [ingredients, setIngredients] = useState('');
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipe, setRecipe] = useState('');
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState([]);
  const [cuisine, setCuisine] = useState([]);
  const [canvasSize, setCanvasSize] = useState(340);
  const [history, setHistory] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [shareLabel, setShareLabel] = useState('🔗 Share');
  const [spinGate, setSpinGate] = useState(false);

  const [pantryLists, setPantryLists] = useState([]);
  const [pantryLoaded, setPantryLoaded] = useState(false);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showGuestPantryNudge, setShowGuestPantryNudge] = useState(false);
  const [activePantryTab, setActivePantryTab] = useState(0);
  const [pantrySelected, setPantrySelected] = useState(new Set());
  const [pantryExtras, setPantryExtras] = useState([]);
  const [extraIngredientInput, setExtraIngredientInput] = useState('');
  const [pantryError, setPantryError] = useState('');

  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const animRef = useRef(null);
  const mealsRef = useRef([]);
  const isInitialHistoryMount = useRef(true);

  const toggleFilter = (f) =>
    setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const toggleCuisine = (c) =>
    setCuisine(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  useEffect(() => { mealsRef.current = meals; }, [meals]);

  // Reset meals when filters or cuisine change
  useEffect(() => {
    setMeals(prev => {
      if (prev.length > 0) { setSelectedMeal(null); setRecipe(''); }
      return [];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, JSON.stringify(cuisine)]);

  useEffect(() => {
    const update = () => setCanvasSize(Math.min(window.innerWidth - 48, 340));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Load history from correct source when auth state resolves
  useEffect(() => {
    if (session === undefined) return; // session still loading

    if (isSignedIn) {
      setSpinGate(false);
      fetch('/api/history')
        .then(r => r.json())
        .then(data => {
          if (data.history) {
            setHistory(data.history.map(h => ({
              id: h.id,
              meal: h.meal_name,
              date: new Date(h.created_at).toLocaleDateString(),
              ingredients: h.ingredients,
              recipe: h.recipe,
            })));
          }
        })
        .catch(() => {});

      // Migrate any existing localStorage history to Supabase silently
      try {
        const local = JSON.parse(localStorage.getItem('mealHistory') || '[]');
        if (local.length > 0) {
          Promise.all(
            local.map(h =>
              fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  meal_name: h.meal,
                  recipe: '',
                  ingredients: h.ingredients || '',
                  dietary_filters: [],
                  cuisine: null,
                }),
              })
            )
          )
            .then(() => localStorage.removeItem('mealHistory'))
            .catch(() => {});
        }
      } catch {}
    } else {
      // Guest: load from localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('mealHistory') || '[]');
        setHistory(stored);
      } catch {}
      isInitialHistoryMount.current = false;
    }
  }, [isSignedIn]);

  // Persist guest history to localStorage (skipped for logged-in users)
  useEffect(() => {
    if (isSignedIn || isInitialHistoryMount.current) return;
    localStorage.setItem('mealHistory', JSON.stringify(history));
  }, [history, isSignedIn]);

  useEffect(() => {
    if (meals.length > 0) drawWheel(canvasRef.current, meals, angleRef.current);
  }, [meals, canvasSize]);

  const suggestMeals = async () => {
    if (!ingredients.trim()) return;
    setLoadingSuggest(true);
    setMeals([]);
    setSelectedMeal(null);
    setRecipe('');
    setError('');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          filters,
          cuisine: isSignedIn ? cuisine : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get suggestions');
      setMeals(data.meals);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSuggest(false);
    }
  };

  const spin = async () => {
    if (spinning || meals.length === 0) return;

    if (!isSignedIn) {
      try {
        const res = await fetch('/api/spin-check', { method: 'POST' });
        const data = await res.json();
        if (!data.allowed) {
          setSpinGate(true);
          return;
        }
      } catch {
        // Network error: allow spin rather than blocking user
      }
    }

    setSpinning(true);
    setSelectedMeal(null);
    setRecipe('');
    velocityRef.current = Math.random() * 0.15 + 0.22;

    const animate = () => {
      angleRef.current += velocityRef.current;
      velocityRef.current *= 0.988;
      drawWheel(canvasRef.current, mealsRef.current, angleRef.current);
      if (velocityRef.current > 0.002) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const idx = getSelectedIndex(angleRef.current, mealsRef.current.length);
        setSelectedMeal(mealsRef.current[idx]);
        setSpinning(false);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const getRecipe = async () => {
    if (!selectedMeal) return;
    setLoadingRecipe(true);
    setRecipe('');
    setError('');
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal: selectedMeal,
          ingredients,
          filters,
          cuisine: isSignedIn ? cuisine : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get recipe');
      setRecipe(data.recipe);

      if (!isSignedIn) {
        // Update guest localStorage history
        setHistory(prev => {
          const entry = { meal: selectedMeal, date: new Date().toLocaleDateString(), ingredients };
          return [entry, ...prev.filter(h => h.meal !== selectedMeal)].slice(0, 10);
        });
      } else {
        // Refresh Supabase history after save (500ms to let the insert complete)
        setTimeout(() => {
          fetch('/api/history')
            .then(r => r.json())
            .then(data => {
              if (data.history) {
                setHistory(data.history.map(h => ({
                  id: h.id,
                  meal: h.meal_name,
                  date: new Date(h.created_at).toLocaleDateString(),
                  ingredients: h.ingredients,
                  recipe: h.recipe,
                })));
              }
            })
            .catch(() => {});
        }, 500);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingRecipe(false);
    }
  };

  const copyRecipe = () => {
    navigator.clipboard.writeText(`${selectedMeal}\n\n${recipe}`)
      .catch(() => setError('Copy failed — please copy the recipe manually.'));
  };

  const shareRecipe = async () => {
    const payload = btoa(encodeURIComponent(JSON.stringify({ meal: selectedMeal, recipe })));
    const url = `${window.location.origin}/r?d=${encodeURIComponent(payload)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('✓ Copied!');
    } catch {
      setShareLabel('⚠ Failed');
    }
    setTimeout(() => setShareLabel('🔗 Share'), 2000);
  };

  const downloadRecipe = () => {
    const blob = new Blob([`${selectedMeal}\n\n${recipe}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMeal.replace(/\s+/g, '-').toLowerCase()}-recipe.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openPantryModal = async () => {
    if (!isSignedIn) {
      setShowGuestPantryNudge(true);
      return;
    }
    setPantryExtras([]);
    setExtraIngredientInput('');
    setPantryError('');
    setActivePantryTab(null);
    setShowPantryModal(true);
    setPantrySelected(new Set());
    if (pantryLoaded) return;
    try {
      const res = await fetch('/api/pantry');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pantry lists');
      setPantryLists(data.lists || []);
    } catch (e) {
      setPantryError(e.message || 'Failed to load pantry lists');
    } finally {
      setPantryLoaded(true);
    }
  };

  const closePantryModal = () => {
    setShowPantryModal(false);
    setPantrySelected(new Set());
    setPantryExtras([]);
    setExtraIngredientInput('');
  };

  const togglePantryIngredient = (ing) => {
    setPantrySelected(prev => {
      const next = new Set(prev);
      if (next.has(ing)) next.delete(ing); else next.add(ing);
      return next;
    });
  };

  const addExtraIngredient = () => {
    const raw = extraIngredientInput.trim();
    if (!raw) return;
    const seen = new Set(pantryExtras.map(x => x.toLowerCase()));
    const toAdd = [];
    for (const piece of raw.split(',')) {
      const value = piece.trim();
      if (!value) continue;
      const lower = value.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      toAdd.push(value);
    }
    if (toAdd.length > 0) {
      setPantryExtras(prev => [...prev, ...toAdd]);
      setPantrySelected(prev => {
        const next = new Set(prev);
        toAdd.forEach(v => next.add(v));
        return next;
      });
    }
    setExtraIngredientInput('');
  };

  const removeExtraIngredient = (ing) => {
    setPantryExtras(prev => prev.filter(x => x !== ing));
    setPantrySelected(prev => {
      const next = new Set(prev);
      next.delete(ing);
      return next;
    });
  };

  const confirmPantrySelection = () => {
    const existing = ingredients.split(',').map(s => s.trim()).filter(Boolean);
    const existingLower = existing.map(s => s.toLowerCase());
    const toAdd = [...pantrySelected].filter(ing => !existingLower.includes(ing.toLowerCase()));
    setIngredients([...existing, ...toAdd].join(', '));
    closePantryModal();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1><span>🎰</span> AI Meal Decider</h1>
        <p>Tell AI what's in your fridge → spin the wheel → get a recipe</p>
      </div>

      {/* Step 1: Ingredients */}
      <div className={styles.card}>
        <span className={styles.label}>Step 1 — What's in your fridge?</span>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="e.g. chicken, rice, tomatoes, garlic..."
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && suggestMeals()}
          />
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={suggestMeals}
            disabled={loadingSuggest || !ingredients.trim()}
          >
            {loadingSuggest ? '...' : 'Suggest'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPantry}`}
            onClick={openPantryModal}
          >
            <FridgeIcon /> Load from Pantry{!isSignedIn && ' 🔒'}
          </button>
        </div>

        {/* Dietary filters — all users */}
        <div className={styles.filterRow}>
          {DIETARY_FILTERS.map(f => (
            <label
              key={f}
              className={`${styles.filterChip} ${filters.includes(f) ? styles.filterChipActive : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.includes(f)}
                onChange={() => toggleFilter(f)}
                style={{ display: 'none' }}
              />
              {f}
            </label>
          ))}
        </div>

        {/* Cuisine filter — logged-in users only */}
        {isSignedIn && (
          <div className={styles.cuisineSection}>
            <span className={styles.cuisineLabel}>Cuisine</span>
            <div className={styles.filterRow}>
              {CUISINE_FILTERS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.filterChip} ${styles.cuisineChip} ${cuisine.includes(c) ? styles.cuisineChipActive : ''}`}
                  onClick={() => toggleCuisine(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingSuggest && (
          <div className={styles.loading} style={{ marginTop: 12 }}>
            <span className={styles.spinner} /> AI is thinking of meals...
          </div>
        )}
      </div>

      {/* Step 2: Wheel */}
      {meals.length > 0 && (
        <div className={styles.card}>
          <span className={styles.label}>Step 2 — Spin the wheel!</span>
          <div className={styles.wheelWrap}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={canvasSize}
              height={canvasSize}
            />

            {spinGate ? (
              <div className={styles.spinGate}>
                <p className={styles.spinGateText}>
                  You've used your 3 free spins today.<br />
                  Sign up to spin unlimited.
                </p>
                <Link href="/register" className={`${styles.btn} ${styles.btnSignUpGate}`}>
                  Sign Up — It's Free
                </Link>
              </div>
            ) : (
              <button
                className={`${styles.btn} ${styles.btnSpin}`}
                onClick={spin}
                disabled={spinning}
              >
                {spinning ? 'Spinning...' : '🎲 SPIN'}
              </button>
            )}

            {selectedMeal && !spinning && !spinGate && (
              <p className={styles.spinHint}>Not feeling it? Spin again!</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Selected meal */}
      {selectedMeal && (
        <div className={styles.card}>
          <span className={styles.label}>Step 3 — The wheel chose...</span>
          <div className={styles.selectedBadge}>
            <div className={styles.subtext}>Tonight you're making</div>
            <div className={styles.mealName}>{selectedMeal}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className={`${styles.btn} ${styles.btnRecipe}`}
              onClick={getRecipe}
              disabled={loadingRecipe}
              style={{ width: '100%' }}
            >
              {loadingRecipe ? '...' : '📋 Get Recipe'}
            </button>
          </div>
          {loadingRecipe && (
            <div className={styles.loading} style={{ marginTop: 12 }}>
              <span className={styles.spinner} /> Generating your recipe...
            </div>
          )}
        </div>
      )}

      {/* Step 4: Recipe */}
      {recipe && (
        <div className={styles.card}>
          <div className={styles.recipeHeader}>
            <span className={styles.label}>Your Recipe</span>
            <button className={`${styles.btn} ${styles.btnShare}`} onClick={shareRecipe}>
              {shareLabel}
            </button>
          </div>
          <div className={styles.recipe}>{renderRecipe(recipe)}</div>
          <div className={styles.saveRow}>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={copyRecipe}>
              📋 Copy
            </button>
            <button className={`${styles.btn} ${styles.btnSave}`} onClick={downloadRecipe}>
              ⬇️ Download .txt
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: '#ff6b6b', fontSize: '0.9rem', textAlign: 'center' }}>
          ⚠️ {error}
        </div>
      )}

      {history.length > 0 && (
        <div className={styles.card}>
          <span className={styles.label}>Recent Meals</span>
          {history.map((h) => (
            <div
              key={h.id ?? h.meal}
              className={styles.historyItem}
              onClick={() => setExpandedHistoryId(expandedHistoryId === (h.id ?? h.meal) ? null : (h.id ?? h.meal))}
              style={{ cursor: h.recipe ? 'pointer' : 'default' }}
            >
              <div className={styles.historyItemTop}>
                <span className={styles.historyMeal}>{h.meal}</span>
                <span className={styles.historyMeta}>{h.date}</span>
              </div>
              {expandedHistoryId === (h.id ?? h.meal) && h.recipe && (
                <div className={styles.historyRecipe}>
                  {renderRecipe(h.recipe)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showPantryModal && (
        <div className={styles.modalOverlay} onClick={closePantryModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span><FridgeIcon size={20} /> Load from Pantry</span>
              <button type="button" className={styles.modalClose} onClick={closePantryModal}>×</button>
            </div>

            {pantryError && (
              <div style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: 8 }}>
                ⚠️ {pantryError}
              </div>
            )}

            {!pantryLoaded ? (
              <p className={styles.placeholder}>Loading…</p>
            ) : pantryError ? null : pantryLists.length === 0 ? (
              <div className={styles.modalBody}>
                <p className={styles.placeholder}>No pantry lists yet. Add them from your Profile.</p>
                <Link href="/profile" className={`${styles.btn} ${styles.btnPrimary}`} onClick={closePantryModal}>
                  Go to Profile →
                </Link>
              </div>
            ) : (
              <div className={styles.modalBody}>
                <div className={styles.pantryTabs}>
                  {pantryLists.map((list, i) => (
                    <button
                      key={list.id}
                      type="button"
                      className={`${styles.pantryTab} ${activePantryTab === i ? styles.pantryTabActive : ''}`}
                      onClick={() => {
                        setActivePantryTab(i);
                        setPantrySelected(prev => new Set([...prev, ...list.ingredients]));
                      }}
                    >
                      {list.name}
                    </button>
                  ))}
                </div>

                <div className={styles.filterRow}>
                  {activePantryTab === null ? (
                    <span className={styles.placeholder}>Select a pantry list above to choose its ingredients.</span>
                  ) : (pantryLists[activePantryTab]?.ingredients || []).length === 0 ? (
                    <span className={styles.placeholder}>No ingredients in this list yet.</span>
                  ) : (
                    pantryLists[activePantryTab].ingredients.map(ing => (
                      <button
                        key={ing}
                        type="button"
                        className={`${styles.filterChip} ${styles.cuisineChip} ${pantrySelected.has(ing) ? styles.filterChipActive : ''}`}
                        onClick={() => togglePantryIngredient(ing)}
                      >
                        {pantrySelected.has(ing) ? `✓ ${ing}` : ing}
                      </button>
                    ))
                  )}
                </div>

                {pantryExtras.length > 0 && (
                  <div className={styles.filterRow}>
                    {pantryExtras.map(ing => (
                      <span key={ing} className={`${styles.filterChip} ${styles.filterChipActive}`}>
                        ✓ {ing}
                        <button type="button" className={styles.chipRemove} onClick={() => removeExtraIngredient(ing)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className={styles.inputRow} style={{ marginTop: 12 }}>
                  <input
                    className={styles.input}
                    placeholder="Add extra ingredients (comma-separated)"
                    value={extraIngredientInput}
                    onChange={e => setExtraIngredientInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExtraIngredient()}
                    maxLength={200}
                  />
                  <button type="button" className={`${styles.btn} ${styles.btnSave}`} onClick={addExtraIngredient}>+</button>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={`${styles.btn} ${styles.btnSave}`} onClick={closePantryModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={confirmPantrySelection}
                    disabled={pantrySelected.size === 0}
                  >
                    Confirm — load {pantrySelected.size} ingredient{pantrySelected.size === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showGuestPantryNudge && (
        <div className={styles.modalOverlay} onClick={() => setShowGuestPantryNudge(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span><FridgeIcon size={20} /> Pantry</span>
              <button type="button" className={styles.modalClose} onClick={() => setShowGuestPantryNudge(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalTitle}>Save your ingredients to Pantry</p>
              <p className={styles.modalSubtitle}>
                Create up to 3 pantry lists and load them into Step 1 with one tap — sign up free to start.
              </p>
              <Link
                href="/register"
                className={`${styles.btn} ${styles.btnSignUpGate}`}
                style={{ width: '100%', textAlign: 'center', display: 'block', marginTop: 16, boxSizing: 'border-box' }}
              >
                Sign Up — It's Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './page.module.css';
import './globals.css';
import { renderRecipe } from '@/lib/renderRecipe';
import { track } from '@/lib/analytics';
import FridgeIcon from './components/FridgeIcon';
import UndoToast from './components/UndoToast';
import RecipeActions from './components/RecipeActions';
import { drawWheel, getSelectedIndex } from '@/lib/wheel';
import { MEAL_TIMES, CUISINE_FILTERS, defaultMealTime, mealIntro } from '@/lib/filters';
import useIsMobile from './components/mobile/useIsMobile';
import TabBar from './components/mobile/TabBar';
import DecideTab from './components/mobile/DecideTab';
import HistoryTab from './components/mobile/HistoryTab';
import PantryTab from './components/mobile/PantryTab';
import ProfileTab from './components/mobile/ProfileTab';
import GuestGate from './components/mobile/GuestGate';
import SpinOverlay from './components/mobile/SpinOverlay';
import shell from './components/mobile/shell.module.css';

// Shrink the photo on-device before upload: caps AI cost (~1568 image tokens max)
// and keeps mobile uploads fast.
async function photoToResizedBase64(file, maxEdge = 1568) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

const mapServerHistory = (rows) => rows.map(h => ({
  id: h.id,
  meal: h.meal_name,
  date: new Date(h.created_at).toLocaleDateString(),
  ingredients: h.ingredients,
  recipe: h.recipe,
  dietary_filters: h.dietary_filters,
  cuisine: h.cuisine,
  videoId: h.video_id,
  created_at: h.created_at,
}));

export default function MealDecider() {
  const { data: session } = useSession();
  const isSignedIn = !!session;

  const [ingredients, setIngredients] = useState('');
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipe, setRecipe] = useState('');
  const [recipeVideo, setRecipeVideo] = useState(null); // { videoId, videoTitle } | null
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [mealTime, setMealTime] = useState(null); // 'Breakfast' | 'Lunch' | 'Dinner' | null
  const [mealTimeAuto, setMealTimeAuto] = useState(true); // selection still the clock's pick?
  const [cuisine, setCuisine] = useState([]);
  const [canvasSize, setCanvasSize] = useState(340);
  const [history, setHistory] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [pendingUndo, setPendingUndo] = useState(null);
  const [spinGate, setSpinGate] = useState(false);
  // Initial guest quota shown before the first spin; must match
  // DAILY_LIMIT in app/api/spin-check/route.js.
  const [spinsLeft, setSpinsLeft] = useState(3);

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState('decide');
  const [spinOverlayOpen, setSpinOverlayOpen] = useState(false);

  const [pantryLists, setPantryLists] = useState([]);
  const [pantryLoaded, setPantryLoaded] = useState(false);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [showGuestPantryNudge, setShowGuestPantryNudge] = useState(false);
  const [activePantryTab, setActivePantryTab] = useState(0);
  const [pantrySelected, setPantrySelected] = useState(new Set());
  const [pantryExtras, setPantryExtras] = useState([]);
  const [extraIngredientInput, setExtraIngredientInput] = useState('');
  const [pantryError, setPantryError] = useState('');

  const [showScanModal, setShowScanModal] = useState(false);
  const [scanPhase, setScanPhase] = useState('choose'); // 'choose' | 'scanning' | 'review' | 'error'
  const [scanItems, setScanItems] = useState([]);
  const [scanExtraInput, setScanExtraInput] = useState('');
  const [scanError, setScanError] = useState('');
  const [showGuestScanNudge, setShowGuestScanNudge] = useState(false);

  const canvasRef = useRef(null);
  const scanFileRef = useRef(null);
  const scanCameraRef = useRef(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const animRef = useRef(null);
  const mealsRef = useRef([]);
  const isInitialHistoryMount = useRef(true);

  const selectMealTime = (m) => {
    setMealTime(prev => (prev === m ? null : m)); // tap active chip again = no preference
    setMealTimeAuto(false);
  };

  const MEAL_TIME_WORDS = { Breakfast: "it's morning", Lunch: "it's midday", Dinner: "it's evening" };
  const mealTimeHint = mealTime
    ? mealTimeAuto
      ? `✨ We picked ${mealTime} for you — ${MEAL_TIME_WORDS[mealTime]}. Tap another to change.`
      : `${mealTime} it is. The AI will suggest ${mealTime.toLowerCase()} meals.`
    : 'No preference — the AI will suggest any kind of meal.';

  const toggleCuisine = (c) =>
    setCuisine(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  useEffect(() => { mealsRef.current = meals; }, [meals]);

  // Smart default by the visitor's clock — set after mount so the statically
  // prerendered HTML (built with the server's clock) never mismatches.
  useEffect(() => { setMealTime(defaultMealTime()); }, []);

  // Reset meals when meal time or cuisine change
  useEffect(() => {
    setMeals(prev => {
      if (prev.length > 0) { setSelectedMeal(null); setRecipe(''); setRecipeVideo(null); }
      return [];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealTime, JSON.stringify(cuisine)]);

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
          if (data.history) setHistory(mapServerHistory(data.history));
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

  // Undo window: the toast disappears after 5s and the deletion becomes final
  useEffect(() => {
    if (!pendingUndo) return;
    const t = setTimeout(() => setPendingUndo(null), 5000);
    return () => clearTimeout(t);
  }, [pendingUndo]);

  useEffect(() => {
    if (meals.length > 0) drawWheel(canvasRef.current, meals, angleRef.current);
  }, [meals, canvasSize, spinOverlayOpen, isMobile]);

  const suggestMeals = async () => {
    if (!ingredients.trim()) return;
    setLoadingSuggest(true);
    setMeals([]);
    setSelectedMeal(null);
    setRecipe('');
    setRecipeVideo(null);
    setError('');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          mealTime: mealTime || undefined,
          cuisine: isSignedIn ? cuisine : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get suggestions');
      setMeals(data.meals);
      track('suggestions_received', { count: data.meals.length, signed_in: isSignedIn, meal_time: mealTime || 'none', meal_time_auto: mealTimeAuto });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSuggest(false);
    }
  };

  // Sticky CTA: one tap fetches suggestions (if needed) and opens the wheel.
  const handleMobileSpin = () => {
    // Clear a stale result so the overlay always opens on the wheel,
    // not on the previous recipe (which lives in History anyway).
    if (recipe) {
      setRecipe('');
      setRecipeVideo(null);
      setSelectedMeal(null);
    }
    setSpinOverlayOpen(true);
    if (meals.length === 0) suggestMeals();
  };

  // Pantry tab "Use in decider": merge a list's ingredients and jump to Decide.
  const usePantryList = (listIngredients) => {
    const existing = ingredients.split(',').map(s => s.trim()).filter(Boolean);
    const existingLower = existing.map(s => s.toLowerCase());
    const toAdd = listIngredients.filter(ing => !existingLower.includes(ing.toLowerCase()));
    setIngredients([...existing, ...toAdd].join(', '));
    setMobileTab('decide');
  };

  const spin = async () => {
    if (spinning || meals.length === 0) return;

    if (!isSignedIn) {
      try {
        const res = await fetch('/api/spin-check', { method: 'POST' });
        const data = await res.json();
        if (typeof data.spinsLeft === 'number') setSpinsLeft(data.spinsLeft);
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
    setRecipeVideo(null);
    track('spin', { signed_in: isSignedIn, meal_time: mealTime || 'none', meal_time_auto: mealTimeAuto });
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
    setRecipeVideo(null);
    setError('');
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal: selectedMeal,
          ingredients,
          cuisine: isSignedIn ? cuisine : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get recipe');
      setRecipe(data.recipe);
      setRecipeVideo(data.videoId ? { videoId: data.videoId, videoTitle: data.videoTitle } : null);
      track('recipe_opened', { meal: selectedMeal, signed_in: isSignedIn });

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
              if (data.history) setHistory(mapServerHistory(data.history));
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

  const deleteHistoryItem = (e, h, index) => {
    e.stopPropagation();
    setHistory(prev => prev.filter((_, i) => i !== index));
    if (expandedHistoryId === (h.id ?? h.meal)) setExpandedHistoryId(null);
    if (isSignedIn && h.id) {
      fetch(`/api/history/${h.id}`, { method: 'DELETE' }).catch(() => {});
    }
    setPendingUndo({ item: h, index, ts: Date.now() });
  };

  const undoHistoryDelete = () => {
    if (!pendingUndo) return;
    const { item, index } = pendingUndo;
    setPendingUndo(null);
    setHistory(prev => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, item);
      return next;
    });
    if (isSignedIn && item.id) {
      // Re-insert on the server with the original date, then refetch for fresh ids
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_name: item.meal,
          recipe: item.recipe || '',
          ingredients: item.ingredients || '',
          dietary_filters: item.dietary_filters || [],
          cuisine: item.cuisine || null,
          video_id: item.videoId || null,
          created_at: item.created_at,
        }),
      })
        .then(() => fetch('/api/history'))
        .then(r => r.json())
        .then(data => {
          if (data.history) setHistory(mapServerHistory(data.history));
        })
        .catch(() => {});
    }
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

  const openScan = () => {
    if (!isSignedIn) {
      setShowGuestScanNudge(true);
      return;
    }
    // Android's photo picker has no camera option, so we offer the choice ourselves
    setShowScanModal(true);
    setScanPhase('choose');
  };

  const handleScanPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setShowScanModal(true);
    setScanPhase('scanning');
    setScanExtraInput('');
    try {
      const image = await photoToResizedBase64(file);
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, media_type: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      if (!data.ingredients || data.ingredients.length === 0) {
        setScanError("We couldn't spot any food in that photo. Try a clearer, closer shot.");
        setScanPhase('error');
        return;
      }
      setScanItems(data.ingredients.map(name => ({ name, on: true })));
      setScanPhase('review');
      track('photo_scan_used', { ingredients_found: data.ingredients.length });
    } catch (err) {
      setScanError(err.message || 'Scan failed — please try again.');
      setScanPhase('error');
    }
  };

  const toggleScanItem = (i) => {
    setScanItems(prev => prev.map((it, idx) => (idx === i ? { ...it, on: !it.on } : it)));
  };

  const addScanExtra = () => {
    const raw = scanExtraInput.trim();
    if (!raw) return;
    setScanItems(prev => {
      const seen = new Set(prev.map(it => it.name.toLowerCase()));
      const next = [...prev];
      for (const piece of raw.split(',')) {
        const value = piece.trim();
        if (!value || seen.has(value.toLowerCase())) continue;
        seen.add(value.toLowerCase());
        next.push({ name: value, on: true });
      }
      return next;
    });
    setScanExtraInput('');
  };

  const confirmScan = () => {
    const selected = scanItems.filter(it => it.on).map(it => it.name);
    const existing = ingredients.split(',').map(s => s.trim()).filter(Boolean);
    const existingLower = existing.map(s => s.toLowerCase());
    const toAdd = selected.filter(s => !existingLower.includes(s.toLowerCase()));
    setIngredients([...existing, ...toAdd].join(', '));
    setShowScanModal(false);
    if (isMobile) setMobileTab('decide');
  };

  const confirmPantrySelection = () => {
    const existing = ingredients.split(',').map(s => s.trim()).filter(Boolean);
    const existingLower = existing.map(s => s.toLowerCase());
    const toAdd = [...pantrySelected].filter(ing => !existingLower.includes(ing.toLowerCase()));
    setIngredients([...existing, ...toAdd].join(', '));
    closePantryModal();
  };

  const mainContent = (
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
            className={`${styles.btn} ${styles.btnScan}`}
            onClick={openScan}
          >
            📸 Scan Fridge{!isSignedIn && ' 🔒'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPantry}`}
            onClick={openPantryModal}
          >
            <FridgeIcon /> Load from Pantry{!isSignedIn && ' 🔒'}
          </button>
        </div>

        {/* Meal time — all users; single-select with clock-based smart default */}
        <div className={styles.cuisineSection}>
          <span className={styles.cuisineLabel}>🍽️ What meal are we deciding?</span>
          <div className={styles.filterRow}>
            {MEAL_TIMES.map(m => (
              <button
                key={m.id}
                type="button"
                className={`${styles.filterChip} ${styles.cuisineChip} ${mealTime === m.id ? styles.cuisineChipActive : ''}`}
                onClick={() => selectMealTime(m.id)}
              >
                {m.emoji} {m.id}
                {mealTime === m.id && mealTimeAuto && <span className={styles.autoBadge}>AUTO</span>}
              </button>
            ))}
          </div>
          <p className={styles.mealTimeHint}>{mealTimeHint}</p>
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
            <div className={styles.subtext}>{mealIntro(mealTime)}</div>
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
            <RecipeActions meal={selectedMeal} recipe={recipe} videoId={recipeVideo?.videoId} videoTitle={recipeVideo?.videoTitle} />
          </div>
          <div className={styles.recipe}>{renderRecipe(recipe)}</div>
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
          {history.map((h, idx) => (
            <div
              key={h.id ?? h.meal}
              className={styles.historyItem}
              onClick={() => setExpandedHistoryId(expandedHistoryId === (h.id ?? h.meal) ? null : (h.id ?? h.meal))}
              style={{ cursor: h.recipe ? 'pointer' : 'default' }}
            >
              <div className={styles.historyItemTop}>
                <span className={styles.historyMeal}>{h.meal}</span>
                <span className={styles.historyMeta}>{h.date}</span>
                <button
                  type="button"
                  className={styles.historyDelete}
                  title="Delete"
                  aria-label={`Delete ${h.meal}`}
                  onClick={(e) => deleteHistoryItem(e, h, idx)}
                >
                  ✕
                </button>
              </div>
              {expandedHistoryId === (h.id ?? h.meal) && h.recipe && (
                <div className={styles.historyRecipe}>
                  {renderRecipe(h.recipe)}
                  <div style={{ marginTop: 12 }}>
                    <RecipeActions meal={h.meal} recipe={h.recipe} videoId={h.videoId} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className={shell.shell}>
          {mobileTab === 'decide' && (
            <DecideTab
              ingredients={ingredients}
              setIngredients={setIngredients}
              mealTime={mealTime}
              mealTimeAuto={mealTimeAuto}
              onMealTime={selectMealTime}
              mealTimeHint={mealTimeHint}
              cuisine={cuisine}
              toggleCuisine={toggleCuisine}
              isSignedIn={isSignedIn}
              loadingSuggest={loadingSuggest}
              error={error}
              onPantry={openPantryModal}
              onSpin={handleMobileSpin}
              spinsLeft={spinsLeft}
            />
          )}
          {mobileTab === 'history' && (
            <HistoryTab
              history={history}
              expandedId={expandedHistoryId}
              onToggle={(id) => setExpandedHistoryId(prev => (prev === id ? null : id))}
              onDelete={deleteHistoryItem}
              isSignedIn={isSignedIn}
            />
          )}
          {mobileTab === 'pantry' && <PantryTab isSignedIn={isSignedIn} onUse={usePantryList} />}
          {mobileTab === 'profile' && <ProfileTab isSignedIn={isSignedIn} onGoTab={setMobileTab} />}
          <TabBar active={mobileTab} onTab={setMobileTab} onScan={openScan} />
        </div>
      ) : (
        mainContent
      )}

      <SpinOverlay
        open={isMobile && spinOverlayOpen}
        onClose={() => setSpinOverlayOpen(false)}
        canvasRef={canvasRef}
        canvasSize={canvasSize}
        meals={meals}
        loadingSuggest={loadingSuggest}
        spinning={spinning}
        spinGate={spinGate}
        selectedMeal={selectedMeal}
        intro={mealIntro(mealTime)}
        recipe={recipe}
        videoId={recipeVideo?.videoId}
        videoTitle={recipeVideo?.videoTitle}
        loadingRecipe={loadingRecipe}
        error={error}
        onSpin={spin}
        onGetRecipe={getRecipe}
      />

      <input
        ref={scanFileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleScanPhoto}
      />
      <input
        ref={scanCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleScanPhoto}
      />

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
                    maxLength={250}
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

      {showScanModal && (
        <div className={styles.modalOverlay} onClick={() => scanPhase !== 'scanning' && setShowScanModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>📸 {scanPhase === 'review' ? "Here's what we found" : 'Scan your fridge'}</span>
              <button type="button" className={styles.modalClose} onClick={() => setShowScanModal(false)}>×</button>
            </div>

            {scanPhase === 'choose' && (
              <div className={styles.modalBody}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnScanConfirm}`}
                  style={{ marginTop: 0 }}
                  onClick={() => scanCameraRef.current?.click()}
                >
                  📷 Take a photo
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={() => scanFileRef.current?.click()}
                >
                  🖼️ Choose from gallery
                </button>
              </div>
            )}

            {scanPhase === 'scanning' && (
              <div className={styles.scanState}>
                <div className={styles.scanThumb}>🧊<div className={styles.scanBeam} /></div>
                <div className={styles.loading} style={{ justifyContent: 'center' }}>
                  <span className={styles.spinner} /> AI is reading your photo...
                </div>
              </div>
            )}

            {scanPhase === 'error' && (
              <div className={styles.modalBody}>
                <p className={styles.placeholder} style={{ textAlign: 'center', marginBottom: 12 }}>⚠️ {scanError}</p>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ width: '100%' }}
                  onClick={() => setScanPhase('choose')}
                >
                  📸 Try another photo
                </button>
              </div>
            )}

            {scanPhase === 'review' && (
              <div className={styles.modalBody}>
                <span className={styles.scanHint}>Tap anything that&rsquo;s wrong to remove it:</span>
                <div className={styles.filterRow}>
                  {scanItems.map((it, i) => (
                    <button
                      key={it.name}
                      type="button"
                      className={`${styles.scanChip} ${it.on ? '' : styles.scanChipOff}`}
                      onClick={() => toggleScanItem(i)}
                    >
                      {it.on ? `✓ ${it.name}` : it.name}
                    </button>
                  ))}
                </div>
                <div className={styles.inputRow} style={{ marginTop: 12 }}>
                  <input
                    className={styles.input}
                    placeholder="Add something we missed..."
                    value={scanExtraInput}
                    onChange={e => setScanExtraInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addScanExtra(); } }}
                  />
                  <button type="button" className={`${styles.btn} ${styles.btnSave}`} onClick={addScanExtra}>+</button>
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnScanConfirm}`}
                  onClick={confirmScan}
                  disabled={scanItems.every(it => !it.on)}
                >
                  {scanItems.filter(it => it.on).length > 0
                    ? `Use ${scanItems.filter(it => it.on).length} ingredient${scanItems.filter(it => it.on).length === 1 ? '' : 's'}`
                    : 'Nothing selected'}
                </button>
                <button type="button" className={styles.scanAgain} onClick={() => setScanPhase('choose')}>
                  📸 Scan another photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showGuestScanNudge && (
        <div className={styles.modalOverlay} onClick={() => setShowGuestScanNudge(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>📸 Fridge Scan</span>
              <button type="button" className={styles.modalClose} onClick={() => setShowGuestScanNudge(false)}>×</button>
            </div>
            <GuestGate
              icon="📸"
              title="Snap a photo, skip the typing"
              description="AI reads your fridge photo and fills in the ingredient list for you. Free, takes about 30 seconds."
            />
          </div>
        </div>
      )}

      {pendingUndo && (
        <UndoToast key={pendingUndo.ts} meal={pendingUndo.item.meal} onUndo={undoHistoryDelete} />
      )}
    </>
  );
}

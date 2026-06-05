'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import './globals.css';

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];

const DIETARY_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free'];

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

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pointer (right side, pointing left into wheel)
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

function renderRecipe(text) {
  return text.split('\n').map((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      return <div key={i} style={{ color: '#f7c948', fontWeight: 700, marginTop: 12, marginBottom: 4 }}>{line.replace(/^#+\s/, '')}</div>;
    }
    if (/^\*\*(.+)\*\*$/.test(line)) {
      return <div key={i} style={{ color: '#f7c948', fontWeight: 700, marginTop: 10, marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>;
    }
    if (/^[-•*]\s/.test(line)) {
      return <div key={i} style={{ paddingLeft: 12 }}>• {line.replace(/^[-•*]\s/, '')}</div>;
    }
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{line}</div>;
  });
}

export default function MealDecider() {
  const [ingredients, setIngredients] = useState('');
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipe, setRecipe] = useState('');
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState([]);
  const [canvasSize, setCanvasSize] = useState(340);
  const [history, setHistory] = useState([]);
  const [shareLabel, setShareLabel] = useState('🔗 Share');

  const toggleFilter = (f) =>
    setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const animRef = useRef(null);
  const mealsRef = useRef([]);
  const isInitialHistoryMount = useRef(true);

  useEffect(() => { mealsRef.current = meals; }, [meals]);

  useEffect(() => {
    setMeals(prev => {
      if (prev.length > 0) {
        setSelectedMeal(null);
        setRecipe('');
      }
      return [];
    });
  }, [filters]);

  useEffect(() => {
    const update = () => setCanvasSize(Math.min(window.innerWidth - 48, 340));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('mealHistory') || '[]');
      setHistory(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (isInitialHistoryMount.current) {
      isInitialHistoryMount.current = false;
      return;
    }
    localStorage.setItem('mealHistory', JSON.stringify(history));
  }, [history]);

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
        body: JSON.stringify({ ingredients, filters }),
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

  const saveToHistory = useCallback((meal, currentIngredients) => {
    setHistory(prev => {
      const entry = {
        meal,
        date: new Date().toLocaleDateString(),
        ingredients: currentIngredients,
      };
      return [entry, ...prev.filter(h => h.meal !== meal)].slice(0, 10);
    });
  }, []);

  const spin = () => {
    if (spinning || meals.length === 0) return;
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
        const winner = mealsRef.current[idx];
        setSelectedMeal(winner);
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
        body: JSON.stringify({ meal: selectedMeal, ingredients, filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get recipe');
      setRecipe(data.recipe);
      saveToHistory(selectedMeal, ingredients);
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
        </div>
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
            <button
              className={`${styles.btn} ${styles.btnSpin}`}
              onClick={spin}
              disabled={spinning}
            >
              {spinning ? 'Spinning...' : '🎲 SPIN'}
            </button>
            {selectedMeal && !spinning && (
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
          {history.map((h, i) => (
            <div key={h.meal} className={styles.historyItem}>
              <span className={styles.historyMeal}>{h.meal}</span>
              <span className={styles.historyMeta}>{h.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import GuestGate from './GuestGate';
import styles from './PantryTab.module.css';

const MAX_LISTS = 3;

export default function PantryTab({ isSignedIn, onUse }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [busyIds, setBusyIds] = useState(new Set());

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/pantry')
      .then(r => r.json())
      .then(data => {
        if (data.lists) setLists(data.lists);
        else setError(data.error || 'Failed to load pantry lists');
      })
      .catch(() => setError('Failed to load pantry lists'))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const markBusy = (id, busy) => setBusyIds(prev => {
    const next = new Set(prev);
    busy ? next.add(id) : next.delete(id);
    return next;
  });

  const createList = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create list');
      setLists(prev => [...prev, data.list]);
      setNewName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const renameList = async (id) => {
    const name = editingName.trim();
    setEditingId(null);
    const list = lists.find(l => l.id === id);
    if (!name || !list || name === list.name) return;
    setError('');
    try {
      const res = await fetch(`/api/pantry/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');
      setLists(prev => prev.map(l => (l.id === id ? data.list : l)));
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteList = async (list) => {
    setError('');
    const index = lists.findIndex(l => l.id === list.id);
    setLists(prev => prev.filter(l => l.id !== list.id));
    try {
      const res = await fetch(`/api/pantry/${list.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
    } catch (e) {
      setError(e.message);
      setLists(prev => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, list); // restore at original position
        return next;
      });
    }
  };

  const updateIngredients = async (list, ingredients) => {
    markBusy(list.id, true);
    setError('');
    try {
      const res = await fetch(`/api/pantry/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update list');
      setLists(prev => prev.map(l => (l.id === list.id ? data.list : l)));
    } catch (e) {
      setError(e.message);
    } finally {
      markBusy(list.id, false);
    }
  };

  const addIngredient = (list, raw) => {
    const seen = new Set(list.ingredients.map(x => x.toLowerCase()));
    const toAdd = [];
    for (const piece of raw.split(',')) {
      const value = piece.trim();
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      toAdd.push(value);
    }
    if (toAdd.length > 0) updateIngredients(list, [...list.ingredients, ...toAdd]);
  };

  if (!isSignedIn) {
    return (
      <div className={styles.wrap}>
        <header className={styles.head}><h1 className={styles.logo}>My Pantry</h1></header>
        <GuestGate
          icon="🧺"
          title="Your Pantry is waiting"
          description="Save ingredient lists and load them into the decider with one tap. Free, takes about 30 seconds."
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}><h1 className={styles.logo}>My Pantry</h1></header>

      {error && <p className={styles.error}>⚠️ {error}</p>}
      {loading && <p className={styles.empty}>Loading…</p>}

      {!loading && lists.map(list => (
        <section key={list.id} className={styles.card}>
          <div className={styles.cardHead}>
            {editingId === list.id ? (
              <input
                className={styles.nameInput}
                value={editingName}
                autoFocus
                maxLength={250}
                onChange={e => setEditingName(e.target.value)}
                onBlur={() => renameList(list.id)}
                onKeyDown={e => e.key === 'Enter' && renameList(list.id)}
              />
            ) : (
              <button
                type="button"
                className={styles.name}
                onClick={() => { setEditingId(list.id); setEditingName(list.name); }}
                title="Tap to rename"
              >
                {list.name}
              </button>
            )}
            <span className={styles.count}>{list.ingredients.length} items</span>
            <button type="button" className={styles.deleteList} onClick={() => deleteList(list)} aria-label={`Delete ${list.name}`}>🗑</button>
          </div>

          <div className={styles.chips}>
            {list.ingredients.map(ing => (
              <span key={ing} className={styles.ingChip}>
                {ing}
                <button
                  type="button"
                  disabled={busyIds.has(list.id)}
                  onClick={() => updateIngredients(list, list.ingredients.filter(i => i !== ing))}
                  aria-label={`Remove ${ing}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {list.ingredients.length === 0 && <span className={styles.emptyList}>No ingredients yet.</span>}
          </div>

          <input
            className={styles.addInput}
            placeholder="e.g. rice, tomato, pasta"
            enterKeyHint="done"
            disabled={busyIds.has(list.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                addIngredient(list, e.target.value);
                e.target.value = '';
              }
            }}
          />
          <p className={styles.addHint}>Separate multiple ingredients with commas</p>

          <button
            type="button"
            className={styles.useBtn}
            disabled={list.ingredients.length === 0}
            onClick={() => onUse(list.ingredients)}
          >
            🎡 Use in decider
          </button>
        </section>
      ))}

      {!loading && lists.length < MAX_LISTS && (
        <>
          <div className={styles.newRow}>
            <input
              className={styles.addInput}
              placeholder="List name (e.g. Fridge)"
              value={newName}
              maxLength={250}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList()}
            />
            <button type="button" className={styles.newBtn} onClick={createList} disabled={creating || !newName.trim()}>
              ＋ Create
            </button>
          </div>
          <p className={styles.newHint}>Type a name for your list here — not ingredients. You&rsquo;ll add those inside the list after creating it.</p>
        </>
      )}
      {!loading && <p className={styles.limit}>{lists.length} of {MAX_LISTS} lists used</p>}
    </div>
  );
}

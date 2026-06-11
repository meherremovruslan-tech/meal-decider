'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { renderRecipe } from '@/lib/renderRecipe';
import FridgeIcon from '../components/FridgeIcon';
import styles from './profile.module.css';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const [displayName, setDisplayName] = useState('');
  const [nameStatus, setNameStatus] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwStatus, setPwStatus] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [pantryLists, setPantryLists] = useState([]);
  const [pantryLoading, setPantryLoading] = useState(true);
  const [pantryError, setPantryError] = useState('');
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [addingIngredientFor, setAddingIngredientFor] = useState(null);
  const [newIngredientInputs, setNewIngredientInputs] = useState({});
  const [updatingListIds, setUpdatingListIds] = useState(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setDisplayName(data.display_name || '');
      });
    fetchHistory();
    fetchPantry();
  }, [status]);

  function fetchHistory() {
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { if (data.history) setHistory(data.history); });
  }

  function fetchPantry() {
    setPantryLoading(true);
    fetch('/api/pantry')
      .then(r => r.json())
      .then(data => {
        if (data.lists) setPantryLists(data.lists);
        else setPantryError(data.error || 'Failed to load pantry lists');
      })
      .catch(() => setPantryError('Failed to load pantry lists'))
      .finally(() => setPantryLoading(false));
  }

  async function createPantryList() {
    const name = newListName.trim();
    if (!name) return;
    setCreatingList(true);
    setPantryError('');
    const res = await fetch('/api/pantry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setCreatingList(false);
    if (res.ok) {
      setPantryLists(prev => [...prev, data.list]);
      setNewListName('');
      setShowNewListForm(false);
    } else {
      setPantryError(data.error);
    }
  }

  async function renamePantryList(id, name) {
    const trimmed = name.trim();
    setEditingListId(null);
    if (!trimmed) return;
    const res = await fetch(`/api/pantry/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (res.ok) {
      setPantryLists(prev => prev.map(l => l.id === id ? data.list : l));
    } else {
      setPantryError(data.error);
    }
  }

  async function deletePantryList(list) {
    if (!confirm(`Delete "${list.name}" and its ${list.ingredients.length} ingredients?`)) return;
    const res = await fetch(`/api/pantry/${list.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setPantryLists(prev => prev.filter(l => l.id !== list.id));
    } else {
      setPantryError(data.error);
    }
  }

  async function updatePantryIngredients(list, ingredients) {
    setUpdatingListIds(prev => new Set(prev).add(list.id));
    const res = await fetch(`/api/pantry/${list.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients }),
    });
    const data = await res.json();
    if (res.ok) {
      setPantryLists(prev => prev.map(l => l.id === list.id ? data.list : l));
    } else {
      setPantryError(data.error);
    }
    setUpdatingListIds(prev => {
      const next = new Set(prev);
      next.delete(list.id);
      return next;
    });
  }

  function removePantryIngredient(list, ingredient) {
    updatePantryIngredients(list, list.ingredients.filter(i => i !== ingredient));
  }

  function addPantryIngredient(list) {
    const raw = (newIngredientInputs[list.id] || '').trim();
    if (!raw) return;
    const seen = new Set(list.ingredients.map(i => i.toLowerCase()));
    const toAdd = [];
    for (const piece of raw.split(',')) {
      const value = piece.trim();
      if (!value) continue;
      const lower = value.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      toAdd.push(value);
    }
    if (toAdd.length === 0) {
      setPantryError('Already in this list');
      return;
    }
    setPantryError('');
    updatePantryIngredients(list, [...list.ingredients, ...toAdd]);
    setNewIngredientInputs(prev => ({ ...prev, [list.id]: '' }));
  }

  async function saveName() {
    setSavingName(true);
    setNameStatus('');
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    });
    const data = await res.json();
    setSavingName(false);
    setNameStatus(res.ok ? 'success:Saved!' : `error:${data.error}`);
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      setPwStatus('error:Passwords do not match.');
      return;
    }
    setSavingPw(true);
    setPwStatus('');
    const res = await fetch('/api/profile/change-password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    const data = await res.json();
    setSavingPw(false);
    if (res.ok) {
      setPwStatus('success:Password updated!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwStatus(`error:${data.error}`);
    }
  }

  if (status === 'loading' || !profile) {
    return <div className={styles.page}><div style={{ color: '#555', marginTop: 40 }}>Loading...</div></div>;
  }

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const nameMsg = nameStatus.replace(/^(success|error):/, '');
  const nameMsgType = nameStatus.startsWith('success') ? styles.msgSuccess : styles.msgError;
  const pwMsg = pwStatus.replace(/^(success|error):/, '');
  const pwMsgType = pwStatus.startsWith('success') ? styles.msgSuccess : styles.msgError;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <Link href="/" className={styles.backBtn}>← Back</Link>

        {/* Info card */}
        <div className={styles.card}>
          <span className={styles.sectionLabel}>Profile</span>
          <div className={styles.infoRow}>
            <div className={styles.avatarLarge}>
              {session.user.avatar_emoji || '🍳'}
            </div>
            <div className={styles.infoDetails}>
              <div className={styles.displayName}>
                {profile.display_name || profile.email.split('@')[0]}
              </div>
              <div className={styles.infoEmail}>{profile.email}</div>
              <span className={styles.infoBadge}>
                {profile.provider === 'google' ? 'Google account' : 'Email account'}
              </span>
            </div>
          </div>
          {joinedDate && (
            <div className={styles.infoMeta}>Member since {joinedDate}</div>
          )}
        </div>

        {/* Settings card */}
        <div className={styles.card}>
          <span className={styles.sectionLabel}>Settings</span>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Display name</label>
            <input
              className={styles.input}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>
          <button className={styles.btn} onClick={saveName} disabled={savingName}>
            {savingName ? 'Saving…' : 'Save name'}
          </button>
          {nameStatus && <div className={nameMsgType}>{nameMsg}</div>}

          {profile.provider === 'email' && (
            <>
              <hr className={styles.divider} />
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Current password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>New password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Confirm new password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <button className={styles.btn} onClick={changePassword} disabled={savingPw}>
                {savingPw ? 'Saving…' : 'Change password'}
              </button>
              {pwStatus && <div className={pwMsgType}>{pwMsg}</div>}
            </>
          )}
        </div>

        {/* Pantry lists card */}
        <div className={styles.card}>
          <div className={styles.pantryHeader}>
            <span className={styles.sectionLabel} style={{ marginBottom: 0 }}><FridgeIcon size={16} /> Pantry lists</span>
            {pantryLists.length < 3 && !showNewListForm && (
              <button className={styles.btnSmall} onClick={() => setShowNewListForm(true)}>
                + New list
              </button>
            )}
          </div>

          {pantryError && <div className={styles.msgError}>{pantryError}</div>}

          {showNewListForm && (
            <div className={styles.pantryNewListForm}>
              <input
                className={styles.input}
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createPantryList()}
                placeholder="List name (e.g. Fridge)"
                maxLength={200}
                autoFocus
              />
              <button className={styles.btnSmall} onClick={createPantryList} disabled={creatingList || !newListName.trim()}>
                {creatingList ? '...' : 'Create'}
              </button>
              <button className={styles.btnGhost} onClick={() => { setShowNewListForm(false); setNewListName(''); }}>
                Cancel
              </button>
            </div>
          )}

          {pantryLoading && <div className={styles.emptyState}>Loading…</div>}

          {!pantryLoading && pantryLists.length === 0 && (
            <div className={styles.emptyState}>No pantry lists yet</div>
          )}

          {pantryLists.map(list => (
            <div key={list.id} className={styles.pantryListCard}>
              <div className={styles.pantryListHeader}>
                {editingListId === list.id ? (
                  <input
                    className={styles.input}
                    value={editingListName}
                    onChange={e => setEditingListName(e.target.value)}
                    onBlur={() => renamePantryList(list.id, editingListName)}
                    onKeyDown={e => e.key === 'Enter' && renamePantryList(list.id, editingListName)}
                    maxLength={200}
                    autoFocus
                  />
                ) : (
                  <span className={styles.pantryListName}>
                    {list.name}
                    <span className={styles.countBadge}>{list.ingredients.length}</span>
                  </span>
                )}
                <div className={styles.pantryListActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => { setEditingListId(list.id); setEditingListName(list.name); }}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button className={styles.iconBtn} onClick={() => deletePantryList(list)} title="Delete">
                    🗑️
                  </button>
                </div>
              </div>

              <div className={styles.pantryChips}>
                {list.ingredients.length === 0 && (
                  <span className={styles.pantryChipsEmpty}>No ingredients yet</span>
                )}
                {list.ingredients.map(ing => (
                  <span key={ing} className={styles.pantryChip}>
                    {ing}
                    <button className={styles.chipRemove} onClick={() => removePantryIngredient(list, ing)} disabled={updatingListIds.has(list.id)}>×</button>
                  </span>
                ))}
              </div>

              {addingIngredientFor === list.id ? (
                <>
                  <div className={styles.pantryAddRow}>
                    <input
                      className={styles.input}
                      value={newIngredientInputs[list.id] || ''}
                      onChange={e => setNewIngredientInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addPantryIngredient(list)}
                      placeholder="e.g. rice, tomato, pasta"
                      maxLength={200}
                      autoFocus
                    />
                    <button className={styles.btnSmall} onClick={() => addPantryIngredient(list)} disabled={updatingListIds.has(list.id)}>Add</button>
                    <button className={styles.btnGhost} onClick={() => setAddingIngredientFor(null)}>Done</button>
                  </div>
                  <p className={styles.pantryAddHint}>Separate multiple ingredients with commas</p>
                </>
              ) : (
                <button className={styles.btnGhost} style={{ marginTop: 10 }} onClick={() => setAddingIngredientFor(list.id)}>
                  + Add ingredient
                </button>
              )}
            </div>
          ))}

          {pantryLists.length >= 3 && (
            <div className={styles.pantryMaxNote}>Maximum 3 lists reached</div>
          )}
        </div>

        {/* History card */}
        <div className={styles.card}>
          <span className={styles.sectionLabel}>
            Meal History
            {history.length > 0 && (
              <span className={styles.countBadge}>{history.length}</span>
            )}
          </span>
          {history.length === 0 && (
            <div className={styles.emptyState}>No meals yet — go spin the wheel!</div>
          )}
          {history.map(h => (
            <div
              key={h.id}
              className={styles.historyItem}
              onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
            >
              <div className={styles.historyTop}>
                <span className={styles.historyMeal}>{h.meal_name}</span>
                <span className={styles.historyDate}>
                  {new Date(h.created_at).toLocaleDateString()}
                </span>
              </div>
              {expandedId === h.id && h.recipe && (
                <div className={styles.historyRecipe}>
                  {renderRecipe(h.recipe)}
                </div>
              )}
              {expandedId === h.id && !h.recipe && (
                <div className={styles.historyRecipe} style={{ color: '#555' }}>
                  No recipe saved for this meal.
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

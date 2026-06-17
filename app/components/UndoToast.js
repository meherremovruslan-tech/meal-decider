'use client';
import styles from './UndoToast.module.css';

// Render with a unique `key` per deletion so the countdown bar restarts.
export default function UndoToast({ meal, onUndo }) {
  return (
    <div className={styles.toast}>
      <span>Deleted &ldquo;{meal}&rdquo;</span>
      <button type="button" className={styles.undoBtn} onClick={onUndo}>
        Undo
      </button>
      <div className={styles.bar} />
    </div>
  );
}

'use client';
import styles from './VideoModal.module.css';

export default function VideoModal({ videoId, title, onClose }) {
  if (!videoId) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{title || 'Recipe Video'}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.frameWrap}>
          <iframe
            className={styles.frame}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title || 'Recipe video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

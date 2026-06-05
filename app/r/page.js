'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './page.module.css';
import '../globals.css';

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

function SharedRecipe() {
  const params = useSearchParams();
  const d = params.get('d');

  let meal = null, recipe = null, error = false;

  try {
    if (!d) throw new Error();
    const decoded = JSON.parse(decodeURIComponent(atob(d)));
    meal = decoded.meal;
    recipe = decoded.recipe;
    if (!meal || !recipe) throw new Error();
  } catch {
    error = true;
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoWrap}>
        <svg width="100%" viewBox="200 55 280 320" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(340,175)">
            <path d="M0,0 L0,-100 A100,100 0 0,1 86.6,-50 Z" fill="#FF6B35" opacity="0.92"/>
            <path d="M0,0 L86.6,-50 A100,100 0 0,1 86.6,50 Z" fill="#F7C948" opacity="0.92"/>
            <path d="M0,0 L86.6,50 A100,100 0 0,1 0,100 Z" fill="#4CAF82" opacity="0.92"/>
            <path d="M0,0 L0,100 A100,100 0 0,1 -86.6,50 Z" fill="#5B9BD5" opacity="0.92"/>
            <path d="M0,0 L-86.6,50 A100,100 0 0,1 -86.6,-50 Z" fill="#C65DB1" opacity="0.92"/>
            <path d="M0,0 L-86.6,-50 A100,100 0 0,1 0,-100 Z" fill="#FF8C5A" opacity="0.92"/>
            <circle cx="0" cy="0" r="100" fill="none" stroke="white" strokeWidth="2.5"/>
            <circle cx="0" cy="0" r="40" fill="white" stroke="#eee" strokeWidth="1"/>
            <g transform="rotate(-15)">
              <line x1="-10" y1="28" x2="-10" y2="-10" stroke="#444" strokeWidth="3" strokeLinecap="round"/>
              <line x1="-16" y1="-10" x2="-16" y2="-28" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="-10" y1="-10" x2="-10" y2="-28" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="-4" y1="-10" x2="-4" y2="-28" stroke="#444" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M-16,-10 Q-10,-4 -4,-10" stroke="#444" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </g>
            <g transform="rotate(15)">
              <rect x="7" y="8" width="6" height="20" rx="3" fill="#444"/>
              <rect x="6" y="4" width="8" height="5" rx="1" fill="#555"/>
              <path d="M8,4 L8,-26 Q18,-20 12,4 Z" fill="#444"/>
            </g>
            <polygon points="0,-92 -9,-108 9,-108" fill="#2D2D2D"/>
          </g>
          <text x="340" y="318" textAnchor="middle" fontSize="44" fill="#faf9f5" fontFamily="-apple-system, sans-serif" fontWeight="500">meal decider</text>
          <text x="340" y="350" textAnchor="middle" fill="#c2c0b6" fontSize="24" fontFamily="-apple-system, sans-serif">spin. cook. eat.</text>
        </svg>
      </div>

      <div className={styles.sharedBy}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        A recipe was shared with you
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Your Recipe</span>
        {error ? (
          <p className={styles.errorText}>This recipe link is invalid or expired.</p>
        ) : (
          <>
            <div className={styles.mealName}>{meal}</div>
            <div className={styles.recipe}>{renderRecipe(recipe)}</div>
          </>
        )}
      </div>

      <div className={styles.ctaWrap}>
        <a href="/" className={styles.ctaBtn}>🎰 Decide your own meal →</a>
        <p className={styles.ctaSub}>Enter what's in your fridge and let the wheel decide</p>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <SharedRecipe />
    </Suspense>
  );
}

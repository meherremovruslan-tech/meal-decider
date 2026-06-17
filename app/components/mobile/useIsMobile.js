'use client';
import { useState, useEffect } from 'react';

// Spec: < 768px viewport = mobile shell. No user-agent sniffing.
// Returns false on first render (SSR-safe — brief desktop-first paint per spec),
// then tracks live matchMedia changes so window resize switches layouts.
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return; // ancient browser: CSS-only fallback
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}

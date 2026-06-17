'use client';
import { useRef, useState } from 'react';
import { renderRecipe, stripTitle } from '@/lib/renderRecipe';
import styles from './RecipeActions.module.css';
import { APP_NAME } from '@/lib/brand';
import { track } from '@/lib/analytics';

// Share / Copy / Save-as-PDF buttons for a recipe. Used by the main recipe
// card and by expanded history items on both the home and profile pages.
export default function RecipeActions({ meal, recipe }) {
  const [shareLabel, setShareLabel] = useState('🔗 Share');
  const [copyLabel, setCopyLabel] = useState('📋 Copy');
  const [saveLabel, setSaveLabel] = useState('⬇️ Save');
  const [saving, setSaving] = useState(false);
  const pdfRef = useRef(null);

  const share = async (e) => {
    e.stopPropagation();
    const payload = btoa(encodeURIComponent(JSON.stringify({ meal, recipe })));
    const url = `${window.location.origin}/r?d=${encodeURIComponent(payload)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('✓ Copied!');
      track('recipe_shared', { meal });
    } catch {
      setShareLabel('⚠ Failed');
    }
    setTimeout(() => setShareLabel('🔗 Share'), 2000);
  };

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${meal}\n\n${stripTitle(recipe, meal)}`);
      setCopyLabel('✓ Copied!');
      track('recipe_copied', { meal });
    } catch {
      setCopyLabel('⚠ Failed');
    }
    setTimeout(() => setCopyLabel('📋 Copy'), 2000);
  };

  const save = async (e) => {
    e.stopPropagation();
    if (!pdfRef.current || saving) return;
    setSaving(true);
    setSaveLabel('...');
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#0f0f1a',
      });
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const imgW = pageW - margin * 2;
      const pxPerPt = canvas.width / imgW;
      const maxSliceH = Math.floor((pageH - margin * 2) * pxPerPt);

      // A page may only break on a row of pure card background, so lines of
      // text are never cut in half. Card bg is #16162a; skip the side borders.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const inset = Math.floor(canvas.width * 0.06);
      const isBlankRow = (y) => {
        const row = ctx.getImageData(inset, y, canvas.width - inset * 2, 1).data;
        for (let i = 0; i < row.length; i += 4) {
          if (
            Math.abs(row[i] - 22) > 14 ||
            Math.abs(row[i + 1] - 22) > 14 ||
            Math.abs(row[i + 2] - 42) > 16
          ) return false;
        }
        return true;
      };

      let sliceStart = 0;
      let page = 0;
      while (sliceStart < canvas.height) {
        let sliceEnd = Math.min(sliceStart + maxSliceH, canvas.height);
        if (sliceEnd < canvas.height) {
          let y = sliceEnd;
          const scanLimit = sliceStart + Math.floor(maxSliceH / 2);
          while (y > scanLimit && !isBlankRow(y)) y -= 1;
          if (y > scanLimit) sliceEnd = y;
        }
        const sliceH = sliceEnd - sliceStart;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceH;
        pageCanvas
          .getContext('2d')
          .drawImage(canvas, 0, sliceStart, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        pdf.setFillColor(15, 15, 26);
        pdf.rect(0, 0, pageW, pageH, 'F');
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, sliceH / pxPerPt);
        sliceStart = sliceEnd;
        page += 1;
      }
      pdf.save(`${meal.replace(/\s+/g, '-').toLowerCase()}-recipe.pdf`);
      setSaveLabel('⬇️ Save');
      track('pdf_saved', { meal });
    } catch {
      setSaveLabel('⚠ Failed');
      setTimeout(() => setSaveLabel('⬇️ Save'), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.row} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={`${styles.btn} ${styles.share}`} onClick={share}>
          {shareLabel}
        </button>
        <button type="button" className={styles.btn} onClick={copy}>
          {copyLabel}
        </button>
        <button type="button" className={styles.btn} onClick={save} disabled={saving}>
          {saveLabel}
        </button>
      </div>
      {/* Off-screen copy of the recipe card captured for the PDF download */}
      <div
        ref={pdfRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: 640,
          background: '#16162a',
          border: '1px solid #2a2a4a',
          borderRadius: 16,
          padding: 28,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8888bb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          {APP_NAME} — Your Recipe
        </div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f7c948', marginBottom: 14 }}>
          {meal}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.92rem', color: '#ccc' }}>
          {renderRecipe(stripTitle(recipe, meal))}
        </div>
      </div>
    </>
  );
}

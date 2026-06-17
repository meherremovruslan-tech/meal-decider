import React from 'react';

// Render **bold** segments inside a line.
function renderInline(line) {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return line;
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export function renderRecipe(text) {
  return text.split('\n').map((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      return <div key={i} style={{ color: '#f7c948', fontWeight: 700, marginTop: 12, marginBottom: 4 }}>{line.replace(/^#+\s/, '').replace(/\*\*/g, '')}</div>;
    }
    if (/^\*\*(.+)\*\*$/.test(line)) {
      return <div key={i} style={{ color: '#f7c948', fontWeight: 700, marginTop: 10, marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>;
    }
    if (/^[-•*]\s/.test(line)) {
      return <div key={i} style={{ paddingLeft: 12 }}>• {renderInline(line.replace(/^[-•*]\s/, ''))}</div>;
    }
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{renderInline(line)}</div>;
  });
}

// Recipes usually begin with the meal name as a title line. Strip it when the
// surrounding UI already shows the name, so it doesn't appear twice.
export function stripTitle(text, meal) {
  if (!text || !meal) return text;
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i >= lines.length) return text;
  const normalize = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const candidate = lines[i].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
  if (normalize(candidate) !== normalize(meal)) return text;
  lines.splice(i, 1);
  while (i < lines.length && lines[i].trim() === '') lines.splice(i, 1);
  return lines.join('\n');
}

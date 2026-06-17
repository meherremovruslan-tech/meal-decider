// Canvas wheel rendering + selection math.
// Shared by the desktop page (app/page.js) and mobile SpinOverlay.
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F'];

export function drawWheel(canvas, meals, angle) {
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

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

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

export function getSelectedIndex(angle, n) {
  const slice = (2 * Math.PI) / n;
  const norm = ((-angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(norm / slice) % n;
}

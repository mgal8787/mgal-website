const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let w, h, horizonY;
let letters = [];
let fontSize;

const LETTERS = ['M', 'G', 'A', 'L'];
const ACCENT = [200, 122, 60];

function layoutLetters() {
  fontSize = Math.max(60, Math.min(170, Math.min(w, h) * 0.22));
  const font = `800 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font;

  const spacing = fontSize * 0.1;
  const widths = LETTERS.map(ch => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (LETTERS.length - 1);

  let x = w / 2 - totalWidth / 2;
  const y = h * 0.45;

  letters = LETTERS.map((ch, i) => {
    const tx = x + widths[i] / 2;
    x += widths[i] + spacing;
    return { ch, font, targetX: tx, targetY: y };
  });
}

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  horizonY = h / 2;
  layoutLetters();
}
window.addEventListener('resize', resize);
resize();

const VLINES = 28;
const HLINES = 22;
const SPEED = 0.12;

let t = 0;

function drawHalf(flip) {
  ctx.save();
  if (flip) {
    ctx.translate(0, h);
    ctx.scale(1, -1);
  }

  const localHorizon = flip ? h - horizonY : horizonY;
  const floorH = h - localHorizon;

  for (let i = 0; i <= VLINES; i++) {
    const frac = i / VLINES;
    const bottomX = frac * w * 1.6 - w * 0.3;
    const dist = Math.abs(frac - 0.5) * 2;
    const alpha = 0.55 * (1 - dist * 0.7);

    ctx.strokeStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${Math.max(alpha, 0.05)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, localHorizon);
    ctx.lineTo(bottomX, h);
    ctx.stroke();
  }

  for (let i = 0; i < HLINES; i++) {
    const phase = ((i / HLINES) + t) % 1;
    const easeDist = Math.pow(phase, 2.2);
    const y = localHorizon + easeDist * floorH;
    const alpha = 0.5 * (1 - phase) + 0.05;

    ctx.strokeStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGrid() {
  const glowPulse = 0.12 + Math.sin(t * Math.PI * 2 * 0.15) * 0.04;
  const grad = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, Math.max(w, h) * 0.5);
  grad.addColorStop(0, `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${glowPulse})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawHalf(false);
  drawHalf(true);
}

// --- Letter fly-in sequence ---
const FLY_DURATION = 900;
const STAGGER = 650;
const HOLD_DURATION = 2500;
const FADE_DURATION = 900;
const PAUSE_DURATION = 800;

const letterStart = LETTERS.map((_, i) => i * STAGGER);
const letterEnd = letterStart.map(s => s + FLY_DURATION);
const holdStart = letterEnd[letterEnd.length - 1];
const holdEnd = holdStart + HOLD_DURATION;
const fadeEnd = holdEnd + FADE_DURATION;
const CYCLE = fadeEnd + PAUSE_DURATION;

let cycleStart = null;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function drawLetters(now) {
  if (cycleStart === null) cycleStart = now;
  let tc = (now - cycleStart) % CYCLE;

  let globalFade = 1;
  if (tc > holdEnd) {
    globalFade = 1 - Math.min(1, (tc - holdEnd) / FADE_DURATION);
  }
  if (tc > fadeEnd) return;

  letters.forEach((L, i) => {
    const start = letterStart[i];
    const end = letterEnd[i];
    if (tc < start) return;

    const progress = Math.min(1, (tc - start) / FLY_DURATION);
    const eased = easeInOutCubic(progress);

    const x = (w / 2) + (L.targetX - w / 2) * eased;
    const y = horizonY + (L.targetY - horizonY) * eased;
    const scale = 0.04 + (1 - 0.04) * eased;
    const opacity = Math.min(1, progress / 0.25) * globalFade;

    if (opacity <= 0) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.font = L.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    ctx.shadowColor = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${opacity})`;
    ctx.shadowBlur = 40;
    ctx.fillText(L.ch, 0, 0);
    ctx.shadowBlur = 70;
    ctx.fillText(L.ch, 0, 0);
    ctx.restore();
  });
}

function frame(now) {
  ctx.clearRect(0, 0, w, h);
  drawGrid();
  drawLetters(now || 0);

  t += SPEED / 60;
  if (t > 1) t -= 1;

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

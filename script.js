const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let w, h, horizonY;
let letters = [];
let fontSize;
let ready = false;

const LETTERS = ['M', 'G', 'A', 'L'];
const ACCENT = [214, 24, 38];     // blood red glow
const CORE = [255, 232, 224];     // hot white-pink core
const GLITCH_A = [255, 70, 90];   // red channel split
const GLITCH_B = [80, 220, 255];  // cyan channel split
const FONT_FAMILY = '"Orbitron", "Helvetica Neue", Arial, sans-serif';

function buildParticles(ch, font, size) {
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  octx.font = font;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillStyle = '#fff';
  octx.fillText(ch, size / 2, size / 2);

  const img = octx.getImageData(0, 0, size, size).data;
  const step = Math.max(4, Math.round(size * 0.028));
  const particles = [];

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const alpha = img[(y * size + x) * 4 + 3];
      if (alpha > 120) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4;
        const speed = 70 + Math.random() * 180 + dist * 0.4;
        particles.push({
          dx, dy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          sz: step * (0.55 + Math.random() * 0.5),
          delay: Math.random() * 0.25,
          spin: (Math.random() - 0.5) * 8,
          tint: Math.random(),
        });
      }
    }
  }
  return particles;
}

function layoutLetters() {
  fontSize = Math.max(60, Math.min(170, Math.min(w, h) * 0.22));
  const font = `900 ${fontSize}px ${FONT_FAMILY}`;
  ctx.font = font;

  const spacing = fontSize * 0.14;
  const widths = LETTERS.map(ch => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (LETTERS.length - 1);

  let x = w / 2 - totalWidth / 2;
  const y = h * 0.45;
  const sampleSize = Math.round(fontSize * 1.5);

  letters = LETTERS.map((ch, i) => {
    const tx = x + widths[i] / 2;
    x += widths[i] + spacing;
    return {
      ch,
      font,
      targetX: tx,
      targetY: y,
      particles: buildParticles(ch, font, sampleSize),
    };
  });
}

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  horizonY = h / 2;
  if (ready) layoutLetters();
}
window.addEventListener('resize', resize);

const VLINES = 24;
const HLINES = 18;
const SPEED = 0.12;
let t = 0;

function strokeLED(x1, y1, x2, y2, alpha) {
  if (alpha <= 0.01) return;
  ctx.lineCap = 'round';

  ctx.shadowBlur = 16;
  ctx.shadowColor = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${Math.min(1, alpha * 1.4)})`;
  ctx.strokeStyle = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${alpha * 0.9})`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${Math.min(1, alpha * 1.1)})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

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
    const alpha = 0.6 * (1 - dist * 0.75);
    strokeLED(w / 2, localHorizon, bottomX, h, Math.max(alpha, 0.04));
  }

  for (let i = 0; i < HLINES; i++) {
    const phase = ((i / HLINES) + t) % 1;
    const easeDist = Math.pow(phase, 2.2);
    const y = localHorizon + easeDist * floorH;
    const alpha = 0.6 * (1 - phase) + 0.04;
    strokeLED(0, y, w, y, alpha);
  }

  ctx.restore();
}

function drawGrid() {
  const glowPulse = 0.14 + Math.sin(t * Math.PI * 2 * 0.15) * 0.05;
  const grad = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, Math.max(w, h) * 0.5);
  grad.addColorStop(0, `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${glowPulse})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawHalf(false);
  drawHalf(true);
}

// --- Letter fly-in + shatter sequence ---
const FLY_DURATION = 900;
const STAGGER = 650;
const HOLD_DURATION = 2200;
const SHATTER_DURATION = 1100;
const PAUSE_DURATION = 900;
const GLITCH_WINDOW = 260; // ms after landing where the glitch snap plays

const letterStart = LETTERS.map((_, i) => i * STAGGER);
const letterEnd = letterStart.map(s => s + FLY_DURATION);
const holdStart = letterEnd[letterEnd.length - 1];
const holdEnd = holdStart + HOLD_DURATION;
const shatterEnd = holdEnd + SHATTER_DURATION;
const CYCLE = shatterEnd + PAUSE_DURATION;

let cycleStart = null;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function drawLetterGlyph(L, x, y, scale, opacity, offX, offY, color) {
  ctx.save();
  ctx.translate(x + offX, y + offY);
  ctx.scale(scale, scale);
  ctx.font = L.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${opacity})`;
  ctx.fillText(L.ch, 0, 0);
  ctx.restore();
}

function drawSolidLetter(L, x, y, scale, opacity, sinceLand) {
  ctx.save();
  ctx.shadowColor = `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${opacity})`;
  ctx.shadowBlur = 55;
  drawLetterGlyph(L, x, y, scale, opacity * 0.6, 0, 0, ACCENT);
  ctx.shadowBlur = 0;

  if (sinceLand !== null && sinceLand < GLITCH_WINDOW) {
    const gp = 1 - sinceLand / GLITCH_WINDOW;
    const jitter = gp * 10 * (Math.random() - 0.5);
    const spread = gp * 9;
    drawLetterGlyph(L, x, y, scale, opacity * gp * 0.85, -spread, jitter * 0.3, GLITCH_B);
    drawLetterGlyph(L, x, y, scale, opacity * gp * 0.85, spread, -jitter * 0.3, GLITCH_A);
  }

  drawLetterGlyph(L, x, y, scale, opacity, 0, 0, CORE);
  ctx.restore();
}

function drawShatter(L, x, y, progress) {
  ctx.save();
  L.particles.forEach(p => {
    const local = Math.min(1, Math.max(0, (progress - p.delay * 0.4) / (1 - p.delay * 0.4)));
    const color = p.tint < 0.15 ? GLITCH_A : p.tint < 0.3 ? GLITCH_B : CORE;

    if (local <= 0) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(x + p.dx - p.sz / 2, y + p.dy - p.sz / 2, p.sz, p.sz);
      return;
    }
    const travel = local;
    const px = x + p.dx + p.vx * travel;
    const py = y + p.dy + p.vy * travel + 90 * travel * travel;
    const sz = p.sz * (1 - 0.5 * travel);
    const alpha = 1 - travel;
    if (alpha <= 0 || sz <= 0) return;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.spin * travel);
    ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  });
  ctx.restore();
}

function drawLetters(now) {
  if (cycleStart === null) cycleStart = now;
  const tc = (now - cycleStart) % CYCLE;
  if (tc > shatterEnd) return;

  letters.forEach((L, i) => {
    const start = letterStart[i];
    const end = letterEnd[i];
    if (tc < start) return;

    if (tc <= holdEnd) {
      const progress = Math.min(1, (tc - start) / FLY_DURATION);
      const eased = easeInOutCubic(progress);
      const x = (w / 2) + (L.targetX - w / 2) * eased;
      const y = horizonY + (L.targetY - horizonY) * eased;
      const scale = 0.04 + (1 - 0.04) * eased;
      const opacity = Math.min(1, progress / 0.25);
      const sinceLand = progress >= 1 ? (tc - end) : null;
      if (opacity > 0) drawSolidLetter(L, x, y, scale, opacity, sinceLand);
    } else {
      const shatterProgress = Math.min(1, (tc - holdEnd) / SHATTER_DURATION);
      drawShatter(L, L.targetX, L.targetY, shatterProgress);
    }
  });
}

function frame(now) {
  ctx.clearRect(0, 0, w, h);
  drawGrid();
  if (ready) drawLetters(now || 0);

  t += SPEED / 60;
  if (t > 1) t -= 1;

  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);

const fontLoad = document.fonts
  ? document.fonts.load(`900 100px "Orbitron"`)
  : Promise.resolve();

fontLoad.finally(() => {
  layoutLetters();
  ready = true;
});

const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let w, h, horizonY;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  horizonY = h / 2;
}
window.addEventListener('resize', resize);
resize();

const ACCENT = [200, 122, 60];
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

  // vertical converging lines
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

  // horizontal perspective lines, animated toward viewer
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

function frame() {
  ctx.clearRect(0, 0, w, h);

  // faint glow haze at horizon
  const glowPulse = 0.12 + Math.sin(t * Math.PI * 2 * 0.15) * 0.04;
  const grad = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, Math.max(w, h) * 0.5);
  grad.addColorStop(0, `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${glowPulse})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawHalf(false);
  drawHalf(true);

  t += SPEED / 60;
  if (t > 1) t -= 1;

  requestAnimationFrame(frame);
}

frame();

const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let w, h, horizonY, cx;
let fontSize;
let ready = false;

const WORD = 'MGAL';
const RED = [214, 24, 38];
const RED_BRIGHT = [255, 70, 90];
const CORE = [255, 236, 228];
const CYAN = [120, 220, 255];
const FONT_FAMILY = '"Orbitron", "Helvetica Neue", Arial, sans-serif';

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  cx = w / 2;
  horizonY = h * 0.62;
  if (ready) layoutText();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------
// Text metrics
// ---------------------------------------------------------------
let textWidth = 0;
let textFont = '';

function layoutText() {
  fontSize = Math.max(54, Math.min(150, Math.min(w, h) * 0.2));
  textFont = `900 ${fontSize}px ${FONT_FAMILY}`;
  ctx.font = textFont;
  textWidth = ctx.measureText(WORD).width;
  buildTextCanvas();
}

// ---------------------------------------------------------------
// Background: stars + corner particle swooshes
// ---------------------------------------------------------------
let stars = [];
let swooshL = [];
let swooshR = [];

function buildBackground() {
  stars = [];
  const starCount = Math.round((w * horizonY) / 9000);
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * horizonY * 0.95,
      r: 0.5 + Math.random() * 1.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.8,
    });
  }

  function buildSwoosh(mirror) {
    const pts = [];
    const count = 70;
    for (let i = 0; i < count; i++) {
      const f = i / count;
      const ang = -0.15 + f * 1.1;
      const dist = (0.12 + f * 0.5) * Math.min(w, h);
      let baseX = Math.cos(ang) * dist;
      const baseY = horizonY * 0.08 + Math.sin(f * 2.1) * horizonY * 0.22 + f * horizonY * 0.3;
      if (mirror) baseX = w - baseX;
      pts.push({
        x: baseX,
        y: baseY,
        r: 0.6 + Math.random() * 1.8 * (1 - f * 0.6),
        a: (1 - f) * (0.35 + Math.random() * 0.4),
        phase: Math.random() * Math.PI * 2,
      });
    }
    return pts;
  }
  swooshL = buildSwoosh(false);
  swooshR = buildSwoosh(true);
}

function drawBackground(now) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, '#05050a');
  g.addColorStop(1, '#0a0304');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY);

  stars.forEach(s => {
    const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * s.speed + s.phase);
    ctx.fillStyle = `rgba(230,235,255,${tw * 0.8})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  function drawSwoosh(pts, color) {
    pts.forEach(p => {
      const tw = 0.5 + 0.5 * Math.sin(now * 0.0015 + p.phase);
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${p.a * tw})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  drawSwoosh(swooshL, RED_BRIGHT);
  drawSwoosh(swooshR, CYAN);
}

// ---------------------------------------------------------------
// Wireframe globe + ring
// ---------------------------------------------------------------
const LAT = 9;
const LON = 18;
let spherePts = [];

function buildSphere() {
  spherePts = [];
  for (let la = 0; la <= LAT; la++) {
    const theta = Math.PI * (la / LAT);
    const ringPts = [];
    for (let lo = 0; lo < LON; lo++) {
      const phi = (Math.PI * 2 * lo) / LON;
      ringPts.push({
        x: Math.sin(theta) * Math.cos(phi),
        y: Math.cos(theta),
        z: Math.sin(theta) * Math.sin(phi),
      });
    }
    spherePts.push(ringPts);
  }
}

let globeAngle = 0;
const TILT = 0.34;

function project(p, gcx, gcy, radius) {
  // rotate around Y
  const ca = Math.cos(globeAngle), sa = Math.sin(globeAngle);
  const x1 = p.x * ca + p.z * sa;
  const z1 = -p.x * sa + p.z * ca;
  const y1 = p.y;
  // tilt around X
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  const y2 = y1 * ct - z1 * st;
  const z2 = y1 * st + z1 * ct;
  return {
    x: gcx + x1 * radius,
    y: gcy + y2 * radius,
    z: z2,
  };
}

function drawRing(gcx, gcy, radius, now) {
  const rx = radius * 1.55;
  const ry = radius * 0.46;

  ctx.save();
  ctx.translate(gcx, gcy + radius * 0.08);
  ctx.scale(1, 1);

  ctx.shadowBlur = 20;
  ctx.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},0.8)`;
  ctx.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},0.55)`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, -0.18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},0.5)`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, -0.18, 0, Math.PI * 2);
  ctx.stroke();

  // traveling comet highlights along the ring
  for (let k = 0; k < 2; k++) {
    const ang = (now * 0.0007 + k * Math.PI) % (Math.PI * 2);
    const ex = Math.cos(ang) * rx;
    const ey = Math.sin(ang) * ry;
    const rot = -0.18;
    const px = ex * Math.cos(rot) - ey * Math.sin(rot);
    const py = ex * Math.sin(rot) + ey * Math.cos(rot);
    const front = Math.sin(ang) > -0.2;
    ctx.globalAlpha = front ? 1 : 0.25;
    ctx.fillStyle = `rgb(${CORE[0]},${CORE[1]},${CORE[2]})`;
    ctx.shadowBlur = 14;
    ctx.shadowColor = `rgba(${RED_BRIGHT[0]},${RED_BRIGHT[1]},${RED_BRIGHT[2]},1)`;
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGlobe(now) {
  const gcx = cx;
  const gcy = horizonY - fontSize * 0.95;
  const radius = fontSize * 1.5;

  drawRing(gcx, gcy, radius, now);

  ctx.save();
  // meridians
  for (let lo = 0; lo < LON; lo++) {
    ctx.beginPath();
    let started = false;
    for (let la = 0; la <= LAT; la++) {
      const p = project(spherePts[la][lo], gcx, gcy, radius);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    const midZ = project(spherePts[Math.floor(LAT / 2)][lo], gcx, gcy, radius).z;
    const alpha = 0.12 + Math.max(0, midZ) * 0.35;
    ctx.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // latitude rings
  for (let la = 1; la < LAT; la++) {
    ctx.beginPath();
    for (let lo = 0; lo <= LON; lo++) {
      const p = project(spherePts[la][lo % LON], gcx, gcy, radius);
      if (lo === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    const midZ = project(spherePts[la][0], gcx, gcy, radius).z;
    const alpha = 0.1 + Math.max(0, midZ) * 0.3;
    ctx.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // glowing nodes
  for (let la = 1; la < LAT; la++) {
    for (let lo = 0; lo < LON; lo += 2) {
      const p = project(spherePts[la][lo], gcx, gcy, radius);
      if (p.z < -0.15) continue;
      const a = 0.3 + Math.max(0, p.z) * 0.7;
      ctx.fillStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${a})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${RED_BRIGHT[0]},${RED_BRIGHT[1]},${RED_BRIGHT[2]},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  return { gcx, gcy, radius };
}

// ---------------------------------------------------------------
// Chrome text (rendered on its own offscreen canvas so the specular
// sweep's source-atop compositing can't bleed onto the globe/floor)
// ---------------------------------------------------------------
let textCanvas = null;
let textCtx = null;
let textCanvasW = 0;
let textCanvasH = 0;

function buildTextCanvas() {
  textCanvasW = Math.ceil(textWidth + fontSize * 0.9);
  textCanvasH = Math.ceil(fontSize * 1.6);
  textCanvas = document.createElement('canvas');
  textCanvas.width = textCanvasW;
  textCanvas.height = textCanvasH;
  textCtx = textCanvas.getContext('2d');
}

function renderTextCanvas(now) {
  const tctx = textCtx;
  tctx.clearRect(0, 0, textCanvasW, textCanvasH);
  tctx.save();
  tctx.translate(textCanvasW / 2, textCanvasH / 2);
  tctx.transform(1, 0, -0.14, 1, 0, 0); // slant
  tctx.font = textFont;
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';

  const gh = fontSize * 0.75;
  const grad = tctx.createLinearGradient(0, -gh / 2, 0, gh / 2);
  grad.addColorStop(0, '#5a0d12');
  grad.addColorStop(0.32, '#fff3ef');
  grad.addColorStop(0.5, '#ffb4ad');
  grad.addColorStop(0.68, '#7a1016');
  grad.addColorStop(1, '#2a0407');
  tctx.fillStyle = grad;
  tctx.fillText(WORD, 0, 0);

  // moving specular sweep — confined to this canvas, so source-atop
  // only ever touches the glyph pixels just drawn above
  tctx.save();
  tctx.globalCompositeOperation = 'source-atop';
  const sweepT = (Math.sin(now * 0.0006) + 1) / 2; // 0..1 ping-pong
  const sx = -textWidth * 0.8 + sweepT * textWidth * 1.6;
  const sweep = tctx.createLinearGradient(sx - fontSize * 0.5, 0, sx + fontSize * 0.5, 0);
  sweep.addColorStop(0, 'rgba(255,255,255,0)');
  sweep.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  tctx.fillStyle = sweep;
  tctx.fillRect(-textWidth, -gh, textWidth * 2, gh * 2);
  tctx.restore();

  tctx.lineWidth = Math.max(1, fontSize * 0.012);
  tctx.strokeStyle = 'rgba(10,0,0,0.6)';
  tctx.strokeText(WORD, 0, 0);

  tctx.restore();
}

function drawText(now) {
  const x = cx;
  const y = horizonY - fontSize * 0.42;

  // outer red glow pass, drawn straight onto the main canvas (the
  // blur is meant to bleed outward, so this one doesn't need isolating)
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.shadowBlur = 50;
  ctx.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},0.9)`;
  ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},0.8)`;
  ctx.font = textFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(WORD, 0, 0);
  ctx.restore();

  renderTextCanvas(now);
  ctx.drawImage(textCanvas, x - textCanvasW / 2, y - textCanvasH / 2);
}

// ---------------------------------------------------------------
// Floor grid with flowing light pulses
// ---------------------------------------------------------------
const VLINES = 22;
const HLINES = 16;
let t = 0;
let pulses = [];
let nextPulseAt = 0;

function vLineBottomX(i) {
  const frac = i / VLINES;
  return frac * w * 1.7 - w * 0.35;
}

function strokeLED(x1, y1, x2, y2, alpha, coreAlphaMul = 1) {
  if (alpha <= 0.01) return;
  ctx.lineCap = 'round';

  ctx.shadowBlur = 15;
  ctx.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},${Math.min(1, alpha * 1.3)})`;
  ctx.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${alpha * 0.85})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${Math.min(1, alpha * coreAlphaMul)})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawFloor(now) {
  const floorH = h - horizonY;

  const glow = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, Math.max(w, h) * 0.45);
  glow.addColorStop(0, `rgba(${RED[0]},${RED[1]},${RED[2]},0.35)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizonY - floorH * 0.2, w, floorH * 1.2);

  for (let i = 0; i <= VLINES; i++) {
    const bottomX = vLineBottomX(i);
    const frac = i / VLINES;
    const dist = Math.abs(frac - 0.5) * 2;
    const alpha = 0.55 * (1 - dist * 0.7);
    strokeLED(cx, horizonY, bottomX, h, Math.max(alpha, 0.05));
  }

  for (let i = 0; i < HLINES; i++) {
    const phase = ((i / HLINES) + t) % 1;
    const easeDist = Math.pow(phase, 2.1);
    const y = horizonY + easeDist * floorH;
    const alpha = 0.55 * (1 - phase) + 0.04;
    strokeLED(0, y, w, y, alpha);
  }

  // flowing light pulses racing from the core outward along floor lines
  if (now >= nextPulseAt) {
    const count = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < count; k++) {
      pulses.push({
        line: Math.floor(Math.random() * (VLINES + 1)),
        start: now,
        duration: 900 + Math.random() * 700,
      });
    }
    nextPulseAt = now + 260 + Math.random() * 420;
  }

  pulses = pulses.filter(p => now - p.start < p.duration);
  pulses.forEach(p => {
    const prog = (now - p.start) / p.duration;
    const ease = prog * prog;
    const bottomX = vLineBottomX(p.line);
    const px = cx + (bottomX - cx) * ease;
    const py = horizonY + (h - horizonY) * ease;
    const alpha = Math.sin(Math.min(1, prog) * Math.PI);

    ctx.shadowBlur = 18;
    ctx.shadowColor = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${alpha})`;
    ctx.fillStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 3 + ease * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
let introStart = null;

function frame(now) {
  now = now || 0;
  ctx.clearRect(0, 0, w, h);

  drawBackground(now);
  if (ready) {
    drawGlobe(now);
    drawText(now);
  }
  drawFloor(now);

  if (introStart === null) introStart = now;
  const introP = Math.min(1, (now - introStart) / 1300);
  if (introP < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - introP})`;
    ctx.fillRect(0, 0, w, h);
  }

  t += 0.12 / 60;
  if (t > 1) t -= 1;
  globeAngle += 0.0028;

  requestAnimationFrame(frame);
}

function init() {
  resize();
  buildBackground();
  buildSphere();
  requestAnimationFrame(frame);

  const fontLoad = document.fonts
    ? document.fonts.load(`900 100px "Orbitron"`)
    : Promise.resolve();

  fontLoad.finally(() => {
    layoutText();
    ready = true;
  });
}

init();

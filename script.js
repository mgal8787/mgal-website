const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let sceneCanvas, sctx; // globe + text rendered here once per frame, then
                        // blitted upright AND flipped (for the floor reflection)

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

  sceneCanvas = document.createElement('canvas');
  sceneCanvas.width = w;
  sceneCanvas.height = h;
  sctx = sceneCanvas.getContext('2d');

  buildBackground();
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
let flares = [];
let swooshL = [];
let swooshR = [];

function buildBackground() {
  stars = [];
  const starCount = Math.round((w * horizonY) / 2600);
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * horizonY * 0.97,
      r: 0.4 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.1,
    });
  }

  flares = [];
  for (let i = 0; i < 6; i++) {
    flares.push({
      x: Math.random() * w,
      y: Math.random() * horizonY * 0.8,
      r: 1.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function buildSwoosh(mirror) {
    const pts = [];
    const count = 130;
    for (let i = 0; i < count; i++) {
      const f = i / count;
      const ang = -0.15 + f * 1.1;
      const dist = (0.12 + f * 0.5) * Math.min(w, h);
      let baseX = Math.cos(ang) * dist;
      const baseY = horizonY * 0.06 + Math.sin(f * 2.1) * horizonY * 0.22 + f * horizonY * 0.32;
      // tangent direction for streak orientation
      const ang2 = -0.15 + (f + 0.01) * 1.1;
      const dist2 = (0.12 + (f + 0.01) * 0.5) * Math.min(w, h);
      let bx2 = Math.cos(ang2) * dist2;
      const by2 = horizonY * 0.06 + Math.sin((f + 0.01) * 2.1) * horizonY * 0.22 + (f + 0.01) * horizonY * 0.32;
      if (mirror) { baseX = w - baseX; bx2 = w - bx2; }
      const dx = bx2 - baseX, dy = by2 - baseY;
      const len = Math.max(0.001, Math.hypot(dx, dy));

      pts.push({
        x: baseX,
        y: baseY,
        ux: dx / len,
        uy: dy / len,
        len: 2 + Math.random() * 10 * (1 - f * 0.5),
        w: 0.5 + Math.random() * 1.4 * (1 - f * 0.5),
        a: (1 - f * 0.92) * (0.4 + Math.random() * 0.5),
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
  g.addColorStop(0, '#07070d');
  g.addColorStop(1, '#0c0405');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY);

  stars.forEach(s => {
    const tw = 0.5 + 0.5 * Math.sin(now * 0.001 * s.speed + s.phase);
    ctx.fillStyle = `rgba(235,238,255,${tw * 0.85})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  flares.forEach(fl => {
    const tw = 0.45 + 0.55 * Math.sin(now * 0.0008 + fl.phase);
    const a = tw * 0.9;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    const s = fl.r * 5;
    ctx.beginPath();
    ctx.moveTo(fl.x - s, fl.y);
    ctx.lineTo(fl.x + s, fl.y);
    ctx.moveTo(fl.x, fl.y - s);
    ctx.lineTo(fl.x, fl.y + s);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  function drawSwoosh(pts, color) {
    pts.forEach(p => {
      const tw = 0.45 + 0.55 * Math.sin(now * 0.0018 + p.phase);
      const alpha = p.a * tw;
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 4;
      ctx.shadowColor = `rgba(${color[0]},${color[1]},${color[2]},0.9)`;
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},1)`;
      ctx.lineWidth = p.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - p.ux * p.len * 0.5, p.y - p.uy * p.len * 0.5);
      ctx.lineTo(p.x + p.ux * p.len * 0.5, p.y + p.uy * p.len * 0.5);
      ctx.stroke();
      ctx.restore();
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
  const ca = Math.cos(globeAngle), sa = Math.sin(globeAngle);
  const x1 = p.x * ca + p.z * sa;
  const z1 = -p.x * sa + p.z * ca;
  const y1 = p.y;
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  const y2 = y1 * ct - z1 * st;
  const z2 = y1 * st + z1 * ct;
  return { x: gcx + x1 * radius, y: gcy + y2 * radius, z: z2 };
}

function drawRing(c, gcx, gcy, radius, now) {
  const rx = radius * 1.55;
  const ry = radius * 0.46;

  c.save();
  c.translate(gcx, gcy);

  c.shadowBlur = 26;
  c.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},0.9)`;
  c.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},0.65)`;
  c.lineWidth = 2.6;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, -0.18, 0, Math.PI * 2);
  c.stroke();

  c.shadowBlur = 0;
  c.strokeStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},0.6)`;
  c.lineWidth = 0.9;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, -0.18, 0, Math.PI * 2);
  c.stroke();

  for (let k = 0; k < 3; k++) {
    const ang = (now * 0.0007 + (k * Math.PI * 2) / 3) % (Math.PI * 2);
    const ex = Math.cos(ang) * rx;
    const ey = Math.sin(ang) * ry;
    const rot = -0.18;
    const px = ex * Math.cos(rot) - ey * Math.sin(rot);
    const py = ex * Math.sin(rot) + ey * Math.cos(rot);
    const front = Math.sin(ang) > -0.2;
    c.globalAlpha = front ? 1 : 0.22;
    c.fillStyle = `rgb(${CORE[0]},${CORE[1]},${CORE[2]})`;
    c.shadowBlur = 16;
    c.shadowColor = `rgba(${RED_BRIGHT[0]},${RED_BRIGHT[1]},${RED_BRIGHT[2]},1)`;
    c.beginPath();
    c.arc(px, py, 3.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawGlobe(c, now) {
  const gcx = cx;
  const gcy = horizonY - fontSize * 0.95;
  const radius = fontSize * 1.5;
  const textY = horizonY - fontSize * 0.42;

  drawRing(c, gcx, textY, radius, now);

  c.save();
  for (let lo = 0; lo < LON; lo++) {
    c.beginPath();
    let started = false;
    for (let la = 0; la <= LAT; la++) {
      const p = project(spherePts[la][lo], gcx, gcy, radius);
      if (!started) { c.moveTo(p.x, p.y); started = true; }
      else c.lineTo(p.x, p.y);
    }
    const midZ = project(spherePts[Math.floor(LAT / 2)][lo], gcx, gcy, radius).z;
    const alpha = 0.14 + Math.max(0, midZ) * 0.4;
    c.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${alpha})`;
    c.lineWidth = 1;
    c.stroke();
  }
  for (let la = 1; la < LAT; la++) {
    c.beginPath();
    for (let lo = 0; lo <= LON; lo++) {
      const p = project(spherePts[la][lo % LON], gcx, gcy, radius);
      if (lo === 0) c.moveTo(p.x, p.y);
      else c.lineTo(p.x, p.y);
    }
    const midZ = project(spherePts[la][0], gcx, gcy, radius).z;
    const alpha = 0.12 + Math.max(0, midZ) * 0.34;
    c.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${alpha})`;
    c.lineWidth = 1;
    c.stroke();
  }
  for (let la = 1; la < LAT; la++) {
    for (let lo = 0; lo < LON; lo += 2) {
      const p = project(spherePts[la][lo], gcx, gcy, radius);
      if (p.z < -0.15) continue;
      const a = 0.35 + Math.max(0, p.z) * 0.75;
      c.fillStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${a})`;
      c.shadowBlur = 8;
      c.shadowColor = `rgba(${RED_BRIGHT[0]},${RED_BRIGHT[1]},${RED_BRIGHT[2]},${a})`;
      c.beginPath();
      c.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.shadowBlur = 0;
  c.restore();
}

// ---------------------------------------------------------------
// Chrome text (own offscreen canvas so the specular sweep's
// source-atop compositing can't bleed onto the globe/floor)
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
  tctx.transform(1, 0, -0.14, 1, 0, 0);
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

  tctx.save();
  tctx.globalCompositeOperation = 'source-atop';
  const sweepT = (Math.sin(now * 0.0006) + 1) / 2;
  const sx = -textWidth * 0.8 + sweepT * textWidth * 1.6;
  const sweep = tctx.createLinearGradient(sx - fontSize * 0.5, 0, sx + fontSize * 0.5, 0);
  sweep.addColorStop(0, 'rgba(255,255,255,0)');
  sweep.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  tctx.fillStyle = sweep;
  tctx.fillRect(-textWidth, -gh, textWidth * 2, gh * 2);
  tctx.restore();

  tctx.lineWidth = Math.max(1, fontSize * 0.012);
  tctx.strokeStyle = 'rgba(10,0,0,0.6)';
  tctx.strokeText(WORD, 0, 0);

  tctx.restore();
}

function drawText(c, now) {
  const x = cx;
  const y = horizonY - fontSize * 0.42;

  c.save();
  c.translate(x, y);
  c.transform(1, 0, -0.14, 1, 0, 0);
  c.shadowBlur = 65;
  c.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},0.95)`;
  c.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},0.85)`;
  c.font = textFont;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(WORD, 0, 0);
  c.restore();

  renderTextCanvas(now);
  c.drawImage(textCanvas, x - textCanvasW / 2, y - textCanvasH / 2);
}

// ---------------------------------------------------------------
// Floor grid with flowing light pulses + reflection
// ---------------------------------------------------------------
const VLINES = 24;
const HLINES = 18;
let t = 0;
let pulses = [];
let nextPulseAt = 0;

function vLineBottomX(i) {
  const frac = i / VLINES;
  return frac * w * 1.7 - w * 0.35;
}

function strokeLED(c, x1, y1, x2, y2, alpha) {
  if (alpha <= 0.01) return;
  c.lineCap = 'round';

  c.shadowBlur = 17;
  c.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},${Math.min(1, alpha * 1.4)})`;
  c.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${alpha * 0.9})`;
  c.lineWidth = 3.1;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();

  c.shadowBlur = 0;
  c.strokeStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${Math.min(1, alpha * 1.15)})`;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function drawFloor(now) {
  const floorH = h - horizonY;

  // base
  ctx.fillStyle = '#060203';
  ctx.fillRect(0, horizonY, w, floorH);

  // reflection of the globe + text, flipped and faded with depth
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, w, floorH);
  ctx.clip();
  ctx.globalAlpha = 0.3;
  ctx.translate(0, horizonY * 2);
  ctx.scale(1, -1);
  ctx.drawImage(sceneCanvas, 0, 0);
  ctx.restore();

  const fade = ctx.createLinearGradient(0, horizonY, 0, h);
  fade.addColorStop(0, 'rgba(6,2,3,0)');
  fade.addColorStop(0.55, 'rgba(6,2,3,0.55)');
  fade.addColorStop(1, 'rgba(6,2,3,0.95)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizonY, w, floorH);

  const glow = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, Math.max(w, h) * 0.45);
  glow.addColorStop(0, `rgba(${RED[0]},${RED[1]},${RED[2]},0.4)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizonY - floorH * 0.2, w, floorH * 1.2);

  for (let i = 0; i <= VLINES; i++) {
    const bottomX = vLineBottomX(i);
    const frac = i / VLINES;
    const dist = Math.abs(frac - 0.5) * 2;
    const alpha = 0.6 * (1 - dist * 0.7);
    strokeLED(ctx, cx, horizonY, bottomX, h, Math.max(alpha, 0.06));
  }

  for (let i = 0; i < HLINES; i++) {
    const phase = ((i / HLINES) + t) % 1;
    const easeDist = Math.pow(phase, 2.1);
    const y = horizonY + easeDist * floorH;
    const alpha = 0.6 * (1 - phase) + 0.05;
    strokeLED(ctx, 0, y, w, y, alpha);
  }

  if (now >= nextPulseAt) {
    const count = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < count; k++) {
      pulses.push({
        line: Math.floor(Math.random() * (VLINES + 1)),
        start: now,
        duration: 850 + Math.random() * 650,
      });
    }
    nextPulseAt = now + 220 + Math.random() * 360;
  }

  pulses = pulses.filter(p => now - p.start < p.duration);
  pulses.forEach(p => {
    const prog = (now - p.start) / p.duration;
    const ease = prog * prog;
    const bottomX = vLineBottomX(p.line);
    const px = cx + (bottomX - cx) * ease;
    const py = horizonY + (h - horizonY) * ease;
    const alpha = Math.sin(Math.min(1, prog) * Math.PI);

    ctx.shadowBlur = 20;
    ctx.shadowColor = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${alpha})`;
    ctx.fillStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 3.2 + ease * 3.2, 0, Math.PI * 2);
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
  sctx.clearRect(0, 0, w, h);

  drawBackground(now);

  if (ready) {
    drawGlobe(sctx, now);
    drawText(sctx, now);
  }

  drawFloor(now);
  ctx.drawImage(sceneCanvas, 0, 0);

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

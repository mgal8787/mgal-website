const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let w, h, cx;
let horizonY = 0;

const RED = [214, 24, 38];
const CORE = [255, 236, 228];

// Fraction of the background image's own height where its horizon/
// vanishing point sits — used to line everything up after cover-fit.
const BG_HORIZON_FRAC = 0.545;

// ---------------------------------------------------------------
// Assets
// ---------------------------------------------------------------
const assets = { bg: null, logo: null };
let assetsReady = false;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

Promise.all([
  loadImage('img/bg-scene.jpg'),
  loadImage('img/logo-chrome.png'),
]).then(([bg, logo]) => {
  assets.bg = bg;
  assets.logo = logo;
  assetsReady = true;
  layout();
});

// ---------------------------------------------------------------
// Layout (recomputed on resize once assets are known)
// ---------------------------------------------------------------
let bgDraw = { x: 0, y: 0, w: 0, h: 0 };
let logoDraw = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };

function coverFit(iw, ih, cw, ch) {
  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale, dh = ih * scale;
  return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh, scale };
}

function layout() {
  if (!assets.bg) return;

  bgDraw = coverFit(assets.bg.width, assets.bg.height, w, h);
  horizonY = bgDraw.y + assets.bg.height * BG_HORIZON_FRAC * bgDraw.scale;

  if (assets.logo) {
    const aspect = assets.logo.height / assets.logo.width;
    // cap by available width, native size, AND the vertical room actually
    // available above the horizon — a wide/short window has plenty of
    // width but very little height, so width alone isn't enough
    const topMargin = 24;
    const maxWByHeight = ((horizonY - topMargin) * 0.78) / aspect;
    const logoW = Math.max(120, Math.min(w * 0.7, assets.logo.width, maxWByHeight));
    const logoH = logoW * aspect;
    const cy = Math.max(horizonY - logoH * 0.95, logoH / 2 + topMargin);
    logoDraw = { w: logoW, h: logoH, cx: cx, cy };
  }
}

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  cx = w / 2;
  layout();
  buildSparkles();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------
// Logo: own offscreen canvas so the specular sweep (source-atop)
// only ever touches the logo's own pixels
// ---------------------------------------------------------------
let logoCanvas = null, logoCtx = null;

function ensureLogoCanvas() {
  if (!assets.logo || logoCanvas) return;
  logoCanvas = document.createElement('canvas');
  logoCanvas.width = assets.logo.width;
  logoCanvas.height = assets.logo.height;
  logoCtx = logoCanvas.getContext('2d');
}

function renderLogo(now) {
  const lctx = logoCtx;
  const lw = assets.logo.width, lh = assets.logo.height;
  lctx.clearRect(0, 0, lw, lh);
  lctx.drawImage(assets.logo, 0, 0);

  lctx.save();
  lctx.globalCompositeOperation = 'source-atop';
  const sweepT = (Math.sin(now * 0.0006) + 1) / 2;
  const sx = -lw * 0.3 + sweepT * lw * 1.6;
  const grad = lctx.createLinearGradient(sx - lw * 0.18, 0, sx + lw * 0.18, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  lctx.fillStyle = grad;
  lctx.fillRect(0, 0, lw, lh);
  lctx.restore();
}

// entrance: the logo flies in from depth (small, near the horizon's
// vanishing point), overshoots a little past its final size/position,
// then settles back — like it arrives too close and eases back into place
let logoIntroStart = null;
const LOGO_INTRO_MS = 5200;

function easeOutBack(x) {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function drawLogo(c, now) {
  if (!assets.logo) return;
  ensureLogoCanvas();
  renderLogo(now);

  if (logoIntroStart === null) logoIntroStart = now;
  const rawP = Math.min(1, (now - logoIntroStart) / LOGO_INTRO_MS);
  const p = easeOutBack(rawP);
  const scale = 0.08 + 0.92 * p;
  const x = cx + (logoDraw.cx - cx) * p;
  const y = horizonY + (logoDraw.cy - horizonY) * p;
  const opacity = Math.min(1, rawP / 0.2);

  c.save();
  c.globalAlpha = opacity;
  c.translate(x, y);
  c.scale(scale, scale);
  c.shadowBlur = 45;
  c.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},0.8)`;
  c.drawImage(logoCanvas, -logoDraw.w / 2, -logoDraw.h / 2, logoDraw.w, logoDraw.h);
  c.shadowBlur = 0;
  c.restore();
}

// ---------------------------------------------------------------
// Background: slow Ken Burns drift + sparkle stars + occasional flash
// ---------------------------------------------------------------
function drawBackground(now) {
  const zoom = 1 + 0.035 * (0.5 + 0.5 * Math.sin(now * 0.00006));
  const panX = Math.sin(now * 0.00004) * w * 0.015;
  const panY = Math.cos(now * 0.00005) * h * 0.01;

  const dw = bgDraw.w * zoom, dh = bgDraw.h * zoom;
  const dx = bgDraw.x - (dw - bgDraw.w) / 2 + panX;
  const dy = bgDraw.y - (dh - bgDraw.h) / 2 + panY;
  ctx.drawImage(assets.bg, dx, dy, dw, dh);
}

let sparkles = [];
let heroStars = [];

function buildSparkles() {
  sparkles = [];
  const count = Math.round((w * horizonY) / 14000);
  for (let i = 0; i < count; i++) {
    sparkles.push({
      x: Math.random() * w,
      y: Math.random() * horizonY * 0.9,
      r: 0.5 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.2,
    });
  }

  heroStars = [];
  const heroCount = 2 + Math.floor(Math.random() * 2); // 2-3
  for (let i = 0; i < heroCount; i++) {
    heroStars.push({
      x: w * (0.15 + Math.random() * 0.7),
      y: horizonY * (0.12 + Math.random() * 0.55),
      r: 2.2 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      period: 2600 + Math.random() * 1800,
    });
  }
}

function drawSparkles(now) {
  sparkles.forEach(s => {
    const tw = 0.3 + 0.7 * Math.max(0, Math.sin(now * 0.0012 * s.speed + s.phase));
    if (tw < 0.05) return;
    ctx.fillStyle = `rgba(255,255,255,${tw * 0.85})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  heroStars.forEach(s => {
    const tw = 0.4 + 0.6 * Math.sin((now / s.period) * Math.PI * 2 + s.phase);
    const a = Math.max(0, tw);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    const len = s.r * 5;
    ctx.beginPath();
    ctx.moveTo(s.x - len, s.y);
    ctx.lineTo(s.x + len, s.y);
    ctx.moveTo(s.x, s.y - len);
    ctx.lineTo(s.x, s.y + len);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// occasional small lightning flashes scattered around the sky — several
// can be alive at once for a busier effect
let nextFlashAt = 600 + Math.random() * 900;
let flashes = [];

function buildFlashPath() {
  const x0 = w * (0.1 + Math.random() * 0.8);
  const y0 = horizonY * (0.05 + Math.random() * 0.3);
  const pts = [[x0, y0]];
  let x = x0, y = y0;
  const segs = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < segs; i++) {
    x += (Math.random() - 0.5) * 36;
    y += 14 + Math.random() * 22;
    pts.push([x, y]);
  }
  return pts;
}

function drawFlash(now) {
  if (now >= nextFlashAt && flashes.length < 3) {
    const n = 1 + (Math.random() > 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      flashes.push({ start: now, duration: 220 + Math.random() * 120, path: buildFlashPath() });
    }
    nextFlashAt = now + 500 + Math.random() * 1100;
  }

  flashes = flashes.filter(f => now - f.start < f.duration);
  flashes.forEach(f => {
    const t = now - f.start;
    const flicker = Math.random() > 0.3 ? 1 : 0.2;
    const fade = 1 - t / f.duration;

    ctx.save();
    ctx.globalAlpha = fade * flicker;
    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(255,255,255,1)';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    f.path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.restore();
  });
}

// ---------------------------------------------------------------
// Occasional vertical light sweep down the floor, same idea as the
// specular highlight on the logo
// ---------------------------------------------------------------
let nextFloorSweepAt = 3000 + Math.random() * 4000;
let floorSweep = null;

function drawFloorSweep(now) {
  if (!floorSweep && now >= nextFloorSweepAt) {
    floorSweep = { start: now, duration: 1100 + Math.random() * 500 };
    nextFloorSweepAt = now + 6000 + Math.random() * 9000;
  }
  if (!floorSweep) return;

  const t = now - floorSweep.start;
  if (t > floorSweep.duration) { floorSweep = null; return; }

  const floorH = h - horizonY;
  const prog = t / floorSweep.duration;
  const bandY = horizonY + prog * floorH;
  const bandHeight = floorH * 0.22;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, w, floorH);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighten';
  const grad = ctx.createLinearGradient(0, bandY - bandHeight, 0, bandY + bandHeight);
  grad.addColorStop(0, 'rgba(255,235,228,0)');
  grad.addColorStop(0.5, 'rgba(255,235,228,0.8)');
  grad.addColorStop(1, 'rgba(255,235,228,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY - bandHeight, w, bandHeight * 2);
  ctx.restore();
}

// ---------------------------------------------------------------
// Flowing light pulses racing outward across the photo's floor grid
// ---------------------------------------------------------------
let pulses = [];
let nextPulseAt = 0;

function pulseTargetX(seed) {
  return cx + (seed - 0.5) * w * 1.6;
}

function drawPulses(now) {
  if (now >= nextPulseAt) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      pulses.push({ seed: Math.random(), start: now, duration: 1600 + Math.random() * 1000 });
    }
    nextPulseAt = now + 350 + Math.random() * 450;
  }

  pulses = pulses.filter(p => now - p.start < p.duration);
  pulses.forEach(p => {
    const prog = (now - p.start) / p.duration;
    const ease = prog * prog;
    const px = cx + (pulseTargetX(p.seed) - cx) * ease;
    const py = horizonY + (h - horizonY) * ease;
    const alpha = Math.sin(Math.min(1, prog) * Math.PI);

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${alpha})`;
    ctx.fillStyle = `rgba(${CORE[0]},${CORE[1]},${CORE[2]},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 2.4 + ease * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
let sceneCanvas, sctx;

function frame(now) {
  now = now || 0;
  ctx.clearRect(0, 0, w, h);

  if (assetsReady) {
    if (!sceneCanvas) {
      sceneCanvas = document.createElement('canvas');
      sceneCanvas.width = w;
      sceneCanvas.height = h;
      sctx = sceneCanvas.getContext('2d');
    }

    drawBackground(now);
    drawSparkles(now);
    drawFlash(now);

    sctx.clearRect(0, 0, w, h);
    drawLogo(sctx, now);

    drawPulses(now);
    drawFloorSweep(now);
    ctx.drawImage(sceneCanvas, 0, 0);
  }

  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);

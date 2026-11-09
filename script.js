const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

let w, h, cx;
let horizonY = 0;

const RED = [214, 24, 38];
const RED_BRIGHT = [255, 70, 90];
const CORE = [255, 236, 228];

// Fraction of each source image's own height where its horizon/vanishing
// point sits — used to line everything up after a cover-fit scale.
const BG_HORIZON_FRAC = 0.545;

// ---------------------------------------------------------------
// Assets
// ---------------------------------------------------------------
const assets = { bg: null, logo: null, globe: null };
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
  loadImage('img/globe.png'),
]).then(([bg, logo, globe]) => {
  assets.bg = bg;
  assets.logo = logo;
  assets.globe = globe;
  assetsReady = true;
  layout();
});

// ---------------------------------------------------------------
// Layout (recomputed on resize once assets are known)
// ---------------------------------------------------------------
let bgDraw = { x: 0, y: 0, w: 0, h: 0 };
let logoDraw = { x: 0, y: 0, w: 0, h: 0 };
let globeDraw = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };

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
    const logoW = Math.min(w * 0.72, assets.logo.width * 1.0);
    const logoScale = logoW / assets.logo.width;
    const logoH = assets.logo.height * logoScale;
    logoDraw = {
      x: cx - logoW / 2,
      y: horizonY - logoH * 0.62,
      w: logoW,
      h: logoH,
    };
  }

  if (assets.globe) {
    const gw = Math.min(w * 0.46, assets.globe.width * 1.3);
    const gScale = gw / assets.globe.width;
    const gh = assets.globe.height * gScale;
    globeDraw = {
      w: gw,
      h: gh,
      cx: cx,
      cy: horizonY - gh * 0.42,
    };
  }
}

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  cx = w / 2;
  layout();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------
// Logo: own offscreen canvas so the specular sweep (source-atop)
// only ever touches the logo's own pixels
// ---------------------------------------------------------------
let logoCanvas = null, logoCtx = null;

function ensureLogoCanvas() {
  if (!assets.logo) return;
  if (logoCanvas) return;
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

// ---------------------------------------------------------------
// Scene canvas: globe + logo rendered once per frame, upright, so it
// can also be blitted flipped as a floor reflection
// ---------------------------------------------------------------
let sceneCanvas, sctx;

function drawSceneLayer(c, now) {
  if (assets.globe) {
    // fake a turntable spin around the vertical axis: squash the image
    // horizontally toward an edge-on sliver and back, instead of
    // rotating it in-plane (which just looks like a flat disc spinning)
    const spin = Math.cos(now * 0.00035);
    c.save();
    c.translate(globeDraw.cx, globeDraw.cy);
    c.scale(spin, 1);
    c.globalCompositeOperation = 'lighten';
    c.drawImage(assets.globe, -globeDraw.w / 2, -globeDraw.h / 2, globeDraw.w, globeDraw.h);
    c.restore();
  }

  if (assets.logo) {
    ensureLogoCanvas();
    renderLogo(now);
    c.save();
    c.shadowBlur = 45;
    c.shadowColor = `rgba(${RED[0]},${RED[1]},${RED[2]},0.8)`;
    c.drawImage(logoCanvas, logoDraw.x, logoDraw.y, logoDraw.w, logoDraw.h);
    c.shadowBlur = 0;
    c.restore();
  }
}

// ---------------------------------------------------------------
// Stars / sparkle on top of the photo background for extra life
// ---------------------------------------------------------------
let sparkles = [];

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
}

// ---------------------------------------------------------------
// Flowing light pulses racing outward across the photo's floor grid
// ---------------------------------------------------------------
let pulses = [];
let nextPulseAt = 0;

function pulseTargetX(seed) {
  // spread targets across the lower edge, biased away from dead-center
  return cx + (seed - 0.5) * w * 1.6;
}

function drawPulses(now) {
  if (now >= nextPulseAt) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      pulses.push({ seed: Math.random(), start: now, duration: 900 + Math.random() * 700 });
    }
    nextPulseAt = now + 220 + Math.random() * 380;
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
    ctx.arc(px, py, 2.6 + ease * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
let introStart = null;

function frame(now) {
  now = now || 0;
  ctx.clearRect(0, 0, w, h);

  if (assetsReady) {
    if (!sceneCanvas) {
      sceneCanvas = document.createElement('canvas');
      sceneCanvas.width = w;
      sceneCanvas.height = h;
      sctx = sceneCanvas.getContext('2d');
      buildSparkles();
    }

    ctx.drawImage(assets.bg, bgDraw.x, bgDraw.y, bgDraw.w, bgDraw.h);
    drawSparkles(now);

    sctx.clearRect(0, 0, w, h);
    drawSceneLayer(sctx, now);

    // floor reflection of the globe + logo, flipped and faded
    const floorH = h - horizonY;
    if (floorH > 0) {
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
      fade.addColorStop(0, 'rgba(4,2,2,0)');
      fade.addColorStop(0.6, 'rgba(4,2,2,0.45)');
      fade.addColorStop(1, 'rgba(4,2,2,0.85)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, horizonY, w, floorH);
    }

    drawPulses(now);
    ctx.drawImage(sceneCanvas, 0, 0);
  }

  if (introStart === null) introStart = now;
  const introP = Math.min(1, (now - introStart) / 1300);
  if (introP < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - introP})`;
    ctx.fillRect(0, 0, w, h);
  }

  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);

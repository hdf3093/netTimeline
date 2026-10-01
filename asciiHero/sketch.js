// ASCII Portal — your face as data, your data as image.
// Frames are read into pixels to pick characters, then discarded. Nothing is saved.

const SETS = [
  { name: 'ascii',   ramp: " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { name: 'braille', ramp: ' ⠁⠂⠃⠅⠇⠏⠟⠿⡿⣿' },
  { name: 'binary',  ramp: '   ··0011' },
  { name: 'kawaii',  ramp: ' ･.:+*☆★✿♡' },
  { name: 'diary',   phrase: "i'm alive and breathing · " }
];

const COLORS = ['pink', 'terminal', 'rainbow', 'paper'];

const SPARKLES = '✦✧⋆*+·';

const STATUS = [
  'reading your face… 72%',
  'you are {n} characters',
  'you are {rows} lines tall',
  'brightness → meaning',
  'resolution lowered for your comfort',
  'do you look like you?',
  'this is what a camera sees',
  'you will be seen, you will not be kept.'
];

let video = null;
let videoReady = false;
let inPortal = false;
let cameraDenied = false;

let setIndex = 0;
let colorIndex = 0;
let fontSize = 14;

let cols = 0, rows = 0, cellW = 0, cellH = 0;
let sparkle = null;
let lastMouse = null;

let ui = {};

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(30);
  buildGrid();
  buildUI();
  applyColorMode();
  rotateStatus();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildGrid();
}

function buildGrid() {
  cellW = fontSize * 0.62;
  cellH = fontSize * 0.95;
  cols = Math.ceil(width / cellW);
  rows = Math.ceil(height / cellH);
  sparkle = new Float32Array(cols * rows);
}

/* ---------- camera ---------- */

function enterPortal() {
  inPortal = true;
  cameraDenied = false;
  ui.start.hidden = true;
  ui.toolbar.hidden = false;
  if (window.NetSession) NetSession.setCameraActive(true);

  if (!video) {
    video = createCapture(VIDEO, () => { videoReady = true; });
    video.size(160, 120);
    video.hide();
    // p5 swallows getUserMedia errors; watch for a stream that never arrives.
    setTimeout(() => { if (!videoReady) cameraDenied = true; }, 6000);
  }
}

function exitPortal() {
  inPortal = false;
  ui.status.textContent = '';
  ui.start.hidden = false;
  ui.toolbar.hidden = true;
  if (window.NetSession) NetSession.setCameraActive(false);
  if (video) {
    const stream = video.elt.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    video.remove();
    video = null;
    videoReady = false;
  }
}

/* ---------- drawing ---------- */

function draw() {
  const live = inPortal && video && videoReady && video.loadedmetadata !== false;
  const levels = live ? sampleVideo() : sampleStatic();
  if (!levels) return;

  const set = SETS[setIndex];
  const mode = COLORS[colorIndex];
  const ctx = drawingContext;
  const t = millis() / 1000;

  background(mode === 'paper' ? 250 : 0);
  ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const base = mode === 'pink' ? '#ff8ce6' : mode === 'terminal' ? '#5cff88' : mode === 'paper' ? '#111' : null;
  if (base) ctx.fillStyle = base;

  for (let j = 0; j < rows; j++) {
    const y = j * cellH + cellH / 2;
    for (let i = 0; i < cols; i++) {
      const k = i + j * cols;
      let b = levels[k];
      if (mode === 'paper') b = 1 - b;

      const s = sparkle[k];
      if (s > 0.15 && Math.random() < s) {
        ctx.fillStyle = mode === 'paper' ? '#ff3fb4' : '#fff';
        ctx.globalAlpha = 1;
        ctx.fillText(SPARKLES[(k + frameCount) % SPARKLES.length], i * cellW + cellW / 2, y);
        if (base) ctx.fillStyle = base;
        continue;
      }

      let ch;
      if (set.phrase) {
        ch = set.phrase[k % set.phrase.length];
        ctx.globalAlpha = 0.08 + b * 0.92;
      } else {
        ch = set.ramp[Math.min(set.ramp.length - 1, Math.floor(b * set.ramp.length))];
        ctx.globalAlpha = 1;
      }
      if (ch === ' ') continue;

      if (mode === 'rainbow') {
        ctx.fillStyle = `hsl(${(i * 4 + j * 3 + t * 90) % 360}, 100%, ${45 + b * 35}%)`;
      }
      ctx.fillText(ch, i * cellW + cellW / 2, y);
    }
  }
  ctx.globalAlpha = 1;

  for (let k = 0; k < sparkle.length; k++) sparkle[k] *= 0.9;

  if (inPortal && cameraDenied && !videoReady) {
    ui.status.textContent = 'we could not see you. showing static instead.';
  }
}

// Brightness per cell, mirrored and cropped to cover the screen, auto-contrasted.
function sampleVideo() {
  video.loadPixels();
  const px = video.pixels;
  const vw = video.width, vh = video.height;
  if (!px || !px.length || !vw) return null;

  const scale = Math.max(width / vw, height / vh);
  const offX = (vw * scale - width) / 2;
  const offY = (vh * scale - height) / 2;

  const out = new Float32Array(cols * rows);
  let lo = 255, hi = 0;
  for (let j = 0; j < rows; j++) {
    const vy = Math.min(vh - 1, Math.floor((j * cellH + cellH / 2 + offY) / scale));
    for (let i = 0; i < cols; i++) {
      const vx = Math.min(vw - 1, Math.floor((i * cellW + cellW / 2 + offX) / scale));
      const p = ((vw - 1 - vx) + vy * vw) * 4; // mirrored
      const v = (px[p] * 0.3 + px[p + 1] * 0.59 + px[p + 2] * 0.11);
      out[i + j * cols] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const range = Math.max(40, hi - lo);
  for (let k = 0; k < out.length; k++) out[k] = Math.min(1, Math.max(0, (out[k] - lo) / range));
  return out;
}

function sampleStatic() {
  const out = new Float32Array(cols * rows);
  const t = millis() / 2500;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const n = noise(i * 0.045, j * 0.07, t);
      out[i + j * cols] = Math.max(0, n * 1.6 - 0.45) + Math.random() * 0.08;
    }
  }
  return out;
}

/* ---------- glitter ---------- */

function sprinkle(x, y, radius, strength) {
  const ci = Math.floor(x / cellW), cj = Math.floor(y / cellH);
  for (let dj = -radius; dj <= radius; dj++) {
    for (let di = -radius; di <= radius; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      const d = Math.hypot(di, dj * 1.5) / radius;
      if (d > 1) continue;
      const k = i + j * cols;
      sparkle[k] = Math.max(sparkle[k], strength * (1 - d));
    }
  }
}

function mouseMoved() {
  if (!sparkle) return;
  // Fill the gap between samples so fast strokes leave a continuous trail.
  if (lastMouse) {
    const steps = Math.ceil(dist(lastMouse.x, lastMouse.y, mouseX, mouseY) / cellW);
    for (let s = 1; s <= steps; s++) {
      sprinkle(lerp(lastMouse.x, mouseX, s / steps), lerp(lastMouse.y, mouseY, s / steps), 2, 1);
    }
  }
  lastMouse = { x: mouseX, y: mouseY };
}

function mousePressed(e) {
  // Only clicks on the picture itself; UI buttons handle their own.
  if (e && e.target && e.target.tagName !== 'CANVAS') return;
  sprinkle(mouseX, mouseY, 7, 1.4);
  if (inPortal) nextSet();
}

function mouseWheel(e) {
  if (!inPortal) return;
  fontSize = constrain(fontSize + (e.delta > 0 ? 1 : -1), 7, 36);
  buildGrid();
  updateLabels();
  return false;
}

function keyPressed() {
  if (!inPortal) return;
  if (key === 'c' || key === 'C') nextColor();
  if (key >= '1' && key <= String(SETS.length)) { setIndex = Number(key) - 1; updateLabels(); }
}

function nextSet() { setIndex = (setIndex + 1) % SETS.length; updateLabels(); }
function nextColor() { colorIndex = (colorIndex + 1) % COLORS.length; applyColorMode(); }

/* ---------- interface ---------- */

function buildUI() {
  ui.start = document.getElementById('start');
  ui.toolbar = document.getElementById('toolbar');
  ui.setBtn = document.getElementById('setBtn');
  ui.colorBtn = document.getElementById('colorBtn');
  ui.status = document.getElementById('status');

  document.getElementById('enterBtn').addEventListener('click', enterPortal);
  document.getElementById('exitBtn').addEventListener('click', exitPortal);
  ui.setBtn.addEventListener('click', nextSet);
  ui.colorBtn.addEventListener('click', nextColor);
  updateLabels();
}

function updateLabels() {
  ui.setBtn.textContent = `made of: ${SETS[setIndex].name}`;
  ui.colorBtn.textContent = `glow: ${COLORS[colorIndex]}`;
}

function applyColorMode() {
  document.body.dataset.mode = COLORS[colorIndex];
  updateLabels();
}

function rotateStatus() {
  let i = 0;
  setInterval(() => {
    if (!inPortal || (cameraDenied && !videoReady)) return;
    const line = STATUS[i++ % STATUS.length]
      .replace('{n}', (cols * rows).toLocaleString())
      .replace('{rows}', rows);
    ui.status.textContent = line;
    ui.status.classList.remove('flash');
    void ui.status.offsetWidth;
    ui.status.classList.add('flash');
  }, 5000);
}

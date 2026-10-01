// Surveilled — can you see me?
// Recent frames are held briefly in memory to delay the tiles, then overwritten.
// Nothing is written to storage or sent anywhere.

const VW = 320, VH = 240;      // capture size (also the face tracker's coordinate space)
const BUF = 48;                // frames kept for the delay ripple (~1.6s at 30fps)
const STEP = 4;                // extra frames of delay per ring away from the centre

const TAGS = [
  'subject_01',
  '98% girl',
  'mood: nostalgic',
  'tagged in 212 photos',
  'age: 12? 24? 31?',
  'searching for matches…',
  'resemblance: 64%',
  'last seen: just now',
  'likely to return',
  'smile detected',
  'is this you?',
  'confidence: high'
];

let video = null, videoReady = false, cameraDenied = false;
let tracker = null;
let watching = false;
let frames = [], head = 0, filled = 0;
let tile = 120, cols = 0, rows = 0, panel = {};
let concern = null;
let tags = [], nextTagAt = 0;
let sndCode, sndCamera, sndNoise;

function preload() {
  sndCode = loadSound('sonicpicode.wav');
  sndCamera = loadSound('camera.mp3');
  sndNoise = loadSound('wirednoises.m4a');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(30);
  sndNoise.setVolume(0.4);
  sndCode.setVolume(0.8);
  for (let i = 0; i < BUF; i++) {
    const c = document.createElement('canvas');
    c.width = VW; c.height = VH;
    frames.push(c);
  }
  layout();
  buildPopups();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layout();
}

function layout() {
  tile = Math.max(90, Math.floor(Math.min(width, height) / 6));
  cols = Math.ceil(width / tile);
  rows = Math.ceil(height / tile);
  const pw = Math.min(width * 0.46, tile * 3.4);
  const ph = pw * 0.75;
  panel = { x: (width - pw) / 2, y: (height - ph) / 2, w: pw, h: ph };
}

/* ---------- camera ---------- */

function startWatching() {
  watching = true;
  cameraDenied = false;
  document.getElementById('popups').hidden = true;
  document.getElementById('hud').hidden = false;
  if (window.NetSession) NetSession.setCameraActive(true);
  userStartAudio();
  sndCamera.play();
  if (!sndNoise.isPlaying()) sndNoise.loop();

  video = createCapture(VIDEO, () => {
    videoReady = true;
    tracker = new clm.tracker();
    tracker.init();
    tracker.start(video.elt);
  });
  video.size(VW, VH);
  video.hide();
  setTimeout(() => { if (!videoReady) cameraDenied = true; }, 6000);
}

function stopWatching() {
  watching = false;
  if (window.NetSession) NetSession.setCameraActive(false);
  if (tracker) { tracker.stop(); tracker = null; }
  if (video) {
    const stream = video.elt.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    video.remove();
    video = null;
  }
  videoReady = false;
  filled = 0;
  sndNoise.stop();
  document.getElementById('hud').hidden = true;
  resetPopups();
}

/* ---------- drawing ---------- */

function draw() {
  background(255);
  if (!watching) { drawIdle(); return; }
  if (!videoReady) { drawNoSignal(cameraDenied ? 'we could not see you.' : 'connecting…'); return; }

  // Capture the newest frame, mirrored, into the ring buffer.
  const c = frames[head].getContext('2d');
  c.setTransform(-1, 0, 0, 1, VW, 0);
  c.drawImage(video.elt, 0, 0, VW, VH);
  head = (head + 1) % BUF;
  filled = Math.min(BUF, filled + 1);

  const ctx = drawingContext;
  const ci = (cols - 1) / 2, cj = (rows - 1) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * tile, y = j * tile;
      const ring = Math.max(Math.abs(i - ci), Math.abs(j - cj));
      const delay = Math.min(filled - 1, Math.round(ring * STEP));
      const f = frames[(head - 1 - delay + BUF * 2) % BUF];
      // Crop the 4:3 frame to a square tile.
      ctx.drawImage(f, (VW - VH) / 2, 0, VH, VH, x + 2, y + 2, tile - 4, tile - 4);
    }
  }

  // Wash the delayed tiles so the live panel reads as "now".
  noStroke();
  fill(255, 255, 255, 70);
  rect(0, 0, width, height);

  ctx.drawImage(frames[(head - 1 + BUF) % BUF], panel.x, panel.y, panel.w, panel.h);
  stroke(255, 0, 0);
  strokeWeight(3);
  noFill();
  rect(panel.x, panel.y, panel.w, panel.h);
  drawRecDot();
  drawFace();
}

function drawRecDot() {
  if (Math.floor(millis() / 600) % 2) return;
  noStroke();
  fill(255, 0, 0);
  circle(panel.x + 16, panel.y + 16, 10);
  fill(255);
  textFont('Courier New');
  textStyle(BOLD);
  textSize(12);
  textAlign(LEFT, CENTER);
  text('LIVE', panel.x + 26, panel.y + 16);
}

function drawFace() {
  const pos = tracker && tracker.getCurrentPosition();
  if (!pos) return;

  const sx = panel.w / VW, sy = panel.h / VH;
  const px = (p) => panel.x + (VW - p[0]) * sx; // mirrored to match the picture
  const py = (p) => panel.y + p[1] * sy;

  stroke(255, 0, 0);
  strokeWeight(1.5);
  noFill();
  beginShape();
  for (const p of pos) vertex(px(p), py(p));
  endShape(CLOSE);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pos) {
    minX = Math.min(minX, px(p)); maxX = Math.max(maxX, px(p));
    minY = Math.min(minY, py(p)); maxY = Math.max(maxY, py(p));
  }
  strokeWeight(2);
  const pad = 14;
  corners(minX - pad, minY - pad * 2, maxX + pad, maxY + pad);
  drawTags(maxX + pad + 8, minY - pad * 2);
}

function corners(x1, y1, x2, y2) {
  const l = 14;
  line(x1, y1, x1 + l, y1); line(x1, y1, x1, y1 + l);
  line(x2, y1, x2 - l, y1); line(x2, y1, x2, y1 + l);
  line(x1, y2, x1 + l, y2); line(x1, y2, x1, y2 - l);
  line(x2, y2, x2 - l, y2); line(x2, y2, x2, y2 - l);
}

function drawTags(x, y) {
  if (millis() > nextTagAt) {
    const pool = TAGS.filter((t) => !tags.includes(t));
    tags.push(random(pool));
    if (concern && !tags.includes(concern) && Math.random() < 0.35) tags.push(concern);
    while (tags.length > 5) tags.shift();
    nextTagAt = millis() + 1400;
  }
  textFont('Courier New');
  textStyle(BOLD);
  textSize(12);
  textAlign(LEFT, TOP);
  tags.forEach((t, n) => {
    const ty = y + n * 20;
    noStroke();
    fill(255, 0, 0);
    rect(x, ty, textWidth(t) + 10, 16);
    fill(255);
    text(t, x + 5, ty + 2);
  });
}

function drawIdle() {
  // Empty monitors, waiting.
  stroke(230);
  strokeWeight(1);
  noFill();
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) rect(i * tile + 2, j * tile + 2, tile - 4, tile - 4);
}

function drawNoSignal(msg) {
  drawIdle();
  noStroke();
  for (let n = 0; n < 1600; n++) {
    fill(random(120, 255));
    rect(panel.x + random(panel.w), panel.y + random(panel.h), 3, 3);
  }
  stroke(255, 0, 0);
  strokeWeight(3);
  noFill();
  rect(panel.x, panel.y, panel.w, panel.h);
  noStroke();
  fill(0);
  textFont('Courier New');
  textStyle(BOLD);
  textSize(18);
  textAlign(CENTER, CENTER);
  text(msg, width / 2, panel.y + panel.h + 26);
}

/* ---------- pop-up questions ---------- */

const STEPS = [
  {
    title: 'net.timeline',
    text: 'what bothers you more?',
    buttons: [
      { label: 'the symbiosis of your body and machine', concern: 'concern: the machine' },
      { label: 'the one above you, surveilling, learning, orchestrating', concern: 'concern: the watcher' }
    ]
  },
  {
    title: 'net.timeline',
    text: 'are you sure they are different?',
    buttons: [{ label: 'no' }, { label: 'yes' }]
  },
  {
    title: 'camera',
    text: 'can you see me?',
    buttons: [{ label: 'hello', start: true }]
  }
];

let step = 0;

function buildPopups() {
  document.getElementById('goodbye').addEventListener('click', stopWatching);
  showStep(0);
}

function resetPopups() {
  const box = document.getElementById('popups');
  box.innerHTML = '';
  box.hidden = false;
  showStep(0);
}

function showStep(n) {
  step = n;
  const s = STEPS[n];
  const box = document.getElementById('popups');
  const win = document.createElement('div');
  win.className = 'popup';
  win.style.setProperty('--n', n);
  win.innerHTML =
    '<div class="popup-titlebar"><span></span><i aria-hidden="true">×</i></div>' +
    '<div class="popup-body"><span class="popup-icon" aria-hidden="true">?</span><p></p></div>' +
    '<div class="popup-buttons"></div>';
  win.querySelector('.popup-titlebar span').textContent = s.title;
  win.querySelector('.popup-body p').textContent = s.text;
  const row = win.querySelector('.popup-buttons');
  s.buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.label;
    btn.addEventListener('click', () => choose(b, win));
    row.appendChild(btn);
  });
  box.appendChild(win);
  row.querySelector('button').focus({ preventScroll: true });
}

function choose(b, win) {
  if (step === 0) {
    userStartAudio();
    if (!sndCode.isPlaying()) sndCode.play();
  }
  if (b.concern) concern = b.concern;
  win.classList.add('answered');
  win.querySelectorAll('button').forEach((x) => { x.disabled = true; });
  if (b.start) startWatching();
  else if (step + 1 < STEPS.length) showStep(step + 1);
}

// Surveilled — can you see me?
// Recent frames are held briefly in memory to delay the tiles, then overwritten.
// Nothing is written to storage or sent anywhere.

const VW = 320, VH = 240;      // capture size (also the face tracker's coordinate space)
const BUF = 48;                // frames kept for the delay ripple (~1.6s at 30fps)
const STEP = 4;                // extra frames of delay per ring away from the centre


let video = null, videoReady = false, cameraDenied = false;
let tracker = null;
let watching = false;
let frames = [], head = 0, filled = 0;
let tile = 120, cols = 0, rows = 0, panel = {};
let concern = null;
let extracted = 0;
let profile = null;
let watchingSince = 0;
let lookingSince = null;
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
  watchingSince = millis();
  lookingSince = null;
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
  profile = null;
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
  extracted += pos.length * 2;
  drawReadout(maxX + pad + 10, minY - pad * 2, pos);
}

function corners(x1, y1, x2, y2) {
  const l = 14;
  line(x1, y1, x1 + l, y1); line(x1, y1, x1, y1 + l);
  line(x2, y1, x2 - l, y1); line(x2, y1, x2, y1 + l);
  line(x1, y2, x1 + l, y2); line(x1, y2, x1, y2 - l);
  line(x2, y2, x2 - l, y2); line(x2, y2, x2, y2 - l);
}

// Everything here is computed from the current frame and discarded with it.
function readout(pos) {
  const d = (a, b) => Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
  const faceW = d(1, 13);
  const tilt = Math.atan2(pos[32][1] - pos[27][1], pos[32][0] - pos[27][0]) * 180 / Math.PI;
  const mouthW = d(44, 50), mouthH = d(47, 53);
  const expression = mouthH / mouthW > 0.38 ? 'speaking' : mouthW / faceW > 0.42 ? 'smiling' : 'neutral';

  // Attention: is the nose centred between the eyes (facing the screen)?
  const eyeMidX = (pos[27][0] + pos[32][0]) / 2;
  const yaw = (pos[62][0] - eyeMidX) / Math.max(1, d(27, 32));
  const onScreen = Math.abs(yaw) < 0.25;
  if (onScreen && lookingSince === null) lookingSince = millis();
  if (!onScreen) lookingSince = null;
  const attention = onScreen ? 'on screen (' + ((millis() - lookingSince) / 1000).toFixed(1) + 's)' : 'looking away';

  const dwell = Math.floor((millis() - watchingSince) / 1000);
  const dwellText = String(Math.floor(dwell / 60)).padStart(2, '0') + ':' + String(dwell % 60).padStart(2, '0');

  // A "faceprint" from the landmark geometry: it changes as you move.
  let h = 2166136261;
  for (let i = 0; i < pos.length; i += 3) {
    h ^= Math.round(((pos[i][0] - pos[0][0]) / faceW) * 40) & 0xff;
    h = Math.imul(h, 16777619);
    h ^= Math.round(((pos[i][1] - pos[0][1]) / faceW) * 40) & 0xff;
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0') + Math.round(faceW * 97).toString(16).padStart(4, '0');

  if (!profile) {
    profile = {
      age: random(['14–17', '18–24', '19–24', '25–34']),
      segment: random(['beauty / nostalgia', 'fashion / teen', 'wellness / self-image', 'gaming / casual'])
    };
  }

  return [
    ['faceprint', hex.match(/.{4}/g).join('·')],
    ...lastSeenRow(),
    ['landmarks', pos.length + ' / 71 tracked'],
    ['head tilt', (tilt >= 0 ? '+' : '−') + Math.abs(tilt).toFixed(1) + '°'],
    ['distance', '~' + Math.round(4200 / faceW) + ' cm'],
    ['expression', expression],
    ['attention', attention],
    ['dwell time', dwellText],
    ['age_est', profile.age + ' (' + (0.55 + noise(millis() / 3000) * 0.4).toFixed(2) + ')'],
    ['ad_segment', profile.segment],
    ['est_value', '$' + (0.003 + noise(millis() / 5000 + 9) * 0.003).toFixed(4) + ' / impression'],
    ['likely to', 'return'],
    ['consent', 'assumed'],
    ['concern', concern || '—'],
    ['shared with', '0 partners (here)'],
    ['retention', 'until you look away']
  ];
}

// "last seen in: mirror (2m ago)", from this visit's trail.
function lastSeenRow() {
  const prev = window.NetSession && NetSession.previousPortal();
  if (!prev) return [];
  const sec = Math.round(prev.agoMs / 1000);
  const ago = sec < 60 ? sec + 's ago' : Math.floor(sec / 60) + 'm ago';
  return [['last seen in', prev.label + ' (' + ago + ')']];
}

function drawReadout(x, y, pos) {
  const rows = readout(pos);
  const lh = 17, w = 320;
  const x0 = Math.min(x, width - w - 12);
  const h = lh * (rows.length + 3) + 10;
  const y0 = constrain(y, 12, height - h - 60);

  noStroke();
  fill(0, 0, 0, 200);
  rect(x0, y0, w, h);
  fill(255, 0, 0);
  rect(x0, y0, w, lh + 4);

  textFont('Courier New');
  textStyle(BOLD);
  textSize(12);
  textAlign(LEFT, TOP);
  fill(255);
  const who = window.NetSession && NetSession.firstName();
  text('SUBJECT: ' + (who ? who.toUpperCase() : '01'), x0 + 8, y0 + 4);

  rows.forEach(([k, v], n) => {
    const ty = y0 + lh * (n + 1) + 8;
    fill(150);
    text(k, x0 + 8, ty);
    fill(255);
    text(v, x0 + 112, ty);
  });

  fill(255, 80, 80);
  text('points extracted', x0 + 8, y0 + h - lh - 4);
  text(extracted.toLocaleString(), x0 + 160, y0 + h - lh - 4);
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
    note: 'we value your privacy.',
    buttons: [
      { label: 'the symbiosis of your body and machine', concern: 'the machine', primary: true },
      { label: 'the one above you, surveilling, learning, orchestrating', concern: 'the watcher' }
    ]
  },
  {
    title: 'net.timeline',
    text: 'are you sure they are different?',
    buttons: [{ label: 'no', primary: true }, { label: 'yes' }]
  },
  {
    title: 'camera',
    text: 'can you see me?',
    receive: ['Your face', 'Your expressions', 'How close you are', 'Where you are looking', 'How long you stay'],
    buttons: [{ label: 'hello', start: true, primary: true }]
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

// Styled after the 2012-era app permission dialog.
function showStep(n) {
  step = n;
  const s = STEPS[n];
  const box = document.getElementById('popups');
  box.innerHTML = '';
  const dlg = document.createElement('div');
  dlg.className = 'perm';
  dlg.innerHTML =
    '<div class="perm-inner">' +
      '<div class="perm-title">Request for Permission</div>' +
      '<div class="perm-body">' +
        '<div class="perm-app"><span class="perm-icon" aria-hidden="true">n.t</span>' +
          '<span><a class="perm-name">net.timeline</a> <span class="perm-asks"></span></span></div>' +
        '<p class="perm-question"></p>' +
      '</div>' +
      '<div class="perm-footer"><span class="perm-note"></span><span class="perm-buttons"></span></div>' +
    '</div>';
  dlg.querySelector('.perm-asks').textContent = s.receive ? 'is requesting permission to:' : 'would like to know:';
  dlg.querySelector('.perm-question').textContent = s.text;
  dlg.querySelector('.perm-note').textContent = s.note || '';

  if (s.receive) {
    const list = document.createElement('div');
    list.className = 'perm-receive';
    list.innerHTML = '<p class="perm-receive-head">THIS APP WILL RECEIVE:</p><ul></ul>';
    s.receive.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.querySelector('ul').appendChild(li);
    });
    dlg.querySelector('.perm-body').insertBefore(list, dlg.querySelector('.perm-question'));
  }

  const row = dlg.querySelector('.perm-buttons');
  s.buttons.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = b.primary ? 'perm-btn perm-btn--blue' : 'perm-btn';
    btn.textContent = b.label;
    btn.addEventListener('click', () => choose(b, dlg));
    row.appendChild(btn);
  });
  box.appendChild(dlg);
  row.querySelector('button').focus({ preventScroll: true });
}

function choose(b, win) {
  if (step === 0) {
    userStartAudio();
    if (!sndCode.isPlaying()) sndCode.play();
  }
  if (b.concern) concern = b.concern;
  win.querySelectorAll('button').forEach((x) => { x.disabled = true; });
  if (b.start) startWatching();
  else if (step + 1 < STEPS.length) showStep(step + 1);
}

// Nostalgia, Looped — revisiting old tabs. Hotspot positions are in the
// original 600×600 scene space; the canvas scales up to fit the screen.

const SIZE = 600;

const SCENES = {
  0: {
    img: 'fb.png', title: 'Facebook', url: 'memory://facebook/feb-5-2012',
    spots: [
      { x: 100, y: 270, to: 16, label: '1' },
      { x: 175, y: 175, to: 2,  label: '2' },
      { x: 500, y: 75,  to: 1,  label: '3' },
      { x: 310, y: 400, to: 4,  label: '4' }
    ]
  },
  1:  { img: 'pouch.png',    title: 'Pixie Hollow', url: 'memory://pixie-hollow/my-pouch',      flash: true, spots: [{ x: 50, y: 350, back: true }] },
  2:  { img: 'myth.jpg',     title: 'Poptropica',   url: 'memory://poptropica/mythology-island', flash: true, spots: [{ x: 50, y: 350, back: true }] },
  16: { img: 'stardoll.png', title: 'Stardoll',     url: 'memory://stardoll/pick-a-style',
        spots: [{ x: 75, y: 500, back: true }, { x: 320, y: 320, to: 17, label: '♡' }] },
  17: { img: 'squish.jpg',   title: 'squishies!!',  url: 'memory://stardoll/squishies',  spots: [{ x: 75, y: 525, back: true }] },
  4:  { img: 'kisslos.png',  title: 'kiss game',    url: 'memory://kiss-game/game-over', spots: [{ x: 75, y: 525, back: true }] }
};

const MEMORIES = [1, 2, 4, 16, 17];
const HIT_RADIUS = 20;
const LOAD_MS = 700;

let images = {};
let music;
let muted = false;
let k = 1;

let tabs = [];          // { id, history: [scene…], flashRun: Set<scene> }
let active = 0;
let nextTabId = 1;
let visited = new Set(); // "scene:index" of dots already clicked
let opened = new Set();  // memories opened this loop
let loading = null;      // { tab, from, to, start }
let crashed = false;
let restoreTabs = null;
let hover = null;

let el = {};

function preload() {
  for (const id in SCENES) images[id] = loadImage(SCENES[id].img);
  music = loadSound('pon.m4a');
}

function setup() {
  el.tabs = document.getElementById('tabs');
  el.url = document.getElementById('omnibox');
  el.bubble = document.getElementById('bubble');
  el.sound = document.getElementById('soundBtn');
  el.back = document.getElementById('backBtn');
  el.crash = document.getElementById('crash');
  el.browser = document.querySelector('.browser');

  el.sound.addEventListener('click', toggleSound);
  el.back.addEventListener('click', goBack);
  document.getElementById('restoreBtn').addEventListener('click', restore);

  const c = createCanvas(SIZE, SIZE);
  c.parent('viewport');
  fit();

  tabs = [newTab(0)];
  render();
}

function windowResized() { fit(); }

function fit() {
  const s = Math.floor(Math.min(windowWidth - 40, windowHeight - 200, 900));
  k = s / SIZE;
  resizeCanvas(s, s);
  // The window is exactly as wide as the page, so extra tabs squeeze instead of widening it.
  if (el.browser) el.browser.style.width = s + 'px';
}

function newTab(scene) {
  return { id: nextTabId++, history: [scene], flashRun: new Set() };
}

function tab() { return tabs[active]; }
function current() { const t = tab(); return t ? t.history[t.history.length - 1] : null; }

/* ---------- drawing ---------- */

function draw() {
  const sc = shownScene();
  hover = null;

  if (sc === null) {
    drawNewTabPage();
  } else if (needsFlash(sc)) {
    drawFlashPlaceholder();
  } else {
    drawScene(sc);
  }
}

// While loading, the old page stays up until the new one "arrives".
function shownScene() {
  if (crashed) return null;
  if (loading && loading.tab === tab() && millis() - loading.start < LOAD_MS * 0.6) return loading.from;
  return current();
}

function needsFlash(sc) {
  return SCENES[sc] && SCENES[sc].flash && !tab().flashRun.has(sc);
}

function drawScene(sc) {
  push();
  scale(k);
  image(images[sc], 0, 0, SIZE, SIZE);
  const mx = mouseX / k, my = mouseY / k;
  SCENES[sc].spots.forEach((spot, n) => {
    const over = !loading && dist(mx, my, spot.x, spot.y) < HIT_RADIUS;
    if (over) hover = spot;
    const seen = visited.has(sc + ':' + n);
    noStroke();
    // Clicked dots turn visited-link purple.
    fill(seen ? color(85, 26, 139) : color(255, 105, 180));
    circle(spot.x, spot.y, over ? 26 : 20);
    if (spot.label) {
      fill(seen ? 255 : 0);
      textAlign(CENTER, CENTER);
      textSize(12);
      text(spot.label, spot.x, spot.y + 1);
    }
  });
  pop();
  setCursor(loading ? 'progress' : hover ? 'pointer' : 'default');
}

function drawFlashPlaceholder() {
  background(64);
  const cx = width / 2, cy = height / 2, s = Math.min(width, height) / 7;
  // Puzzle piece
  noStroke();
  fill(200);
  rectMode(CENTER);
  rect(cx, cy, s, s, 4);
  circle(cx, cy - s / 2, s * 0.38);
  circle(cx + s / 2, cy, s * 0.38);
  fill(64);
  circle(cx - s / 2, cy, s * 0.34);
  rectMode(CORNER);

  fill(225);
  textAlign(CENTER, TOP);
  textFont('Lucida Grande, Segoe UI, Tahoma, sans-serif');
  textSize(Math.max(12, s * 0.17));
  text('Click to run Adobe Flash Player.', cx, cy + s * 0.85);
  setCursor(loading ? 'progress' : 'pointer');
}

function drawNewTabPage() {
  background(242);
  setCursor(loading ? 'progress' : 'default');
}

function setCursor(c) {
  if (document.body.style.cursor !== c) document.body.style.cursor = c;
}

function finishLoading() {
  loading = null;
  el.bubble.hidden = true;
  render();
  checkLoop();
}

/* ---------- interaction ---------- */

function mousePressed(e) {
  if (e && e.target && e.target.tagName !== 'CANVAS') return;
  if (crashed || loading || !tab()) return;
  startMusic();

  const sc = current();
  if (needsFlash(sc)) {
    tab().flashRun.add(sc);
    startLoading(tab(), sc, sc, 'Loading Adobe Flash Player...');
    return;
  }

  const spots = SCENES[sc].spots;
  const n = spots.findIndex((s) => dist(mouseX / k, mouseY / k, s.x, s.y) < HIT_RADIUS);
  if (n < 0) return;
  visited.add(sc + ':' + n);

  const spot = spots[n];
  if (spot.back) { goBack(); return; }
  openMemory(spot.to);
}

// Each memory opens in its own tab; one that's already open is brought forward.
function openMemory(scene) {
  const existing = tabs.findIndex((t) => t.history[t.history.length - 1] === scene);
  if (existing >= 0) { active = existing; render(); checkLoop(); return; }
  const t = newTab(scene);
  tabs.push(t);
  active = tabs.length - 1;
  startLoading(t, null, scene);
}

function goBack() {
  const t = tab();
  if (!t || loading) return;
  if (t.history.length > 1) {
    const from = t.history.pop();
    startLoading(t, from, current());
  } else {
    // A memory with nowhere to go back to returns you to Facebook.
    openMemory(0);
  }
}

function closeTab(i) {
  if (loading) return;
  tabs.splice(i, 1);
  if (!tabs.length) tabs.push(newTab(0));
  active = Math.min(active >= i ? Math.max(0, active - 1) : active, tabs.length - 1);
  render();
}

function startLoading(t, from, to, message) {
  loading = { tab: t, from, to, start: millis() };
  setTimeout(finishLoading, LOAD_MS);
  el.bubble.textContent = message || 'Waiting for ' + SCENES[to].url.replace('memory://', '') + '...';
  el.bubble.hidden = false;
  render();
}

/* ---------- the loop ---------- */

// After every memory has been opened, the browser "crashes" and offers to restore.
let crashTimer = null;

function checkLoop() {
  if (crashed || crashTimer || !MEMORIES.every((m) => opened.has(m))) return;
  crashTimer = setTimeout(() => {
    crashTimer = null;
    crashed = true;
    restoreTabs = tabs.map((t) => t.history.slice());
    tabs = [{ id: nextTabId++, history: [null], flashRun: new Set() }];
    active = 0;
    render();
    setTimeout(() => { el.crash.hidden = false; }, 900);
  }, 1600);
}

function restore() {
  el.crash.hidden = true;
  crashed = false;
  tabs = restoreTabs.map((h) => ({ id: nextTabId++, history: h, flashRun: new Set() }));
  active = 0;
  visited.clear();
  opened.clear();
  render();
  if (!muted) { music.stop(); music.startedOnce = false; startMusic(); }
}

/* ---------- sound ---------- */

// The song plays once per loop; it never restarts on top of itself.
function startMusic() {
  if (muted || music.isPlaying() || music.startedOnce) return;
  userStartAudio();
  music.setVolume(0.6);
  music.play();
  music.startedOnce = true;
}

function toggleSound() {
  muted = !muted;
  music.setVolume(muted ? 0 : 0.6);
  el.sound.textContent = muted ? '♪ sound off' : '♪ sound on';
  el.sound.setAttribute('aria-pressed', String(!muted));
  if (!muted) startMusic();
}

/* ---------- browser chrome ---------- */

function render() {
  el.tabs.innerHTML = '';
  tabs.forEach((t, i) => {
    const sc = t.history[t.history.length - 1];
    const div = document.createElement('div');
    div.className = 'tab' + (i === active ? ' tab--active' : '');
    const isLoading = loading && loading.tab === t;
    div.innerHTML =
      (isLoading ? '<span class="spinner"></span>' : '') +
      '<span class="tab-title"></span>' +
      '<button type="button" class="tab-close" aria-label="Close tab">×</button>';
    div.querySelector('.tab-title').textContent = sc === null ? 'New Tab' : SCENES[sc].title;
    div.addEventListener('click', () => {
      if (loading || crashed) return;
      active = i;
      render();
      checkLoop();
    });
    div.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!crashed) closeTab(i);
    });
    el.tabs.appendChild(div);
  });

  const sc = current();
  // A memory counts once you've actually looked at it (Flash included).
  if (!crashed && !loading && MEMORIES.includes(sc) && !needsFlash(sc)) opened.add(sc);
  el.url.textContent = sc === null ? '' : SCENES[sc].url;
  document.title = (sc === null ? 'New Tab' : SCENES[sc].title) + ' — Nostalgia, Looped';
  el.back.disabled = crashed || !tab() || (tab().history.length <= 1 && sc === 0);
}

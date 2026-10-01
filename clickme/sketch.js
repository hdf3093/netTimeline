// Nostalgia, Looped — revisiting old windows. Hotspot positions are in the
// original 600×600 scene space; the canvas scales up to fit the screen.

const SIZE = 600;

const SCENES = {
  0: {
    img: 'fb.png', title: 'Facebook — Feb 5, 2012', url: 'memory://facebook/feb-5-2012',
    spots: [
      { x: 500, y: 75,  to: 1,  label: '1' },
      { x: 100, y: 270, to: 16, label: '2' },
      { x: 175, y: 175, to: 2,  label: '3' },
      { x: 310, y: 400, to: 4,  label: '4' }
    ]
  },
  1:  { img: 'pouch.png',    title: 'Pixie Hollow — My Pouch',       url: 'memory://pixie-hollow/my-pouch',      spots: [{ x: 50, y: 350, to: 0, back: true }] },
  2:  { img: 'myth.jpg',     title: 'Poptropica — Mythology Island', url: 'memory://poptropica/mythology-island', spots: [{ x: 50, y: 350, to: 0, back: true }] },
  16: { img: 'stardoll.png', title: 'Stardoll — Pick a Style',       url: 'memory://stardoll/pick-a-style',
        spots: [{ x: 75, y: 500, to: 0, back: true }, { x: 320, y: 320, to: 17, label: '♡' }] },
  17: { img: 'squish.jpg',   title: 'rare squishy grab bag!!',       url: 'memory://stardoll/squishies',         spots: [{ x: 75, y: 525, to: 16, back: true }] },
  4:  { img: 'kisslos.png',  title: 'kiss game — score ♡ 0',         url: 'memory://kiss-game/game-over',        spots: [{ x: 75, y: 525, to: 0, back: true }] }
};

const MEMORIES = [1, 2, 16, 17, 4];
const HIT_RADIUS = 22;

let images = {};
let pon;
let scene = 0;
let found = new Set();
let k = 1; // scene → canvas scale
let loading = null; // { to, start }
let hover = null;
let soundStarted = false;

let el = {};

function preload() {
  for (const id in SCENES) images[id] = loadImage(SCENES[id].img);
  pon = loadSound('pon.m4a');
}

function setup() {
  el.window = document.getElementById('window');
  el.title = document.getElementById('winTitle');
  el.url = document.getElementById('winUrl');
  el.status = document.getElementById('winStatus');
  el.count = document.getElementById('count');
  el.done = document.getElementById('done');
  document.getElementById('again').addEventListener('click', loopAgain);

  const c = createCanvas(SIZE, SIZE);
  c.parent('viewport');
  fit();
  updateChrome();
  updateCount();
  installGlitter();
}

function windowResized() { fit(); }

function fit() {
  // Leave room for the window chrome (~110px) and the page margins.
  const s = Math.floor(Math.min(windowWidth - 40, windowHeight - 170, 900));
  k = s / SIZE;
  resizeCanvas(s, s);
}

/* ---------- drawing ---------- */

function draw() {
  push();
  scale(k);
  image(images[scene], 0, 0, SIZE, SIZE);

  const mx = mouseX / k, my = mouseY / k;
  hover = null;
  const t = millis() / 1000;

  for (const spot of SCENES[scene].spots) {
    const over = !loading && dist(mx, my, spot.x, spot.y) < HIT_RADIUS;
    if (over) hover = spot;
    const pulse = (Math.sin(t * 4 + spot.x) + 1) / 2;

    noFill();
    stroke(255, 105, 180, 90 + pulse * 120);
    strokeWeight(3);
    circle(spot.x, spot.y, 26 + pulse * 18 + (over ? 10 : 0));

    if (spot.back) { stroke(255, 105, 180); strokeWeight(2); fill(255); }
    else { noStroke(); fill(255, 105, 180); }
    circle(spot.x, spot.y, over ? 30 : 22);

    noStroke();
    fill(spot.back ? color(255, 60, 160) : color(0));
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(over ? 15 : 12);
    text(spot.back ? '↩' : spot.label, spot.x, spot.y + 1);
  }
  pop();

  cursor(hover ? HAND : ARROW);
  drawLoading();
}

// Dial-up style transition: the window dims, the status bar fills, then the scene swaps.
function drawLoading() {
  if (!loading) return;
  const p = Math.min(1, (millis() - loading.start) / 650);
  fill(255, 240, 250, 200 * (1 - Math.abs(p * 2 - 1)));
  noStroke();
  rect(0, 0, width, height);
  el.status.textContent = 'loading memory… ' + '█'.repeat(Math.round(p * 12)).padEnd(12, '░') + ' ' + Math.round(p * 100) + '%';
  if (p >= 0.5 && scene !== loading.to) {
    scene = loading.to;
    updateChrome();
  }
  if (p >= 1) {
    const to = loading.to;
    loading = null;
    el.status.textContent = 'Done';
    if (MEMORIES.includes(to) && !found.has(to)) remember(to);
  }
}

/* ---------- interaction ---------- */

function mousePressed(e) {
  if (e && e.target && e.target.tagName !== 'CANVAS') return;
  if (!soundStarted) { userStartAudio(); soundStarted = true; pon.play(); }
  if (hover && !loading) loading = { to: hover.to, start: millis() };
}

function remember(id) {
  found.add(id);
  updateCount();
  pon.play();
  el.window.classList.remove('nudge');
  void el.window.offsetWidth;
  el.window.classList.add('nudge');
  if (found.size === MEMORIES.length) setTimeout(() => { el.done.hidden = false; }, 700);
}

function loopAgain() {
  found.clear();
  el.done.hidden = true;
  updateCount();
  loading = { to: 0, start: millis() };
}

function updateChrome() {
  el.title.textContent = SCENES[scene].title;
  el.url.textContent = SCENES[scene].url;
}

function updateCount() {
  el.count.textContent = `memories found: ${found.size}/${MEMORIES.length} ` +
    '♥'.repeat(found.size) + '♡'.repeat(MEMORIES.length - found.size);
}

/* ---------- glitter cursor ---------- */

function installGlitter() {
  const GLYPHS = ['✦', '✧', '⋆', '♡', '·'];
  let last = 0;
  document.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - last < 35) return;
    last = now;
    const s = document.createElement('span');
    s.className = 'glitter';
    s.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    s.style.left = e.clientX + (Math.random() * 16 - 8) + 'px';
    s.style.top = e.clientY + (Math.random() * 16 - 8) + 'px';
    s.style.color = `hsl(${300 + Math.random() * 60}, 100%, ${70 + Math.random() * 20}%)`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  });
}

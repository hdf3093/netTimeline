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
  1:  { img: 'pouch.png',    title: 'Pixie Hollow',  url: 'memory://pixie-hollow/my-pouch',      spots: [{ x: 50, y: 350, to: 0 }] },
  2:  { img: 'myth.jpg',     title: 'Poptropica',    url: 'memory://poptropica/mythology-island', spots: [{ x: 50, y: 350, to: 0 }] },
  16: { img: 'stardoll.png', title: 'Stardoll',      url: 'memory://stardoll/pick-a-style',
        spots: [{ x: 75, y: 500, to: 0 }, { x: 320, y: 320, to: 17 }] },
  17: { img: 'squish.jpg',   title: 'squishies!!',   url: 'memory://stardoll/squishies',         spots: [{ x: 75, y: 525, to: 16 }] },
  4:  { img: 'kisslos.png',  title: 'kiss game',     url: 'memory://kiss-game/game-over',        spots: [{ x: 75, y: 525, to: 0 }] }
};

const HIT_RADIUS = 20;

let images = {};
let music;
let muted = false;
let scene = 0;
let visited = new Set(); // "scene:index" of dots already clicked
let k = 1;
let loading = null;      // { to, start }
let hover = null;

let el = {};

function preload() {
  for (const id in SCENES) images[id] = loadImage(SCENES[id].img);
  music = loadSound('pon.m4a');
}

function setup() {
  el.tab = document.getElementById('tabTitle');
  el.url = document.getElementById('omnibox');
  el.spinner = document.getElementById('spinner');
  el.bubble = document.getElementById('bubble');
  el.sound = document.getElementById('soundBtn');
  el.back = document.getElementById('backBtn');
  el.sound.addEventListener('click', toggleSound);
  el.back.addEventListener('click', () => { if (scene !== 0 && !loading) go(SCENES[scene].spots[0].to); });

  const c = createCanvas(SIZE, SIZE);
  c.parent('viewport');
  fit();
  updateChrome();
}

function windowResized() { fit(); }

function fit() {
  // Leave room for the browser chrome (~76px), the sound button and page margins.
  const s = Math.floor(Math.min(windowWidth - 40, windowHeight - 150, 900));
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

  SCENES[scene].spots.forEach((spot, n) => {
    const over = !loading && dist(mx, my, spot.x, spot.y) < HIT_RADIUS;
    if (over) hover = spot;
    const seen = visited.has(scene + ':' + n);

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

  cursor(hover ? HAND : ARROW);
  updateLoading();
}

function updateLoading() {
  if (!loading) return;
  const p = (millis() - loading.start) / 700;
  if (p >= 0.6 && scene !== loading.to) {
    scene = loading.to;
    updateChrome();
  }
  if (p >= 1) {
    loading = null;
    el.spinner.hidden = true;
    el.bubble.hidden = true;
  }
}

/* ---------- interaction ---------- */

function mousePressed(e) {
  if (e && e.target && e.target.tagName !== 'CANVAS') return;
  startMusic();
  if (loading) return;
  const spots = SCENES[scene].spots;
  const n = spots.findIndex((s) => dist(mouseX / k, mouseY / k, s.x, s.y) < HIT_RADIUS);
  if (n < 0) return;
  visited.add(scene + ':' + n);
  go(spots[n].to);
}

function go(to) {
  loading = { to, start: millis() };
  el.spinner.hidden = false;
  el.bubble.textContent = 'Waiting for ' + SCENES[to].url.replace('memory://', '') + '...';
  el.bubble.hidden = false;
}

// The song plays once from the first click; it never restarts on top of itself.
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

function updateChrome() {
  el.tab.textContent = SCENES[scene].title;
  el.url.textContent = SCENES[scene].url;
  document.title = SCENES[scene].title + ' — Nostalgia, Looped';
  el.back.disabled = scene === 0;
}

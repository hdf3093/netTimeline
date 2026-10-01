/* net.timeline — session, tracker & kiosk system
 *
 * Include on every page, in <head>:
 *   <script src="/session/session.js" data-portal="nostalgia"></script>
 *
 *   data-portal  id of the portal this page is (omit for non-portal pages)
 *   data-page    "gate" on /enter/, "cache" on /cache/, "archive" on /archive/
 *
 * Detailed session data lives in sessionStorage only. When a session ends, a
 * minimal summary is queued in localStorage for the (future) archive backend.
 *
 * Operator shortcut: Ctrl + Alt/Option + Shift + R  → force reset to /enter/.
 * Tune timings on site from the devtools console, e.g.
 *   localStorage.setItem('nt.config', JSON.stringify({ idleMs: 120000 }))
 */
(function () {
  'use strict';

  var CONFIG = {
    idleMs: 90 * 1000,          // no input → session ends for the visitor
    idleExtendedMs: 5 * 60 * 1000, // ceiling while a camera is on or an embed has focus
    resetMs: 60 * 1000,         // cache page → back to /enter/ for the next visitor
    exhibitionId: 'our-images-under-imperialism-2026',
    archiveUrl: '/api/archive'
  };
  try {
    var override = JSON.parse(localStorage.getItem('nt.config') || 'null');
    if (override) for (var k in override) CONFIG[k] = override[k];
  } catch (e) {}

  var KEY = 'nt.session';
  var QUEUE_KEY = 'nt.archiveQueue';
  var ENTER_URL = '/enter/';

  var script = document.currentScript;
  var portalId = (script && script.dataset.portal) || null;
  var page = (script && script.dataset.page) || null;

  var s = load();
  var visit = null;
  var lastTick = null;
  var ending = false;
  var cameraActive = false;
  var lastInput = Date.now();
  var flushing = false;

  /* ---------- storage ---------- */

  function load() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }

  function save() {
    if (!s) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function newId() {
    var bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) {
      return (b % 36).toString(36);
    }).join('');
  }

  function cacheUrl(id) { return '/cache/?id=' + encodeURIComponent(id); }

  /* ---------- guards (run before the page paints) ---------- */

  if (s && s.ended_at && page !== 'cache' && page !== 'archive') {
    location.replace(cacheUrl(s.session_id));
    return;
  }
  if (!s && portalId && page !== 'gate') {
    location.replace(ENTER_URL);
    return;
  }

  // Back/forward cache restores skip script execution; re-run the guards.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) location.reload();
  });

  /* ---------- styles ---------- */

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/session/session.css';
  document.head.appendChild(link);

  /* ---------- public API ---------- */

  window.NetSession = {
    config: CONFIG,
    get: function () { return s; },
    start: start,
    end: end,
    reset: reset,
    summary: function () { return summarize(s); },
    pending: function () { return readQueue().length; },
    setCameraActive: function (on) { cameraActive = !!on; lastInput = Date.now(); },
    // Pages shown inside the desktop's browser window report activity here.
    ping: function (type) {
      lastInput = Date.now();
      if (!s || s.ended_at) return;
      if (type === 'pointerdown') s.clicks++;
      if (type === 'keydown') s.keys++;
    }
  };

  /* ---------- framed pages (inside the desktop's browser window) ---------- */

  // The desktop owns the session; a framed page only reports that you're active.
  if (window.top !== window) {
    var host = null;
    try { host = window.parent.NetSession; } catch (e) {}
    if (host && host.ping) {
      ['pointerdown', 'keydown', 'wheel', 'scroll', 'pointermove'].forEach(function (type) {
        document.addEventListener(type, function () { host.ping(type); }, { capture: true, passive: true });
      });
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyR') { e.preventDefault(); host.reset(); }
      }, true);
    }
    return;
  }

  /* ---------- operator shortcut (works with or without a session) ---------- */

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyR') {
      e.preventDefault();
      reset();
    }
  }, true);

  /* ---------- archive sync (every page, so a later visit retries) ---------- */

  flushQueue();
  window.addEventListener('online', flushQueue);
  setInterval(flushQueue, 60 * 1000);

  if (!s || s.ended_at) {
    if (page === 'gate') document.documentElement.classList.add('nt-gate');
    if ((page === 'cache' || page === 'archive') && s) onReady(installEndedChrome);
    return;
  }

  /* ---------- active session ---------- */

  beginVisit();
  installTracker();
  installIdle();
  wrapCamera();
  onReady(installChrome);

  function start(name, terms) {
    s = {
      session_id: newId(),
      name: name,
      terms: terms,
      started_at: new Date().toISOString(),
      ended_at: null,
      ended_by: null,
      clicks: 0,
      keys: 0,
      mouse_px: 0,
      cancels: 0,
      camera: null,
      portals: [],
      captcha: null,
      guestbook: false
    };
    save();
    return s;
  }

  function reset() {
    try { sessionStorage.clear(); } catch (e) {}
    s = null;
    location.replace(ENTER_URL);
  }

  /* ---------- tracker ---------- */

  function beginVisit() {
    if (!portalId) return;
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var last = s.portals[s.portals.length - 1];
    var now = new Date().toISOString();
    if (nav && nav.type === 'reload' && last && last.id === portalId) {
      visit = last; // a refresh continues the same stay
    } else {
      visit = { id: portalId, enter: now, exit: now, ms: 0 };
      s.portals.push(visit);
    }
    lastTick = document.visibilityState === 'visible' ? Date.now() : null;
    save();
  }

  // Adds visible time since the last tick; time with the tab hidden isn't counted.
  function tick() {
    if (!s || s.ended_at) return;
    var now = Date.now();
    if (visit) {
      if (lastTick !== null) visit.ms += now - lastTick;
      visit.exit = new Date(now).toISOString();
    }
    lastTick = document.visibilityState === 'visible' ? now : null;
    save();
  }

  function installTracker() {
    var lastX = null, lastY = null;

    document.addEventListener('pointerdown', function () { if (s) s.clicks++; }, true);
    document.addEventListener('keydown', function () { if (s) s.keys++; }, true);
    document.addEventListener('pointermove', function (e) {
      if (!s) return;
      if (lastX !== null) s.mouse_px += Math.round(Math.hypot(e.clientX - lastX, e.clientY - lastY));
      lastX = e.clientX;
      lastY = e.clientY;
    }, true);

    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pagehide', tick);
    setInterval(tick, 1000);
  }

  // Records whether the visitor allowed the camera. Frames are never touched.
  function wrapCamera() {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return;
    var original = md.getUserMedia.bind(md);
    md.getUserMedia = function (constraints) {
      var p = original(constraints);
      if (constraints && constraints.video) {
        p.then(function () { setCamera('granted'); }, function () { setCamera('denied'); });
      }
      return p;
    };
  }

  function setCamera(result) {
    if (!s || s.ended_at || s.camera === 'granted') return;
    s.camera = result;
    save();
  }

  /* ---------- idle timeout ---------- */

  function installIdle() {
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (type) {
      document.addEventListener(type, function () { lastInput = Date.now(); }, { capture: true, passive: true });
    });

    setInterval(function () {
      if (ending) return;
      var active = document.activeElement;
      // Clicks inside an embedded iframe never reach this page.
      var extended = cameraActive || (active && active.tagName === 'IFRAME');
      var limit = extended ? CONFIG.idleExtendedMs : CONFIG.idleMs;
      if (Date.now() - lastInput > limit) end('idle');
    }, 1000);
  }

  /* ---------- END SESSION control ---------- */

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // Keeps clicks on session UI from reaching portal handlers (p5 mousePressed,
  // body onclick) while still being counted.
  function isolate(el) {
    ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'touchstart', 'keydown'].forEach(function (type) {
      el.addEventListener(type, function (e) { e.stopPropagation(); });
    });
  }

  // The portals lead into each other, in this order.
  var PATH = [
    { id: 'nostalgia', label: 'nostalgia', href: '/clickme/game.html' },
    { id: 'ascii', label: 'mirror', href: '/asciiHero/' },
    { id: 'ads', label: 'sponsored', href: '/ads/' },
    { id: 'surveilled', label: 'surveilled', href: '/surveilled/mirror.html' }
  ];

  // The next portal you haven't been to, looking forward from this one.
  function nextPortal() {
    var seen = {};
    s.portals.forEach(function (v) { seen[v.id] = true; });
    var here = PATH.findIndex(function (p) { return p.id === portalId; });
    for (var i = 1; i <= PATH.length; i++) {
      var p = PATH[(here + i) % PATH.length];
      if (!seen[p.id]) return p;
    }
    return null;
  }

  function installChrome() {
    var bar = document.createElement('div');
    bar.className = 'nt-chrome';
    if (page !== 'gate') {
      var back = document.createElement('a');
      back.className = 'nt-chrome-btn nt-chrome-back';
      back.href = ENTER_URL;
      back.textContent = '← desktop';
      bar.appendChild(back);
    }
    if (PATH.some(function (p) { return p.id === portalId; })) {
      var nxt = nextPortal();
      var door = document.createElement(nxt ? 'a' : 'button');
      door.className = 'nt-chrome-btn nt-chrome-next';
      if (nxt) {
        door.href = nxt.href;
        door.textContent = 'next: ' + nxt.label + ' →';
      } else {
        door.type = 'button';
        door.textContent = 'that\u2019s everything → end session';
        door.addEventListener('click', openDialog);
      }
      bar.appendChild(door);
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nt-chrome-btn nt-chrome-end';
    btn.textContent = '[ END SESSION ]';
    btn.addEventListener('click', openDialog);
    bar.appendChild(btn);
    isolate(bar);
    document.body.appendChild(bar);
  }

  function installEndedChrome() {
    var bar = document.createElement('div');
    bar.className = 'nt-chrome';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nt-chrome-btn nt-chrome-end';
    btn.textContent = '[ SESSION ENDED ]';
    btn.disabled = true;
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  /* ---------- confirmation dialog ---------- */

  function openDialog() {
    if (ending || document.querySelector('.nt-dialog-backdrop')) return;
    var returnFocus = document.activeElement;

    var backdrop = document.createElement('div');
    backdrop.className = 'nt-dialog-backdrop';
    backdrop.innerHTML =
      '<div class="nt-dialog" role="alertdialog" aria-modal="true" aria-labelledby="nt-dialog-title" aria-describedby="nt-dialog-body">' +
        '<div class="nt-dialog-titlebar">net.timeline</div>' +
        '<div class="nt-dialog-content">' +
          '<div class="nt-dialog-icon" aria-hidden="true">!</div>' +
          '<div>' +
            '<p class="nt-dialog-title" id="nt-dialog-title">End your session?</p>' +
            '<p class="nt-dialog-body" id="nt-dialog-body">You will not be able to return to this session. Your activity will be added to the archive.</p>' +
          '</div>' +
        '</div>' +
        '<div class="nt-dialog-buttons">' +
          '<button type="button" class="nt-dialog-btn" data-action="cancel">[ CANCEL ]</button>' +
          '<button type="button" class="nt-dialog-btn" data-action="end">[ END SESSION ]</button>' +
        '</div>' +
      '</div>';
    isolate(backdrop);
    document.body.appendChild(backdrop);

    var cancelBtn = backdrop.querySelector('[data-action="cancel"]');
    var endBtn = backdrop.querySelector('[data-action="end"]');
    cancelBtn.focus();

    function close() {
      backdrop.remove();
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }

    cancelBtn.addEventListener('click', function () {
      s.cancels++;
      save();
      close();
    });
    endBtn.addEventListener('click', function () {
      cancelBtn.disabled = endBtn.disabled = true;
      end('visitor');
    });
    backdrop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        (document.activeElement === cancelBtn ? endBtn : cancelBtn).focus();
      }
    });
  }

  /* ---------- end-session flow ---------- */

  function end(by) {
    if (ending || !s || s.ended_at) return;
    ending = true;
    tick();
    visit = null;
    s.ended_at = new Date().toISOString();
    s.ended_by = by;
    save();
    queueArchive(s);
    var dialog = document.querySelector('.nt-dialog-backdrop');
    if (dialog) dialog.remove();
    showLoading(function () { location.replace(cacheUrl(s.session_id)); });
  }

  // Only the fields the Terms disclose are kept. Written to the laptop first,
  // then sent to the archive; it leaves the queue only once the server confirms.
  function queueArchive(session) {
    var sum = summarize(session);
    var record = {
      session_id: session.session_id,
      exhibition_id: CONFIG.exhibitionId,
      name: session.name,
      terms: session.terms,
      started_at: session.started_at,
      ended_at: session.ended_at,
      duration_s: Math.round(sum.durationMs / 1000),
      portals_visited: sum.portalsVisited,
      left_something: !!session.guestbook,
      ended_by: session.ended_by
    };
    try {
      var queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      queue.push(record);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {}
    flushQueue();
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function flushQueue() {
    var queue = readQueue();
    if (flushing || !queue.length || !window.fetch) return;
    flushing = true;
    var record = queue[0];
    fetch(CONFIG.archiveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      keepalive: true
    }).then(function (res) {
      flushing = false;
      // 422 means the server will never accept it; don't let it block the rest.
      if (!res.ok && res.status !== 422) return;
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(readQueue().filter(function (r) {
          return r.session_id !== record.session_id;
        })));
      } catch (e) {}
      flushQueue();
    }, function () { flushing = false; });
  }

  function showLoading(done) {
    var overlay = document.createElement('div');
    overlay.className = 'nt-loading';
    isolate(overlay);
    document.body.appendChild(overlay);

    var lines = ['ending session...', 'compiling activity...', 'writing to /cache/...'];
    var i = 0;
    (function nextLine() {
      if (i < lines.length) {
        var p = document.createElement('p');
        p.textContent = lines[i++];
        overlay.appendChild(p);
        setTimeout(nextLine, 700);
      } else {
        runBar(overlay, done);
      }
    })();
  }

  function runBar(overlay, done) {
    var bar = document.createElement('p');
    overlay.appendChild(bar);
    var BLOCKS = 16;
    var pct = 0;
    function render() {
      var filled = Math.round((pct / 100) * BLOCKS);
      bar.textContent = '█'.repeat(filled) + '░'.repeat(BLOCKS - filled) + ' ' + pct + '%';
    }
    (function step() {
      render();
      if (pct >= 100) { setTimeout(done, 600); return; }
      if (pct < 89) {
        pct = Math.min(89, pct + 3 + Math.floor(Math.random() * 6));
        setTimeout(step, 70);
      } else {
        pct = 100;
        setTimeout(step, 1400); // the stall
      }
    })();
  }

  /* ---------- summary (used by /cache/ and the archive record) ---------- */

  function summarize(session) {
    if (!session) return null;
    var visits = session.portals.filter(function (v) { return v.id !== 'index'; });
    var counts = {};
    visits.forEach(function (v) { counts[v.id] = (counts[v.id] || 0) + 1; });

    var revisit = null;
    Object.keys(counts).forEach(function (id) {
      if (counts[id] > 1 && (!revisit || counts[id] > revisit.count)) revisit = { id: id, count: counts[id] };
    });

    var longest = null;
    visits.forEach(function (v) { if (!longest || v.ms > longest.ms) longest = v; });

    var hesitation = 0;
    session.portals.forEach(function (v) { if (v.id === 'index' && v.ms > hesitation) hesitation = v.ms; });

    var end = session.ended_at ? Date.parse(session.ended_at) : Date.now();
    return {
      durationMs: end - Date.parse(session.started_at),
      portalsVisited: Object.keys(counts).length,
      revisit: revisit,
      longest: longest,
      first: visits[0] ? visits[0].id : null,
      last: visits.length ? visits[visits.length - 1].id : null,
      hesitationMs: hesitation,
      interactions: session.clicks + session.keys + visits.length + session.cancels
    };
  }
})();

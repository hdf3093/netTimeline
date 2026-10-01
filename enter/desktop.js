/* /enter/ — the 2012 desktop: portals as icons, and a browser already open
 * on the board, the library and the archive of previous visitors. */
(function () {
  'use strict';

  var NS = window.NetSession;
  var s = NS && NS.get();
  if (!s) return; // the gate is showing

  // Portals, in the order the "next →" doors follow.
  var PORTALS = [
    { id: 'nostalgia',  label: 'Nostalgia, Looped', href: '/clickme/game.html',      img: '/images/1alw.gif' },
    { id: 'ascii',      label: 'Mirror',            href: '/asciiHero/',             img: '/images/monitor.gif' },
    { id: 'ads',        label: 'Sponsored',         href: '/ads/',                   img: '/images/125x125_woman.gif' },
    { id: 'surveilled', label: 'Surveilled',        href: '/surveilled/mirror.html', img: '/images/AngelMirror.gif' }
  ];

  var TABS = [
    { id: 'board',   title: 'the board',         src: '/board/' },
    { id: 'lib',     title: 'library',           src: '/lib/' },
    { id: 'archive', title: 'previous visitors', src: '/archive/' }
  ];

  var STATE_KEY = 'nt.desktop';
  var state = { min: false, max: false, tab: 'board' };
  try { Object.assign(state, JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}')); } catch (e) {}
  function saveState() { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {} }

  var visited = {};
  s.portals.forEach(function (v) { visited[v.id] = true; });
  var next = PORTALS.filter(function (p) { return !visited[p.id]; })[0];

  /* ---------- desktop icons ---------- */

  var icons = document.getElementById('icons');
  var selected = null;

  function makeIcon(label, imgSrc, kind, onOpen, extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon' + (extraClass || '');
    b.innerHTML = '<span class="icon-img"></span><span class="icon-label"></span>';
    var img = b.querySelector('.icon-img');
    if (imgSrc) {
      var im = document.createElement('img');
      im.src = imgSrc;
      im.alt = '';
      img.appendChild(im);
    } else {
      img.classList.add('icon-img--' + kind);
    }
    b.querySelector('.icon-label').textContent = label;
    // 2012 rules: one click selects, a double-click opens.
    b.addEventListener('click', function () { select(b); });
    b.addEventListener('dblclick', onOpen);
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter') onOpen(); });
    icons.appendChild(b);
    return b;
  }

  PORTALS.forEach(function (p) {
    var cls = (visited[p.id] ? ' icon--visited' : '') + (p === next ? ' icon--next' : '');
    var b = makeIcon(p.label, p.img, null, function () { go(p.href); }, cls);
    if (visited[p.id]) b.title = 'visited';
    if (p === next) {
      var hint = document.createElement('span');
      hint.className = 'icon-hint';
      hint.textContent = PORTALS.some(function (x) { return visited[x.id]; }) ? 'next' : 'start here';
      b.appendChild(hint);
    }
  });

  makeIcon('Internet', null, 'browser', function () { openBrowser(); });

  function select(b) {
    if (selected) selected.classList.remove('is-selected');
    selected = b;
    b.classList.add('is-selected');
  }

  document.getElementById('desktop').addEventListener('click', function (e) {
    if (e.target === e.currentTarget || e.target === icons) {
      if (selected) selected.classList.remove('is-selected');
      selected = null;
      closeStart();
    }
  });

  function go(href) {
    closeStart();
    location.href = href;
  }

  /* ---------- the browser window ---------- */

  var browser = document.getElementById('browser');
  var btabs = document.getElementById('btabs');
  var bview = document.getElementById('bview');
  var bUrl = document.getElementById('bUrl');
  var tasks = document.getElementById('tasks');
  var frames = {};
  var task = null;

  // Same-origin links that leave the browser (the desktop, the portals) open full-screen.
  var TOP_PATHS = ['/', '/index.html', '/enter/', '/enter/index.html'].concat(PORTALS.map(function (p) { return p.href; }));

  TABS.forEach(function (t) {
    var tab = document.createElement('div');
    tab.className = 'b-tab';
    tab.innerHTML = '<span class="b-tab-title"></span>';
    tab.querySelector('.b-tab-title').textContent = t.title;
    tab.addEventListener('click', function () { showTab(t.id); });
    btabs.appendChild(tab);
    t.el = tab;
  });

  function frameFor(id) {
    if (frames[id]) return frames[id];
    var t = TABS.filter(function (x) { return x.id === id; })[0];
    var f = document.createElement('iframe');
    f.title = t.title;
    f.src = t.src;
    f.addEventListener('load', function () { onFrameLoad(t, f); });
    bview.appendChild(f);
    frames[id] = f;
    return f;
  }

  function onFrameLoad(t, f) {
    var doc;
    try { doc = f.contentDocument; } catch (e) { return; }
    if (!doc) return;
    doc.querySelectorAll('a[href]').forEach(function (a) {
      var u;
      try { u = new URL(a.href); } catch (e) { return; }
      if (u.origin === location.origin && TOP_PATHS.indexOf(u.pathname) >= 0) a.target = '_top';
    });
    // Keep the tab's own name on its home page; show the page title once you browse elsewhere.
    var path = '';
    try { path = f.contentWindow.location.pathname; } catch (e) {}
    var title = path === t.src ? t.title : (doc.title || t.title).replace(/\s*—\s*net\.timeline\s*$/, '').trim();
    t.el.querySelector('.b-tab-title').textContent = title || t.title;
    if (state.tab === t.id) updateUrl();
  }

  function updateUrl() {
    var f = frames[state.tab];
    var path = '';
    try { path = f.contentWindow.location.pathname; } catch (e) {}
    bUrl.textContent = location.host + (path || '/');
  }

  function showTab(id) {
    state.tab = id;
    saveState();
    TABS.forEach(function (t) { t.el.classList.toggle('is-active', t.id === id); });
    var f = frameFor(id);
    Object.keys(frames).forEach(function (k) { frames[k].hidden = frames[k] !== f; });
    updateUrl();
  }

  function render() {
    browser.hidden = state.min;
    browser.classList.toggle('is-max', state.max);
    if (!task) {
      task = document.createElement('button');
      task.type = 'button';
      task.className = 'task';
      task.textContent = 'net.timeline — Browser';
      task.addEventListener('click', function () { state.min = !state.min; saveState(); render(); });
      tasks.appendChild(task);
    }
    if (task) task.classList.toggle('is-active', !state.min);
  }

  function openBrowser(tabId) {
    state.min = false;
    saveState();
    render();
    showTab(tabId || state.tab);
  }

  document.getElementById('bMin').addEventListener('click', function () { state.min = true; saveState(); render(); });
  document.getElementById('bMax').addEventListener('click', function () { state.max = !state.max; saveState(); render(); });
  // Closing just tucks it into the taskbar: the board, library and archive are always open.
  document.getElementById('bClose').addEventListener('click', function () { state.min = true; saveState(); render(); });
  document.getElementById('bBack').addEventListener('click', function () {
    try { frames[state.tab].contentWindow.history.back(); } catch (e) {}
  });
  document.getElementById('bFwd').addEventListener('click', function () {
    try { frames[state.tab].contentWindow.history.forward(); } catch (e) {}
  });
  document.getElementById('bReload').addEventListener('click', function () {
    try { frames[state.tab].contentWindow.location.reload(); } catch (e) {}
  });

  TABS.forEach(function (t) { frameFor(t.id); });
  render();
  showTab(state.tab);

  /* ---------- start menu ---------- */

  var startBtn = document.getElementById('startBtn');
  var startmenu = document.getElementById('startmenu');
  document.getElementById('startUser').textContent = s.name;

  var startItems = document.getElementById('startItems');
  function startItem(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'startmenu-item';
    b.textContent = label;
    b.addEventListener('click', function () { closeStart(); onClick(); });
    startItems.appendChild(b);
  }
  PORTALS.forEach(function (p) {
    startItem(p.label + (visited[p.id] ? '  ✓' : ''), function () { go(p.href); });
  });
  TABS.forEach(function (t) {
    startItem(t.title, function () { openBrowser(t.id); });
  });

  function closeStart() {
    startmenu.hidden = true;
    startBtn.setAttribute('aria-expanded', 'false');
  }

  startBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    startmenu.hidden = !startmenu.hidden;
    startBtn.setAttribute('aria-expanded', String(!startmenu.hidden));
  });

  // "Shut down…" is END SESSION.
  document.getElementById('shutdown').addEventListener('click', function () {
    closeStart();
    var end = document.querySelector('.nt-chrome-end');
    if (end) end.click();
  });

  /* ---------- tray ---------- */

  var clock = document.getElementById('clock');
  function tick() {
    clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 10000);

  // Welcome balloon, only on the first arrival.
  var firstTime = s.portals.filter(function (v) { return v.id === 'index'; }).length <= 1;
  var balloon = document.getElementById('balloon');
  if (firstTime) {
    document.getElementById('balloonTitle').textContent = 'welcome, ' + s.name + '.';
    balloon.hidden = false;
    setTimeout(function () { balloon.hidden = true; }, 9000);
  }
  document.getElementById('balloonClose').addEventListener('click', function () { balloon.hidden = true; });
})();

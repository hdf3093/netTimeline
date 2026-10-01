/* /enter/ — the 2012 desktop: one icon per portal, the board, and a readme. */
(function () {
  'use strict';

  var NS = window.NetSession;
  var s = NS && NS.get();
  if (!s) return; // the gate is showing

  var ITEMS = [
    { id: 'ascii',      label: 'Mirror',            href: '/asciiHero/',             img: '/images/monitor.gif', portal: true },
    { id: 'surveilled', label: 'Surveilled',        href: '/surveilled/mirror.html', img: '/images/AngelMirror.gif', portal: true },
    { id: 'nostalgia',  label: 'Nostalgia, Looped', href: '/clickme/game.html',      img: '/images/1alw.gif', portal: true },
    { id: 'ads',        label: 'Sponsored',         href: '/ads/',                   img: '/images/125x125_woman.gif', portal: true },
    { id: 'board',      label: 'the board',         href: '/board/',                 kind: 'folder' },
    { id: 'readme',     label: 'readme.txt',        kind: 'text' }
  ];

  var visited = {};
  s.portals.forEach(function (v) { visited[v.id] = true; });
  var next = ITEMS.filter(function (i) { return i.portal && !visited[i.id]; })[0];

  /* ---------- icons ---------- */

  var icons = document.getElementById('icons');
  var selected = null;

  ITEMS.forEach(function (item) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon' + (visited[item.id] && item.portal ? ' icon--visited' : '') + (item === next ? ' icon--next' : '');
    b.innerHTML = '<span class="icon-img"></span><span class="icon-label"></span>';
    var img = b.querySelector('.icon-img');
    if (item.img) {
      var im = document.createElement('img');
      im.src = item.img;
      im.alt = '';
      img.appendChild(im);
    } else {
      img.classList.add('icon-img--' + item.kind);
    }
    b.querySelector('.icon-label').textContent = item.label;
    if (visited[item.id] && item.portal) b.title = 'visited';
    if (item === next) {
      var hint = document.createElement('span');
      hint.className = 'icon-hint';
      hint.textContent = s.portals.some(function (v) { return v.id !== 'index'; }) ? 'next' : 'start here';
      b.appendChild(hint);
    }

    // 2012 rules: one click selects, a double-click opens.
    b.addEventListener('click', function () { select(b); });
    b.addEventListener('dblclick', function () { open(item); });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(item); });
    icons.appendChild(b);
  });

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

  function open(item) {
    closeStart();
    if (item.kind === 'text') { openReadme(); return; }
    location.href = item.href;
  }

  /* ---------- readme window ---------- */

  var readme = document.getElementById('readme');
  var tasks = document.getElementById('tasks');
  var readmeTask = null;

  function openReadme() {
    readme.hidden = false;
    if (!readmeTask) {
      readmeTask = document.createElement('button');
      readmeTask.type = 'button';
      readmeTask.className = 'task is-active';
      readmeTask.textContent = 'readme.txt - Notepad';
      readmeTask.addEventListener('click', function () { readme.hidden = !readme.hidden; });
      tasks.appendChild(readmeTask);
    }
  }

  document.getElementById('readmeClose').addEventListener('click', function () {
    readme.hidden = true;
    if (readmeTask) { readmeTask.remove(); readmeTask = null; }
  });

  // Drag the window by its title bar.
  var bar = readme.querySelector('.win-bar');
  bar.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button')) return;
    var r = readme.getBoundingClientRect();
    var dx = e.clientX - r.left, dy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    function move(ev) {
      readme.style.left = Math.max(0, Math.min(innerWidth - 120, ev.clientX - dx)) + 'px';
      readme.style.top = Math.max(0, Math.min(innerHeight - 80, ev.clientY - dy)) + 'px';
    }
    function up() { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); }
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });

  /* ---------- start menu ---------- */

  var startBtn = document.getElementById('startBtn');
  var startmenu = document.getElementById('startmenu');
  document.getElementById('startUser').textContent = s.name;

  var startItems = document.getElementById('startItems');
  ITEMS.forEach(function (item) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'startmenu-item';
    b.textContent = item.label + (visited[item.id] && item.portal ? '  ✓' : '');
    b.addEventListener('click', function () { open(item); });
    startItems.appendChild(b);
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

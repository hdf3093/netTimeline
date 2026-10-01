/* Sponsored — why am I seeing this?
 * Targeted ads are built from this visit's session (sessionStorage only).
 * Nothing here is sent anywhere or saved. */
(function () {
  'use strict';

  var s = (window.NetSession && NetSession.get()) || null;
  var first = s ? s.name.split(' ')[0] : 'you';

  /* ---------- what the session knows ---------- */

  function msIn(id) {
    if (!s) return 0;
    return s.portals.filter(function (v) { return v.id === id; })
      .reduce(function (n, v) { return n + v.ms; }, 0);
  }

  function lastSeen(id) {
    if (!s) return null;
    var visits = s.portals.filter(function (v) { return v.id === id; });
    return visits.length ? Date.parse(visits[visits.length - 1].exit) : null;
  }

  function dur(ms) {
    var t = Math.round(ms / 1000);
    if (t < 60) return t + (t === 1 ? ' second' : ' seconds');
    return Math.floor(t / 60) + 'm ' + String(t % 60).padStart(2, '0') + 's';
  }

  function ago(ts) { return dur(Date.now() - ts) + ' ago'; }

  function hesitation() {
    if (!s) return 0;
    return s.portals.filter(function (v) { return v.id === 'index'; })
      .reduce(function (m, v) { return Math.max(m, v.ms); }, 0);
  }

  /* ---------- ad inventory ---------- */

  var BANNERS = [
    'clickhere1.gif', 'iloveclicks3.gif', 'bossup.gif', 'dontclick468.gif', 'sparkle5_2081.gif',
    'dream100.gif', 'banneranunciofinal.gif', 'ojos.gif', 'esword.gif', 'swordsonline.gif', 'mariofinalbanner.gif'
  ];
  var BOXES = ['PinkFairy.gif', 'BartMaxBanner.gif', '125x125_woman.gif', 'th_chic5.gif', 'enjoyed.gif'];
  var BUTTONS = [
    '00000000.gif', 'Logocloudysky1.gif', 'Sega-Elite.gif', 'noclick.gif', 'weblogo2.gif',
    'purehtml.gif', 'power.gif', 'Email.gif', 'bmbox.gif'
  ];
  var GENERIC_REASON = 'because you are here.';

  var GENERIC_TEXT = [
    { title: 'Make $$$ from home!', site: 'easy-money.example', body: 'Moms and teens are earning hundreds a week.' },
    { title: 'FREE ringtones', site: 'ringtones.example', body: 'Text JOIN to get the hottest songs on your phone!' },
    { title: 'Is your crush into you?', site: 'quizzes.example', body: 'Take the 10 question quiz and find out.' },
    { title: 'Win an iPod nano', site: 'prizes.example', body: 'Answer one question. Ends tonight!' }
  ];

  // Each targeted ad only appears if the session gives it a reason.
  var TARGETED = [
    function () {
      var ms = msIn('nostalgia');
      return ms > 0 && { img: '/sites/s-l1200.webp', title: 'Rare Squishies — Ships Today!', site: 'squishyshop.example',
        body: first + ', the ones you remember are back in stock.', reason: 'because you spent ' + dur(ms) + ' in Nostalgia, Looped.' };
    },
    function () {
      var t = lastSeen('nostalgia');
      return t && { img: '/sites/93010883f563a992b9de300d3b87f347.jpg', title: 'Complete your collection ♡', site: 'kawaii-deals.example',
        body: 'Only 2 left!! Don’t let someone else get yours.', reason: 'because you visited Nostalgia, Looped ' + ago(t) + '.' };
    },
    function () {
      return s && s.terms === 'declined' && { title: 'You said no.', site: 'net.timeline', body: 'We heard maybe. Try us again — no commitment.',
        reason: 'because you declined the Terms of Existence.' };
    },
    function () {
      return s && s.terms === 'accepted' && { title: 'Thanks for agreeing!', site: 'net.timeline', body: 'Here’s something just for you, ' + first + '.',
        reason: 'because you agreed to the Terms of Existence.' };
    },
    function () {
      return s && s.cancels > 0 && { title: 'Leaving so soon?', site: 'stay.example', body: 'Stay a little longer and save 20%.',
        reason: 'because you tried to end your session ' + s.cancels + (s.cancels === 1 ? ' time.' : ' times.') };
    },
    function () {
      var ms = hesitation();
      return ms > 4000 && { title: 'Still deciding?', site: 'choices.example', body: 'Let us choose for you. It’s easier.',
        reason: 'because you spent ' + dur(ms) + ' deciding where to go.' };
    },
    function () {
      var ms = msIn('ascii');
      return ms > 0 && { img: '/images/mirror1.gif', title: 'Flawless in 3 days', site: 'glow.example', body: 'See yourself the way everyone else does.',
        reason: 'because you looked at yourself in Mirror for ' + dur(ms) + '.' };
    },
    function () {
      var ms = msIn('surveilled');
      return ms > 0 && { title: 'Feeling watched?', site: 'privacyguard.example', body: 'PrivacyGuard Pro keeps your data safe*.  *with us',
        reason: 'because you spent ' + dur(ms) + ' being watched in Surveilled.' };
    },
    function () {
      return s && s.camera === 'granted' && { img: '/images/AngelMirror.gif', title: 'You look great today', site: 'selfie.example', body: 'Share your best angle with 300 friends.',
        reason: 'because you let a portal see your face.' };
    },
    function () {
      return msIn('lib') > 0 && { title: 'Readers like you also bought', site: 'books.example', body: 'A Cyborg Manifesto (paperback) — free shipping.',
        reason: 'because you visited the library.' };
    },
    function () {
      return s && s.clicks > 10 && { img: '/images/iloveclicks3.gif', title: 'You love to click!', site: 'clicks.example', body: 'Every click counts. Especially yours.',
        reason: 'because you have clicked ' + s.clicks + ' times this session.' };
    },
    function () {
      var h = new Date().getHours();
      var time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return (h >= 21 || h < 5) && { title: 'Up late?', site: 'sleep.example', body: 'Treat yourself. You deserve it.', reason: 'because it’s ' + time + '.' };
    },
    function () {
      return s && { title: first + ', this one’s for you ♡', site: 'foryou.example', body: 'Picked just for you. Nobody else sees this.',
        reason: 'because you told us your name.' };
    }
  ];

  var targetedPool = TARGETED.map(function (f) { return f(); }).filter(Boolean);
  var counters = { banner: 0, box: 0, button: 0, text: 0, targeted: 0 };

  function pick(list, key) { return list[counters[key]++ % list.length]; }
  function nextTargeted() { return targetedPool.length ? pick(targetedPool, 'targeted') : null; }

  /* ---------- money ---------- */

  var earned = 0, served = 0, level = 0;
  var earnedEl = document.getElementById('earned');
  var servedEl = document.getElementById('served');

  function cpc() { return 0.08 + Math.random() * 0.55; }
  function money(n) { return '$' + n.toFixed(2); }

  function earn(amount, x, y) {
    earned += amount;
    earnedEl.textContent = money(earned);
    earnedEl.classList.remove('bump');
    void earnedEl.offsetWidth;
    earnedEl.classList.add('bump');

    var f = document.createElement('span');
    f.className = 'float-money';
    f.textContent = '+' + money(amount);
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1100);
  }

  function countServed() {
    served++;
    servedEl.textContent = served;
  }

  /* ---------- building ads ---------- */

  // Wraps any creative with the label, price tag, ⓘ and ×.
  function frame(creative, opts) {
    var price = cpc();
    var wrap = document.createElement('div');
    wrap.className = 'ad' + (opts.targeted ? ' ad--targeted' : '') + (opts.cls ? ' ' + opts.cls : '');
    wrap.innerHTML =
      '<span class="ad-label"></span>' +
      '<span class="ad-price"></span>' +
      '<span class="ad-controls">' +
        '<button type="button" class="ad-why" aria-label="Why am I seeing this ad?">i</button>' +
        (opts.noClose ? '' : '<button type="button" class="ad-close" aria-label="Close ad">×</button>') +
      '</span>';
    wrap.querySelector('.ad-label').textContent = opts.targeted ? 'Sponsored · picked for you' : 'Advertisement';
    wrap.querySelector('.ad-price').textContent = money(price) + ' / click';
    wrap.appendChild(creative);

    creative.addEventListener('click', function (e) { earn(price, e.clientX, e.clientY); learn(); });
    wrap.querySelector('.ad-why').addEventListener('click', function (e) {
      e.stopPropagation();
      showWhy(e.currentTarget, opts.reason);
      learn();
    });
    var close = wrap.querySelector('.ad-close');
    if (close) close.addEventListener('click', function (e) {
      e.stopPropagation();
      learn();
      if (opts.onClose) opts.onClose(e);
      spawnPopup(e.clientX, e.clientY);
      spawnPopup(e.clientX, e.clientY);
    });
    countServed();
    return wrap;
  }

  function imageCreative(src) {
    var c = document.createElement('div');
    c.className = 'creative creative--image';
    c.innerHTML = '<img alt="advertisement">';
    c.querySelector('img').src = src;
    return c;
  }

  function textCreative(ad) {
    var c = document.createElement('div');
    c.className = 'creative creative--text';
    c.innerHTML =
      '<a class="ad-title"></a><span class="ad-site"></span>' +
      '<div class="ad-row">' + (ad.img ? '<img alt="">' : '') + '<p class="ad-body"></p></div>' +
      '<span class="ad-like">Like</span>';
    c.querySelector('.ad-title').textContent = ad.title;
    c.querySelector('.ad-site').textContent = ad.site;
    c.querySelector('.ad-body').textContent = ad.body;
    if (ad.img) c.querySelector('img').src = ad.img;
    return c;
  }

  function makeAd(kind, targeted, opts) {
    opts = opts || {};
    var ad = targeted ? nextTargeted() : null;
    if (targeted && !ad) targeted = false;
    var creative, reason = GENERIC_REASON;
    if (targeted) {
      creative = textCreative(ad);
      reason = ad.reason;
    } else if (kind === 'banner') {
      creative = imageCreative('/images/' + pick(BANNERS, 'banner'));
    } else if (kind === 'box') {
      creative = imageCreative('/images/' + pick(BOXES, 'box'));
    } else if (kind === 'button') {
      creative = imageCreative('/images/' + pick(BUTTONS, 'button'));
      opts.cls = 'ad--small';
    } else {
      creative = textCreative(pick(GENERIC_TEXT, 'text'));
    }
    opts.targeted = targeted;
    opts.reason = reason;
    return frame(creative, opts);
  }

  /* ---------- slots ---------- */

  function fill(slot, targeted) {
    slot.classList.toggle('is-targeted', !!targeted);
    slot.classList.remove('is-closed');
    slot.innerHTML = '';
    slot.appendChild(makeAd(slot.dataset.slot, targeted, {
      onClose: function () {
        slot.classList.add('is-closed');
        slot.innerHTML = '<span class="ad-closed">Ad closed. <button type="button" class="ad-undo">Undo</button></span>';
        slot.querySelector('.ad-undo').addEventListener('click', function () { fill(slot, true); });
        // Closed ads come back.
        setTimeout(function () { if (slot.classList.contains('is-closed')) fill(slot, true); }, 6000);
      }
    }));
  }

  // Every interaction teaches the page a little more.
  function learn() {
    level++;
    var open = document.querySelectorAll('[data-slot]:not(.is-targeted):not(.is-closed)');
    if (!open.length || !targetedPool.length) return;
    var slot = open[Math.floor(Math.random() * open.length)];
    fill(slot, true);
    slot.classList.add('just-targeted');
    setTimeout(function () { slot.classList.remove('just-targeted'); }, 1500);
  }

  /* ---------- the games are ads too ---------- */

  document.querySelectorAll('.game').forEach(function (g) {
    var price = cpc();
    var tag = document.createElement('span');
    tag.className = 'game-tag';
    tag.textContent = 'Sponsored · ' + money(price) + ' / click';
    g.appendChild(tag);
    g.addEventListener('click', function (e) {
      if (g.classList.contains('is-covered')) return;
      earn(price, e.clientX, e.clientY);
      learn();
      cover(g);
    });
  });

  function cover(game) {
    game.classList.add('is-covered');
    var c = document.createElement('div');
    c.className = 'game-cover';
    c.appendChild(makeAd('box', level > 2, { noClose: true }));
    game.appendChild(c);
  }

  /* ---------- pop-ups ---------- */

  var popups = document.getElementById('popups');
  var MAX_POPUPS = 8;
  var popupCount = 0;

  function spawnPopup(x, y) {
    if (popups.children.length >= MAX_POPUPS) return;
    popupCount++;
    var w = 300, h = 170;
    if (x === undefined) { x = Math.random() * innerWidth; y = Math.random() * innerHeight; }
    var win = document.createElement('div');
    win.className = 'popup';
    win.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2 + (Math.random() * 160 - 80))) + 'px';
    win.style.top = Math.max(8, Math.min(innerHeight - h - 70, y - h / 2 + (Math.random() * 120 - 60))) + 'px';
    win.innerHTML =
      '<div class="popup-bar"><span></span><button type="button" class="popup-x" aria-label="Close">×</button></div>' +
      '<div class="popup-body"></div>';
    var body = win.querySelector('.popup-body');

    // The first pop-up is the classic; after that they know who you are.
    if (popupCount === 1 || !targetedPool.length) {
      win.querySelector('.popup-bar span').textContent = 'Congratulations!';
      var prize = document.createElement('div');
      prize.className = 'creative prize';
      prize.innerHTML = '<b>★ CONGRATULATIONS ★</b><br>you are the <span class="blink">1,000,000th</span> visitor!<br><u>CLICK HERE</u> to claim your prize';
      body.appendChild(frame(prize, { reason: GENERIC_REASON, noClose: true }));
    } else {
      win.querySelector('.popup-bar span').textContent = 'Picked for you';
      body.appendChild(makeAd('text', true, { noClose: true }));
    }

    win.querySelector('.popup-x').addEventListener('click', function (e) {
      e.stopPropagation();
      win.remove();
      learn();
      spawnPopup(e.clientX, e.clientY);
      spawnPopup(e.clientX, e.clientY);
    });
    popups.appendChild(win);
  }

  /* ---------- sticky bottom ad ---------- */

  var sticky = document.getElementById('sticky');
  function showSticky() {
    sticky.hidden = false;
    sticky.innerHTML = '';
    sticky.appendChild(makeAd('banner', false, {
      onClose: function () {
        sticky.hidden = true;
        setTimeout(showSticky, 8000);
      }
    }));
  }

  /* ---------- the bombardment ---------- */

  // New ads keep arriving on their own, faster the more you interact.
  function drop() {
    var uncovered = document.querySelectorAll('.game:not(.is-covered)');
    var roll = Math.random();
    if (roll < 0.4) spawnPopup();
    else if (roll < 0.75 && uncovered.length) cover(uncovered[Math.floor(Math.random() * uncovered.length)]);
    else if (sticky.hidden) showSticky();
    else learn();
    setTimeout(drop, Math.max(1800, 7000 - level * 350));
  }

  /* ---------- why am I seeing this? ---------- */

  var why = document.getElementById('why');
  var whyText = document.getElementById('whyText');
  document.getElementById('whyOk').addEventListener('click', function () { why.hidden = true; });

  function showWhy(anchor, reason) {
    whyText.textContent = reason;
    why.hidden = false;
    var r = anchor.getBoundingClientRect();
    why.style.left = Math.max(8, Math.min(innerWidth - 280, r.left - 240)) + 'px';
    why.style.top = Math.min(innerHeight - 140, r.bottom + 6) + 'px';
  }

  /* ---------- start ---------- */

  document.querySelectorAll('[data-slot]').forEach(function (slot) { fill(slot, false); });
  setTimeout(drop, 4000);
})();

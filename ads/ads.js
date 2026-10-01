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

  /* ---------- ads ---------- */

  var GENERIC_BANNERS = [
    'clickhere1.gif', 'iloveclicks3.gif', 'bossup.gif', 'dontclick468.gif', 'sparkle5_2081.gif',
    'dream100.gif', 'banneranunciofinal.gif', 'ojos.gif', 'esword.gif', 'swordsonline.gif', 'mariofinalbanner.gif'
  ];
  var GENERIC_BOXES = ['PinkFairy.gif', 'BartMaxBanner.gif', '125x125_woman.gif', 'th_chic5.gif', 'enjoyed.gif'];
  var GENERIC_REASON = 'because you are here.';

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
      return msIn('eliza') > 0 && { title: 'Lonely?', site: 'talknow.example', body: 'Someone is always online. Chat now.',
        reason: 'because you talked to a chatbot.' };
    },
    function () {
      return s && s.clicks > 10 && { img: '/images/iloveclicks3.gif', title: 'You love to click!', site: 'clicks.example', body: 'Turn your clicks into cash. Start today.',
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
  var targetedUsed = 0;
  var genericBanner = 0, genericBox = 0;

  function nextTargeted() {
    if (!targetedPool.length) return null;
    return targetedPool[targetedUsed++ % targetedPool.length];
  }

  /* ---------- click economy + targeting level ---------- */

  var earned = 0;
  var level = 0; // how many slots have turned personal
  var earnedEl = document.getElementById('earned');

  function earn() {
    earned += 0.05 + Math.random() * 0.35;
    earnedEl.textContent = '$' + earned.toFixed(2);
    earnedEl.classList.remove('bump');
    void earnedEl.offsetWidth;
    earnedEl.classList.add('bump');
  }

  // Every interaction teaches the page a little more.
  function learn() {
    level++;
    var slots = document.querySelectorAll('[data-slot]:not(.is-targeted):not(.is-closed)');
    if (!slots.length || !targetedPool.length) return;
    var slot = slots[Math.floor(Math.random() * slots.length)];
    fill(slot, true);
    slot.classList.add('just-targeted');
    setTimeout(function () { slot.classList.remove('just-targeted'); }, 1500);
  }

  /* ---------- rendering ---------- */

  function controls(reason) {
    var bar = document.createElement('span');
    bar.className = 'ad-controls';
    var why = document.createElement('button');
    why.type = 'button';
    why.className = 'ad-why';
    why.textContent = 'i';
    why.setAttribute('aria-label', 'Why am I seeing this ad?');
    why.addEventListener('click', function (e) { e.stopPropagation(); showWhy(why, reason); learn(); });
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ad-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close ad');
    bar.appendChild(why);
    bar.appendChild(close);
    return { bar: bar, close: close };
  }

  function bannerAd(kind) {
    var file = kind === 'box' ? GENERIC_BOXES[genericBox++ % GENERIC_BOXES.length]
      : GENERIC_BANNERS[genericBanner++ % GENERIC_BANNERS.length];
    var a = document.createElement('div');
    a.className = 'ad ad--image';
    a.innerHTML = '<img alt="advertisement">';
    a.querySelector('img').src = '/images/' + file;
    return { el: a, reason: GENERIC_REASON };
  }

  function sideAd(ad) {
    var a = document.createElement('div');
    a.className = 'ad ad--side';
    a.innerHTML =
      '<a class="ad-title"></a><span class="ad-site"></span>' +
      '<div class="ad-row">' + (ad.img ? '<img alt="">' : '') + '<p class="ad-body"></p></div>' +
      '<span class="ad-like">Like</span>';
    a.querySelector('.ad-title').textContent = ad.title;
    a.querySelector('.ad-site').textContent = ad.site;
    a.querySelector('.ad-body').textContent = ad.body;
    if (ad.img) a.querySelector('img').src = ad.img;
    return { el: a, reason: ad.reason };
  }

  function fill(slot, targeted) {
    var kind = slot.dataset.slot;
    var ad;
    if (targeted) {
      ad = sideAd(nextTargeted());
      slot.classList.add('is-targeted');
    } else {
      ad = kind === 'side' ? sideAd(genericSide()) : bannerAd(kind);
    }
    slot.innerHTML = '';
    var label = document.createElement('span');
    label.className = 'ad-label';
    label.textContent = targeted ? 'Sponsored · picked for you' : 'Advertisement';
    slot.appendChild(label);
    slot.appendChild(ad.el);
    var c = controls(ad.reason);
    slot.appendChild(c.bar);
    ad.el.addEventListener('click', function () { earn(); learn(); });
    c.close.addEventListener('click', function (e) {
      e.stopPropagation();
      slot.classList.add('is-closed');
      slot.innerHTML = '<span class="ad-closed">Ad closed. <button type="button" class="ad-undo">Undo</button></span>';
      slot.querySelector('.ad-undo').addEventListener('click', function () {
        slot.classList.remove('is-closed');
        fill(slot, true);
      });
      learn();
      spawnPopups(2, e.clientX, e.clientY);
    });
  }

  var GENERIC_SIDE = [
    { title: 'Make $$$ from home!', site: 'easy-money.example', body: 'Moms and teens are earning hundreds a week.' },
    { title: 'FREE ringtones', site: 'ringtones.example', body: 'Text JOIN to get the hottest songs on your phone!' },
    { title: 'Is your crush into you?', site: 'quizzes.example', body: 'Take the 10 question quiz and find out.' },
    { title: 'Win an iPod nano', site: 'prizes.example', body: 'Answer one question. Ends tonight!' }
  ];
  var genericSideIndex = 0;
  function genericSide() {
    var ad = GENERIC_SIDE[genericSideIndex++ % GENERIC_SIDE.length];
    return { title: ad.title, site: ad.site, body: ad.body, reason: GENERIC_REASON };
  }

  /* ---------- pop-ups ---------- */

  var popups = document.getElementById('popups');
  var MAX_POPUPS = 10;
  var popupCount = 0;

  function spawnPopups(n, x, y) {
    for (var i = 0; i < n; i++) {
      if (popups.children.length >= MAX_POPUPS) return;
      popupCount++;
      // The first pop-up is the classic; after that they know who you are.
      var targeted = popupCount > 1 && targetedPool.length;
      var ad = targeted ? nextTargeted() : null;
      var win = document.createElement('div');
      win.className = 'popup';
      var w = 300, h = 170;
      win.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2 + (i ? 60 : -60) + (Math.random() * 80 - 40))) + 'px';
      win.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - h / 2 + (Math.random() * 100 - 50))) + 'px';
      win.innerHTML =
        '<div class="popup-bar"><span></span><button type="button" class="popup-x" aria-label="Close">×</button></div>' +
        '<div class="popup-body"></div>';
      win.querySelector('.popup-bar span').textContent = targeted ? 'Picked for you' : 'Congratulations!';
      var body = win.querySelector('.popup-body');
      if (targeted) {
        var side = sideAd(ad);
        body.appendChild(side.el);
        var c = controls(ad.reason);
        body.appendChild(c.bar);
        c.close.remove();
      } else {
        body.innerHTML = '<div class="prize"><b>★ CONGRATULATIONS ★</b><br>you are the <span class="blink">1,000,000th</span> visitor!<br><u>CLICK HERE</u> to claim your prize</div>';
        var cc = controls(GENERIC_REASON);
        cc.close.remove();
        body.appendChild(cc.bar);
      }
      body.addEventListener('click', function () { earn(); learn(); });
      win.querySelector('.popup-x').addEventListener('click', function (e) {
        e.stopPropagation();
        e.currentTarget.closest('.popup').remove();
        learn();
        spawnPopups(2, e.clientX, e.clientY);
      });
      popups.appendChild(win);
    }
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

  /* ---------- games that never start ---------- */

  var inter = document.getElementById('interstitial');
  var interText = document.getElementById('interText');
  var interAd = document.getElementById('interAd');
  var timer = null;

  document.querySelectorAll('.game').forEach(function (g) {
    g.addEventListener('click', function () {
      var ad = nextTargeted() || genericSide();
      interAd.innerHTML = '';
      interAd.appendChild(sideAd(ad).el);
      inter.hidden = false;
      var n = 5;
      interText.textContent = 'Your game will begin after this ad (' + n + ')';
      clearInterval(timer);
      timer = setInterval(function () {
        n--;
        if (n > 0) { interText.textContent = 'Your game will begin after this ad (' + n + ')'; return; }
        clearInterval(timer);
        interText.textContent = 'This game requires Adobe Flash Player, which is no longer supported.';
        interAd.innerHTML = '<button type="button" class="inter-close">close</button>';
        interAd.querySelector('button').addEventListener('click', function () { inter.hidden = true; learn(); });
      }, 1000);
    });
  });

  /* ---------- start ---------- */

  document.querySelectorAll('[data-slot]').forEach(function (slot) { fill(slot, false); });
})();

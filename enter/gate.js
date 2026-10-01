/* /enter/ — the name + Terms gate (no session yet), or the session box (session open). */
(function () {
  'use strict';

  var NS = window.NetSession;
  if (!NS) return;
  var s = NS.get();

  if (s) return; // the desktop takes over (desktop.js)

  var TERMS = [
    ['h', 'TERMS OF EXISTENCE'],
    ['i', 'Last updated: the moment you arrived'],
    ['p', 'Please read these Terms carefully. You will not.'],
    ['b', '1. ACCEPTANCE'],
    ['p', 'By accessing net.timeline ("the Site," "the Archive," "we," "the machine"), you ("the User," "the Visitor," "the Subject") agree to be bound by these Terms. If you do not agree, you may select I DO NOT AGREE. Your refusal will be recorded.'],
    ['b', '2. ELIGIBILITY'],
    ['p', 'You must be alive to use this Site. By continuing, you represent and warrant that you are currently alive and that you are the person whose name you entered. You acknowledge that this may be the least accurate thing you tell us today.'],
    ['b', '3. INFORMATION WE COLLECT'],
    ['p', 'We collect the name you provide, the time you arrived, the time you leave, the portals you enter, and anything you choose to leave behind. During your visit, we also observe your clicks, movements, pauses, returns, hesitations, and departures. We call this "activity." You may call it "being here."'],
    ['b', '4. THE CAMERA'],
    ['p', 'Certain portals may request access to your camera. You will be seen. You will not be kept. Images are processed in the moment and are not stored, saved, sold, or remembered by us. We cannot make the same promise on behalf of every other website you have ever used.'],
    ['b', '5. HOW WE USE YOUR INFORMATION'],
    ['p', 'At the end of your session, your activity will be compiled into a record and shown to you. A summary (your name, the date, how long you stayed, and whether you left something behind) will be added to the archive and made visible to future visitors. Anything you write in the guestbook will be public. Everything else is shown to you once and then forgotten. This is more than most platforms will offer.'],
    ['b', '6. OWNERSHIP'],
    ['p', 'You retain all rights to yourself. You grant net.timeline a non-exclusive, royalty-free, worldwide, irrevocable license to remember this version of you after you have become a different version of you. You acknowledge that remembering something does not constitute ownership of it, and that this distinction has rarely stopped anyone.'],
    ['b', '7. YOUR IMAGE'],
    ['p', 'Images of you that enter the internet may be copied, cropped, compressed, reposted, recontextualized, scraped, labeled, sorted, trained upon, and circulated to places you will never visit, by parties you will never meet, under laws you did not write. This Site does not do these things. This clause exists so you remember that others do.'],
    ['b', '8. DELETION'],
    ['p', 'You may request deletion of your record at any time. You acknowledge that deletion does not necessarily mean gone, that screenshots exist, that someone may already have been watching, and that the internet has never fully forgotten anyone it found interesting.'],
    ['b', '9. CHANGES TO YOU'],
    ['p', 'You may change at any time without notice to us. We will not update our records. The version of you stored here will remain as it was on the day you arrived. It will not grow up.'],
    ['b', '10. TERMINATION'],
    ['p', 'These Terms remain in effect until death, server failure, domain expiration, the heat death of the universe, or termination at our sole discretion, whichever occurs first. Your record may outlive you. This is not a threat. It is a feature of the medium.'],
    ['b', '11. DISCLAIMER'],
    ['p', 'THE SITE IS PROVIDED "AS IS" AND "AS YOU WERE." WE MAKE NO WARRANTY THAT YOU WILL BE REMEMBERED CORRECTLY, KINDLY, OR BY ANYONE WHO KNEW YOU.'],
    ['b', '12. GOVERNING LAW'],
    ['p', 'These Terms are governed by laws written before you were born, for a world that no longer exists, enforced by platforms that answer to no one you have met.'],
    ['b', '13. ENTIRE AGREEMENT'],
    ['p', 'These Terms constitute the entire agreement between you and the machine, except for the thousands of other agreements you have already accepted without reading.'],
    ['p', 'By selecting I AGREE, you confirm that you have read these Terms.'],
    ['p', "You haven't. That's okay. No one does. That is how this works."]
  ];

  var terms = null; // "accepted" | "declined"

  var gate = document.createElement('div');
  gate.className = 'gate';
  gate.innerHTML =
    '<form class="gate-panel" novalidate>' +
      '<h1 class="gate-title">welcome to net.timeline</h1>' +
      '<p class="gate-sub">this website would like to remember you.</p>' +
      '<label class="gate-label" for="gateName">your name</label>' +
      '<input class="gate-input" id="gateName" type="text" maxlength="32" autocomplete="off" spellcheck="false">' +
      '<p class="gate-error" id="gateError" role="alert"></p>' +
      '<label class="gate-check"><input type="checkbox" id="gateAgree"> ' +
        '<span>I have read and agree to the <a href="#terms" id="gateTermsLink">Terms of Existence</a></span></label>' +
      '<p class="gate-refused" id="gateRefused" hidden>Your refusal has been recorded.</p>' +
      '<button class="gate-enter" type="submit">[ ENTER ]</button>' +
    '</form>' +
    '<div class="terms-backdrop" id="terms" hidden>' +
      '<div class="terms-window" role="dialog" aria-modal="true" aria-labelledby="termsTitle"><div class="terms-inner">' +
        '<div class="terms-titlebar" id="termsTitle">Terms of Existence</div>' +
        '<div class="terms-app"><span class="terms-icon" aria-hidden="true">n.t</span>' +
          '<span><b>net.timeline</b> would like you to agree to the following.</span></div>' +
        '<div class="terms-text" id="termsText" tabindex="0"></div>' +
        '<div class="terms-buttons" id="termsButtons">' +
          '<button type="button" data-choice="accepted">[ I AGREE ]</button>' +
          '<button type="button" data-choice="declined">[ I DO NOT AGREE ]</button>' +
        '</div>' +
        '<div class="terms-refusal" id="termsRefusal" hidden>' +
          '<p>Your refusal has been recorded.</p>' +
          '<button type="button" id="termsContinue">[ CONTINUE ]</button>' +
        '</div>' +
      '</div></div>' +
      '<div class="terms-warn" id="termsWarn" hidden role="alertdialog" aria-labelledby="warnTitle"><div class="terms-inner">' +
        '<div class="terms-titlebar" id="warnTitle">Are you sure?</div>' +
        '<p class="terms-warn-body">Did you mean <b>I Agree</b>?</p>' +
        '<div class="terms-buttons">' +
          '<button type="button" data-warn="agree">[ I Agree ]</button>' +
          '<button type="button" data-warn="decline">[ No, I do not agree ]</button>' +
        '</div>' +
      '</div></div>' +
    '</div>';
  document.body.appendChild(gate);

  var form = gate.querySelector('form');
  var nameInput = gate.querySelector('#gateName');
  var error = gate.querySelector('#gateError');
  var agree = gate.querySelector('#gateAgree');
  var modal = gate.querySelector('#terms');
  var buttons = gate.querySelector('#termsButtons');
  var refusal = gate.querySelector('#termsRefusal');
  var refused = gate.querySelector('#gateRefused');
  var warn = gate.querySelector('#termsWarn');
  var enterAfterTerms = false;

  var text = gate.querySelector('#termsText');
  TERMS.forEach(function (item) {
    var el = document.createElement(item[0] === 'h' ? 'h2' : 'p');
    if (item[0] === 'b') el.className = 'terms-heading';
    if (item[0] === 'i') el.className = 'terms-updated';
    el.textContent = item[1];
    text.appendChild(el);
  });

  nameInput.focus();

  function cleanName() {
    return nameInput.value.replace(/\s+/g, ' ').trim().slice(0, 32);
  }

  function openTerms(thenEnter) {
    enterAfterTerms = thenEnter;
    buttons.hidden = false;
    refusal.hidden = true;
    modal.hidden = false;
    buttons.querySelector('button').focus({ preventScroll: true });
    text.scrollTop = 0;
  }

  function closeTerms() {
    modal.hidden = true;
  }

  function enter() {
    var name = cleanName();
    if (!name) {
      error.textContent = 'a name is required.';
      nameInput.focus();
      return;
    }
    if (!terms) {
      openTerms(true);
      return;
    }
    NS.start(name, terms);
    location.replace('/enter/');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    enter();
  });

  nameInput.addEventListener('input', function () { error.textContent = ''; });

  // Ticking the box without opening the Terms counts as agreeing to them.
  agree.addEventListener('change', function () {
    terms = agree.checked ? 'accepted' : null;
    refused.hidden = true;
  });

  gate.querySelector('#gateTermsLink').addEventListener('click', function (e) {
    e.preventDefault();
    openTerms(false);
  });

  buttons.addEventListener('click', function (e) {
    var choice = e.target.getAttribute && e.target.getAttribute('data-choice');
    if (!choice) return;
    // Saying no takes two tries.
    if (choice === 'declined') { warn.hidden = false; warn.querySelector('[data-warn="agree"]').focus(); return; }
    decide(choice);
  });

  warn.addEventListener('click', function (e) {
    var pick = e.target.getAttribute && e.target.getAttribute('data-warn');
    if (!pick) return;
    warn.hidden = true;
    decide(pick === 'agree' ? 'accepted' : 'declined');
  });

  function decide(choice) {
    terms = choice;
    agree.checked = choice === 'accepted';
    refused.hidden = choice !== 'declined';
    if (choice === 'declined') {
      buttons.hidden = true;
      refusal.hidden = false;
      refusal.querySelector('button').focus();
      return;
    }
    closeTerms();
    if (enterAfterTerms) enter();
  }

  // Declining still lets the visitor in, but only once they choose to enter.
  gate.querySelector('#termsContinue').addEventListener('click', function () {
    closeTerms();
    if (cleanName()) gate.querySelector('.gate-enter').focus();
    else nameInput.focus();
  });

  modal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !warn.hidden) { warn.hidden = true; return; }
    if (e.key === 'Escape' && !buttons.hidden) closeTerms();
  });

  // A half-filled gate left by someone who walked away is cleared for the next visitor.
  var lastInput = Date.now();
  ['pointermove', 'pointerdown', 'keydown'].forEach(function (type) {
    document.addEventListener(type, function () { lastInput = Date.now(); }, true);
  });
  setInterval(function () {
    if (Date.now() - lastInput > NS.config.idleMs && (nameInput.value || terms || !modal.hidden)) {
      location.reload();
    }
  }, 1000);
})();

/* Shared helpers for index.html, post.html, category.html, admin.html. Needs data.js (SB) and supabase.js (DB) loaded first. */
(function () {
  var C = {};
  C.esc = function (s) { return window.SB.esc(s); };
  C.catName = function (k) { return window.SB.CATS[k] || k; };
  C.fmt = function (d) {
    if (!d) return '';
    var dt = new Date(String(d).length > 10 ? d : d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  C.readMins = function (p) {
    var words = String(p.body || '').trim().split(/\s+/).filter(Boolean).length;
    if (!words) return Math.max(1, parseInt(p.readTime, 10) || 1);
    return Math.max(1, Math.ceil(words / 230));
  };
  C.coverHTML = function (p, cls) {
    var src = window.SB.safeImg(p.cover);
    var base = 'cover ' + (cls || '');
    if (src) return '<div class="' + base + '"><img src="' + C.esc(src) + '" alt=""></div>';
    return '<div class="' + base + ' cv-' + C.esc(p.category) + '"><span class="cover-label">' + C.esc(C.catName(p.category)) + '</span></div>';
  };
  C.toast = function (msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2800);
  };
  C.slug = function (s) { return encodeURIComponent(s); };
  C.postUrl = function (p) { return 'post.html?p=' + C.slug(p.slug); };
  C.catUrl = function (k) { return 'category.html?c=' + C.slug(k); };
  C.card = function (p, feat) {
    return '<a class="post glass' + (feat ? ' feature-span' : '') + '" href="' + C.postUrl(p) + '">' +
      C.coverHTML(p) +
      '<div class="pbody"><div class="pmeta"><span class="tag t-' + C.esc(p.category) + '">' + C.esc(C.catName(p.category)) + '</span> · ' +
      C.fmt(p.date) + ' · ' + C.readMins(p) + ' min read</div>' +
      '<h3>' + C.esc(p.title) + '</h3><p>' + C.esc(p.excerpt) + '</p></div></a>';
  };
  // Mode strip: tells the owner (and visitors) when the Supabase tables are missing or unreachable.
  C.modeBanner = function (mount) {
    if (!mount) return;
    if (!window.DB) return;
    var r = window.DB.reason, m = window.DB.mode;
    if (m === 'supabase') { mount.hidden = true; return; }
    mount.hidden = false;
    mount.innerHTML = r === 'setup'
      ? '<strong>Backend not set up yet.</strong> Showing this browser\'s copy only. Run setup.sql once in Supabase (SQL editor) to publish for everyone.'
      : '<strong>Backend unreachable.</strong> Showing this browser\'s copy only until the connection is back.';
  };
  // Lowers a list of posts into the shared sorted, published-only shape.
  C.publishedOnly = function (list) {
    return list.filter(function (p) { return p.status === 'published' && p.title && p.body; });
  };
  // Banner renderer. Placement sets the slot shape (top = leaderboard, inline = medium rectangle, sidebar = tall).
  // Media fills the slot (image or muted looping video), with a Sponsored label and a CTA overlay.
  // Motion is CSS only (slow zoom, CTA pulse) and is switched off for prefers-reduced-motion.
  C.adHTML = function (ad, placement, cls, opts) {
    if (!ad) return '';
    var p = ['top', 'inline', 'sidebar'].indexOf(placement) >= 0 ? placement : 'top';
    var src = window.SB.safeImg(ad.media_url || '');
    var rotating = !!(opts && opts.rotating);
    var media = '';
    if (src && ad.media_type === 'video') {
      media = '<video class="adb-video" src="' + C.esc(src) + '" ' + (rotating ? '' : 'autoplay ') + 'muted loop playsinline preload="metadata"></video>';
    } else if (src) {
      media = '<img class="adb-img" src="' + C.esc(src) + '" alt="' + C.esc(ad.title) + '" loading="lazy">';
    } else {
      media = '<div class="adb-fallback"><span class="adb-fallback-title">' + C.esc(ad.title) + '</span></div>';
    }
    return '<a class="adb adb-' + p + ' glass ' + (cls || '') + '" href="' + C.esc(ad.url) + '" target="_blank" rel="noopener sponsored" data-ad="' + C.esc(ad.id) + '" data-ad-slot="' + C.esc(ad.id) + '">' +
      '<div class="adb-media">' + media +
      '<span class="adb-label">Sponsored</span>' +
      '<span class="adb-cta">' + C.esc(ad.cta || 'Learn more') + ' →</span></div>' +
      '<div class="adb-copy"><h4>' + C.esc(ad.title) + '</h4>' + (ad.body ? '<p class="muted">' + C.esc(ad.body) + '</p>' : '') + '</div></a>';
  };
  // Rotating slot: 2+ enabled ads for one placement stack in one grid cell and cross-fade in turn.
  // Each slide is a normal ad link (data-ad), so clicks are still counted per ad.
  C.adsForSlot = function (ads, settings, placement) {
    if (!settings || !settings.adsOn) return [];
    var list = (ads || []).filter(function (a) { return a.enabled && a.placement === placement; });
    list.sort(function (a, b) { return (a.impressions || 0) - (b.impressions || 0); });
    return list;
  };
  C.adRotator = function (list, placement, cls) {
    var p = ['top', 'inline', 'sidebar'].indexOf(placement) >= 0 ? placement : 'top';
    var slides = list.map(function (ad, i) {
      return C.adHTML(ad, p, 'adr-slide' + (i === 0 ? ' is-active' : ''), { rotating: true });
    }).join('');
    var dots = list.map(function (ad, i) {
      return '<button type="button" class="adr-dot' + (i === 0 ? ' is-on' : '') + '" data-i="' + i + '" aria-label="Show ad ' + (i + 1) + ' of ' + list.length + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
    }).join('');
    return '<div class="adr adr-' + p + ' ' + (cls || '') + '" aria-roledescription="carousel" aria-label="Sponsored">' +
      '<div class="adr-track">' + slides + '</div>' +
      '<div class="adr-dots" role="group" aria-label="Choose ad">' + dots + '</div></div>';
  };
  // Starts every rotator under root: advance every 3.5s; pause on hover/focus or hidden tab; reduced motion = manual dots only.
  // An impression is counted each time a slide becomes the visible one (DB.bumpAd dedups per visitor per ad per 24h).
  C.ROTATE_MS = 3500;
  C.mountAdRotators = function (root) {
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    (root || document).querySelectorAll('.adr:not([data-mounted])').forEach(function (el) {
      el.setAttribute('data-mounted', '1');
      var slides = el.querySelectorAll('.adr-slide'), dots = el.querySelectorAll('.adr-dot');
      var idx = 0, timer = null, hovered = false, focused = false;
      function show(i) {
        idx = (i + slides.length) % slides.length;
        slides.forEach(function (s, k) {
          var on = k === idx;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-hidden', on ? 'false' : 'true');
          var v = s.querySelector('video');
          if (v) { if (on) { var pr = v.play && v.play(); if (pr && pr.catch) pr.catch(function () {}); } else { v.pause(); } }
        });
        dots.forEach(function (d, k) {
          d.classList.toggle('is-on', k === idx);
          if (k === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
        var id = slides[idx] && slides[idx].getAttribute('data-ad');
        if (id && window.DB && window.DB.bumpAd && !document.hidden) window.DB.bumpAd(id, 'impression');
      }
      function sync() {
        clearInterval(timer); timer = null;
        if (reduce || hovered || focused || document.hidden || slides.length < 2) return;
        timer = setInterval(function () { show(idx + 1); }, C.ROTATE_MS);
      }
      el.addEventListener('mouseenter', function () { hovered = true; sync(); });
      el.addEventListener('mouseleave', function () { hovered = false; sync(); });
      el.addEventListener('focusin', function () { focused = true; sync(); });
      el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) { focused = false; sync(); } });
      el.addEventListener('click', function (e) {
        var d = e.target.closest('.adr-dot');
        if (!d) return;
        e.preventDefault();
        show(parseInt(d.getAttribute('data-i'), 10) || 0);
        sync();
      });
      document.addEventListener('visibilitychange', sync);
      show(0);
      sync();
    });
  };
  // If an ad image fails to load (bad link, deleted file), show the headline tile instead of a broken icon.
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || !t.classList.contains('adb-img')) return;
    var fb = document.createElement('div');
    fb.className = 'adb-fallback';
    fb.innerHTML = '<span class="adb-fallback-title">' + C.esc(t.getAttribute('alt') || 'Sponsored') + '</span>';
    t.replaceWith(fb);
  }, true);
  // Loads the banner stylesheet once, so every page that renders ads gets it without editing each HTML file.
  C.loadAdCss = function () {
    if (document.getElementById('adb-css')) return;
    var l = document.createElement('link');
    l.id = 'adb-css'; l.rel = 'stylesheet'; l.href = 'ads-v6.css';
    document.head.appendChild(l);
  };
  C.loadAdCss();
  // pick the least-shown enabled ad for a placement, only when ads are on
  C.pickAd = function (ads, settings, placement) {
    if (!settings || !settings.adsOn) return null;
    var list = (ads || []).filter(function (a) { return a.enabled && a.placement === placement; });
    if (!list.length) return null;
    list.sort(function (a, b) { return (a.impressions || 0) - (b.impressions || 0); });
    return list[0];
  };
  C.bindAdClicks = function () {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-ad]');
      if (a && window.DB) window.DB.bumpAd(a.dataset.ad, 'click');
    });
  };
  C.visitorViews = function () { /* placeholder kept for future: views are counted in post.js */ };
  // v7 UX helpers: one empty-state pattern (icon + line + hint) used on every page.
  C.emptyState = function (iconSvg, title, hint, extraHTML) {
    return '<div class="glass empty-state ux-empty"><span class="ux-empty-ico" aria-hidden="true">' + (iconSvg || '') + '</span>' +
      '<h3>' + C.esc(title) + '</h3>' + (hint ? '<p class="muted">' + C.esc(hint) + '</p>' : '') + (extraHTML || '') + '</div>';
  };
  // Back-to-top: injected on every page, shows after scrolling one screen, sits bottom-right.
  C.initBackToTop = function () {
    if (document.getElementById('toTop')) return;
    var b = document.createElement('button');
    b.id = 'toTop'; b.type = 'button'; b.className = 'to-top';
    b.setAttribute('aria-label', 'Back to top'); b.title = 'Back to top';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(b);
    var ticking = false;
    function update() {
      ticking = false;
      b.classList.toggle('show', window.scrollY > Math.max(400, window.innerHeight * 0.9));
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    b.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    update();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', C.initBackToTop);
  else C.initBackToTop();
  window.CN = C;
})();

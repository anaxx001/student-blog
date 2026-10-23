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
  C.adHTML = function (ad, placement, cls) {
    if (!ad) return '';
    var p = ['top', 'inline', 'sidebar'].indexOf(placement) >= 0 ? placement : 'top';
    var src = window.SB.safeImg(ad.media_url || '');
    var media = '';
    if (src && ad.media_type === 'video') {
      media = '<video class="adb-video" src="' + C.esc(src) + '" autoplay muted loop playsinline preload="metadata"></video>';
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

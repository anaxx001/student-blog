/* Shared data layer for the blog and its admin page.
   Everything lives in localStorage on this device/browser. No demo content: a fresh install starts empty
   (apart from the unpublished intro draft slot). v2.1 keeps the same storage key, so v2 data carries over;
   new fields (logo, authorImage, cover) default to empty. */
(function () {
  var KEY = 'studentblog_v3';
  var LEGACY_KEYS = ['studentblog_v2', 'studentblog_admin_cred_v2', 'studentblog_admin_session_v2'];

  // One-time clean-up of old storage shapes. Old admin credentials and session keys are always dropped;
  // old v2 content is carried over only if it parses and no v3 content exists yet.
  function migrate() {
    try {
      var old = localStorage.getItem('studentblog_v2');
      if (localStorage.getItem(KEY) === null && old !== null) {
        var parsed = JSON.parse(old);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.posts)) localStorage.setItem(KEY, old);
      }
    } catch (e) { /* unreadable old content: start fresh */ }
    LEGACY_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  }
  migrate();
  var AUTHOR = 'Churchill Celestine';
  var CATS = {
    'anatomy': 'Anatomy',
    'physiology': 'Physiology',
    'biochemistry': 'Biochemistry',
    'radiography': 'Radiography',
    'clinicals': 'Clinicals',
    'study': 'Study',
    'uni-life': 'Uni Life'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function uid(prefix) { return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // only http(s) links or inline base64 images are ever used as image sources
  function safeImg(u) {
    u = String(u || '').trim();
    return (/^https?:\/\//i.test(u) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(u)) ? u : '';
  }

  // Logo slot: blank (nothing rendered) until the owner uploads or links a logo in admin settings.
  function logoHTML(settings) {
    var src = safeImg(settings && settings.logo);
    if (src) return '<span class="logo"><img src="' + esc(src) + '" alt="Site logo"></span>';
    return '';
  }
  function logoFootHTML(settings) {
    var src = safeImg(settings && settings.logo);
    if (src) return '<span class="logo-foot"><img src="' + esc(src) + '" alt="Site logo"></span>';
    return '';
  }

  // Post cover: photo when set, otherwise a gradient block with the category name.
  function coverHTML(p, cls) {
    var src = safeImg(p.cover);
    var base = 'cover ' + (cls || '');
    if (src) return '<div class="' + base + '"><img src="' + esc(src) + '" alt=""></div>';
    return '<div class="' + base + ' cv-' + esc(p.category) + '"><span class="cover-label">' + esc(CATS[p.category] || p.category) + '</span></div>';
  }

  // Ornament: a faint heartbeat line used under hero copy.
  var PULSE = '<svg viewBox="0 0 360 60" aria-hidden="true"><path d="M0 32h70l10-16 14 30 12-22 8 8h40l10-10 12 22 10-30 14 26h80" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>';

  function defaults() {
    return {
      posts: [
        {
          id: 'intro',
          title: 'Why this blog exists',
          category: 'uni-life',
          author: AUTHOR,
          status: 'draft',
          date: today(),
          readTime: 3,
          excerpt: '',
          body: '',
          cover: ''
        }
      ],
      ads: [],
      comments: [],
      daily: [],
      postViews: {},
      settings: { adsOn: false, whatsapp: '', logo: '', authorImage: '' },
      version: 2.1
    };
  }

  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function get() {
    var s = null;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    if (!s) { s = defaults(); save(s); return s; }
    var d = defaults();
    s.posts = s.posts || d.posts;
    s.posts.forEach(function (p) { if (p.cover == null) p.cover = ''; });
    s.ads = s.ads || [];
    s.comments = s.comments || [];
    s.daily = s.daily || [];
    s.postViews = s.postViews || {};
    s.settings = Object.assign({ adsOn: false, whatsapp: '', logo: '', authorImage: '' }, s.settings || {});
    s.version = 2.1;
    return s;
  }

  function bucket(s) {
    var t = today();
    var last = s.daily[s.daily.length - 1];
    if (!last || last.date !== t) {
      s.daily.push({ date: t, views: 0, uniques: 0 });
      if (s.daily.length > 60) s.daily.shift();
      last = s.daily[s.daily.length - 1];
    }
    return last;
  }

  window.SB = {
    CATS: CATS,
    AUTHOR: AUTHOR,
    uid: uid,
    today: today,
    esc: esc,
    safeImg: safeImg,
    logoHTML: logoHTML,
    logoFootHTML: logoFootHTML,
    coverHTML: coverHTML,
    PULSE: PULSE,
    get: get,
    save: save,
    reset: function () { localStorage.removeItem(KEY); return get(); },
    trackView: function () {
      var s = get();
      var b = bucket(s);
      b.views++;
      if (!localStorage.getItem('sb_visitor')) {
        localStorage.setItem('sb_visitor', uid('v'));
        b.uniques++;
      }
      save(s);
    },
    trackPost: function (id) {
      var s = get();
      s.postViews[id] = (s.postViews[id] || 0) + 1;
      save(s);
    },
    adImpression: function (id) {
      var s = get();
      var a = s.ads.find(function (x) { return x.id === id; });
      if (a) { a.impressions = (a.impressions || 0) + 1; save(s); }
    },
    adClick: function (id) {
      var s = get();
      var a = s.ads.find(function (x) { return x.id === id; });
      if (a) { a.clicks = (a.clicks || 0) + 1; save(s); }
    },
    addComment: function (c) {
      var s = get();
      s.comments.push({ id: uid('c'), postId: c.postId, name: c.name, text: c.text, status: 'pending', date: today() });
      save(s);
    }
  };
})();

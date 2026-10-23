(function () {
  var SB = window.SB, DB = window.DB, CN = window.CN, $ = function (s) { return document.querySelector(s); };

  function renderFeature(p) {
    if (!p) {
      $('#heroFeature').innerHTML = '<div class="glass feature"><div class="cover big cv-empty"><span class="cover-label">Coming soon</span></div>' +
        '<span class="tag t-uni-life">Coming soon</span><h3>First post coming soon.</h3>' +
        '<p class="muted">The first notes go up soon. Anatomy, physiology, biochemistry and radiography, explained the way I wish they had been explained to me.</p></div>';
      return;
    }
    $('#heroFeature').innerHTML = '<a class="glass feature feature-link" href="' + CN.postUrl(p) + '">' +
      CN.coverHTML(p, 'big') +
      '<span class="tag t-' + CN.esc(p.category) + '">Latest · ' + CN.esc(CN.catName(p.category)) + '</span>' +
      '<h3>' + CN.esc(p.title) + '</h3><p class="muted">' + CN.esc(p.excerpt) + '</p>' +
      '<span class="link">Read this one →</span></a>';
  }

  function renderCatLinks() {
    $('#catLinks').innerHTML = Object.keys(SB.CATS).map(function (k) {
      return '<a class="fchip" href="' + CN.catUrl(k) + '">' + CN.esc(SB.CATS[k]) + '</a>';
    }).join('');
  }

  function renderGrid(list) {
    if (!list.length) {
      $('#postGrid').innerHTML = '<div class="glass empty-state"><span class="eyebrow">Coming soon</span>' +
        '<h3>No posts yet.</h3><p class="muted">Nothing is published yet. Check back soon.</p></div>';
      return;
    }
    $('#postGrid').innerHTML = list.slice(0, 9).map(function (p) { return CN.card(p, false); }).join('');
  }

  function renderBrand(s) {
    $('#navLogo').innerHTML = SB.logoHTML(s);
    $('#footLogo').innerHTML = SB.logoFootHTML(s);
    if (s.tagline && $('#footTag')) $('#footTag').textContent = s.tagline;
    var src = SB.safeImg(s.authorImage);
    $('#authorRow').innerHTML = src ? '<button type="button" class="avatar-btn" aria-label="View author photo full size"><img class="avatar" src="' + CN.esc(src) + '" alt="Churchill Celestine"></button>' : '';
    $('#authorRow').hidden = !src;
    var wa = $('#whatsappLink'), url = s.whatsapp || '';
    if (/^https?:\/\//i.test(url)) { wa.setAttribute('href', url); wa.classList.remove('is-empty'); wa.title = 'WhatsApp'; }
    else { wa.removeAttribute('href'); wa.classList.add('is-empty'); wa.title = 'WhatsApp link not set yet'; }
  }

  function renderAds(s, ads) {
    $('#adTop').innerHTML = CN.adHTML(CN.pickAd(ads, s, 'top'), 'top', 'wide');
    $('#adSide').innerHTML = CN.adHTML(CN.pickAd(ads, s, 'sidebar'), 'sidebar', 'wide');
    if (DB.bumpAd) {
      var t = CN.pickAd(ads, s, 'top'), b = CN.pickAd(ads, s, 'sidebar');
      if (t) DB.bumpAd(t.id, 'impression');
      if (b) DB.bumpAd(b.id, 'impression');
    }
  }

  // Lightbox for the author photo: tap the photo to view it large; tap anywhere, the X, or Esc to close.
  function initLightbox() {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML = '<button type="button" class="lb-close" aria-label="Close">&times;</button><img class="lb-img" alt="">';
    document.body.appendChild(lb);
    var big = lb.querySelector('.lb-img');
    function close() {
      lb.classList.remove('open');
      lb.setAttribute('aria-hidden', 'true');
    }
    lb.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('open')) close();
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.avatar-btn');
      if (!b) return;
      var img = b.querySelector('img');
      if (!img) return;
      big.src = img.src;
      big.alt = img.alt;
      lb.setAttribute('aria-hidden', 'false');
      lb.classList.add('open');
    });
  }

  function initAbout() {
    var box = $('#aboutText'), btn = $('#aboutToggle');
    box.classList.add('is-collapsed');
    var fold = parseFloat(getComputedStyle(box).lineHeight) * 3;
    if (box.scrollHeight <= fold + 24) { btn.hidden = true; box.classList.remove('is-collapsed'); return; }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = box.classList.contains('is-collapsed');
      box.classList.toggle('is-collapsed', !open);
      box.style.maxHeight = open ? 'none' : '';
      btn.textContent = open ? 'See less' : 'See more';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  $('#subForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#subEmail').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#subMsg').textContent = 'Enter a valid email.'; return; }
    $('#subMsg').textContent = 'Saving…';
    DB.subscribe(email).then(function () {
      $('#subMsg').textContent = 'You are subscribed. Thanks!';
      $('#subEmail').value = '';
    }).catch(function () { $('#subMsg').textContent = 'Could not save right now. Try again later.'; });
  });

  CN.bindAdClicks();
  renderCatLinks();
  $('#pulseOrn').innerHTML = SB.PULSE;
  initAbout();
  initLightbox();

  DB.init().then(function () {
    CN.modeBanner(document.getElementById('modeBanner'));
    return Promise.all([DB.listPosts({ limit: 10 }), DB.getSettings(), DB.listAds()]);
  }).then(function (r) {
    var posts = CN.publishedOnly(r[0]), settings = r[1], ads = r[2];
    renderBrand(settings);
    renderFeature(posts[0] || null);
    renderGrid(posts.slice(1));
    renderAds(settings, ads);
  }).catch(function (e) {
    console.warn(e);
    renderFeature(null);
    renderGrid([]);
  });
})();

(function () {
  var SB = window.SB, DB = window.DB, CN = window.CN, $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(location.search);
  var slug = params.get('p') || '';

  function setProgress() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
    $('#rprogBar').style.transform = 'scaleX(' + pct.toFixed(4) + ')';
  }
  var toTop = document.getElementById('toTop');
  if (toTop) {
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  window.addEventListener('scroll', function () {
    setProgress();
    if (toTop) toTop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });
  window.addEventListener('resize', setProgress);

  function showNotFound() {
    $('#loading').hidden = true;
    $('#notFound').hidden = false;
  }

  function renderReactions(counts) {
    ['like', 'insight', 'save'].forEach(function (t) {
      var btn = document.querySelector('[data-react="' + t + '"]');
      btn.setAttribute('aria-pressed', counts.mine[t] ? 'true' : 'false');
      btn.classList.toggle('on', !!counts.mine[t]);
      document.querySelector('[data-count="' + t + '"]').textContent = counts[t];
    });
  }

  function renderComments(list) {
    $('#cList').innerHTML = list.length
      ? list.map(function (c) {
          var ini = String(c.name || '?').trim().charAt(0).toUpperCase();
          return '<div class="comment"><span class="cav cav-sm" aria-hidden="true">' + CN.esc(ini) + '</span><div class="comment-body"><b>' + CN.esc(c.name) + '</b> <span class="muted small">' + CN.fmt(c.date) + '</span><p>' + CN.esc(c.text) + '</p></div></div>';
        }).join('')
      : CN.emptyState('<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>', 'No comments yet.', 'Be the first to add a thought.');
  }

  function shareLinks(p) {
    var url = location.origin + location.pathname.replace(/[^/]*$/, '') + CN.postUrl(p);
    var text = p.title + ' · Anaxx Science Hub';
    $('#shareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    $('#shareWa').href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
    $('#shareCopy').onclick = function () {
      var done = function () { CN.toast('Link copied.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { CN.toast(url); });
      else { CN.toast(url); }
    };
  }

  function renderPostNav(p, all) {
    var list = all.slice().sort(function (a, b) { return String(b.publishedAt || b.date).localeCompare(String(a.publishedAt || a.date)); });
    var i = list.findIndex(function (x) { return x.id === p.id; });
    var newer = i > 0 ? list[i - 1] : null, older = i < list.length - 1 ? list[i + 1] : null;
    $('#postNav').innerHTML =
      (older ? '<a class="pn-link prev" href="' + CN.postUrl(older) + '"><small>← Older</small><span>' + CN.esc(older.title) + '</span></a>' : '<span></span>') +
      (newer ? '<a class="pn-link next" href="' + CN.postUrl(newer) + '"><small>Newer →</small><span>' + CN.esc(newer.title) + '</span></a>' : '<span></span>');
  }

  function renderRelated(p, all) {
    var rel = all.filter(function (x) { return x.id !== p.id && x.category === p.category; }).slice(0, 3);
    $('#relCat').textContent = CN.catName(p.category);
    $('#relatedWrap').hidden = !rel.length;
    $('#related').innerHTML = rel.map(function (x) { return CN.card(x, false); }).join('');
  }

  function bindReactions(postId) {
    document.getElementById('reactions').addEventListener('click', function (e) {
      var b = e.target.closest('[data-react]');
      if (!b) return;
      DB.toggleReaction(postId, b.dataset.react).then(renderReactions).catch(function () { CN.toast('Could not save that reaction.'); });
    });
  }

  function bindComments(postId) {
    $('#cForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#cName').value.trim(), text = $('#cText').value.trim();
      if (!name || !text) return;
      $('#cMsg').textContent = 'Sending…';
      DB.addComment(postId, name, text).then(function () {
        $('#cMsg').textContent = 'Thanks. Your comment shows once it is approved.';
        $('#cName').value = ''; $('#cText').value = '';
      }).catch(function () { $('#cMsg').textContent = 'Could not send right now. Try again later.'; });
    });
  }

  if (!slug) { showNotFound(); return; }

  var cName = document.getElementById('cName'), cAv = document.getElementById('cAv');
  if (cName && cAv) cName.addEventListener('input', function () {
    var v = cName.value.trim();
    cAv.textContent = v ? v.charAt(0).toUpperCase() : '+';
  });

  DB.init().then(function () {
    CN.modeBanner(document.getElementById('modeBanner'));
    return Promise.all([DB.getPost(slug), DB.listPosts({}), DB.getSettings()]);
  }).then(function (r) {
    var p = r[0], all = CN.publishedOnly(r[1]), settings = r[2];
    $('#navLogo').innerHTML = SB.logoHTML(settings);
    if (!p || p.status !== 'published') { showNotFound(); return; }

    document.title = p.title + ' · Anaxx Science Hub';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', p.excerpt || p.title);

    $('#cover').innerHTML = SB.safeImg(p.cover) ? CN.coverHTML(p, 'banner-cover') : '';
    $('#cat').className = 'tag t-' + p.category;
    $('#cat').textContent = CN.catName(p.category);
    $('#title').textContent = p.title;
    $('#meta').innerHTML = '<span class="byline-name">' + CN.esc(p.author || 'Churchill Celestine') + '</span>' +
      '<span class="byline-dot" aria-hidden="true">·</span><time>' + CN.esc(CN.fmt(p.date)) + '</time>' +
      '<span class="byline-dot" aria-hidden="true">·</span><span>' + CN.readMins(p) + ' min read</span>';
    $('#body').innerHTML = String(p.body).split(/\n\n+/).map(function (par) { return '<p>' + CN.esc(par) + '</p>'; }).join('');
    $('#loading').hidden = true;
    $('#article').hidden = false;

    DB.bumpView(p);
    shareLinks(p);
    renderPostNav(p, all);
    renderRelated(p, all);
    bindReactions(p.id);
    bindComments(p.id);
    DB.getReactions(p.id).then(renderReactions);
    DB.listComments(p.id).then(renderComments);
    setProgress();
    CN.bindAdClicks();
  }).catch(function (e) {
    console.warn(e);
    showNotFound();
  });
})();

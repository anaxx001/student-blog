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
      closeMenu();
    };
    // One Share button: on phones it opens the native share sheet; elsewhere a small menu with X, WhatsApp and Copy.
    var btn = $('#shareBtn'), menu = $('#shareMenu');
    function closeMenu() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.onclick = function () {
      if (navigator.share) { navigator.share({ title: p.title, text: text, url: url }).catch(function () {}); return; }
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    };
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.share-wrap')) closeMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  function safePostBody(value) {
    var source = String(value == null ? '' : value);
    if (!/<\/?(p|br|b|strong|i|em|u|h2|h3|ul|ol|li|a|img|span)\b/i.test(source)) {
      return source.split(/\n\n+/).map(function (part) { return '<p>' + CN.esc(part).replace(/\n/g, '<br>') + '</p>'; }).join('');
    }
    var doc = new DOMParser().parseFromString(source, 'text/html');
    var allowed = { p: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, h2: 1, h3: 1, ul: 1, ol: 1, li: 1, a: 1, img: 1, span: 1 };
    function clean(node) {
      var out = document.createDocumentFragment();
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) { out.appendChild(document.createTextNode(child.nodeValue)); return; }
        if (child.nodeType !== 1) return;
        var tag = child.tagName.toLowerCase();
        if (!allowed[tag]) { out.appendChild(clean(child)); return; }
        var el = document.createElement(tag);
        if (tag === 'a') {
          var href = child.getAttribute('href') || '';
          if (/^(https?:\/\/|mailto:)/i.test(href) || /^\/(?!\/)/.test(href) || /^#[A-Za-z0-9_-]+$/.test(href)) el.setAttribute('href', href);
        }
        if (tag === 'span') {
          var fontSize = child.style && child.style.fontSize;
          if (fontSize === '0.85em' || fontSize === '1em' || fontSize === '1.25em') el.style.fontSize = fontSize;
        }
        if (tag === 'img') {
          var src = child.getAttribute('src') || '';
          if (!/^https?:\/\//i.test(src)) return;
          el.setAttribute('src', src);
          el.setAttribute('alt', child.getAttribute('alt') || '');
          el.setAttribute('loading', 'lazy');
          el.style.maxWidth = '100%'; el.style.height = 'auto';
        }
        if (tag !== 'img' && tag !== 'br') el.appendChild(clean(child));
        out.appendChild(el);
      });
      return out;
    }
    var root = doc.createElement('div');
    root.appendChild(clean(doc.body));
    return root.innerHTML;
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

  function bindBookmark(post) { var btn=document.getElementById('bookmarkBtn'); if(!btn)return; function get(){try{return JSON.parse(localStorage.getItem('anaxx_saved_posts')||'[]').map(String);}catch(e){return[];}} function paint(){var yes=get().indexOf(String(post.id))!==-1;btn.setAttribute('aria-pressed',yes?'true':'false');btn.textContent=yes?'Saved to reading list':'Save to reading list';} btn.addEventListener('click',function(){var a=get(),id=String(post.id);a=a.indexOf(id)===-1?a.concat([id]):a.filter(function(x){return x!==id;});localStorage.setItem('anaxx_saved_posts',JSON.stringify(a));paint();});paint();}
  function bindComments(postId) {
    $('#cForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#cName').value.trim(), email = $('#cEmail').value.trim(), text = $('#cText').value.trim();
      if (!name || !text) return;
      $('#cMsg').textContent = 'Sending…';
      DB.addComment(postId, name, text, email).then(function () {
        $('#cMsg').textContent = 'Thanks. Your comment shows once it is approved.';
        $('#cName').value = ''; $('#cEmail').value = ''; $('#cText').value = '';
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
    return Promise.all([DB.getPost(slug), DB.listPosts({}), DB.getSettings(), DB.listAds ? DB.listAds() : Promise.resolve([])]);
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
    $('#body').innerHTML = safePostBody(p.body);
    // 'inside post' ads render between the article and the action bar; 2+ stack into a rotator
    var inlineAds = CN.adsForSlot(r[3] || [], settings, 'inline');
    var adBox = $('#adInline');
    if (adBox && inlineAds.length) {
      if (inlineAds.length === 1) {
        adBox.innerHTML = CN.adHTML(inlineAds[0], 'inline', 'wide');
        if (DB.bumpAd) DB.bumpAd(inlineAds[0].id, 'impression');
      } else {
        adBox.innerHTML = CN.adRotator(inlineAds, 'inline', 'wide');
        CN.mountAdRotators(adBox);
      }
    }
    $('#loading').hidden = true;
    $('#article').hidden = false;

    DB.bumpView(p);
    shareLinks(p);
    renderPostNav(p, all);
    renderRelated(p, all);
    bindReactions(p.id);
    bindBookmark(p);
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

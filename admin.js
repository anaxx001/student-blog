(function () {
  var SB = window.SB, DB = window.DB, CN = window.CN, $ = function (s) { return document.querySelector(s); };
  DB.strict = true; // admin never runs on the local copy: failures show an error instead
  var setupMode = /[?&]setup=1\b/.test(location.search);
  var posts = [], ads = [], subs = [], settings = null;
  var currentEmail = '', recovering = false;

  function emailFunction(payload) {
    return DB.auth.session().then(function (session) {
      var cfg = window.SB_EMAIL_CONFIG;
      if (!cfg || !session || !session.access_token) throw new Error('Admin session expired. Log in again.');
      return fetch(cfg.url + '/functions/v1/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey, Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify(payload)
      });
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || !data.ok) throw new Error(data.error || 'Email service returned an error.');
        return data;
      });
    });
  }

  function toast(m) { CN.toast(m); }
  function setMsg(id, m) { $(id).textContent = m || ''; }
  function friendly(err) {
    var m = String((err && err.message) || '');
    if (/invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first (check your inbox), then log in.';
    if (/already registered|already been registered|already exists/i.test(m)) return 'That email already has an account. Log in with it instead.';
    if (/at least|weak|password should/i.test(m)) return 'Password is too weak. Use at least 8 characters.';
    if (/rate limit|too many|seconds/i.test(m)) return 'Too many tries. Wait a few minutes, then try again.';
    return m || 'Something went wrong. Try again.';
  }

  function renderMode() {
    var pill = $('#modePill');
    if (DB.mode === 'supabase') { pill.textContent = 'Live · Supabase'; pill.className = 'mode-pill live'; }
    else { pill.textContent = DB.reason === 'setup' ? 'Setup needed' : 'Offline'; pill.className = 'mode-pill local'; }
  }

  /* ---------- auth screens: gate, sign in, owner setup, reset, admin ---------- */
  function showPanel(id) {
    ['#gateErr', '#loginForm', '#setupForm', '#resetForm'].forEach(function (s) { $(s).hidden = s !== id; });
    $('#loginBox').hidden = false;
    $('#adminBody').hidden = true;
    $('#logoutBtn').hidden = true;
  }
  function showGate(kind) {
    $('#gateErr').textContent = kind === 'setup'
      ? 'The database is not set up yet. Run setup-v5.sql in the Supabase SQL editor, then reload this page.'
      : 'Cannot reach Supabase right now, so the admin is locked. It never runs on this browser alone. Check your connection and reload.';
    showPanel('#gateErr');
  }
  function showLogin(msg) { showPanel('#loginForm'); setMsg('#loginMsg', msg || ''); }
  function showSetup() { showPanel('#setupForm'); }
  function showAdmin(session) {
    currentEmail = (session && session.user && session.user.email) || '';
    $('#accEmail').textContent = currentEmail;
    $('#loginBox').hidden = true;
    $('#adminBody').hidden = false;
    $('#logoutBtn').hidden = false;
    return refreshAll();
  }
  function denyLogin(msg) { return DB.auth.signOut().then(function () { showLogin(msg); }); }

  // Decides what the page shows for a session. Admin needs is_admin() true on the server.
  function route(session) {
    return DB.auth.setupOpen().then(function (open) {
      if (!session) {
        if (setupMode && open) return showSetup();
        if (setupMode && !open) return showLogin('The owner account is already set up. Log in below.');
        return showLogin();
      }
      return DB.auth.isAdmin().then(function (isAdmin) {
        if (isAdmin) return showAdmin(session);
        if (setupMode && open) {
          return DB.auth.claimAdmin().then(function (ok) {
            if (ok) { toast('Owner admin claimed.'); return showAdmin(session); }
            return denyLogin('Admin was claimed by another account just now. Log in with the owner account.');
          });
        }
        return denyLogin('This account does not have admin access.');
      });
    });
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    setMsg('#loginMsg', 'Logging in…');
    DB.auth.signIn($('#loginEmail').value.trim(), $('#loginPass').value)
      .then(route)
      .then(function () { setMsg('#loginMsg', ''); $('#loginPass').value = ''; })
      .catch(function (err) { setMsg('#loginMsg', friendly(err)); });
  });
  $('#forgotBtn').addEventListener('click', function () {
    var email = $('#loginEmail').value.trim();
    if (!email) return setMsg('#loginMsg', 'Type your admin email above, then tap Forgot password again.');
    setMsg('#loginMsg', 'Sending…');
    DB.auth.resetPassword(email)
      .then(function () { setMsg('#loginMsg', 'If that email has an account, a reset link is on its way. Open it on this device.'); })
      .catch(function (err) { setMsg('#loginMsg', friendly(err)); });
  });
  $('#toLogin').addEventListener('click', function () { showLogin(); });

  $('#setupForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#setEmail').value.trim(), p1 = $('#setPass').value, p2 = $('#setPass2').value;
    if (p1.length < 8) return setMsg('#setupMsg', 'Password must be at least 8 characters.');
    if (p1 !== p2) return setMsg('#setupMsg', 'The two passwords do not match.');
    setMsg('#setupMsg', 'Creating your owner account…');
    DB.auth.signUp(email, p1).then(function (session) {
      if (session) return route(session);
      setMsg('#setupMsg', 'Account created. If Supabase sent a confirm email, open that link first, then open this page with ?setup=1 and log in with the same email and password.');
    }).catch(function (err) { setMsg('#setupMsg', friendly(err)); });
  });

  $('#resetForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var p1 = $('#resetPass').value, p2 = $('#resetPass2').value;
    if (p1.length < 8) return setMsg('#resetMsg', 'Password must be at least 8 characters.');
    if (p1 !== p2) return setMsg('#resetMsg', 'The two passwords do not match.');
    DB.auth.updatePassword(p1).then(function () {
      recovering = false; toast('Password updated.');
      return DB.auth.session().then(route);
    }).catch(function (err) { setMsg('#resetMsg', friendly(err)); });
  });

  function signOutNow() { DB.auth.signOut().then(function () { showLogin('Signed out.'); }); }
  $('#logoutBtn').addEventListener('click', signOutNow);
  $('#accSignOut').addEventListener('click', signOutNow);

  // eye toggles on every password field
  document.querySelectorAll('.pw-eye').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = document.getElementById(b.dataset.eye);
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x === t); });
      document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; });
    });
  });
  /* ---------- dashboard ---------- */
  function renderDash(pendingCount) {
    var pub = posts.filter(function (p) { return p.status === 'published'; });
    var views = posts.reduce(function (n, p) { return n + (p.views || 0); }, 0);
    $('#stPosts').textContent = posts.length;
    $('#stPostsSub').textContent = pub.length + ' published · ' + (posts.length - pub.length) + ' draft';
    $('#stViews').textContent = views;
    $('#stPending').textContent = pendingCount;
    $('#stSubs').textContent = subs.length;
  }
  function refreshDash() {
    return Promise.all([DB.listAllComments('pending')]).then(function (r) {
      renderDash(r[0].length);
    }).catch(function () { renderDash(0); });
  }

  /* ---------- traffic chart (canvas, zero deps) ---------- */
  var trRows = {}; var trDays = []; var trMax = 0; var trHits = [];
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseYmd(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function shortDay(s) { return parseYmd(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function setRangeInputs(days) {
    var to = new Date(); var from = new Date(); from.setDate(from.getDate() - (days - 1));
    $('#trFrom').value = ymd(from); $('#trTo').value = ymd(to);
    document.querySelectorAll('.traffic-preset').forEach(function (b) { b.classList.toggle('on', +b.dataset.days === days); });
  }
  function buildDays(from, to) {
    var out = []; var d = parseYmd(from); var end = parseYmd(to);
    while (d <= end && out.length < 732) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function drawTraffic() {
    var cv = $('#trCanvas'); if (!cv || !cv.getContext) return;
    var wrap = cv.parentNode; var W = Math.max(280, wrap.clientWidth || 600); var H = 240;
    var dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var padL = 44, padR = 12, padT = 12, padB = 28;
    var pw = W - padL - padR, ph = H - padT - padB;
    var max = Math.max(trMax, 1); var n = trDays.length;
    g.font = '12px system-ui, sans-serif'; g.textBaseline = 'middle';
    // grid + y labels
    g.strokeStyle = '#d7ebe6'; g.fillStyle = '#4b6664'; g.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padT + ph - (ph * i / 4);
      g.beginPath(); g.moveTo(padL, y + 0.5); g.lineTo(W - padR, y + 0.5); g.stroke();
      g.textAlign = 'right'; g.fillText(String(Math.round(max * i / 4)), padL - 8, y);
    }
    trHits = [];
    if (!n) { g.textAlign = 'center'; g.fillText('No days in range', W / 2, H / 2); return; }
    var xs = function (k) { return n === 1 ? padL + pw / 2 : padL + (pw * k / (n - 1)); };
    var ys = function (v) { return padT + ph - (ph * v / max); };
    // area + line
    g.beginPath();
    trDays.forEach(function (day, k) { var x = xs(k), y = ys(trRows[day] || 0); if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); });
    g.lineTo(xs(n - 1), padT + ph); g.lineTo(xs(0), padT + ph); g.closePath();
    g.fillStyle = 'rgba(15,157,138,0.14)'; g.fill();
    g.beginPath();
    trDays.forEach(function (day, k) { var x = xs(k), y = ys(trRows[day] || 0); if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); });
    g.strokeStyle = '#0f9d8a'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
    // dots (only when the range is short enough to read)
    if (n <= 40) {
      g.fillStyle = '#0b6f63';
      trDays.forEach(function (day, k) { g.beginPath(); g.arc(xs(k), ys(trRows[day] || 0), 3, 0, Math.PI * 2); g.fill(); });
    }
    // x labels: about 6 evenly spaced
    g.fillStyle = '#4b6664'; g.textBaseline = 'top'; g.textAlign = 'center';
    var step = Math.max(1, Math.ceil(n / 6));
    for (var j = 0; j < n; j += step) g.fillText(shortDay(trDays[j]), xs(j), padT + ph + 8);
    if ((n - 1) % step !== 0) g.fillText(shortDay(trDays[n - 1]), xs(n - 1), padT + ph + 8);
    // hit boxes for hover/touch
    trDays.forEach(function (day, k) { trHits.push({ x: xs(k), y: ys(trRows[day] || 0), day: day, v: trRows[day] || 0 }); });
  }
  function showTip(e) {
    var tip = $('#trTip'), cv = $('#trCanvas');
    if (!trHits.length) { tip.hidden = true; return; }
    var rect = cv.getBoundingClientRect();
    var pt = e.touches ? e.touches[0] : e;
    var mx = pt.clientX - rect.left;
    var best = null, bd = Infinity;
    trHits.forEach(function (h) { var d = Math.abs(h.x - mx); if (d < bd) { bd = d; best = h; } });
    if (!best || bd > 24) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.textContent = shortDay(best.day) + ': ' + best.v + ' view' + (best.v === 1 ? '' : 's');
    tip.style.left = Math.min(Math.max(best.x - 60, 0), rect.width - 130) + 'px';
    tip.style.top = Math.max(best.y - 34, 0) + 'px';
  }
  function loadTraffic() {
    var from = $('#trFrom').value, to = $('#trTo').value;
    if (!from || !to) return Promise.resolve();
    if (from > to) { var t = from; from = to; to = t; $('#trFrom').value = from; $('#trTo').value = to; }
    trDays = buildDays(from, to);
    return DB.listTraffic(from, to).then(function (rows) {
      trRows = {}; var total = 0, best = null;
      (rows || []).forEach(function (r) { var k = String(r.day).slice(0, 10); trRows[k] = (trRows[k] || 0) + (r.views || 0); });
      trDays.forEach(function (d) { var v = trRows[d] || 0; total += v; if (!best || v > best.v) best = { d: d, v: v }; });
      trMax = trDays.reduce(function (m, d) { return Math.max(m, trRows[d] || 0); }, 0);
      $('#trTotal').textContent = total;
      $('#trBest').textContent = best && best.v > 0 ? shortDay(best.d) + ' (' + best.v + ')' : 'none';
      drawTraffic();
    }).catch(function () {
      trRows = {}; trMax = 0;
      $('#trTotal').textContent = '0'; $('#trBest').textContent = 'none';
      drawTraffic();
    });
  }
  function wireTraffic() {
    if (!$('#trCanvas')) return;
    setRangeInputs(30);
    document.querySelectorAll('.traffic-preset').forEach(function (b) {
      b.addEventListener('click', function () { setRangeInputs(+b.dataset.days); loadTraffic(); });
    });
    $('#trApply').addEventListener('click', function () {
      document.querySelectorAll('.traffic-preset').forEach(function (x) { x.classList.remove('on'); });
      loadTraffic();
    });
    ['#trFrom', '#trTo'].forEach(function (s) {
      $(s).addEventListener('change', function () { document.querySelectorAll('.traffic-preset').forEach(function (x) { x.classList.remove('on'); }); });
    });
    var cv = $('#trCanvas');
    cv.addEventListener('mousemove', showTip);
    cv.addEventListener('touchstart', showTip, { passive: true });
    cv.addEventListener('touchmove', showTip, { passive: true });
    cv.addEventListener('mouseleave', function () { $('#trTip').hidden = true; });
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawTraffic, 150); });
    loadTraffic();
  }

  /* ---------- posts ---------- */
  function fillCats() {
    $('#pCat').innerHTML = CN.categoryRows(settings || {}).map(function (x) { return '<option value="' + CN.esc(x.slug) + '">' + CN.esc(x.name || x.slug) + (x.visible === false ? ' (hidden)' : '') + '</option>'; }).join('');
  }
  function renderPosts() {
    if (!posts.length) { $('#postList').innerHTML = '<p class="muted">No posts yet. Click New post to write your first one.</p>'; return; }
    $('#postList').innerHTML = posts.map(function (p) {
      return '<div class="row-item"><div><b>' + CN.esc(p.title) + '</b><div class="muted small">' + CN.esc(CN.catName(p.category)) +
        ' · ' + (p.status === 'published' ? 'published' : 'draft') + ' · ' + (p.views || 0) + ' views</div></div>' +
        '<div class="row-btns">' +
        (p.status === 'published' ? '<a class="btn btn-line" href="' + CN.postUrl(p) + '" target="_blank" rel="noopener">View</a>' : '') +
        '<button class="btn btn-line" data-edit="' + CN.esc(p.id) + '" type="button">Edit</button></div></div>';
    }).join('');
  }
  function editorContent(body) {
    var s = String(body || '');
    if (/<\/?(p|br|b|strong|i|em|u|s|strike|h[1-6]|ul|ol|li|a|img|span|hr|blockquote|div|pre|code|sub|sup)\b/i.test(s)) return s;
    return s.split(/\n\n+/).map(function (part) { return '<p>' + CN.esc(part).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function openPostForm(p) {
    $('#postForm').hidden = false;
    $('#postFormTitle').textContent = p ? 'Edit post' : 'New post';
    $('#pId').value = p ? p.id : '';
    $('#pTitle').value = p ? p.title : '';
    $('#pCat').value = p ? p.category : 'anatomy';
    $('#pAuthor').value = p ? p.author : 'Churchill Celestine';
    $('#pExcerpt').value = p ? p.excerpt : '';
    $('#pBody').value = p ? p.body : '';
    $('#bodyEditor').innerHTML = p ? editorContent(p.body) : '';
    savedRange = null;
    resetEditorHistory();
    document.querySelectorAll('.editor-tool').forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
    $('#editorSize').value = '';
    setMsg('#bodyUploadMsg', '');
    $('#pCover').value = p ? p.cover : '';
    $('#pRead').value = p ? p.readTime : '';
    $('#pStatus').value = p ? p.status : 'draft';
    $('#deletePost').hidden = !p;
    setMsg('#postMsg', '');
    $('#postForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#newPostBtn').addEventListener('click', function () { openPostForm(null); });
  $('#cancelPost').addEventListener('click', function () { $('#postForm').hidden = true; });
  $('#postList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-edit]');
    if (!b) return;
    var p = posts.find(function (x) { return x.id === b.dataset.edit; });
    if (p) openPostForm(p);
  });
  $('#postForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('#pTitle').value.trim();
    if (!title) { setMsg('#postMsg', 'Add a title.'); $('#pTitle').focus(); return; }
    $('#pBody').value = $('#bodyEditor').innerHTML;
    var body = $('#pBody').value.trim();
    var status = $('#pStatus').value;
    if (status === 'published' && !body) { setMsg('#postMsg', 'A published post needs a body.'); bodyEditor.focus(); return; }
    var words = body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    var read = parseInt($('#pRead').value, 10) || Math.max(1, Math.ceil(words / 230));
    var id = $('#pId').value || null;
    var prev = id ? posts.find(function (x) { return x.id === id; }) : null;
    var payload = {
      id: id, title: title, category: $('#pCat').value, author: $('#pAuthor').value.trim() || 'Churchill Celestine',
      excerpt: $('#pExcerpt').value.trim(), body: body, cover: $('#pCover').value.trim(), readTime: read, status: status,
      slug: prev ? prev.slug : DB.slugify(title) + '-' + Math.random().toString(36).slice(2, 6),
      publishedAt: prev && prev.status === 'published' && prev.publishedAt ? prev.publishedAt : null
    };
    setMsg('#postMsg', 'Saving…');
    var saveButton = $('#postForm button[type="submit"]');
    saveButton.disabled = true;
    DB.savePost(payload).then(function (savedPost) {
      toast(status === 'published' ? 'Published.' : 'Draft saved.');
      $('#postForm').hidden = true;
      return refreshAll().then(function () {
        if (status !== 'published') return;
        var excerpt = payload.excerpt || String(payload.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        return emailFunction({ kind: 'publish', postId: savedPost.id, slug: savedPost.slug, title: savedPost.title, excerpt: excerpt })
          .then(function (result) { toast('Subscriber email sent to ' + result.sent + ' address' + (result.sent === 1 ? '' : 'es') + '.'); })
          .catch(function (err) { toast('Post published, but email failed: ' + ((err && err.message) || 'unknown error')); });
      });
    }).catch(function (err) { setMsg('#postMsg', 'Could not save: ' + ((err && err.message) || 'unknown error') + '. Your post is not stored yet.'); })
      .then(function () { saveButton.disabled = false; }, function () { saveButton.disabled = false; });
  });
  $('#deletePost').addEventListener('click', function () {
    var id = $('#pId').value;
    if (!id || !confirm('Delete this post and its comments? This cannot be undone.')) return;
    DB.deletePost(id).then(function () { toast('Deleted.'); $('#postForm').hidden = true; return refreshAll(); })
      .catch(function () { setMsg('#postMsg', 'Could not delete.'); });
  });
  function refreshPosts() { return DB.listPosts({ all: true }).then(function (list) { posts = list; renderPosts(); }); }

  /* ---------- comments ---------- */
  var commentRows = [];
  function renderComments(list) { commentRows = list;
    if (!list.length) { $('#commentList').innerHTML = '<p class="muted">Nothing here.</p>'; return; }
    $('#commentList').innerHTML = list.map(function (c) {
      var status = c.status || (c.approved ? 'approved' : 'pending');
      return '<div class="row-item"><div><b>' + CN.esc(c.name) + '</b> <span class="muted small">on ' + CN.esc(c.postTitle) + ' · ' + CN.fmt(c.date) +
        ' · ' + status + '</span><p>' + CN.esc(c.text) + '</p></div>' +
        '<div class="row-btns">' +
        (status === 'approved' ? '<button class="btn btn-line" data-reply="' + CN.esc(c.id) + '" type="button">Reply</button>' : '<button class="btn btn-dark" data-approve="' + CN.esc(c.id) + '" type="button">Approve</button>') +
        (status === 'approved' ? '<div class="reply-box" data-reply-box="' + CN.esc(c.id) + '" hidden><p class="muted small">' + (c.email ? 'Send a notification email, or open a mailto draft as fallback.' : 'No email was left, so no notification is possible.') + '</p><textarea class="field" data-reply-text="' + CN.esc(c.id) + '" placeholder="Write your reply"></textarea>' + (c.email ? '<button class="btn btn-dark" data-send-reply="' + CN.esc(c.id) + '" type="button">Send reply notification</button><button class="btn btn-line" data-mailto-reply="' + CN.esc(c.id) + '" type="button">Prepare email reply</button>' : '') + '</div>' : '') +
        (status === 'spam' ? '' : '<button class="btn btn-line" data-spam="' + CN.esc(c.id) + '" type="button">Spam</button>') +
        '<button class="btn btn-line danger" data-cdel="' + CN.esc(c.id) + '" type="button">Delete</button></div></div>';
    }).join('');
  }
  function refreshComments() {
    return DB.listAllComments($('#cFilter').value).then(renderComments).catch(function () { renderComments([]); });
  }
  $('#cFilter').addEventListener('change', refreshComments);
  $('#commentList').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    var p;
    if (t.dataset.approve) p = DB.setCommentApproved(t.dataset.approve, true);
    else if (t.dataset.reply) { var bx=document.querySelector('[data-reply-box=\"'+t.dataset.reply+'\"]'); if(bx) bx.hidden=!bx.hidden; return; }
    else if (t.dataset.sendReply || t.dataset.mailtoReply) { var replyId = t.dataset.sendReply || t.dataset.mailtoReply, c=commentRows.filter(function(x){return String(x.id)===String(replyId);})[0],replyField=document.querySelector('[data-reply-text=\"'+replyId+'\"]'),txt=replyField?replyField.value.trim():''; if(!c||!txt)return; if(!c.email){toast('No email was left for this comment.');return;} var post=posts.filter(function(x){return String(x.id)===String(c.postId);})[0]; if(!post){toast('Could not find the post link.');return;} var url=new URL(CN.postUrl(post),location.href).href; if(t.dataset.mailtoReply){var sub='your comment on Anaxx Science Hub got a reply',body=txt+'\n\nRead the post: '+url;location.href='mailto:'+c.email+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);return;} t.disabled=true; emailFunction({kind:'reply',email:c.email,replyText:txt,postTitle:c.postTitle,postUrl:url}).then(function(){toast('Reply notification sent.');}).catch(function(err){toast('Could not send reply notification: '+((err&&err.message)||'unknown error')+'. Use Prepare email reply as fallback.');}).then(function(){t.disabled=false;}); return; }
    else if (t.dataset.spam) p = DB.setCommentSpam(t.dataset.spam);
    else if (t.dataset.cdel) { if (!confirm('Delete this comment?')) return; p = DB.deleteComment(t.dataset.cdel); }
    if (p) p.then(function () { return refreshComments().then(refreshDash); }).catch(function () { toast('Could not update that comment.'); });
  });

  /* ---------- subscribers ---------- */
  function maskEmail(e) {
    var at = e.indexOf('@'); if (at < 1) return '•••';
    var name = e.slice(0, at), dom = e.slice(at);
    return (name.length <= 2 ? name.charAt(0) : name.slice(0, 2)) + '•••' + dom;
  }
  function renderSubs() {
    $('#subCount').textContent = subs.length;
    var q = ($('#subSearch').value || '').trim().toLowerCase();
    var list = q ? subs.filter(function (s) { return s.email.toLowerCase().indexOf(q) !== -1; }) : subs;
    if (!subs.length) { $('#subList').innerHTML = '<p class="muted">No subscribers yet.</p>'; return; }
    if (!list.length) { $('#subList').innerHTML = '<p class="muted">No match.</p>'; return; }
    $('#subList').innerHTML = list.map(function (s) {
      return '<div class="row-item"><div><b>' + CN.esc(maskEmail(s.email)) + '</b> <span class="muted small">' + CN.esc(s.date || '') + '</span></div>' +
        '<div class="row-btns"><button class="btn btn-line danger" data-sdel="' + CN.esc(s.id) + '" type="button">Remove</button></div></div>';
    }).join('');
  }
  function refreshSubs() {
    return DB.listSubscribers().then(function (list) { subs = list; renderSubs(); }).catch(function () { subs = []; renderSubs(); });
  }
  $('#subSearch').addEventListener('input', renderSubs);
  $('#subList').addEventListener('click', function (e) {
    var t = e.target.closest('[data-sdel]'); if (!t) return;
    if (!confirm('Remove this subscriber? They will stop getting your newsletter.')) return;
    DB.deleteSubscriber(t.dataset.sdel).then(function () { toast('Removed.'); return refreshSubs().then(refreshDash); })
      .catch(function () { setMsg('#subMsg', 'Could not remove that subscriber.'); });
  });
  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  $('#exportSubs').addEventListener('click', function () {
    if (!subs.length) return setMsg('#subMsg', 'No subscribers to export yet.');
    var rows = [['email', 'subscribed']].concat(subs.map(function (s) { return [s.email, s.date || '']; }));
    var csv = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'anaxx-subscribers-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setMsg('#subMsg', 'Exported ' + subs.length + ' address' + (subs.length === 1 ? '' : 'es') + '.');
  });

  /* ---------- ads ---------- */
  function renderAds() {
    $('#adsOn').checked = !!(settings && settings.adsOn);
    $('#adList').innerHTML = ads.length ? ads.map(function (a) {
      var ctr = a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) + '%' : '0%';
      return '<div class="row-item"><div><b>' + CN.esc(a.name) + '</b> · ' + CN.esc(a.placement) + (a.enabled ? '' : ' · off') +
        '<div class="muted small">' + (a.impressions || 0) + ' views · ' + (a.clicks || 0) + ' clicks · ' + ctr + ' CTR</div></div>' +
        '<div class="row-btns"><button class="btn btn-line" data-aedit="' + CN.esc(a.id) + '" type="button">Edit</button>' +
        '<button class="btn btn-line" data-atoggle="' + CN.esc(a.id) + '" type="button">' + (a.enabled ? 'Disable' : 'Enable') + '</button>' +
        '<button class="btn btn-line danger" data-adel="' + CN.esc(a.id) + '" type="button">Delete</button></div></div>';
    }).join('') : '<p class="muted">No ads yet.</p>';
  }
  function clearAdForm() { $('#adForm').reset(); $('#aId').value = ''; $('#aEnabled').checked = true; $('#aMediaType').value = 'image'; $('#aMediaPrev').textContent = ''; setMsg('#adMsg', ''); }
  // Media: a picked file uploads to the 'media' bucket on save; a pasted link is used as-is.
  $('#aMediaUrl').addEventListener('input', function () { $('#aMediaType').value = 'image'; });
  $('#aMediaFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    $('#aMediaPrev').textContent = f ? ('Selected: ' + f.name + ' (' + Math.round(f.size / 1024) + ' KB)') : '';
  });
  $('#cancelAd').addEventListener('click', clearAdForm);
  $('#adList').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.aedit) {
      var a = ads.find(function (x) { return x.id === t.dataset.aedit; }); if (!a) return;
      $('#aId').value = a.id; $('#aName').value = a.name; $('#aPlace').value = a.placement; $('#aTitle').value = a.title;
      $('#aBody').value = a.body; $('#aCta').value = a.cta; $('#aUrl').value = a.url; $('#aEnabled').checked = a.enabled;
      $('#aMediaUrl').value = a.media_url || ''; $('#aMediaType').value = a.media_type || 'image';
      $('#aMediaPrev').textContent = a.media_url ? ('Current media: ' + a.media_type) : '';
    } else if (t.dataset.atoggle) {
      var b = ads.find(function (x) { return x.id === t.dataset.atoggle; }); if (!b) return;
      DB.saveAd({ id: b.id, name: b.name, placement: b.placement, title: b.title, body: b.body, cta: b.cta, url: b.url, enabled: !b.enabled, media_url: b.media_url, media_type: b.media_type })
        .then(function () { toast(b.enabled ? 'Ad off.' : 'Ad on.'); return refreshAds(); })
        .catch(function () { toast('Could not update that ad.'); });
    } else if (t.dataset.adel) {
      if (!confirm('Delete this ad?')) return;
      DB.deleteAd(t.dataset.adel).then(refreshAds).catch(function () { toast('Could not delete.'); });
    }
  });
  $('#adForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var url = $('#aUrl').value.trim();
    if (!/^https?:\/\//i.test(url)) return setMsg('#adMsg', 'Ad link must start with http or https.');
    var mediaLink = $('#aMediaUrl').value.trim();
    if (mediaLink && !SB.safeImg(mediaLink)) return setMsg('#adMsg', 'Media link must start with http or https.');
    var file = $('#aMediaFile').files && $('#aMediaFile').files[0];
    setMsg('#adMsg', file ? 'Uploading media…' : 'Saving…');
    var mediaP = file ? DB.uploadImage(file) : Promise.resolve(mediaLink);
    mediaP.then(function (mediaUrl) {
      var mediaType = file && /^video\//.test(file.type) ? 'video' : (file ? 'image' : ($('#aMediaType').value || 'image'));
      if (!file && mediaUrl && /\.(mp4|webm)(\?|$)/i.test(mediaUrl)) mediaType = 'video';
      return DB.saveAd({ id: $('#aId').value || null, name: $('#aName').value.trim(), placement: $('#aPlace').value, title: $('#aTitle').value.trim(),
        body: $('#aBody').value.trim(), cta: $('#aCta').value.trim(), url: url, enabled: $('#aEnabled').checked,
        media_url: mediaUrl || '', media_type: mediaUrl ? mediaType : 'image' });
    }).then(function () { toast('Ad saved.'); clearAdForm(); return refreshAds(); })
      .catch(function (err) { setMsg('#adMsg', (err && err.message) ? err.message : 'Could not save the ad.'); });
  });

  $('#adsOn').addEventListener('change', function () {
    settings.adsOn = this.checked;
    DB.saveSettings({ adsOn: settings.adsOn }).then(function () { toast(settings.adsOn ? 'Ads on.' : 'Ads off.'); })
      .catch(function () { toast('Could not save ads toggle.'); });
  });
  function refreshAds() { return DB.listAds().then(function (list) { ads = list; renderAds(); }); }

  /* ---------- page/category and homepage text settings ---------- */
  function renderPageCategories(){var rows=CN.categoryRows(settings||{}),box=document.getElementById('pageCategoryList');if(!box)return;box.innerHTML=rows.map(function(x,i){return '<div class="row-item"><label class="toggle"><input type="checkbox" data-page-visible="'+i+'"'+(x.visible!==false?' checked':'')+'> Visible</label><span class="muted small">'+CN.esc(x.slug)+'</span><input class="field" data-page-name="'+i+'" value="'+CN.esc(x.name||x.slug)+'" aria-label="Display name"></div>';}).join('');}
  function savePageCategories(){var rows=CN.categoryRows(settings||{}),box=document.getElementById('pageCategoryList');Array.prototype.forEach.call(box.querySelectorAll('[data-page-visible]'),function(e){rows[Number(e.dataset.pageVisible)].visible=e.checked;});Array.prototype.forEach.call(box.querySelectorAll('[data-page-name]'),function(e){rows[Number(e.dataset.pageName)].name=e.value.trim()||rows[Number(e.dataset.pageName)].slug;});DB.saveSettings({categories:rows}).then(function(){settings.categories=rows;CN.applyCategorySettings(settings);fillCats();renderPageCategories();setMsg('#pageMsg','Saved.');}).catch(function(){setMsg('#pageMsg','Could not save category settings.');});}
  document.getElementById('pageCategoryList').addEventListener('change',function(e){if(e.target.matches('[data-page-visible]'))savePageCategories();});document.getElementById('pageCategoryList').addEventListener('blur',function(e){if(e.target.matches('[data-page-name]'))savePageCategories();},true);
  document.getElementById('pageCategoryForm').addEventListener('submit',function(e){e.preventDefault();var slug=$('#newCatSlug').value.trim().toLowerCase(),name=$('#newCatName').value.trim();if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)||!name||CN.categoryRows(settings).some(function(x){return x.slug===slug;})){setMsg('#pageMsg','Use a unique lowercase slug and name.');return;}var rows=CN.categoryRows(settings).concat([{slug:slug,name:name,visible:true}]);DB.saveSettings({categories:rows}).then(function(){settings.categories=rows;CN.applyCategorySettings(settings);fillCats();renderPageCategories();$('#newCatSlug').value='';$('#newCatName').value='';setMsg('#pageMsg','Added.');}).catch(function(){setMsg('#pageMsg','Could not add category.');});});
  function fillSiteText(){var d={heroTagline:'Notes from a radiography student, for health science students',heroHeadline:'Hard topics, explained in plain language.',heroDescription:'An educational and research blog breaking down anatomy, physiology, biochemistry and radiography in my own words, written by a student who is learning them right now.',substackBtnText:'Subscribe on Substack',substackBtnUrl:'https://substack.com/@vonanaxx',substackMiniText:'also on Substack',substackMiniUrl:'https://substack.com/@vonanaxx',heroButtonOne:'Read the posts',heroButtonTwo:'About this blog',aboutText:'Nobody told me what radiography would actually feel like before I got in. To be honest, the profession is so niche and radiographers are so rare that I knew nothing about them until I got admitted. Good decision or bad one? Time will tell.\n\nThis blog is just a space where I share my little thoughts on base courses like anatomy, physiology, biochemistry, and my major profession.\n\nI\'m a 200-level radiography student, and this blog is my notebook in public. I\'ll be writing about what I\'m learning, how I study for it, what clinicals are actually like, and the things nobody says out loud about being a health science student in a Nigerian university.\n\nI\'m not an expert. That\'s kind of the point. If you\'re a health science student too, you\'ll probably recognize a lot of this. And if you\'re not, maybe you\'ll see the profession a little differently.\n\nThree posts a week, more or less depending on how the week treats me. Exam weeks excused. Let\'s see how far this goes.'};['heroTagline','heroHeadline','heroDescription','heroButtonOne','heroButtonTwo','substackBtnText','substackBtnUrl','substackMiniText','substackMiniUrl','aboutText'].forEach(function(k){document.getElementById(k).value=(settings&&settings[k])||d[k];});document.getElementById('showAbout').checked=(settings&&settings.showAbout)==='off'?false:true;}
  document.getElementById('siteTextForm').addEventListener('submit',function(e){e.preventDefault();var patch={heroTagline:$('#heroTagline').value.trim(),heroHeadline:$('#heroHeadline').value.trim(),heroDescription:$('#heroDescription').value.trim(),heroButtonOne:$('#heroButtonOne').value.trim(),heroButtonTwo:$('#heroButtonTwo').value.trim(),substackBtnText:$('#substackBtnText').value.trim(),substackBtnUrl:$('#substackBtnUrl').value.trim(),substackMiniText:$('#substackMiniText').value.trim(),substackMiniUrl:$('#substackMiniUrl').value.trim(),aboutText:$('#aboutText').value.trim(),showAbout:document.getElementById('showAbout').checked?'on':'off'};DB.saveSettings(patch).then(function(){Object.assign(settings,patch);setMsg('#siteTextMsg','Saved.');}).catch(function(e){setMsg('#siteTextMsg','Could not save site text: '+((e&&e.message)||'unknown error')+'.');});});
  /* ---------- settings: logo, author photo, tagline, whatsapp ---------- */
  function showPreview(key, url) {
    var box = $('#' + key + 'Prev');
    if (!url || !SB.safeImg(url)) { box.hidden = true; return; }
    box.querySelector('img').src = url;
    box.hidden = false;
  }
  function fillSettings() {
    renderPageCategories(); fillSiteText();
    $('#sLogo').value = settings.logo || ''; $('#sAuthor').value = settings.authorImage || '';
    $('#sWa').value = settings.whatsapp || ''; $('#sTagline').value = settings.tagline || '';
    showPreview('sLogo', settings.logo); showPreview('sAuthor', settings.authorImage);
  }
  $('#settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var logo = $('#sLogo').value.trim(), author = $('#sAuthor').value.trim(), wa = $('#sWa').value.trim(), tag = $('#sTagline').value.trim();
    if ((logo && !SB.safeImg(logo)) || (author && !SB.safeImg(author))) return setMsg('#setMsg', 'Images must be http or https links.');
    if (wa && !/^https?:\/\//i.test(wa)) return setMsg('#setMsg', 'WhatsApp link must start with http or https.');
    setMsg('#setMsg', 'Saving…');
    var patch = { logo: logo, authorImage: author, whatsapp: wa, tagline: tag };
    DB.saveSettings(patch)
      .then(function () { settings = Object.assign(settings, patch); fillSettings(); setMsg('#setMsg', 'Saved.'); })
      .catch(function () { setMsg('#setMsg', 'Could not save settings.'); });
  });
  // Remove a logo or author photo: clears the field and saves straight away.
  $('#settingsForm').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (!b) return;
    var key = b.dataset.rm === 'logo' ? 'logo' : 'authorImage';
    var patch = {}; patch[key] = '';
    DB.saveSettings(patch).then(function () {
      settings = Object.assign(settings, patch); fillSettings();
      toast(key === 'logo' ? 'Logo removed.' : 'Author photo removed.');
    }).catch(function () { setMsg('#setMsg', 'Could not remove.'); });
  });

  /* ---------- account: change password (checks current password first) + sign out ---------- */
  // Supabase Auth only: no local credential store. Step 1 re-checks the current password with
  // signInWithPassword (using the signed-in account's email); step 2 sets the new one with updateUser.
  $('#accountForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var cur = $('#aCur').value, p1 = $('#aNewPass').value, p2 = $('#aNewPass2').value;
    if (p1.length < 8) return setMsg('#accMsg', 'New password must be at least 8 characters.');
    if (p1 !== p2) return setMsg('#accMsg', 'The two new passwords do not match.');
    if (!cur) return setMsg('#accMsg', 'Type your current password.');
    setMsg('#accMsg', 'Checking…');
    DB.auth.session().then(function (s) {
      var email = (s && s.user && s.user.email) || currentEmail;
      if (!email) throw new Error('You are not signed in. Log in again, then change the password.');
      return DB.auth.signIn(email, cur);
    }).then(function () {
      return DB.auth.updatePassword(p1);
    }).then(function () {
      ['#aCur', '#aNewPass', '#aNewPass2'].forEach(function (s) { $(s).value = ''; });
      setMsg('#accMsg', 'Password updated. Use it next time you log in.');
    }).catch(function (err) {
      var m = friendly(err);
      setMsg('#accMsg', /Wrong email or password/.test(m) ? 'Current password is wrong.' : m);
    });
  });

  /* ---------- load ---------- */
  var trWired = false;
  function refreshAll() {
    renderMode();
    return Promise.all([
      refreshPosts(), refreshComments(), refreshSubs(), refreshAds(),
      DB.getSettings().then(function (s) { settings = s; CN.applyCategorySettings(settings); fillCats(); fillSettings(); renderAds(); })
    ]).then(refreshDash).then(function () {
      if (!trWired) { trWired = true; wireTraffic(); } else { loadTraffic(); }
    });
  }

  /* ---------- image uploads (fill the link field; the Save button stores it) ---------- */
  // previewKey is the bare settings key (e.g. 'sLogo'); showPreview adds the '#' and 'Prev' itself.
  function wireUpload(fileId, urlId, msgId, previewKey) {
    $(fileId).addEventListener('change', function () {
      var input = this, file = input.files && input.files[0];
      if (!file) return;
      input.disabled = true;
      setMsg(msgId, 'Uploading…');
      DB.uploadImage(file).then(function (url) {
        $(urlId).value = url;
        if (previewKey) showPreview(previewKey, url);
        setMsg(msgId, 'Uploaded. Click Save to keep it.');
      }).catch(function (err) {
        setMsg(msgId, (err && err.message) || 'Upload failed. Paste an image link instead.');
      }).then(function () {
        input.value = '';
        input.disabled = false;
      });
    });
  }
  // Rich text editing keeps the selection in the editor while toolbar controls are used.
  var bodyEditor = $('#bodyEditor'), savedRange = null, editorHistoryTimer = null, editorHistory = [], editorHistoryIndex = -1;
  function editorSnapshot() { return bodyEditor.innerHTML; }
  function updateHistoryButtons() {
    $('#editorUndo').disabled = editorHistoryIndex <= 0;
    $('#editorRedo').disabled = editorHistoryIndex < 0 || editorHistoryIndex >= editorHistory.length - 1;
  }
  function recordEditorHistory() {
    var html = editorSnapshot();
    if (editorHistoryIndex >= 0 && editorHistory[editorHistoryIndex] === html) { updateHistoryButtons(); return; }
    editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
    editorHistory.push(html);
    if (editorHistory.length > 100) editorHistory.shift();
    editorHistoryIndex = editorHistory.length - 1;
    updateHistoryButtons();
  }
  function scheduleEditorHistory() {
    clearTimeout(editorHistoryTimer);
    editorHistoryTimer = setTimeout(recordEditorHistory, 450);
  }
  function resetEditorHistory() {
    clearTimeout(editorHistoryTimer);
    editorHistory = [editorSnapshot()]; editorHistoryIndex = 0; updateHistoryButtons();
  }
  function restoreEditorCaret() {
    var range = document.createRange(), sel = window.getSelection();
    range.selectNodeContents(bodyEditor); range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range); savedRange = range.cloneRange(); bodyEditor.focus();
  }
  function stepEditorHistory(direction) {
    clearTimeout(editorHistoryTimer);
    if (editorHistoryIndex >= 0 && editorSnapshot() !== editorHistory[editorHistoryIndex]) recordEditorHistory();
    if (direction < 0) {
      if (editorHistoryIndex <= 0) return;
      editorHistoryIndex -= 1;
    } else {
      if (editorHistoryIndex >= editorHistory.length - 1) return;
      editorHistoryIndex += 1;
    }
    bodyEditor.innerHTML = editorHistory[editorHistoryIndex];
    restoreEditorCaret(); updateEditorToolbar(); updateHistoryButtons();
  }
  function saveEditorRange() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && bodyEditor.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    updateEditorToolbar();
  }
  function restoreEditorRange() {
    bodyEditor.focus();
    if (savedRange) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  }
  function updateEditorToolbar() {
    var hasEditorSelection = !!(savedRange && bodyEditor.contains(savedRange.startContainer));
    document.querySelectorAll('[data-editor-command]').forEach(function (b) {
      var active = false;
      try { active = hasEditorSelection && document.queryCommandState(b.dataset.editorCommand); } catch (ignore) {}
      b.classList.toggle('is-active', !!active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-editor-block]').forEach(function (b) {
      var node = hasEditorSelection && savedRange.startContainer;
      if (node && node.nodeType === 3) node = node.parentNode;
      var active = false;
      while (node && bodyEditor.contains(node)) {
        if (node.tagName && node.tagName.toLowerCase() === b.dataset.editorBlock.toLowerCase()) { active = true; break; }
        node = node.parentNode;
      }
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  function runEditorCommand(command, value) {
    restoreEditorRange();
    try { document.execCommand('styleWithCSS', false, true); } catch (ignore) {}
    try { document.execCommand(command, false, value || null); } catch (ignore2) { toast('That formatting action is not supported in this browser.'); }
    saveEditorRange();
    scheduleEditorHistory();
  }
  bodyEditor.addEventListener('keyup', saveEditorRange);
  bodyEditor.addEventListener('mouseup', saveEditorRange);
  bodyEditor.addEventListener('input', function () { saveEditorRange(); scheduleEditorHistory(); });
  bodyEditor.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) { e.preventDefault(); stepEditorHistory(-1); }
    else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); stepEditorHistory(1); }
  });
  document.addEventListener('selectionchange', function () {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && bodyEditor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
      updateEditorToolbar();
    } else if (!bodyEditor.contains(document.activeElement)) {
      savedRange = null;
      updateEditorToolbar();
    }
  });
    document.querySelectorAll('[data-editor-command]').forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { runEditorCommand(b.dataset.editorCommand); });
    });
  document.querySelectorAll('[data-editor-block]').forEach(function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () { runEditorCommand('formatBlock', '<' + b.dataset.editorBlock + '>'); });
  });
  $('#editorSize').addEventListener('mousedown', saveEditorRange);
  $('#editorSize').addEventListener('change', function () {
    var size = this.value, sel, range, span, fragment;
    if (!size) return;
    restoreEditorRange();
    sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    range = sel.getRangeAt(0);
    if (!bodyEditor.contains(range.commonAncestorContainer)) return;
    if (range.collapsed) {
      span = document.createElement('span');
      span.style.fontSize = size === 'large' ? '1.25em' : (size === 'small' ? '0.875em' : '1em');
      span.appendChild(document.createTextNode('\u200b'));
      range.insertNode(span);
      range.setStart(span.firstChild, 1);
      range.collapse(true);
    } else {
      fragment = range.extractContents();
      span = document.createElement('span');
      span.style.fontSize = size === 'large' ? '1.25em' : (size === 'small' ? '0.875em' : '1em');
      span.appendChild(fragment);
      range.insertNode(span);
      range.selectNodeContents(span);
      range.collapse(false);
    }
    sel.removeAllRanges(); sel.addRange(range); savedRange = range.cloneRange();
    this.value = '';
    saveEditorRange(); scheduleEditorHistory();
  });
  document.querySelectorAll('[data-editor-color]').forEach(function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () { runEditorCommand('foreColor', b.dataset.editorColor); });
  });
  $('#editorColor').addEventListener('mousedown', saveEditorRange);
  $('#editorColor').addEventListener('input', function () { runEditorCommand('foreColor', this.value); });
  $('#editorUndo').addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('#editorUndo').addEventListener('click', function () { stepEditorHistory(-1); });
  $('#editorRedo').addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('#editorRedo').addEventListener('click', function () { stepEditorHistory(1); });
  $('#insertLinkBtn').addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('#insertLinkBtn').addEventListener('click', function () {
    restoreEditorRange();
    var url = prompt('Enter a link URL (http or https):');
    if (!url) return;
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) { toast('Link must start with http or https.'); return; }
    var sel = window.getSelection(), range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range && !range.collapsed) {
      try { document.execCommand('createLink', false, url); }
      catch (ignore) { toast('Could not insert the link in this browser.'); return; }
    } else {
      var label = prompt('Link text:');
      if (!label) return;
      var link = document.createElement('a'); link.href = url; link.textContent = label;
      if (range) { range.insertNode(link); range.setStartAfter(link); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); }
      else bodyEditor.appendChild(link);
    }
    saveEditorRange(); scheduleEditorHistory();
  });
  $('#insertWidgetBtn').addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('#insertWidgetBtn').addEventListener('click', function () {
    restoreEditorRange();
    var code = prompt('Paste the widget code here (full HTML/JS), or an https link to a widget page.\n\nTip: long pasted code can be slow on mobile, but it works.');
    if (!code) return;
    code = code.trim();
    if (!code) return;
    var box = document.createElement('div');
    box.className = 'post-widget';
    if (/^https?:\/\/\S+$/i.test(code)) {
      box.setAttribute('data-widget-url', code);
    } else {
      try { box.setAttribute('data-widget', btoa(unescape(encodeURIComponent(code)))); }
      catch (err) { toast('That widget code could not be encoded. Try an https link to the widget page instead.'); return; }
    }
    var sel = window.getSelection(), range = savedRange;
    if (range) { range.deleteContents(); range.insertNode(box); range.setStartAfter(box); range.collapse(true); savedRange = range; }
    else { bodyEditor.appendChild(box); savedRange = document.createRange(); savedRange.selectNodeContents(bodyEditor); savedRange.collapse(false); }
    sel.removeAllRanges(); sel.addRange(savedRange);
    saveEditorRange(); scheduleEditorHistory();
    toast('Widget added. It will appear when the post is viewed.');
  });
  $('#insertImageBtn').addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('#insertImageBtn').addEventListener('click', function () {
    saveEditorRange();
    if (DB.mode !== 'supabase') { toast('Image upload needs a connection to Supabase. Reconnect, then try again.'); return; }
    $('#bodyImageFiles').click();
  });
  $('#bodyImageFiles').addEventListener('change', function () {
    var input = this, files = Array.prototype.slice.call(input.files || []), done = Promise.resolve();
    if (!files.length) return;
    if (DB.mode !== 'supabase') { toast('Image upload needs a connection to Supabase. Reconnect, then try again.'); input.value = ''; return; }
    input.disabled = true;
    setMsg('#bodyUploadMsg', 'Uploading image(s)…');
    files.forEach(function (file) {
      done = done.then(function () {
        return DB.uploadImage(file).then(function (url) {
          restoreEditorRange();
          var img = document.createElement('img');
          img.src = url; img.alt = file.name || ''; img.loading = 'lazy'; img.style.maxWidth = '100%'; img.style.height = 'auto';
          var sel = window.getSelection(), range = savedRange;
          if (range) {
            range.deleteContents(); range.insertNode(img); range.setStartAfter(img); range.collapse(true);
            savedRange = range;
          } else {
          bodyEditor.appendChild(img); savedRange = document.createRange();
          savedRange.selectNodeContents(bodyEditor); savedRange.collapse(false);
        }
        sel.removeAllRanges(); sel.addRange(savedRange);
        saveEditorRange(); scheduleEditorHistory();
        });
      });
    });
    done.then(function () { setMsg('#bodyUploadMsg', 'Uploaded. Save the post to keep it.'); })
      .catch(function (err) { setMsg('#bodyUploadMsg', 'Image upload failed: ' + ((err && err.message) || 'check your Supabase connection') + '.'); toast('Image upload failed. Check your Supabase connection.'); })
      .then(function () { input.value = ''; input.disabled = false; });
  });
  wireUpload('#pCoverFile', '#pCover', '#pCoverMsg');
  wireUpload('#sLogoFile', '#sLogo', '#sLogoMsg', 'sLogo');
  wireUpload('#sAuthorFile', '#sAuthor', '#sAuthorMsg', 'sAuthor');
  $('#sLogo').addEventListener('input', function () { showPreview('sLogo', this.value.trim()); });
  $('#sAuthor').addEventListener('input', function () { showPreview('sAuthor', this.value.trim()); });

  fillCats();
  DB.init().then(function () {
    renderMode();
    if (DB.mode !== 'supabase') return showGate(DB.reason === 'setup' ? 'setup' : 'offline');
    DB.auth.onChange(function (event) {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; showPanel('#resetForm'); }
    });
    // A recovery link lands with access_token/type=recovery in the hash. The
    // PASSWORD_RECOVERY event can fire before this listener exists, so also
    // detect the link itself and show the reset form either way.
    if (!recovering && /access_token=|type=recovery/.test(location.hash)) { recovering = true; showPanel('#resetForm'); return; }
    return DB.auth.session().then(function (s) { if (!recovering) return route(s); });
  }).catch(function () { showGate('offline'); });
})();

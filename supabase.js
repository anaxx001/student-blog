/* Campus Notes v3 data layer.
   One API (window.DB) for every page. It talks to Supabase when the tables exist and are reachable,
   and falls back to this browser's localStorage copy (data.js, window.SB) when they are not.
   DB.mode is 'supabase' or 'local'; DB.reason says why (ok | setup | offline). */
(function () {
  var SB_URL = 'https://adcaogagdljbbxdsihip.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkY2FvZ2FnZGxqYmJ4ZHNpaGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MzgxMjgsImV4cCI6MjEwNzUxNDEyOH0.vo5wQBqj-fDhqh9GE94F40_QyWHoOC-I4pM5NMbeuuI';
  var VID_KEY = 'campusnotes_visitor_v3';
  var LOCAL_REACT_KEY = 'campusnotes_local_reactions_v3';
  var LOCAL_SUBS_KEY = 'campusnotes_local_subs_v3';
  var TIMEOUT_MS = 6000;

  var client = null;
  var ready = null;
  var DB = { mode: 'local', reason: 'offline' };

  function store() { return window.SB; }
  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, TIMEOUT_MS); })]);
  }

  /* ---------- connection ---------- */
  DB.init = function () {
    if (ready) return ready;
    ready = new Promise(function (resolve) {
      if (!window.supabase || !window.supabase.createClient) { DB.mode = 'local'; DB.reason = 'offline'; return resolve(DB); }
      try { client = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
      catch (e) { DB.mode = 'local'; DB.reason = 'offline'; return resolve(DB); }
      withTimeout(client.from('posts').select('id').limit(1)).then(function (r) {
        if (r && r.error) {
          DB.mode = 'local';
          // PGRST205 = table missing; treat any other error as unreachable/misconfigured
          DB.reason = (r.error.code === 'PGRST205' || /schema cache|does not exist|relation/i.test(r.error.message || '')) ? 'setup' : 'offline';
        } else { DB.mode = 'supabase'; DB.reason = 'ok'; }
        resolve(DB);
      }).catch(function () { DB.mode = 'local'; DB.reason = 'offline'; resolve(DB); });
    });
    return ready;
  };
  function live() { return DB.mode === 'supabase'; }

  /* ---------- helpers ---------- */
  function visitorId() {
    var v = null;
    try { v = localStorage.getItem(VID_KEY); } catch (e) {}
    if (!v) {
      v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      try { localStorage.setItem(VID_KEY, v); } catch (e) {}
    }
    return v;
  }
  DB.visitorId = visitorId;
  function slugify(t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
  }
  DB.slugify = slugify;
  function dayOf(iso) { return String(iso || '').slice(0, 10); }
  function localPubDate(p) { return p.date || ''; }

  // Normalises a Supabase row into the shape every page uses.
  function fromRow(r) {
    return {
      id: String(r.id), slug: r.slug, title: r.title || '', category: r.category || 'anatomy',
      author: r.author || '', excerpt: r.excerpt || '', body: r.body || '', cover: r.cover_url || '',
      readTime: r.read_time || 4, status: r.status, date: dayOf(r.published_at || r.created_at),
      publishedAt: r.published_at || '', views: r.views || 0
    };
  }
  // Normalises a local (data.js) post.
  function fromLocal(p, views) {
    return {
      id: String(p.id), slug: p.slug || slugify(p.title) + '-' + String(p.id).slice(-5), title: p.title || '',
      category: p.category || 'anatomy', author: p.author || '', excerpt: p.excerpt || '', body: p.body || '',
      cover: p.cover || '', readTime: p.readTime || 4, status: p.status, date: p.date || '',
      publishedAt: p.date || '', views: views || 0
    };
  }
  function localPosts() {
    var s = store().get();
    s.postViews = s.postViews || {};
    return s.posts.map(function (p) { return fromLocal(p, s.postViews[p.id] || 0); });
  }
  function sortNewest(list) {
    return list.sort(function (a, b) { return String(b.publishedAt || b.date).localeCompare(String(a.publishedAt || a.date)); });
  }
  // Admin (DB.strict) never falls back to the local copy: a failed call throws so the page shows an error.
  function fail(err) {
    console.warn('[campus notes] supabase call failed:', err && (err.message || err));
    if (DB.strict) throw (err instanceof Error ? err : new Error(String((err && err.message) || 'supabase call failed')));
    return null;
  }

  /* ---------- posts ---------- */
  // opts: { all: true } returns drafts too (admin); category; limit
  DB.listPosts = function (opts) {
    opts = opts || {};
    return DB.init().then(function () {
      if (live()) {
        var q = client.from('posts').select('*');
        if (!opts.all) q = q.eq('status', 'published');
        if (opts.category) q = q.eq('category', opts.category);
        q = q.order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
        if (opts.limit) q = q.limit(opts.limit);
        return withTimeout(q).then(function (r) {
          if (r.error) { fail(r.error); return DB.listPostsLocal(opts); }
          return r.data.map(fromRow);
        }).catch(function (e) { fail(e); return DB.listPostsLocal(opts); });
      }
      return DB.listPostsLocal(opts);
    });
  };
  DB.listPostsLocal = function (opts) {
    opts = opts || {};
    var list = localPosts().filter(function (p) {
      if (!opts.all && (p.status !== 'published' || !p.title || !p.body)) return false;
      if (opts.category && p.category !== opts.category) return false;
      return true;
    });
    list = sortNewest(list);
    return opts.limit ? list.slice(0, opts.limit) : list;
  };

  DB.getPost = function (slug, opts) {
    opts = opts || {};
    return DB.init().then(function () {
      if (live()) {
        var q = client.from('posts').select('*').eq('slug', slug);
        if (!opts.all) q = q.eq('status', 'published');
        return withTimeout(q.maybeSingle()).then(function (r) {
          if (r.error) { fail(r.error); return DB.getPostLocal(slug, opts); }
          return r.data ? fromRow(r.data) : null;
        }).catch(function (e) { fail(e); return DB.getPostLocal(slug, opts); });
      }
      return DB.getPostLocal(slug, opts);
    });
  };
  DB.getPostLocal = function (slug, opts) {
    var p = localPosts().find(function (x) { return x.slug === slug && (opts && opts.all || x.status === 'published'); });
    return p || null;
  };

  // Counts one view for a published post (server side function in setup.sql).
  DB.bumpView = function (post) {
    if (!post) return;
    if (live()) {
      withTimeout(client.rpc('bump_view', { p_slug: post.slug })).catch(function (e) { fail(e); });
    }
    // local copy also counts it, so the admin dashboard still moves in local mode
    try { store().trackPost(post.id); } catch (e) {}
  };

  DB.savePost = function (p) {
    return DB.init().then(function () {
      var status = p.status === 'published' ? 'published' : 'draft';
      if (live()) {
        var row = {
          slug: p.slug || slugify(p.title), title: p.title, category: p.category, author: p.author,
          excerpt: p.excerpt || '', body: p.body || '', cover_url: p.cover || '', read_time: p.readTime || 4,
          status: status
        };
        var pubAt = status === 'published' ? (p.publishedAt || new Date().toISOString()) : null;
        row.published_at = pubAt;
        var q = p.id ? client.from('posts').update(row).eq('id', p.id)
                     : client.from('posts').insert(row);
        return withTimeout(q.select('*').single()).then(function (r) {
          if (r.error) throw r.error;
          return fromRow(r.data);
        });
      }
      var s = store().get();
      var today = store().today();
      if (p.id) {
        var ex = s.posts.find(function (x) { return String(x.id) === String(p.id); });
        if (!ex) throw new Error('post not found');
        Object.assign(ex, { title: p.title, category: p.category, author: p.author, excerpt: p.excerpt, body: p.body,
          readTime: p.readTime, status: status, cover: p.cover || '' });
        store().save(s);
        return fromLocal(ex, s.postViews[ex.id] || 0);
      }
      var np = { id: store().uid('p'), title: p.title, category: p.category, author: p.author, excerpt: p.excerpt,
        body: p.body, readTime: p.readTime, status: status, cover: p.cover || '', date: today };
      s.posts.push(np); s.postViews[np.id] = 0; store().save(s);
      return fromLocal(np, 0);
    });
  };

  DB.deletePost = function (id) {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('posts').delete().eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      }
      var s = store().get();
      s.posts = s.posts.filter(function (x) { return String(x.id) !== String(id); });
      s.comments = s.comments.filter(function (c) { return String(c.postId) !== String(id); });
      delete s.postViews[id];
      store().save(s);
    });
  };

  DB.setPostStatus = function (id, status) {
    return DB.init().then(function () {
      if (live()) {
        var row = { status: status, published_at: status === 'published' ? new Date().toISOString() : null };
        return withTimeout(client.from('posts').update(row).eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      }
      var s = store().get();
      var p = s.posts.find(function (x) { return String(x.id) === String(id); });
      if (p) { p.status = status; store().save(s); }
    });
  };

  /* ---------- comments ---------- */
  function commentFromRow(r, postTitle) {
    var status = r.spam ? 'spam' : (r.approved ? 'approved' : 'pending');
    return { id: String(r.id), postId: String(r.post_id), name: r.name, text: r.body,
      approved: !!r.approved, spam: !!r.spam, status: status, date: dayOf(r.created_at), postTitle: postTitle || '' };
  }
  DB.listComments = function (postId) {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('comments').select('*').eq('post_id', postId).eq('approved', true).order('created_at', { ascending: true }))
          .then(function (r) { if (r.error) throw r.error; return r.data.map(function (x) { return commentFromRow(x); }); })
          .catch(function (e) { fail(e); return []; });
      }
      return store().get().comments.filter(function (c) { return String(c.postId) === String(postId) && c.status === 'approved'; })
        .map(function (c) { return { id: String(c.id), postId: String(c.postId), name: c.name, text: c.text, approved: true, date: c.date }; });
    });
  };
  // Admin list: all comments with the post title. filter: 'pending' | 'approved' | 'all'
  DB.listAllComments = function (filter) {
    return DB.init().then(function () {
      if (live()) {
        var q = client.from('comments').select('*, posts(title)').order('created_at', { ascending: false });
        if (filter === 'pending') q = q.eq('approved', false).eq('spam', false);
        if (filter === 'approved') q = q.eq('approved', true);
        if (filter === 'spam') q = q.eq('spam', true);
        return withTimeout(q).then(function (r) {
          if (r.error) throw r.error;
          return r.data.map(function (x) { return commentFromRow(x, x.posts && x.posts.title); });
        });
      }
      var s = store().get();
      var posts = {};
      s.posts.forEach(function (p) { posts[String(p.id)] = p.title; });
      return s.comments.filter(function (c) { return filter === 'all' || c.status === filter; })
        .map(function (c) { return { id: String(c.id), postId: String(c.postId), name: c.name, text: c.text,
          approved: c.status === 'approved', date: c.date, postTitle: posts[String(c.postId)] || 'deleted post', status: c.status }; });
    });
  };
  DB.addComment = function (postId, name, text) {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('comments').insert({ post_id: postId, name: name, body: text, approved: false }))
          .then(function (r) { if (r.error) throw r.error; });
      }
      store().addComment({ postId: postId, name: name, text: text });
    });
  };
  DB.setCommentApproved = function (id, approved) {
    return DB.init().then(function () {
      if (live()) return withTimeout(client.from('comments').update({ approved: approved, spam: false }).eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      var s = store().get();
      var c = s.comments.find(function (x) { return String(x.id) === String(id); });
      if (c) { c.status = approved ? 'approved' : 'pending'; store().save(s); }
    });
  };
  DB.setCommentSpam = function (id) {
    return DB.init().then(function () {
      if (live()) return withTimeout(client.from('comments').update({ approved: false, spam: true }).eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      var s = store().get();
      var c = s.comments.find(function (x) { return String(x.id) === String(id); });
      if (c) { c.status = 'spam'; store().save(s); }
    });
  };
  DB.deleteComment = function (id) {
    return DB.init().then(function () {
      if (live()) return withTimeout(client.from('comments').delete().eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      var s = store().get();
      s.comments = s.comments.filter(function (x) { return String(x.id) !== String(id); });
      store().save(s);
    });
  };

  /* ---------- reactions (one per visitor per type) ---------- */
  var TYPES = ['like', 'insight', 'save'];
  function localReactions() {
    try { return JSON.parse(localStorage.getItem(LOCAL_REACT_KEY) || '{}'); } catch (e) { return {}; }
  }
  // returns { like: n, insight: n, save: n, mine: { like: bool, ... } }
  DB.getReactions = function (postId) {
    var vid = visitorId();
    return DB.init().then(function () {
      var out = { like: 0, insight: 0, save: 0, mine: { like: false, insight: false, save: false } };
      if (live()) {
        return withTimeout(client.from('reactions').select('emoji_type,visitor_id').eq('post_id', postId))
          .then(function (r) {
            if (r.error) throw r.error;
            r.data.forEach(function (x) {
              if (out[x.emoji_type] !== undefined) out[x.emoji_type]++;
              if (x.visitor_id === vid) out.mine[x.emoji_type] = true;
            });
            return out;
          }).catch(function (e) { fail(e); return out; });
      }
      var all = localReactions()[postId] || {};
      TYPES.forEach(function (t) {
        var arr = all[t] || [];
        out[t] = arr.length; out.mine[t] = arr.indexOf(vid) !== -1;
      });
      return out;
    });
  };
  DB.toggleReaction = function (postId, type) {
    var vid = visitorId();
    if (TYPES.indexOf(type) === -1) return Promise.resolve(null);
    return DB.getReactions(postId).then(function (now) {
      var had = now.mine[type];
      return DB.init().then(function () {
        if (live()) {
          var q = had
            ? client.from('reactions').delete().eq('post_id', postId).eq('emoji_type', type).eq('visitor_id', vid)
            : client.from('reactions').insert({ post_id: postId, emoji_type: type, visitor_id: vid });
          return withTimeout(q).then(function (r) { if (r.error && !had && r.error.code !== '23505') throw r.error; });
        }
        var all = localReactions();
        all[postId] = all[postId] || {};
        var arr = all[postId][type] || [];
        if (had) arr = arr.filter(function (v) { return v !== vid; }); else if (arr.indexOf(vid) === -1) arr.push(vid);
        all[postId][type] = arr;
        localStorage.setItem(LOCAL_REACT_KEY, JSON.stringify(all));
      });
    }).then(function () { return DB.getReactions(postId); });
  };

  /* ---------- subscribers ---------- */
  DB.subscribe = function (email) {
    email = String(email || '').trim().toLowerCase();
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('subscribers').insert({ email: email })).then(function (r) {
          // 23505 = already subscribed, treated as success
          if (r.error && r.error.code !== '23505') throw r.error;
          return 'ok';
        });
      }
      var subs = []; try { subs = JSON.parse(localStorage.getItem(LOCAL_SUBS_KEY) || '[]'); } catch (e) {}
      if (subs.indexOf(email) === -1) subs.push(email);
      localStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(subs));
      return 'ok';
    });
  };
  DB.subscriberCount = function () {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.rpc('subscriber_count')).then(function (r) { if (r.error) throw r.error; return r.data || 0; })
          .catch(function (e) { fail(e); return 0; });
      }
      try { return JSON.parse(localStorage.getItem(LOCAL_SUBS_KEY) || '[]').length; } catch (e) { return 0; }
    });
  };

  // Admin only: full subscriber rows (id + email + date), newest first.
  DB.listSubscribers = function () {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('subscribers').select('id,email,created_at').order('created_at', { ascending: false }))
          .then(function (r) { if (r.error) throw r.error; return r.data.map(function (x) { return { id: String(x.id), email: x.email, date: dayOf(x.created_at) }; }); });
      }
      var subs = []; try { subs = JSON.parse(localStorage.getItem(LOCAL_SUBS_KEY) || '[]'); } catch (e) {}
      return subs.map(function (e) { return { id: e, email: e, date: '' }; });
    });
  };
  DB.deleteSubscriber = function (id) {
    return DB.init().then(function () {
      if (live()) return withTimeout(client.from('subscribers').delete().eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      var subs = []; try { subs = JSON.parse(localStorage.getItem(LOCAL_SUBS_KEY) || '[]'); } catch (e) {}
      localStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(subs.filter(function (e) { return e !== id; })));
    });
  };

  /* ---------- site settings (logo, author photo, whatsapp, tagline, ads toggle) ---------- */
  function defaultSettings() { return { adsOn: false, whatsapp: '', logo: '', authorImage: '', tagline: '' }; }
  DB.getSettings = function () {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('settings').select('value').eq('key', 'site').maybeSingle())
          .then(function (r) { if (r.error) throw r.error; return Object.assign(defaultSettings(), (r.data && r.data.value) || {}); })
          .catch(function (e) { fail(e); return defaultSettings(); });
      }
      return Object.assign(defaultSettings(), store().get().settings || {});
    });
  };
  // Merges into the stored site row so a partial save (e.g. the ads toggle) never wipes logo, author photo or whatsapp.
  DB.saveSettings = function (obj) {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('settings').select('value').eq('key', 'site').maybeSingle()).then(function (r) {
          if (r.error) throw r.error;
          var merged = Object.assign(defaultSettings(), (r.data && r.data.value) || {}, obj);
          return withTimeout(client.from('settings').upsert({ key: 'site', value: merged }));
        }).then(function (r) { if (r.error) throw r.error; });
      }
      var s = store().get();
      s.settings = Object.assign({}, s.settings, obj);
      store().save(s);
    });
  };

  /* ---------- ads ---------- */
  function adFromRow(r) {
    return { id: String(r.id), name: r.name, placement: r.placement, title: r.title, body: r.body || '', cta: r.cta || 'Learn more',
      url: r.url, enabled: !!r.enabled, impressions: r.impressions || 0, clicks: r.clicks || 0,
      media_url: r.media_url || '', media_type: r.media_type === 'video' ? 'video' : 'image' };
  }
  DB.listAds = function () {
    return DB.init().then(function () {
      if (live()) {
        return withTimeout(client.from('ads').select('*').order('created_at', { ascending: true }))
          .then(function (r) { if (r.error) throw r.error; return r.data.map(adFromRow); })
          .catch(function (e) { fail(e); return []; });
      }
      return (store().get().ads || []).map(function (a) { return Object.assign({}, a, { id: String(a.id) }); });
    });
  };
  DB.saveAd = function (a) {
    return DB.init().then(function () {
      var row = { name: a.name, placement: a.placement, title: a.title, body: a.body || '', cta: a.cta || 'Learn more', url: a.url, enabled: !!a.enabled,
        media_url: a.media_url || '', media_type: a.media_type === 'video' ? 'video' : 'image' };
      if (live()) {
        var q = a.id ? client.from('ads').update(row).eq('id', a.id) : client.from('ads').insert(row);
        return withTimeout(q).then(function (r) { if (r.error) throw r.error; });
      }
      var s = store().get();
      if (a.id) {
        var ex = s.ads.find(function (x) { return String(x.id) === String(a.id); });
        if (ex) Object.assign(ex, row);
      } else {
        s.ads.push(Object.assign({ id: store().uid('a'), impressions: 0, clicks: 0 }, row));
      }
      store().save(s);
    });
  };
  DB.deleteAd = function (id) {
    return DB.init().then(function () {
      if (live()) return withTimeout(client.from('ads').delete().eq('id', id)).then(function (r) { if (r.error) throw r.error; });
      var s = store().get();
      s.ads = s.ads.filter(function (x) { return String(x.id) !== String(id); });
      store().save(s);
    });
  };
  // kind: 'impression' | 'click'
  DB.bumpAd = function (id, kind) {
    return DB.init().then(function () {
      if (live()) return withTimeout(client.rpc('bump_ad', { p_id: id, p_kind: kind })).then(function () {}).catch(function (e) { fail(e); });
      var s = store().get();
      var a = s.ads.find(function (x) { return String(x.id) === String(id); });
      if (a) { if (kind === 'click') a.clicks = (a.clicks || 0) + 1; else a.impressions = (a.impressions || 0) + 1; store().save(s); }
    });
  };

  /* ---------- uploads (Supabase Storage, public bucket 'media') ----------
     DB.uploadImage(file) resolves with the public https URL of the stored image.
     It rejects with a short message the admin can show inline when the file is bad, the backend is not
     connected, the bucket is missing, or the storage policies block the write. Pasting a link always still works. */
  var MEDIA_BUCKET = 'media';
  var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  var MAX_VIDEO_BYTES = 15 * 1024 * 1024;
  var UPLOAD_TIMEOUT_MS = 30000;
  var EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };

  function uniqueName(file) {
    var fromName = ((file.name || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1];
    var ext = (fromName || EXT_BY_TYPE[file.type] || 'img').toLowerCase();
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
    return id + '.' + ext;
  }

  function uploadError(err) {
    var msg = String((err && (err.message || err.error)) || '');
    var status = String((err && (err.statusCode || err.status)) || '');
    if (/bucket not found/i.test(msg) || status === '404') {
      return new Error("bucket 'media' missing. Create it in the supabase dashboard (public bucket named media), then try again.");
    }
    if (/row-level security|not allowed|unauthori[sz]ed|permission|policy|forbidden/i.test(msg) || status === '401' || status === '403') {
      return new Error("bucket 'media' blocks uploads. Run setup.sql again to add the storage policies.");
    }
    if (/too large|payload|exceeded/i.test(msg) || status === '413') {
      return new Error('Image is over 5MB. Compress it or paste a link.');
    }
    return new Error('Upload failed (' + (msg || 'unknown error') + '). Paste an image link instead.');
  }

  DB.uploadImage = function (file) {
    return DB.init().then(function () {
      if (!file) throw new Error('Choose an image first.');
      if (!/^(image\/|video\/(mp4|webm)$)/.test(file.type || '')) throw new Error('That is not an image or video. Pick a jpg, png, webp, gif, mp4 or webm.');
      var isVideo = /^video\//.test(file.type || '');
      if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_UPLOAD_BYTES)) throw new Error(isVideo ? 'Video is over 15MB. Compress it or paste a link.' : 'Image is over 5MB. Compress it or paste a link.');
      if (!live()) throw new Error('Uploads need the Supabase backend, which is not connected right now. Paste an image link instead.');
      var path = uniqueName(file);
      var up = client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      var guarded = Promise.race([up, new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error('timeout')); }, UPLOAD_TIMEOUT_MS);
      })]);
      return guarded.then(function (r) {
        if (r.error) throw uploadError(r.error);
        var pub = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
        var url = pub && pub.data && pub.data.publicUrl;
        if (!url) throw new Error('Upload worked but no public link came back. Paste an image link instead.');
        return url;
      }, function (e) { throw uploadError(e); });
    });
  };

  /* ---------- auth (Supabase Auth, email + password) ----------
     The admin signs in with a real account. Row level security checks is_admin() on the server,
     so only the claimed owner account can read or change admin data. */
  function authCall(p) {
    return withTimeout(p).then(function (r) { if (r && r.error) throw r.error; return r; });
  }
  DB.auth = {
    signIn: function (email, password) {
      return DB.init().then(function () {
        return authCall(client.auth.signInWithPassword({ email: email, password: password })).then(function (r) { return r.data.session; });
      });
    },
    signUp: function (email, password) {
      return DB.init().then(function () {
        return authCall(client.auth.signUp({ email: email, password: password })).then(function (r) {
          if (r.data && r.data.user && Array.isArray(r.data.user.identities) && r.data.user.identities.length === 0) {
            throw new Error('User already registered');
          }
          return r.data.session;
        });
      });
    },
    resetPassword: function (email) {
      return DB.init().then(function () {
        return authCall(client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
      });
    },
    updatePassword: function (password) {
      return DB.init().then(function () { return authCall(client.auth.updateUser({ password: password })); });
    },
    session: function () {
      return DB.init().then(function () { return withTimeout(client.auth.getSession()).then(function (r) { return r.data.session; }); });
    },
    signOut: function () {
      return DB.init().then(function () { return withTimeout(client.auth.signOut()).catch(function () {}); });
    },
    onChange: function (cb) {
      if (!client) return;
      client.auth.onAuthStateChange(function (event, session) { cb(event, session); });
    },
    // true only while no owner has claimed admin yet
    setupOpen: function () {
      return DB.init().then(function () { return authCall(client.rpc('setup_open')).then(function (r) { return !!r.data; }); });
    },
    isAdmin: function () {
      return DB.init().then(function () { return authCall(client.rpc('is_admin')).then(function (r) { return !!r.data; }); });
    },
    // first signed-in account to call this becomes the admin; later calls do nothing
    claimAdmin: function () {
      return DB.init().then(function () { return authCall(client.rpc('claim_admin')).then(function (r) { return !!r.data; }); });
    }
  };

  window.DB = DB;
})();

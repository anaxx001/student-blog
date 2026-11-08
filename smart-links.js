// Anaxx Science Hub - Smart Link Recognition System (ES5)
(function () {
  var ICONS = {
    video: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.9 4.8 12 4.8 12 4.8s-5.9 0-7.6.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8zM10 15.2V8.8L15.5 12z"/></svg>',
    profile: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12zm0 2.2c-3 0-9 1.5-9 4.5V21h18v-2.3c0-3-6-4.5-9-4.5z"/></svg>',
    post: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 4h16v13H8l-4 4z"/></svg>',
    academic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3 1 9l4 2.1v6L12 21l7-3.9v-6l4-2.1zM6 11.2 3.9 10 12 5.6 20.1 10 12 14.4 8.1 12.3V16H6z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 2h9l5 5v15H6zm9 1.5V8h4.5zM8 12h8v1.5H8zm0 3.5h8V17H8z"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8zm9-6h-4v1.9h4a3.1 3.1 0 1 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z"/></svg>'
  };
  function isYT(u, h) { return (h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be') && (/\/watch/.test(u.pathname) || h === 'youtu.be' || /\/shorts\//.test(u.pathname)); }
  var RULES = [
    { test: isYT, cat: 'video', label: 'YouTube', action: 'Watch on YouTube', fetchTitle: true },
    { test: function (u, h) { return h === 'vimeo.com' && /^\/\d+/.test(u.pathname); }, cat: 'video', label: 'Vimeo', action: 'Watch on Vimeo' },
    { test: function (u, h) { return h === 'tiktok.com' && /\/video\//.test(u.pathname); }, cat: 'video', label: 'TikTok', action: 'Watch on TikTok' },
    { test: function (u, h) { return h === 'instagram.com' && /^\/(p|reel|tv)\//.test(u.pathname); }, cat: 'post', label: 'Instagram', action: 'View Instagram post' },
    { test: function (u, h) { return h === 'instagram.com' && u.pathname.length > 1; }, cat: 'profile', label: 'Instagram', action: 'View Instagram profile', handle: true },
    { test: function (u, h) { return (h === 'twitter.com' || h === 'x.com') && /\/status\//.test(u.pathname); }, cat: 'post', label: 'X (Twitter)', action: 'View post on X' },
    { test: function (u, h) { return (h === 'twitter.com' || h === 'x.com') && u.pathname.length > 1; }, cat: 'profile', label: 'X (Twitter)', action: 'View X profile', handle: true },
    { test: function (u, h) { return h === 'facebook.com' && /\/posts\/|\/permalink\//.test(u.pathname); }, cat: 'post', label: 'Facebook', action: 'View Facebook post' },
    { test: function (u, h) { return h === 'facebook.com' && u.pathname.length > 1; }, cat: 'profile', label: 'Facebook', action: 'View Facebook profile' },
    { test: function (u, h) { return h === 'linkedin.com' && /\/posts\//.test(u.pathname); }, cat: 'post', label: 'LinkedIn', action: 'View LinkedIn post' },
    { test: function (u, h) { return h === 'linkedin.com' && /\/in\//.test(u.pathname); }, cat: 'profile', label: 'LinkedIn', action: 'View LinkedIn profile' },
    { test: function (u, h) { return h === 'pubmed.ncbi.nlm.nih.gov'; }, cat: 'academic', label: 'PubMed', action: 'View research paper' },
    { test: function (u, h) { return h === 'doi.org'; }, cat: 'academic', label: 'Research paper', action: 'View research paper', crossref: true },
    { test: function (u, h) { return h === 'scholar.google.com'; }, cat: 'academic', label: 'Google Scholar', action: 'View on Google Scholar' },
    { test: function (u, h) { return h === 'researchgate.net'; }, cat: 'academic', label: 'ResearchGate', action: 'View research paper' },
    { test: function (u, h) { return /\.pdf$/i.test(u.pathname); }, cat: 'doc', label: 'PDF document', action: 'Open PDF', pdfname: true }
  ];
  function classify(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    var h = u.hostname.replace(/^www\./, '').toLowerCase();
    var out = { href: href, cat: 'link', label: h, action: 'Visit website' };
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r.test(u, h)) {
        out.cat = r.cat; out.label = r.label; out.action = r.action;
        out.fetchTitle = r.fetchTitle;
        if (r.handle) {
          var seg = u.pathname.split('/').filter(Boolean);
          out.label = seg.length ? r.label + ' · ' + seg[0] : r.label;
        }
        if (r.pdfname) {
          var name = decodeURIComponent(u.pathname.split('/').pop() || '');
          out.label = name || 'PDF document';
        }
        if (r.crossref) {
          var doi = u.pathname.replace(/^\//, '');
          out.label = 'Research paper';
          out.doi = doi;
        }
        break;
      }
    }
    return out;
  }
  function buildCard(info) {
    var a = document.createElement('a');
    a.href = info.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'smart-link-card cat-' + info.cat;
    a.innerHTML = '<span class="sl-icon">' + (ICONS[info.cat] || ICONS.link) + '</span>' +
      '<span class="sl-text"><span class="sl-title">' + CN.esc(info.title || info.label) + '</span>' +
      '<span class="sl-sub">' + CN.esc(info.action) + '</span></span>';
    return a;
  }
  var URL_RE = /https?:\/\/[A-Za-z0-9._~:%#?&\/=@+\-]+[A-Za-z0-9\/_#=&+\-]/g;

  function linkifyText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf('http') === -1) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p || p.nodeName === 'A' || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var frag = document.createDocumentFragment();
      var last = 0, m;
      URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(n.nodeValue)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(n.nodeValue.slice(last, m.index)));
        var a = document.createElement('a');
        a.href = m[0];
        a.textContent = m[0];
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < n.nodeValue.length) frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
      if (n.parentNode) n.parentNode.replaceChild(frag, n);
    });
  }

  function scan(root) {
    if (!root || root.getAttribute('data-smart-links') === '1') return;
    root.setAttribute('data-smart-links', '1');
    linkifyText(root);
    var hosts = window.location.hostname;
    var links = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
    Array.prototype.slice.call(links).forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/^(mailto:|#|\/)/i.test(href) || href.indexOf(hosts) !== -1) return;
      if (a.closest && a.closest('.smart-link')) return;
      var info = classify(href);
      if (!info) return;
      var text = (a.textContent || '').trim();
      var bare = /^https?:\/\/\S+$/i.test(text);
      if (text && !bare) { a.classList.add('smart-inline'); return; }
      var card = buildCard(info);
      var wrap = document.createElement('span');
      wrap.className = 'smart-link';
      wrap.appendChild(card);
      if (a.parentNode) a.parentNode.replaceChild(wrap, a);
      if (info.fetchTitle) {
        try {
          fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(info.href))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { if (d && d.title) { card.querySelector('.sl-title').textContent = d.title; } })
            .catch(function () {});
        } catch (e) {}
      }
      if (info.doi) {
        try {
          fetch('https://api.crossref.org/works/' + encodeURIComponent(info.doi))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
              var m = d && d.message;
              if (!m) return;
              var title = (m.title && m.title[0]) || '';
              var year = m.issued && m.issued['date-parts'] && m.issued['date-parts'][0] && m.issued['date-parts'][0][0];
              var journal = (m['container-title'] && m['container-title'][0]) || '';
              var parts = [];
              if (title) parts.push(title);
              if (journal) parts.push(journal + (year ? ' (' + year + ')' : ''));
              if (parts.length) card.querySelector('.sl-title').textContent = parts.join(' · ');
            })
            .catch(function () {});
        } catch (e) {}
      }
    });
  }
  window.CN = window.CN || {};
  window.CN.smartLinks = scan;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scan(document.getElementById('body') || document.body); });
  } else {
    scan(document.getElementById('body') || document.body);
  }
})();

/* v4 header behaviour: scroll state, categories dropdown, mobile sheet, active link. Public pages only. */
(function () {
  var header = document.getElementById('siteHeader');
  if (!header) return;
  var drop = document.getElementById('catDrop');
  var dropBtn = document.getElementById('catBtn');
  var burger = document.getElementById('shBurger');
  var sheet = document.getElementById('shSheet');

  // subtle shadow + border once the page scrolls
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // active state: category pages mark their own category (desktop menu + sheet)
  var params = new URLSearchParams(window.location.search);
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var cat = page === 'category.html' ? params.get('c') : null;
  var links = header.querySelectorAll('a[href*="category.html?c="]');
  Array.prototype.forEach.call(links, function (a) {
    var k = decodeURIComponent(a.getAttribute('href').split('c=')[1] || '');
    var on = !!cat && k === cat;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (cat && dropBtn) dropBtn.classList.add('active');

  // categories dropdown (desktop)
  function setDrop(open) {
    if (!drop) return;
    drop.classList.toggle('open', open);
    dropBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (dropBtn) {
    dropBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setDrop(!drop.classList.contains('open'));
    });
  }

  // mobile sheet
  function setSheet(open) {
    if (!sheet || !burger) return;
    sheet.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (burger) {
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setSheet(!sheet.classList.contains('open'));
    });
  }

  document.addEventListener('click', function (e) {
    if (drop && !drop.contains(e.target)) setDrop(false);
    if (sheet && sheet.classList.contains('open') && !header.contains(e.target)) setSheet(false);
    if (e.target.closest && e.target.closest('#shSheet a')) setSheet(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setDrop(false); setSheet(false); }
  });
  // close the sheet when the viewport grows back to desktop
  var mq = window.matchMedia('(min-width: 861px)');
  mq.addEventListener('change', function (m) { if (m.matches) setSheet(false); });
})();

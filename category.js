(function () {
  var SB = window.SB, DB = window.DB, CN = window.CN, $ = function (s) { return document.querySelector(s); };
  var key = new URLSearchParams(location.search).get('c') || '';
  var known = SB.CATS[key] !== undefined;

  $('#catLinks').innerHTML = Object.keys(SB.CATS).map(function (k) {
    return '<a class="fchip' + (k === key ? ' on' : '') + '" href="' + CN.catUrl(k) + '">' + CN.esc(SB.CATS[k]) + '</a>';
  }).join('');

  if (!known) {
    $('#catTitle').textContent = 'Category not found';
    $('#catIntro').textContent = 'Pick a category above.';
    $('#postGrid').innerHTML = '';
    return;
  }
  var name = SB.CATS[key];
  document.title = name + ' · Anaxx Science Hub';
  $('#catTitle').textContent = name;
  $('#catIntro').textContent = 'Posts filed under ' + name + '.';

  DB.init().then(function () {
    CN.modeBanner(document.getElementById('modeBanner'));
    return Promise.all([DB.listPosts({ category: key }), DB.getSettings()]);
  }).then(function (r) {
    var list = CN.publishedOnly(r[0]);
    $('#navLogo').innerHTML = SB.logoHTML(r[1]);
    if (!list.length) {
      $('#postGrid').innerHTML = '<div class="glass empty-state"><span class="eyebrow">Coming soon</span>' +
        '<h3>No ' + CN.esc(name) + ' posts yet.</h3><p class="muted">Check back soon, or read the latest on the <a href="index.html">home page</a>.</p></div>';
      return;
    }
    $('#postGrid').innerHTML = list.map(function (p) { return CN.card(p, false); }).join('');
  }).catch(function (e) {
    console.warn(e);
    $('#postGrid').innerHTML = '<div class="glass empty-state"><h3>Could not load posts.</h3><p class="muted">Try again in a moment.</p></div>';
  });
})();

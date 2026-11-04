(function () {
  'use strict';
  var canvas = document.getElementById('ambient-field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  var themeButton = document.getElementById('theme-toggle');
  var sunIcon = themeButton && themeButton.querySelector('.sun-icon');
  var moonIcon = themeButton && themeButton.querySelector('.moon-icon');
  var colorScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var particles = [];
  var width = 0, height = 0, frame = 0, running = false;
  var colors = ['15,118,110', '63,113,103', '132,151,141', '172,163,141'];

  function isDarkTheme() {
    var manual = document.documentElement.getAttribute('data-theme');
    if (manual === 'dark') return true;
    if (manual === 'light') return false;
    return !!(colorScheme && colorScheme.matches);
  }
  function updateThemeControl() {
    if (!themeButton) return;
    var dark = isDarkTheme();
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeButton.setAttribute('aria-pressed', dark ? 'true' : 'false');
    sunIcon.hidden = dark;
    moonIcon.hidden = !dark;
  }
  if (themeButton) themeButton.addEventListener('click', function () {
    document.documentElement.setAttribute('data-theme', isDarkTheme() ? 'light' : 'dark');
    updateThemeControl();
  });
  if (colorScheme && colorScheme.addEventListener) colorScheme.addEventListener('change', updateThemeControl);
  else if (colorScheme && colorScheme.addListener) colorScheme.addListener(updateThemeControl);
  updateThemeControl();

  function particleCount() { return Math.min(114, Math.max(36, Math.round(width * height / 12667))); }
  function draw(move) {
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (move) {
        p.x += p.vx + Math.sin(p.phase) * .027;
        p.y += p.vy;
        p.phase += .009;
        if (p.y < -4) { p.y = height + 4; p.x = Math.random() * width; }
        if (p.x < -4) p.x = width + 4;
        if (p.x > width + 4) p.x = -4;
      }
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + p.color + ',' + p.a + ')';
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function tick() {
    if (!running) return;
    draw(true);
    frame = window.requestAnimationFrame(tick);
  }
  function syncMotion() {
    var shouldRun = !(reduced && reduced.matches) && !document.hidden;
    if (shouldRun && !running) { running = true; frame = window.requestAnimationFrame(tick); }
    if (!shouldRun && running) { running = false; window.cancelAnimationFrame(frame); draw(false); }
  }
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = particleCount();
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: .7 + Math.random() * 1.45,
        a: .12 + Math.random() * .18,
        vx: (Math.random() - .5) * .18,
        vy: -.0375 - Math.random() * .1425,
        phase: Math.random() * 6.28,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    draw(false);
  }
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize, { passive: true });
  if (reduced && reduced.addEventListener) reduced.addEventListener('change', syncMotion);
  else if (reduced && reduced.addListener) reduced.addListener(syncMotion);
  resize();
  syncMotion();
}());

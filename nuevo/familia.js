/* Familia Unity Tech · v3
   - Botón claro/oscuro, recordado en este navegador (ut.theme), y aviso del tema a las demos embebidas.
   - Barra del producto: sombra cuando la página ya bajó.
   - Demos vivas (.live): el iframe se carga recién cuando la persona llega ahí; mientras tanto se ve la foto.
   - Versión publicada (#dlver): lee version.json de la app. */
(function () {
  var root = document.documentElement, KEY = 'ut.theme';
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: function () {} };
  function isDark() { var t = root.dataset.theme; return t ? t === 'dark' : mq.matches; }
  function tell() {
    var t = isDark() ? 'dark' : 'light';
    document.querySelectorAll('iframe[data-tema]').forEach(function (f) { try { f.contentWindow.postMessage({ tema: f.getAttribute('data-tema') || t }, '*'); } catch (e) {} });
    document.querySelectorAll('.live img[data-dark]').forEach(function (i) { var s = i.getAttribute(t === 'dark' ? 'data-dark' : 'data-light'); if (s && i.getAttribute('src') !== s) i.src = s; });
    var m = document.querySelector('meta[name="theme-color"][data-auto]'); if (m) m.content = t === 'dark' ? '#000000' : '#fbfbfd';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.theme'); if (!b) return;
    var next = isDark() ? 'light' : 'dark'; root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (err) {}
    tell();
  });
  if (mq.addEventListener) mq.addEventListener('change', tell);

  window.addEventListener('message', function (e) {
    var d = e.data || {};
    document.querySelectorAll('.live iframe').forEach(function (f) {
      if (f.contentWindow !== e.source) return;
      var box = f.closest('.live');
      if (d.ovAlto && !box.hasAttribute('data-noalto')) box.style.height = Math.ceil(d.ovAlto) + 'px';
      if (d.ovListo) { box.classList.add('on'); tell(); }
    });
  });

  function liveLoad(box) {
    if (box.dataset.loaded) return; box.dataset.loaded = '1';
    var f = document.createElement('iframe');
    f.src = box.dataset.src; f.title = box.dataset.title || 'Demo'; f.loading = 'lazy'; f.setAttribute('data-tema', box.dataset.tema || ''); f.tabIndex = -1;
    if (box.hasAttribute('data-noclick')) f.style.pointerEvents = 'none';
    box.appendChild(f);
    setTimeout(function () { box.classList.add('on'); tell(); }, 6000);
  }
  function lives() {
    var boxes = document.querySelectorAll('.live[data-src]'); if (!boxes.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cel = matchMedia('(max-width: 760px)').matches;
    boxes = [].filter.call(boxes, function (b) { return !(cel && b.hasAttribute('data-solo-compu')); }); if (!boxes.length) return;
    if (!('IntersectionObserver' in window)) { boxes.forEach(liveLoad); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { liveLoad(en.target); io.unobserve(en.target); } }); }, { rootMargin: '300px 0px' });
    boxes.forEach(function (b) { io.observe(b); });
  }

  function nav() {
    var l = document.querySelector('.lnav'); if (!l) return;
    var on = function () { l.classList.toggle('scrolled', scrollY > 8); };
    addEventListener('scroll', on, { passive: true }); on();
  }

  function version() {
    var e = document.getElementById('dlver'); if (!e || !e.dataset.json) return;
    fetch(e.dataset.json, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
      var f = v.fecha ? new Date(v.fecha + 'T12:00').toLocaleDateString('es-UY', { day: 'numeric', month: 'long' }) : '';
      e.textContent = (v.version ? 'Versión ' + v.version + (f ? ' · actualizada el ' + f : '') + '. ' : '') + (e.dataset.texto || 'La web y las apps de escritorio se actualizan solas.');
    }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () { tell(); lives(); nav(); version(); });
})();

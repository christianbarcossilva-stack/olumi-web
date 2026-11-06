/* Familia Unity Tech · botón claro/oscuro, recordado en este navegador, y aviso del tema a las demos embebidas. */
(function () {
  var root = document.documentElement, KEY = 'ut.theme';
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: function () {} };
  function isDark() { var t = root.dataset.theme; return t ? t === 'dark' : mq.matches; }
  function tell() {
    var t = isDark() ? 'dark' : 'light';
    document.querySelectorAll('iframe[data-tema]').forEach(function (f) { try { f.contentWindow.postMessage({ tema: t }, '*'); } catch (e) {} });
    var m = document.querySelector('meta[name="theme-color"][data-auto]'); if (m) m.content = t === 'dark' ? '#000000' : '#f5f5f7';
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
    if (d.ovAlto) document.querySelectorAll('iframe[data-tema]').forEach(function (f) { if (f.contentWindow === e.source && !f.hasAttribute('data-noalto')) f.style.height = Math.ceil(d.ovAlto) + 'px'; });
    if (d.ovListo) tell();
  });
  document.addEventListener('DOMContentLoaded', tell);
})();

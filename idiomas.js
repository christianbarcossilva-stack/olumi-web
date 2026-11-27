/* Idiomas · capa común de las apps de Unity Tech (26/11/2026). Es la misma idea que ya usa Olumi (1.52i), suelta en un archivo para todas.
   La app está escrita en español; esta capa traduce lo que se ve (textos, botones, avisos, títulos y textos de ayuda) con un diccionario
   por idioma (i18n/<idioma>.json al lado de la página; se baja una vez y queda guardado). Los datos de cada empresa no se tocan.
   Fechas y números salen en el formato del idioma elegido.
   Uso: <script src="…/idiomas.js" data-app="ondi"></script> antes del programa de la app. Idioma: el elegido en este dispositivo
   (idiomas.cambiar('en')), si no el del teléfono o navegador, si no español. idiomas.selector() devuelve el HTML para elegirlo.
   Diccionario: { "t": { "texto en español": "traducción", "Hace {n} min": "{n} min ago" }, "p": [["^regex$", "reemplazo"]] } */
(() => {
  const yo = document.currentScript, APP = (yo && yo.dataset.app) || 'app', BASE = (yo && yo.dataset.dic) || 'i18n/', VER = (yo && yo.dataset.v) || '1';
  const LISTA = [['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['fr', 'Français'], ['zh', '中文'], ['hi', 'हिन्दी']];
  const LOC = { es: 'es-UY', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', zh: 'zh-CN', hi: 'hi-IN' };
  const leer = k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, poner = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const elegido = () => { const q = new URLSearchParams(location.search).get('idioma'); if (q && LOC[q]) { poner(APP + '.idioma', q); return q; } const v = leer(APP + '.idioma'); if (v && LOC[v]) return v; const n = (navigator.language || 'es').slice(0, 2).toLowerCase(); return LOC[n] ? n : 'es'; };
  const L = elegido(); let DIC = null, PAT = null; const JUNTA = leer(APP + '.i18n.juntar') === '1', FALTAN = new Set(), HECHAS = new Set();
  document.documentElement.lang = L;
  if (L !== 'es') {                                           // fechas y números en el formato del idioma (las apps los piden en es-UY)
    const loc = LOC[L], fix = a => (a === 'es-UY' || a === 'es' || a === 'es-ES' || a === undefined) ? loc : a;
    const d1 = Date.prototype.toLocaleDateString, d2 = Date.prototype.toLocaleString, d3 = Date.prototype.toLocaleTimeString, n1 = Number.prototype.toLocaleString;
    Date.prototype.toLocaleDateString = function (a, b) { return d1.call(this, fix(a), b); }; Date.prototype.toLocaleString = function (a, b) { return d2.call(this, fix(a), b); };
    Date.prototype.toLocaleTimeString = function (a, b) { return d3.call(this, fix(a), b); }; Number.prototype.toLocaleString = function (a, b) { return n1.call(this, fix(a), b); };
    for (const k of ['NumberFormat', 'DateTimeFormat']) { const O = Intl[k]; const F = function (a, b) { return new O(fix(a), b); }; F.prototype = O.prototype; F.supportedLocalesOf = O.supportedLocalesOf.bind(O); Intl[k] = F; }
  }
  const norm = s => s.replace(/\s+/g, ' ').trim();
  function traduce(s) { const t = traduce0(s); if (JUNTA && t != null) HECHAS.add(norm(t)); return t; }
  function traduce0(s) {
    if (!DIC) return null; const k = norm(s); if (!k || k.length > 400) return null; let t = DIC[k]; if (t != null) return t;
    if (/\d/.test(k)) {                                        // con números adentro: «6 abiertos» → «{n} abiertos»
      const nums = []; const m = k.replace(/\d+(?:[.,]\d+)*/g, x => { nums.push(x); return '{n}'; }); const t2 = DIC[m];
      if (t2 != null) { let i = 0; return t2.replace(/\{n\}/g, () => nums[i++] ?? '').replace(/\{([1-9])\}/g, (_, q) => nums[q - 1] ?? ''); }
    }
    if (k.includes(' · ')) { const ps = k.split(' · '); let alguna = false; const out = ps.map(p => { const x = traduce0(p); if (x != null) { alguna = true; return x; } return p; }); if (alguna) return out.join(' · '); }
    const fin = k.match(/^(.*?)([:.…]+)$/); if (fin && fin[1] && DIC[fin[1]] != null) return DIC[fin[1]] + fin[2];      // «Nombre:» con «Nombre» en el diccionario
    if (PAT) for (const [re, rep] of PAT) { if (re.test(k)) return k.replace(re, rep); }
    if (JUNTA && /[a-záéíóúñ]{3}/i.test(k) && !HECHAS.has(k)) FALTAN.add(k.replace(/\d+(?:[.,]\d+)*/g, '{n}'));
    return null;
  }
  const ATR = ['placeholder', 'title', 'aria-label', 'data-tip'];
  const NO = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
  const atrs = x => { for (const a of ATR) { const v = x.getAttribute(a); if (v && x['__i18n' + a] !== v) { const t = traduce(v); if (t != null) { x['__i18n' + a] = t; x.setAttribute(a, t); } } } };
  function nodo(n) {
    if (n.nodeType === 3) {
      const p = n.parentElement; if (!p || NO.has(p.tagName) || p.closest('[data-noi18n],[contenteditable="true"],.rte')) return; const v = n.nodeValue; if (!v || !/[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]/.test(v)) return;
      if (n.__i18n === v) return; const t = traduce(v); if (t != null) { const nv = v.match(/^\s*/)[0] + t + v.match(/\s*$/)[0]; n.__i18n = nv; n.nodeValue = nv; } return;
    }
    if (n.nodeType !== 1 || NO.has(n.tagName) || (n.closest && n.closest('[data-noi18n]'))) return;
    atrs(n); if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) { const t = traduce(n.value); if (t != null) n.value = t; }
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let x; while ((x = w.nextNode())) { if (x.nodeType === 3) nodo(x); else if (!x.closest('[data-noi18n]')) atrs(x); }
  }
  const cola = new Set(); const pasar = () => { const l = [...cola]; cola.clear(); l.forEach(nodo); };
  const obs = new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') cola.add(m.target); else if (m.type === 'attributes') cola.add(m.target); else m.addedNodes.forEach(x => cola.add(x)); } pasar(); });
  async function cargar() {
    if (L === 'es' && !JUNTA) return; let txt = null; const K = APP + '.i18n.' + L;
    if (L !== 'es') { try { const r = await fetch(BASE + L + '.json?v=' + VER, { cache: 'no-cache' }); if (r.ok) { txt = await r.text(); poner(K, txt); } } catch (_) {} if (!txt) txt = leer(K); }
    try { const j = txt ? JSON.parse(txt) : { t: {} }; DIC = j.t || j; PAT = (j.p || []).map(([a, b]) => [new RegExp(a), b]); } catch (e) { return; }
    nodo(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATR });
    if (document.title) { const t = traduce(document.title); if (t != null) document.title = t; }
  }
  if (L !== 'es') for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f]; window[f] = function (m, ...r) { const t = typeof m === 'string' ? traduce(m) : null; return o.call(window, t != null ? t : m, ...r); }; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cargar); else cargar();
  const cambiar = k => { if (!LOC[k]) return; poner(APP + '.idioma', k); const u = new URL(location.href); u.searchParams.delete('idioma'); if (u.toString() === location.href) location.reload(); else { history.replaceState(null, '', u.toString()); location.reload(); } };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-idioma]'); if (b) { e.preventDefault(); cambiar(b.dataset.idioma); } });
  const NOMBRE = { es: 'Idioma', en: 'Language', pt: 'Idioma', fr: 'Langue', zh: '语言', hi: 'भाषा' };
  // cada idioma va con su propio nombre, así lo encuentra quien no lee español
  const selector = () => `<div class="idiomas-sel" data-noi18n role="group" aria-label="${NOMBRE[L]}" style="display:flex;flex-wrap:wrap;gap:6px">${LISTA.map(([k, n]) => `<button type="button" data-idioma="${k}" lang="${k}" aria-pressed="${k === L}" style="min-height:40px;padding:6px 14px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer;opacity:${k === L ? 1 : .62};font-weight:${k === L ? 700 : 400}">${n}</button>`).join('')}</div>`;
  window.idiomas = { app: APP, actual: () => L, lista: LISTA, nombre: () => NOMBRE[L], cambiar, selector, traducir: s => { const t = traduce(String(s)); return t != null ? t : s; }, faltan: () => [...FALTAN].sort(), juntar: si => { poner(APP + '.i18n.juntar', si ? '1' : '0'); location.reload(); } };
})();

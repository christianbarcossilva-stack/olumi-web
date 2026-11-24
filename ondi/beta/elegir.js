// Elegir de una lista, con el mismo criterio que Olumi: cada <select> de Ondi se muestra como un botón propio que abre una lista con la estética
// de la app (no el menú del sistema). Si la lista es larga (8 opciones o más) arriba tiene un buscador: se escribe y se filtra, con flechas y Enter.
// El <select> de verdad sigue estando (oculto): el valor se escribe ahí y se dispara «change», así todo lo que ya escuchaba ese cambio sigue andando.
// Un <select data-nocpk> queda como está.
(() => {
  'use strict';
  const LARGA = 8, N = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FLECHA = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M4.5 6.5 8 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const LUPA = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.4 10.4 3.1 3.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const TILDE = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  let A = null; // la lista abierta: { sel, box, i, items }

  function etiqueta(sel) { const b = sel._cpk; if (!b) return; const o = sel.options[sel.selectedIndex]; b.querySelector('span').textContent = o ? o.textContent : ''; b.classList.toggle('vacio', !sel.value); b.disabled = sel.disabled; }
  function montar(sel) {
    if (sel._cpk || sel.multiple || sel.dataset.nocpk != null || sel.size > 1) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cpk-b ' + (sel.className || ''); b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
    const lab = sel.getAttribute('aria-label') || (sel.closest('label') && sel.closest('label').firstChild && sel.closest('label').firstChild.textContent) || ''; if (lab) b.setAttribute('aria-label', lab.trim());
    b.innerHTML = '<span></span>' + FLECHA; sel._cpk = b; sel.classList.add('cpk-sel'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true'); sel.before(b);
    if (sel.style.cssText) b.style.cssText = sel.style.cssText;
    Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); etiqueta(this); } });
    new MutationObserver(() => etiqueta(sel)).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    sel.addEventListener('change', () => etiqueta(sel));
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); abrir(sel); });
    b.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); abrir(sel); } });
    etiqueta(sel);
  }
  function cerrar(foco) { if (!A) return; const { box, sel } = A; A = null; box.remove(); if (sel._cpk) { sel._cpk.setAttribute('aria-expanded', 'false'); if (foco) sel._cpk.focus(); } }
  function ubicar() { if (!A) return; const r = A.sel._cpk.getBoundingClientRect(), box = A.box, W = Math.max(r.width, 220), vh = innerHeight, abajo = vh - r.bottom, arriba = r.top;
    box.style.width = Math.min(W, innerWidth - 16) + 'px'; box.style.left = Math.max(8, Math.min(r.left, innerWidth - Math.min(W, innerWidth - 16) - 8)) + 'px';
    const alto = Math.min(box.scrollHeight, 380), va = abajo < alto + 12 && arriba > abajo; box.style.maxHeight = Math.max(160, (va ? arriba : abajo) - 16) + 'px';
    if (va) { box.style.top = ''; box.style.bottom = (vh - r.top + 6) + 'px'; } else { box.style.bottom = ''; box.style.top = (r.bottom + 6) + 'px'; } }
  function abrir(sel) {
    if (A && A.sel === sel) { cerrar(true); return; } cerrar(); if (sel.disabled) return;
    const larga = [...sel.options].filter(o => o.value !== '' && !o.disabled).length >= LARGA, box = document.createElement('div'); box.className = 'cpk'; box.setAttribute('role', 'dialog');
    box.innerHTML = (larga ? `<label class="cpk-q">${LUPA}<input type="search" placeholder="Buscar" aria-label="Buscar" autocomplete="off" enterkeyhint="go"></label>` : '') + '<div class="cpk-l" role="listbox"></div>';
    document.body.appendChild(box); sel._cpk.setAttribute('aria-expanded', 'true'); A = { sel, box, i: Math.max(0, sel.selectedIndex), items: [] };
    const q = box.querySelector('input'); if (q) { q.addEventListener('input', () => { A.i = 0; pintar(); }); q.addEventListener('keydown', tecla); } else box.addEventListener('keydown', tecla);
    box.addEventListener('pointerdown', e => e.stopPropagation());
    box.addEventListener('click', e => { e.stopPropagation(); const o = e.target.closest('[data-cpk]'); if (o) elegir(o.dataset.cpk); });
    pintar(true); ubicar(); if (q && !matchMedia('(pointer:coarse)').matches) q.focus({ preventScroll: true }); else if (!q) { const f = box.querySelector('.cpk-o.on') || box.querySelector('.cpk-o'); if (f) f.focus({ preventScroll: true }); }
  }
  function pintar(inicio) {
    if (!A) return; const { sel, box } = A, q = box.querySelector('input'), ws = N(q ? q.value : '').split(/\s+/).filter(Boolean), items = [];
    let grupo = null;
    for (const o of sel.options) { if (o.disabled && o.value === '') continue; const g = o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : null; const t = N(o.textContent + ' ' + (g || ''));
      if (ws.length && (!o.value || !ws.every(w => t.includes(w)))) continue; if (g !== grupo) { grupo = g; if (g) items.push({ grupo: g }); } items.push({ v: o.value, n: o.textContent, dis: o.disabled, vacio: !o.value }); }
    A.items = items.filter(x => !x.grupo && !x.dis);
    if (inicio) A.i = Math.max(0, A.items.findIndex(x => x.v === sel.value)); if (A.i >= A.items.length) A.i = Math.max(0, A.items.length - 1);
    const act = A.items[A.i];
    box.querySelector('.cpk-l').innerHTML = items.map(x => x.grupo ? `<div class="cpk-g">${esc(x.grupo)}</div>` : `<button type="button" role="option" tabindex="-1" class="cpk-o${x.vacio ? ' vacio' : ''}${x === act ? ' on' : ''}${x.v === sel.value ? ' sel' : ''}" data-cpk="${esc(x.v)}" aria-selected="${x.v === sel.value}"${x.dis ? ' disabled' : ''}><span>${esc(x.n)}</span>${x.v === sel.value ? TILDE : ''}</button>`).join('')
      + (ws.length && !A.items.length ? `<p class="cpk-nada">Nada con «${esc(q.value.trim())}».</p>` : '');
    const on = box.querySelector('.cpk-o.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function tecla(e) { if (!A) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); A.i = Math.max(0, Math.min(A.items.length - 1, A.i + (e.key === 'ArrowDown' ? 1 : -1))); pintar(); return; }
    if (e.key === 'Enter') { e.preventDefault(); const x = A.items[A.i]; if (x) elegir(x.v); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); } if (e.key === 'Tab') cerrar(); }
  function elegir(v) { if (!A) return; const sel = A.sel; cerrar(true); if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); } }
  addEventListener('pointerdown', e => { if (A && !A.box.contains(e.target) && e.target !== A.sel._cpk && !A.sel._cpk.contains(e.target)) cerrar(); }, true);
  addEventListener('resize', () => ubicar()); addEventListener('scroll', e => { if (A && !A.box.contains(e.target)) ubicar(); }, true);
  // cada vez que la pantalla se arma de nuevo aparecen selects nuevos: se montan solos
  const todos = r => { if (r.tagName === 'SELECT') montar(r); else if (r.querySelectorAll) r.querySelectorAll('select').forEach(montar); };
  const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) todos(n); if (A && !A.sel.isConnected) cerrar(); });
  const ini = () => { todos(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) ini(); else addEventListener('DOMContentLoaded', ini);
  window.OndiElegir = { montar, cerrar };
})();

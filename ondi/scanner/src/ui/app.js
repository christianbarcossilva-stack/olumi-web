// Ondi Scanner: la pantalla. Habla solo con el programa que corre en esta compu.
'use strict';
const TOKEN = document.querySelector('meta[name="ondi-ui"]').content;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (p, body) => fetch(p, { method: body ? 'POST' : 'GET', headers: { 'X-Ondi-UI': TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const IC = {
  camara: '<svg viewBox="0 0 24 24"><path d="M3 7h12l4-2v10l-4-2H3z"/><path d="M7 13v5M5 18h4"/></svg>',
  router: '<svg viewBox="0 0 24 24"><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M7 16h.01M11 16h.01M8 9a6 6 0 0 1 8 0M5.5 6.5a10 10 0 0 1 13 0"/></svg>',
  ap: '<svg viewBox="0 0 24 24"><circle cx="12" cy="17" r="1.5"/><path d="M8.5 13.5a5 5 0 0 1 7 0M5.5 10.5a9 9 0 0 1 13 0"/></svg>',
  switch: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 12h.01M10 12h.01M13 12h.01M16 12h.01"/></svg>',
  impresora: '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/></svg>',
  pc: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  nas: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 17h.01"/></svg>',
  iot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
  movil: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
  otro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4M12 16h.01"/></svg>' };
const TIPN = { camara: 'Cámara o grabador', router: 'Router', ap: 'Access point', switch: 'Switch', impresora: 'Impresora', pc: 'Computadora', nas: 'Almacenamiento (NAS)', iot: 'Equipo IoT', movil: 'Celular o compu', otro: 'Otro' };
const TIPP = { camara: 'Cámaras', router: 'Routers', ap: 'Access points', switch: 'Switches', impresora: 'Impresoras', pc: 'Compus', nas: 'NAS', iot: 'IoT', movil: 'Celulares', otro: 'Otros' };
const ST = { filas: [], vistos: new Set(), total: 0, hechos: 0, corre: null, filtro: '', q: '', orden: 'ip', inv: false, sel: null };

function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600); }
const ipNum = ip => ip.split('.').reduce((a, b) => a * 256 + +b, 0);

async function estado() {
  try { const r = await api('/api/estado'), d = await r.json();
    $('#codigo').textContent = d.codigo; $('#ondiweb .dot').classList.toggle('ok', d.ondi);
    $('#ondiest').textContent = d.ondi ? 'Ondi web está conectado ahora.' : 'Ondi web todavía no se conectó.';
    if (!estado.listo) { estado.listo = true; const R = d.redes || [];
      if (!$('#red').value && R[0]) $('#red').value = R[0].red;
      $('#mias').innerHTML = R.map(x => `<button type="button" data-red="${esc(x.red)}" title="${esc(x.placa)} · esta compu es ${esc(x.ip)}">${esc(x.red)}</button>`).join(''); } }
  catch (e) { /* el programa se cerró */ } }

function pintar() {
  const q = ST.q.toLowerCase(), cuenta = {};
  for (const r of ST.filas) cuenta[r.tipo] = (cuenta[r.tipo] || 0) + 1;
  $('#tipos').innerHTML = `<button data-tipo="" aria-pressed="${!ST.filtro}">Todos <b>${ST.filas.length}</b></button>` + Object.keys(TIPN).filter(k => cuenta[k]).map(k => `<button data-tipo="${k}" aria-pressed="${ST.filtro === k}">${IC[k]}${TIPP[k]} <b>${cuenta[k]}</b></button>`).join('');
  const F = ST.filas.filter(r => (!ST.filtro || r.tipo === ST.filtro) && (!q || [r.ip, r.nombre, r.web, r.fab, r.mac, TIPN[r.tipo]].join(' ').toLowerCase().includes(q)));
  const k = ST.orden, s = ST.inv ? -1 : 1;
  F.sort((a, b) => s * (k === 'ip' ? ipNum(a.ip) - ipNum(b.ip) : k === 'ms' ? (a.ms ?? 1e9) - (b.ms ?? 1e9) : String(k === 'tipo' ? TIPN[a.tipo] : a[k] || '~').localeCompare(String(k === 'tipo' ? TIPN[b.tipo] : b[k] || '~'))));
  document.querySelectorAll('th[data-o]').forEach(th => { th.classList.toggle('on', th.dataset.o === k); th.classList.toggle('inv', th.dataset.o === k && ST.inv); });
  $('#filas').innerHTML = F.map(r => `<tr data-ip="${esc(r.ip)}" class="${ST.sel === r.ip ? 'sel' : ''}${r._nuevo ? ' nuevo' : ''}"><td class="ip">${esc(r.ip)}</td><td><b>${esc(r.nombre || r.web || '—')}</b>${r.web && r.nombre ? `<span class="sub">${esc(r.web)}</span>` : ''}</td>
    <td><span class="tipo">${IC[r.tipo] || IC.otro}${esc(TIPN[r.tipo] || 'Otro')}</span></td><td>${esc(r.fab || '—')}</td><td class="mac">${esc(r.mac || '—')}</td>
    <td>${(r.puertos || []).map((p, i) => `<span class="sv" title="${esc((r.que || [])[i] || '')}">${esc((r.que || [])[i] || p)}</span>`).join('') || '<span class="muted">—</span>'}</td><td class="num">${r.ms == null ? '—' : Math.round(r.ms) + ' ms'}</td></tr>`).join('')
    || `<tr><td colspan="7" class="muted">${ST.corre ? 'Buscando…' : 'Nada con ese filtro.'}</td></tr>`;
  ST.filas.forEach(r => { r._nuevo = false; });
  $('#res').hidden = !ST.filas.length && !ST.corre; $('#vacio').hidden = !$('#res').hidden;
  $('#pie').textContent = ST.corre ? `Recorriendo ${ST.hechos} de ${ST.total} direcciones… ${ST.vistos.size} responden` : ST.fin || '';
  $('#prog').hidden = !ST.corre; $('#prog i').style.width = (ST.total ? ST.hechos / ST.total * 100 : 0) + '%';
  const b = $('#ir'); b.classList.toggle('pri', !ST.corre); b.classList.toggle('para', !!ST.corre); b.querySelector('span').textContent = ST.corre ? 'Parar' : 'Escanear';
  detalle(); }

function detalle() { const d = $('#detalle'), r = ST.filas.find(x => x.ip === ST.sel); d.hidden = !r; if (!r) return;
  const webs = (r.puertos || []).filter(p => [80, 443, 8080, 8443, 5000, 5001, 9000].includes(p));
  d.innerHTML = `<button class="cerrar" data-cerrar aria-label="Cerrar">×</button><h2>${IC[r.tipo] || IC.otro}${esc(r.nombre || TIPN[r.tipo])} <small>${esc(r.ip)}</small></h2>
    <dl><dt>Qué es</dt><dd>${esc(TIPN[r.tipo])}</dd><dt>Fabricante</dt><dd>${esc(r.fab || 'No se sabe')}</dd><dt>MAC</dt><dd class="mac">${esc(r.mac || '—')}</dd>${r.web ? `<dt>Página</dt><dd>${esc(r.web)}</dd>` : ''}${r.servidor ? `<dt>Servidor</dt><dd>${esc(r.servidor)}</dd>` : ''}
      <dt>Servicios</dt><dd>${(r.puertos || []).map((p, i) => `${esc((r.que || [])[i] || '')} (${p})`).join(', ') || '—'}</dd></dl>
    <div class="acc">${webs.map(p => `<button class="btn" data-web="${p}">Abrir página${webs.length > 1 ? ' :' + p : ''}</button>`).join('')}${(r.puertos || []).includes(3389) ? '<button class="btn" data-rdp>Escritorio remoto</button>' : ''}
      <button class="btn" data-copia="${esc(r.ip)}">Copiar IP</button>${r.mac ? `<button class="btn" data-copia="${esc(r.mac)}">Copiar MAC</button><button class="btn" data-wol="${esc(r.mac)}" title="Necesita Wake-on-LAN activado en la placa">Encender</button>` : ''}</div>`; }

async function escanear() {
  if (ST.corre) { ST.corre.abort(); return; }
  const red = $('#red').value.trim(); if (!red) { $('#red').focus(); return; }
  Object.assign(ST, { filas: [], vistos: new Set(), total: 0, hechos: 0, fin: '', sel: null }); const ac = new AbortController(); ST.corre = ac; pintar();
  let buf = '';
  try { const r = await fetch('/api/escanear', { method: 'POST', headers: { 'X-Ondi-UI': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ red, puertos: $('#servicios').checked }), signal: ac.signal });
    if (!r.ok) { let e = ''; try { e = (await r.json()).error; } catch (_) {} throw new Error(e || 'Error ' + r.status); }
    const rd = r.body.getReader(), td = new TextDecoder();
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += td.decode(value, { stream: true }); let i, cambio = false;
      while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i); buf = buf.slice(i + 1); if (!ln) continue; const o = JSON.parse(ln); cambio = true;
        if (o.t === 'inicio') ST.total = o.total; else if (o.t === 'avance') ST.hechos = o.hechos; else if (o.t === 'visto') ST.vistos.add(o.ip);
        else if (o.t === 'equipo') { o._nuevo = true; ST.filas.push(o); } else if (o.t === 'fin') ST.fin = `${o.encontrados} equipos en ${String(o.seg).replace('.', ',')} s · ${red} · ${new Date().toLocaleString('es-UY')}`; }
      if (cambio) pintar(); } }
  catch (e) { ST.fin = e.name === 'AbortError' ? 'Escaneo cortado.' : e.message; if (e.name !== 'AbortError') toast(e.message); }
  ST.corre = null; pintar(); }

function csv() { const L = [['IP', 'Nombre', 'Qué es', 'Fabricante', 'MAC', 'Página', 'Servicios', 'Respuesta (ms)']].concat(ST.filas.map(r => [r.ip, r.nombre, TIPN[r.tipo], r.fab, r.mac, r.web, (r.puertos || []).join(' '), r.ms == null ? '' : Math.round(r.ms)]));
  const b = new Blob(['﻿' + L.map(f => f.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(';')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ondi-scanner-' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }

$('#form').addEventListener('submit', e => { e.preventDefault(); escanear(); });
$('#ir2').addEventListener('click', escanear);
$('#csv').addEventListener('click', csv);
$('#buscar').addEventListener('input', e => { ST.q = e.target.value; pintar(); });
$('#mias').addEventListener('click', e => { const b = e.target.closest('[data-red]'); if (b) { $('#red').value = b.dataset.red; $('#red').focus(); } });
$('#tipos').addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (b) { ST.filtro = b.dataset.tipo; pintar(); } });
document.querySelector('thead').addEventListener('click', e => { const th = e.target.closest('th[data-o]'); if (!th) return; if (ST.orden === th.dataset.o) ST.inv = !ST.inv; else { ST.orden = th.dataset.o; ST.inv = false; } pintar(); });
$('#filas').addEventListener('click', e => { const tr = e.target.closest('tr[data-ip]'); if (!tr) return; ST.sel = ST.sel === tr.dataset.ip ? null : tr.dataset.ip; pintar(); });
$('#detalle').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; const r = ST.filas.find(x => x.ip === ST.sel);
  if (b.hasAttribute('data-cerrar')) { ST.sel = null; pintar(); return; }
  if (b.dataset.web) api('/api/abrir', { que: 'web', ip: r.ip, puerto: +b.dataset.web });
  if (b.hasAttribute('data-rdp')) api('/api/abrir', { que: 'rdp', ip: r.ip });
  if (b.dataset.copia) { try { await navigator.clipboard.writeText(b.dataset.copia); toast('Copiado: ' + b.dataset.copia); } catch (_) { toast(b.dataset.copia); } }
  if (b.dataset.wol) { const x = await api('/api/wol', { mac: b.dataset.wol }); toast(x.ok ? 'Señal de encendido enviada a ' + b.dataset.wol : 'No se pudo enviar'); } });
$('#ondiweb').addEventListener('click', () => { const p = $('#pop'); p.hidden = !p.hidden; $('#ondiweb').setAttribute('aria-expanded', String(!p.hidden)); });
document.addEventListener('click', e => { if (!$('#pop').hidden && !e.target.closest('#pop,#ondiweb')) { $('#pop').hidden = true; $('#ondiweb').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#pop').hidden = true; if (ST.sel) { ST.sel = null; pintar(); } } });
$('#probar').addEventListener('click', () => api('/api/abrir', { que: 'ondi', ip: '127.0.0.1' }));
$('#salir').addEventListener('click', async () => { await api('/api/salir', {}).catch(() => {}); document.body.innerHTML = '<main style="display:grid;place-content:center;text-align:center;min-height:100vh"><h1 style="font-size:22px">Ondi Scanner se cerró</h1><p class="muted">Podés cerrar esta pestaña.</p></main>'; });
estado(); setInterval(estado, 5000);
api('/api/ultimo').then(r => r.json()).then(d => { if (d.equipos && d.equipos.length && !ST.filas.length) { ST.filas = d.equipos; ST.fin = 'Último escaneo: ' + d.red; if (d.red) $('#red').value = d.red; pintar(); } }).catch(() => {});
pintar();

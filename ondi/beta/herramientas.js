/* Ondi · Integraciones: herramientas para técnicos y gerentes de IT.
   Consola y escaneo de red (con el ayudante Ondi Técnico en la laptop), mapa de calor medido,
   predictivo de wifi y simulador de cámaras. Usa lo que ya tiene la app (S, SB, orgId, toast). */
(function () {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s), ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const dec = (v, n = 1) => (Math.round(v * 10 ** n) / 10 ** n).toString().replace('.', ',');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const movil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const css = `
.hwrap{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;min-width:0}
#herbox,.hwrap>*,.hl>*{min-width:0}
.hbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hbar .grow{flex:1}
.hseg{display:inline-flex;max-width:100%;overflow-x:auto;scrollbar-width:none;border:1px solid var(--line);border-radius:10px;background:var(--surface);min-width:0;flex:0 1 auto}
.hseg button{border:0;background:none;padding:7px 11px;font-size:13.5px;color:var(--muted);white-space:nowrap}
.hseg button+button{border-left:1px solid var(--line)}
.hseg button[aria-pressed="true"]{background:var(--accent-soft);color:var(--ink);font-weight:600}
.hay{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.hay b{font-weight:600}.hay .dot{width:9px;height:9px;border-radius:50%;background:var(--muted)}.hay .dot.ok{background:var(--ok)}.hay .dot.no{background:var(--crit)}
.hay form{display:flex;gap:8px;align-items:center}.hay input{width:110px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);font-family:var(--f-mono);letter-spacing:.12em}
.hterm{background:#0e1418;color:#d5e6dc;font-family:var(--f-mono);font-size:13px;line-height:1.5;border-radius:12px;padding:12px 14px;height:min(52vh,440px);overflow:auto;white-space:pre-wrap;word-break:break-word}
.hterm .ok{color:#7fe0a5}.hterm .no{color:#ff8f8f}.hterm .yo{color:#7fd3ef}.hterm .tn{color:#8a9aa5}
.hin{display:flex;gap:8px;margin-top:8px}.hin input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-family:var(--f-mono)}
.hchips{display:flex;flex-wrap:wrap;gap:6px}.hchips button{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:5px 11px;font-size:13px;font-family:var(--f-mono);color:var(--muted)}
.hchips button:hover{color:var(--ink);border-color:var(--accent)}
.hprog{height:6px;border-radius:3px;background:var(--sunken);overflow:hidden}.hprog i{display:block;height:100%;background:var(--accent);transition:width .2s}
.htab td,.htab th{white-space:nowrap}.htab td.w{white-space:normal;min-width:140px}
.hpto{display:inline-block;font-family:var(--f-mono);font-size:11.5px;border:1px solid var(--line);border-radius:6px;padding:0 5px;margin:1px 2px 1px 0;color:var(--muted)}
.hl{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
@media (max-width:980px){.hl{grid-template-columns:minmax(0,1fr)}}
.hcv{position:relative;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--sunken);touch-action:none;user-select:none;-webkit-user-select:none}
.hcv canvas{display:block;width:100%}
.hcv .hzoom{position:absolute;right:8px;top:8px;display:grid;gap:4px}
.hcv .hzoom button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--surface);font-size:17px;line-height:1;color:var(--ink)}
.hayu{font-size:12.5px;color:var(--muted);margin:-2px 0 0}
.hchk{display:flex;gap:8px;align-items:center;font-size:13px;margin-top:10px}.hside .hchk input{width:auto;flex:none}
.hside{display:grid;gap:12px}
.hside .card{padding:14px 16px}.hside h3{margin:0 0 8px;font-size:15px}
.hside label.fld{display:grid;gap:4px;font-size:13px;color:var(--muted);margin-bottom:8px}
.hside input,.hside select,.hcfg input,.hcfg select{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.hleg{height:10px;border-radius:5px;margin:6px 0 3px}
.hleg+div{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);font-family:var(--f-mono)}
.hst{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:13px}.hst b{white-space:nowrap;font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right}
.hlist{display:grid;gap:4px;max-height:220px;overflow:auto}.hlist button{display:flex;justify-content:space-between;gap:8px;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:6px 9px;font-size:13px}
.hlist button.on{border-color:var(--accent);background:var(--accent-soft)}
.hcam{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:16px}
@media (max-width:980px){.hcam{grid-template-columns:minmax(0,1fr)!important}}
.hcfg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.hcfg label{display:grid;gap:4px;font-size:13px;color:var(--muted)}
.hver{position:relative;border-radius:10px;overflow:hidden;background:#000}
.hver canvas{display:block;width:100%;height:auto}
.hver .hzi{position:absolute;right:8px;bottom:8px;width:34%;border:2px solid #fff;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.5)}
.hver .hzi canvas{border-radius:4px}
.hver .hlab{position:absolute;left:8px;top:8px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;padding:3px 8px;border-radius:6px;font-family:var(--f-mono)}
.hdori{display:grid;gap:4px;font-size:13px}.hdori div{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center}.hdori i{width:12px;height:12px;border-radius:3px}
.hdori b{font-family:var(--f-mono);font-variant-numeric:tabular-nums}
.hsvg svg{display:block;width:100%;height:auto}
.hnota{font-size:12.5px;color:var(--muted);margin:0}
`;
if (!document.getElementById('hcss')) { const st = document.createElement('style'); st.id = 'hcss'; st.textContent = css; document.head.appendChild(st); }

/* ======================================================================
   Ondi Técnico (el ayudante de la laptop)
   ====================================================================== */
const AY = { url: 'http://127.0.0.1:47800', est: undefined, cod: ls.get('ondi.tec.cod') || '' };
async function ayHola() {
  try { const r = await fetch(AY.url + '/hola', { headers: AY.cod ? { 'X-Ondi-Codigo': AY.cod } : {}, signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined }); AY.est = await r.json(); }
  catch (e) { AY.est = false; }
  return AY.est; }
const ayListo = () => AY.est && AY.est.ok && AY.est.emparejado;
async function ayPost(path, body, alTexto, signal) {
  const r = await fetch(AY.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ondi-Codigo': AY.cod }, body: JSON.stringify(body), signal });
  if (!r.ok) { let e = ''; try { e = (await r.json()).error; } catch (_) {} if (r.status === 401) { AY.est = Object.assign({}, AY.est, { emparejado: false }); e = 'El código de emparejado cambió. Ponelo de nuevo.'; } throw new Error(e || 'Error ' + r.status); }
  const rd = r.body.getReader(), td = new TextDecoder();
  for (;;) { const { value, done } = await rd.read(); if (done) break; alTexto(td.decode(value, { stream: true })); } }
async function ayWifi() { const r = await fetch(AY.url + '/wifi', { headers: { 'X-Ondi-Codigo': AY.cod } }); return r.json(); }

function ayHtml(para) {
  if (AY.est === undefined) return `<div class="hay"><span class="dot"></span><span>Buscando Ondi Técnico en esta compu…</span></div>`;
  if (AY.est === false) return `<div class="hay" style="display:grid;gap:8px"><div style="display:flex;gap:10px;align-items:center"><span class="dot no"></span><b>Ondi Técnico no está abierto en esta compu</b></div>
    <p class="muted" style="margin:0">${para} desde el navegador no se puede: el navegador no deja tirar ping ni recorrer la red. Lo hace un programa chico que va en la laptop del técnico y solo habla con Ondi.${movil ? ' <b>Desde el celular o la tablet no se puede: usá la laptop.</b>' : ''}</p>
    <ol class="how" style="margin:0"><li>Bajá el programa: <a href="../tecnico/ondi_tecnico.py" download>ondi_tecnico.py</a></li>
      <li><b>Windows:</b> instalá Python 3 de python.org (tildá «Add Python to PATH») y hacé doble clic en el archivo. <b>Mac:</b> abrí Terminal y escribí <span class="mono">python3 ~/Downloads/ondi_tecnico.py</span></li>
      <li>Dejá la ventana abierta, poné acá el código de 6 números que muestra y tocá Buscar de nuevo.</li></ol>
    <div><button class="btn sm" data-h="ayre">Buscar de nuevo</button></div></div>`;
  if (!AY.est.emparejado) return `<div class="hay"><span class="dot"></span><b>Ondi Técnico encontrado</b><span class="muted">Poné el código de 6 números que muestra su ventana.</span>
    <form data-hf="aycod"><input id="aycod" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000" aria-label="Código de emparejado"><button class="btn sm pri" type="submit">Emparejar</button></form></div>`;
  const R = AY.est.redes && AY.est.redes[0];
  return `<div class="hay"><span class="dot ok"></span><b>Ondi Técnico conectado</b><span class="muted">${esc(AY.est.equipo || '')} · ${esc(AY.est.so || '')}${R ? ' · ' + esc(R.ip) : ''}</span><span class="grow" style="flex:1"></span><button class="btn sm" data-h="ayoff">Desemparejar</button></div>`; }

/* ======================================================================
   Consola
   ====================================================================== */
const CO = { lineas: [{ c: 'tn', t: 'Consola de Ondi. Escribí «ayuda» para ver los comandos.\n' }], hist: JSON.parse(ls.get('ondi.tec.hist') || '[]'), hi: -1, corre: null };
const ALIAS = { ping: 'ping', traza: 'traza', tracert: 'traza', traceroute: 'traza', dns: 'dns', nslookup: 'dns', ip: 'ip', ipconfig: 'ip', ifconfig: 'ip', arp: 'arp', puerto: 'puerto', telnet: 'puerto', wifi: 'wifi' };
const AYUDA = `Comandos:
  ping <dirección> [cantidad]   ej. ping 8.8.8.8 10 (con -t, 100 veces)
  traza <dirección>   el camino hasta un equipo (tracert)
  dns <nombre>   a qué IP apunta un nombre (nslookup)
  puerto <dirección> <número>   si un puerto responde
  ip   las placas de red de esta compu
  arp   los equipos que esta compu vio en la red
  wifi   la señal del wifi de esta compu
  limpiar   borra la pantalla
Flechas ↑ ↓: comandos anteriores. Parar (o Ctrl+C) corta el comando.
`;
function colorDe(t) { return /TTL=|tiempo=|time=|bytes from|abierto|Respuesta desde/i.test(t) ? 'ok' : /agotado|timed out|inaccesible|unreachable|no se pudo|could not|desconocido|100% (packet )?loss|cerrado|sin respuesta|Error/i.test(t) ? 'no' : ''; }
function coPintar() { const el = $('#hterm'); if (!el) return;
  el.innerHTML = CO.lineas.map(l => `<span class="${l.c || colorDe(l.t)}">${esc(l.t)}</span>`).join(''); el.scrollTop = el.scrollHeight;
  const b = $('#hcorrer'); if (b) { b.textContent = CO.corre ? 'Parar' : 'Correr'; b.classList.toggle('danger', !!CO.corre); } }
function coAgregar(t, c) { const L = CO.lineas, partes = t.split(/(?<=\n)/);
  for (const p of partes) { const u = L[L.length - 1]; if (u && !c && !u.c && !u.t.endsWith('\n')) u.t += p; else L.push({ t: p, c }); }
  if (L.length > 2000) L.splice(0, L.length - 2000); coPintar(); }
async function coCorrer(txt) {
  txt = txt.trim(); if (!txt) return;
  CO.hist = [txt, ...CO.hist.filter(x => x !== txt)].slice(0, 40); CO.hi = -1; ls.set('ondi.tec.hist', JSON.stringify(CO.hist));
  coAgregar('ondi> ' + txt + '\n', 'yo');
  const [w, ...resto] = txt.split(/\s+/), cm = w.toLowerCase();
  if (cm === 'limpiar' || cm === 'cls' || cm === 'clear') { CO.lineas = []; coPintar(); return; }
  if (cm === 'ayuda' || cm === 'help' || cm === '?') { coAgregar(AYUDA, 'tn'); return; }
  const c = ALIAS[cm]; if (!c) { coAgregar('No conozco «' + w + '». Escribí ayuda.\n', 'no'); return; }
  if (!ayListo()) { coAgregar('Falta Ondi Técnico abierto y emparejado en esta compu (arriba están los pasos).\n', 'no'); return; }
  let a = resto.filter(x => !/^-/.test(x)).join(' '), n = 4; const nn = txt.match(/\s(?:-n|-c)\s*(\d+)/) || (c === 'ping' && resto[1] && /^\d+$/.test(resto[1]) ? [0, resto[1]] : null);
  if (c === 'ping') { if (nn) n = +nn[1]; if (/\s-t\b/.test(txt)) n = 100; a = resto[0] || ''; }
  if (['ping', 'traza', 'dns', 'puerto'].includes(c) && !a) { coAgregar('Falta la dirección. Ej.: ' + c + ' 8.8.8.8' + (c === 'puerto' ? ' 443' : '') + '\n', 'no'); return; }
  const ac = new AbortController(); CO.corre = ac; coPintar();
  try { await ayPost('/cmd', { c, a, n }, t => coAgregar(t), ac.signal); }
  catch (e) { if (e.name !== 'AbortError') coAgregar((/Failed to fetch|NetworkError|Load failed/.test(e.message) ? 'Se cortó la conexión con Ondi Técnico. ¿Sigue abierta su ventana?' : e.message) + '\n', 'no'); else coAgregar('^C cortado\n', 'tn'); }
  CO.corre = null; coPintar(); if (AY.est && !AY.est.emparejado) montar(); }
function consolaHtml() {
  const ch = ['ping 8.8.8.8', 'ping 192.168.1.1', 'traza google.com', 'dns unitytech.uy', 'puerto 192.168.1.64 554', 'ip', 'arp', 'wifi'];
  return `<div class="hwrap">${ayHtml('La consola')}
    <div class="card pad"><div class="hchips" style="margin-bottom:10px">${ch.map(x => `<button data-hc="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="hterm" id="hterm" role="log" aria-live="polite"></div>
      <form class="hin" data-hf="cmd"><input id="hcmd" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ping 8.8.8.8" aria-label="Comando"><button class="btn pri" id="hcorrer" type="submit">Correr</button></form></div></div>`; }

/* ======================================================================
   Escaneo de red
   ====================================================================== */
const ES = { filas: [], total: 0, hechos: 0, corre: null, red: '', puertos: true, q: '', fin: null, cli: '', agregados: {} };
const TIPN = { camara: 'Cámara o grabador', router: 'Router', ap: 'Access point', switch: 'Switch', sensor_puerta: 'Equipo IoT', otro: 'Otro' };
const MARCA = f => /hikvision/i.test(f) ? 'hikvision' : /dahua/i.test(f) ? 'dahua' : /ubiquiti/i.test(f) ? 'unifi' : /mikrotik|routerboard/i.test(f) ? 'mikrotik' : /tp-?link/i.test(f) ? 'tplink' : /intelbras/i.test(f) ? 'intelbras' : /espressif|sonoff|itead/i.test(f) ? 'sonoff' : /cisco|meraki/i.test(f) ? 'cisco' : 'otra';
function escaneoHtml() {
  if (!ES.red && AY.est && AY.est.redes && AY.est.redes[0]) ES.red = AY.est.redes[0].red;
  const q = ES.q.toLowerCase(), F = ES.filas.filter(r => !q || [r.ip, r.nombre, r.fab, r.web, r.mac, TIPN[r.tipo]].join(' ').toLowerCase().includes(q)), pct = ES.total ? Math.round(ES.hechos / ES.total * 100) : 0;
  const sites = A.S.sites || [];
  return `<div class="hwrap">${ayHtml('El escaneo')}
    <div class="card pad"><form class="hbar" data-hf="scan"><label class="fld" style="margin:0;min-width:200px;flex:1">Red a recorrer<input id="hred" class="mono" value="${esc(ES.red)}" placeholder="192.168.1.0/24" autocomplete="off" spellcheck="false"></label>
      <label class="chk" style="align-self:end;padding-bottom:8px"><input type="checkbox" id="hpto" ${ES.puertos ? 'checked' : ''}> Buscar puertos (cámaras, routers, web)</label>
      <button class="btn ${ES.corre ? 'danger' : 'pri'}" style="align-self:end" type="submit">${ES.corre ? 'Parar' : 'Escanear'}</button></form>
      ${ES.corre || ES.fin ? `<div style="margin-top:12px"><div class="hprog"><i style="width:${ES.corre ? pct : 100}%"></i></div><p class="hnota" style="margin-top:6px">${ES.corre ? `Recorriendo ${ES.hechos} de ${ES.total}…` : esc(ES.fin)}</p></div>` : '<p class="hnota" style="margin-top:10px">Recorre una red de hasta 1024 direcciones desde esta compu: quién responde, fabricante por la MAC, nombre y qué puertos tiene abiertos. Una /24 tarda entre 10 y 40 segundos.</p>'}</div>
    ${ES.filas.length ? `<div class="card pad"><div class="hbar" style="margin-bottom:10px"><b>${ES.filas.length} equipos</b><input id="hesq" placeholder="Filtrar por IP, marca o nombre" value="${esc(ES.q)}" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">
        <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Agregar a<select id="hescli" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"><option value="">elegí un cliente</option>${sites.map(s => `<option value="${esc(s.id)}" ${ES.cli === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <button class="btn sm" data-h="escsv">Bajar la lista</button></div>
      <div class="tscroll"><table class="htab"><thead><tr><th>IP</th><th>Qué es</th><th>Fabricante</th><th>Nombre o página</th><th>MAC</th><th>Puertos</th><th></th></tr></thead><tbody>
      ${F.map(r => { const k = ES.cli + ':' + r.ip; return `<tr><td class="mono">${esc(r.ip)}${r.ms != null ? `<div class="muted" style="font-size:11.5px">${dec(r.ms, 0)} ms</div>` : ''}</td><td>${esc(TIPN[r.tipo] || 'Otro')}</td><td class="w">${esc(r.fab || '—')}</td><td class="w">${esc(r.nombre || r.web || '—')}</td><td class="mono" style="font-size:12.5px">${esc(r.mac || '—')}</td>
        <td class="w">${(r.puertos || []).map((p, i) => `<span class="hpto" title="${esc(r.que[i] || '')}">${p}</span>`).join('') || '—'}</td>
        <td><div class="cfga"><button class="btn sm" data-hping="${esc(r.ip)}">Ping</button>${(r.puertos || []).some(p => [80, 443, 8080, 8443].includes(p)) ? `<a class="btn sm" href="${r.puertos.includes(80) || r.puertos.includes(8080) ? 'http' : 'https'}://${esc(r.ip)}${r.puertos.includes(80) ? '' : r.puertos.includes(8080) ? ':8080' : r.puertos.includes(443) ? '' : ':8443'}/" target="_blank" rel="noopener">Abrir</a>` : ''}
          ${r.fab === 'Esta compu' ? '' : ES.agregados[k] ? '<span class="pill ok">Agregado</span>' : `<button class="btn sm" data-hadd="${esc(r.ip)}">Agregar</button>`}</div></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}</div>`; }
async function esCorrer() {
  if (ES.corre) { ES.corre.abort(); return; }
  ES.red = ($('#hred') || {}).value.trim(); ES.puertos = !!($('#hpto') || {}).checked;
  if (!ayListo()) { A.toast('Primero abrí y emparejá Ondi Técnico'); return; }
  ES.filas = []; ES.hechos = 0; ES.total = 0; ES.fin = null; const ac = new AbortController(); ES.corre = ac; montar(); let buf = '';
  try { await ayPost('/escanear', { red: ES.red, puertos: ES.puertos }, t => { buf += t; let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i); buf = buf.slice(i + 1); if (!ln) continue; const o = JSON.parse(ln);
      if (o.t === 'inicio') ES.total = o.total; else if (o.t === 'avance') ES.hechos = o.hechos; else if (o.t === 'equipo') ES.filas.push(o); else if (o.t === 'fin') ES.fin = `Listo: ${o.encontrados} equipos en ${dec(o.seg)} s.`; }
      montarLuego(); }, ac.signal); }
  catch (e) { ES.fin = e.name === 'AbortError' ? 'Cortado.' : /Failed to fetch|NetworkError|Load failed/.test(e.message) ? 'Se cortó la conexión con Ondi Técnico.' : e.message; }
  ES.corre = null; montar(); }
async function esAgregar(ip) {
  const st = (A.S.sites || []).find(s => s.id === ES.cli); if (!st) { A.toast('Elegí a qué cliente agregarlo'); const s = $('#hescli'); if (s) s.focus(); return; }
  const r = ES.filas.find(x => x.ip === ip); if (!r) return;
  const row = { org_id: st.org_id, site_id: st.id, marca: MARCA(r.fab + ' ' + r.web), tipo: r.tipo === 'switch' ? 'switch' : r.tipo, nombre: (r.nombre || r.web || ((r.fab && !/privada/.test(r.fab) ? r.fab.split(/[ ,]/)[0] + ' ' : '') + ip)).slice(0, 80), ip, modelo: null, notas: r.mac ? 'MAC ' + r.mac : null };
  const q = await A.SB.from('ondi_equipos').insert(row).select().single();
  if (q.error) { A.toast(A.errTxt(q.error)); return; }
  if (A.S.man && A.S.man[st.id]) A.S.man[st.id].push(q.data); if (A.S.eq) delete A.S.eq[st.id];
  ES.agregados[ES.cli + ':' + ip] = 1; A.toast('Agregado a ' + st.name + ': aparece en Equipos y en la maqueta «sin ubicar»'); montar(); }
function esCSV() {
  const L = [['IP', 'Qué es', 'Fabricante', 'Nombre', 'Página', 'MAC', 'Puertos', 'ms']].concat(ES.filas.map(r => [r.ip, TIPN[r.tipo] || '', r.fab, r.nombre, r.web, r.mac, (r.puertos || []).join(' '), r.ms == null ? '' : r.ms]));
  const b = new Blob(['﻿' + L.map(f => f.map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(';')).join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'escaneo-' + (ES.red || 'red').replace(/[^\d]+/g, '-') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/* ======================================================================
   Lienzo de plano (lo usan el predictivo de wifi y el mapa de calor)
   ====================================================================== */
const MAT = {
  yeso: { n: 'Durlock o yeso', c: '#c9a86a', a: [3, 4, 5] }, vidrio: { n: 'Vidrio', c: '#5fb3d9', a: [2, 4, 6] }, madera: { n: 'Puerta o madera', c: '#a8743f', a: [3, 5, 6] },
  ladrillo: { n: 'Ladrillo', c: '#c4593a', a: [8, 12, 15] }, bloque: { n: 'Bloque u hormigón', c: '#8b8f96', a: [12, 18, 22] }, losa: { n: 'Hormigón armado', c: '#5d6168', a: [20, 28, 35] },
  metal: { n: 'Metal, estantería o cámara de frío', c: '#3a4a6b', a: [25, 30, 35] } };
const BANDAS = { '2.4': { i: 0, pl: 40.2, can: [1, 6, 11], n: '2,4 GHz' }, '5': { i: 1, pl: 47.2, can: [36, 40, 44, 48, 149, 153, 157, 161], n: '5 GHz' }, '6': { i: 2, pl: 48.2, can: [5, 21, 37, 53, 69, 85, 101, 117], n: '6 GHz' } };
const AMB = { oficina: { n: 'Oficina', e: 3.0 }, casa: { n: 'Casa', e: 3.1 }, galpon: { n: 'Depósito o galpón', e: 2.4 }, exterior: { n: 'Exterior', e: 2.1 } };
// potencia máxima (dBm) y ganancia de antena (dBi) por banda, de las hojas de datos; aproximado
const APM = {
  u6l: { n: 'UniFi U6 Lite', p: [23, 26, 0], g: [2.8, 3, 0] }, u6p: { n: 'UniFi U6 Pro', p: [22, 26, 0], g: [4, 6, 0] }, u6m: { n: 'UniFi U6+', p: [22, 26, 0], g: [4, 5.5, 0] },
  u7p: { n: 'UniFi U7 Pro', p: [22, 26, 23], g: [4, 5.5, 5.6] }, u6x: { n: 'UniFi U6 Mesh (exterior)', p: [23, 26, 0], g: [4, 6, 0] },
  e610: { n: 'TP-Link Omada EAP610', p: [23, 23, 0], g: [4, 5, 0] }, e650: { n: 'TP-Link Omada EAP650', p: [23, 25, 0], g: [4, 5, 0] }, e670: { n: 'TP-Link Omada EAP670', p: [23, 25, 0], g: [4, 5, 0] },
  mr36: { n: 'Cisco Meraki MR36', p: [25, 25, 0], g: [4.6, 5.8, 0] }, ap22: { n: 'Aruba Instant On AP22', p: [21, 21, 0], g: [3.6, 5.4, 0] },
  ib: { n: 'Intelbras AP 3000 AX', p: [22, 24, 0], g: [3, 4, 0] }, gen: { n: 'Genérico de techo', p: [20, 23, 20], g: [3, 4, 4] } };
const POT = { alta: { n: 'Alta (máxima)', r: 0 }, media: { n: 'Media', r: 6 }, baja: { n: 'Baja', r: 12 } };
const ESC_DBM = [[-45, '#1a9641'], [-55, '#73c15b'], [-62, '#c2e57f'], [-67, '#f7f3a1'], [-72, '#fdc27a'], [-78, '#f07c4a'], [-85, '#d7191c']];
const hex2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ESC_RGB = ESC_DBM.map(([v, c]) => [v, hex2(c)]);
function colorDbm(v) { if (v >= ESC_RGB[0][0]) return ESC_RGB[0][1];
  for (let i = 1; i < ESC_RGB.length; i++) if (v >= ESC_RGB[i][0]) { const [a, ca] = ESC_RGB[i - 1], [b, cb] = ESC_RGB[i], k = (v - b) / (a - b); return [0, 1, 2].map(j => cb[j] + (ca[j] - cb[j]) * k); }
  return ESC_RGB[ESC_RGB.length - 1][1]; }
const gradCss = () => 'linear-gradient(90deg,' + ESC_DBM.slice().reverse().map(x => x[1]).join(',') + ')';

function nuevo(tipo) { return { tipo, id: null, nombre: '', site: '', fondo: null, anchoM: tipo === 'calor' ? 25 : 30, altoM: 20, paredes: [], aps: [], puntos: [], amb: 'oficina', banda: '5', modelo: 'u6l', pot: 'media', mat: 'ladrillo', herr: tipo === 'wifi' ? 'ap' : 'medir', ver: 'senal', sel: null, z: 1, ox: null, oy: null, auto: true, cambio: false }; }
const LZ = { wifi: nuevo('wifi'), calor: nuevo('calor') };
const IMG = {}; // imágenes de fondo ya decodificadas
function fondoImg(L) { const f = L.fondo; if (!f || !f.data) return null; if (IMG[f.data]) return IMG[f.data].complete ? IMG[f.data] : null;
  const im = new Image(); im.onload = () => { if (!L.fondo || L.fondo.data !== f.data) return; if (!f.w) { f.w = im.naturalWidth; f.h = im.naturalHeight; } L.altoM = L.anchoM * f.h / f.w; dibujar(L, true); }; im.src = f.data; IMG[f.data] = im; return null; }

// cuánto atenúan las paredes entre dos puntos
function cruza(ax, ay, bx, by, cx, cy, dx, dy) { const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d; return t > 0 && t < 1 && u > 0 && u < 1; }
function atenua(L, x0, y0, x1, y1, bi) { let s = 0; for (const w of L.paredes) if (cruza(x0, y0, x1, y1, w.a[0], w.a[1], w.b[0], w.b[1])) s += (MAT[w.m] || MAT.ladrillo).a[bi]; return s; }
function rssiAP(L, a, x, y) { const B = BANDAS[L.banda], m = APM[a.m] || APM.gen; if (!m.p[B.i]) return -200;
  const d = Math.max(1, Math.hypot(x - a.x, y - a.y, 1.8)); return m.p[B.i] - (POT[a.pot] || POT.media).r + m.g[B.i] - (B.pl + 10 * AMB[L.amb].e * Math.log10(d)) - atenua(L, a.x, a.y, x, y, B.i); }

// la grilla del campo (señal predicha o valores medidos)
function campo(L, cols) {
  let al = null; const W = L.anchoM, Hm = L.altoM, c = cols, r = Math.max(2, Math.round(c * Hm / W)), cw = W / c, ch = Hm / r, v = new Float32Array(c * r).fill(NaN);
  if (L.tipo === 'wifi') { if (!L.aps.length) return { c, r, v };
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) { const x = (i + .5) * cw, y = (j + .5) * ch; let b = -200; for (const a of L.aps) { const q = rssiAP(L, a, x, y); if (q > b) b = q; } v[j * c + i] = b; } }
  else { const P = L.puntos.filter(p => valor(L, p) != null); if (!P.length) return { c, r, v }; const R = clamp(W / 5, 4, 10); al = new Float32Array(c * r);
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) { const x = (i + .5) * cw, y = (j + .5) * ch; let sw = 0, sv = 0, dmin = 1e9;
      for (const p of P) { const d = Math.hypot(x - p.x, y - p.y); if (d < dmin) dmin = d; if (d > R * 1.6) continue; const w = 1 / Math.max(.25, d * d); sw += w; sv += w * valor(L, p); }
      if (dmin <= R && sw) { v[j * c + i] = sv / sw; al[j * c + i] = clamp((R - dmin) / (R * .35), 0, 1); } } }
  return { c, r, v, al }; }
function valor(L, p) { return L.ver === 'vel' ? (p.mbps == null ? null : p.mbps) : L.ver === 'lat' ? (p.ms == null ? null : p.ms) : (p.rssi == null ? null : p.rssi); }
// lo medido se pasa a la misma escala de colores que la señal
function aDbm(L, x) { if (L.ver === 'vel') { const top = Math.max(50, ...L.puntos.map(p => p.mbps || 0)); return -85 + 40 * clamp(x / top, 0, 1); } if (L.ver === 'lat') return -45 - 40 * clamp((x - 5) / 95, 0, 1); return x; }

function vista(L, cv) { const w = cv.clientWidth, h = cv.clientHeight || 300, k0 = Math.min(w / L.anchoM, h / L.altoM) * .96, k = k0 * L.z;
  if (L.ox == null || L.oy == null) { L.ox = (w - L.anchoM * k) / 2; L.oy = (h - L.altoM * k) / 2; } return { k, ox: L.ox, oy: L.oy, w, h }; }
const aPan = (V, x, y) => [x * V.k + V.ox, y * V.k + V.oy], aMundo = (V, px, py) => [(px - V.ox) / V.k, (py - V.oy) / V.k];
let rafD = 0;
function dibujar(L, recalc) { if (recalc) L._campo = null; cancelAnimationFrame(rafD); rafD = requestAnimationFrame(() => dibujarYa(L)); }
function dibujarYa(L) {
  const cv = $('#hcanvas'); if (!cv || cv.dataset.t !== L.tipo) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, Hh = Math.round(clamp(W * L.altoM / L.anchoM, 260, innerHeight * .7));
  if (cv.style.height !== Hh + 'px') cv.style.height = Hh + 'px';
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  const V = vista(L, cv), cs = getComputedStyle(document.documentElement), surf = cs.getPropertyValue('--surface').trim() || '#fff', ink = cs.getPropertyValue('--ink').trim() || '#000', mut = cs.getPropertyValue('--muted').trim();
  const [x0, y0] = aPan(V, 0, 0), pw = L.anchoM * V.k, ph = L.altoM * V.k;
  g.fillStyle = surf; g.fillRect(x0, y0, pw, ph);
  const im = fondoImg(L); if (im) { g.globalAlpha = .9; g.drawImage(im, x0, y0, pw, ph); g.globalAlpha = 1; }
  g.strokeStyle = mut; g.globalAlpha = .5; g.lineWidth = 1; g.strokeRect(x0 + .5, y0 + .5, pw - 1, ph - 1); g.globalAlpha = 1;
  // el calor
  if (!L._campo) L._campo = campo(L, L.arrastra ? 60 : clamp(Math.round(W / 5), 80, 180));
  const F = L._campo; if (F.v.some(x => !isNaN(x))) {
    const oc = document.createElement('canvas'); oc.width = F.c; oc.height = F.r; const og = oc.getContext('2d'), id = og.createImageData(F.c, F.r);
    for (let i = 0; i < F.v.length; i++) { const x = F.v[i]; if (isNaN(x)) continue; const d = L.tipo === 'wifi' ? x : aDbm(L, x), col = colorDbm(d), a = L.tipo === 'wifi' ? clamp((d + 92) / 8, 0, 1) : F.al ? F.al[i] : 1;
      id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = Math.round(a * 255); }
    og.putImageData(id, 0, 0); g.save(); g.globalAlpha = im ? .58 : .78; g.imageSmoothingEnabled = true; g.drawImage(oc, x0, y0, pw, ph); g.restore(); }
  // paredes
  g.lineCap = 'round';
  for (const w of L.paredes) { const [a1, b1] = aPan(V, ...w.a), [a2, b2] = aPan(V, ...w.b), on = L.sel && L.sel.k === 'p' && L.sel.o === w;
    g.strokeStyle = on ? cs.getPropertyValue('--accent').trim() : (MAT[w.m] || MAT.ladrillo).c; g.lineWidth = on ? 6 : 4.5; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
  if (L.trazo) { const [a1, b1] = aPan(V, ...L.trazo.a), [a2, b2] = aPan(V, ...L.trazo.b); g.setLineDash([6, 5]); g.strokeStyle = L.herr === 'escala' ? cs.getPropertyValue('--accent').trim() : (MAT[L.mat] || MAT.ladrillo).c; g.lineWidth = 3; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); g.setLineDash([]);
    const m = Math.hypot(L.trazo.b[0] - L.trazo.a[0], L.trazo.b[1] - L.trazo.a[1]); g.font = '600 12px ' + cs.getPropertyValue('--f-mono'); g.fillStyle = ink; g.fillText(dec(m) + ' m', a2 + 8, b2 - 8); }
  // access points
  const can = L.tipo === 'wifi' ? canales(L) : null;
  L.aps.forEach((a, i) => { const [px, py] = aPan(V, a.x, a.y), on = L.sel && L.sel.o === a;
    g.beginPath(); g.arc(px, py, on ? 13 : 11, 0, 7); g.fillStyle = on ? cs.getPropertyValue('--accent').trim() : '#1b2530'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 1.6; for (const r of [3.5, 6.5]) { g.beginPath(); g.arc(px, py + 3, r, -2.4, -.74); g.stroke(); } g.beginPath(); g.arc(px, py + 3, 1.3, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.font = '600 11.5px ' + cs.getPropertyValue('--f-body'); const t = (a.nom || 'AP ' + (i + 1)) + (can ? ' · c' + can[i] : ''), tw = g.measureText(t).width;
    g.fillStyle = 'rgba(20,26,33,.82)'; g.fillRect(px - tw / 2 - 5, py + 15, tw + 10, 17); g.fillStyle = '#fff'; g.fillText(t, px - tw / 2, py + 27.5); });
  // puntos medidos
  L.puntos.forEach(p => { const [px, py] = aPan(V, p.x, p.y), on = L.sel && L.sel.o === p, v = valor(L, p);
    g.beginPath(); g.arc(px, py, on ? 9 : 7, 0, 7); g.fillStyle = v == null ? '#8a96a3' : 'rgb(' + colorDbm(aDbm(L, v)).map(Math.round).join(',') + ')'; g.fill(); g.lineWidth = on ? 3 : 2; g.strokeStyle = on ? cs.getPropertyValue('--accent').trim() : '#1b2530'; g.stroke();
    if (v != null) { g.font = '600 11px ' + cs.getPropertyValue('--f-mono'); const t = L.ver === 'vel' ? dec(v, 0) + ' Mb' : L.ver === 'lat' ? dec(v, 0) + ' ms' : v + '', tw = g.measureText(t).width; g.fillStyle = 'rgba(20,26,33,.82)'; g.fillRect(px + 10, py - 9, tw + 8, 17); g.fillStyle = '#fff'; g.fillText(t, px + 14, py + 3.5); } });
  // escala
  const pasos = [1, 2, 5, 10, 20, 50], m = pasos.find(s => s * V.k > 70) || 50, bx = 12, by = Hh - 16; g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 2;
  g.beginPath(); g.moveTo(bx, by - 5); g.lineTo(bx, by); g.lineTo(bx + m * V.k, by); g.lineTo(bx + m * V.k, by - 5); g.stroke(); g.font = '600 11.5px ' + cs.getPropertyValue('--f-mono'); g.fillText(m + ' m', bx + m * V.k + 6, by + 1);
  if (!L._noLado) ladoPintar(L); L._noLado = false; }

// canales: a cada AP el que menos se pisa con los vecinos
function canales(L) { const C = BANDAS[L.banda].can, out = [];
  L.aps.forEach((a, i) => { let best = C[0], bs = 1e9; for (const c of C) { let s = 0; L.aps.slice(0, i).forEach((b, j) => { if (out[j] === c) s += Math.pow(10, rssiAP(L, b, a.x, a.y) / 10); }); if (s < bs) { bs = s; best = c; } } out.push(best); });
  return out; }
function cobertura(L) { const F = L._campo || campo(L, 80); let n = 0, b67 = 0, b75 = 0, m80 = 0; for (const x of F.v) { n++; if (isNaN(x)) { m80++; continue; } if (x >= -67) b67++; if (x >= -75) b75++; if (x < -80) m80++; } return n ? { b67: b67 / n, b75: b75 / n, m80: m80 / n } : null; }
async function sugerir(L) {
  const B = BANDAS[L.banda]; if (!(APM[L.modelo] || APM.gen).p[B.i]) { A.toast('Ese modelo no tiene ' + B.n); return; }
  const paso = clamp(L.anchoM / 18, 1.2, 4), cand = []; for (let y = paso / 2; y < L.altoM; y += paso) for (let x = paso / 2; x < L.anchoM; x += paso) cand.push([x, y]);
  const C = 44, R = Math.max(2, Math.round(C * L.altoM / L.anchoM)), cw = L.anchoM / C, ch = L.altoM / R, celdas = []; for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) celdas.push([(i + .5) * cw, (j + .5) * ch]);
  const mejor = celdas.map(([x, y]) => L.aps.reduce((b, a) => Math.max(b, rssiAP(L, a, x, y)), -200)); let puestos = 0;
  A.toast('Buscando dónde van los APs…'); await new Promise(r => setTimeout(r, 30));
  for (let it = 0; it < 30; it++) { const ok = mejor.filter(v => v >= -67).length / mejor.length; if (ok >= .95) break;
    let bi = -1, bg = 0; const nuevoAP = { m: L.modelo, pot: L.pot, x: 0, y: 0 };
    cand.forEach(([x, y], ci) => { nuevoAP.x = x; nuevoAP.y = y; let gn = 0; for (let k = 0; k < celdas.length; k++) if (mejor[k] < -67 && rssiAP(L, nuevoAP, celdas[k][0], celdas[k][1]) >= -67) gn++; if (gn > bg) { bg = gn; bi = ci; } });
    if (bi < 0 || bg < celdas.length * .01) break;
    const a = { m: L.modelo, pot: L.pot, x: cand[bi][0], y: cand[bi][1] }; L.aps.push(a); puestos++;
    celdas.forEach(([x, y], k) => { mejor[k] = Math.max(mejor[k], rssiAP(L, a, x, y)); }); await new Promise(r => setTimeout(r, 0)); }
  L.cambio = true; dibujar(L, true); montar(); A.toast(puestos ? `Ubiqué ${puestos} AP${puestos === 1 ? '' : 's'}. Movelos a donde se puedan colgar de verdad.` : 'Con lo que hay ya alcanza (o no se puede mejorar)'); }

// el panel de al lado: lo elegido, la leyenda y los números
function ladoPintar(L) { const el = $('#hlado'); if (!el) return; const s = L.sel, B = BANDAS[L.banda];
  let sel = '';
  if (s && s.k === 'a') { const a = s.o; sel = `<div class="card"><h3>${esc(a.nom || 'Access point')}</h3>
    <label class="fld">Nombre<input data-hap="nom" value="${esc(a.nom || '')}" placeholder="AP ${L.aps.indexOf(a) + 1}"></label>
    <label class="fld">Modelo<select data-hap="m">${Object.entries(APM).map(([k, m]) => `<option value="${k}" ${a.m === k ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>
    <label class="fld">Potencia<select data-hap="pot">${Object.entries(POT).map(([k, p]) => `<option value="${k}" ${a.pot === k ? 'selected' : ''}>${p.n}</option>`).join('')}</select></label>
    <button class="btn sm danger" data-h="borrasel">Sacar este AP</button></div>`; }
  else if (s && s.k === 'p') { const w = s.o; sel = `<div class="card"><h3>Pared · ${dec(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]))} m</h3>
    <label class="fld">Material<select data-hpa="m">${Object.entries(MAT).map(([k, m]) => `<option value="${k}" ${w.m === k ? 'selected' : ''}>${esc(m.n)} · ${m.a[B.i]} dB</option>`).join('')}</select></label>
    <button class="btn sm danger" data-h="borrasel">Borrar la pared</button></div>`; }
  else if (s && s.k === 'm') { const p = s.o; sel = `<div class="card"><h3>Punto medido</h3>
    <label class="fld">Señal (dBm)<input data-hpm="rssi" type="number" inputmode="numeric" min="-100" max="-20" value="${p.rssi == null ? '' : p.rssi}" placeholder="-60"></label>
    <div class="hst" style="margin-bottom:8px"><span>Velocidad</span><b>${p.mbps == null ? '—' : dec(p.mbps) + ' Mbps'}</b><span>Latencia</span><b>${p.ms == null ? '—' : dec(p.ms, 0) + ' ms'}</b>${p.ssid ? `<span>Red</span><b>${esc(p.ssid)}</b>` : ''}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${ayListo() ? '<button class="btn sm" data-h="leerw">Leer la señal de esta compu</button>' : ''}<button class="btn sm" data-h="medirv">${L.midiendo ? 'Midiendo…' : 'Medir velocidad'}</button><button class="btn sm danger" data-h="borrasel">Borrar</button></div>
    ${ayListo() ? '' : '<p class="hnota" style="margin-top:8px">La señal se lee de la compu con Ondi Técnico abierto. En el celular, copiala de una app como WiFiman: el navegador no la deja leer.</p>'}</div>`; }
  let num = '';
  if (L.tipo === 'wifi') { const c = L.aps.length ? cobertura(L) : null;
    num = `<div class="card"><h3>Cobertura estimada · ${B.n}</h3><div class="hleg" style="background:${gradCss()}"></div><div><span>-85</span><span>-67</span><span>-45 dBm</span></div>
      ${L.aps.length && !L.aps.some(a => (APM[a.m] || APM.gen).p[B.i]) ? `<p class="hnota" style="margin-top:8px"><b>Ningún AP de este plano tiene ${B.n}.</b> Elegí un modelo que la tenga (por ejemplo UniFi U7 Pro).</p>` : ''}${c ? `<div class="hst" style="margin-top:10px"><span>Buena para voz y video (≥ -67)</span><b>${Math.round(c.b67 * 100)} %</b><span>Para navegar (≥ -75)</span><b>${Math.round(c.b75 * 100)} %</b><span>Sin señal útil (&lt; -80)</span><b>${Math.round(c.m80 * 100)} %</b><span>Access points</span><b>${L.aps.length}</b></div>` : '<p class="hnota" style="margin-top:8px">Tocá el plano para poner un access point, o «Ubicar solos».</p>'}
      <p class="hnota" style="margin-top:8px">Es una estimación con potencias de hoja de datos y pérdidas típicas por pared. Sirve para planificar y cotizar; lo real se confirma con el mapa de calor medido.</p></div>`;
    if (L.aps.length) num += `<div class="card"><h3>Access points</h3><div class="hlist">${L.aps.map((a, i) => `<button data-hsel="a${i}" class="${s && s.o === a ? 'on' : ''}"><span>${esc(a.nom || 'AP ' + (i + 1))}</span><span class="muted">${esc((APM[a.m] || APM.gen).n)}</span></button>`).join('')}</div></div>`; }
  else { const P = L.puntos, vv = P.map(p => valor(L, p)).filter(x => x != null), u = L.ver === 'vel' ? ' Mbps' : L.ver === 'lat' ? ' ms' : ' dBm';
    num = `<div class="card"><h3>${L.ver === 'vel' ? 'Velocidad medida' : L.ver === 'lat' ? 'Latencia medida' : 'Señal medida'}</h3><div class="hleg" style="background:${gradCss()}"></div><div>${L.ver === 'vel' ? '<span>0</span><span>más rápido</span>' : L.ver === 'lat' ? '<span>100 ms</span><span>5 ms</span>' : '<span>-85</span><span>-67</span><span>-45 dBm</span>'}</div>
      ${vv.length ? `<div class="hst" style="margin-top:10px"><span>Puntos</span><b>${P.length}</b><span>Mejor</span><b>${dec(L.ver === 'lat' ? Math.min(...vv) : Math.max(...vv), 0)}${u}</b><span>Peor</span><b>${dec(L.ver === 'lat' ? Math.max(...vv) : Math.min(...vv), 0)}${u}</b><span>Promedio</span><b>${dec(vv.reduce((a, b) => a + b, 0) / vv.length, 0)}${u}</b></div>` : '<p class="hnota" style="margin-top:8px">Caminá el lugar y tocá en el plano dónde estás parado en cada medición.</p>'}
      <label class="hchk"><input type="checkbox" data-h="auto" ${L.auto ? 'checked' : ''}> Medir solo al tocar el plano</label>
      <p class="hnota" style="margin-top:6px">La velocidad y la latencia se miden contra el servidor de Ondi, pasando por el wifi y la salida a internet del lugar.</p></div>`; }
  el.innerHTML = sel + num; }

function lienzoHtml(L) {
  const sites = A.S.sites || [], E = EST[L.tipo];
  const herrs = L.tipo === 'wifi' ? [['mover', 'Mover'], ['ap', 'Poner AP'], ['pared', 'Dibujar pared'], ['escala', 'Medir escala'], ['borrar', 'Borrar']] : [['mover', 'Mover'], ['medir', 'Medir acá'], ['pared', 'Dibujar pared'], ['escala', 'Medir escala'], ['borrar', 'Borrar']];
  const ayuda = { mover: 'Arrastrá para mover el plano o un elemento. Rueda o dos dedos para acercar.', ap: 'Tocá donde va colgado cada access point.', pared: 'Arrastrá de punta a punta de cada pared. Se acomoda a 90° sola.', escala: 'Trazá una línea sobre algo que sepas cuánto mide (una pared, un portón).', borrar: 'Tocá lo que quieras sacar.', medir: 'Parate en un lugar, tocá en el plano dónde estás y medí.' }[L.herr];
  return `<div class="hwrap">${L.tipo === 'calor' ? ayHtml('Leer la señal sola') : ''}
    <div class="card pad"><div class="hbar">
      <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Cliente<select id="hlcli" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);max-width:200px"><option value="">Sin cliente</option>${sites.map(s => `<option value="${esc(s.id)}" ${L.site === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Estudio<select id="hlest" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);max-width:220px"><option value="">${L.id ? '' : 'Nuevo, sin guardar'}</option>${(E.lista || []).map(e => `<option value="${esc(e.id)}" ${L.id === e.id ? 'selected' : ''}>${esc(e.nombre || 'Sin nombre')}${e.site_id && !L.site ? ' · ' + esc((sites.find(s => s.id === e.site_id) || {}).name || '') : ''}</option>`).join('')}</select></label>
      <span class="grow"></span><button class="btn sm" data-h="nuevo">Nuevo</button><button class="btn sm pri" data-h="guardar">${L.cambio || !L.id ? 'Guardar' : 'Guardado'}</button><button class="btn sm" data-h="png">Bajar imagen</button></div>
      <div class="hbar" style="margin-top:10px"><span class="muted" style="font-size:13px">Plano</span>
        ${L.site ? `<button class="btn sm" data-h="plcli">Usar el plano del cliente</button>` : ''}<label class="btn sm" style="cursor:pointer">Subir imagen<input type="file" accept="image/*" id="hlimg" hidden></label>${L.fondo ? '<button class="btn sm" data-h="sinplano">Sacar el plano</button>' : ''}
        <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Ancho<input id="hlancho" type="number" min="2" max="1000" step="0.5" value="${dec(L.anchoM)}" style="width:72px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"> m</label>
        ${L.fondo ? '' : `<label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Largo<input id="hlalto" type="number" min="2" max="1000" step="0.5" value="${dec(L.altoM)}" style="width:72px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"> m</label>`}</div></div>
    <div class="hl"><div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0">
      <div class="hbar"><div class="hseg" role="group" aria-label="Herramienta">${herrs.map(([k, n]) => `<button data-hherr="${k}" aria-pressed="${L.herr === k}">${n}</button>`).join('')}</div>
        ${L.tipo === 'wifi' ? `<div class="hseg" role="group" aria-label="Banda">${['2.4', '5', '6'].map(k => [k, BANDAS[k]]).map(([k, b]) => `<button data-hband="${k}" aria-pressed="${L.banda === k}">${b.n}</button>`).join('')}</div>`
          : `<div class="hseg" role="group" aria-label="Qué mostrar">${[['senal', 'Señal'], ['vel', 'Velocidad'], ['lat', 'Latencia']].map(([k, n]) => `<button data-hver="${k}" aria-pressed="${L.ver === k}">${n}</button>`).join('')}</div>`}</div>
      <div class="hbar">${L.herr === 'pared' ? `<label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Material<select id="hlmat" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${Object.entries(MAT).map(([k, m]) => `<option value="${k}" ${L.mat === k ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>` : ''}
        ${L.tipo === 'wifi' ? `<label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Modelo<select id="hlmod" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${Object.entries(APM).map(([k, m]) => `<option value="${k}" ${L.modelo === k ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>
          <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Lugar<select id="hlamb" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${Object.entries(AMB).map(([k, a]) => `<option value="${k}" ${L.amb === k ? 'selected' : ''}>${a.n}</option>`).join('')}</select></label>
          <button class="btn sm" data-h="sugerir">Ubicar APs solos</button>` : ''}</div>
      <div class="hcv"><canvas id="hcanvas" data-t="${L.tipo}" aria-label="Plano"></canvas><div class="hzoom"><button data-hz="1.25" aria-label="Acercar">+</button><button data-hz="0.8" aria-label="Alejar">−</button><button data-hz="0" aria-label="Ver todo" style="font-size:12px">⤢</button></div></div><p class="hayu">${esc(ayuda)}</p>
      ${L.escala ? `<form class="hay" data-hf="escala"><b>Esa línea mide</b><input id="hlesc" type="number" step="0.01" min="0.1" inputmode="decimal" style="width:90px;letter-spacing:0" autofocus> <span>metros</span><button class="btn sm pri" type="submit">Ajustar la escala</button><button class="btn sm" type="button" data-h="escno">Cancelar</button></form>` : ''}
    </div><div class="hside" id="hlado"></div></div></div>`; }

// tocar y arrastrar en el plano
function lienzoEventos(L) {
  const cv = $('#hcanvas'); if (!cv) return; const P = new Map(); let dr = null, pinch = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const tocar = (V, px, py) => { const R = 16;
    for (const a of L.aps) { const [x, y] = aPan(V, a.x, a.y); if (Math.hypot(px - x, py - y) < R) return { k: 'a', o: a }; }
    for (const p of L.puntos) { const [x, y] = aPan(V, p.x, p.y); if (Math.hypot(px - x, py - y) < R) return { k: 'm', o: p }; }
    for (const w of L.paredes) { const [ax, ay] = aPan(V, ...w.a), [bx, by] = aPan(V, ...w.b), dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); if (Math.hypot(px - ax - t * dx, py - ay - t * dy) < 9) return { k: 'p', o: w }; }
    return null; };
  const iman = (L, p, desde) => { let [x, y] = p; for (const w of L.paredes) for (const q of [w.a, w.b]) if (Math.hypot(q[0] - x, q[1] - y) < .35) return [q[0], q[1]];
    if (desde) { const dx = x - desde[0], dy = y - desde[1], ang = Math.atan2(dy, dx), r = Math.hypot(dx, dy), s = Math.round(ang / (Math.PI / 2)) * Math.PI / 2; if (Math.abs(ang - s) < .1) { x = desde[0] + Math.cos(s) * r; y = desde[1] + Math.sin(s) * r; } }
    return [clamp(x, 0, L.anchoM), clamp(y, 0, L.altoM)]; };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); P.set(e.pointerId, pos(e));
    if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: L.z, ox: L.ox, oy: L.oy, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; dr = null; L.trazo = null; return; }
    const V = vista(L, cv), [px, py] = pos(e), w = aMundo(V, px, py), t = tocar(V, px, py);
    if (L.herr === 'borrar') { if (t) { borrar(L, t); } return; }
    if (L.herr === 'pared' || L.herr === 'escala') { const a = L.herr === 'pared' ? iman(L, w) : w; dr = { k: 'trazo' }; L.trazo = { a, b: a }; return; }
    if (t && (L.herr === 'mover' || L.herr === 'ap' || L.herr === 'medir') && t.k !== 'p') { L.sel = t; dr = { k: 'mueve', o: t.o, d0: [px, py], movio: false }; dibujar(L); return; }
    if (t && t.k === 'p') { L.sel = t; dibujar(L); return; }
    if (L.herr === 'ap') { const a = { m: L.modelo, pot: L.pot, x: clamp(w[0], 0, L.anchoM), y: clamp(w[1], 0, L.altoM) }; L.aps.push(a); L.sel = { k: 'a', o: a }; L.cambio = true; dibujar(L, true); return; }
    if (L.herr === 'medir') { const p = { x: clamp(w[0], 0, L.anchoM), y: clamp(w[1], 0, L.altoM), rssi: null, mbps: null, ms: null, t: Date.now() }; L.puntos.push(p); L.sel = { k: 'm', o: p }; L.cambio = true; dibujar(L, true); if (L.auto) medirPunto(L, p); return; }
    L.sel = null; dr = { k: 'pan', d0: [px, py], o0: [L.ox, L.oy] }; dibujar(L); };
  cv.onpointermove = e => { if (!P.has(e.pointerId)) return; P.set(e.pointerId, pos(e));
    if (pinch && P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), z = clamp(pinch.z * d / pinch.d, .4, 12), f = z / pinch.z; L.z = z; L.ox = pinch.c[0] - (pinch.c[0] - pinch.ox) * f; L.oy = pinch.c[1] - (pinch.c[1] - pinch.oy) * f; dibujar(L); return; }
    if (!dr) return; const V = vista(L, cv), [px, py] = pos(e), w = aMundo(V, px, py);
    if (dr.k === 'pan') { L.ox = dr.o0[0] + px - dr.d0[0]; L.oy = dr.o0[1] + py - dr.d0[1]; dibujar(L); }
    else if (dr.k === 'trazo') { L.trazo.b = L.herr === 'pared' ? iman(L, w, L.trazo.a) : w; dibujar(L); }
    else if (dr.k === 'mueve') { if (!dr.movio && Math.hypot(px - dr.d0[0], py - dr.d0[1]) < 4) return; dr.movio = true; L.arrastra = true; dr.o.x = clamp(w[0], 0, L.anchoM); dr.o.y = clamp(w[1], 0, L.altoM); L.cambio = true; dibujar(L, true); } };
  cv.onpointerup = cv.onpointercancel = e => { P.delete(e.pointerId); if (P.size < 2) pinch = null;
    if (dr && dr.k === 'trazo' && L.trazo) { const t = L.trazo, m = Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]);
      if (L.herr === 'pared') { if (m > .3) { const w = { a: t.a, b: t.b, m: L.mat }; L.paredes.push(w); L.sel = { k: 'p', o: w }; L.cambio = true; } L.trazo = null; dibujar(L, true); }
      else if (m > .2) { L.escala = m; montar(); setTimeout(() => { const i = $('#hlesc'); if (i) i.focus(); }, 30); } else { L.trazo = null; dibujar(L); } }
    if (dr && dr.k === 'mueve' && L.arrastra) { L.arrastra = false; dibujar(L, true); }
    dr = null; };
  cv.onwheel = e => { e.preventDefault(); const [px, py] = pos(e), f = Math.exp(-e.deltaY * .0015), z = clamp(L.z * f, .4, 12), k = z / L.z; L.z = z; L.ox = px - (px - L.ox) * k; L.oy = py - (py - L.oy) * k; dibujar(L); }; }
function borrar(L, t) { if (t.k === 'a') L.aps = L.aps.filter(x => x !== t.o); else if (t.k === 'p') L.paredes = L.paredes.filter(x => x !== t.o); else L.puntos = L.puntos.filter(x => x !== t.o); if (L.sel && L.sel.o === t.o) L.sel = null; L.cambio = true; dibujar(L, true); }

// medir en un punto: señal (de la compu, con el ayudante), velocidad y latencia
const GRANDE = '../../olumi/beta/3d/of-m.glb', CHICO = 'elegir.js';
async function medirVel() { const t = [];
  for (let i = 0; i < 4; i++) { const t0 = performance.now(); await fetch(CHICO + '?p=' + Math.random(), { cache: 'no-store' }).then(r => r.text()); t.push(performance.now() - t0); }
  t.sort((a, b) => a - b); const t0 = performance.now(); const bs = await Promise.all([0, 1].map(() => fetch(GRANDE + '?v=' + Math.random(), { cache: 'no-store' }).then(r => r.arrayBuffer())));
  const s = (performance.now() - t0) / 1000, bytes = bs.reduce((a, b) => a + b.byteLength, 0); return { ms: t[1], mbps: bytes * 8 / s / 1e6 }; }
async function medirPunto(L, p) {
  if (ayListo()) { try { const w = await ayWifi(); if (w.rssi != null) p.rssi = +w.rssi; if (w.ssid) p.ssid = w.ssid; } catch (e) {} }
  L.midiendo = true; dibujar(L, true);
  try { const r = await medirVel(); p.mbps = Math.round(r.mbps * 10) / 10; p.ms = Math.round(r.ms); } catch (e) { A.toast('No se pudo medir la velocidad: ¿hay conexión?'); }
  L.midiendo = false; L.cambio = true; dibujar(L, true); }

// guardar y abrir estudios
const EST = { wifi: { lista: null }, calor: { lista: null } };
const faltaTabla = e => /ondi_estudios|relation .* does not exist|schema cache/i.test((e && (e.message || e.details)) || '');
async function estListar(tipo) { const r = await A.SB.from('ondi_estudios').select('id,nombre,site_id,updated_at').eq('org_id', A.orgId()).eq('tipo', tipo).order('updated_at', { ascending: false }).limit(200);
  EST[tipo].lista = r.error ? [] : r.data; EST[tipo].falta = r.error && faltaTabla(r.error); montar(); }
function aDatos(L) { return { fondo: L.fondo && L.fondo.src === 'img' ? L.fondo : L.fondo ? { src: L.fondo.src, w: L.fondo.w, h: L.fondo.h } : null, anchoM: L.anchoM, altoM: L.altoM, paredes: L.paredes, aps: L.aps, puntos: L.puntos, amb: L.amb, banda: L.banda }; }
async function estGuardar(L) {
  if (EST[L.tipo].falta) { A.toast('Falta preparar la base para guardar estudios (ondi-1.4.sql)'); return; }
  if (!L.nombre) { const s = (A.S.sites || []).find(x => x.id === L.site); L.nombre = (L.tipo === 'wifi' ? 'Wifi' : 'Medición') + (s ? ' · ' + s.name : '') + ' · ' + new Date().toLocaleDateString('es-UY'); }
  const row = { org_id: A.orgId(), site_id: L.site || null, tipo: L.tipo, nombre: L.nombre, data: aDatos(L), updated_at: new Date().toISOString() };
  const r = L.id ? await A.SB.from('ondi_estudios').update(row).eq('org_id', A.orgId()).eq('id', L.id).select('id').single() : await A.SB.from('ondi_estudios').insert(row).select('id').single();
  if (r.error) { A.toast(faltaTabla(r.error) ? 'Falta preparar la base para guardar estudios (ondi-1.4.sql)' : A.errTxt(r.error)); return; }
  L.id = r.data.id; L.cambio = false; A.toast('Estudio guardado'); estListar(L.tipo); }
async function estAbrir(tipo, id) { const r = await A.SB.from('ondi_estudios').select('*').eq('org_id', A.orgId()).eq('id', id).single(); if (r.error) { A.toast(r.error.message); return; }
  const d = r.data.data || {}, L = Object.assign(nuevo(tipo), d, { id: r.data.id, nombre: r.data.nombre, site: r.data.site_id || '', herr: 'mover' }); LZ[tipo] = L;
  if (L.fondo && L.fondo.src === 'plano' && L.site) await planoCliente(L); montar(); }
async function planoCliente(L) { const st = (A.S.sites || []).find(s => s.id === L.site); if (!st) return;
  const r = await A.SB.from('ondi_planos').select('data').eq('org_id', st.org_id).eq('site_id', st.id).maybeSingle();
  if (!r.data || !r.data.data) { A.toast('Ese cliente todavía no tiene plano cargado'); return; }
  L.fondo = { src: 'plano', data: r.data.data, w: 0, h: 0 }; L.z = 1; L.ox = L.oy = null; L.cambio = true; }
function subirImagen(L, f) { if (!f) return; const rd = new FileReader();
  rd.onload = () => { const im = new Image(); im.onload = () => { const m = 1800, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); L.fondo = { src: 'img', data: c.toDataURL('image/jpeg', .82), w: c.width, h: c.height }; L.altoM = L.anchoM * c.height / c.width; L.z = 1; L.ox = L.oy = null; L.cambio = true; montar(); A.toast('Ahora trazá una línea sobre algo que sepas cuánto mide: «Medir escala»'); L.herr = 'escala'; montar(); };
    im.onerror = () => A.toast('No pude abrir esa imagen'); im.src = rd.result; }; rd.readAsDataURL(f); }
function bajarPng(L) { const cv = $('#hcanvas'); if (!cv) return; cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (L.nombre || (L.tipo === 'wifi' ? 'wifi-predictivo' : 'mapa-de-calor')).replace(/[^\w\-áéíóúñ ]+/gi, '').trim().replace(/\s+/g, '-') + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); }

/* ======================================================================
   Simulador de cámaras
   ====================================================================== */
// ángulo horizontal típico de hoja de datos según la lente (cámaras 16:9); entre medio se interpola
const LENTE = [[2, 125], [2.7, 108], [2.8, 103], [3.6, 87], [4, 84], [6, 54], [8, 39], [12, 27], [13.5, 24]];
function hfov(f) { if (f <= LENTE[0][0]) return LENTE[0][1]; for (let i = 1; i < LENTE.length; i++) if (f <= LENTE[i][0]) { const [a, va] = LENTE[i - 1], [b, vb] = LENTE[i]; return va + (vb - va) * (f - a) / (b - a); } return LENTE[LENTE.length - 1][1] * LENTE[LENTE.length - 1][0] / f; }
const RES = { 2: [1920, 1080], 4: [2560, 1440], 5: [2880, 1620], 8: [3840, 2160] };
const CAMS = {
  hikvision: { n: 'Hikvision', m: [
    ['DS-2CD1043G2-I', 'Bala', 4, [2.8, 4], 30, 'ir'], ['DS-2CD1143G2-I', 'Domo', 4, [2.8, 4], 30, 'ir'], ['DS-2CD2043G2-I', 'Bala AcuSense', 4, [2.8, 4, 6], 40, 'ir'],
    ['DS-2CD2143G2-I', 'Domo AcuSense', 4, [2.8, 4], 30, 'ir'], ['DS-2CD2047G2-L', 'Bala ColorVu', 4, [2.8, 4], 40, 'color'], ['DS-2CD2087G2-LU', 'Bala ColorVu 8 MP', 8, [2.8, 4], 40, 'color'],
    ['DS-2CD2643G2-IZS', 'Bala varifocal', 4, [2.8, 12, 'v'], 60, 'ir'], ['DS-2CD2683G2-IZS', 'Bala varifocal 8 MP', 8, [2.8, 12, 'v'], 60, 'ir']] },
  dahua: { n: 'Dahua', m: [
    ['IPC-HFW1230S', 'Bala', 2, [2.8, 3.6], 30, 'ir'], ['IPC-HDW1230T1', 'Domo', 2, [2.8, 3.6], 30, 'ir'], ['IPC-HFW2441S-S', 'Bala WizSense', 4, [2.8, 3.6], 30, 'ir'],
    ['IPC-HDW2441T-S', 'Domo WizSense', 4, [2.8, 3.6], 30, 'ir'], ['IPC-HFW2849S-S-IL', 'Bala luz dual 8 MP', 8, [2.8, 3.6], 30, 'color'], ['IPC-HFW2441T-ZS', 'Bala varifocal', 4, [2.7, 13.5, 'v'], 60, 'ir']] },
  intelbras: { n: 'Intelbras', m: [
    ['VIP 1230 B G4', 'Bala', 2, [3.6], 30, 'ir'], ['VIP 1230 D G4', 'Domo', 2, [2.8], 30, 'ir'], ['VIP 3430 B', 'Bala', 4, [2.8, 3.6], 30, 'ir'],
    ['VIP 3430 D', 'Domo', 4, [2.8], 30, 'ir'], ['VIP 5450 Z', 'Bala varifocal', 4, [2.7, 13.5, 'v'], 50, 'ir']] },
  gen: { n: 'Genérica', m: [['Genérica', 'Elegís megapíxeles y lente', 0, [2.8, 3.6, 4, 6, 8, 12], 30, 'ir']] } };
const DORI = [['Identificar', 250, '#1a9641', 'se reconoce la cara de un desconocido o se lee una patente'], ['Reconocer', 125, '#a6d96a', 'se sabe si es alguien conocido'], ['Observar', 62, '#fdae61', 'se ve ropa, color y qué está haciendo'], ['Detectar', 25, '#d7191c', 'se nota que hay una persona o un vehículo']];
const CA = { lista: [{ marca: 'hikvision', mi: 2, f: 2.8, mp: 4, alt: 3, dist: 8, luz: 'dia' }], comparar: false };
function camInfo(c) { const M = CAMS[c.marca].m[c.mi], gen = c.marca === 'gen', mp = gen ? c.mp : M[2], [W, H] = RES[mp] || RES[4], hf = hfov(c.f), h = hf * Math.PI / 180;
  const vf = 2 * Math.atan(Math.tan(h / 2) * H / W), ppm = d => W / (2 * d * Math.tan(h / 2)), slant = Math.hypot(c.dist, Math.max(0, c.alt - 1.6));
  const tilt = Math.atan2(Math.max(0, c.alt - 1.1), Math.max(.5, c.dist)), ciego = tilt + vf / 2 >= Math.PI / 2 ? 0 : c.alt / Math.tan(tilt + vf / 2);
  return { M, mp, W, H, hf, vf: vf * 180 / Math.PI, ppm: ppm(slant), slant, dori: DORI.map(d => W / (2 * Math.tan(h / 2) * d[1])), ancho: 2 * slant * Math.tan(h / 2), ciego, ir: M[4], luz: M[5] }; }
function camCfgHtml(c, i) { const M = CAMS[c.marca].m[c.mi], L = M[3], vari = L[2] === 'v';
  return `<div class="hcfg" data-hcam="${i}">
    <label>Marca<select data-cc="marca">${Object.entries(CAMS).map(([k, m]) => `<option value="${k}" ${c.marca === k ? 'selected' : ''}>${m.n}</option>`).join('')}</select></label>
    <label>Modelo<select data-cc="mi">${CAMS[c.marca].m.map((m, j) => `<option value="${j}" ${c.mi === j ? 'selected' : ''}>${esc(m[0])}${m[2] ? ' · ' + m[2] + ' MP' : ''}</option>`).join('')}</select></label>
    ${c.marca === 'gen' ? `<label>Resolución<select data-cc="mp">${[2, 4, 5, 8].map(m => `<option value="${m}" ${c.mp === m ? 'selected' : ''}>${m} MP</option>`).join('')}</select></label>` : ''}
    <label>Lente${vari ? ` · ${dec(c.f)} mm` : ''}${vari ? `<input data-cc="f" type="range" min="${L[0]}" max="${L[1]}" step="0.1" value="${c.f}">` : `<select data-cc="f">${L.map(f => `<option value="${f}" ${+c.f === f ? 'selected' : ''}>${dec(f)} mm</option>`).join('')}</select>`}</label>
    <label>Altura de la cámara · ${dec(c.alt)} m<input data-cc="alt" type="range" min="2" max="12" step="0.1" value="${c.alt}"></label>
    <label>Distancia a la persona · ${dec(c.dist)} m<input data-cc="dist" type="range" min="1" max="80" step="0.5" value="${c.dist}"></label>
    <label>Momento<select data-cc="luz"><option value="dia" ${c.luz === 'dia' ? 'selected' : ''}>De día</option><option value="noche" ${c.luz === 'noche' ? 'selected' : ''}>De noche</option></select></label></div>`; }
function camHtml() { const n = CA.comparar ? 2 : 1; if (CA.lista.length < n) CA.lista.push(Object.assign({}, CA.lista[0], { marca: 'dahua', mi: 2, f: 2.8 }));
  return `<div class="hwrap"><div class="hbar"><p class="hnota" style="flex:1;min-width:220px">Elegí la cámara, la lente y dónde va: se ve lo que alcanza a distinguir a cada distancia. Los ángulos son los típicos de hoja de datos; antes de cotizar confirmá con la del modelo exacto.</p>
    <button class="btn sm${CA.comparar ? ' pri' : ''}" data-h="camcmp" aria-pressed="${CA.comparar}">${CA.comparar ? 'Dejar de comparar' : 'Comparar con otra cámara'}</button></div>
    <div class="${CA.comparar ? 'hcam' : ''}" style="display:grid;grid-template-columns:minmax(0,1fr);gap:16px">${CA.lista.slice(0, n).map((c, i) => `<div class="card pad" style="display:grid;grid-template-columns:minmax(0,1fr);gap:14px;min-width:0">${camCfgHtml(c, i)}<div id="hcres${i}"></div></div>`).join('')}</div></div>`; }
function camPintar(i) { const c = CA.lista[i], el = $('#hcres' + i); if (!el) return; const I = camInfo(c), noche = c.luz === 'noche', fuera = noche && I.slant > I.ir;
  const nivel = DORI.find(d => I.ppm >= d[1]), m = (v, n = 1) => v >= 100 ? dec(v, 0) : dec(v, n);
  el.innerHTML = `<div class="hver"><canvas id="hcv${i}" width="960" height="540"></canvas><span class="hlab">${m(I.ppm, 0)} px/m a ${m(I.slant)} m</span><div class="hzi"><canvas id="hcz${i}" width="300" height="360"></canvas></div></div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">
      <div><b style="font-size:15px">${fuera ? 'Fuera del alcance de la luz' : nivel ? esc(nivel[0]) : 'No se distingue'}</b><p class="hnota" style="margin-top:2px">${fuera ? `De noche ${I.luz === 'color' ? 'la luz blanca' : 'el infrarrojo'} llega a unos ${I.ir} m; la persona está a ${m(I.slant)} m.` : nivel ? `A ${m(I.slant)} m ${esc(nivel[3])}.` : `A ${m(I.slant)} m la persona ocupa muy pocos píxeles.`}</p>
        <div class="hst" style="margin-top:8px"><span>Ángulo</span><b>${dec(I.hf, 0)}° × ${dec(I.vf, 0)}°</b><span>Ancho que cubre a esa distancia</span><b>${m(I.ancho)} m</b><span>Resolución</span><b>${I.W} × ${I.H}</b><span>Debajo de la cámara no se ve</span><b>${I.ciego < .2 ? '—' : 'hasta ' + m(I.ciego) + ' m'}</b><span>${I.luz === 'color' ? 'Luz blanca' : 'Infrarrojo'}</span><b>${I.ir} m</b></div></div>
      <div><b style="font-size:13px" class="muted">Hasta dónde alcanza (norma IEC 62676-4)</b><div class="hdori" style="margin-top:6px">${DORI.map((d, j) => `<div><i style="background:${d[2]}"></i><span>${d[0]}</span><b>${m(I.dori[j])} m</b></div>`).join('')}</div></div></div>
    <div class="hsvg">${camPlanta(I, c)}</div>`;
  camEscena(i, c, I); }
function camPlanta(I, c) { // vista de arriba: el abanico de la cámara con los rangos de distancia
  const R = Math.max(I.dori[2] * 1.3, c.dist * 1.25), W = 600, Hh = 200, k = (W - 50) / R, cx = 24, cy = Hh / 2, h = I.hf * Math.PI / 360;
  const arco = (r, col, op) => { const x = cx + r * k * Math.cos(h), y1 = cy - r * k * Math.sin(h), y2 = cy + r * k * Math.sin(h); return `<path d="M${cx} ${cy}L${x} ${y1}A${r * k} ${r * k} 0 0 1 ${x} ${y2}Z" fill="${col}" fill-opacity="${op}"/>`; };
  const clip = `<clipPath id="hcc"><rect x="0" y="0" width="${W}" height="${Hh}"/></clipPath>`;
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Vista de arriba de lo que cubre la cámara"><defs>${clip}</defs><g clip-path="url(#hcc)">${DORI.slice().reverse().map((d, j) => arco(I.dori[3 - j], d[2], j === 0 ? .18 : .4)).join('')}
    ${c.luz === 'noche' ? `<circle cx="${cx}" cy="${cy}" r="${I.ir * k}" fill="none" stroke="currentColor" stroke-dasharray="5 5" opacity=".6"/>` : ''}
    ${I.ciego > .2 ? `<rect x="${cx}" y="${cy - 30}" width="${I.ciego * k}" height="60" fill="currentColor" opacity=".12"/>` : ''}
    <g transform="translate(${cx + c.dist * k} ${cy})"><circle r="6" fill="currentColor"/><text x="0" y="-12" text-anchor="middle" font-size="12" fill="currentColor">${dec(c.dist)} m</text></g>
    <rect x="${cx - 12}" y="${cy - 6}" width="16" height="12" rx="2" fill="currentColor"/></g>
    <g font-size="11" fill="currentColor" opacity=".75">${[0, 1, 2, 3].map(j => { const x = cx + I.dori[j] * k; return x < W - 10 ? `<line x1="${x}" x2="${x}" y1="${Hh - 18}" y2="${Hh - 12}" stroke="currentColor"/><text x="${x}" y="${Hh - 2}" text-anchor="middle">${dec(I.dori[j], 0)}</text>` : ''; }).join('')}</g></svg>`; }

// la imagen simulada: la escena se dibuja con la cantidad de píxeles reales que tendría la cámara
function persona(g, x, y, h, noche) { const u = h / 175; // y = pies
  g.save(); g.translate(x, y); g.scale(u, u);
  g.fillStyle = noche ? '#3a3a3a' : '#2b3442'; g.fillRect(-16, -88, 13, 88); g.fillRect(3, -88, 13, 88); // piernas
  g.fillStyle = noche ? '#111' : '#151515'; g.fillRect(-18, -6, 17, 6); g.fillRect(1, -6, 17, 6);
  g.fillStyle = noche ? '#8a8a8a' : '#c23b2a'; g.beginPath(); g.roundRect(-24, -150, 48, 66, 8); g.fill(); // remera
  g.fillStyle = noche ? '#ddd' : '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('ONDI', 0, -128);
  g.fillStyle = noche ? '#9a9a9a' : '#d9a37e'; g.fillRect(-31, -146, 8, 50); g.fillRect(23, -146, 8, 50); g.fillRect(-5, -158, 10, 9); // brazos, cuello
  g.beginPath(); g.ellipse(0, -169, 11.5, 14, 0, 0, 7); g.fill(); // cabeza
  g.fillStyle = noche ? '#222' : '#2a1d14'; g.beginPath(); g.ellipse(0, -177, 12, 8, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(-4.5, -170, 1.5, 0, 7); g.arc(4.5, -170, 1.5, 0, 7); g.fill(); g.fillRect(-1, -167, 2, 4);
  g.fillStyle = noche ? '#555' : '#8c3b2e'; g.fillRect(-4, -161.5, 8, 1.6);
  g.restore(); }
function auto(g, x, y, l, noche) { const u = l / 420; g.save(); g.translate(x, y); g.scale(u, u);
  g.fillStyle = noche ? '#bbb' : '#dfe3e8'; g.beginPath(); g.roundRect(-210, -110, 420, 80, 18); g.fill(); g.beginPath(); g.roundRect(-140, -150, 260, 50, 16); g.fill();
  g.fillStyle = noche ? '#333' : '#5a7487'; g.fillRect(-128, -142, 112, 36); g.fillRect(-6, -142, 116, 36);
  g.fillStyle = '#111'; for (const wx of [-130, 130]) { g.beginPath(); g.arc(wx, -28, 34, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.fillRect(150, -80, 52, 16); g.strokeStyle = '#1a3f9e'; g.lineWidth = 2; g.strokeRect(150, -80, 52, 16); g.fillStyle = '#111'; g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.fillText('SBC 1234', 176, -68);
  g.restore(); }
function escena(g, Wc, Hc, pxm, noche, ox, oy) { // dibuja la toma (Wc × Hc a pxm píxeles por metro); ox, oy: recorte
  g.save(); g.translate(-ox, -oy); const horizonte = Hc * .42, piso = Hc * .78;
  const cielo = g.createLinearGradient(0, 0, 0, horizonte); cielo.addColorStop(0, noche ? '#0b0f16' : '#9cc6e8'); cielo.addColorStop(1, noche ? '#1b2230' : '#dfeaf2'); g.fillStyle = cielo; g.fillRect(0, 0, Wc, horizonte);
  g.fillStyle = noche ? '#2a2d33' : '#b9b3a6'; g.fillRect(0, horizonte, Wc, Hc - horizonte);
  const pared = g.createLinearGradient(0, horizonte - 6 * pxm, 0, horizonte); pared.addColorStop(0, noche ? '#20252d' : '#c9ced4'); pared.addColorStop(1, noche ? '#2b3038' : '#dde1e5'); g.fillStyle = pared; g.fillRect(0, horizonte - 6 * pxm, Wc, 6 * pxm);
  g.fillStyle = noche ? '#14181e' : '#5c6670'; g.fillRect(Wc / 2 - 7 * pxm, horizonte - 4.2 * pxm, 4 * pxm, 4.2 * pxm); // portón
  g.fillStyle = noche ? '#3b3020' : '#e1b23a'; g.fillRect(0, horizonte + .2 * pxm, Wc, .12 * pxm); // línea amarilla de la vereda
  auto(g, Wc / 2 + 2.6 * pxm, piso + .1 * pxm, 4.2 * pxm, noche); persona(g, Wc / 2, piso, 1.75 * pxm, noche); g.restore(); }
function sensor(cv, I, noche, fuera) { // lo que agrega la cámara: blanco y negro con infrarrojo, ruido y la luz que no llega
  const g = cv.getContext('2d'), id = g.getImageData(0, 0, cv.width, cv.height), D = id.data, color = !noche || I.luz === 'color', ruido = noche ? (I.luz === 'color' ? 16 : 22) : 5, osc = fuera ? .18 : 1;
  for (let p = 0; p < D.length; p += 4) { let r = D[p], gg = D[p + 1], b = D[p + 2]; if (!color) { const y = .3 * r + .59 * gg + .11 * b; r = gg = b = y * 1.05; }
    const n = (Math.random() - .5) * ruido; D[p] = clamp(r * osc + n, 0, 255); D[p + 1] = clamp(gg * osc + n, 0, 255); D[p + 2] = clamp(b * osc + n, 0, 255); }
  g.putImageData(id, 0, 0); }
function camEscena(i, c, I) {
  const cv = $('#hcv' + i), cz = $('#hcz' + i); if (!cv || !cz) return; const noche = c.luz === 'noche', fuera = noche && I.slant > I.ir;
  // la toma entera (se muestra achicada, así que alcanza con hasta 1920 de ancho)
  const sc = Math.min(1, 1920 / I.W), Wc = Math.round(I.W * sc), Hc = Math.round(I.H * sc), oc = document.createElement('canvas'); oc.width = Wc; oc.height = Hc;
  escena(oc.getContext('2d'), Wc, Hc, I.ppm * sc, noche, 0, 0); sensor(oc, I, noche, fuera);
  const v = cv.getContext('2d'); v.imageSmoothingEnabled = true; v.imageSmoothingQuality = 'high'; v.drawImage(oc, 0, 0, cv.width, cv.height);
  // el zoom digital a la persona, con los píxeles que de verdad tiene la cámara
  const p = I.ppm, zw = 1.3 * p, zh = zw * cz.height / cz.width, zx = I.W / 2 - zw / 2, zy = I.H * .78 - 1.95 * p, zc = document.createElement('canvas');
  zc.width = Math.max(2, Math.ceil(zw)); zc.height = Math.max(2, Math.ceil(zh)); escena(zc.getContext('2d'), I.W, I.H, p, noche, zx, zy); sensor(zc, I, noche, fuera);
  const z = cz.getContext('2d'); z.imageSmoothingEnabled = true; z.drawImage(zc, 0, 0, zw, zh, 0, 0, cz.width, cz.height);
  const k = cv.width / I.W; v.strokeStyle = '#fff'; v.lineWidth = 2; v.strokeRect(zx * k, zy * k, zw * k, zh * k); }

/* ======================================================================
   Montaje y eventos
   ====================================================================== */
let actual = null, ultimoBox = null, A = { S: { sites: [] }, toast: m => console.log(m), errTxt: e => e.message, render() {}, orgId: () => '', SB: null };
function montar(app) { if (app) A = app;
  const box = $('#herbox'); if (!box) return; const t = box.dataset.h; actual = t;
  if ((t === 'consola' || t === 'escaneo' || t === 'calor') && AY.est === undefined) ayHola().then(() => montar());
  if ((t === 'wifi' || t === 'calor') && EST[t].lista === null && A.SB) { EST[t].lista = []; estListar(t); }
  const ae = document.activeElement, foco = ae && box.contains(ae) && ae.id ? [ae.id, ae.selectionStart, ae.selectionEnd] : null;
  box.innerHTML = t === 'consola' ? consolaHtml() : t === 'escaneo' ? escaneoHtml() : t === 'wifi' || t === 'calor' ? lienzoHtml(LZ[t]) : t === 'camaras' ? camHtml() : '';
  if (t === 'consola') coPintar();
  if (t === 'wifi' || t === 'calor') { lienzoEventos(LZ[t]); dibujar(LZ[t], true); }
  if (t === 'camaras') CA.lista.slice(0, CA.comparar ? 2 : 1).forEach((_, i) => camPintar(i));
  if (foco) { const e = document.getElementById(foco[0]); if (e) { e.focus(); try { if (foco[1] != null) e.setSelectionRange(foco[1], foco[2]); } catch (_) {} } }
  if (box !== ultimoBox) { ultimoBox = box; enganchar(box); } }
let tml = 0; function montarLuego() { clearTimeout(tml); tml = setTimeout(montar, 120); }

function enganchar(box) {
  box.addEventListener('click', async e => { const b = e.target.closest('[data-h],[data-hc],[data-hherr],[data-hband],[data-hver],[data-hz],[data-hsel],[data-hping],[data-hadd]'); if (!b || !box.contains(b)) return; const L = LZ[actual];
    if (b.dataset.hc) { const i = $('#hcmd'); if (i) { i.value = b.dataset.hc; i.focus(); } return; }
    if (b.dataset.hping) { A.S.itab = 'consola'; A.render(); setTimeout(() => coCorrer('ping ' + b.dataset.hping), 50); return; }
    if (b.dataset.hadd) { esAgregar(b.dataset.hadd); return; }
    if (b.dataset.hherr) { L.herr = b.dataset.hherr; L.trazo = null; L.escala = null; montar(); return; }
    if (b.dataset.hband) { L.banda = b.dataset.hband; L.cambio = true; montar(); return; }
    if (b.dataset.hver) { L.ver = b.dataset.hver; montar(); return; }
    if (b.dataset.hsel) { const i = +b.dataset.hsel.slice(1); L.sel = { k: 'a', o: L.aps[i] }; dibujar(L); return; }
    if (b.dataset.hz) { const f = +b.dataset.hz, cv = $('#hcanvas'); if (!f) { L.z = 1; L.ox = L.oy = null; } else { const cx = cv.clientWidth / 2, cy = cv.clientHeight / 2, z = clamp(L.z * f, .4, 12), k = z / L.z; L.z = z; L.ox = cx - (cx - L.ox) * k; L.oy = cy - (cy - L.oy) * k; } dibujar(L); return; }
    const h = b.dataset.h;
    if (h === 'ayre') { AY.est = undefined; montar(); return; }
    if (h === 'ayoff') { AY.cod = ''; ls.set('ondi.tec.cod', ''); AY.est = Object.assign({}, AY.est, { emparejado: false }); montar(); return; }
    if (h === 'escsv') { esCSV(); return; }
    if (h === 'camcmp') { CA.comparar = !CA.comparar; montar(); return; }
    if (!L) return;
    if (h === 'borrasel' && L.sel) { borrar(L, L.sel); return; }
    if (h === 'sugerir') { sugerir(L); return; }
    if (h === 'nuevo') { const s = L.site; LZ[actual] = Object.assign(nuevo(actual), { site: s }); montar(); return; }
    if (h === 'guardar') { estGuardar(L); return; }
    if (h === 'png') { bajarPng(L); return; }
    if (h === 'plcli') { await planoCliente(L); montar(); return; }
    if (h === 'sinplano') { L.fondo = null; L.cambio = true; montar(); return; }
    if (h === 'escno') { L.escala = null; L.trazo = null; montar(); return; }
    if (h === 'leerw' && L.sel) { try { const w = await ayWifi(); if (w.rssi == null) { A.toast('Esta compu no está por wifi o no se pudo leer'); return; } L.sel.o.rssi = +w.rssi; L.sel.o.ssid = w.ssid; L.cambio = true; dibujar(L, true); } catch (er) { A.toast('No respondió Ondi Técnico'); } return; }
    if (h === 'medirv' && L.sel && !L.midiendo) { const p = L.sel.o; L.midiendo = true; ladoPintar(L); try { const r = await medirVel(); p.mbps = Math.round(r.mbps * 10) / 10; p.ms = Math.round(r.ms); } catch (er) { A.toast('No se pudo medir: ¿hay conexión?'); } L.midiendo = false; L.cambio = true; dibujar(L, true); return; }
  });
  box.addEventListener('submit', async e => { const f = e.target.closest('[data-hf]'); if (!f) return; e.preventDefault(); const k = f.dataset.hf;
    if (k === 'cmd') { const i = $('#hcmd'); if (CO.corre) { CO.corre.abort(); return; } const v = i.value; i.value = ''; coCorrer(v); return; }
    if (k === 'aycod') { const v = ($('#aycod').value || '').replace(/\D/g, ''); if (v.length !== 6) { A.toast('Son 6 números'); return; } AY.cod = v; ls.set('ondi.tec.cod', v); await ayHola(); if (!AY.est || !AY.est.emparejado) A.toast('Ese código no coincide con el de la ventana de Ondi Técnico'); montar(); return; }
    if (k === 'scan') { esCorrer(); return; }
    if (k === 'escala') { const L = LZ[actual], v = parseFloat(String($('#hlesc').value).replace(',', '.')); if (!(v > 0) || !L.escala) return; const f2 = v / L.escala;
      L.anchoM *= f2; L.altoM *= f2; const sc = q => { q.x *= f2; q.y *= f2; }; L.aps.forEach(sc); L.puntos.forEach(sc); L.paredes.forEach(w => { w.a = [w.a[0] * f2, w.a[1] * f2]; w.b = [w.b[0] * f2, w.b[1] * f2]; });
      L.escala = null; L.trazo = null; L.herr = L.tipo === 'wifi' ? 'pared' : 'medir'; L.cambio = true; L.z = 1; L.ox = L.oy = null; montar(); A.toast(`Listo: el plano mide ${dec(L.anchoM)} × ${dec(L.altoM)} m`); } });
  box.addEventListener('keydown', e => { if (e.target.id !== 'hcmd') return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); CO.hi = clamp(CO.hi + (e.key === 'ArrowUp' ? 1 : -1), -1, CO.hist.length - 1); e.target.value = CO.hi < 0 ? '' : CO.hist[CO.hi]; }
    else if (e.key === 'c' && e.ctrlKey && CO.corre) { e.preventDefault(); CO.corre.abort(); } });
  box.addEventListener('input', e => { const t = e.target, L = LZ[actual];
    if (t.id === 'hesq') { ES.q = t.value; montarLuego(); return; }
    if (t.dataset.cc) { const w = t.closest('[data-hcam]'), i = +w.dataset.hcam, c = CA.lista[i], k = t.dataset.cc; if (t.type === 'range') { c[k] = +t.value; const lab = t.parentElement; lab.firstChild.textContent = { alt: 'Altura de la cámara · ', dist: 'Distancia a la persona · ', f: 'Lente · ' }[k] + dec(c[k]) + (k === 'f' ? ' mm' : ' m'); camPintar(i); } return; }
    if (!L) return;
    if (t.dataset.hap) { L.sel.o[t.dataset.hap] = t.value; L.cambio = true; dibujarSinLado(L); return; }
    if (t.dataset.hpm) { const v = parseFloat(t.value); L.sel.o.rssi = isNaN(v) ? null : clamp(Math.round(v), -100, -20); L.cambio = true; dibujarSinLado(L); return; } });
  box.addEventListener('change', e => { const t = e.target, L = LZ[actual];
    if (t.id === 'hescli') { ES.cli = t.value; montar(); return; }
    if (t.dataset.cc) { const w = t.closest('[data-hcam]'), i = +w.dataset.hcam, c = CA.lista[i], k = t.dataset.cc;
      if (k === 'marca') { c.marca = t.value; c.mi = 0; const L2 = CAMS[c.marca].m[0][3]; c.f = L2[0]; } else if (k === 'mi') { c.mi = +t.value; const L2 = CAMS[c.marca].m[c.mi][3]; if (L2[2] === 'v' ? c.f < L2[0] || c.f > L2[1] : !L2.includes(+c.f)) c.f = L2[0]; } else if (k === 'luz') c.luz = t.value; else c[k] = +t.value;
      montar(); return; }
    if (!L) return;
    if (t.id === 'hlcli') { L.site = t.value; L.cambio = true; montar(); return; }
    if (t.id === 'hlest') { if (t.value) estAbrir(actual, t.value); return; }
    if (t.id === 'hlimg') { subirImagen(L, t.files[0]); return; }
    if (t.id === 'hlancho' || t.id === 'hlalto') { const v = parseFloat(String(t.value).replace(',', '.')); if (!(v >= 2)) return; const f2 = t.id === 'hlancho' ? v / L.anchoM : 1;
      if (t.id === 'hlancho') { L.anchoM = v; if (L.fondo && L.fondo.w) L.altoM = v * L.fondo.h / L.fondo.w; else L.altoM *= 1; } else L.altoM = v;
      if (f2 !== 1 && L.fondo) { const sc = q => { q.x *= f2; q.y *= f2; }; L.aps.forEach(sc); L.puntos.forEach(sc); L.paredes.forEach(w => { w.a = [w.a[0] * f2, w.a[1] * f2]; w.b = [w.b[0] * f2, w.b[1] * f2]; }); }
      L.cambio = true; L.z = 1; L.ox = L.oy = null; dibujar(L, true); return; }
    if (t.id === 'hlmat') { L.mat = t.value; return; }
    if (t.id === 'hlmod') { L.modelo = t.value; return; }
    if (t.id === 'hlamb') { L.amb = t.value; L.cambio = true; dibujar(L, true); return; }
    if (t.dataset.hpa) { L.sel.o.m = t.value; L.cambio = true; dibujar(L, true); return; }
    if (t.dataset.h === 'auto') { L.auto = t.checked; return; } });
}
addEventListener('resize', () => { const L = LZ[actual]; if (L && $('#hcanvas')) dibujar(L); });
// al escribir en el panel no se rearma el panel (si no, se pierde lo que se está escribiendo)
function dibujarSinLado(L) { L._noLado = true; dibujar(L, true); }

window.OndiHerr = { montar, ver: 1 };
})();

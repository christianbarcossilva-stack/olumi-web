/* Ondi · Integraciones: herramientas para técnicos y gerentes de IT.
   Escaneo de red (con Ondi Scanner en la laptop), mapa de calor medido,
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
.hver .hcarga{display:none}.hver.cargando .hcarga{display:grid;place-content:center;position:absolute;inset:0;color:#fff;font-size:14px;background:#0e1418;z-index:2}
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
   Ondi Scanner (el programa de la laptop)
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

const SO = /Win/i.test(navigator.platform || navigator.userAgent) ? 'win' : /Mac/i.test(navigator.platform || '') && !movil ? 'mac' : movil ? 'movil' : 'otro';
const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Firefox/.test(navigator.userAgent);
const DESC = '../scanner/descargas/';
function ayHtml(para) {
  if (AY.est === undefined) return `<div class="hay"><span class="dot"></span><span>Buscando Ondi Scanner en esta compu…</span></div>`;
  if (AY.est === false) {
    const bW = `<a class="btn sm${SO === 'win' ? ' pri' : ''}" href="${DESC}OndiScanner.exe" download>Bajar Ondi Scanner para Windows</a>`, bM = `<a class="btn sm${SO === 'mac' ? ' pri' : ''}" href="${DESC}OndiScanner-Mac.zip" download>Bajar Ondi Scanner para Mac</a>`;
    const bajar = SO === 'mac' ? bM : SO === 'win' ? bW : bW + ' ' + bM;
    const abrir = SO === 'mac' ? 'Abrí el zip y después «Ondi Scanner». Si la Mac dice «No se abrió», tocá <b>Listo</b> (no lo mandes al basurero), andá a Configuración del Sistema → Privacidad y seguridad, bajá hasta abajo y tocá <b>Abrir igual</b>. Es una sola vez.'
      : SO === 'win' ? 'Abrí el archivo. La primera vez Windows puede avisar: tocá «Más información» → «Ejecutar de todas formas».' : 'Abrilo. La primera vez Windows o la Mac piden confirmar (en la página «Qué es» están los pasos).';
    return `<div class="hay" style="display:grid;gap:8px"><div style="display:flex;gap:10px;align-items:center"><span class="dot no"></span><b>${SO === 'movil' ? para + ' se hace desde la laptop' : 'Falta abrir Ondi Scanner en esta compu'}</b></div>
    <p class="muted" style="margin:0">${para} usa Ondi Scanner, nuestro programa gratis para la laptop del técnico: el navegador solo no puede recorrer la red del cliente ni leer el wifi. Se baja una vez y no se instala nada.</p>
    ${SO === 'movil' ? '<p class="muted" style="margin:0">Abrí Ondi en una laptop con Windows o Mac y entrá acá mismo.</p>' : `<ol class="how" style="margin:0"><li>${bajar} <a href="../scanner/" target="_blank" rel="noopener">Qué es</a></li><li>${abrir}</li>
      <li>Arriba a la derecha de Ondi Scanner tocá <b>Ondi web</b>: ahí está el código de 6 números. Ponelo acá.</li></ol>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn sm" data-h="ayre">Ya lo abrí, buscar de nuevo</button>${safari ? '<span class="muted"><b>Usá Chrome:</b> Safari no deja que la página hable con el programa.</span>' : ''}</div>`}</div>`; }
  if (!AY.est.emparejado) return `<div class="hay"><span class="dot"></span><b>Ondi Scanner está abierto</b><span class="muted">Poné el código de 6 números que aparece en su botón «Ondi web».</span>
    <form data-hf="aycod"><input id="aycod" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000" aria-label="Código de emparejado"><button class="btn sm pri" type="submit">Conectar</button></form></div>`;
  const R = AY.est.redes && AY.est.redes[0];
  return `<div class="hay"><span class="dot ok"></span><b>Ondi Scanner conectado</b><span class="muted">${esc(AY.est.equipo || '')} · ${esc(AY.est.so || '')}${R ? ' · ' + esc(R.ip) : ''}</span><span class="grow" style="flex:1"></span><button class="btn sm" data-h="ayoff">Desconectar</button></div>`; }

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
  if (!ayListo()) { coAgregar('Falta Ondi Scanner abierto y emparejado en esta compu (arriba están los pasos).\n', 'no'); return; }
  let a = resto.filter(x => !/^-/.test(x)).join(' '), n = 4; const nn = txt.match(/\s(?:-n|-c)\s*(\d+)/) || (c === 'ping' && resto[1] && /^\d+$/.test(resto[1]) ? [0, resto[1]] : null);
  if (c === 'ping') { if (nn) n = +nn[1]; if (/\s-t\b/.test(txt)) n = 100; a = resto[0] || ''; }
  if (['ping', 'traza', 'dns', 'puerto'].includes(c) && !a) { coAgregar('Falta la dirección. Ej.: ' + c + ' 8.8.8.8' + (c === 'puerto' ? ' 443' : '') + '\n', 'no'); return; }
  const ac = new AbortController(); CO.corre = ac; coPintar();
  try { await ayPost('/cmd', { c, a, n }, t => coAgregar(t), ac.signal); }
  catch (e) { if (e.name !== 'AbortError') coAgregar((/Failed to fetch|NetworkError|Load failed/.test(e.message) ? 'Se cortó la conexión con Ondi Scanner. ¿Sigue abierta su ventana?' : e.message) + '\n', 'no'); else coAgregar('^C cortado\n', 'tn'); }
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
const TIPN = { camara: 'Cámara o grabador', router: 'Router', ap: 'Access point', switch: 'Switch', impresora: 'Impresora', pc: 'Computadora', nas: 'Almacenamiento (NAS)', iot: 'Equipo IoT', sensor_puerta: 'Equipo IoT', movil: 'Celular o compu', otro: 'Otro' };
const MARCA = f => /hikvision/i.test(f) ? 'hikvision' : /dahua/i.test(f) ? 'dahua' : /ubiquiti/i.test(f) ? 'unifi' : /mikrotik|routerboard/i.test(f) ? 'mikrotik' : /tp-?link/i.test(f) ? 'tplink' : /intelbras/i.test(f) ? 'intelbras' : /espressif|sonoff|itead/i.test(f) ? 'sonoff' : /cisco|meraki/i.test(f) ? 'cisco' : 'otra';
function escaneoHtml() {
  if (!ES.red && AY.est && AY.est.redes && AY.est.redes[0]) ES.red = AY.est.redes[0].red;
  const q = ES.q.toLowerCase(), F = ES.filas.filter(r => !q || [r.ip, r.nombre, r.fab, r.web, r.mac, TIPN[r.tipo]].join(' ').toLowerCase().includes(q)), pct = ES.total ? Math.round(ES.hechos / ES.total * 100) : 0;
  const sites = A.S.sites || [];
  return `<div class="hwrap">${ayHtml('El escaneo')}
    <div class="card pad"><form class="hbar" data-hf="scan"><label class="fld" style="margin:0;min-width:200px;flex:1">Red a recorrer<input id="hred" class="mono" value="${esc(ES.red)}" placeholder="192.168.1.0/24" autocomplete="off" spellcheck="false"></label>
      <label class="chk" style="align-self:end;padding-bottom:8px"><input type="checkbox" id="hpto" ${ES.puertos ? 'checked' : ''}> Buscar puertos (cámaras, routers, web)</label>
      <button class="btn ${ES.corre ? 'danger' : 'pri'}" style="align-self:end" type="submit">${ES.corre ? 'Parar' : 'Escanear'}</button></form>
      ${ES.corre || ES.fin ? `<div style="margin-top:12px"><div class="hprog"><i style="width:${ES.corre ? pct : 100}%"></i></div><p class="hnota" style="margin-top:6px">${ES.corre ? `Recorriendo ${ES.hechos} de ${ES.total}…` : esc(ES.fin)}</p></div>` : '<p class="hnota" style="margin-top:10px">Recorre una red de hasta 4096 direcciones desde esta compu: quién responde, fabricante por la MAC, nombre y qué puertos tiene abiertos. Una /24 tarda entre 10 y 40 segundos.</p>'}</div>
    ${ES.filas.length ? `<div class="card pad"><div class="hbar" style="margin-bottom:10px"><b>${ES.filas.length} equipos</b><input id="hesq" placeholder="Filtrar por IP, marca o nombre" value="${esc(ES.q)}" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">
        <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Agregar a<select id="hescli" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"><option value="">elegí un cliente</option>${sites.map(s => `<option value="${esc(s.id)}" ${ES.cli === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <button class="btn sm" data-h="escsv">Bajar la lista</button></div>
      <div class="tscroll"><table class="htab"><thead><tr><th>IP</th><th>Qué es</th><th>Fabricante</th><th>Nombre o página</th><th>MAC</th><th>Puertos</th><th></th></tr></thead><tbody>
      ${F.map(r => { const k = ES.cli + ':' + r.ip; return `<tr><td class="mono">${esc(r.ip)}${r.ms != null ? `<div class="muted" style="font-size:11.5px">${dec(r.ms, 0)} ms</div>` : ''}</td><td>${esc(TIPN[r.tipo] || 'Otro')}</td><td class="w">${esc(r.fab || '—')}</td><td class="w">${esc(r.nombre || r.web || '—')}</td><td class="mono" style="font-size:12.5px">${esc(r.mac || '—')}</td>
        <td class="w">${(r.puertos || []).map((p, i) => `<span class="hpto" title="${esc(r.que[i] || '')}">${p}</span>`).join('') || '—'}</td>
        <td><div class="cfga">${(r.puertos || []).some(p => [80, 443, 8080, 8443].includes(p)) ? `<a class="btn sm" href="${r.puertos.includes(80) || r.puertos.includes(8080) ? 'http' : 'https'}://${esc(r.ip)}${r.puertos.includes(80) ? '' : r.puertos.includes(8080) ? ':8080' : r.puertos.includes(443) ? '' : ':8443'}/" target="_blank" rel="noopener">Abrir</a>` : ''}
          ${r.fab === 'Esta compu' ? '' : ES.agregados[k] ? '<span class="pill ok">Agregado</span>' : `<button class="btn sm" data-hadd="${esc(r.ip)}">Agregar</button>`}</div></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}</div>`; }
async function esCorrer() {
  if (ES.corre) { ES.corre.abort(); return; }
  ES.red = ($('#hred') || {}).value.trim(); ES.puertos = !!($('#hpto') || {}).checked;
  if (!ayListo()) { A.toast('Primero abrí Ondi Scanner y conectalo'); return; }
  ES.filas = []; ES.hechos = 0; ES.total = 0; ES.fin = null; const ac = new AbortController(); ES.corre = ac; montar(); let buf = '';
  try { await ayPost('/escanear', { red: ES.red, puertos: ES.puertos }, t => { buf += t; let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i); buf = buf.slice(i + 1); if (!ln) continue; const o = JSON.parse(ln);
      if (o.t === 'inicio') ES.total = o.total; else if (o.t === 'avance') ES.hechos = o.hechos; else if (o.t === 'equipo') ES.filas.push(o); else if (o.t === 'fin') ES.fin = `Listo: ${o.encontrados} equipos en ${dec(o.seg)} s.`; }
      montarLuego(); }, ac.signal); }
  catch (e) { ES.fin = e.name === 'AbortError' ? 'Cortado.' : /Failed to fetch|NetworkError|Load failed/.test(e.message) ? 'Se cortó la conexión con Ondi Scanner.' : e.message; }
  ES.corre = null; montar(); }
async function esAgregar(ip) {
  const st = (A.S.sites || []).find(s => s.id === ES.cli); if (!st) { A.toast('Elegí a qué cliente agregarlo'); const s = $('#hescli'); if (s) s.focus(); return; }
  const r = ES.filas.find(x => x.ip === ip); if (!r) return;
  const row = { org_id: st.org_id, site_id: st.id, marca: MARCA(r.fab + ' ' + r.web), tipo: ['camara', 'router', 'ap', 'switch'].includes(r.tipo) ? r.tipo : 'otro', nombre: (r.nombre || r.web || ((r.fab && !/privada/.test(r.fab) ? r.fab.split(/[ ,]/)[0] + ' ' : '') + ip)).slice(0, 80), ip, modelo: null, notas: r.mac ? 'MAC ' + r.mac : null };
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
const css2 = `
.hwalk{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent)}
.hwalk .rec{width:10px;height:10px;border-radius:50%;background:var(--crit);animation:hrec 1.2s infinite}
@keyframes hrec{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.hwalk .rec{animation:none}}
.hwalk b{font-family:var(--f-mono);font-variant-numeric:tabular-nums}
.hcal{display:grid;gap:6px;padding:10px 12px;border-radius:10px;background:var(--sunken);font-size:13px}
.hcal b{font-family:var(--f-mono)}
.hcats{display:grid;gap:4px;font-size:12.5px;max-height:180px;overflow:auto}.hcats div{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center}.hcats i{width:12px;height:12px;border-radius:3px}
.hcats span:last-child{font-family:var(--f-mono);color:var(--muted)}
.hmarks{position:relative;height:16px;font-size:11px;color:var(--muted);font-family:var(--f-mono)}.hmarks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.hmarks span:first-child{transform:none}.hmarks span:last-child{transform:translateX(-100%)}
.hlegu{position:relative}.hlegu i{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);border-radius:1px}
.hside .hrow{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hside .hrow label.fld{margin-bottom:0}
.hlados{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
@media (max-width:640px){.hlados{grid-template-columns:minmax(0,1fr)}}
`;
if (!document.getElementById('hcss2')) { const st = document.createElement('style'); st.id = 'hcss2'; st.textContent = css2; document.head.appendChild(st); }

const MAT = {
  yeso: { n: 'Durlock o yeso', c: '#c9a86a', a: [3, 4, 5], e: 3 }, vidrio: { n: 'Vidrio', c: '#5fb3d9', a: [2, 4, 6], e: 2 }, madera: { n: 'Puerta o madera', c: '#a8743f', a: [3, 5, 6], e: 3 },
  ladrillo: { n: 'Ladrillo', c: '#c4593a', a: [8, 12, 15], e: 4 }, bloque: { n: 'Bloque u hormigón', c: '#8b8f96', a: [12, 18, 22], e: 5 }, losa: { n: 'Hormigón armado', c: '#5d6168', a: [20, 28, 35], e: 6 },
  metal: { n: 'Metal, estantería o cámara de frío', c: '#3a4a6b', a: [25, 30, 35], e: 5 } };
// ruido de fondo típico de una oficina en cada banda
const BANDAS = { '2.4': { i: 0, pl: 40.2, can: [1, 6, 11], n: '2,4 GHz', ruido: -92 }, '5': { i: 1, pl: 47.2, can: [36, 40, 44, 48, 149, 153, 157, 161], n: '5 GHz', ruido: -95 }, '6': { i: 2, pl: 48.2, can: [5, 21, 37, 53, 69, 85, 101, 117], n: '6 GHz', ruido: -95 } };
const ORDEN_B = ['2.4', '5', '6'];
const AMB = { oficina: { n: 'Oficina', e: 3.0 }, casa: { n: 'Casa', e: 3.1 }, galpon: { n: 'Depósito o galpón', e: 2.4 }, exterior: { n: 'Exterior', e: 2.1 } };
// potencia máxima (dBm) y ganancia de antena (dBi) por banda, de las hojas de datos; aproximado
const APM = {
  u6l: { n: 'UniFi U6 Lite', p: [23, 26, 0], g: [2.8, 3, 0] }, u6p: { n: 'UniFi U6 Pro', p: [22, 26, 0], g: [4, 6, 0] }, u6m: { n: 'UniFi U6+', p: [22, 26, 0], g: [4, 5.5, 0] },
  u7p: { n: 'UniFi U7 Pro', p: [22, 26, 23], g: [4, 5.5, 5.6] }, u6x: { n: 'UniFi U6 Mesh (exterior)', p: [23, 26, 0], g: [4, 6, 0], omni: 1 },
  e610: { n: 'TP-Link Omada EAP610', p: [23, 23, 0], g: [4, 5, 0] }, e650: { n: 'TP-Link Omada EAP650', p: [23, 25, 0], g: [4, 5, 0] }, e670: { n: 'TP-Link Omada EAP670', p: [23, 25, 0], g: [4, 5, 0] },
  mr36: { n: 'Cisco Meraki MR36', p: [25, 25, 0], g: [4.6, 5.8, 0] }, ap22: { n: 'Aruba Instant On AP22', p: [21, 21, 0], g: [3.6, 5.4, 0] },
  ib: { n: 'Intelbras AP 3000 AX', p: [22, 24, 0], g: [3, 4, 0] }, gen: { n: 'Genérico de techo', p: [20, 23, 20], g: [3, 4, 4] } };
const POT = { alta: { n: 'Alta (máxima)', r: 0 }, media: { n: 'Media', r: 6 }, baja: { n: 'Baja', r: 12 } };
// el equipo que va a usar la red: recibe distinto y se usa a otra altura
const EQUIPO = { notebook: { n: 'Notebook', g: 0, h: 1 }, celular: { n: 'Celular', g: -4, h: 1.2 }, escaner: { n: 'Escáner o terminal de depósito', g: -3, h: 1.2 }, iot: { n: 'Cámara wifi o equipo IoT', g: -6, h: 2.5 } };
const UMBRAL = [[-67, 'Voz y video', '-67 dBm'], [-70, 'Depósito con escáneres', '-70 dBm'], [-72, 'Datos y navegación', '-72 dBm'], [-75, 'Lo mínimo', '-75 dBm']];
const PALETA = ['#2f7de1', '#e8590c', '#2b8a3e', '#ae3ec9', '#f2b01e', '#0c8599', '#d6336c', '#74b816', '#1864ab', '#9c36b5', '#e67700', '#087f5b'];
const ESC_DBM = [[-45, '#1a9641'], [-55, '#73c15b'], [-62, '#c2e57f'], [-67, '#f7f3a1'], [-72, '#fdc27a'], [-78, '#f07c4a'], [-85, '#d7191c']];
const hex2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ESC_RGB = ESC_DBM.map(([v, c]) => [v, hex2(c)]);
function colorDbm(v) { if (v >= ESC_RGB[0][0]) return ESC_RGB[0][1];
  for (let i = 1; i < ESC_RGB.length; i++) if (v >= ESC_RGB[i][0]) { const [a, ca] = ESC_RGB[i - 1], [b, cb] = ESC_RGB[i], k = (v - b) / (a - b); return [0, 1, 2].map(j => cb[j] + (ca[j] - cb[j]) * k); }
  return ESC_RGB[ESC_RGB.length - 1][1]; }
// medido menos predicho: rojo si llega menos de lo que se esperaba, azul si llega más
const DIF = [[-12, '#c92a2a'], [-6, '#f08c7a'], [0, '#f4f1ec'], [6, '#7db3e0'], [12, '#1c5fa8']].map(([v, c]) => [v, hex2(c)]);
function colorDif(v) { v = clamp(v, -12, 12); for (let i = 1; i < DIF.length; i++) if (v <= DIF[i][0]) { const [a, ca] = DIF[i - 1], [b, cb] = DIF[i], k = (v - a) / (b - a); return [0, 1, 2].map(j => ca[j] + (cb[j] - ca[j]) * k); } return DIF[DIF.length - 1][1]; }
const gradCss = () => 'linear-gradient(90deg,' + ESC_DBM.slice().reverse().map(x => x[1]).join(',') + ')';
const gradDif = () => 'linear-gradient(90deg,' + DIF.map(x => 'rgb(' + x[1].join(',') + ')').join(',') + ')';
const nid = () => Math.random().toString(36).slice(2, 8);

const VISTAS = { wifi: [['senal', 'Señal'], ['snr', 'SNR'], ['inter', 'Interferencia'], ['ap', 'AP que atiende']],
  calor: [['senal', 'Señal'], ['ap', 'AP que atiende'], ['inter', 'Interferencia'], ['snr', 'SNR'], ['vel', 'Velocidad'], ['lat', 'Latencia'], ['dif', 'Contra el predictivo']] };
function nuevo(tipo) { return { tipo, id: null, nombre: '', site: '', fondo: null, anchoM: tipo === 'calor' ? 25 : 30, altoM: 20, paredes: [], aps: [], puntos: [], amb: 'oficina', banda: '5', modelo: 'u6l', pot: 'media',
  mat: 'ladrillo', herr: tipo === 'wifi' ? 'ap' : 'medir', ver: 'senal', sel: null, z: 1, ox: null, oy: null, auto: true, cambio: false, umbral: -67, equipo: 'notebook', altAP: 3, cal: null, ssid: '', corr: 0, ref: null }; }
const LZ = { wifi: nuevo('wifi'), calor: nuevo('calor') };
const IMG = {}; // imágenes de fondo ya decodificadas
function fondoImg(L) { const f = L.fondo; if (!f || !f.data) return null; if (IMG[f.data]) return IMG[f.data].complete ? IMG[f.data] : null;
  const im = new Image(); im.onload = () => { if (!L.fondo || L.fondo.data !== f.data) return; if (!f.w) { f.w = im.naturalWidth; f.h = im.naturalHeight; } L.altoM = L.anchoM * f.h / f.w; dibujar(L, true); }; im.src = f.data; IMG[f.data] = im; return null; }

/* ---------- el modelo de propagación ---------- */
function cruza(ax, ay, bx, by, cx, cy, dx, dy) { const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d; return t > 0 && t < 1 && u > 0 && u < 1; }
// cuánto atenúan las paredes entre dos puntos; si la señal cruza la pared en diagonal, recorre más material y pierde más
function atenua(paredes, x0, y0, x1, y1, bi) { let s = 0; const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
  for (const w of paredes) if (cruza(x0, y0, x1, y1, w.a[0], w.a[1], w.b[0], w.b[1])) { const wx = w.b[0] - w.a[0], wy = w.b[1] - w.a[1], wl = Math.hypot(wx, wy) || 1, sen = Math.abs(dx * wy - dy * wx) / (dl * wl);
    s += (MAT[w.m] || MAT.ladrillo).a[bi] * Math.min(2, 1 / Math.max(sen, .5)); }
  return s; }
// las partes del cálculo que no dependen de la calibración (se reusan al calibrar)
function geo(L, a, x, y) { const B = BANDAS[L.banda], m = APM[a.m] || APM.gen, eq = EQUIPO[L.equipo] || EQUIPO.notebook;
  if (!m.p[B.i]) return null;
  const dz = Math.max(.3, (+L.altAP || 3) - eq.h), dh = Math.hypot(x - a.x, y - a.y), d = Math.max(1, Math.hypot(dh, dz));
  const elev = Math.atan2(dz, dh) * 180 / Math.PI, patron = m.omni ? 0 : -4 * (1 - Math.min(1, elev / 35)); // un AP de techo irradia más hacia abajo que hacia el costado
  return { base: m.p[B.i] - (POT[a.pot] || POT.media).r + m.g[B.i] + patron + eq.g - B.pl, lg: Math.log10(d), w: atenua(L.paredes, a.x, a.y, x, y, B.i) }; }
function rssiAP(L, a, x, y) { const q = geo(L, a, x, y); if (!q) return -200; const c = L.cal || {};
  return q.base - 10 * (c.n || AMB[L.amb].e) * q.lg - (c.k || 1) * q.w + (c.off || 0) + ((c.por || {})[a.id] || 0); }
const predEn = (L, x, y) => L.aps.reduce((b, a) => Math.max(b, rssiAP(L, a, x, y)), -200);

/* ---------- lo medido ---------- */
const grupoAP = r => r.m ? r.m.slice(0, 14) : (r.s || '?') + '·' + r.c; // los BSSID de un mismo equipo cambian solo en el último byte
function mejorDe(L, p, banda) { // la mejor señal de la red elegida en ese punto
  const red = L.ssid === '*' ? null : (L.ssid || p.ssid || null), R = (p.redes || []).filter(r => (!red || r.s === red) && (!banda || !r.b || r.b === banda));
  if (R.length) { let b = R[0]; for (const r of R) if (r.r > b.r) b = r; return { r: b.r + (+L.corr || 0), red: b }; }
  if (p.rssi != null && (!banda || !p.b || p.b === banda)) return { r: p.rssi + (+L.corr || 0), red: p.bssid ? { m: p.bssid, s: p.ssid, c: p.canal, r: p.rssi } : null };
  return null; }
function valor(L, p) {
  if (L.ver === 'vel') return p.mbps == null ? null : p.mbps;
  if (L.ver === 'lat') return p.ms == null ? null : p.ms;
  const m = mejorDe(L, p, L.ver === 'dif' && L.refL ? L.refL.banda : null); if (!m) return null;
  if (L.ver === 'senal') return m.r;
  if (L.ver === 'snr') return m.r - (p.ruido || (BANDAS[m.red && m.red.b] || BANDAS['5']).ruido);
  if (L.ver === 'ap') return m.red ? apIdx(L, grupoAP(m.red)) : null;
  if (L.ver === 'inter') { if (!m.red || !m.red.c) return null; const g0 = grupoAP(m.red), vistos = new Set(); for (const r of p.redes || []) if (r.c === m.red.c && r.r >= -82 && grupoAP(r) !== g0) vistos.add(grupoAP(r)); return vistos.size; }
  if (L.ver === 'dif') return L.refL && L.refL.aps.length ? m.r - predEn(L.refL, p.x, p.y) : null;
  return null; }
function apIdx(L, g) { const M = L._aps || (L._aps = new Map()); if (!M.has(g)) M.set(g, M.size); return M.get(g); }
function apsMedidos(L) { const M = new Map();
  for (const p of L.puntos) { const m = mejorDe(L, p); if (!m || !m.red) continue; const g = grupoAP(m.red), e = M.get(g) || { g, s: m.red.s, c: m.red.c, n: 0, max: -200 }; e.n++; e.max = Math.max(e.max, m.r); M.set(g, e); }
  return [...M.values()].sort((a, b) => apIdx(L, a.g) - apIdx(L, b.g)); }
function redesVistas(L) { const M = new Map(); for (const p of L.puntos) { for (const r of p.redes || []) if (r.s) M.set(r.s, (M.get(r.s) || 0) + 1); if (p.ssid && !(p.redes || []).length) M.set(p.ssid, (M.get(p.ssid) || 0) + 1); }
  return [...M.entries()].sort((a, b) => b[1] - a[1]); }
// lo medido se pasa a la misma escala de colores que la señal
function aEscala(L, x) { if (L.ver === 'vel') { const top = Math.max(50, ...L.puntos.map(p => p.mbps || 0)); return -85 + 40 * clamp(x / top, 0, 1); }
  if (L.ver === 'lat') return -45 - 40 * clamp((x - 5) / 95, 0, 1);
  if (L.ver === 'snr') return -85 + 40 * clamp((x - 5) / 35, 0, 1);
  if (L.ver === 'inter') return [-45, -64, -74, -85][Math.min(3, Math.round(x))];
  return x; }

/* ---------- el campo: una grilla con el valor de cada lugar del plano ---------- */
function campo(L, cols) {
  const W = L.anchoM, Hm = L.altoM, c = cols, r = Math.max(2, Math.round(c * Hm / W)), cw = W / c, ch = Hm / r, n = c * r;
  const v = new Float32Array(n).fill(NaN), al = new Float32Array(n), cat = new Int16Array(n).fill(-1), F = { c, r, cw, ch, v, al, cat };
  if (L.tipo === 'wifi') { if (!L.aps.length) return F; const can = canales(L), B = BANDAS[L.banda], rs = new Float32Array(L.aps.length);
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) { const x = (i + .5) * cw, y = (j + .5) * ch, k = j * c + i; let b = -200, bi = -1;
      for (let a = 0; a < L.aps.length; a++) { rs[a] = rssiAP(L, L.aps[a], x, y); if (rs[a] > b) { b = rs[a]; bi = a; } }
      if (bi < 0) continue; al[k] = clamp((b + 92) / 8, 0, 1);
      if (L.ver === 'snr') v[k] = b - B.ruido;
      else if (L.ver === 'inter') { let q = 0; for (let a = 0; a < rs.length; a++) if (a !== bi && can[a] === can[bi] && rs[a] >= -82) q++; v[k] = q; }
      else { v[k] = b; if (L.ver === 'ap') cat[k] = bi; } }
    return F; }
  const P = L.puntos.map(p => ({ p, val: valor(L, p) })).filter(q => q.val != null); if (!P.length) return F;
  const R = clamp(W / 6, 3, 9), R2 = R * 1.6, esCat = L.ver === 'ap';
  // los puntos agrupados por celda para no recorrerlos todos en cada lugar
  const tam = R2, gx = Math.ceil(W / tam) + 1, gy = Math.ceil(Hm / tam) + 1, cubo = Array.from({ length: gx * gy }, () => []);
  for (const q of P) cubo[clamp(Math.floor(q.p.y / tam), 0, gy - 1) * gx + clamp(Math.floor(q.p.x / tam), 0, gx - 1)].push(q);
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) { const x = (i + .5) * cw, y = (j + .5) * ch, k = j * c + i, bx = Math.floor(x / tam), by = Math.floor(y / tam);
    let sw = 0, sv = 0, dmin = 1e9, cerca = null;
    for (let yy = by - 1; yy <= by + 1; yy++) for (let xx = bx - 1; xx <= bx + 1; xx++) { if (xx < 0 || yy < 0 || xx >= gx || yy >= gy) continue;
      for (const q of cubo[yy * gx + xx]) { const d = Math.hypot(x - q.p.x, y - q.p.y); if (d < dmin) { dmin = d; cerca = q; } if (d > R2) continue; const w = 1 / Math.pow(Math.max(.3, d), 2.4); sw += w; sv += w * q.val; } }
    if (dmin > R || !cerca) continue; al[k] = clamp((R - dmin) / (R * .4), 0, 1);
    if (esCat) { v[k] = 0; cat[k] = cerca.val; } else if (sw) v[k] = sv / sw; }
  return F; }
// la curva donde la señal cruza lo que necesita el cliente (cuadrados en marcha)
function isolinea(F, u) { const S = [], { c, r, cw, ch, v } = F;
  const P = (i, j) => [(i + .5) * cw, (j + .5) * ch], L = (a, b, va, vb) => { const t = (u - va) / (vb - va); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  for (let j = 0; j < r - 1; j++) for (let i = 0; i < c - 1; i++) { const a = v[j * c + i], b = v[j * c + i + 1], d = v[(j + 1) * c + i], e = v[(j + 1) * c + i + 1];
    if (isNaN(a) || isNaN(b) || isNaN(d) || isNaN(e)) continue; const k = (a >= u ? 8 : 0) | (b >= u ? 4 : 0) | (e >= u ? 2 : 0) | (d >= u ? 1 : 0); if (k === 0 || k === 15) continue;
    const pa = P(i, j), pb = P(i + 1, j), pe = P(i + 1, j + 1), pd = P(i, j + 1), ar = L(pa, pb, a, b), de = L(pb, pe, b, e), ab = L(pd, pe, d, e), iz = L(pa, pd, a, d);
    const T = { 1: [[iz, ab]], 2: [[ab, de]], 3: [[iz, de]], 4: [[ar, de]], 5: [[iz, ar], [ab, de]], 6: [[ar, ab]], 7: [[iz, ar]], 8: [[iz, ar]], 9: [[ar, ab]], 10: [[iz, ab], [ar, de]], 11: [[ar, de]], 12: [[iz, de]], 13: [[ab, de]], 14: [[iz, ab]] }[k];
    for (const s of T) S.push(s); }
  return S; }

function vista(L, cv) { const w = cv.clientWidth, h = cv.clientHeight || 300, k0 = Math.min(w / L.anchoM, h / L.altoM) * .96, k = k0 * L.z;
  if (L.ox == null || L.oy == null) { L.ox = (w - L.anchoM * k) / 2; L.oy = (h - L.altoM * k) / 2; } return { k, ox: L.ox, oy: L.oy, w, h }; }
const aPan = (V, x, y) => [x * V.k + V.ox, y * V.k + V.oy], aMundo = (V, px, py) => [(px - V.ox) / V.k, (py - V.oy) / V.k];
let rafD = 0;
function dibujar(L, recalc) { if (recalc) { L._campo = null; L._aps = L._aps; } cancelAnimationFrame(rafD); rafD = requestAnimationFrame(() => dibujarYa(L)); }
function apIcono(g, px, py, on, col, acento) { const R = on ? 13 : 11.5;
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.shadowOffsetY = 1.5; g.beginPath(); g.arc(px, py, R, 0, 7); g.fillStyle = '#fff'; g.fill(); g.restore();
  g.beginPath(); g.arc(px, py, R - 2.5, 0, 7); g.fillStyle = on ? acento : col; g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 1.7; g.lineCap = 'round'; for (const r of [3.4, 6.4]) { g.beginPath(); g.arc(px, py + 3, r, -2.45, -.69); g.stroke(); } g.beginPath(); g.arc(px, py + 3, 1.4, 0, 7); g.fillStyle = '#fff'; g.fill(); }
function etiqueta(g, t, x, y, cs, alin) { g.font = '600 11.5px ' + cs.getPropertyValue('--f-body'); const tw = g.measureText(t).width, x0 = alin === 'izq' ? x : x - tw / 2 - 5;
  g.fillStyle = 'rgba(18,24,31,.84)'; g.beginPath(); g.roundRect(x0, y, tw + 10, 18, 5); g.fill(); g.fillStyle = '#fff'; g.fillText(t, x0 + 5, y + 13); }
function dibujarYa(L) {
  const cv = $('#hcanvas'); if (!cv || cv.dataset.t !== L.tipo) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, Hh = Math.round(clamp(W * L.altoM / L.anchoM, 280, innerHeight * .72));
  if (cv.style.height !== Hh + 'px') cv.style.height = Hh + 'px';
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  const V = vista(L, cv), cs = getComputedStyle(document.documentElement), surf = cs.getPropertyValue('--surface').trim() || '#fff', ink = cs.getPropertyValue('--ink').trim() || '#000', mut = cs.getPropertyValue('--muted').trim(), acc = cs.getPropertyValue('--accent').trim();
  const [x0, y0] = aPan(V, 0, 0), pw = L.anchoM * V.k, ph = L.altoM * V.k;
  g.fillStyle = surf; g.fillRect(x0, y0, pw, ph);
  const im = fondoImg(L); if (im) { g.globalAlpha = .92; g.drawImage(im, x0, y0, pw, ph); g.globalAlpha = 1; }
  g.strokeStyle = mut; g.globalAlpha = .45; g.lineWidth = 1; g.strokeRect(x0 + .5, y0 + .5, pw - 1, ph - 1); g.globalAlpha = 1;
  // el calor
  if (!L._campo) L._campo = campo(L, L.arrastra ? 70 : clamp(Math.round(W / 4), 100, 240));
  const F = L._campo; if (F.v.some(x => !isNaN(x))) {
    const oc = document.createElement('canvas'); oc.width = F.c; oc.height = F.r; const og = oc.getContext('2d'), id = og.createImageData(F.c, F.r), cat = L.ver === 'ap';
    for (let i = 0; i < F.v.length; i++) { const x = F.v[i]; if (isNaN(x)) continue; const col = cat ? hex2(PALETA[F.cat[i] % PALETA.length]) : L.ver === 'dif' ? colorDif(x) : colorDbm(L.tipo === 'wifi' && L.ver === 'senal' ? x : aEscala(L, x));
      id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = Math.round(F.al[i] * 255); }
    og.putImageData(id, 0, 0); g.save(); g.globalAlpha = im ? .6 : .82; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(oc, x0, y0, pw, ph); g.restore();
    // la curva de lo que necesita el cliente
    if (L.ver === 'senal') { const S = isolinea(F, +L.umbral || -67); if (S.length) { g.save(); g.strokeStyle = ink; g.globalAlpha = .75; g.lineWidth = 1.6; g.setLineDash([5, 4]); g.beginPath();
      for (const [a, b] of S) { const [ax, ay] = aPan(V, a[0], a[1]), [bx, by] = aPan(V, b[0], b[1]); g.moveTo(ax, ay); g.lineTo(bx, by); } g.stroke(); g.restore(); } } }
  // paredes
  g.lineCap = 'round';
  for (const w of L.paredes) { const [a1, b1] = aPan(V, ...w.a), [a2, b2] = aPan(V, ...w.b), on = L.sel && L.sel.k === 'p' && L.sel.o === w, M = MAT[w.m] || MAT.ladrillo, gw = Math.max(3, Math.min(9, M.e * .045 * V.k + 2.5));
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = gw + 2; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke();
    g.strokeStyle = on ? acc : M.c; g.lineWidth = gw; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
  if (L.trazo) { const [a1, b1] = aPan(V, ...L.trazo.a), [a2, b2] = aPan(V, ...L.trazo.b); g.setLineDash([6, 5]); g.strokeStyle = L.herr === 'escala' ? acc : (MAT[L.mat] || MAT.ladrillo).c; g.lineWidth = 3; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); g.setLineDash([]);
    const m = Math.hypot(L.trazo.b[0] - L.trazo.a[0], L.trazo.b[1] - L.trazo.a[1]); etiqueta(g, dec(m) + ' m', a2 + 10, b2 - 22, cs, 'izq'); }
  // los APs del predictivo, vistos desde el mapa de calor
  if (L.tipo === 'calor' && L.refL) L.refL.aps.forEach((a, i) => { const [px, py] = aPan(V, a.x, a.y); g.globalAlpha = .7; apIcono(g, px, py, false, '#6b7682', acc); g.globalAlpha = 1; etiqueta(g, a.nom || 'AP ' + (i + 1), px, py + 15, cs); });
  // los APs
  const can = L.tipo === 'wifi' ? canales(L) : null;
  L.aps.forEach((a, i) => { const [px, py] = aPan(V, a.x, a.y), on = L.sel && L.sel.o === a; apIcono(g, px, py, on, L.ver === 'ap' ? PALETA[i % PALETA.length] : '#1b2530', acc);
    etiqueta(g, (a.nom || 'AP ' + (i + 1)) + (can ? ' · c' + can[i] : ''), px, py + 15, cs); });
  // el recorrido caminado y los puntos medidos
  const rec = new Map(); for (const p of L.puntos) if (p.cam) { if (!rec.has(p.cam)) rec.set(p.cam, []); rec.get(p.cam).push(p); }
  g.save(); g.strokeStyle = ink; g.globalAlpha = .55; g.lineWidth = 1.5; g.setLineDash([2, 4]);
  for (const R of rec.values()) { g.beginPath(); R.forEach((p, i) => { const [px, py] = aPan(V, p.x, p.y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); } g.restore();
  if (CAM.activo && CAM.L === L) { const w = CAM.wps[CAM.wps.length - 1]; if (w) { const [px, py] = aPan(V, w.x, w.y); g.beginPath(); g.arc(px, py, 9, 0, 7); g.fillStyle = acc; g.globalAlpha = .25; g.fill(); g.globalAlpha = 1; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fillStyle = acc; g.fill(); } }
  L.puntos.forEach(p => { const [px, py] = aPan(V, p.x, p.y), on = L.sel && L.sel.o === p, v = valor(L, p), chico = p.cam && !on;
    g.beginPath(); g.arc(px, py, on ? 9 : chico ? 3.2 : 7, 0, 7);
    g.fillStyle = v == null ? '#8a96a3' : L.ver === 'ap' ? PALETA[v % PALETA.length] : 'rgb(' + (L.ver === 'dif' ? colorDif(v) : colorDbm(aEscala(L, v))).map(Math.round).join(',') + ')'; g.fill();
    g.lineWidth = on ? 3 : chico ? 1 : 2; g.strokeStyle = on ? acc : chico ? 'rgba(255,255,255,.9)' : '#1b2530'; g.stroke();
    if (v != null && !chico && L.ver !== 'ap') { const t = L.ver === 'vel' ? dec(v, 0) + ' Mb' : L.ver === 'lat' ? dec(v, 0) + ' ms' : L.ver === 'inter' ? v + '' : L.ver === 'dif' ? (v > 0 ? '+' : '') + dec(v, 0) : dec(v, 0); etiqueta(g, t, px + 10, py - 9, cs, 'izq'); } });
  // escala
  const pasos = [1, 2, 5, 10, 20, 50], m = pasos.find(s => s * V.k > 70) || 50, bx = 12, by = Hh - 14; g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 2;
  g.beginPath(); g.moveTo(bx, by - 5); g.lineTo(bx, by); g.lineTo(bx + m * V.k, by); g.lineTo(bx + m * V.k, by - 5); g.stroke(); g.font = '600 11.5px ' + cs.getPropertyValue('--f-mono'); g.fillText(m + ' m', bx + m * V.k + 6, by + 1);
  if (!L._noLado) ladoPintar(L); L._noLado = false; }

// canales: a cada AP el que menos se pisa con los vecinos
function canales(L) { const C = BANDAS[L.banda].can, out = [];
  L.aps.forEach((a, i) => { let best = C[0], bs = 1e9; for (const c of C) { let s = 0; L.aps.slice(0, i).forEach((b, j) => { if (out[j] === c) s += Math.pow(10, rssiAP(L, b, a.x, a.y) / 10); }); if (s < bs) { bs = s; best = c; } } out.push(best); });
  return out; }
function cobertura(L) { const F = campo(Object.assign({}, L, { ver: 'senal' }), 80), u = +L.umbral || -67; let n = 0, ok = 0, b75 = 0, m80 = 0;
  for (let i = 0; i < F.v.length; i++) { const x = F.v[i]; n++; if (isNaN(x)) { m80++; continue; } if (x >= u) ok++; if (x >= -75) b75++; if (x < -80) m80++; } return n ? { ok: ok / n, b75: b75 / n, m80: m80 / n } : null; }
async function sugerir(L) {
  const B = BANDAS[L.banda]; if (!(APM[L.modelo] || APM.gen).p[B.i]) { A.toast('Ese modelo no tiene ' + B.n); return; } const u = +L.umbral || -67;
  const paso = clamp(L.anchoM / 18, 1.2, 4), cand = []; for (let y = paso / 2; y < L.altoM; y += paso) for (let x = paso / 2; x < L.anchoM; x += paso) cand.push([x, y]);
  const C = 44, R = Math.max(2, Math.round(C * L.altoM / L.anchoM)), cw = L.anchoM / C, ch = L.altoM / R, celdas = []; for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) celdas.push([(i + .5) * cw, (j + .5) * ch]);
  const mejor = celdas.map(([x, y]) => predEn(L, x, y)); let puestos = 0;
  A.toast('Buscando dónde van los APs…'); await new Promise(r => setTimeout(r, 30));
  for (let it = 0; it < 30; it++) { const ok = mejor.filter(v => v >= u).length / mejor.length; if (ok >= .95) break;
    let bi = -1, bg = 0; const nuevoAP = { id: 'tmp', m: L.modelo, pot: L.pot, x: 0, y: 0 };
    cand.forEach(([x, y], ci) => { nuevoAP.x = x; nuevoAP.y = y; let gn = 0; for (let k = 0; k < celdas.length; k++) if (mejor[k] < u && rssiAP(L, nuevoAP, celdas[k][0], celdas[k][1]) >= u) gn++; if (gn > bg) { bg = gn; bi = ci; } });
    if (bi < 0 || bg < celdas.length * .01) break;
    const a = { id: nid(), m: L.modelo, pot: L.pot, x: cand[bi][0], y: cand[bi][1] }; L.aps.push(a); puestos++;
    celdas.forEach(([x, y], k) => { mejor[k] = Math.max(mejor[k], rssiAP(L, a, x, y)); }); await new Promise(r => setTimeout(r, 0)); }
  L.cambio = true; dibujar(L, true); montar(); A.toast(puestos ? `Ubiqué ${puestos} AP${puestos === 1 ? '' : 's'}. Movelos a donde se puedan colgar de verdad.` : 'Con lo que hay ya alcanza (o no se puede mejorar)'); }

/* ---------- calibrar el predictivo con lo medido ----------
   Se ajustan tres números del modelo (cuánto cae la señal con la distancia, cuánto pesan las paredes y un corrimiento general)
   y después un corrimiento por AP, para que lo predicho coincida con lo que midió el equipo. */
function resolver3(M, b) { const m = M.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) { let p = i; for (let j = i + 1; j < 3; j++) if (Math.abs(m[j][i]) > Math.abs(m[p][i])) p = j; [m[i], m[p]] = [m[p], m[i]]; if (Math.abs(m[i][i]) < 1e-9) return null;
    for (let j = 0; j < 3; j++) if (j !== i) { const f = m[j][i] / m[i][i]; for (let k = i; k < 4; k++) m[j][k] -= f * m[i][k]; } }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]]; }
function calibrar(Lw, Lc) {
  const aps = Lw.aps.filter(a => (APM[a.m] || APM.gen).p[BANDAS[Lw.banda].i]); if (!aps.length) return { error: 'El predictivo no tiene APs en ' + BANDAS[Lw.banda].n };
  const D = []; for (const p of Lc.puntos) { const m = mejorDe(Lc, p, Lw.banda); if (!m || m.r < -95) continue; D.push({ y: m.r, g: aps.map(a => geo(Lw, a, p.x, p.y)) }); }
  if (D.length < 8) return { error: `Hacen falta al menos 8 mediciones en ${BANDAS[Lw.banda].n} (hay ${D.length}).` };
  const n0 = AMB[Lw.amb].e; let n = n0, k = 1, off = 0, por = {};
  const pred = (q, a, n, k, off, por) => q.base - 10 * n * q.lg - k * q.w + off + (por[aps[a].id] || 0);
  const mejorA = (d, n, k, off, por) => { let b = -1e9, bi = 0; d.g.forEach((q, a) => { const v = pred(q, a, n, k, off, por); if (v > b) { b = v; bi = a; } }); return [bi, b]; };
  const error = (n, k, off, por) => D.reduce((s, d) => s + Math.abs(d.y - mejorA(d, n, k, off, por)[1]), 0) / D.length;
  const e0 = error(n0, 1, 0, {});
  for (let it = 0; it < 10; it++) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0], Lm = [12, 25, .5], pri = [n0, 1, 0]; // un poco de peso a los valores de partida, para que no se dispare con pocos datos
    for (const d of D) { const [a] = mejorA(d, n, k, off, por), q = d.g[a], x = [-10 * q.lg, -q.w, 1], y = d.y - q.base - (por[aps[a].id] || 0);
      for (let i = 0; i < 3; i++) { b[i] += x[i] * y; for (let j = 0; j < 3; j++) M[i][j] += x[i] * x[j]; } }
    for (let i = 0; i < 3; i++) { M[i][i] += Lm[i] * D.length / 50; b[i] += Lm[i] * D.length / 50 * pri[i]; }
    const s = resolver3(M, b); if (!s) break; n = clamp(s[0], 1.6, 5); k = clamp(s[1], .2, 3); off = clamp(s[2], -20, 20);
    if (it >= 3) { const sum = {}, cnt = {}; for (const d of D) { const [a] = mejorA(d, n, k, off, por), id = aps[a].id, q = d.g[a]; sum[id] = (sum[id] || 0) + d.y - (q.base - 10 * n * q.lg - k * q.w + off); cnt[id] = (cnt[id] || 0) + 1; }
      por = {}; for (const id in sum) por[id] = clamp(sum[id] / (cnt[id] + 4), -10, 10); } }
  return { n: Math.round(n * 100) / 100, k: Math.round(k * 100) / 100, off: Math.round(off * 10) / 10, por, pts: D.length, e0: Math.round(e0 * 10) / 10, e1: Math.round(error(n, k, off, por) * 10) / 10, f: new Date().toISOString().slice(0, 10) }; }

/* ---------- caminar midiendo (con Ondi Scanner) ----------
   Se toca el plano donde uno arranca y cada vez que dobla; las lecturas del medio se reparten a lo largo del tramo según la hora. */
const CAM = { activo: false, L: null, wps: [], pend: [], seq: -1, n: 0, ult: null, id: 0, err: 0, tm: 0 };
const normW = w => w && !w.actual && (w.rssi != null || w.ssid) ? { actual: w, redes: [], seq: Date.now(), exacto: false } : w;
function aPunto(w, x, y, cam) { const a = w.actual || {};
  return { x, y, t: Date.now(), cam, rssi: a.rssi == null ? null : +a.rssi, ssid: a.ssid || '', bssid: a.bssid || '', canal: a.canal || 0, b: a.banda || '', ruido: a.ruido || null,
    redes: (w.redes || []).map(r => ({ m: r.bssid || '', s: r.ssid || '', r: +r.rssi, c: +r.canal || 0, b: r.banda || '' })) }; }
async function camLeer() { if (!CAM.activo) return; const t0 = Date.now();
  try { const w = normW(await ayWifi()); if (w && w.seq !== CAM.seq) { CAM.seq = w.seq; CAM.pend.push({ t: Date.now(), w }); CAM.n++; CAM.ult = w; CAM.err = 0; } } catch (e) { CAM.err++; }
  camEstado(); CAM.tm = setTimeout(camLeer, Math.max(150, 900 - (Date.now() - t0))); }
function camEmpezar(L, x, y) { if (!ayListo()) { A.toast('Para caminar midiendo hace falta Ondi Scanner abierto en la laptop'); return; }
  Object.assign(CAM, { activo: true, L, wps: [{ x, y, t: Date.now() }], pend: [], seq: -1, n: 0, ult: null, id: Date.now(), err: 0 }); montar(); camLeer(); }
function camPunto(L, x, y) { const t = Date.now(), a = CAM.wps[CAM.wps.length - 1], usar = CAM.pend.filter(s => s.t <= t); CAM.pend = CAM.pend.filter(s => s.t > t);
  for (const s of usar) { const f = clamp((s.t - a.t) / Math.max(1, t - a.t), 0, 1); L.puntos.push(aPunto(s.w, a.x + (x - a.x) * f, a.y + (y - a.y) * f, CAM.id)); }
  CAM.wps.push({ x, y, t }); L.cambio = true; dibujar(L, true); }
function camTerminar() { const L = CAM.L; if (!CAM.activo) return; clearTimeout(CAM.tm); const a = CAM.wps[CAM.wps.length - 1];
  for (const s of CAM.pend) L.puntos.push(aPunto(s.w, a.x, a.y, CAM.id)); CAM.activo = false; CAM.pend = []; L.cambio = true; montar(); A.toast(`Recorrido guardado: ${L.puntos.filter(p => p.cam === CAM.id).length} lecturas`); }
function camEstado() { const el = $('#hwalk'); if (!el) return; const u = CAM.ult, a = u && u.actual || {};
  el.innerHTML = `<span class="rec"></span><span>Caminando: <b>${CAM.n}</b> lecturas</span>${a.rssi != null ? `<span>Ahora <b>${a.rssi} dBm</b>${a.ssid ? ' en ' + esc(a.ssid) : ''}</span>` : ''}${u && u.redes ? `<span class="muted">${u.redes.length} access points a la vista</span>` : ''}
    ${CAM.err > 2 ? '<span style="color:var(--crit)">No responde Ondi Scanner</span>' : ''}${u && u.permiso === 'ubicacion' ? '<span style="color:var(--crit)">Windows no deja leer las redes: activá Configuración → Privacidad y seguridad → Ubicación → «Permitir que las apps de escritorio accedan a la ubicación»</span>' : ''}${u && u.exacto === false ? '<span class="muted">Esta compu da la señal en %, se pasa a dBm aproximado</span>' : ''}
    <span style="flex:1"></span><button class="btn sm pri" data-h="camfin">Terminar</button>`; }

/* ---------- el panel de al lado ---------- */
function legenda(L) { const v = L.ver;
  if (v === 'ap') return '';
  if (v === 'dif') return `<div class="hleg" style="background:${gradDif()}"></div><div class="hmarks"><span style="left:0">−12 dB</span><span style="left:50%">igual</span><span style="left:100%">+12 dB</span></div><p class="hnota" style="margin-top:6px">Rojo: llega menos de lo que dice el predictivo. Azul: llega más.</p>`;
  const marcas = v === 'senal' ? [[-85, '-85'], [-67, '-67'], [-45, '-45 dBm']] : v === 'snr' ? [[-85, '5'], [-65, '22'], [-45, '40 dB']] : v === 'inter' ? [[-85, '3 o más'], [-74, '2'], [-64, '1'], [-45, 'ninguno']] : v === 'vel' ? [[-85, '0'], [-45, 'la más rápida']] : [[-85, '100 ms'], [-45, '5 ms']];
  const pos = x => (x + 85) / 40 * 100, u = +L.umbral || -67;
  return `<div class="hlegu"><div class="hleg" style="background:${gradCss()}"></div>${v === 'senal' ? `<i style="left:calc(${pos(u)}% - 1px)" title="Lo que necesita"></i>` : ''}</div><div class="hmarks">${marcas.map(([x, t]) => `<span style="left:${pos(x)}%">${t}</span>`).join('')}</div>`; }
function ladoPintar(L) { const el = $('#hlado'); if (!el) return; const s = L.sel, B = BANDAS[L.banda];
  let sel = '';
  if (s && s.k === 'a') { const a = s.o; sel = `<div class="card"><h3>${esc(a.nom || 'Access point')}</h3>
    <label class="fld">Nombre<input data-hap="nom" value="${esc(a.nom || '')}" placeholder="AP ${L.aps.indexOf(a) + 1}"></label>
    <label class="fld">Modelo<select data-hap="m">${Object.entries(APM).map(([k, m]) => `<option value="${k}" ${a.m === k ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>
    <label class="fld">Potencia<select data-hap="pot">${Object.entries(POT).map(([k, p]) => `<option value="${k}" ${a.pot === k ? 'selected' : ''}>${p.n}</option>`).join('')}</select></label>
    ${L.cal && L.cal.por && L.cal.por[a.id] ? `<p class="hnota" style="margin-bottom:8px">Calibrado: llega ${L.cal.por[a.id] > 0 ? '+' : ''}${dec(L.cal.por[a.id])} dB respecto del resto.</p>` : ''}
    <button class="btn sm danger" data-h="borrasel">Sacar este AP</button></div>`; }
  else if (s && s.k === 'p') { const w = s.o; sel = `<div class="card"><h3>Pared · ${dec(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]))} m</h3>
    <label class="fld">Material<select data-hpa="m">${Object.entries(MAT).map(([k, m]) => `<option value="${k}" ${w.m === k ? 'selected' : ''}>${esc(m.n)} · ${m.a[B.i]} dB</option>`).join('')}</select></label>
    <button class="btn sm danger" data-h="borrasel">Borrar la pared</button></div>`; }
  else if (s && s.k === 'm') { const p = s.o, m = mejorDe(L, p), R = (p.redes || []).slice().sort((a, b) => b.r - a.r).slice(0, 8);
    sel = `<div class="card"><h3>${p.cam ? 'Lectura del recorrido' : 'Punto medido'}</h3>
    ${p.cam ? '' : `<label class="fld">Señal (dBm)<input data-hpm="rssi" type="number" inputmode="numeric" min="-100" max="-20" value="${p.rssi == null ? '' : p.rssi}" placeholder="-60"></label>`}
    <div class="hst" style="margin-bottom:8px">${m ? `<span>Mejor señal${L.ssid !== '*' && (L.ssid || p.ssid) ? ' de ' + esc(L.ssid || p.ssid) : ''}</span><b>${dec(m.r, 0)} dBm</b>` : ''}<span>Velocidad</span><b>${p.mbps == null ? '—' : dec(p.mbps) + ' Mbps'}</b><span>Latencia</span><b>${p.ms == null ? '—' : dec(p.ms, 0) + ' ms'}</b>${p.ruido ? `<span>Ruido</span><b>${p.ruido} dBm</b>` : ''}</div>
    ${R.length ? `<div class="hcats" style="margin-bottom:8px">${R.map(r => `<div><i style="background:${PALETA[apIdx(L, grupoAP(r)) % PALETA.length]}"></i><span>${esc(r.s || 'red oculta')} · c${r.c}</span><span>${r.r}</span></div>`).join('')}</div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:6px">${ayListo() && !p.cam ? '<button class="btn sm" data-h="leerw">Leer el wifi de esta compu</button>' : ''}<button class="btn sm" data-h="medirv">${L.midiendo ? 'Midiendo…' : 'Medir velocidad'}</button><button class="btn sm danger" data-h="borrasel">Borrar</button></div>
    ${ayListo() || p.cam ? '' : '<p class="hnota" style="margin-top:8px">La señal se lee sola con Ondi Scanner abierto en la laptop. En el celular, copiala de una app como WiFiman: el navegador no la deja leer.</p>'}</div>`; }
  let num = '';
  if (L.tipo === 'wifi') { const c = L.aps.length ? cobertura(L) : null, U = UMBRAL.find(x => x[0] === +L.umbral) || UMBRAL[0];
    num = `<div class="card"><h3>Lo que necesita el cliente</h3>
      <label class="fld">Para qué se usa<select id="hlumb">${UMBRAL.map(([v, n, d]) => `<option value="${v}" ${+L.umbral === v ? 'selected' : ''}>${n} · ${d}</option>`).join('')}</select></label>
      <div class="hrow"><label class="fld">Con qué equipo<select id="hleq">${Object.entries(EQUIPO).map(([k, e]) => `<option value="${k}" ${L.equipo === k ? 'selected' : ''}>${e.n}</option>`).join('')}</select></label>
      <label class="fld">Altura de los AP<input id="hlalt" type="number" min="2" max="15" step="0.1" value="${L.altAP}" inputmode="decimal"></label></div></div>
      <div class="card"><h3>${VISTAS.wifi.find(x => x[0] === L.ver)[1]} · ${B.n}</h3>${legenda(L)}
      ${L.aps.length && !L.aps.some(a => (APM[a.m] || APM.gen).p[B.i]) ? `<p class="hnota" style="margin-top:8px"><b>Ningún AP de este plano tiene ${B.n}.</b> Elegí un modelo que la tenga (por ejemplo UniFi U7 Pro).</p>` : ''}
      ${c ? `<div class="hst" style="margin-top:10px"><span>Cubierto para ${esc(U[1].toLowerCase())} (≥ ${U[0]})</span><b>${Math.round(c.ok * 100)} %</b><span>Para navegar (≥ -75)</span><b>${Math.round(c.b75 * 100)} %</b><span>Sin señal útil (&lt; -80)</span><b>${Math.round(c.m80 * 100)} %</b><span>Access points</span><b>${L.aps.length}</b></div>` : '<p class="hnota" style="margin-top:8px">Tocá el plano para poner un access point, o «Ubicar solos».</p>'}
      ${L.ver === 'senal' && c ? '<p class="hnota" style="margin-top:6px">La línea punteada marca hasta dónde llega lo que necesita el cliente.</p>' : ''}</div>
      <div class="card"><h3>${L.cal ? 'Calibrado con lo medido' : 'Qué tan real es'}</h3>${L.cal ? `<div class="hcal"><span>Con ${L.cal.pts} mediciones del ${esc(L.cal.f)}: el predictivo erraba <b>±${dec(L.cal.e0)} dB</b>, ahora <b>±${dec(L.cal.e1)} dB</b>.</span>
        <span class="muted">Caída con la distancia ${dec(L.cal.n, 2)} · paredes ×${dec(L.cal.k, 2)} · ajuste general ${L.cal.off > 0 ? '+' : ''}${dec(L.cal.off)} dB</span></div><button class="btn sm" data-h="sincal" style="margin-top:8px">Volver al modelo sin calibrar</button>`
        : '<p class="hnota">Es una estimación con potencias de hoja de datos y pérdidas típicas por pared. Para que quede igual a la realidad, medí el lugar en «Mapa de calor» y tocá «Calibrar el predictivo»: el modelo se ajusta solo a lo que midió el equipo.</p>'}</div>`;
    if (L.aps.length) num += `<div class="card"><h3>Access points</h3><div class="hlist">${L.aps.map((a, i) => `<button data-hsel="a${i}" class="${s && s.o === a ? 'on' : ''}"><span style="display:flex;gap:8px;align-items:center">${L.ver === 'ap' ? `<i style="width:10px;height:10px;border-radius:3px;background:${PALETA[i % PALETA.length]}"></i>` : ''}${esc(a.nom || 'AP ' + (i + 1))}</span><span class="muted">${esc((APM[a.m] || APM.gen).n)}</span></button>`).join('')}</div></div>`; }
  else { const P = L.puntos, vv = L.ver === 'ap' ? [] : P.map(p => valor(L, p)).filter(x => x != null), u = { vel: ' Mbps', lat: ' ms', snr: ' dB', inter: '', dif: ' dB' }[L.ver] ?? ' dBm', redes = redesVistas(L), nombre = VISTAS.calor.find(x => x[0] === L.ver)[1];
    const peor = L.ver === 'lat' || L.ver === 'inter', est = L.ver === 'dif' ? [['Diferencia promedio', '±' + dec(vv.reduce((a, b) => a + Math.abs(b), 0) / (vv.length || 1)) + u]] : [['Mejor', dec(peor ? Math.min(...vv) : Math.max(...vv), 0) + u], ['Peor', dec(peor ? Math.max(...vv) : Math.min(...vv), 0) + u], ['Promedio', dec(vv.reduce((a, b) => a + b, 0) / vv.length, 0) + u]];
    num = `<div class="card"><h3>${nombre}</h3>${legenda(L)}
      ${L.ver === 'ap' ? `<div class="hcats" style="margin-top:8px">${apsMedidos(L).map(e => `<div><i style="background:${PALETA[apIdx(L, e.g) % PALETA.length]}"></i><span>${esc(e.s || 'red oculta')} · c${e.c} · ${esc(e.g.replace(/·.*/, '').slice(-8))}</span><span>${e.max} dBm</span></div>`).join('') || '<span class="muted">Sin lecturas con access points</span>'}</div>` : ''}
      ${vv.length ? `<div class="hst" style="margin-top:10px"><span>Lecturas</span><b>${vv.length}</b>${est.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}${L.ver === 'senal' ? `<span>Con ≥ ${+L.umbral || -67} dBm</span><b>${Math.round(vv.filter(x => x >= (+L.umbral || -67)).length / vv.length * 100)} %</b>` : ''}</div>` : L.ver === 'ap' ? '' : `<p class="hnota" style="margin-top:8px">${L.ver === 'vel' || L.ver === 'lat' ? 'Usá «Medir acá» en algunos lugares: la velocidad se mide parado.' : L.ver === 'dif' ? 'Elegí abajo el predictivo con el que comparar.' : 'Tocá «Caminar midiendo» y recorré el lugar, o medí punto por punto.'}</p>`}
      ${L.ver === 'senal' || L.ver === 'snr' || L.ver === 'inter' ? '<p class="hnota" style="margin-top:6px">' + { senal: 'La mejor señal de la red elegida en cada lugar. La línea punteada marca hasta dónde llega lo que necesita el cliente.', snr: 'Cuánto sobresale la señal del ruido. Arriba de 25 dB anda bien; abajo de 15 se corta.', inter: 'Cuántos otros access points se escuchan en el mismo canal. Con 2 o más, se pisan y anda lento.' }[L.ver] + '</p>' : ''}</div>
      <div class="card"><h3>La medición</h3>
      <label class="fld">Red<select id="hlssid"><option value="" ${!L.ssid ? 'selected' : ''}>La que estaba conectada</option><option value="*" ${L.ssid === '*' ? 'selected' : ''}>Todas las redes</option>${redes.map(([s]) => `<option value="${esc(s)}" ${L.ssid === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <div class="hrow"><label class="fld">Lo que necesita<select id="hlumb">${UMBRAL.map(([v, n]) => `<option value="${v}" ${+L.umbral === v ? 'selected' : ''}>${n} (${v})</option>`).join('')}</select></label>
      <label class="fld">Corrección del equipo<input id="hlcorr" type="number" step="1" min="-15" max="15" value="${+L.corr || 0}" inputmode="numeric" title="dB que se suman a lo medido"></label></div>
      <p class="hnota">Cada placa wifi lee distinto. Si medís con una notebook y el cliente usa celulares, restale unos 4 dB.</p>
      <label class="hchk"><input type="checkbox" data-h="auto" ${L.auto ? 'checked' : ''}> Medir velocidad al tocar «Medir acá»</label></div>
      <div class="card"><h3>Comparar con el predictivo</h3>
      <label class="fld">Predictivo<select id="hlref"><option value="">Ninguno</option>${LZ.wifi.aps.length ? `<option value="abierto" ${L.ref && L.ref.id === 'abierto' ? 'selected' : ''}>El que está abierto en Wifi predictivo</option>` : ''}${(EST.wifi.lista || []).filter(e => !L.site || !e.site_id || e.site_id === L.site).map(e => `<option value="${esc(e.id)}" ${L.ref && L.ref.id === e.id ? 'selected' : ''}>${esc(e.nombre || 'Sin nombre')}</option>`).join('')}</select></label>
      ${L.refL ? `<p class="hnota" style="margin-bottom:8px">Los APs del predictivo se ven en gris. ${L.refL.cal ? `Ya está calibrado (±${dec(L.refL.cal.e1)} dB).` : 'Todavía no está calibrado.'}</p><button class="btn sm pri" data-h="calibrar">Calibrar el predictivo con lo medido</button>
        ${L.calRes ? `<div class="hcal" style="margin-top:8px">${L.calRes.error ? esc(L.calRes.error) : `<span>Antes erraba <b>±${dec(L.calRes.e0)} dB</b>; calibrado, <b>±${dec(L.calRes.e1)} dB</b> (${L.calRes.pts} lecturas).</span><span class="muted">Abrí «Wifi predictivo» para verlo${L.calRes.guardado ? '; ya quedó guardado' : ' y guardalo'}.</span>`}</div>` : ''}`
        : '<p class="hnota">Con un predictivo del mismo plano se ve dónde la realidad difiere y se lo puede calibrar.</p>'}</div>`; }
  el.innerHTML = sel + num; }

function lienzoHtml(L) {
  const sites = A.S.sites || [], E = EST[L.tipo], walk = CAM.activo && CAM.L === L, v11 = AY.est && AY.est.version && AY.est.version >= '1.1';
  const herrs = L.tipo === 'wifi' ? [['mover', 'Mover'], ['ap', 'Poner AP'], ['pared', 'Dibujar pared'], ['escala', 'Medir escala'], ['borrar', 'Borrar']] : [['mover', 'Mover'], ['caminar', 'Caminar midiendo'], ['medir', 'Medir acá'], ['pared', 'Dibujar pared'], ['escala', 'Medir escala'], ['borrar', 'Borrar']];
  const ayuda = { mover: 'Arrastrá para mover el plano o un elemento. Rueda o dos dedos para acercar.', ap: 'Tocá donde va colgado cada access point.', pared: 'Arrastrá de punta a punta de cada pared. Se acomoda a 90° sola.', escala: 'Trazá una línea sobre algo que sepas cuánto mide (una pared, un portón).', borrar: 'Tocá lo que quieras sacar.',
    medir: 'Parate en un lugar, tocá en el plano dónde estás y medí.', caminar: walk ? 'Tocá el plano cada vez que llegues a una esquina o cambies de dirección. Caminá a paso parejo.' : 'Tocá dónde arrancás y caminá a paso parejo con la laptop abierta. Ondi Scanner lee todos los access points cada segundo.' }[L.herr];
  const vistas = VISTAS[L.tipo].filter(([k]) => k !== 'dif' || L.refL);
  const conAy = L.tipo === 'calor' && L.herr === 'caminar'; // el cartel de Ondi Scanner solo con «Caminar midiendo»
  return `<div class="hwrap">${conAy && !walk ? ayHtml('Medir caminando') : ''}${conAy && ayListo() && !v11 ? '<div class="hay"><b>Pasate a Ondi Scanner</b><span class="muted">Lee todos los access points con su señal real.</span><a class="btn sm" href="../scanner/" target="_blank" rel="noopener">Bajarlo</a></div>' : ''}
    <div class="card pad"><div class="hbar">
      <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Cliente<select id="hlcli" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);max-width:200px"><option value="">Sin cliente</option>${sites.map(s => `<option value="${esc(s.id)}" ${L.site === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Estudio<select id="hlest" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);max-width:220px"><option value="">${L.id ? '' : 'Nuevo, sin guardar'}</option>${(E.lista || []).filter(e => !L.site || e.site_id === L.site).map(e => `<option value="${esc(e.id)}" ${L.id === e.id ? 'selected' : ''}>${esc(e.nombre || 'Sin nombre')}</option>`).join('')}</select></label>
      <span class="grow"></span><button class="btn sm" data-h="nuevo">Nuevo</button><button class="btn sm pri" data-h="guardar">${L.cambio || !L.id ? 'Guardar' : 'Guardado'}</button><button class="btn sm" data-h="png">Bajar imagen</button></div>
      <div class="hbar" style="margin-top:10px"><span class="muted" style="font-size:13px">Plano</span>
        ${L.site ? `<button class="btn sm" data-h="plcli">Usar el plano del cliente</button>` : ''}<label class="btn sm" style="cursor:pointer">Subir imagen<input type="file" accept="image/*" id="hlimg" hidden></label>${L.fondo ? '<button class="btn sm" data-h="sinplano">Sacar el plano</button>' : ''}
        <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Ancho<input id="hlancho" type="number" min="2" max="1000" step="0.5" value="${dec(L.anchoM)}" style="width:72px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"> m</label>
        ${L.fondo ? '' : `<label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Largo<input id="hlalto" type="number" min="2" max="1000" step="0.5" value="${dec(L.altoM)}" style="width:72px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"> m</label>`}</div></div>
    <div class="hl"><div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0">
      <div class="hbar"><div class="hseg" role="group" aria-label="Herramienta">${herrs.map(([k, n]) => `<button data-hherr="${k}" aria-pressed="${L.herr === k}">${n}</button>`).join('')}</div>
        ${L.tipo === 'wifi' ? `<div class="hseg" role="group" aria-label="Banda">${ORDEN_B.map(k => `<button data-hband="${k}" aria-pressed="${L.banda === k}">${BANDAS[k].n}</button>`).join('')}</div>` : ''}</div>
      <div class="hbar"><div class="hseg" role="group" aria-label="Qué mostrar">${vistas.map(([k, n]) => `<button data-hver="${k}" aria-pressed="${L.ver === k}">${n}</button>`).join('')}</div>
        ${L.herr === 'pared' ? `<label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Material<select id="hlmat" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${Object.entries(MAT).map(([k, m]) => `<option value="${k}" ${L.mat === k ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>` : ''}
        ${L.tipo === 'wifi' ? `<label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Modelo<select id="hlmod" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${Object.entries(APM).map(([k, m]) => `<option value="${k}" ${L.modelo === k ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select></label>
          <label class="muted" style="font-size:13px;display:flex;gap:6px;align-items:center">Lugar<select id="hlamb" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${Object.entries(AMB).map(([k, a]) => `<option value="${k}" ${L.amb === k ? 'selected' : ''}>${a.n}</option>`).join('')}</select></label>
          <button class="btn sm" data-h="sugerir">Ubicar APs solos</button>` : ''}</div>
      ${walk ? '<div class="hwalk" id="hwalk"></div>' : ''}
      <div class="hcv"><canvas id="hcanvas" data-t="${L.tipo}" aria-label="Plano"></canvas><div class="hzoom"><button data-hz="1.25" aria-label="Acercar">+</button><button data-hz="0.8" aria-label="Alejar">−</button><button data-hz="0" aria-label="Ver todo" style="font-size:12px">⤢</button></div></div><p class="hayu">${esc(ayuda)}</p>
      ${L.escala ? `<form class="hay" data-hf="escala"><b>Esa línea mide</b><input id="hlesc" type="number" step="0.01" min="0.1" inputmode="decimal" style="width:90px;letter-spacing:0" autofocus> <span>metros</span><button class="btn sm pri" type="submit">Ajustar la escala</button><button class="btn sm" type="button" data-h="escno">Cancelar</button></form>` : ''}
    </div><div class="hside" id="hlado"></div></div></div>`; }

// tocar y arrastrar en el plano
function lienzoEventos(L) {
  const cv = $('#hcanvas'); if (!cv) return; const P = new Map(); let dr = null, pinch = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const tocar = (V, px, py) => { const R = 16;
    for (const a of L.aps) { const [x, y] = aPan(V, a.x, a.y); if (Math.hypot(px - x, py - y) < R) return { k: 'a', o: a }; }
    for (let i = L.puntos.length - 1; i >= 0; i--) { const p = L.puntos[i], [x, y] = aPan(V, p.x, p.y); if (Math.hypot(px - x, py - y) < (p.cam ? 8 : R)) return { k: 'm', o: p }; }
    for (const w of L.paredes) { const [ax, ay] = aPan(V, ...w.a), [bx, by] = aPan(V, ...w.b), dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); if (Math.hypot(px - ax - t * dx, py - ay - t * dy) < 9) return { k: 'p', o: w }; }
    return null; };
  const iman = (L, p, desde) => { let [x, y] = p; for (const w of L.paredes) for (const q of [w.a, w.b]) if (Math.hypot(q[0] - x, q[1] - y) < .35) return [q[0], q[1]];
    if (desde) { const dx = x - desde[0], dy = y - desde[1], ang = Math.atan2(dy, dx), r = Math.hypot(dx, dy), s = Math.round(ang / (Math.PI / 2)) * Math.PI / 2; if (Math.abs(ang - s) < .1) { x = desde[0] + Math.cos(s) * r; y = desde[1] + Math.sin(s) * r; } }
    return [clamp(x, 0, L.anchoM), clamp(y, 0, L.altoM)]; };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); P.set(e.pointerId, pos(e));
    if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: L.z, ox: L.ox, oy: L.oy, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; dr = null; L.trazo = null; return; }
    const V = vista(L, cv), [px, py] = pos(e), w = aMundo(V, px, py), t = tocar(V, px, py), dentro = [clamp(w[0], 0, L.anchoM), clamp(w[1], 0, L.altoM)];
    if (L.herr === 'caminar') { if (CAM.activo && CAM.L === L) camPunto(L, ...dentro); else camEmpezar(L, ...dentro); return; }
    if (L.herr === 'borrar') { if (t) { borrar(L, t); } return; }
    if (L.herr === 'pared' || L.herr === 'escala') { const a = L.herr === 'pared' ? iman(L, w) : w; dr = { k: 'trazo' }; L.trazo = { a, b: a }; return; }
    if (t && (L.herr === 'mover' || L.herr === 'ap' || L.herr === 'medir') && t.k !== 'p') { L.sel = t; dr = { k: 'mueve', o: t.o, d0: [px, py], movio: false }; dibujar(L); return; }
    if (t && t.k === 'p') { L.sel = t; dibujar(L); return; }
    if (L.herr === 'ap') { const a = { id: nid(), m: L.modelo, pot: L.pot, x: dentro[0], y: dentro[1] }; L.aps.push(a); L.sel = { k: 'a', o: a }; L.cambio = true; dibujar(L, true); return; }
    if (L.herr === 'medir') { const p = { x: dentro[0], y: dentro[1], rssi: null, mbps: null, ms: null, t: Date.now(), redes: [] }; L.puntos.push(p); L.sel = { k: 'm', o: p }; L.cambio = true; dibujar(L, true); medirPunto(L, p); return; }
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

// medir parado en un punto: el wifi (con el ayudante), la velocidad y la latencia
const GRANDE = '../../olumi/beta/3d/of-m.glb', CHICO = 'elegir.js';
async function medirVel() { const t = [];
  for (let i = 0; i < 4; i++) { const t0 = performance.now(); await fetch(CHICO + '?p=' + Math.random(), { cache: 'no-store' }).then(r => r.text()); t.push(performance.now() - t0); }
  t.sort((a, b) => a - b); const t0 = performance.now(); const bs = await Promise.all([0, 1].map(() => fetch(GRANDE + '?v=' + Math.random(), { cache: 'no-store' }).then(r => r.arrayBuffer())));
  const s = (performance.now() - t0) / 1000, bytes = bs.reduce((a, b) => a + b.byteLength, 0); return { ms: t[1], mbps: bytes * 8 / s / 1e6 }; }
async function leerWifi(p) { const w = normW(await ayWifi()); if (!w) return false; Object.assign(p, aPunto(w, p.x, p.y, 0), { mbps: p.mbps, ms: p.ms, t: p.t }); delete p.cam; return w.actual && w.actual.rssi != null || (w.redes || []).length; }
async function medirPunto(L, p) {
  if (ayListo()) { try { await leerWifi(p); } catch (e) {} dibujar(L, true); }
  if (!L.auto) return; L.midiendo = true; dibujar(L, true);
  try { const r = await medirVel(); p.mbps = Math.round(r.mbps * 10) / 10; p.ms = Math.round(r.ms); } catch (e) { A.toast('No se pudo medir la velocidad: ¿hay conexión?'); }
  L.midiendo = false; L.cambio = true; dibujar(L, true); }

// guardar y abrir estudios
const EST = { wifi: { lista: null }, calor: { lista: null } };
const faltaTabla = e => /ondi_estudios|relation .* does not exist|schema cache/i.test((e && (e.message || e.details)) || '');
async function estListar(tipo) { const r = await A.SB.from('ondi_estudios').select('id,nombre,site_id,updated_at').eq('org_id', A.orgId()).eq('tipo', tipo).order('updated_at', { ascending: false }).limit(200);
  EST[tipo].lista = r.error ? [] : r.data; EST[tipo].falta = r.error && faltaTabla(r.error); montar(); }
function aDatos(L) { return { fondo: L.fondo && L.fondo.src === 'img' ? L.fondo : L.fondo ? { src: L.fondo.src, w: L.fondo.w, h: L.fondo.h } : null, anchoM: L.anchoM, altoM: L.altoM, paredes: L.paredes, aps: L.aps, puntos: L.puntos,
  amb: L.amb, banda: L.banda, umbral: L.umbral, equipo: L.equipo, altAP: L.altAP, cal: L.cal, ssid: L.ssid, corr: L.corr, ref: L.ref }; }
async function estGuardar(L, callado) {
  if (EST[L.tipo].falta) { A.toast('Falta preparar la base para guardar estudios (ondi-1.4.sql)'); return false; }
  if (!L.nombre) { const s = (A.S.sites || []).find(x => x.id === L.site); L.nombre = (L.tipo === 'wifi' ? 'Wifi' : 'Medición') + (s ? ' · ' + s.name : '') + ' · ' + new Date().toLocaleDateString('es-UY'); }
  const row = { org_id: A.orgId(), site_id: L.site || null, tipo: L.tipo, nombre: L.nombre, data: aDatos(L), updated_at: new Date().toISOString() };
  const r = L.id ? await A.SB.from('ondi_estudios').update(row).eq('org_id', A.orgId()).eq('id', L.id).select('id').single() : await A.SB.from('ondi_estudios').insert(row).select('id').single();
  if (r.error) { A.toast(faltaTabla(r.error) ? 'Falta preparar la base para guardar estudios (ondi-1.4.sql)' : A.errTxt(r.error)); return false; }
  L.id = r.data.id; L.cambio = false; if (!callado) A.toast('Estudio guardado'); estListar(L.tipo); return true; }
async function estTraer(tipo, id) { const r = await A.SB.from('ondi_estudios').select('*').eq('org_id', A.orgId()).eq('id', id).single(); if (r.error) { A.toast(r.error.message); return null; }
  const d = r.data.data || {}, L = Object.assign(nuevo(tipo), d, { id: r.data.id, nombre: r.data.nombre, site: r.data.site_id || '', herr: 'mover' });
  L.aps.forEach(a => { if (!a.id) a.id = nid(); }); if (L.fondo && L.fondo.src === 'plano' && L.site) await planoCliente(L, true); return L; }
async function estAbrir(tipo, id) { const L = await estTraer(tipo, id); if (!L) return; LZ[tipo] = L; L.cambio = false; if (tipo === 'calor' && L.ref) await refPoner(L, L.ref.id, true); montar(); }
async function planoCliente(L, callado) { const st = (A.S.sites || []).find(s => s.id === L.site); if (!st) return;
  const r = await A.SB.from('ondi_planos').select('data').eq('org_id', st.org_id).eq('site_id', st.id).maybeSingle();
  if (!r.data || !r.data.data) { if (!callado) A.toast('Ese cliente todavía no tiene plano cargado'); return; }
  L.fondo = Object.assign({ w: 0, h: 0 }, L.fondo && L.fondo.src === 'plano' ? { w: L.fondo.w, h: L.fondo.h } : {}, { src: 'plano', data: r.data.data }); L.z = 1; L.ox = L.oy = null; if (!callado) L.cambio = true; }
// el predictivo con el que se compara lo medido
async function refPoner(L, id, callado) { L.calRes = null;
  if (!id) { L.ref = null; L.refL = null; if (L.ver === 'dif') L.ver = 'senal'; return; }
  const R = id === 'abierto' ? LZ.wifi : (LZ.wifi.id === id ? LZ.wifi : await estTraer('wifi', id)); if (!R) return;
  L.ref = { id, nombre: R.nombre || '' }; L.refL = R; if (!callado) L.cambio = true;
  if (!L.puntos.length && !L.paredes.length) { L.fondo = R.fondo ? Object.assign({}, R.fondo) : null; L.anchoM = R.anchoM; L.altoM = R.altoM; L.paredes = R.paredes.map(w => ({ a: [...w.a], b: [...w.b], m: w.m })); L.z = 1; L.ox = L.oy = null; L.site = L.site || R.site; L.banda = R.banda; }
  else if (Math.abs(R.anchoM - L.anchoM) > .5 && !callado) A.toast('Ojo: el predictivo tiene otra escala (' + dec(R.anchoM) + ' m de ancho). Para comparar, los dos tienen que tener el mismo plano.');
  if (!L.paredes.length && R.paredes.length) L.paredes = R.paredes.map(w => ({ a: [...w.a], b: [...w.b], m: w.m })); }
async function hacerCalibrar(L) { const R = L.refL; if (!R) return; const c = calibrar(R, L); L.calRes = c;
  if (!c.error) { R.cal = c; R.cambio = true; R._campo = null; LZ.wifi = R; if (R.id) c.guardado = await estGuardar(R, true); A.toast(`Predictivo calibrado: de ±${dec(c.e0)} a ±${dec(c.e1)} dB`); }
  L._campo = null; montar(); }
function subirImagen(L, f) { if (!f) return; const rd = new FileReader();
  rd.onload = () => { const im = new Image(); im.onload = () => { const m = 1800, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); L.fondo = { src: 'img', data: c.toDataURL('image/jpeg', .82), w: c.width, h: c.height }; L.altoM = L.anchoM * c.height / c.width; L.z = 1; L.ox = L.oy = null; L.cambio = true; L.herr = 'escala'; montar(); A.toast('Ahora trazá una línea sobre algo que sepas cuánto mide'); };
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
  return { M, mp, W, H, hf, vfr: vf, vf: vf * 180 / Math.PI, tilt, ppm: ppm(slant), slant, dori: DORI.map(d => W / (2 * Math.tan(h / 2) * d[1])), ancho: 2 * slant * Math.tan(h / 2), ciego, ir: M[4], luz: M[5] }; }
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
  return `<div class="hwrap"><div class="hbar"><p class="hnota" style="flex:1;min-width:220px">Elegí la cámara, la lente y dónde va. La imagen es la maqueta 3D vista desde esa cámara, con su perspectiva y sus píxeles reales; el recuadro es el zoom digital a la persona. Los ángulos son los típicos de hoja de datos: antes de cotizar confirmá con la del modelo exacto.</p>
    <button class="btn sm${CA.comparar ? ' pri' : ''}" data-h="camcmp" aria-pressed="${CA.comparar}">${CA.comparar ? 'Dejar de comparar' : 'Comparar con otra cámara'}</button></div>
    <div class="${CA.comparar ? 'hcam' : ''}" style="display:grid;grid-template-columns:minmax(0,1fr);gap:16px">${CA.lista.slice(0, n).map((c, i) => `<div class="card pad" style="display:grid;grid-template-columns:minmax(0,1fr);gap:14px;min-width:0">${camCfgHtml(c, i)}<div id="hcres${i}"></div></div>`).join('')}</div></div>`; }
function camPintar(i) { const c = CA.lista[i], el = $('#hcres' + i); if (!el) return; const I = camInfo(c), noche = c.luz === 'noche', fuera = noche && I.slant > I.ir;
  const nivel = DORI.find(d => I.ppm >= d[1]), m = (v, n = 1) => v >= 100 ? dec(v, 0) : dec(v, n);
  el.innerHTML = `<div class="hver${C3.M ? '' : ' cargando'}"><span class="hcarga">Armando la escena 3D…</span><canvas id="hcv${i}" width="960" height="540"></canvas><span class="hlab">${m(I.ppm, 0)} px/m a ${m(I.slant)} m</span><div class="hzi"><canvas id="hcz${i}" width="300" height="360"></canvas></div></div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">
      <div><b style="font-size:15px">${fuera ? 'Fuera del alcance de la luz' : nivel ? esc(nivel[0]) : 'No se distingue'}</b><p class="hnota" style="margin-top:2px">${fuera ? `De noche ${I.luz === 'color' ? 'la luz blanca' : 'el infrarrojo'} llega a unos ${I.ir} m; la persona está a ${m(I.slant)} m.` : nivel ? `A ${m(I.slant)} m ${esc(nivel[3])}.` : `A ${m(I.slant)} m la persona ocupa muy pocos píxeles.`}</p>
        <div class="hst" style="margin-top:8px"><span>Ángulo</span><b>${dec(I.hf, 0)}° × ${dec(I.vf, 0)}°</b><span>Ancho que cubre a esa distancia</span><b>${m(I.ancho)} m</b><span>Resolución</span><b>${I.W} × ${I.H}</b><span>Debajo de la cámara no se ve</span><b>${I.ciego < .2 ? '—' : 'hasta ' + m(I.ciego) + ' m'}</b><span>${I.luz === 'color' ? 'Luz blanca' : 'Infrarrojo'}</span><b>${I.ir} m</b></div></div>
      <div><b style="font-size:13px" class="muted">Hasta dónde alcanza (norma IEC 62676-4)</b><div class="hdori" style="margin-top:6px">${DORI.map((d, j) => `<div><i style="background:${d[2]}"></i><span>${d[0]}</span><b>${m(I.dori[j])} m</b></div>`).join('')}</div></div></div>
    <div class="hlados"><div><b class="muted" style="font-size:12.5px">Desde arriba</b><div class="hsvg">${camPlanta(I, c)}</div></div><div><b class="muted" style="font-size:12.5px">De costado</b><div class="hsvg">${camPerfil(I, c)}</div></div></div>`;
  camEscena(i, c, I); }
function camPlanta(I, c) { // de arriba: el abanico con los rangos de distancia
  const R = Math.max(I.dori[2] * 1.25, c.dist * 1.3, 6), W = 360, Hh = 220, k = (W - 40) / R, cx = 22, cy = Hh / 2, h = Math.min(I.hf, 170) * Math.PI / 360;
  const arco = (r, col, op) => { const x = cx + r * k * Math.cos(h), y1 = cy - r * k * Math.sin(h), y2 = cy + r * k * Math.sin(h); return `<path d="M${cx} ${cy}L${x} ${y1}A${r * k} ${r * k} 0 0 1 ${x} ${y2}Z" fill="${col}" fill-opacity="${op}"/>`; };
  const paso = [1, 2, 5, 10, 20, 50].find(s => R / s <= 5) || 50, anillos = []; for (let r = paso; r < R; r += paso) anillos.push(r);
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Vista de arriba de lo que cubre la cámara"><defs><clipPath id="hcc"><rect x="0" y="0" width="${W}" height="${Hh}"/></clipPath></defs><g clip-path="url(#hcc)">
    ${anillos.map(r => `<circle cx="${cx}" cy="${cy}" r="${r * k}" fill="none" stroke="currentColor" stroke-opacity=".14"/><text x="${cx + r * k + 3}" y="${cy - 4}" font-size="10" fill="currentColor" opacity=".55">${r} m</text>`).join('')}
    ${DORI.slice().reverse().map((d, j) => arco(I.dori[3 - j], d[2], j === 0 ? .18 : .42)).join('')}
    ${c.luz === 'noche' ? `<circle cx="${cx}" cy="${cy}" r="${I.ir * k}" fill="none" stroke="currentColor" stroke-dasharray="4 4" opacity=".6"/>` : ''}
    ${I.ciego > .2 ? `<path d="M${cx} ${cy}L${cx + I.ciego * k * Math.cos(h)} ${cy - I.ciego * k * Math.sin(h)}A${I.ciego * k} ${I.ciego * k} 0 0 1 ${cx + I.ciego * k * Math.cos(h)} ${cy + I.ciego * k * Math.sin(h)}Z" fill="currentColor" opacity=".22"/>` : ''}
    <g transform="translate(${cx + c.dist * k} ${cy})"><circle r="5" fill="currentColor"/><circle r="9" fill="none" stroke="currentColor" stroke-opacity=".5"/></g>
    <rect x="${cx - 14}" y="${cy - 6}" width="16" height="12" rx="3" fill="currentColor"/></g></svg>`; }
function camPerfil(I, c) { // de costado: la altura, para dónde mira y la zona ciega de abajo
  const R = Math.max(c.dist * 1.35, 8), W = 360, Hh = 220, Hm = Math.max(c.alt * 1.5, 4), k = Math.min((W - 40) / R, (Hh - 30) / Hm), x0 = 24, y0 = Hh - 18, P = (x, y) => [x0 + x * k, y0 - y * k];
  const t1 = I.tilt - I.vfr / 2, t2 = I.tilt + I.vfr / 2, lejos = t1 > .01 ? Math.min(R, c.alt / Math.tan(t1)) : R, cerca = I.ciego;
  const [cxp, cyp] = P(0, c.alt), [fx, fy] = P(lejos, t1 > .01 ? 0 : Math.max(0, c.alt - R * Math.tan(t1))), [nx, ny] = P(cerca, 0), [px, py] = P(c.dist, 0), [hx, hy] = P(c.dist, 1.75);
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Vista de costado de la cámara">
    <path d="M${cxp} ${cyp}L${nx} ${ny}L${fx} ${fy}Z" fill="${DORI[1][2]}" fill-opacity=".35"/>
    <line x1="${x0 - 10}" y1="${y0}" x2="${W}" y2="${y0}" stroke="currentColor" stroke-opacity=".5"/>
    ${cerca > .2 ? `<line x1="${x0}" y1="${y0 + 6}" x2="${nx}" y2="${y0 + 6}" stroke="currentColor" stroke-width="3" stroke-opacity=".5"/><text x="${(x0 + nx) / 2}" y="${y0 + 16}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">no se ve ${dec(cerca)} m</text>` : ''}
    <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${cyp}" stroke="currentColor" stroke-width="3" stroke-opacity=".55"/>
    <rect x="${cxp - 6}" y="${cyp - 6}" width="16" height="10" rx="2" fill="currentColor" transform="rotate(${I.tilt * 180 / Math.PI} ${cxp} ${cyp})"/>
    <text x="${x0 + 6}" y="${cyp - 10}" font-size="10" fill="currentColor" opacity=".7">${dec(c.alt)} m</text>
    <line x1="${px}" y1="${py}" x2="${hx}" y2="${hy}" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="${hx}" cy="${hy - 5}" r="4.5" fill="currentColor"/>
    <text x="${px}" y="${y0 + 14}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">${dec(c.dist)} m</text></svg>`; }

/* ---------- la imagen simulada ----------
   La escena se arma en 3D simple (piso, un galpón al fondo, personas y un auto) y se proyecta con la altura,
   la inclinación y el ángulo de la cámara, a la resolución que tiene de verdad. */
function tono(hex, f) { const [r, g, b] = hex2(hex); return `rgb(${Math.round(clamp(r * f, 0, 255))},${Math.round(clamp(g * f, 0, 255))},${Math.round(clamp(b * f, 0, 255))})`; }
function persona(g, cx, pie, h, f, ropa) { // de frente; h = alto en píxeles, f = cuánta luz le llega
  const u = h / 175, T = (c, k = 1) => tono(c, f * k); g.save(); g.translate(cx, pie); g.scale(u, u);
  g.fillStyle = 'rgba(0,0,0,' + (.28 * Math.min(1, f)) + ')'; g.beginPath(); g.ellipse(0, 0, 26, 5, 0, 0, 7); g.fill(); // sombra
  g.fillStyle = T(ropa.pan); g.beginPath(); g.moveTo(-17, -92); g.lineTo(-2, -92); g.lineTo(-4, -4); g.lineTo(-15, -4); g.closePath(); g.moveTo(2, -92); g.lineTo(17, -92); g.lineTo(15, -4); g.lineTo(4, -4); g.closePath(); g.fill();
  g.fillStyle = T('#1d1d1d'); g.beginPath(); g.roundRect(-18, -6, 16, 6, 3); g.roundRect(2, -6, 16, 6, 3); g.fill(); // zapatos
  g.fillStyle = T(ropa.rem); g.beginPath(); g.moveTo(-22, -148); g.quadraticCurveTo(0, -153, 22, -148); g.lineTo(20, -90); g.lineTo(-20, -90); g.closePath(); g.fill(); // torso
  g.fillStyle = T(ropa.rem, .82); g.beginPath(); g.moveTo(-22, -147); g.quadraticCurveTo(-29, -142, -30, -128); g.lineTo(-27, -96); g.lineTo(-21, -96); g.lineTo(-20, -126); g.closePath(); g.moveTo(22, -147); g.quadraticCurveTo(29, -142, 30, -128); g.lineTo(27, -96); g.lineTo(21, -96); g.lineTo(20, -126); g.closePath(); g.fill(); // brazos
  g.fillStyle = T(ropa.piel); g.beginPath(); g.ellipse(-24, -92, 3.6, 4.6, 0, 0, 7); g.ellipse(24, -92, 3.6, 4.6, 0, 0, 7); g.fill(); g.fillRect(-4.5, -157, 9, 10); // manos y cuello
  g.fillStyle = T(ropa.rem, 1.25); g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText(ropa.txt || '', 0, -126);
  g.fillStyle = T(ropa.piel); g.beginPath(); g.ellipse(0, -169, 10.5, 13, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(-10.5, -168, 2, 3.2, 0, 0, 7); g.ellipse(10.5, -168, 2, 3.2, 0, 0, 7); g.fill(); // cara y orejas
  g.fillStyle = T(ropa.pelo); g.beginPath(); g.ellipse(0, -176, 11.2, 7.5, 0, Math.PI, 0); g.fill(); g.fillRect(-11.2, -177, 2.4, 6); g.fillRect(8.8, -177, 2.4, 6);
  g.fillStyle = T('#f4f1ea'); g.beginPath(); g.ellipse(-4.2, -170, 2.1, 1.3, 0, 0, 7); g.ellipse(4.2, -170, 2.1, 1.3, 0, 0, 7); g.fill();
  g.fillStyle = T('#2a1b12'); g.beginPath(); g.arc(-4.2, -170, 1, 0, 7); g.arc(4.2, -170, 1, 0, 7); g.fill(); g.fillRect(-6.4, -173.6, 4.4, .9); g.fillRect(2, -173.6, 4.4, .9); // ojos y cejas
  g.fillStyle = T(ropa.piel, .82); g.beginPath(); g.moveTo(0, -169); g.lineTo(-1.6, -164.5); g.lineTo(1.4, -164.5); g.fill(); g.fillStyle = T('#8c3b2e'); g.fillRect(-3.4, -161.6, 6.8, 1.2);
  g.restore(); }
function autoFrente(g, cx, piso, ancho, f, noche) { const u = ancho / 180, T = (c, k = 1) => tono(c, f * k); g.save(); g.translate(cx, piso); g.scale(u, u);
  g.fillStyle = 'rgba(0,0,0,' + (.3 * Math.min(1, f)) + ')'; g.beginPath(); g.ellipse(0, 0, 100, 8, 0, 0, 7); g.fill();
  g.fillStyle = T('#111'); g.fillRect(-84, -22, 22, 22); g.fillRect(62, -22, 22, 22); // ruedas
  g.fillStyle = T('#c9ced4'); g.beginPath(); g.moveTo(-90, -24); g.lineTo(-88, -70); g.lineTo(-60, -80); g.lineTo(60, -80); g.lineTo(88, -70); g.lineTo(90, -24); g.closePath(); g.fill();
  g.fillStyle = T('#9aa3ad'); g.beginPath(); g.moveTo(-62, -80); g.lineTo(-48, -128); g.lineTo(48, -128); g.lineTo(62, -80); g.closePath(); g.fill();
  g.fillStyle = noche ? T('#1a2028') : T('#4d6577'); g.beginPath(); g.moveTo(-56, -84); g.lineTo(-44, -123); g.lineTo(44, -123); g.lineTo(56, -84); g.closePath(); g.fill(); // parabrisas
  g.fillStyle = T('#2a2f36'); g.fillRect(-40, -62, 80, 16); g.fillStyle = noche ? '#fff8d8' : T('#eef2f5'); g.fillRect(-82, -66, 30, 12); g.fillRect(52, -66, 30, 12); // parrilla y faros
  g.fillStyle = T('#c9ced4', .8); g.fillRect(-95, -82, 10, 8); g.fillRect(85, -82, 10, 8);
  // patente Mercosur: 40 cm de ancho
  g.fillStyle = T('#ffffff'); g.fillRect(-20, -40, 40, 13); g.fillStyle = T('#1d3f9a'); g.fillRect(-20, -40, 40, 3.4);
  g.fillStyle = T('#111'); g.font = 'bold 7.4px monospace'; g.textAlign = 'center'; g.fillText('SBC 1234', 0, -29.6); g.restore(); }
function escena(g, I, c, sc, ox, oy, noche) {
  const W = I.W, H = I.H, foc = (W / 2) / Math.tan(I.hf * Math.PI / 360), t = I.tilt, h = c.alt, ct = Math.cos(t), st = Math.sin(t);
  const pr = (X, Y, Z) => { const yc = (Y - h) * ct + Z * st, zc = -(Y - h) * st + Z * ct; return zc <= .05 ? null : [W / 2 + foc * X / zc, H / 2 - foc * yc / zc, zc]; };
  const ir = I.luz === 'color' ? I.ir * 1.1 : I.ir, luz = d => noche ? clamp(Math.pow(ir / Math.max(1, d), 2) * .55, .05, 1.15) : 1; // de noche la luz de la cámara cae con la distancia
  g.save(); g.scale(sc, sc); g.translate(-ox, -oy);
  const hor = H / 2 - foc * Math.tan(t); // donde se juntan el piso y el cielo, lejísimos
  const cielo = g.createLinearGradient(0, Math.min(0, hor - H), 0, hor); cielo.addColorStop(0, noche ? '#06080c' : '#8fbde3'); cielo.addColorStop(1, noche ? '#11151c' : '#dbe7f0'); g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  const yP = Z => { const p = pr(0, 0, Z); return p ? p[1] : H; }, zs = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 70, 100, 200].filter(z => yP(z) < H * 1.2), top = Math.max(0, Math.min(H, hor));
  if (zs.length > 1) { const piso = g.createLinearGradient(0, H, 0, top); for (const z of zs) { const y = yP(z), s = clamp((H - y) / Math.max(1, H - top), 0, 1); const b = noche ? luz(z) * .9 : 1 - Math.min(.25, z / 400); piso.addColorStop(s, tono('#9b968c', b)); } g.fillStyle = piso; g.fillRect(0, top, W, H - top); }
  // la vereda a la izquierda y una línea amarilla en el piso: dan idea de profundidad
  const poli = (pts, col) => { const P = pts.map(q => pr(...q)); if (P.some(q => !q)) return; g.fillStyle = col; g.beginPath(); P.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); };
  const zF = Math.max(c.dist + 12, 26);
  for (let z = .6; z < zF; z *= 1.5) { const z2 = Math.min(zF, z * 1.5); poli([[-9, .12, z], [-4.2, .12, z], [-4.2, .12, z2], [-9, .12, z2]], tono('#bdb7ab', luz(z))); poli([[-4.2, 0, z], [-4.05, 0, z], [-4.05, .12, z], [-4.2, .12, z]], tono('#7d776c', luz(z))); poli([[.95, .005, z], [1.08, .005, z], [1.08, .005, z2], [.95, .005, z2]], tono('#d8a634', luz(z))); }
  // el galpón del fondo, con un portón y un cartel
  poli([[-40, 0, zF], [40, 0, zF], [40, 7.5, zF], [-40, 7.5, zF]], tono('#cfd3d8', luz(zF))); poli([[-40, 7.5, zF], [40, 7.5, zF], [40, 8.2, zF], [-40, 8.2, zF]], tono('#8d949c', luz(zF)));
  poli([[-6, 0, zF - .01], [-1, 0, zF - .01], [-1, 4.6, zF - .01], [-6, 4.6, zF - .01]], tono('#5f6973', luz(zF))); poli([[3, 0, zF - .01], [7.5, 0, zF - .01], [7.5, 4.6, zF - .01], [3, 4.6, zF - .01]], tono('#5f6973', luz(zF)));
  poli([[-2, 5.4, zF - .01], [6, 5.4, zF - .01], [6, 6.6, zF - .01], [-2, 6.6, zF - .01]], tono('#1f5fb0', luz(zF)));
  // las cosas paradas en el piso, de la más lejana a la más cercana
  const cosas = [{ X: .3, Z: c.dist, k: 'p', ropa: { rem: '#c23b2a', pan: '#2b3442', piel: '#d9a37e', pelo: '#2a1d14', txt: 'ONDI' } }, { X: 2.9, Z: c.dist + 1.2, k: 'a' }, { X: -2.6, Z: c.dist * 1.9 + 3, k: 'p', ropa: { rem: '#3d6b46', pan: '#3a3a40', piel: '#b98563', pelo: '#111', txt: '' } }];
  if (c.dist > 5) cosas.push({ X: 2.2, Z: c.dist * .45, k: 'p', ropa: { rem: '#e5e1d6', pan: '#4a5566', piel: '#e0b08a', pelo: '#6b4a2b', txt: '' } });
  cosas.sort((a, b) => b.Z - a.Z);
  for (const o of cosas) { const pie = pr(o.X, 0, o.Z), cab = pr(o.X, o.k === 'p' ? 1.75 : 1.45, o.Z); if (!pie || !cab) continue; const hp = pie[1] - cab[1], f = luz(o.Z);
    if (o.k === 'p') persona(g, pie[0], pie[1], hp, f, o.ropa); else autoFrente(g, pie[0], pie[1], hp / 1.45 * 1.8, f, noche); }
  g.restore();
  const p0 = pr(.3, 0, c.dist), p1 = pr(.3, 1.95, c.dist), p2 = pr(.3, .45, c.dist); return p0 && p1 && p2 ? { x: p0[0], top: p1[1], bot: p2[1] } : null; }
function sensor(cv, I, noche) { // lo que agrega la cámara: blanco y negro con infrarrojo, ruido, y las esquinas un poco más oscuras
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, id = g.getImageData(0, 0, w, h), D = id.data, color = !noche || I.luz === 'color', ruido = noche ? (I.luz === 'color' ? 18 : 24) : 6;
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p += 4) { let r = D[p], gg = D[p + 1], b = D[p + 2]; if (!color) { const l = .3 * r + .59 * gg + .11 * b; r = gg = b = l * 1.04; }
    const n = (Math.random() - .5) * ruido; D[p] = clamp(r + n, 0, 255); D[p + 1] = clamp(gg + n, 0, 255); D[p + 2] = clamp(b + n, 0, 255); }
  g.putImageData(id, 0, 0); }
function vineta(g, w, h) { const v = g.createRadialGradient(w / 2, h / 2, h * .35, w / 2, h / 2, w * .62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.38)'); g.fillStyle = v; g.fillRect(0, 0, w, h); }
// La imagen de la cámara, en 3D: la misma maqueta de Ondi (personas y vehículos de verdad) en una página escondida,
// fotografiada desde una cámara virtual con la altura, la inclinación, el ángulo y la resolución de la cámara elegida.
const C3 = { fr: null, listo: null, M: null, tok: {}, tm: {}, esperando: 0 };
function c3Cargar() {
  if (C3.listo) return C3.listo;
  C3.listo = new Promise(ok => {
    const fr = document.createElement('iframe'); fr.src = '../../motor/beta/?app=ondi&escena=camsim&tema=claro&nuevo=1&solo=1'; fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1; fr.title = 'Escena del simulador';
    fr.style.cssText = 'position:fixed;left:-4000px;top:0;width:640px;height:360px;border:0;opacity:0;pointer-events:none'; document.body.appendChild(fr); C3.fr = fr;
    const t0 = Date.now(), mirar = () => { let M = null; try { M = fr.contentWindow.__maqueta; } catch (e) {} if (M && M.motor) { C3.M = M; try { M.motor.ponerHora('dia'); } catch (e) {} ok(true); } else if (Date.now() - t0 > 45000) ok(false); else setTimeout(mirar, 250); }; mirar(); });
  return C3.listo; }
const c3Gente = () => ['obj', 'p2', 'p3', 'p4', 'auto', 'auto2'].every(id => { const g = C3.M.objs.get(id); return !g || (g.children[0] && g.children[0].type === 'Group'); });
function c3Cam(I, c) { const T = C3.M.motor.THREE, cam = new T.PerspectiveCamera(I.vf, I.W / I.H, .1, 3000); cam.position.set(0, c.alt, 0); cam.lookAt(0, c.alt - Math.tan(I.tilt) * 10, 10); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); return cam; }
function c3Foto(I, c, noche, ancho, reg) {
  const M = C3.M, mo = M.motor, T = mo.THREE, R = mo.renderer, o = M.objs.get('obj'), a = M.objs.get('auto');
  if (o) o.position.z = c.dist; if (a) a.position.z = c.dist + 1.7;
  const cam = c3Cam(I, c); let w = Math.round(ancho), h = Math.round(ancho * I.H / I.W);
  if (reg) { cam.setViewOffset(I.W, I.H, reg.x, reg.y, reg.w, reg.h); cam.updateProjectionMatrix(); w = Math.max(2, Math.round(reg.w)); h = Math.max(2, Math.round(reg.h)); }
  const antes = { sol: mo.sol.intensity, hemi: mo.hemi.intensity, bg: mo.scene.background, fog: mo.scene.fog };
  let luz = null; if (noche) { // de noche: sin sol ni cielo; el infrarrojo (o la luz blanca) sale de la cámara y cae con la distancia
    mo.sol.intensity = 0; mo.hemi.intensity = .006; mo.scene.background = new T.Color('#05070a'); mo.scene.fog = null;
    luz = new T.SpotLight(I.luz === 'color' ? 0xfff1dc : 0xffffff, I.ir * I.ir * 1.15, I.ir * 1.5, Math.min(1.45, I.hf * Math.PI / 360 * 1.08), .5, 2); luz.position.set(0, c.alt, 0); luz.target.position.set(0, 0, c.dist); mo.scene.add(luz, luz.target); }
  // el pasto de fondo de la maqueta queda pegado al patio: de cerca y en grande se cuela; se baja mientras se saca la foto
  const suelo = mo.scene.children.filter(k => k.isMesh && k.geometry && k.geometry.type === 'PlaneGeometry' && (k.geometry.parameters || {}).width >= 1000), sy = suelo.map(k => k.position.y); suelo.forEach(k => { k.position.y = -0.6; });
  const ps = R.getSize(new T.Vector2()), pr = R.getPixelRatio(); R.setPixelRatio(1); R.setSize(w, h, false); R.render(mo.scene, cam); suelo.forEach((k, i) => { k.position.y = sy[i]; });
  const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(R.domElement, 0, 0, w, h);
  R.setSize(ps.x, ps.y, false); R.setPixelRatio(pr); if (luz) mo.scene.remove(luz, luz.target); Object.assign(mo.sol, { intensity: antes.sol }); mo.hemi.intensity = antes.hemi; mo.scene.background = antes.bg; mo.scene.fog = antes.fog; mo.dirty = true;
  return out; }
function camEscena(i, c, I) { clearTimeout(C3.tm[i]); C3.tm[i] = setTimeout(() => camEscenaYa(i, c, I), 90); }
async function camEscenaYa(i, c, I) {
  const tok = C3.tok[i] = (C3.tok[i] || 0) + 1, noche = c.luz === 'noche', ok3 = await c3Cargar();
  const cv = $('#hcv' + i), cz = $('#hcz' + i); if (!cv || !cz || C3.tok[i] !== tok) return;
  const caja = cv.parentElement; caja.classList.remove('cargando');
  if (!ok3) { camEscena2D(i, c, I); return; }
  try {
    const full = c3Foto(I, c, noche, Math.min(I.W, 1600)); sensor(full, I, noche);
    const v = cv.getContext('2d'); v.imageSmoothingEnabled = true; v.imageSmoothingQuality = 'high'; v.drawImage(full, 0, 0, cv.width, cv.height); vineta(v, cv.width, cv.height);
    // el recuadro: el zoom digital a la persona, con los píxeles que de verdad tiene la cámara
    const T = C3.M.motor.THREE, cam = c3Cam(I, c), o = C3.M.objs.get('obj'), X = o ? o.position.x : 0, P = (y) => { const q = new T.Vector3(X, y, c.dist).project(cam); return [(q.x + 1) / 2 * I.W, (1 - q.y) / 2 * I.H]; };
    const [px, top] = P(1.95), [, bot] = P(.45), zh = Math.max(6, bot - top), zw = zh * cz.width / cz.height, reg = { x: px - zw / 2, y: top, w: zw, h: zh };
    const zoom = c3Foto(I, c, noche, 0, reg); sensor(zoom, I, noche);
    const z = cz.getContext('2d'); z.imageSmoothingEnabled = true; z.imageSmoothingQuality = 'high'; z.drawImage(zoom, 0, 0, cz.width, cz.height);
    const k = cv.width / I.W; v.strokeStyle = '#fff'; v.lineWidth = 2; v.strokeRect(reg.x * k, reg.y * k, reg.w * k, reg.h * k);
  } catch (e) { camEscena2D(i, c, I); return; }
  // las personas y los autos 3D tardan unos segundos en llegar: cuando están, se vuelve a sacar la foto
  if (!c3Gente() && !C3.esperando) { C3.esperando = 1; const t0 = Date.now(), ver = () => { if (c3Gente() || Date.now() - t0 > 60000) { C3.esperando = 0; CA.lista.slice(0, CA.comparar ? 2 : 1).forEach((_, j) => { const cc = CA.lista[j]; if ($('#hcv' + j)) camEscenaYa(j, cc, camInfo(cc)); }); } else setTimeout(ver, 1200); }; setTimeout(ver, 1200); } }
function camEscena2D(i, c, I) {
  const cv = $('#hcv' + i), cz = $('#hcz' + i); if (!cv || !cz) return; const noche = c.luz === 'noche';
  const sc = Math.min(1, 1920 / I.W), oc = document.createElement('canvas'); oc.width = Math.round(I.W * sc); oc.height = Math.round(I.H * sc);
  const box = escena(oc.getContext('2d'), I, c, sc, 0, 0, noche); sensor(oc, I, noche);
  const v = cv.getContext('2d'); v.imageSmoothingEnabled = true; v.imageSmoothingQuality = 'high'; v.drawImage(oc, 0, 0, cv.width, cv.height); vineta(v, cv.width, cv.height);
  if (!box) return;
  const zh = Math.max(4, box.bot - box.top), zw = zh * cz.width / cz.height, zx = box.x - zw / 2, zy = box.top, zc = document.createElement('canvas');
  zc.width = Math.max(2, Math.ceil(zw)); zc.height = Math.max(2, Math.ceil(zh)); escena(zc.getContext('2d'), I, c, 1, zx, zy, noche); sensor(zc, I, noche);
  const z = cz.getContext('2d'); z.imageSmoothingEnabled = true; z.drawImage(zc, 0, 0, zw, zh, 0, 0, cz.width, cz.height);
  const k = cv.width / I.W; v.strokeStyle = '#fff'; v.lineWidth = 2; v.strokeRect(zx * k, zy * k, zw * k, zh * k); }

/* ======================================================================
   Montaje y eventos
   ====================================================================== */
let actual = null, ultimoBox = null, A = { S: { sites: [] }, toast: m => console.log(m), errTxt: e => e.message, render() {}, orgId: () => '', SB: null };
function montar(app) { if (app) A = app;
  const box = $('#herbox'); if (!box) return; const t = box.dataset.h; actual = t;
  if (t !== 'calor' && CAM.activo) camTerminar();
  if ((t === 'consola' || t === 'escaneo' || t === 'calor') && AY.est === undefined) ayHola().then(() => montar());
  if ((t === 'wifi' || t === 'calor') && EST[t].lista === null && A.SB) { EST[t].lista = []; estListar(t); }
  if (t === 'calor' && EST.wifi.lista === null && A.SB) { EST.wifi.lista = []; estListar('wifi'); }
  const ae = document.activeElement, foco = ae && box.contains(ae) && ae.id ? [ae.id, ae.selectionStart, ae.selectionEnd] : null;
  box.innerHTML = t === 'consola' ? consolaHtml() : t === 'escaneo' ? escaneoHtml() : t === 'wifi' || t === 'calor' ? lienzoHtml(LZ[t]) : t === 'camaras' ? camHtml() : '';
  if (t === 'consola') coPintar();
  if (t === 'wifi' || t === 'calor') { lienzoEventos(LZ[t]); dibujar(LZ[t], true); if (CAM.activo) camEstado(); }
  if (t === 'camaras') CA.lista.slice(0, CA.comparar ? 2 : 1).forEach((_, i) => camPintar(i));
  if (foco) { const e = document.getElementById(foco[0]); if (e) { e.focus(); try { if (foco[1] != null) e.setSelectionRange(foco[1], foco[2]); } catch (_) {} } }
  if (box !== ultimoBox) { ultimoBox = box; enganchar(box); } }
let tml = 0; function montarLuego() { clearTimeout(tml); tml = setTimeout(montar, 120); }
const escalar = (L, f2) => { const sc = q => { q.x *= f2; q.y *= f2; }; L.aps.forEach(sc); L.puntos.forEach(sc); L.paredes.forEach(w => { w.a = [w.a[0] * f2, w.a[1] * f2]; w.b = [w.b[0] * f2, w.b[1] * f2]; }); };

function enganchar(box) {
  box.addEventListener('click', async e => { const b = e.target.closest('[data-h],[data-hc],[data-hherr],[data-hband],[data-hver],[data-hz],[data-hsel],[data-hping],[data-hadd],[data-hcopia]'); if (!b || !box.contains(b)) return; const L = LZ[actual];
    if (b.dataset.hcopia) { try { await navigator.clipboard.writeText(b.dataset.hcopia); A.toast('Copiado. Pegalo en la Terminal y apretá Enter'); } catch (er) { A.toast('Seleccioná el texto y copialo a mano'); } return; }
    if (b.dataset.hc) { const i = $('#hcmd'); if (i) { i.value = b.dataset.hc; i.focus(); } return; }
    if (b.dataset.hping) { A.S.itab = 'consola'; A.render(); setTimeout(() => coCorrer('ping ' + b.dataset.hping), 50); return; }
    if (b.dataset.hadd) { esAgregar(b.dataset.hadd); return; }
    if (b.dataset.hherr) { if (CAM.activo && b.dataset.hherr !== 'caminar') camTerminar(); L.herr = b.dataset.hherr; L.trazo = null; L.escala = null; montar(); return; }
    if (b.dataset.hband) { L.banda = b.dataset.hband; L.cambio = true; montar(); return; }
    if (b.dataset.hver) { L.ver = b.dataset.hver; L._aps = null; montar(); return; }
    if (b.dataset.hsel) { const i = +b.dataset.hsel.slice(1); L.sel = { k: 'a', o: L.aps[i] }; dibujar(L); return; }
    if (b.dataset.hz) { const f = +b.dataset.hz, cv = $('#hcanvas'); if (!f) { L.z = 1; L.ox = L.oy = null; } else { const cx = cv.clientWidth / 2, cy = cv.clientHeight / 2, z = clamp(L.z * f, .4, 12), k = z / L.z; L.z = z; L.ox = cx - (cx - L.ox) * k; L.oy = cy - (cy - L.oy) * k; } dibujar(L); return; }
    const h = b.dataset.h;
    if (h === 'ayre') { AY.est = undefined; montar(); return; }
    if (h === 'ayoff') { AY.cod = ''; ls.set('ondi.tec.cod', ''); AY.est = Object.assign({}, AY.est, { emparejado: false }); montar(); return; }
    if (h === 'escsv') { esCSV(); return; }
    if (h === 'camcmp') { CA.comparar = !CA.comparar; montar(); return; }
    if (h === 'camfin') { camTerminar(); return; }
    if (!L) return;
    if (h === 'borrasel' && L.sel) { borrar(L, L.sel); return; }
    if (h === 'sugerir') { sugerir(L); return; }
    if (h === 'nuevo') { if (CAM.activo) camTerminar(); const s = L.site; LZ[actual] = Object.assign(nuevo(actual), { site: s }); montar(); return; }
    if (h === 'guardar') { estGuardar(L); return; }
    if (h === 'png') { bajarPng(L); return; }
    if (h === 'plcli') { await planoCliente(L); montar(); return; }
    if (h === 'sinplano') { L.fondo = null; L.cambio = true; montar(); return; }
    if (h === 'escno') { L.escala = null; L.trazo = null; montar(); return; }
    if (h === 'calibrar') { hacerCalibrar(L); return; }
    if (h === 'sincal') { L.cal = null; L.cambio = true; dibujar(L, true); return; }
    if (h === 'leerw' && L.sel) { try { if (!await leerWifi(L.sel.o)) { A.toast('Esta compu no está por wifi o no se pudo leer'); return; } L.cambio = true; dibujar(L, true); } catch (er) { A.toast('No respondió Ondi Scanner'); } return; }
    if (h === 'medirv' && L.sel && !L.midiendo) { const p = L.sel.o; L.midiendo = true; ladoPintar(L); try { const r = await medirVel(); p.mbps = Math.round(r.mbps * 10) / 10; p.ms = Math.round(r.ms); } catch (er) { A.toast('No se pudo medir: ¿hay conexión?'); } L.midiendo = false; L.cambio = true; dibujar(L, true); return; }
  });
  box.addEventListener('submit', async e => { const f = e.target.closest('[data-hf]'); if (!f) return; e.preventDefault(); const k = f.dataset.hf;
    if (k === 'cmd') { const i = $('#hcmd'); if (CO.corre) { CO.corre.abort(); return; } const v = i.value; i.value = ''; coCorrer(v); return; }
    if (k === 'aycod') { const v = ($('#aycod').value || '').replace(/\D/g, ''); if (v.length !== 6) { A.toast('Son 6 números'); return; } AY.cod = v; ls.set('ondi.tec.cod', v); await ayHola(); if (!AY.est || !AY.est.emparejado) A.toast('Ese código no coincide con el de la ventana de Ondi Scanner'); montar(); return; }
    if (k === 'scan') { esCorrer(); return; }
    if (k === 'escala') { const L = LZ[actual], v = parseFloat(String($('#hlesc').value).replace(',', '.')); if (!(v > 0) || !L.escala) return; const f2 = v / L.escala;
      L.anchoM *= f2; L.altoM *= f2; escalar(L, f2);
      L.escala = null; L.trazo = null; L.herr = L.tipo === 'wifi' ? 'pared' : ayListo() ? 'caminar' : 'medir'; L.cambio = true; L.z = 1; L.ox = L.oy = null; montar(); A.toast(`Listo: el plano mide ${dec(L.anchoM)} × ${dec(L.altoM)} m`); } });
  box.addEventListener('keydown', e => { if (e.target.id !== 'hcmd') return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); CO.hi = clamp(CO.hi + (e.key === 'ArrowUp' ? 1 : -1), -1, CO.hist.length - 1); e.target.value = CO.hi < 0 ? '' : CO.hist[CO.hi]; }
    else if (e.key === 'c' && e.ctrlKey && CO.corre) { e.preventDefault(); CO.corre.abort(); } });
  box.addEventListener('input', e => { const t = e.target, L = LZ[actual];
    if (t.id === 'hesq') { ES.q = t.value; montarLuego(); return; }
    if (t.dataset.cc) { const w = t.closest('[data-hcam]'), i = +w.dataset.hcam, c = CA.lista[i], k = t.dataset.cc; if (t.type === 'range') { c[k] = +t.value; const lab = t.parentElement; lab.firstChild.textContent = { alt: 'Altura de la cámara · ', dist: 'Distancia a la persona · ', f: 'Lente · ' }[k] + dec(c[k]) + (k === 'f' ? ' mm' : ' m'); camPintar(i); } return; }
    if (!L) return;
    if (t.dataset.hap) { L.sel.o[t.dataset.hap] = t.value; L.cambio = true; dibujarSinLado(L); return; }
    if (t.dataset.hpm) { const v = parseFloat(t.value); L.sel.o.rssi = isNaN(v) ? null : clamp(Math.round(v), -100, -20); L.cambio = true; dibujarSinLado(L); return; }
    if (t.id === 'hlcorr') { L.corr = clamp(parseFloat(t.value) || 0, -15, 15); L.cambio = true; dibujarSinLado(L); return; }
    if (t.id === 'hlalt') { const v = parseFloat(String(t.value).replace(',', '.')); if (v >= 2 && v <= 15) { L.altAP = v; L.cambio = true; dibujarSinLado(L); } return; } });
  box.addEventListener('change', async e => { const t = e.target, L = LZ[actual];
    if (t.id === 'hescli') { ES.cli = t.value; montar(); return; }
    if (t.dataset.cc) { const w = t.closest('[data-hcam]'), i = +w.dataset.hcam, c = CA.lista[i], k = t.dataset.cc;
      if (k === 'marca') { c.marca = t.value; c.mi = 0; const L2 = CAMS[c.marca].m[0][3]; c.f = L2[0]; } else if (k === 'mi') { c.mi = +t.value; const L2 = CAMS[c.marca].m[c.mi][3]; if (L2[2] === 'v' ? c.f < L2[0] || c.f > L2[1] : !L2.includes(+c.f)) c.f = L2[0]; } else if (k === 'luz') c.luz = t.value; else c[k] = +t.value;
      montar(); return; }
    if (!L) return;
    if (t.id === 'hlcli') { L.site = t.value; L.cambio = true; montar(); return; }
    if (t.id === 'hlest') { if (t.value) estAbrir(actual, t.value); return; }
    if (t.id === 'hlimg') { subirImagen(L, t.files[0]); return; }
    if (t.id === 'hlancho' || t.id === 'hlalto') { const v = parseFloat(String(t.value).replace(',', '.')); if (!(v >= 2)) return; const f2 = t.id === 'hlancho' ? v / L.anchoM : 1;
      if (t.id === 'hlancho') { L.anchoM = v; if (L.fondo && L.fondo.w) L.altoM = v * L.fondo.h / L.fondo.w; } else L.altoM = v;
      if (f2 !== 1 && L.fondo) escalar(L, f2);
      L.cambio = true; L.z = 1; L.ox = L.oy = null; dibujar(L, true); return; }
    if (t.id === 'hlmat') { L.mat = t.value; return; }
    if (t.id === 'hlmod') { L.modelo = t.value; return; }
    if (t.id === 'hlamb') { L.amb = t.value; L.cambio = true; dibujar(L, true); return; }
    if (t.id === 'hlumb') { L.umbral = +t.value; L.cambio = true; dibujar(L, true); return; }
    if (t.id === 'hleq') { L.equipo = t.value; L.cambio = true; dibujar(L, true); return; }
    if (t.id === 'hlssid') { L.ssid = t.value; L._aps = null; L.cambio = true; dibujar(L, true); return; }
    if (t.id === 'hlref') { await refPoner(L, t.value); montar(); return; }
    if (t.dataset.hpa) { L.sel.o.m = t.value; L.cambio = true; dibujar(L, true); return; }
    if (t.dataset.h === 'auto') { L.auto = t.checked; return; } });
}
addEventListener('resize', () => { const L = LZ[actual]; if (L && $('#hcanvas')) dibujar(L); });
// al escribir en el panel no se rearma el panel (si no, se pierde lo que se está escribiendo)
function dibujarSinLado(L) { L._noLado = true; dibujar(L, true); }

window.OndiHerr = { montar, ver: 2 };
})();

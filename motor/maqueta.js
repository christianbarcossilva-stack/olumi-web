// Motor común · la maqueta: arma las piezas, muestra etiquetas y capas, y trae el editor con los comandos de Los Sims 4.
// La usan Ondi (equipos en vivo), Estiba (patio y contenedores) y Olumi (oficina). Cada app le pasa su "anfitrión" (host):
//   host.state      lo guardado ({ v:1, motor:1, escena, ext })      host.save(state)   guarda
//   host.role       'inst' edita, 'cli' solo mira                   host.equipos()     lista de equipos reales (Ondi)
//   host.juego(on)  pantalla completa dentro de la app               host.park          nombre del lugar
import { THREE, crearMotor } from './nucleo.js';
import { TIPOS, GRUPOS, armarPieza, centro, altoDe, COL, aLoLargo, matSuelo } from './piezas.js?v=3';

const $ = (s, r = document) => r.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IC = {
  mano: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0V12m0-.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.8-2.4L4.3 16a1.6 1.6 0 0 1 2.5-2l1.2 1.4"/>',
  maza: '<path d="M14 4l6 6-3 3-6-6zM11 7l-8 8 2 2 8-8M3 21h8"/>', gotero: '<path d="M14 4l6 6M16.5 2.5l5 5-3 3-5-5zM13.5 8.5 5 17l-1 4 4-1 8.5-8.5"/>',
  catalogo: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',
  deshacer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>', rehacer: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>',
  grilla: '<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>', capas: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  vista: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>', buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', equipos: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
  borrar: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>', duplicar: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>', enfocar: '<circle cx="12" cy="12" r="3"/><path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"/>',
  plano: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  girar: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>', mas: '<path d="M12 5v14M5 12h14"/>'
};
const svg = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const CAPAS = [['base', 'Construcciones y caminos'], ['logistica', 'Contenedores y vehículos'], ['vegetacion', 'Árboles'], ['equipos', 'Equipos'], ['campos', 'Campo de las cámaras'], ['etiquetas', 'Nombres'], ['techos', 'Techos']];
const EQ_DE = { cam: 'camara', ap: 'ap', sw: 'switch', gw: 'router', sen: 'sensor', otro: 'ups' };
const ESTADO = e => ['online', 'en_linea', 'abierta', 'cerrada'].includes(e) ? 'ok' : ['offline', 'caido'].includes(e) ? 'crit' : ['alerting', 'atencion'].includes(e) ? 'warn' : 'off';
const ESTX = { ok: 'En línea', crit: 'Caído', warn: 'Con alertas', off: 'Sin dato' };
const tipoReal = d => { if (/^sensor_/.test(d.tipo || '')) return 'sen'; if (d.tipo) return { camara: 'cam', nvr: 'cam', switch: 'sw', ap: 'ap', router: 'gw' }[d.tipo] || 'otro'; const t = [d.linea, d.modelo, d.nombre].join(' ').toLowerCase();
  if (/protect|camera|cámara|camara|bullet|dome|domo|turret|\bg[345]\b|nvr/.test(t)) return 'cam'; if (/usw|switch|flex mini/.test(t)) return 'sw'; if (/udm|uxg|usg|ucg|gateway|dream|router|cloud key/.test(t)) return 'gw'; if (/\bu[67]\b|uap|\bap\b|mesh|nanohd|access point|wi-?fi/.test(t)) return 'ap'; return 'otro'; };

// el logo de cada app en la barra (el mismo dibujo que su ícono)
const LOGO = {
  estiba: '<svg class="mapp" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="28" fill="var(--acc)"/><rect x="24" y="74" width="70" height="15" rx="4.5" fill="var(--acc-ink)"/><rect x="24" y="53" width="54" height="15" rx="4.5" fill="var(--acc-ink)" fill-opacity=".82"/><rect x="24" y="32" width="38" height="15" rx="4.5" fill="var(--acc-ink)" fill-opacity=".62"/><circle cx="87" cy="38" r="10.5" fill="#3ddc97"/></svg>'
};
const BUSCA = { estiba: 'Buscar fila, galpón o máquina', olumi: 'Buscar sala, puesto o persona' };
const SIN = { estiba: ['Equipos'] };   // Estiba es solo logística: lo informático es de Ondi

export async function abrirMaqueta(o) {
  const host = o.host || null, raiz = o.raiz || document.body, app = o.app || 'ondi';
  const puede = o.editable ?? (!host || host.role !== 'cli');
  let E = normal(o.escena || (host && host.state && host.state.escena) || { v: 1, nombre: (host && host.park) || 'Maqueta', piezas: [] });
  if (host && !E.piezas.length) E.piezas.push({ id: 'ter1', t: 'terreno', nombre: E.nombre, mat: 'tierra', pts: [[-60, -40], [60, -40], [60, 40], [-60, 40]] });
  // ---------- pantalla ----------
  raiz.insertAdjacentHTML('beforeend', `<canvas id="m3d" aria-label="Maqueta 3D de ${esc(E.nombre)}. Arrastrá para mover, rueda para acercar, clic derecho para girar."></canvas><div id="mlbl" aria-hidden="true"></div>
  <header class="mbar vidrio"><div class="mmarca">${LOGO[app] || `<i class="mapp mapp-${app}"></i>`}<div><b id="mnom">${esc(E.nombre)}</b><span id="mguar">${puede ? 'Los cambios se guardan solos' : 'Solo lectura'}</span></div></div>
    <label class="mbus">${svg('buscar', 16)}<input id="mq" type="search" placeholder="${BUSCA[app] || 'Buscar fila, galpón, equipo o IP'}" autocomplete="off" aria-label="Buscar"><div id="mres" class="vidrio" hidden></div></label>
    <div class="mbtns"><button id="bcapas" class="mbtn" aria-label="Capas" title="Capas">${svg('capas')}</button><button id="bplano" class="mbtn" aria-pressed="false" aria-label="Ver desde arriba" title="Ver desde arriba (planta)">${svg('plano')}</button><button id="bvista" class="mbtn" aria-label="Vista general" title="Vista general">${svg('vista')}</button><button id="bfull" class="mbtn" aria-label="Pantalla completa" title="Pantalla completa">${svg('full')}</button>${puede ? `<button id="bedit" class="mbtn pri" aria-pressed="false" title="Editar (F)">${svg('editar')}<span>Editar</span></button>` : ''}</div></header>
  <div id="mcapas" class="vidrio mpop" hidden>${CAPAS.filter(([k]) => !(app === 'estiba' && (k === 'equipos' || k === 'campos'))).map(([k, n]) => `<label class="msw"><span>${n}</span><input type="checkbox" data-capa="${k}" checked><i></i></label>`).join('')}</div>
  <aside id="minfo" class="vidrio" hidden></aside>
  <nav id="mtool" class="vidrio" hidden aria-label="Herramientas">
    <button data-h="mano" aria-pressed="true" title="Mano: elegir y mover (H)">${svg('mano')}</button><button data-h="maza" title="Maza: sacar (K)">${svg('maza')}</button><button data-h="gotero" title="Gotero: copiar (E)">${svg('gotero')}</button>
    <span class="msep"></span><button id="bcat" title="Catálogo (Tab)">${svg('catalogo')}</button>${host && host.equipos ? `<button id="beq" title="Equipos del cliente">${svg('equipos')}</button>` : ''}
    <span class="msep"></span><button id="bundo" title="Deshacer (Ctrl+Z)">${svg('deshacer')}</button><button id="bredo" title="Rehacer (Ctrl+Y)">${svg('rehacer')}</button><button id="bgrid" aria-pressed="true" title="Grilla (G)">${svg('grilla')}</button></nav>
  <section id="mcat" class="vidrio mhoja" hidden aria-label="Catálogo"><div class="mhead"><b>Catálogo</b><input id="mcq" type="search" placeholder="Buscar" aria-label="Buscar en el catálogo"><button class="mx" data-cerrar="mcat" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div id="mcl"></div></section>
  <section id="meq" class="vidrio mhoja" hidden aria-label="Equipos del cliente"><div class="mhead"><b>Equipos del cliente</b><input id="meqq" type="search" placeholder="Nombre, modelo o IP" aria-label="Buscar equipo"><button class="mx" data-cerrar="meq" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div id="meql"></div></section>
  <div id="mhint" class="vidrio" hidden></div><div id="mtoast" class="vidrio" hidden role="status"></div>
  <div id="mstats" hidden></div>`);
  const canvas = $('#m3d'), motor = crearMotor(canvas, { tema: o.tema, ruedaConCtrl: o.ruedaConCtrl }), mundo = new THREE.Group(); motor.scene.add(mundo);
  const objs = new Map(), lbl = $('#mlbl');
  let tostT; const toast = m => { const t = $('#mtoast'); t.textContent = m; t.hidden = false; clearTimeout(tostT); tostT = setTimeout(() => t.hidden = true, 2800); };
  const hint = m => { const h = $('#mhint'); h.hidden = !m; if (m) h.innerHTML = m; };

  // suelo de fondo (pasto) que acompaña el tema
  const pg = new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2); { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9000, uv.getY(i) * 9000); }
  const suelo = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ roughness: 1 })); suelo.position.y = -0.02; suelo.receiveShadow = true; motor.scene.add(suelo);
  const pintaSuelo = () => { suelo.material = matSuelo('pasto', { roughness: 1 }); };

  // ---------- equipos reales (Ondi) ----------
  const EQ = { lista: [], porUid: new Map(), at: 0 };
  async function leerEquipos(forzar) { if (!host || !host.equipos) return; if (!forzar && Date.now() - EQ.at < 55000) return; EQ.at = Date.now();
    try { const r = await host.equipos(); EQ.lista = (r && r.list) || []; EQ.errs = (r && r.errs) || []; } catch (e) { EQ.errs = ['No se pudieron leer los equipos']; }
    EQ.porUid = new Map(EQ.lista.map(d => [d.uid, d]));
    for (const p of E.piezas) if (p.uid && TIPOS[p.t] && TIPOS[p.t].equipo) { const d = EQ.porUid.get(p.uid), g = objs.get(p.id); if (d && d.nombre && p.nombre !== d.nombre) p.nombre = d.nombre; if (g && g.userData.estado !== ESTADO(d && d.estado)) rehacer(p); }
    if (!$('#meq').hidden) listaEquipos(); if (SEL) info(); }
  const ctx = { estado: p => p.uid ? (EQ.porUid.has(p.uid) ? ESTADO(EQ.porUid.get(p.uid).estado) : 'off') : (p.estado || 'off'), glb: o.catalogo ? cargarGLB : null };
  if (host && host.equipos) { leerEquipos(true); setInterval(() => leerEquipos(true), 60000); }

  // ---------- modelos del catálogo de Olumi (personas y vehículos) ----------
  const GLB = {}; let cat = null, loader = null;
  async function cargarGLB(tipo, id, g, color) { try { if (!loader) { const { GLTFLoader } = await import('three/addons/GLTFLoader.js'); loader = new GLTFLoader(); }
      cat = cat || await (await fetch(o.catalogo + 'catalogo.json')).json(); const it = (cat[tipo] || []).find(x => x.id === id); if (!it) return;
      GLB[id] = GLB[id] || new Promise((ok, no) => loader.load(o.catalogo + it.archivo, x => ok(x.scene), undefined, no)); const base = await GLB[id];
      const { clone } = await import('three/addons/SkeletonUtils.js'); const m = clone(base); m.traverse(k => { if (k.isMesh) { k.castShadow = k.receiveShadow = true; if (k.isSkinnedMesh) k.frustumCulled = false; if (color && tipo === 'vehiculos') for (const q of [].concat(k.material)) if (q.name === 'pintura') { k.material = q.clone(); k.material.color.set(color); } } k.userData.dueño = g; });
      if (tipo === 'avatares') { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(it.alto / (b.max.y - b.min.y)); brazos(m); }
      g.clear(); g.add(m); motor.dirty = true; } catch (e) { /* sin catálogo: queda la figura simple */ } }

  // ---------- armar la escena ----------
  function rehacer(p) { const v = objs.get(p.id); if (v) { mundo.remove(v); limpiar(v); } const g = armarPieza(p, ctx); if (!g) return; objs.set(p.id, g); mundo.add(g); aplicarCapas(g); motor.dirty = true; if (SEL === p) marcar(); if (TIPOS[p.t].etiqueta) etiquetas(); }
  function armarTodo() { for (const g of objs.values()) { mundo.remove(g); limpiar(g); } objs.clear(); for (const p of E.piezas) { const g = armarPieza(p, ctx); if (g) { objs.set(p.id, g); mundo.add(g); aplicarCapas(g); } } pintaSuelo(); etiquetas(); motor.dirty = true; }
  function limpiar(g) { g.traverse(k => { if (k.geometry && !k.geometry.parameters?.width && k.geometry.type !== 'BoxGeometry' && k.geometry.type !== 'CylinderGeometry' && k.geometry.type !== 'IcosahedronGeometry' && k.geometry.type !== 'ConeGeometry') k.geometry.dispose(); }); }
  const capas = Object.fromEntries(CAPAS.map(([k]) => [k, true]));
  function aplicarCapas(g) { const T = g.userData.tipo; g.visible = capas[T.capa] !== false; g.traverse(k => { if (k.userData.techo) k.visible = capas.techos; if (k.userData.campo) k.visible = capas.campos; }); }
  motor.alTema.push(() => { armarTodo(); });
  function encuadre() { const b = new THREE.Box3(); for (const p of E.piezas) { const [x, z] = centro(p); if (p.pts) for (const q of p.pts) b.expandByPoint(new THREE.Vector3(q[0], 0, q[1])); else b.expandByPoint(new THREE.Vector3(x, 0, z)); }
    if (b.isEmpty()) return { tx: 0, tz: 0, yaw: 0.7, pitch: 0.75, d: 160 }; const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return { tx: c.x, tz: c.z, yaw: 0.7, pitch: 0.72, d: Math.max(60, Math.max(s.x, s.z) * 1.05) }; }

  // ---------- etiquetas (nombres de filas, galpones y equipos) ----------
  let etq = [];
  function etiquetas() { lbl.innerHTML = ''; etq = [];
    for (const p of E.piezas) { const T = TIPOS[p.t]; if (!T || !T.etiqueta) continue; const txt = T.etiqueta({ ...T.def, ...p }); if (!txt && !T.equipo) continue;
      const el = document.createElement('button'); el.className = 'metq' + (T.equipo ? ' eq ' + ctx.estado(p) : ''); el.tabIndex = -1;
      el.innerHTML = T.equipo ? `<i></i><span>${esc(txt || T.n)}</span>` : `<span>${esc(txt)}</span>`; el.addEventListener('click', () => elegir(p, true)); lbl.appendChild(el);
      const [x, z] = centro(p); etq.push({ p, el, v: new THREE.Vector3(x, altoDe(p) + (T.equipo ? 0.9 : 2), z), eq: !!T.equipo, cap: T.capa, siempre: !!T.siempre }); }
    motor.dirty = true; }
  motor.despues.push(() => { const lejos = motor.C.d > 420, w = canvas.clientWidth, h = canvas.clientHeight; lbl.classList.toggle('lejos', lejos);
    for (const e of etq) { const g = objs.get(e.p.id), vis = capas.etiquetas && g && g.visible; if (!vis) { e.fuera = true; continue; }
      if (e.p.pts) { const [x, z] = centro(e.p); e.v.set(x, e.v.y, z); } else e.v.set(e.p.x || 0, e.v.y, e.p.z || 0);
      const s = motor.aPantalla(e.v); const fuera = s.z > 1 || s.x < -60 || s.y < -30 || s.x > w + 60 || s.y > h + 30 || (lejos && e.eq && motor.C.d > 900) || (!e.eq && !e.siempre && motor.C.d > 300);
      e.fuera = fuera; e.sx = s.x; e.sy = s.y; e.sz = s.z; }
    // las que se pisan con una más cercana (o con la elegida) no se muestran
    let sel = null; try { sel = SEL; } catch (er) {} const vis = etq.filter(e => e.fuera === false).sort((a, b) => (b.p === sel) - (a.p === sel) || a.sz - b.sz), puestas = [];
    for (const e of vis) { if (!e.w) { e.el.style.display = ''; e.w = e.el.offsetWidth || 80; e.h = e.el.offsetHeight || 24; }
      const r = [e.sx - e.w / 2 - 3, e.sy - e.h - 3, e.sx + e.w / 2 + 3, e.sy + 3], tapa = puestas.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
      e.el.style.display = tapa ? 'none' : ''; if (!tapa) { puestas.push(r); e.el.style.transform = `translate(${e.sx.toFixed(1)}px,${e.sy.toFixed(1)}px) translate(-50%,-100%)`; } }
    for (const e of etq) if (e.fuera) e.el.style.display = 'none'; });

  // ---------- elegir y ficha ----------
  let SEL = null, HOV = null; const caja = new THREE.Box3Helper(new THREE.Box3(), 0x1d9bf0), cajaH = new THREE.Box3Helper(new THREE.Box3(), 0x8ecbff); caja.visible = cajaH.visible = false; motor.scene.add(caja, cajaH);
  function marcar() { const g = SEL && objs.get(SEL.id); caja.visible = !!g && !(TIPOS[SEL.t].forma !== 'punto' && ED.on); if (g) { caja.box.setFromObject(g); caja.box.expandByScalar(0.3); } puntos(); motor.dirty = true; }
  function elegir(p, enfocar) { SEL = p; marcar(); info(); if (enfocar && p) { const [x, z] = centro(p); motor.ir({ tx: x, tz: z, d: Math.min(motor.C.d, TIPOS[p.t].equipo ? 45 : 140) }); } }
  function hallar(e) { const hit = motor.tocar(e.clientX, e.clientY, [...objs.values()].filter(g => g.visible)); for (const h of hit) { const g = h.object.userData.dueño; if (g && g.visible) { if (h.object.userData.campo) continue; return { p: g.userData.pieza, h }; } } return null; }
  function info() { const box = $('#minfo'); if (!SEL) { box.hidden = true; return; } const T = TIPOS[SEL.t], q = { ...T.def, ...SEL };
    if (ED.on && puede) { box.hidden = false; box.innerHTML = `<div class="mhead"><b>${esc(T.n)}</b><button class="mx" data-sel="no" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div class="mform">${T.campos.map(c => campo(c, q)).join('')}${T.equipo && EQ.lista.length ? vinculo(q) : ''}${T.equipo && !q.uid && host && host.crearEquipo ? `<button class="mbtn" data-acc="alta">${svg('mas', 16)}Sumarlo a la lista de equipos del cliente</button>` : ''}</div>
      <div class="macts"><button class="mbtn" data-acc="enfocar">${svg('enfocar', 16)}Enfocar</button><button class="mbtn" data-acc="duplicar">${svg('duplicar', 16)}Duplicar</button><button class="mbtn peligro" data-acc="borrar">${svg('borrar', 16)}Sacar</button></div>`; return; }
    const d = SEL.uid && EQ.porUid.get(SEL.uid), est = T.equipo ? ctx.estado(SEL) : null, g = objs.get(SEL.id);
    const filas = T.equipo ? [['Estado', `<span class="mpill ${est}">${ESTX[est]}</span>`], ['Modelo', esc((d && d.modelo) || q.modelo)], ['IP', esc((d && d.ip) || q.ip)], ['MAC', esc((d && d.mac) || q.mac)], ['Altura', q.y != null ? q.y + ' m' : ''], ['Dónde', esc(lugarDe(SEL))], ['Notas', esc(q.notas)]]
      : SEL.t === 'fila' ? [['Contenedores', g && g.userData.cuenta], ['Tipo', q.carga === 'reefer' ? 'Refrigerados' : 'Secos'], ['Medida', q.pies + ' pies'], ['Ancho', q.ancho + ' contenedores'], ['Alto máximo', q.alto], ['Largo', q.largo + ' m']]
      : T.campos.filter(c => !['nombre', 'x', 'z', 'r'].includes(c.k) && q[c.k] !== undefined && q[c.k] !== '' && c.t !== 'color').map(c => [c.n, c.t === 'sel' ? esc((c.ops.find(z => z[0] == q[c.k]) || [, q[c.k]])[1]) : c.t === 'bool' ? (q[c.k] ? 'Sí' : 'No') : esc(q[c.k])]);
    box.hidden = false; box.innerHTML = `<div class="mhead"><div><small>${esc(T.n)}</small><b>${esc(q.nombre || (d && d.nombre) || T.n)}</b></div><button class="mx" data-sel="no" aria-label="Cerrar">${svg('cerrar', 16)}</button></div>
      <dl class="mdl">${filas.filter(f => f[1] !== undefined && f[1] !== '' && f[1] !== null).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><div class="macts"><button class="mbtn" data-acc="enfocar">${svg('enfocar', 16)}Enfocar</button></div>`; }
  function campo(c, q) { const v = q[c.k] ?? '', id = 'f_' + c.k;
    if (c.t === 'sel') return `<label><span>${c.n}</span><select id="${id}" data-k="${c.k}">${c.ops.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
    if (c.t === 'bool') return `<label class="msw"><span>${c.n}</span><input id="${id}" type="checkbox" data-k="${c.k}" ${v ? 'checked' : ''}><i></i></label>`;
    if (c.t === 'color') return `<label><span>${c.n}</span><span class="mcol"><input id="${id}" type="color" data-k="${c.k}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'}">${c.k === 'carga' || c.k === 'color' && !v ? `<button class="mbtn chico" data-sin="${c.k}">Sin</button>` : ''}</span></label>`;
    if (c.t === 'area') return `<label><span>${c.n}</span><textarea id="${id}" data-k="${c.k}" rows="2">${esc(v)}</textarea></label>`;
    if (c.t === 'ang') return `<label><span>${c.n}</span><input id="${id}" type="number" step="15" data-k="${c.k}" data-ang="1" value="${Math.round((+v || 0) * 180 / Math.PI)}"></label>`;
    return `<label><span>${c.n}</span><input id="${id}" ${c.t === 'num' ? `type="number" inputmode="decimal" step="${c.paso || 1}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''}` : 'type="text"'} data-k="${c.k}" value="${esc(v)}"></label>`; }
  function vinculo(q) { const usados = new Set(E.piezas.filter(p => p.uid && p !== SEL).map(p => p.uid));
    return `<label><span>Equipo real</span><select data-k="uid"><option value="">Sin vincular</option>${EQ.lista.filter(d => !usados.has(d.uid) || d.uid === q.uid).map(d => `<option value="${esc(d.uid)}" ${d.uid === q.uid ? 'selected' : ''}>${esc(d.nombre)}${d.ip ? ' · ' + esc(d.ip) : ''}</option>`).join('')}</select></label>`; }
  $('#minfo').addEventListener('input', e => { const el = e.target.closest('[data-k]'); if (!el || !SEL) return; let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : +el.value) : el.value; if (el.dataset.ang) v = (+el.value || 0) * Math.PI / 180;
    if (el.dataset.k === 'uid') { const d = EQ.porUid.get(v); if (d) Object.assign(SEL, { nombre: d.nombre, modelo: d.modelo || SEL.modelo, ip: d.ip || SEL.ip, mac: d.mac || SEL.mac }); }
    if (v === null || v === '') delete SEL[el.dataset.k]; else SEL[el.dataset.k] = v; rehacer(SEL); cambio(true, el.type === 'text' || el.tagName === 'TEXTAREA'); if (el.dataset.k === 'uid') info(); });
  $('#minfo').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.sel === 'no') { elegir(null); return; } if (b.dataset.sin) { delete SEL[b.dataset.sin]; SEL[b.dataset.sin] = ''; rehacer(SEL); cambio(); info(); return; }
    const a = b.dataset.acc;
    if (a === 'alta') { const T = TIPOS[SEL.t], p = SEL; if (!p.nombre) { toast('Ponele un nombre primero'); return; } b.disabled = true;
      try { const r = await host.crearEquipo({ marca: p.marca || 'otra', tipo: T.ondi || 'otro', nombre: p.nombre, modelo: p.modelo || null, ip: p.ip || null, ubicacion: lugarDe(p), notas: p.notas || null });
        p.uid = 'man:' + r.id; await leerEquipos(true); rehacer(p); cambio(); info(); toast('Equipo sumado a la lista del cliente'); } catch (er) { b.disabled = false; toast('No se pudo: ' + ((er && er.message) || er)); } return; }
    if (a === 'enfocar') elegir(SEL, true); if (a === 'duplicar') duplicar(); if (a === 'borrar') sacar(SEL); });

  // ---------- capas, buscar, vista, pantalla completa ----------
  $('#bcapas').onclick = () => { $('#mcapas').hidden = !$('#mcapas').hidden; };
  $('#mcapas').addEventListener('change', e => { const k = e.target.dataset.capa; capas[k] = e.target.checked; for (const g of objs.values()) aplicarCapas(g); motor.dirty = true; });
  $('#bvista').onclick = () => motor.vista();
  let antes = null; $('#bplano').onclick = () => { const b = $('#bplano'), on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); if (on) { antes = { pitch: motor.C.pitch, yaw: motor.C.yaw }; motor.ir({ pitch: 1.45, yaw: Math.round(motor.C.yaw / (Math.PI / 2)) * Math.PI / 2 }, 0.6); } else motor.ir(antes || { pitch: 0.7 }, 0.6); };
  $('#bfull').onclick = () => pantalla(!(document.fullscreenElement || document.documentElement.classList.contains('mfull')));
  function pantalla(on) { if (host && host.juego) { host.juego(on); document.documentElement.classList.toggle('mfull', on); return; } const d = document.documentElement;
    if (on && d.requestFullscreen) d.requestFullscreen().catch(() => d.classList.add('mfull')); else if (!on && document.fullscreenElement) document.exitFullscreen(); else d.classList.toggle('mfull', on); }
  const q = $('#mq'), res = $('#mres');
  q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); if (!t) { res.hidden = true; return; }
    const hits = E.piezas.map(p => { const d = p.uid && EQ.porUid.get(p.uid), T = TIPOS[p.t]; return { p, txt: [p.nombre, T && T.n, p.ip, d && d.ip, d && d.modelo, p.modelo].filter(Boolean).join(' ') }; }).filter(x => x.p.nombre && x.txt.toLowerCase().includes(t)).slice(0, 8);
    res.innerHTML = hits.length ? hits.map((x, i) => `<button data-i="${i}"><b>${esc(x.p.nombre)}</b><small>${esc(TIPOS[x.p.t].n)}${x.p.ip ? ' · ' + esc(x.p.ip) : ''}</small></button>`).join('') : '<p>Sin resultados</p>'; res.hidden = false; res._h = hits; });
  res.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; elegir(res._h[+b.dataset.i].p, true); res.hidden = true; q.value = ''; q.blur(); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && res._h && res._h[0]) { elegir(res._h[0].p, true); res.hidden = true; q.value = ''; q.blur(); } if (e.key === 'Escape') { res.hidden = true; q.blur(); } });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.mbus')) res.hidden = true; if (!e.target.closest('#mcapas, #bcapas')) $('#mcapas').hidden = true; });

  // ---------- editor (comandos de Los Sims 4) ----------
  const ED = { on: false, h: 'mano', grilla: true, colocar: null, linea: null, drag: null };
  const grilla = new THREE.GridHelper(2000, 400, 0x5a6b78, 0x5a6b78); grilla.material.transparent = true; grilla.material.opacity = 0.16; grilla.position.y = 0.06; grilla.visible = false; motor.scene.add(grilla);
  const undo = [], redo = []; let foto = JSON.stringify(E.piezas);
  function cambio(guardarYa = true, escribiendo) { const ahora = JSON.stringify(E.piezas); if (ahora === foto) return; if (!escribiendo || !undo.length || undo[undo.length - 1].t < Date.now() - 1500) undo.push({ s: foto, t: Date.now() }); if (undo.length > 80) undo.shift(); redo.length = 0; foto = ahora; if (guardarYa) guardar(); }
  function volver(de, a) { if (!de.length) return; a.push({ s: foto, t: 0 }); foto = de.pop().s; E.piezas = JSON.parse(foto); SEL = SEL && E.piezas.find(p => p.id === SEL.id) || null; armarTodo(); marcar(); info(); guardar(); }
  function editar(on) { if (!puede) return; ED.on = on; motor.editando = on; document.documentElement.classList.toggle('editando', on); $('#mtool').hidden = !on; $('#bedit').setAttribute('aria-pressed', on); $('#bedit').querySelector('span').textContent = on ? 'Listo' : 'Editar';
    grilla.visible = on && ED.grilla; if (!on) { cancelar(true); $('#mcat').hidden = true; $('#meq').hidden = true; hint(''); } else hint('Mano: tocá algo para elegirlo y arrastralo para moverlo. <kbd>Tab</kbd> abre el catálogo.'); marcar(); info(); motor.dirty = true; }
  if (puede) $('#bedit').onclick = () => editar(!ED.on);
  function herramienta(h) { ED.h = h; document.querySelectorAll('#mtool [data-h]').forEach(b => b.setAttribute('aria-pressed', b.dataset.h === h)); canvas.dataset.h = h;
    hint({ mano: 'Mano: tocá algo para elegirlo y arrastralo para moverlo.', maza: 'Maza: tocá lo que quieras sacar.', gotero: 'Gotero: tocá algo para copiarlo y ubicar la copia.' }[h]); }
  $('#mtool').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.h) herramienta(b.dataset.h); if (b.id === 'bcat') catalogo(); if (b.id === 'beq') panelEquipos(); if (b.id === 'bundo') volver(undo, redo); if (b.id === 'bredo') volver(redo, undo);
    if (b.id === 'bgrid') { ED.grilla = !ED.grilla; b.setAttribute('aria-pressed', ED.grilla); grilla.visible = ED.on && ED.grilla; motor.dirty = true; } });
  document.addEventListener('click', e => { const b = e.target.closest('[data-cerrar]'); if (b) $('#' + b.dataset.cerrar).hidden = true; });
  const pegar = (v, alt) => alt ? Math.round(v * 100) / 100 : Math.round(v * 2) / 2;
  let nid = 1; const nuevoId = t => { let id; do id = t.slice(0, 3) + (nid++).toString(36); while (E.piezas.some(p => p.id === id)); return id; };

  // catálogo
  function catalogo(abrir = true) { const box = $('#mcat'); box.hidden = !abrir; if (!abrir) return; $('#meq').hidden = true; const t = ($('#mcq').value || '').toLowerCase();
    $('#mcl').innerHTML = GRUPOS.filter(g => !(SIN[app] || []).includes(g)).map(g => { const its = Object.entries(TIPOS).filter(([k, T]) => T.g === g && (!t || (T.n + ' ' + g).toLowerCase().includes(t))); return its.length ? `<h4>${g}</h4><div class="mgrid">${its.map(([k, T]) => `<button data-t="${k}"><i class="mico mico-${T.forma}"></i><span>${T.n}</span><small>${T.forma === 'punto' ? 'Clic para ubicar' : T.forma === 'linea' ? 'Línea: clic por punto' : 'Área: clic por esquina'}</small></button>`).join('')}</div>` : ''; }).join('') || '<p class="mvacio">Nada con ese nombre.</p>';
    if (!motor.tactil) $('#mcq').focus(); }
  $('#mcq').addEventListener('input', () => catalogo());
  $('#mcl').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; empezar({ t: b.dataset.t }); $('#mcat').hidden = !motor.tactil ? true : true; });
  function empezar(tpl) { cancelar(); const T = TIPOS[tpl.t]; if (T.forma === 'punto') { ED.colocar = { tpl, p: null }; hint(`Ubicando <b>${esc(T.n)}</b>: tocá dónde va. <kbd>,</kbd> <kbd>.</kbd> giran · <kbd>Shift</kbd> pone varios · <kbd>Esc</kbd> cancela.`); }
    else { ED.linea = { tpl, pts: [], p: null }; hint(`Dibujando <b>${esc(T.n)}</b>: tocá cada ${T.forma === 'area' ? 'esquina' : 'punto'}. Doble clic o <kbd>Enter</kbd> termina · <kbd>Retroceso</kbd> borra el último · <kbd>Esc</kbd> cancela.`); } }
  function cancelar(todo) { if (ED.colocar && ED.colocar.p) quitar(ED.colocar.p, true); if (ED.linea && ED.linea.p) quitar(ED.linea.p, true); ED.colocar = ED.linea = null; if (ED.on && !todo) herramienta(ED.h); }
  function quitar(p, sinFoto) { E.piezas = E.piezas.filter(x => x !== p); const g = objs.get(p.id); if (g) { mundo.remove(g); limpiar(g); objs.delete(p.id); } if (SEL === p) { SEL = null; marcar(); info(); } etiquetas(); motor.dirty = true; if (!sinFoto) cambio(); }
  function sacar(p) { if (!p) return; quitar(p); toast(`${TIPOS[p.t].n} sacado · Ctrl+Z para volver`); }
  function duplicar() { if (!SEL) return; const c = JSON.parse(JSON.stringify(SEL)); c.id = nuevoId(c.t); delete c.uid; if (c.pts) c.pts = c.pts.map(q => [q[0] + 4, q[1] + 4]); else { c.x = (c.x || 0) + 4; c.z = (c.z || 0) + 4; } E.piezas.push(c); rehacer(c); elegir(c); cambio(); }

  // equipos del cliente (Ondi): los que todavía no están en la maqueta se ubican con un toque
  function panelEquipos(abrir = true) { $('#meq').hidden = !abrir; if (abrir) { $('#mcat').hidden = true; leerEquipos(); listaEquipos(); } }
  function listaEquipos() { const t = ($('#meqq').value || '').toLowerCase(), usados = new Map(E.piezas.filter(p => p.uid).map(p => [p.uid, p]));
    const L = EQ.lista.filter(d => !d.consola && (!t || [d.nombre, d.modelo, d.ip, d.mac].join(' ').toLowerCase().includes(t))), sin = L.filter(d => !usados.has(d.uid)), con = L.filter(d => usados.has(d.uid));
    const fila = (d, u) => `<button data-uid="${esc(d.uid)}" class="${u ? 'usado' : ''}"><i class="mest ${ESTADO(d.estado)}"></i><span><b>${esc(d.nombre)}</b><small>${esc([d.modelo, d.ip].filter(Boolean).join(' · '))}</small></span><em>${u ? 'Ver' : 'Ubicar'}</em></button>`;
    $('#meql').innerHTML = (EQ.errs || []).map(m => `<p class="merr">${esc(m)}</p>`).join('') + (!EQ.lista.length ? `<p class="mvacio">Todavía no hay equipos de este cliente. Enlazalo con UniFi o Meraki, o cargalos a mano en la pestaña Equipos. También podés poner equipos nuevos desde el catálogo (grupo Equipos).</p>` : '')
      + (sin.length ? `<h4>Sin ubicar (${sin.length})</h4>${sin.map(d => fila(d)).join('')}` : '') + (con.length ? `<h4>En la maqueta (${con.length})</h4>${con.map(d => fila(d, 1)).join('')}` : ''); }
  $('#meqq').addEventListener('input', listaEquipos);
  $('#meql').addEventListener('click', e => { const b = e.target.closest('[data-uid]'); if (!b) return; const d = EQ.porUid.get(b.dataset.uid), ya = E.piezas.find(p => p.uid === b.dataset.uid);
    if (ya) { elegir(ya, true); return; } const t = EQ_DE[tipoReal(d)] || 'ups'; empezar({ t, uid: d.uid, nombre: d.nombre, modelo: d.modelo || '', ip: d.ip || '', mac: d.mac || '' }); if (motor.tactil) $('#meq').hidden = true; });
  // dónde está cada equipo: el galpón, la fila, la oficina o la columna más cercana
  function lugarDe(p) { const [x, z] = centro(p); let mejor = null, md = 1e9;
    for (const q of E.piezas) { if (q === p || !q.nombre || !['galpon', 'modulo', 'fila', 'alero', 'columna', 'terreno', 'rack'].includes(q.t)) continue; const T = TIPOS[q.t], v = { ...T.def, ...q }; let d;
      if (q.t === 'terreno') { d = dentro(x, z, q.pts) ? 50 : 1e9; } else { const dx = x - (q.x || 0), dz = z - (q.z || 0), c = Math.cos(-(q.r || 0)), s = Math.sin(-(q.r || 0)), lx = dx * c - dz * s, lz = dx * s + dz * c, hw = (v.ancho && q.t !== 'fila' ? v.ancho : v.largo || 4) / 2, hd = (q.t === 'fila' ? v.ancho * 1.4 : v.fondo || 4) / 2;
        d = Math.hypot(Math.max(0, Math.abs(lx) - hw), Math.max(0, Math.abs(lz) - hd)) + (q.t === 'columna' ? 2 : 0); }
      if (d < md) { md = d; mejor = q; } }
    return mejor && md < 40 ? mejor.nombre : E.nombre || 'Predio'; }
  const dentro = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

  // puntos de las líneas y áreas: se arrastran; tocar el punto del medio agrega uno; doble clic en un punto lo saca
  const manijas = new THREE.Group(); motor.scene.add(manijas); const MAN = new THREE.SphereGeometry(1, 14, 10), MANm = new THREE.MeshBasicMaterial({ color: 0x1d9bf0, depthTest: false }), MEDm = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.85 });
  function puntos() { manijas.clear(); if (!ED.on || !SEL || !SEL.pts) return; const s = Math.max(0.6, motor.C.d * 0.006), P = SEL.pts, cerr = TIPOS[SEL.t].forma === 'area' || SEL.cerrado;
    P.forEach((q, i) => { const m = new THREE.Mesh(MAN, MANm); m.scale.setScalar(s); m.position.set(q[0], 0.5, q[1]); m.userData.vertice = i; m.renderOrder = 9; manijas.add(m); });
    for (let i = 0; i < P.length - (cerr ? 0 : 1); i++) { const a = P[i], b = P[(i + 1) % P.length], m = new THREE.Mesh(MAN, MEDm); m.scale.setScalar(s * 0.65); m.position.set((a[0] + b[0]) / 2, 0.5, (a[1] + b[1]) / 2); m.userData.medio = i + 1; m.renderOrder = 9; manijas.add(m); } }
  motor.cada.push(() => { if (ED.on && SEL && SEL.pts && manijas.children[0]) { const s = Math.max(0.6, motor.C.d * 0.006); if (Math.abs(manijas.children[0].scale.x - s) > s * 0.1) { manijas.children.forEach(m => m.scale.setScalar(m.userData.medio ? s * 0.65 : s)); return true; } } });

  // mouse: lo que el editor agarra no mueve la cámara
  motor.agarrar = e => { if (!ED.on) return false; const p0 = motor.enPiso(e.clientX, e.clientY); if (!p0) return false;
    if (ED.colocar || ED.linea) return true;
    const mh = SEL && SEL.pts && motor.tocar(e.clientX, e.clientY, manijas.children)[0];
    if (mh) { const ud = mh.object.userData; if (ud.medio != null) { SEL.pts.splice(ud.medio, 0, [pegar(p0.x, e.altKey), pegar(p0.z, e.altKey)]); ED.drag = { v: ud.medio }; } else ED.drag = { v: ud.vertice }; rehacer(SEL); return true; }
    const h = hallar(e); if (!h) { if (ED.h === 'mano') { elegir(null); } return false; }
    if (ED.h === 'maza') { sacar(h.p); return true; } if (ED.h === 'gotero') { const c = JSON.parse(JSON.stringify(h.p)); delete c.id; delete c.uid; delete c.pts; empezar(c); herramientaVis('gotero'); return true; }
    elegir(h.p); ED.drag = { p: h.p, x0: p0.x, z0: p0.z, orig: h.p.pts ? h.p.pts.map(q => [...q]) : [h.p.x || 0, h.p.z || 0], movido: false }; return true; };
  const herramientaVis = h => { canvas.dataset.h = h; };
  motor.mover = e => { const p = motor.enPiso(e.clientX, e.clientY); if (!p) return; const D = ED.drag; if (!D) return;
    if (D.v != null) { SEL.pts[D.v] = [pegar(p.x, e.altKey), pegar(p.z, e.altKey)]; rehacer(SEL); return; }
    const dx = p.x - D.x0, dz = p.z - D.z0; if (!D.movido && Math.hypot(dx, dz) < motor.C.d * 0.004) return; D.movido = true; canvas.classList.add('lleva');
    if (D.p.pts) { D.p.pts = D.orig.map(q => [pegar(q[0] + dx, e.altKey), pegar(q[1] + dz, e.altKey)]); rehacer(D.p); }
    else { D.p.x = pegar(D.orig[0] + dx, e.altKey); D.p.z = pegar(D.orig[1] + dz, e.altKey); const g = objs.get(D.p.id); g.position.set(D.p.x, 0.25, D.p.z); marcar(); motor.dirty = true; } };
  motor.soltar = (e, gesto) => { canvas.classList.remove('lleva'); const D = ED.drag; ED.drag = null; if (gesto || !D) return; if (D.p && !D.p.pts) { const g = objs.get(D.p.id); if (g) g.position.y = 0; } if (D.movido || D.v != null) cambio(); else if (D.p) info(); motor.dirty = true; };
  motor.pasar = e => { const p = motor.enPiso(e.clientX, e.clientY);
    if (ED.colocar && p) { const C = ED.colocar; if (!C.p) { C.p = { ...JSON.parse(JSON.stringify(C.tpl)), id: nuevoId(C.tpl.t), x: 0, z: 0, r: C.tpl.r || 0 }; E.piezas.push(C.p); rehacer(C.p); }
      C.p.x = pegar(p.x, e.altKey); C.p.z = pegar(p.z, e.altKey);
      // un equipo cerca de una columna de luz se engancha a la columna (como se instalan las cámaras y los Wi-Fi del patio)
      if (TIPOS[C.p.t].equipo && !e.altKey) { const col = E.piezas.find(q => q.t === 'columna' && Math.hypot((q.x || 0) - p.x, (q.z || 0) - p.z) < 3); if (col) { C.p.x = col.x; C.p.z = (col.z || 0) + 0.5; if (C.tpl.y == null) { const h = (col.alto || 25); C.p.y = Math.max(3, h - (C.p.t === 'camara' ? 4 : 6)); } if (!C.p._col) { C.p._col = 1; rehacer(C.p); } } else if (C.p._col) { delete C.p._col; if (C.tpl.y == null) delete C.p.y; rehacer(C.p); } }
      const g = objs.get(C.p.id); if (g) { g.position.set(C.p.x, 0.25, C.p.z); g.rotation.y = C.p.r || 0; } motor.dirty = true; return; }
    if (ED.linea && p && ED.linea.p) { const L = ED.linea; L.p.pts = [...L.pts, [pegar(p.x, e.altKey), pegar(p.z, e.altKey)]]; if (L.p.pts.length >= 2) rehacer(L.p); return; }
    if (!ED.on && e.pointerType === 'mouse') { const h = hallar(e), g = h && objs.get(h.p.id); cajaH.visible = !!g && g !== objs.get(SEL && SEL.id) && TIPOS[h.p.t].forma === 'punto'; if (cajaH.visible) { cajaH.box.setFromObject(g); cajaH.box.expandByScalar(0.2); } canvas.classList.toggle('sobre', !!h && TIPOS[h.p.t].forma === 'punto'); motor.dirty = true; }
    else if (ED.on && e.pointerType === 'mouse') { const h = hallar(e); canvas.classList.toggle('sobre', !!h); } };
  let ultimoToque = 0;
  motor.alTocar = e => { if (ED.on) return; const h = hallar(e); elegir(h ? h.p : null); };
  canvas.addEventListener('pointerup', e => { if (!ED.on || e.button !== 0) return; const p = motor.enPiso(e.clientX, e.clientY); if (!p) return;
    if (ED.colocar && !ED.colocar.p) motor.pasar(e);
    if (ED.colocar && ED.colocar.p) { const C = ED.colocar, nuevo = C.p; delete nuevo._col; objs.get(nuevo.id).position.y = 0; C.p = null; elegir(nuevo); cambio(); if (!e.shiftKey) { ED.colocar = null; herramienta(ED.h); toast(`${TIPOS[nuevo.t].n} ubicado`); } else motor.pasar(e); return; }
    if (ED.linea) { const L = ED.linea, ahora = performance.now(), dbl = ahora - ultimoToque < 320; ultimoToque = ahora; const q = [pegar(p.x, e.altKey), pegar(p.z, e.altKey)];
      if (dbl) { terminarLinea(); return; } L.pts.push(q); if (!L.p) { L.p = { ...JSON.parse(JSON.stringify(L.tpl)), id: nuevoId(L.tpl.t), pts: [...L.pts] }; E.piezas.push(L.p); } L.p.pts = [...L.pts]; if (L.pts.length >= 2) rehacer(L.p); } });
  function terminarLinea() { const L = ED.linea; if (!L) return; const min = TIPOS[L.tpl.t].forma === 'area' ? 3 : 2; if (L.p && L.pts.length >= min) { L.p.pts = [...L.pts]; rehacer(L.p); const p = L.p; L.p = null; ED.linea = null; elegir(p); cambio(); herramienta(ED.h); toast(`${TIPOS[p.t].n} listo`); } else { cancelar(); toast('Faltan puntos'); } }
  addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; } const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (k === 'f' && !mod && puede) { editar(!ED.on); return; }
    if (k === 'escape') { if (!$('#mcat').hidden) { $('#mcat').hidden = true; return; } if (!$('#meq').hidden) { $('#meq').hidden = true; return; } if (ED.colocar || ED.linea) { cancelar(); return; } if (SEL) { elegir(null); return; } if (ED.on) { editar(false); return; } if (document.documentElement.classList.contains('mfull')) pantalla(false); return; }
    if (!ED.on) return;
    if (mod && k === 'z') { e.preventDefault(); volver(e.shiftKey ? redo : undo, e.shiftKey ? undo : redo); return; } if (mod && k === 'y') { e.preventDefault(); volver(redo, undo); return; } if (mod && k === 'd') { e.preventDefault(); duplicar(); return; }
    if (mod) return;
    if (k === 'tab' || k === 'i') { e.preventDefault(); catalogo($('#mcat').hidden); return; }
    if (k === 'h') herramienta('mano'); if (k === 'k') herramienta('maza'); if (k === 'e') herramienta('gotero');
    if (k === 'g') { $('#bgrid').click(); }
    if (k === 'enter' && ED.linea) terminarLinea(); if (k === 'backspace' && ED.linea) { e.preventDefault(); ED.linea.pts.pop(); if (ED.linea.p) { ED.linea.p.pts = [...ED.linea.pts]; if (ED.linea.pts.length >= 2) rehacer(ED.linea.p); } return; }
    if ((k === 'delete' || k === 'backspace') && SEL) { e.preventDefault(); sacar(SEL); return; }
    const giro = k === ',' ? -Math.PI / 4 : k === '.' ? Math.PI / 4 : k === 'r' ? Math.PI / 2 : 0;
    if (giro) { const p = ED.colocar ? ED.colocar.p || (ED.colocar.tpl.r = (ED.colocar.tpl.r || 0) + giro, null) : SEL; if (p && !p.pts) { p.r = Math.round(((p.r || 0) + giro) / (Math.PI / 4)) * Math.PI / 4; const g = objs.get(p.id); if (g) g.rotation.y = p.r; if (ED.colocar) ED.colocar.tpl.r = p.r; else { marcar(); cambio(); info(); } motor.dirty = true; } } });

  // ---------- guardar ----------
  let guardT = null; const estado = t => { const s = $('#mguar'); if (s) s.textContent = t; };
  function snapshot() { const ext = E.piezas.filter(p => p.uid).map(p => ({ uid: p.uid, id: p.id, nombre: p.nombre || '', lugar: lugarDe(p), nave: '' }));
    return { ...((host && host.state) || {}), v: 1, motor: 1, escena: E, ext }; }
  function guardar() { if (!puede) return; estado('Guardando…'); clearTimeout(guardT); guardT = setTimeout(() => { const s = JSON.parse(JSON.stringify(snapshot()));
      if (host && host.save) { host.save(s); if (host) host.state = s; estado('Guardado ' + new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })); }
      else { try { localStorage.setItem(o.clave || 'motor.escena', JSON.stringify(s)); estado('Guardado en este navegador'); } catch (er) { estado('No se pudo guardar'); } }
      o.alGuardar && o.alGuardar(s); }, 900); }

  // ---------- animación de equipos caídos y medición ----------
  motor.cada.push((dt, t) => { let x = false; for (const p of E.piezas) { const g = objs.get(p.id); if (g && g.userData.estado === 'crit' && g.userData.aro) { g.userData.aro.material.opacity = 0.45 + 0.45 * Math.sin(t * 0.008); x = true; } } return x; });
  if (/[?&]medir=1/.test(location.search)) { const s = $('#mstats'); s.hidden = false; setInterval(() => { const m = motor.stats; s.textContent = `${m.fps} c/s · ${m.ms} ms · ${m.dibujos} dibujos · ${Math.round(m.triangulos / 1000)} mil triángulos`; }, 700); }
  addEventListener('message', e => { const d = e.data || {}; if (d.tema) motor.ponerTema(d.tema === 'dark' || d.tema === 'oscuro' ? 'oscuro' : 'claro'); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', m => { if (!o.tema) motor.ponerTema(m.matches ? 'oscuro' : 'claro'); });
  document.addEventListener('fullscreenchange', () => document.documentElement.classList.toggle('mfull', !!document.fullscreenElement));

  armarTodo();
  const enc = E.inicio || encuadre(); motor.inicio(enc); if (o.intro !== false) { Object.assign(motor.C, { ...enc, d: enc.d * 1.35, yaw: enc.yaw - 0.45, pitch: Math.min(1.2, enc.pitch + 0.2) }); motor.ir(enc, 1.8); }
  const api = { motor, E, objs, elegir, editar, guardar, snapshot, armarTodo, leerEquipos, lugarDe, get sel() { return SEL; }, cargar(esc2) { E = normal(esc2); api.E = E; foto = JSON.stringify(E.piezas); undo.length = redo.length = 0; SEL = null; armarTodo(); info(); $('#mnom').textContent = E.nombre; motor.inicio(E.inicio || encuadre()); motor.vista(); } };
  return api;
}
function normal(e) { e = JSON.parse(JSON.stringify(e || {})); e.v = 1; e.piezas = (e.piezas || []).filter(p => p && p.t && TIPOS[p.t]); let n = 0; for (const p of e.piezas) if (!p.id) p.id = p.t.slice(0, 3) + 'x' + (n++); return e; }
// las personas del catálogo vienen con los brazos abiertos: se bajan al costado del cuerpo
function brazos(p) { p.updateMatrixWorld(true); const B = {}; p.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; }); if (!B.LeftArm) return;
  const wp = n => B[n].getWorldPosition(new THREE.Vector3()), gira = (n, a, b, s) => { if (!B[n] || !B[b]) return; const d = wp(b).sub(wp(a)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(s * 0.12, -1, 0.04).normalize()), pw = B[n].parent.getWorldQuaternion(new THREE.Quaternion()), bw = B[n].getWorldQuaternion(new THREE.Quaternion());
    B[n].quaternion.copy(pw.invert().multiply(q).multiply(bw)); p.updateMatrixWorld(true); };
  const s = Math.sign(wp('LeftArm').x - wp('RightArm').x) || 1; gira('LeftArm', 'LeftArm', 'LeftForeArm', s); gira('LeftForeArm', 'LeftForeArm', 'LeftHand', s); gira('RightArm', 'RightArm', 'RightForeArm', -s); gira('RightForeArm', 'RightForeArm', 'RightHand', -s); }

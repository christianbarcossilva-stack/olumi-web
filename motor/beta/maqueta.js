// Motor común · la maqueta: arma las piezas, muestra etiquetas y capas, y trae el editor (comandos de Los Sims 4), el modo construcción
// (construir.js: paredes, recintos, puertas y ventanas) y el recorrido a pie (recorrer.js).
// La usan Ondi (equipos en vivo), Darvi (patio y contenedores) y Olumi (oficina). Cada app le pasa su "anfitrión" (host):
//   host.state      lo guardado ({ v:1, motor:1, escena, ext })      host.save(state)   guarda
//   host.role       'inst' edita, 'cli' solo mira                   host.equipos()     lista de equipos reales (Ondi)
//   host.juego(on)  pantalla completa dentro de la app               host.park          nombre del lugar
//   host.clave(o)   pide la clave de borrado de la empresa (promesa: true o false); sin eso, se confirma manteniendo apretado
//   host.abrirDoc(p) abre la documentación de un rack o gabinete (bocas, patch cords, fibras)
import { THREE, crearMotor } from './nucleo.js?v=3';
import { TIPOS, GRUPOS, armarPieza, centro, altoDe, matSuelo, ABERTURAS, areaSig } from './piezas.js?v=10';
import { ve, dominio, DOMINIOS } from '../plano.js?v=2';
import { svg } from './iconos.js?v=1';
import { construir } from './construir.js?v=1';
import { recorrer } from './recorrer.js?v=1';

const $ = (s, r = document) => r.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAPAS = [['base', 'Construcciones y caminos'], ['logistica', 'Contenedores y vehículos'], ['vegetacion', 'Árboles'], ['equipos', 'Equipos'], ['campos', 'Campo de las cámaras'], ['etiquetas', 'Nombres'], ['techos', 'Techos']];
const EQ_DE = { cam: 'camara', ap: 'ap', sw: 'switch', gw: 'router', sen: 'sensor', otro: 'ups' };
const ESTADO = e => ['online', 'en_linea', 'abierta', 'cerrada'].includes(e) ? 'ok' : ['offline', 'caido'].includes(e) ? 'crit' : ['alerting', 'atencion'].includes(e) ? 'warn' : 'off';
const ESTX = { ok: 'En línea', crit: 'Caído', warn: 'Con alertas', off: 'Sin dato' };
const tipoReal = d => { if (/^sensor_/.test(d.tipo || '')) return 'sen'; if (d.tipo) return { camara: 'cam', nvr: 'cam', switch: 'sw', ap: 'ap', router: 'gw' }[d.tipo] || 'otro'; const t = [d.linea, d.modelo, d.nombre].join(' ').toLowerCase();
  if (/protect|camera|cámara|camara|bullet|dome|domo|turret|\bg[345]\b|nvr/.test(t)) return 'cam'; if (/usw|switch|flex mini/.test(t)) return 'sw'; if (/udm|uxg|usg|ucg|gateway|dream|router|cloud key/.test(t)) return 'gw'; if (/\bu[67]\b|uap|\bap\b|mesh|nanohd|access point|wi-?fi/.test(t)) return 'ap'; return 'otro'; };

// el logo de cada app en la barra (el mismo dibujo que su ícono)
const LOGO = {
  darvi: '<svg class="mapp" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="28" fill="var(--acc)"/><rect x="24" y="74" width="70" height="15" rx="4.5" fill="var(--acc-ink)"/><rect x="24" y="53" width="54" height="15" rx="4.5" fill="var(--acc-ink)" fill-opacity=".82"/><rect x="24" y="32" width="38" height="15" rx="4.5" fill="var(--acc-ink)" fill-opacity=".62"/><circle cx="87" cy="38" r="10.5" fill="#3ddc97"/></svg>'
};
const BUSCA = { darvi: 'Buscar fila, galpón o máquina', olumi: 'Buscar sala, puesto o persona' };
const SIN = { darvi: ['Equipos'] };   // Darvi es solo logística: lo informático es de Ondi
// barra de herramientas del editor: las teclas 1 a 8 las eligen en este orden
const HERR = [['mano', 'Mano: elegir y mover', 'H'], ['pared', 'Pared: punto por punto', 'B'], ['recinto', 'Recinto: de esquina a esquina', 'N'], ['puerta', 'Puerta sobre una pared', ''], ['ventana', 'Ventana sobre una pared', ''], ['catalogo', 'Catálogo', 'Tab'], ['gotero', 'Gotero: copiar', 'E'], ['maza', 'Maza: sacar', 'K']];
const ORDEN = [...GRUPOS]; ORDEN.splice(ORDEN.indexOf('Construcción') + 1, 0, 'Puertas y ventanas');
const GAMMA = Uint8Array.from({ length: 256 }, (_, i) => Math.round(Math.pow(i / 255, 1 / 2.2) * 255));
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('es-UY', { maximumFractionDigits: 2 });

export async function abrirMaqueta(o) {
  const host = o.host || null, raiz = o.raiz || document.body, app = o.app || 'ondi';
  const puede = o.editable ?? (!host || host.role !== 'cli');
  let E = normal(o.escena || (host && host.state && host.state.escena) || { v: 1, nombre: (host && host.park) || 'Maqueta', piezas: [] });
  if (host && !E.piezas.length) E.piezas.push({ id: 'ter1', t: 'terreno', nombre: E.nombre, mat: 'tierra', pts: [[-60, -40], [60, -40], [60, 40], [-60, 40]] });
  // ---------- pantalla ----------
  raiz.insertAdjacentHTML('beforeend', `<canvas id="m3d" tabindex="0" aria-label="Maqueta 3D de ${esc(E.nombre)}. Arrastrá para mover; rueda o dos dedos para acercar; clic derecho, o dos dedos de costado, para girar."></canvas><div id="mlbl" aria-hidden="true"></div>
  <header class="mbar vidrio"><div class="mmarca">${LOGO[app] || `<i class="mapp mapp-${app}"></i>`}<div><b id="mnom">${esc(E.nombre)}</b><span id="mguar">${puede ? 'Los cambios se guardan solos' : 'Solo lectura'}</span></div></div>
    <label class="mbus">${svg('buscar', 16)}<input id="mq" type="search" placeholder="${BUSCA[app] || 'Buscar fila, galpón, equipo o IP'}" autocomplete="off" aria-label="Buscar"><div id="mres" class="vidrio" hidden></div></label>
    <div class="mbtns"><button id="btema" class="mbtn" aria-label="Cambiar entre día y noche" title="Día o noche">${svg('tema')}</button><button id="bcapas" class="mbtn" aria-label="Capas y paredes" title="Capas y paredes">${svg('capas')}</button><button id="bplano" class="mbtn" aria-pressed="false" aria-label="Ver desde arriba" title="Ver desde arriba (planta)">${svg('plano')}</button><button id="bvista" class="mbtn" aria-label="Vista general" title="Vista general">${svg('vista')}</button><button id="bpaseo" class="mbtn" aria-pressed="false" aria-label="Recorrer caminando" title="Recorrer caminando">${svg('caminar')}</button><button id="bfull" class="mbtn" aria-label="Pantalla completa" title="Pantalla completa">${svg('full')}</button>${puede ? `<button id="bedit" class="mbtn pri" aria-pressed="false" title="Editar (F)">${svg('editar')}<span>Editar</span></button>` : ''}</div></header>
  <div id="mcapas" class="vidrio mpop" hidden>${CAPAS.filter(([k]) => !(app === 'darvi' && (k === 'equipos' || k === 'campos'))).map(([k, n]) => `<label class="msw"><span>${n}</span><input type="checkbox" data-capa="${k}" checked><i></i></label>`).join('')}
    <div class="mseg" role="group" aria-label="Paredes"><span>Paredes</span><div>${[['alta', 'Altas'], ['corte', 'Cortadas'], ['baja', 'Al ras']].map(([k, n]) => `<button data-pared="${k}" aria-pressed="${k === 'alta'}">${n}</button>`).join('')}</div></div><p class="mvacio" id="mocultos" hidden></p></div>
  <aside id="minfo" class="vidrio" hidden></aside>
  <nav id="mtool" class="vidrio" hidden aria-label="Herramientas">${HERR.map(([k, n, t], i) => `<button data-h="${k}" aria-pressed="${k === 'mano'}" title="${n} (${i + 1}${t ? ' o ' + t : ''})" aria-label="${n}">${svg(k)}<sup>${i + 1}</sup></button>`).join('')}${host && host.equipos ? `<button id="beq" title="Equipos del cliente" aria-label="Equipos del cliente">${svg('equipos')}</button>` : ''}
    <span class="msep"></span><button id="bundo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${svg('deshacer')}</button><button id="bredo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer">${svg('rehacer')}</button><button id="bgrid" aria-pressed="true" title="Grilla (G)" aria-label="Grilla">${svg('grilla')}</button><button id="bpared" title="Paredes altas, cortadas o al ras (P)" aria-label="Vista de las paredes">${svg('paredes')}</button><button id="bpap" title="Papelera: recuperar lo sacado" aria-label="Papelera">${svg('restaurar')}</button></nav>
  <section id="mcat" class="vidrio mhoja" hidden aria-label="Catálogo"><div class="mhead"><b>Catálogo</b><input id="mcq" type="search" placeholder="Buscar" aria-label="Buscar en el catálogo"><button class="mx" data-cerrar="mcat" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div id="mcl"></div><label class="mimp">${svg('mas', 16)}Importar piezas de un archivo (.json)<input id="mimp" type="file" accept=".json,application/json" hidden></label></section>
  <section id="meq" class="vidrio mhoja" hidden aria-label="Equipos del cliente"><div class="mhead"><b>Equipos del cliente</b><input id="meqq" type="search" placeholder="Nombre, modelo o IP" aria-label="Buscar equipo"><button class="mx" data-cerrar="meq" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div id="meql"></div></section>
  <div id="mmenu" class="vidrio" hidden role="menu"></div><div id="mconf" hidden></div>
  <div id="mhint" class="vidrio" hidden></div><div id="mtoast" class="vidrio" hidden role="status"></div>
  <div id="mstats" hidden></div>`);
  const canvas = $('#m3d'), motor = crearMotor(canvas, { tema: o.tema, ruedaConCtrl: o.ruedaConCtrl }), mundo = new THREE.Group(); motor.scene.add(mundo);
  const objs = new Map(), lbl = $('#mlbl');
  let tostT; const toast = m => { const t = $('#mtoast'); t.textContent = m; t.hidden = false; clearTimeout(tostT); tostT = setTimeout(() => t.hidden = true, 2800); };
  // la pista de la herramienta se muestra chica y a los segundos se aclara sola, para no tapar
  let hintT; const hint = m => { const h = $('#mhint'); clearTimeout(hintT); h.hidden = !m; h.classList.remove('tenue'); if (m) { h.innerHTML = m; hintT = setTimeout(() => h.classList.add('tenue'), 9000); } };

  // suelo de fondo (pasto) que acompaña el tema
  const pg = new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2); { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9000, uv.getY(i) * 9000); }
  const suelo = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ roughness: 1 })); suelo.position.y = -0.02; suelo.receiveShadow = true; motor.scene.add(suelo);
  // de noche, una grilla de 10 m en el color de la app que se apaga hacia lo lejos (la vibra de tecnología)
  const grillaNoche = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(240, 240); t.anisotropy = 8;
    const f = document.createElement('canvas'); f.width = f.height = 256; const y = f.getContext('2d'), gr = y.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#888'); gr.addColorStop(1, '#000'); y.fillStyle = gr; y.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, alphaMap: new THREE.CanvasTexture(f), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -16, polygonOffsetUnits: -12 }));
    m.position.y = 0.06; m.renderOrder = 1; m.visible = false; motor.scene.add(m); return m; })();
  const pintaSuelo = () => { suelo.material = matSuelo('pasto', { roughness: 1 }); grillaNoche.visible = motor.tema === 'oscuro'; grillaNoche.material.color.set(getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#3fc6ea'); };

  // ---------- equipos reales (Ondi) ----------
  const EQ = { lista: [], porUid: new Map(), at: 0 };
  async function leerEquipos(forzar) { if (!host || !host.equipos) return; if (!forzar && Date.now() - EQ.at < 55000) return; EQ.at = Date.now();
    try { const r = await host.equipos(); EQ.lista = (r && r.list) || []; EQ.errs = (r && r.errs) || []; } catch (e) { EQ.errs = ['No se pudieron leer los equipos']; }
    EQ.porUid = new Map(EQ.lista.map(d => [d.uid, d]));
    for (const p of E.piezas) if (p.uid && TIPOS[p.t] && TIPOS[p.t].equipo) { const d = EQ.porUid.get(p.uid), g = objs.get(p.id); if (d && d.nombre && p.nombre !== d.nombre) p.nombre = d.nombre; if (g && g.userData.estado !== ESTADO(d && d.estado)) rehacer(p); }
    if (!$('#meq').hidden) listaEquipos(); if (SEL) info(); }
  const ctx = { paredes: 'alta', estado: p => p.uid ? (EQ.porUid.has(p.uid) ? ESTADO(EQ.porUid.get(p.uid).estado) : 'off') : (p.estado || 'off'), glb: o.catalogo ? cargarGLB : null };
  if (host && host.equipos) { leerEquipos(true); setInterval(() => leerEquipos(true), 60000); }

  // ---------- modelos del catálogo de Olumi (personas y vehículos) ----------
  const GLB = {}, PERS = new Set(); let cat = null, loader = null, AVM = null, avAcc = 0;
  async function cargarGLB(tipo, id, g, color, pid) { try { if (!loader) { const { GLTFLoader } = await import('three/addons/GLTFLoader.js'); loader = new GLTFLoader(); }
      cat = cat || await (await fetch(o.catalogo + 'catalogo.json')).json(); const it = (cat[tipo] || []).find(x => x.id === id); if (!it) return;
      GLB[id] = GLB[id] || new Promise((ok, no) => loader.load(o.catalogo + it.archivo, x => ok(x.scene), undefined, no)); const base = await GLB[id];
      const { clone } = await import('three/addons/SkeletonUtils.js'); const m = clone(base); m.traverse(k => { if (k.isMesh) { k.castShadow = k.receiveShadow = true; if (k.isSkinnedMesh) k.frustumCulled = false; if (color && tipo === 'vehiculos') for (const q of [].concat(k.material)) if (q.name === 'pintura') { k.material = q.clone(); k.material.color.set(color); } } k.userData.dueño = g; });
      let pon = m;
      // personas: el mismo núcleo y la misma variedad de Olumi (reposo natural, respira y cambia el peso de pierna; piel, pelo y ropa propios de cada una)
      if (tipo === 'avatares') { let ob = null; try { AVM = AVM || await import('../avatar.js?v=1'); ob = AVM.avatarGLB(m, it.alto * (1 + ((AVM.hsh(pid || id) % 7) - 3) * 0.006)); } catch (e) { ob = null; }
        if (ob) { AVM.variar(ob, pid || id); pon = new THREE.Group(); pon.rotation.y = -Math.PI / 2; pon.add(ob.g); ob.semilla = AVM.hsh(pid || id) % 997; AVM.avPose(ob, 'idle', 0.016, { x: 0, y: 0, t: ob.semilla }); ob.sync(); ob.dueño = g; PERS.add(ob); }
        else { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(it.alto / (b.max.y - b.min.y)); brazos(m); } }
      g.clear(); g.add(pon); motor.dirty = true; } catch (e) { /* sin catálogo: queda la figura simple */ } }

  // ---------- armar la escena ----------
  function rehacer(p) { const v = objs.get(p.id); if (v) { mundo.remove(v); limpiar(v); } const g = armarPieza(p, ctx); if (!g) return; objs.set(p.id, g); mundo.add(g); aplicarCapas(g); motor.dirty = true; if (SEL === p) marcar(); if (TIPOS[p.t].etiqueta) etiquetas(); }
  // cada app muestra su parte del plano; lo que no muestra queda guardado tal cual para la app que lo usa
  const veo = p => ve(app, p);
  function ocultas() { const c = {}; for (const p of E.piezas) if (!veo(p)) c[dominio(p)] = (c[dominio(p)] || 0) + 1; const t = Object.entries(c).map(([k, n]) => `${n} de ${DOMINIOS[k]}`).join(' y '), el = $('#mocultos'); if (!el) return;
    el.hidden = !t; el.textContent = t ? `Este plano también tiene ${t}${c.equipos ? ' (se ven en Ondi)' : ''}. Acá no se muestran y no se tocan.` : ''; }
  function armarTodo() { for (const g of objs.values()) { mundo.remove(g); limpiar(g); } objs.clear(); ocultas(); for (const p of E.piezas) { if (!veo(p)) continue; const g = armarPieza(p, ctx); if (g) { objs.set(p.id, g); mundo.add(g); aplicarCapas(g); } } pintaSuelo(); etiquetas(); motor.dirty = true; }
  function limpiar(g) { g.traverse(k => { if (k.geometry && !k.geometry.parameters?.width && k.geometry.type !== 'BoxGeometry' && k.geometry.type !== 'CylinderGeometry' && k.geometry.type !== 'IcosahedronGeometry' && k.geometry.type !== 'ConeGeometry') k.geometry.dispose(); }); }
  const capas = Object.fromEntries(CAPAS.map(([k]) => [k, true]));
  function aplicarCapas(g) { const T = g.userData.tipo; g.visible = capas[T.capa] !== false; g.traverse(k => { if (k.userData.techo) k.visible = capas.techos; if (k.userData.campo) k.visible = capas.campos; }); }
  motor.alTema.push(() => { armarTodo(); });
  function encuadre() { const b = new THREE.Box3(); for (const p of E.piezas) { const [x, z] = centro(p); if (p.pts) for (const q of p.pts) b.expandByPoint(new THREE.Vector3(q[0], 0, q[1])); else b.expandByPoint(new THREE.Vector3(x, 0, z)); }
    if (b.isEmpty()) return { tx: 0, tz: 0, yaw: 0.7, pitch: 0.75, d: 160 }; const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return { tx: c.x, tz: c.z, yaw: 0.7, pitch: 0.72, d: Math.max(60, Math.max(s.x, s.z) * 1.05) }; }

  // ---------- etiquetas (nombres de filas, galpones y equipos) ----------
  let etq = [];
  function etiquetas() { lbl.innerHTML = ''; etq = [];
    for (const p of E.piezas) { const T = TIPOS[p.t]; if (!T || !T.etiqueta || !veo(p)) continue; const txt = T.etiqueta({ ...T.def, ...p }); if (!txt && !T.equipo) continue;
      const el = document.createElement('button'); el.className = 'metq' + (T.equipo ? ' eq ' + ctx.estado(p) : ''); el.tabIndex = -1;
      el.innerHTML = T.equipo ? `<i></i><span>${esc(txt || T.n)}</span>` : `<span>${esc(txt)}</span>`; el.addEventListener('click', () => elegir(p, true)); lbl.appendChild(el);
      const [x, z] = centro(p); etq.push({ p, el, v: new THREE.Vector3(x, altoDe(p) + (T.equipo ? 0.25 : 2), z), eq: !!T.equipo, cap: T.capa, siempre: !!T.siempre }); }
    motor.dirty = true; }
  let lejosAntes = null;
  motor.despues.push(() => { const d = motor.C.d, lejos = d > 75, w = canvas.clientWidth, h = canvas.clientHeight, pase = RC.R.on; lbl.classList.toggle('lejos', lejos); if (lejos !== lejosAntes) { lejosAntes = lejos; for (const e of etq) e.w = 0; }
    for (const e of etq) { const g = objs.get(e.p.id), vis = capas.etiquetas && g && g.visible && !e.p._p; if (!vis) { e.fuera = true; continue; }
      if (e.p.pts) { const [x, z] = centro(e.p); e.v.set(x, e.v.y, z); } else e.v.set(e.p.x || 0, e.v.y, e.p.z || 0);
      const s = motor.aPantalla(e.v); let fuera = s.z > 1 || s.x < -60 || s.y < -30 || s.x > w + 60 || s.y > h + 30 || (e.eq && d > 700 && !e.siempre);
      if (pase && Math.hypot(e.v.x - RC.R.x, e.v.z - RC.R.z) > (e.eq ? 16 : 70)) fuera = true;
      const el = e.p === SEL; if (el !== e.el2) { e.el2 = el; e.el.classList.toggle('elegida', el); e.w = 0; }
      e.fuera = fuera; e.sx = s.x; e.sy = s.y; e.sz = s.z; }
    // las que se pisan con una más cercana (o con la elegida) no se muestran
    const vis = etq.filter(e => e.fuera === false).sort((a, b) => (b.p === SEL) - (a.p === SEL) || a.sz - b.sz), puestas = [];
    for (const e of vis) { if (!e.w) { e.el.style.display = ''; e.w = e.el.offsetWidth || 80; e.h = e.el.offsetHeight || 24; }
      const r = [e.sx - e.w / 2 - 3, e.sy - e.h - 3, e.sx + e.w / 2 + 3, e.sy + 3], tapa = puestas.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
      e.el.style.display = tapa ? 'none' : ''; if (!tapa) { puestas.push(r); e.el.style.transform = `translate(${e.sx.toFixed(1)}px,${e.sy.toFixed(1)}px) translate(-50%,-100%)`; } }
    for (const e of etq) if (e.fuera) e.el.style.display = 'none'; });

  // ---------- elegir y ficha ----------
  // La ficha es chica: nombre, estado y unos botones. Lo demás (todos los datos, o las propiedades al editar) se abre con un botón y queda como uno lo dejó.
  let SEL = null; const caja = new THREE.Box3Helper(new THREE.Box3(), 0x1d9bf0), cajaH = new THREE.Box3Helper(new THREE.Box3(), 0x8ecbff); caja.visible = cajaH.visible = false; motor.scene.add(caja, cajaH);
  const UI = { abierta: false }; try { UI.abierta = localStorage.getItem('motor.ficha') === '1'; } catch (e) {}
  // la caja de lo elegido no cuenta el campo de visión ni el aro del piso (si no, una cámara queda adentro de una caja enorme)
  const cajaDe = (g, b) => { b.makeEmpty(); g.updateMatrixWorld(true); g.traverse(m => { if (m.isMesh && m.visible && !m.userData.campo && m !== g.userData.aro) b.expandByObject(m); }); return b; };
  function marcar() { const g = SEL && objs.get(SEL.id); caja.visible = !!g && !(TIPOS[SEL.t].forma !== 'punto' && ED.on); if (g) cajaDe(g, caja.box).expandByScalar(0.15); puntos(); motor.dirty = true; }
  function elegir(p, enfocar) { SEL = p; CON.alElegir(p); marcar(); info(); if (enfocar && p) { const [x, z] = centro(p); motor.ir({ tx: x, tz: z, d: Math.min(motor.C.d, TIPOS[p.t].equipo ? 45 : 140) }); } }
  function hallar(e) { const hit = motor.tocar(e.clientX, e.clientY, [...objs.values()].filter(g => g.visible)); for (const h of hit) { const g = h.object.userData.dueño; if (g && g.visible) { if (h.object.userData.campo || g.userData.pieza._p) continue; return { p: g.userData.pieza, h }; } } return null; }
  function info() { const box = $('#minfo'); if (!SEL) { box.hidden = true; return; } const T = TIPOS[SEL.t], q = { ...T.def, ...SEL }, cerrar = `<button class="mx" data-sel="no" aria-label="Cerrar">${svg('cerrar', 16)}</button>`;
    box.hidden = false; box.classList.toggle('abierta', UI.abierta); const propia = ED.on && puede && CON.ficha(); if (propia) { box.classList.add('abierta'); box.innerHTML = propia; return; }
    const d = SEL.uid && EQ.porUid.get(SEL.uid), est = T.equipo ? ctx.estado(SEL) : null, g = objs.get(SEL.id);
    const doc = T.protegido && host && host.abrirDoc ? `<button class="mic" data-acc="doc" title="Abrir su documentación (equipos, bocas y cables)" aria-label="Abrir documentación">${svg('doc')}</button>` : '';
    const mas = n => `<button class="mic" data-acc="mas" aria-expanded="${UI.abierta}" title="${n}" aria-label="${n}">${svg(ED.on ? 'ajustes' : 'abajo')}</button>`;
    if (ED.on && puede) { const conNombre = T.campos.some(c => c.k === 'nombre');
      box.innerHTML = `<div class="mfila"><div class="mtit"><small>${esc(T.n)}${SEL.t === 'recinto' ? ' · ' + fmt(Math.abs(areaSig(SEL.pts))) + ' m²' : ''}</small>${conNombre ? `<input class="mnom" data-k="nombre" value="${esc(q.nombre || '')}" placeholder="Nombre" aria-label="Nombre">` : ''}</div>
        <button class="mic" data-acc="girar" title="Girar 90° (R)" aria-label="Girar 90°">${svg('girar')}</button><button class="mic" data-acc="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">${svg('duplicar')}</button>${doc}<button class="mic peligro" data-acc="borrar" title="Sacar (Supr)${T.protegido ? ': pide la clave' : ''}" aria-label="Sacar">${svg(T.protegido ? 'candado' : 'borrar')}</button>${mas('Propiedades')}${cerrar}</div>
        <div class="mmas"><div class="mform">${T.campos.filter(c => c.k !== 'nombre').map(c => campo(c, q)).join('')}${T.equipo && EQ.lista.length ? vinculo(q) : ''}${T.equipo && !q.uid && host && host.crearEquipo ? `<button class="mbtn" data-acc="alta">${svg('mas', 16)}Sumarlo a la lista de equipos del cliente</button>` : ''}</div></div>`; return; }
    const filas = (T.equipo ? [['Estado', `<span class="mpill ${est}">${ESTX[est]}</span>`], ['Modelo', esc((d && d.modelo) || q.modelo)], ['IP', esc((d && d.ip) || q.ip)], ['MAC', esc((d && d.mac) || q.mac)], ['Altura', q.y != null ? q.y + ' m' : ''], ['Dónde', esc(lugarDe(SEL))], ['Notas', esc(q.notas)]]
      : SEL.t === 'fila' ? [['Contenedores', g && g.userData.cuenta], ['Tipo', q.carga === 'reefer' ? 'Refrigerados' : 'Secos'], ['Medida', q.pies + ' pies'], ['Ancho', q.ancho + ' contenedores'], ['Alto máximo', q.alto], ['Largo', q.largo + ' m']]
      : [...(SEL.t === 'recinto' ? [['Superficie', fmt(Math.abs(areaSig(SEL.pts))) + ' m²']] : []), ...T.campos.filter(c => !['nombre', 'x', 'z', 'r'].includes(c.k) && q[c.k] !== undefined && q[c.k] !== '' && c.t !== 'color').map(c => [c.n, c.t === 'sel' ? esc((c.ops.find(z => z[0] == q[c.k]) || [, q[c.k]])[1]) : c.t === 'bool' ? (q[c.k] ? 'Sí' : 'No') : esc(q[c.k])])]).filter(f => f[1] !== undefined && f[1] !== '' && f[1] !== null);
    const sub = T.equipo ? [T.n.replace(/ \(.*/, ''), (d && d.modelo) || q.modelo, (d && d.ip) || q.ip].filter(Boolean).join(' · ') : T.n;
    box.innerHTML = `<div class="mfila">${T.equipo ? `<i class="mest ${est}" title="${ESTX[est]}"></i>` : ''}<div class="mtit"><b>${esc(q.nombre || (d && d.nombre) || T.n)}</b><small>${esc(sub)}</small></div><button class="mic" data-acc="enfocar" title="Enfocar" aria-label="Enfocar">${svg('enfocar')}</button>${doc}${filas.length ? mas('Más datos') : ''}${cerrar}</div>
      <div class="mmas"><dl class="mdl">${filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`; }
  function campo(c, q) { const v = q[c.k] ?? '', id = 'f_' + c.k;
    if (c.t === 'sel') return `<label><span>${c.n}</span><select id="${id}" data-k="${c.k}">${c.ops.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
    if (c.t === 'bool') return `<label class="msw"><span>${c.n}</span><input id="${id}" type="checkbox" data-k="${c.k}" ${v ? 'checked' : ''}><i></i></label>`;
    if (c.t === 'color') return `<label><span>${c.n}</span><span class="mcol"><input id="${id}" type="color" data-k="${c.k}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'}">${c.k === 'carga' || c.k === 'color' && !v ? `<button class="mbtn chico" data-sin="${c.k}">Sin</button>` : ''}</span></label>`;
    if (c.t === 'area') return `<label><span>${c.n}</span><textarea id="${id}" data-k="${c.k}" rows="2">${esc(v)}</textarea></label>`;
    if (c.t === 'ang') return `<label><span>${c.n}</span><input id="${id}" type="number" step="15" data-k="${c.k}" data-ang="1" value="${Math.round((+v || 0) * 180 / Math.PI)}"></label>`;
    return `<label><span>${c.n}</span><input id="${id}" ${c.t === 'num' ? `type="number" inputmode="decimal" step="${c.paso || 1}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''}` : 'type="text"'} data-k="${c.k}" value="${esc(v)}"></label>`; }
  function vinculo(q) { const usados = new Set(E.piezas.filter(p => p.uid && p !== SEL).map(p => p.uid));
    return `<label><span>Equipo real</span><select data-k="uid"><option value="">Sin vincular</option>${EQ.lista.filter(d => !usados.has(d.uid) || d.uid === q.uid).map(d => `<option value="${esc(d.uid)}" ${d.uid === q.uid ? 'selected' : ''}>${esc(d.nombre)}${d.ip ? ' · ' + esc(d.ip) : ''}</option>`).join('')}</select></label>`; }
  $('#minfo').addEventListener('input', e => { if (CON.entrada(e.target)) return; const el = e.target.closest('[data-k]'); if (!el || !SEL) return; let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : +el.value) : el.value; if (el.dataset.ang) v = (+el.value || 0) * Math.PI / 180;
    if (el.dataset.k === 'uid') { const d = EQ.porUid.get(v); if (d) Object.assign(SEL, { nombre: d.nombre, modelo: d.modelo || SEL.modelo, ip: d.ip || SEL.ip, mac: d.mac || SEL.mac }); }
    if (v === null || v === '') delete SEL[el.dataset.k]; else SEL[el.dataset.k] = v; rehacer(SEL); cambio(true, el.type === 'text' || el.tagName === 'TEXTAREA'); if (el.dataset.k === 'uid' || el.tagName === 'SELECT') info(); });
  $('#minfo').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.sel === 'no') { CON.sub = null; elegir(null); return; } if (b.dataset.c) { CON.accion(b); return; } if (b.dataset.sin) { delete SEL[b.dataset.sin]; SEL[b.dataset.sin] = ''; rehacer(SEL); cambio(); info(); return; }
    const a = b.dataset.acc;
    if (a === 'mas') { UI.abierta = !UI.abierta; try { localStorage.setItem('motor.ficha', UI.abierta ? '1' : '0'); } catch (er) {} $('#minfo').classList.toggle('abierta', UI.abierta); b.setAttribute('aria-expanded', UI.abierta); return; }
    if (a === 'alta') { const T = TIPOS[SEL.t], p = SEL; if (!p.nombre) { toast('Ponele un nombre primero'); return; } b.disabled = true;
      try { const r = await host.crearEquipo({ marca: p.marca || 'otra', tipo: T.ondi || 'otro', nombre: p.nombre, modelo: p.modelo || null, ip: p.ip || null, ubicacion: lugarDe(p), notas: p.notas || null });
        p.uid = 'man:' + r.id; await leerEquipos(true); rehacer(p); cambio(); info(); toast('Equipo sumado a la lista del cliente'); } catch (er) { b.disabled = false; toast('No se pudo: ' + ((er && er.message) || er)); } return; }
    if (a === 'enfocar') elegir(SEL, true); if (a === 'duplicar') duplicar(); if (a === 'borrar') sacar(SEL); if (a === 'girar') girarSel(Math.PI / 2); if (a === 'doc') host.abrirDoc(SEL); });

  // ---------- capas, buscar, vista, pantalla completa ----------
  $('#bcapas').onclick = () => { $('#mcapas').hidden = !$('#mcapas').hidden; };
  $('#mcapas').addEventListener('change', e => { const k = e.target.dataset.capa; capas[k] = e.target.checked; for (const g of objs.values()) aplicarCapas(g); motor.dirty = true; });
  $('#mcapas').addEventListener('click', e => { const b = e.target.closest('[data-pared]'); if (b) paredes(b.dataset.pared); });
  $('#bvista').onclick = () => motor.vista();
  let antes = null; $('#bplano').onclick = () => { const b = $('#bplano'), on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); if (on) { antes = { pitch: motor.C.pitch, yaw: motor.C.yaw }; motor.ir({ pitch: 1.45, yaw: Math.round(motor.C.yaw / (Math.PI / 2)) * Math.PI / 2 }, 0.6); } else motor.ir(antes || { pitch: 0.7 }, 0.6); };
  $('#bfull').onclick = () => pantalla(!(document.fullscreenElement || document.documentElement.classList.contains('mfull')));
  function pantalla(on) { if (host && host.juego) { host.juego(on); document.documentElement.classList.toggle('mfull', on); return; } const d = document.documentElement;
    if (on && d.requestFullscreen) d.requestFullscreen().catch(() => d.classList.add('mfull')); else if (!on && document.fullscreenElement) document.exitFullscreen(); else d.classList.toggle('mfull', on); }
  const q = $('#mq'), res = $('#mres');
  q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); if (!t) { res.hidden = true; return; }
    const hits = E.piezas.map(p => { const d = p.uid && EQ.porUid.get(p.uid), T = TIPOS[p.t]; return { p, txt: [p.nombre, T && T.n, p.ip, d && d.ip, d && d.modelo, p.modelo].filter(Boolean).join(' ') }; }).filter(x => x.p.nombre && veo(x.p) && x.txt.toLowerCase().includes(t)).slice(0, 8);
    res.innerHTML = hits.length ? hits.map((x, i) => `<button data-i="${i}"><b>${esc(x.p.nombre)}</b><small>${esc(TIPOS[x.p.t].n)}${x.p.ip ? ' · ' + esc(x.p.ip) : ''}</small></button>`).join('') : '<p>Sin resultados</p>'; res.hidden = false; res._h = hits; });
  res.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; elegir(res._h[+b.dataset.i].p, true); res.hidden = true; q.value = ''; q.blur(); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && res._h && res._h[0]) { elegir(res._h[0].p, true); res.hidden = true; q.value = ''; q.blur(); } if (e.key === 'Escape') { res.hidden = true; q.blur(); } });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.mbus')) res.hidden = true; if (!e.target.closest('#mcapas, #bcapas')) $('#mcapas').hidden = true; if (!e.target.closest('#mmenu, #bpap')) menu(null); });

  // ---------- editor (comandos de Los Sims 4) ----------
  const ED = { on: false, h: 'mano', grilla: true, colocar: null, linea: null, drag: null };
  const grilla = new THREE.GridHelper(2000, 400, 0x5a6b78, 0x5a6b78); grilla.material.transparent = true; grilla.material.opacity = 0.16; grilla.position.y = 0.06; grilla.visible = false; motor.scene.add(grilla);
  // lo que se guarda y se deshace nunca lleva lo que todavía se está ubicando (piezas y aberturas marcadas con _p)
  const limpio = () => JSON.stringify(E.piezas.filter(p => !p._p), (k, v) => k === '_col' ? undefined : k === 'huecos' && Array.isArray(v) ? v.filter(h => !h._p) : v);
  const undo = [], redo = []; let foto = limpio();
  function cambio(guardarYa = true, escribiendo) { const ahora = limpio(); if (ahora === foto) return; if (!escribiendo || !undo.length || undo[undo.length - 1].t < Date.now() - 1500) undo.push({ s: foto, t: Date.now() }); if (undo.length > 80) undo.shift(); redo.length = 0; foto = ahora; if (guardarYa) guardar(); }
  function volver(de, a) { if (!de.length) { toast(de === undo ? 'No hay nada para deshacer' : 'No hay nada para rehacer'); return; } CON.cancelar(); cancelar(true); a.push({ s: foto, t: 0 }); foto = de.pop().s; E.piezas = JSON.parse(foto); SEL = SEL && E.piezas.find(p => p.id === SEL.id) || null; armarTodo(); CON.alElegir(SEL); marcar(); info(); guardar(); }
  function editar(on) { if (!puede) return; if (on && RC.R.on) RC.paseo(false); ED.on = on; motor.editando = on; document.documentElement.classList.toggle('editando', on); $('#mtool').hidden = !on; $('#bedit').setAttribute('aria-pressed', on); $('#bedit').querySelector('span').textContent = on ? 'Listo' : 'Editar';
    grilla.visible = on && ED.grilla; if (!on) { CON.cancelar(); cancelar(true); $('#mcat').hidden = true; $('#meq').hidden = true; menu(null); hint(''); } else herramienta('mano'); CON.marcar(); marcar(); info(); motor.dirty = true; }
  if (puede) $('#bedit').onclick = () => editar(!ED.on);
  const PISTA = { mano: '<b>Mano</b>: tocá algo para elegirlo y arrastralo para moverlo. Clic derecho abre su menú', maza: '<b>Maza</b>: tocá lo que quieras sacar', gotero: '<b>Gotero</b>: tocá algo para copiarlo y ubicar la copia' };
  function herramienta(h) { CON.cancelar(); cancelar(true); if (h === 'pared' || h === 'recinto') { CON.empezar(h); return; } if (h === 'puerta' || h === 'ventana') { CON.empezar('abertura', h); return; } if (h === 'catalogo') { catalogo($('#mcat').hidden); return; } ED.h = h; herrVis(null); }
  // qué botón queda marcado en la barra: la herramienta de construcción en curso o, si no hay, la mano, la maza o el gotero
  function herrVis(h) { const v = h || ED.h; canvas.dataset.h = v; document.querySelectorAll('#mtool [data-h]').forEach(b => b.setAttribute('aria-pressed', b.dataset.h === v)); if (!h && ED.on && !ED.colocar && !ED.linea) hint(PISTA[ED.h]); puntos(); }
  $('#mtool').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.h) herramienta(b.dataset.h); if (b.id === 'beq') panelEquipos($('#meq').hidden); if (b.id === 'bundo') volver(undo, redo); if (b.id === 'bredo') volver(redo, undo); if (b.id === 'bpap') papelera(b);
    if (b.id === 'bpared') paredes({ alta: 'corte', corte: 'baja', baja: 'alta' }[ctx.paredes]);
    if (b.id === 'bgrid') { ED.grilla = !ED.grilla; b.setAttribute('aria-pressed', ED.grilla); grilla.visible = ED.on && ED.grilla; motor.dirty = true; } });
  document.addEventListener('click', e => { const b = e.target.closest('[data-cerrar]'); if (b) $('#' + b.dataset.cerrar).hidden = true; });
  const pegar = (v, alt) => alt ? Math.round(v * 100) / 100 : Math.round(v * 2) / 2;
  let nid = 1; const nuevoId = t => { let id; do id = t.slice(0, 3) + (nid++).toString(36); while (E.piezas.some(p => p.id === id)); return id; };
  // vistas de pared, como en Los Sims: altas, cortadas (se ve adentro) o al ras del piso
  function paredes(v) { ctx.paredes = v; document.querySelectorAll('[data-pared]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pared === v)); for (const p of E.piezas) if (CON.esMuro(p) && objs.has(p.id)) rehacer(p); CON.marcar(); toast({ alta: 'Paredes altas', corte: 'Paredes cortadas', baja: 'Paredes al ras' }[v]); }

  // catálogo: cada tipo de pieza (y sus variantes: cámara domo, rack de pared…) con su dibujo, lo más usado arriba, y las aberturas, que van sobre una pared
  const USO = (() => { try { return JSON.parse(localStorage.getItem('motor.usados')) || {}; } catch (e) { return {}; } })(); let CATO = new Map();
  const usar = k => { USO[k] = (USO[k] || 0) + 1; try { localStorage.setItem('motor.usados', JSON.stringify(USO)); } catch (e) {} };
  function ofertas() { const out = []; for (const [k, T] of Object.entries(TIPOS)) { if ((SIN[app] || []).includes(T.g)) continue; if (T.variantes) T.variantes.forEach((v, i) => out.push({ key: k + ':' + i, t: k, n: v.n, g: T.g, o: v.o, T })); else out.push({ key: k, t: k, n: T.n, g: T.g, o: {}, T }); }
    for (const [k, a] of Object.entries(ABERTURAS)) out.push({ key: 'ab:' + k, ab: k, n: a.n, g: 'Puertas y ventanas' }); return out; }
  function catalogo(abrir = true) { const box = $('#mcat'); box.hidden = !abrir; if (!abrir) return; $('#meq').hidden = true; const t = ($('#mcq').value || '').toLowerCase(), O = ofertas(), va = o => !t || (o.n + ' ' + o.g).toLowerCase().includes(t);
    const tarjeta = o => `<button data-of="${o.key}"><span class="mmini" data-mini="${o.key}">${o.ab ? svg({ doble: 'puerta', vidrio: 'puerta' }[o.ab] || o.ab, 30) : o.t === 'persona' ? svg('caminar', 30) : o.t === 'vehiculo' ? svg('auto', 30) : ''}</span><span>${esc(o.n)}</span></button>`;
    const usados = t ? [] : O.filter(o => USO[o.key]).sort((a, b) => USO[b.key] - USO[a.key]).slice(0, 6);
    $('#mcl').innerHTML = ((usados.length ? `<h4>Más usados</h4><div class="mgrid">${usados.map(tarjeta).join('')}</div>` : '') + ORDEN.map(g => { const its = O.filter(o => o.g === g && va(o)); return its.length ? `<h4>${g}</h4><div class="mgrid">${its.map(tarjeta).join('')}</div>` : ''; }).join('')) || '<p class="mvacio">Nada con ese nombre.</p>';
    CATO = new Map(O.map(o => [o.key, o])); minis(); if (!motor.tactil) $('#mcq').focus(); }
  $('#mcq').addEventListener('input', () => catalogo());
  $('#mcl').addEventListener('click', e => { const b = e.target.closest('[data-of]'), o = b && CATO.get(b.dataset.of); if (!o) return; usar(o.key); $('#mcat').hidden = true; if (o.ab) CON.empezar('abertura', o.ab); else empezar({ t: o.t, ...o.o }); });
  // el dibujo de cada cosa: se arma la pieza de verdad, sola, y se le saca una foto chica (de a pocas por cuadro, para no trabar)
  const MINI = new Map(); let miniT = null, miniCola = [], rt = null, escM = null, camM = null;
  function minis() { miniCola = [...document.querySelectorAll('#mcl [data-mini]')].filter(el => !el.firstChild); if (!miniT && miniCola.length) miniT = requestAnimationFrame(miniPaso); }
  function miniPaso() { miniT = null; let n = 0; while (miniCola.length && n < 3) { const el = miniCola.shift(), o = el.isConnected && CATO.get(el.dataset.mini); if (!o || o.ab) continue; const k = o.key + motor.tema; if (!MINI.has(k)) { let u = ''; try { u = fotoPieza(o); } catch (er) {} MINI.set(k, u); n++; } const u = MINI.get(k); if (u) el.innerHTML = `<img src="${u}" alt="" draggable="false">`; }
    if (miniCola.length) miniT = requestAnimationFrame(miniPaso); else motor.dirty = true; }
  function fotoPieza(o) { const W = 336, H = 252, T = o.T, p = { ...T.def, ...o.o, id: 'mini', t: o.t, nombre: '' };
    if (T.forma === 'punto') { p.x = 0; p.z = 0; p.r = T.equipo ? 0.5 : -0.5; if (T.equipo) { p.alcance = 0; if (p.montaje !== 'techo') p.y = Math.min(p.y ?? 2, 2.2); } } else p.pts = T.forma === 'area' ? [[-4, -3], [4, -3], [4, 3], [-4, 3]] : [[-5, 0], [5, 0]];
    const g = armarPieza(p, { estado: () => 'ok', paredes: 'alta' }); if (!g) return '';
    if (!rt) { rt = new THREE.WebGLRenderTarget(W, H); escM = new THREE.Scene(); escM.add(new THREE.HemisphereLight(0xffffff, 0x7a828a, 0.85)); const l = new THREE.DirectionalLight(0xffffff, 1.25); l.position.set(-3, 6, 4); escM.add(l); camM = new THREE.PerspectiveCamera(28, W / H, 0.05, 2000); }
    escM.environment = motor.scene.environment; escM.add(g); const b = cajaDe(g, new THREE.Box3()); if (b.isEmpty()) { escM.remove(g); return ''; }
    const c = b.getCenter(new THREE.Vector3()), dist = Math.max(0.15, b.getSize(new THREE.Vector3()).length() / 2) / Math.sin(14 * Math.PI / 180) * 1.04;
    camM.position.set(c.x + dist * 0.55, c.y + dist * 0.42, c.z + dist * 0.72); camM.lookAt(c); camM.near = dist / 60; camM.far = dist * 4; camM.updateProjectionMatrix();
    const R = motor.renderer, antes = R.getRenderTarget(), col = R.getClearColor(new THREE.Color()), al = R.getClearAlpha(), px = new Uint8Array(W * H * 4);
    R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(escM, camM); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(antes); R.setClearColor(col, al); escM.remove(g); limpiar(g);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), im = x.createImageData(W, H), fila = W * 4;
    for (let y = 0; y < H; y++) { const de = (H - 1 - y) * fila, a = y * fila; for (let i = 0; i < fila; i += 4) { im.data[a + i] = GAMMA[px[de + i]]; im.data[a + i + 1] = GAMMA[px[de + i + 1]]; im.data[a + i + 2] = GAMMA[px[de + i + 2]]; im.data[a + i + 3] = px[de + i + 3]; } }
    x.putImageData(im, 0, 0); return cv.toDataURL('image/png'); }
  function empezar(tpl) { CON.cancelar(); cancelar(true); const T = TIPOS[tpl.t]; if (T.herramienta) { CON.empezar(T.herramienta); return; }
    if (T.forma === 'punto') { ED.colocar = { tpl, p: null }; hint(`<b>${esc(T.n)}</b>: tocá dónde va. ${T.equipo ? 'Apuntá a una pared, un techo o una columna y se pega ahí. ' : ''}<kbd>R</kbd> gira · <kbd>Shift</kbd> pone varios · <kbd>Alt</kbd> sin imán · <kbd>Esc</kbd> cancela`); }
    else { ED.linea = { tpl, pts: [], p: null }; hint(`<b>${esc(T.n)}</b>: tocá cada ${T.forma === 'area' ? 'esquina' : 'punto'}. Doble clic o <kbd>Enter</kbd> termina · <kbd>Retroceso</kbd> borra el último · <kbd>Esc</kbd> cancela`); } herrVis('ubicar'); }
  function cancelar(todo) { if (ED.colocar && ED.colocar.p) quitar(ED.colocar.p, true); if (ED.linea && ED.linea.p) quitar(ED.linea.p, true); const habia = ED.colocar || ED.linea; ED.colocar = ED.linea = null; if (ED.on && !todo && habia) herrVis(null); }
  function quitar(p, sinFoto) { E.piezas = E.piezas.filter(x => x !== p); const g = objs.get(p.id); if (g) { mundo.remove(g); limpiar(g); objs.delete(p.id); } if (SEL === p) { SEL = null; CON.alElegir(null); marcar(); info(); } etiquetas(); motor.dirty = true; if (!sinFoto) cambio(); }
  // sacar: los racks y gabinetes (protegidos) piden la clave de borrado de la empresa; sin anfitrión, hay que mantener apretado. Lo sacado va a la papelera.
  async function sacar(p) { if (!p) return; const T = TIPOS[p.t], nom = p.nombre ? ` «${p.nombre}»` : '';
    if (T.protegido) { const ok = host && host.clave ? await host.clave({ titulo: `Sacar ${T.n.toLowerCase()}${nom}`, detalle: 'Se saca de la maqueta. Hace falta la clave de borrado de la empresa.' }) : await confirma(`¿Sacar ${T.n.toLowerCase()}${nom}?`, 'Para que no se borre por error, mantené apretado el botón.'); if (!ok || !E.piezas.includes(p)) return; }
    if (T.protegido || T.equipo || ['recinto', 'edificio', 'galpon'].includes(p.t)) E.papelera = [{ p: JSON.parse(JSON.stringify(p)), cuando: Date.now(), quien: (host && host.installer) || '' }, ...(E.papelera || [])].slice(0, 40);
    quitar(p); toast(`${T.n} sacado · Ctrl+Z para volver`); }
  function confirma(titulo, detalle) { return new Promise(listo => { const box = $('#mconf'); box.innerHTML = `<div class="vidrio mdialog" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><b>${esc(titulo)}</b><p>${esc(detalle)}</p><div class="macts"><button class="mbtn" data-no>Cancelar</button><button class="mbtn mapretar" data-si><i></i><span>${svg('borrar', 16)}Mantener apretado</span></button></div></div>`; box.hidden = false;
      const si = box.querySelector('[data-si]'); let t = null; const tecla = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); fin(false); } }, fin = v => { clearTimeout(t); box.hidden = true; box.innerHTML = ''; removeEventListener('keydown', tecla, true); listo(v); };
      const va = () => { si.classList.add('va'); clearTimeout(t); t = setTimeout(() => fin(true), 1100); }, corta = () => { si.classList.remove('va'); clearTimeout(t); };
      si.addEventListener('pointerdown', va); for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur']) si.addEventListener(ev, corta); si.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) va(); });
      box.querySelector('[data-no]').onclick = () => fin(false); box.onclick = e => { if (e.target === box) fin(false); }; addEventListener('keydown', tecla, true); box.querySelector('[data-no]').focus(); }); }
  // papelera: lo sacado en los últimos 30 días se puede recuperar aunque se haya cerrado la maqueta
  function papelera(b) { const hoy = Date.now(); E.papelera = (E.papelera || []).filter(it => hoy - it.cuando < 30 * 864e5 && !E.piezas.some(q => q.id === it.p.id)); const r = b.getBoundingClientRect();
    if (!E.papelera.length) { toast('La papelera está vacía'); return; } const hace = t => { const d = Math.floor((hoy - t) / 864e5); return d ? `hace ${d} día${d > 1 ? 's' : ''}` : 'hoy'; };
    menu(E.papelera.map(it => ({ n: `${esc(it.p.nombre || TIPOS[it.p.t].n)} <small>${TIPOS[it.p.t].n} · ${hace(it.cuando)}</small>`, ic: 'restaurar', f: () => { E.papelera = E.papelera.filter(x => x !== it); if (!TIPOS[it.p.t]) return; E.piezas.push(it.p); rehacer(it.p); elegir(it.p, true); cambio(); toast('Recuperado'); } })), r.left, r.top - 8, true); }
  function duplicar() { if (!SEL) return; const c = JSON.parse(JSON.stringify(SEL)); c.id = nuevoId(c.t); delete c.uid; delete c.doc; if (c.pts) c.pts = c.pts.map(q => [q[0] + 4, q[1] + 4]); else { c.x = (c.x || 0) + 4; c.z = (c.z || 0) + 4; } E.piezas.push(c); rehacer(c); elegir(c); cambio(); }
  let copia = null; function pegarCopia() { if (!copia) return; const c = JSON.parse(copia); delete c.id; delete c.uid; delete c.doc; if (c.pts) { c.id = nuevoId(c.t); c.pts = c.pts.map(q => [q[0] + 4, q[1] + 4]); E.piezas.push(c); rehacer(c); elegir(c); cambio(); } else empezar(c); }
  function girarSel(giro) { const p = ED.colocar ? ED.colocar.p || (ED.colocar.tpl.r = (ED.colocar.tpl.r || 0) + giro, null) : SEL; if (!p) return;
    if (p.pts) { if (ED.colocar || ED.linea) return; CON.girar(p, giro); CON.marcar(); marcar(); cambio(); return; }
    const antes = p.r || 0; p.r = Math.round((antes + giro) / (Math.PI / 4)) * Math.PI / 4; const g = objs.get(p.id); if (g) g.rotation.y = p.r; if (ED.colocar) ED.colocar.tpl.r = p.r; else { rotarCon(p, p.r - antes); marcar(); cambio(); info(); } motor.dirty = true; }
  // al girar un edificio o un galpón, los equipos que tiene puestos giran con él
  function rotarCon(p, dg, lista) { if (!dg) return; const c = Math.cos(dg), s = Math.sin(dg); for (const q of lista || CON.contenido(p)) { const dx = (q.x || 0) - (p.x || 0), dz = (q.z || 0) - (p.z || 0); q.x = Math.round(((p.x || 0) + dx * c + dz * s) * 100) / 100; q.z = Math.round(((p.z || 0) - dx * s + dz * c) * 100) / 100; q.r = (q.r || 0) + dg; rehacer(q); } }
  // importar piezas de un archivo .json (una escena entera, una lista de piezas o una sola): caen juntas donde se está mirando y con identificadores nuevos si hacen falta
  function importar(txt) { let j; try { j = JSON.parse(txt); } catch (e) { toast('Ese archivo no es un .json válido'); return; } const L = (Array.isArray(j) ? j : (j.escena && j.escena.piezas) || j.piezas || (j.t ? [j] : [])).filter(q => q && TIPOS[q.t]); if (!L.length) { toast('No encontré piezas en ese archivo'); return; }
    const C2 = L.filter(q => q.t !== 'terreno').map(centro), n = Math.max(1, C2.length), cx = C2.reduce((a, q) => a + q[0], 0) / n, cz = C2.reduce((a, q) => a + q[1], 0) / n, dx = Math.round(motor.C.tx - cx), dz = Math.round(motor.C.tz - cz); let n2 = 0, grande = null;
    for (const q0 of L) { if (q0.t === 'terreno' && L.length > 1) continue; const q = JSON.parse(JSON.stringify(q0)); delete q._p; if (!q.id || E.piezas.some(z => z.id === q.id)) q.id = nuevoId(q.t); if (q.pts) q.pts = q.pts.map(k => [k[0] + dx, k[1] + dz]); else { q.x = (q.x || 0) + dx; q.z = (q.z || 0) + dz; }
      E.piezas.push(q); rehacer(q); n2++; if (['edificio', 'galpon', 'recinto'].includes(q.t) && !grande) grande = q; }
    cambio(); if (grande) elegir(grande); toast(`${n2} pieza${n2 > 1 ? 's' : ''} importada${n2 > 1 ? 's' : ''}${grande ? ': mové o girá el edificio y sus equipos van con él' : ''}`); }
  const lee = f => { if (!f) return; if (!/\.json$/i.test(f.name)) { toast('Tiene que ser un archivo .json'); return; } const r = new FileReader(); r.onload = () => importar(String(r.result)); r.readAsText(f); };
  canvas.addEventListener('dragover', e => { if (ED.on) e.preventDefault(); }); canvas.addEventListener('drop', e => { if (!ED.on) return; e.preventDefault(); lee(e.dataTransfer.files[0]); });
  $('#mimp').addEventListener('change', e => { lee(e.target.files[0]); e.target.value = ''; $('#mcat').hidden = true; });
  // menú del botón derecho
  function menu(items, x, y, arriba) { const m = $('#mmenu'); if (!items || !items.length) { m.hidden = true; return; }
    m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.peligro ? 'peligro' : ''}">${svg(it.ic, 16)}<span>${it.n}</span>${it.k ? `<kbd>${it.k}</kbd>` : ''}</button>`).join(''); m._it = items; m.hidden = false;
    const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px'; m.style.top = Math.max(8, Math.min(innerHeight - h - 8, arriba ? y - h : y)) + 'px'; }
  $('#mmenu').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const it = $('#mmenu')._it[+b.dataset.i]; menu(null); it.f(); });
  motor.alMenu = e => { if (RC.R.on || ED.colocar || ED.linea || CON.T.h) return; const h = hallar(e), p = motor.enPiso(e.clientX, e.clientY), T = h && TIPOS[h.p.t], its = [];
    if (h) { elegir(h.p); its.push({ n: 'Enfocar', ic: 'enfocar', f: () => elegir(h.p, true) }); if (T.protegido && host && host.abrirDoc) its.push({ n: 'Abrir documentación', ic: 'doc', f: () => host.abrirDoc(h.p) });
      if (ED.on) its.push({ n: 'Propiedades', ic: 'ajustes', f: () => { UI.abierta = true; info(); } }, { n: 'Duplicar', ic: 'duplicar', k: 'Ctrl D', f: duplicar }, { n: 'Girar 90°', ic: 'girar', k: 'R', f: () => girarSel(Math.PI / 2) }, '-', { n: 'Sacar', ic: T.protegido ? 'candado' : 'borrar', k: 'Supr', peligro: true, f: () => sacar(h.p) }); }
    else if (ED.on) { its.push({ n: 'Catálogo', ic: 'catalogo', k: 'Tab', f: () => catalogo(true) }); if (copia) its.push({ n: 'Pegar', ic: 'duplicar', k: 'Ctrl V', f: pegarCopia }); }
    if (p) its.push(...(its.length ? ['-'] : []), { n: 'Recorrer desde acá', ic: 'caminar', f: () => { if (ED.on) editar(false); RC.paseo(true, [p.x, p.z]); } });
    if (!h) its.push({ n: 'Vista general', ic: 'vista', f: () => motor.vista() }); menu(its, e.clientX, e.clientY); };

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

  // manijas: en líneas y áreas, cada punto se arrastra (el del medio agrega uno, doble clic lo saca); en lo demás, una para girar y, si tiene altura, otra para subirlo o bajarlo
  const manijas = new THREE.Group(); motor.scene.add(manijas); const MAN = new THREE.SphereGeometry(1, 14, 10), MANm = new THREE.MeshBasicMaterial({ color: 0x1d9bf0, depthTest: false }), MEDm = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.85 }), ALTm = new THREE.MeshBasicMaterial({ color: 0xffb020, depthTest: false }), LINm = new THREE.LineBasicMaterial({ color: 0x1d9bf0, depthTest: false, transparent: true, opacity: 0.7 });
  function puntos() { manijas.clear(); if (!ED.on || !SEL || CON.T.h || ED.colocar || ED.linea || ED.h !== 'mano' || !objs.has(SEL.id)) return; const s = Math.max(0.12, motor.C.d * 0.006), pon = (x, y, z, m, ud, k = 1) => { const q = new THREE.Mesh(MAN, m); q.scale.setScalar(s * k); q.userData = { ...ud, k }; q.position.set(x, y, z); q.renderOrder = 9; manijas.add(q); return q; };
    if (SEL.pts) { const P = SEL.pts, cerr = TIPOS[SEL.t].forma === 'area' || SEL.cerrado; P.forEach((q, i) => pon(q[0], 0.5, q[1], MANm, { vertice: i })); for (let i = 0; i < P.length - (cerr ? 0 : 1); i++) { const a = P[i], b = P[(i + 1) % P.length]; pon((a[0] + b[0]) / 2, 0.5, (a[1] + b[1]) / 2, MEDm, { medio: i + 1 }, 0.65); } return; }
    const T = TIPOS[SEL.t], x = SEL.x || 0, z = SEL.z || 0, r = SEL.r || 0, b = cajaDe(objs.get(SEL.id), new THREE.Box3()), rad = Math.min(40, Math.max(0.9, Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + Math.max(0.5, s * 3)));
    if (T.campos.some(c => c.k === 'r')) { pon(x + Math.sin(r) * rad, 0.3, z + Math.cos(r) * rad, MANm, { giro: 1 }); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.3, z), new THREE.Vector3(x + Math.sin(r) * rad, 0.3, z + Math.cos(r) * rad)]), LINm); l.renderOrder = 9; manijas.add(l); }
    if (T.campos.some(c => c.k === 'y')) pon(x, (SEL.y ?? T.def.y ?? 0) + Math.max(0.7, s * 3.5), z, ALTm, { altura: 1 }); }
  motor.cada.push(() => { const m = manijas.children.find(q => q.isMesh); if (!m) return false; const s = Math.max(0.12, motor.C.d * 0.006); if (Math.abs(m.scale.x / m.userData.k - s) > s * 0.1) { manijas.children.forEach(q => q.isMesh && q.scale.setScalar(s * q.userData.k)); return true; } return false; });

  // dónde cae un equipo que se está ubicando: en la pared que se apunta (a esa altura y mirando hacia afuera), colgado de un techo, arriba de algo, en una columna de luz cercana o en el piso
  function apoyar(C, e, p) { const P = C.p, T = TIPOS[P.t]; let s = null;
    if (T.equipo && !e.altKey) { const yo = objs.get(P.id), hit = motor.tocar(e.clientX, e.clientY, [...objs.values()].filter(g => g.visible && g !== yo && !TIPOS[g.userData.pieza.t].equipo)).find(h => h.face && !h.object.userData.campo);
      if (hit && hit.point.y > 0.4) { const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld), y = Math.round(hit.point.y * 10) / 10;
        if (Math.abs(n.y) < 0.5) s = { k: 'pared', x: hit.point.x + n.x * 0.02, z: hit.point.z + n.z * 0.02, y, r: Math.atan2(n.x, n.z), montaje: 'pared' };
        else if (n.y < 0) s = { k: 'techo', x: hit.point.x, z: hit.point.z, y, montaje: 'techo' };
        else s = { k: 'sobre', x: hit.point.x, z: hit.point.z, piso: y, y: y + ((T.def.y ?? 0) > 2 ? 1.2 : 0.02) }; }
      if (!s) { const col = E.piezas.find(q => q.t === 'columna' && Math.hypot((q.x || 0) - p.x, (q.z || 0) - p.z) < 3); if (col) s = { k: 'col', x: col.x, z: (col.z || 0) + 0.5, y: C.tpl.y ?? Math.max(3, (col.alto || 25) - (P.t === 'camara' ? 4 : 6)) }; } }
    for (const k of ['y', 'montaje', 'piso']) { if (s && s[k] != null) P[k] = s[k]; else if (C.tpl[k] == null) delete P[k]; else P[k] = C.tpl[k]; }
    if (s) { P.x = Math.round(s.x * 100) / 100; P.z = Math.round(s.z * 100) / 100; if (s.r != null) P.r = s.r; } else { P.x = pegar(p.x, e.altKey); P.z = pegar(p.z, e.altKey); if (P._col === 'pared') P.r = C.tpl.r || 0; }
    const firma = s ? s.k + (s.y ?? '') : ''; if (firma !== (P._col || '')) { P._col = firma; rehacer(P); }
    const g = objs.get(P.id); if (g) { g.position.set(P.x, s ? 0 : 0.25, P.z); g.rotation.y = P.r || 0; } motor.dirty = true; }

  // mouse: lo que el editor agarra no mueve la cámara
  motor.agarrar = e => { if (!ED.on) return false; const p0 = motor.enPiso(e.clientX, e.clientY); if (!p0) return false; menu(null);
    if (ED.colocar || ED.linea) return true; if (CON.T.h) return CON.agarrar(e, p0, null);
    const mh = SEL && ED.h === 'mano' && motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh))[0];
    if (mh) { const ud = mh.object.userData; if (ud.giro) ED.drag = { giro: true }; else if (ud.altura) { const n = new THREE.Vector3(Math.sin(motor.C.yaw), 0, Math.cos(motor.C.yaw)); ED.drag = { altura: new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(SEL.x || 0, 0, SEL.z || 0)) }; }
      else if (ud.medio != null) { SEL.pts.splice(ud.medio, 0, [pegar(p0.x, e.altKey), pegar(p0.z, e.altKey)]); CON.insertado(SEL, ud.medio); ED.drag = { v: ud.medio }; rehacer(SEL); } else ED.drag = { v: ud.vertice }; return true; }
    const h = hallar(e); if (CON.agarrar(e, p0, h)) return true; if (!h) { if (ED.h === 'mano') elegir(null); return false; }
    if (ED.h === 'maza') { sacar(h.p); return true; } if (ED.h === 'gotero') { const c = JSON.parse(JSON.stringify(h.p)); delete c.id; delete c.uid; delete c.doc; delete c.pts; delete c.huecos; delete c.lados; empezar(c); return true; }
    elegir(h.p); ED.drag = { p: h.p, x0: p0.x, z0: p0.z, orig: h.p.pts ? h.p.pts.map(q => [...q]) : [h.p.x || 0, h.p.z || 0], movido: false, con: e.altKey ? [] : CON.contenido(h.p).map(q => ({ q, o: q.pts ? q.pts.map(k => [...k]) : [q.x || 0, q.z || 0] })) }; return true; };
  motor.mover = e => { if (CON.mover(e)) return; const D = ED.drag; if (!D) return;
    if (D.altura) { const v = motor.rayo(e.clientX, e.clientY).ray.intersectPlane(D.altura, new THREE.Vector3()); if (v) { const y = Math.max(0, Math.min(60, Math.round(v.y * (e.altKey ? 100 : 10)) / (e.altKey ? 100 : 10))); if (y !== SEL.y) { SEL.y = y; D.movido = true; rehacer(SEL); } } return; }
    const p = motor.enPiso(e.clientX, e.clientY); if (!p) return;
    if (D.giro) { const paso = e.altKey ? Math.PI / 180 : Math.PI / 12, r = Math.round(Math.atan2(p.x - (SEL.x || 0), p.z - (SEL.z || 0)) / paso) * paso; if (r !== (SEL.r || 0)) { D.con = D.con || CON.contenido(SEL); rotarCon(SEL, r - (SEL.r || 0), D.con); SEL.r = r; D.movido = true; const g = objs.get(SEL.id); if (g) g.rotation.y = r; marcar(); } return; }
    if (D.v != null) { SEL.pts[D.v] = [pegar(p.x, e.altKey), pegar(p.z, e.altKey)]; rehacer(SEL); CON.marcar(); return; }
    const dx = p.x - D.x0, dz = p.z - D.z0; if (!D.movido && Math.hypot(dx, dz) < motor.C.d * 0.004) return; D.movido = true; canvas.classList.add('lleva'); manijas.visible = false;
    // las líneas, áreas y recintos se corren enteros (el salto se pega a la grilla, la forma no se toca) y un recinto se lleva lo que tiene adentro
    let mx = pegar(dx, e.altKey), mz = pegar(dz, e.altKey);
    if (D.p.pts) { D.p.pts = D.orig.map(q => [Math.round((q[0] + mx) * 1000) / 1000, Math.round((q[1] + mz) * 1000) / 1000]); rehacer(D.p); }
    else { D.p.x = pegar(D.orig[0] + dx, e.altKey); D.p.z = pegar(D.orig[1] + dz, e.altKey); mx = D.p.x - D.orig[0]; mz = D.p.z - D.orig[1]; const g = objs.get(D.p.id); g.position.set(D.p.x, 0.25, D.p.z); cajaDe(g, caja.box).expandByScalar(0.15); motor.dirty = true; }
    for (const { q, o } of D.con) { if (q.pts) { q.pts = o.map(k => [k[0] + mx, k[1] + mz]); rehacer(q); } else { q.x = o[0] + mx; q.z = o[1] + mz; const g = objs.get(q.id); if (g) g.position.set(q.x, 0, q.z); } } };
  motor.soltar = (e, gesto) => { canvas.classList.remove('lleva'); manijas.visible = true; if (!gesto && CON.soltar(e)) return; const D = ED.drag; ED.drag = null; if (gesto || !D) return; if (D.p && !D.p.pts) { const g = objs.get(D.p.id); if (g) g.position.y = 0; }
    if (D.movido || D.v != null) { cambio(); marcar(); if (D.giro || D.altura) info(); } else if (D.p) info(); motor.dirty = true; };
  motor.pasar = e => { if (ED.on && CON.pasar(e)) return; const p = motor.enPiso(e.clientX, e.clientY);
    if (ED.colocar && p) { const C = ED.colocar; if (!C.p) { C.p = { ...JSON.parse(JSON.stringify(C.tpl)), id: nuevoId(C.tpl.t), x: 0, z: 0, r: C.tpl.r || 0, _p: 1 }; E.piezas.push(C.p); rehacer(C.p); } apoyar(C, e, p); return; }
    if (ED.linea && p && ED.linea.p) { const L = ED.linea; L.p.pts = [...L.pts, [pegar(p.x, e.altKey), pegar(p.z, e.altKey)]]; if (L.p.pts.length >= 2) rehacer(L.p); return; }
    if (e.pointerType !== 'mouse') return; const h = hallar(e), g = h && objs.get(h.p.id);
    if (!ED.on) { cajaH.visible = !!g && h.p !== SEL && TIPOS[h.p.t].forma === 'punto'; if (cajaH.visible) cajaDe(g, cajaH.box).expandByScalar(0.1); canvas.classList.toggle('sobre', !!h && TIPOS[h.p.t].forma === 'punto'); motor.dirty = true; }
    else { cajaH.visible = false; canvas.classList.toggle('sobre', !!h || !!(SEL && motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh))[0])); } };
  let ultimoToque = 0;
  motor.alTocar = e => { if (ED.on) return; const h = hallar(e); if (RC.R.on) { if (h && TIPOS[h.p.t].equipo) { elegir(h.p); return; } const p = motor.enPiso(e.clientX, e.clientY, RC.R.y); if (p) RC.irA(p.x, p.z); return; } elegir(h ? h.p : null); };
  // doble clic: mirando, acerca a lo que se toca (o vuela a ese lugar del piso) y abre la documentación de un rack; editando, saca un punto de una línea
  motor.alDoble = e => { if (RC.R.on || ED.colocar || ED.linea || CON.T.h) return; const h = hallar(e);
    if (ED.on) { const mh = SEL && SEL.pts && motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh))[0], i = mh && mh.object.userData.vertice; if (i != null) { if (SEL.pts.length <= (TIPOS[SEL.t].forma === 'area' ? 3 : 2)) { toast('No se puede sacar: quedaría sin forma'); return; } SEL.pts.splice(i, 1); CON.quitado(SEL, i); rehacer(SEL); CON.marcar(); cambio(); return; } }
    if (h && TIPOS[h.p.t].protegido && host && host.abrirDoc) { host.abrirDoc(h.p); return; } if (ED.on) return;
    if (h && TIPOS[h.p.t].forma === 'punto') { elegir(h.p, true); return; } const p = motor.enPiso(e.clientX, e.clientY); if (p) motor.ir({ tx: p.x, tz: p.z, d: Math.max(motor.C.min * 3, motor.C.d * 0.55) }, 0.6); };
  canvas.addEventListener('pointerup', e => { if (!ED.on || e.button !== 0) return; const p = motor.enPiso(e.clientX, e.clientY); if (!p) return; if (CON.clic(e, p)) return;
    if (ED.colocar && !ED.colocar.p) motor.pasar(e);
    if (ED.colocar && ED.colocar.p) { const C = ED.colocar, nuevo = C.p; delete nuevo._col; delete nuevo._p; rehacer(nuevo); C.p = null; if (!e.shiftKey) { ED.colocar = null; herrVis(null); toast(`${TIPOS[nuevo.t].n} ubicado`); } elegir(e.shiftKey ? null : nuevo); cambio(); if (e.shiftKey) motor.pasar(e); return; }
    if (ED.linea) { const L = ED.linea, ahora = performance.now(), dbl = ahora - ultimoToque < 320; ultimoToque = ahora; const q = [pegar(p.x, e.altKey), pegar(p.z, e.altKey)];
      if (dbl) { terminarLinea(); return; } L.pts.push(q); if (!L.p) { L.p = { ...JSON.parse(JSON.stringify(L.tpl)), id: nuevoId(L.tpl.t), pts: [...L.pts], _p: 1 }; E.piezas.push(L.p); } L.p.pts = [...L.pts]; if (L.pts.length >= 2) rehacer(L.p); } });
  function terminarLinea() { const L = ED.linea; if (!L) return; const min = TIPOS[L.tpl.t].forma === 'area' ? 3 : 2; if (L.p && L.pts.length >= min) { L.p.pts = [...L.pts]; delete L.p._p; rehacer(L.p); const p = L.p; L.p = null; ED.linea = null; herrVis(null); elegir(p); cambio(); toast(`${TIPOS[p.t].n} listo`); } else { cancelar(); toast('Faltan puntos'); } }
  addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; } const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (k === 'escape') { if (!$('#mmenu').hidden) { menu(null); return; } if (!$('#mcat').hidden) { $('#mcat').hidden = true; return; } if (!$('#meq').hidden) { $('#meq').hidden = true; return; } if (CON.cancelar()) return; if (ED.colocar || ED.linea) { cancelar(); return; }
      if (CON.sub) { CON.sub = null; info(); return; } if (SEL) { elegir(null); return; } if (ED.on) { editar(false); return; } if (document.documentElement.classList.contains('mfull')) pantalla(false); return; }
    if (RC.R.on) return;
    if (k === 'f' && !mod && puede) { editar(!ED.on); return; }
    if (k === 'p' && !mod) { paredes({ alta: 'corte', corte: 'baja', baja: 'alta' }[ctx.paredes]); return; }
    if (!ED.on) return;
    if (mod && k === 'z') { e.preventDefault(); volver(e.shiftKey ? redo : undo, e.shiftKey ? undo : redo); return; } if (mod && k === 'y') { e.preventDefault(); volver(redo, undo); return; } if (mod && k === 'd') { e.preventDefault(); duplicar(); return; }
    if (mod && k === 'c' && SEL) { copia = JSON.stringify(SEL); toast('Copiado · Ctrl+V lo ubica'); return; } if (mod && k === 'v' && copia) { e.preventDefault(); pegarCopia(); return; }
    if (mod) return; if (CON.tecla(e, k)) return;
    if (k === 'tab' || k === 'i') { e.preventDefault(); catalogo($('#mcat').hidden); return; }
    if (/^[1-8]$/.test(k)) { herramienta(HERR[+k - 1][0]); return; }
    const atajo = { h: 'mano', k: 'maza', e: 'gotero', b: 'pared', n: 'recinto' }[k]; if (atajo) { herramienta(atajo); return; }
    if (k === 'g') { $('#bgrid').click(); return; }
    if (k === 'enter' && ED.linea) terminarLinea(); if (k === 'backspace' && ED.linea) { e.preventDefault(); ED.linea.pts.pop(); if (ED.linea.p) { ED.linea.p.pts = [...ED.linea.pts]; if (ED.linea.pts.length >= 2) rehacer(ED.linea.p); } return; }
    if ((k === 'delete' || k === 'backspace') && SEL) { e.preventDefault(); sacar(SEL); return; }
    const giro = k === ',' ? -Math.PI / 4 : k === '.' ? Math.PI / 4 : k === 'r' ? Math.PI / 2 : 0; if (giro) girarSel(giro); });
  const CON = construir({ motor, mundo, objs, TIPOS, canvas, ED, svg, esc, get E() { return E; }, get SEL() { return SEL; }, rehacer, quitar, cambio, elegir, nuevoId, hint, toast, herrVis, ficha: info });

  // ---------- guardar ----------
  let guardT = null; const estado = t => { const s = $('#mguar'); if (s) s.textContent = t; };
  function snapshot() { const ext = E.piezas.filter(p => p.uid).map(p => ({ uid: p.uid, id: p.id, nombre: p.nombre || '', lugar: lugarDe(p), nave: '' }));
    return { ...((host && host.state) || {}), v: 1, motor: 1, escena: { ...E, piezas: JSON.parse(limpio()) }, ext }; }
  function guardar() { if (!puede) return; estado('Guardando…'); clearTimeout(guardT); guardT = setTimeout(() => { const s = JSON.parse(JSON.stringify(snapshot()));
      if (host && host.save) { host.save(s); if (host) host.state = s; estado('Guardado ' + new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })); }
      else { try { localStorage.setItem(o.clave || 'motor.escena', JSON.stringify(s)); estado('Guardado en este navegador'); } catch (er) { estado('No se pudo guardar'); } }
      o.alGuardar && o.alGuardar(s); }, 900); }

  // ---------- animación de equipos caídos y medición ----------
  // recorrer a pie con el avatar (recorrer.js). Recorrer y editar no van juntos: al entrar a uno se sale del otro.
  const RC = recorrer({ motor, mundo, objs, TIPOS, svg, esc, elegir, AVM: () => AVM,
    avatar: async g => { await cargarGLB('avatares', 'tec-h-epp', g, null, 'yo-paseo'); for (const ob of PERS) if (ob.dueño === g) { PERS.delete(ob); return ob; } return null; } });
  $('#bpaseo').addEventListener('click', () => { if (ED.on) editar(false); elegir(null); RC.paseo(!RC.R.on); });
  // las personas respiran y cambian el peso de pierna (unos 24 cuadros por segundo, solo de cerca y con la página a la vista: lejos no se nota y gasta batería)
  motor.cada.push((dt, t) => { if (!PERS.size || motor.C.d > 150 || document.hidden) return false; avAcc += dt; if (avAcc < 1 / 24) return false; const d = avAcc; avAcc = 0;
    for (const ob of PERS) { if (!ob.dueño.parent) { PERS.delete(ob); continue; } AVM.avPose(ob, 'idle', d, { x: 0, y: 0, t: t / 1000 + ob.semilla }); ob.sync(); } return true; });
  motor.cada.push((dt, t) => { let x = false; for (const p of E.piezas) { const g = objs.get(p.id); if (g && g.userData.estado === 'crit' && g.userData.aro) { g.userData.aro.material.opacity = 0.45 + 0.45 * Math.sin(t * 0.008); x = true; } } return x; });
  if (/[?&]medir=1/.test(location.search)) { const s = $('#mstats'); s.hidden = false; setInterval(() => { const m = motor.stats; s.textContent = `${m.fps} c/s · ${m.ms} ms · ${m.dibujos} dibujos · ${Math.round(m.triangulos / 1000)} mil triángulos`; }, 700); }
  addEventListener('message', e => { const d = e.data || {}; if (d.tema) motor.ponerTema(d.tema === 'dark' || d.tema === 'oscuro' ? 'oscuro' : 'claro'); });
  let elegido = false; try { elegido = !!localStorage.getItem('motor.tema'); } catch (e) {}
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', m => { if (!o.tema && !elegido) motor.ponerTema(m.matches ? 'oscuro' : 'claro'); });
  // día o noche: lo elige cada uno y queda guardado en su navegador
  $('#btema').addEventListener('click', () => { const t = motor.tema === 'oscuro' ? 'claro' : 'oscuro'; elegido = true; try { localStorage.setItem('motor.tema', t); } catch (e) {} motor.ponerTema(t); });
  document.addEventListener('fullscreenchange', () => document.documentElement.classList.toggle('mfull', !!document.fullscreenElement));

  armarTodo();
  const enc = E.inicio || encuadre(); motor.inicio(enc); if (o.intro !== false) { Object.assign(motor.C, { ...enc, d: enc.d * 1.35, yaw: enc.yaw - 0.45, pitch: Math.min(1.2, enc.pitch + 0.2) }); motor.ir(enc, 1.8); }
  const api = { importar, motor, E, objs, PASEO: RC.R, paseo: RC.paseo, irA: RC.irA, CON, ED, elegir, editar, herramienta, empezar, paredes, guardar, snapshot, armarTodo, leerEquipos, lugarDe, get sel() { return SEL; }, cargar(esc2) { E = normal(esc2); api.E = E; foto = limpio(); undo.length = redo.length = 0; SEL = null; armarTodo(); info(); $('#mnom').textContent = E.nombre; motor.inicio(E.inicio || encuadre()); motor.vista(); } };
  return api;
}
function normal(e) { e = JSON.parse(JSON.stringify(e || {})); e.v = 1; e.piezas = (e.piezas || []).filter(p => p && p.t && TIPOS[p.t]); let n = 0; const ids = new Set(); for (const p of e.piezas) { if (!p.id) p.id = p.t.slice(0, 3) + 'x' + (n++); if (ids.has(p.id)) { let i = 2; while (ids.has(p.id + '-' + i)) i++; p.id += '-' + i; } ids.add(p.id); } return e; }
// las personas del catálogo vienen con los brazos abiertos: se bajan al costado del cuerpo
function brazos(p) { p.updateMatrixWorld(true); const B = {}; p.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; }); if (!B.LeftArm) return;
  const wp = n => B[n].getWorldPosition(new THREE.Vector3()), gira = (n, a, b, s) => { if (!B[n] || !B[b]) return; const d = wp(b).sub(wp(a)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(s * 0.12, -1, 0.04).normalize()), pw = B[n].parent.getWorldQuaternion(new THREE.Quaternion()), bw = B[n].getWorldQuaternion(new THREE.Quaternion());
    B[n].quaternion.copy(pw.invert().multiply(q).multiply(bw)); p.updateMatrixWorld(true); };
  const s = Math.sign(wp('LeftArm').x - wp('RightArm').x) || 1; gira('LeftArm', 'LeftArm', 'LeftForeArm', s); gira('LeftForeArm', 'LeftForeArm', 'LeftHand', s); gira('RightArm', 'RightArm', 'RightForeArm', -s); gira('RightForeArm', 'RightForeArm', 'RightHand', -s); }

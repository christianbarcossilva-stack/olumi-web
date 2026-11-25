// Motor común · la maqueta: arma las piezas, muestra etiquetas y capas, y trae el editor (comandos de Los Sims 4), el modo construcción
// (construir.js: paredes, recintos, puertas y ventanas) y el recorrido a pie (recorrer.js).
// La usan Ondi (equipos en vivo) y Olumi (oficina). Cada app le pasa su "anfitrión" (host):
//   host.state      lo guardado ({ v:1, motor:1, escena, ext })      host.save(state)   guarda
//   host.role       'inst' edita, 'cli' solo mira                   host.equipos()     lista de equipos reales (Ondi)
//   host.juego(on)  pantalla completa dentro de la app               host.park          nombre del lugar
//   host.clave(o)   pide la clave de borrado de la empresa (promesa: true o false); sin eso, se confirma manteniendo apretado
//   host.abrirDoc(p) abre la documentación de un rack o gabinete (bocas, patch cords, fibras)
//   Control de acceso (Kliva):
//   host.puertas()   lista de puertas reales [{ id, nombre, estado, equipo }]; estado: cerrada | abierta | alerta | caida | sin
//   host.alVivo(fn)  la app avisa al momento: fn({ puerta, estado?, ev?: 'pasa' | 'rechazo', quien? })
//   host.abrir(id)   abre una puerta a distancia (promesa)
//   host.tema        'claro' u 'oscuro': lo decide la app (la maqueta no muestra su propio botón de día y noche)
//   host.alTocar(pieza, [x, z])  mirando (sin editar ni recorrer), un toque: si devuelve true, la app se queda con él y la maqueta no abre la ficha
//   host.paredes     vista de paredes al abrir: 'alta' (si no dice), 'corte' (cortadas para ver adentro, como una maqueta de arquitecto) o 'baja'
import { THREE, crearMotor } from './nucleo.js?v=c6d525a6';
import { TIPOS, GRUPOS, armarPieza, centro, altoDe, matSuelo, andenesDe, nivelesDe, rampasDe, ABERTURAS, areaSig, ACCESOS, claseAcceso, colorAcceso, AMB, cotaEn, cajones, ALTO_PLANTA, altoPlanta, nivelDe, NOM_PLANTA, postesDe } from './piezas.js?v=c6d525a6';
import { ve, dominio, DOMINIOS } from './plano.js?v=c6d525a6';
import { svg } from './iconos.js?v=c6d525a6';
import { construir } from './construir.js?v=c6d525a6';
import { juego } from './juego.js?v=c6d525a6';
import { recorrer } from './recorrer.js?v=c6d525a6';
import { transito } from './transito.js?v=c6d525a6';
import { extras } from './extras.js?v=c6d525a6';

const $ = (s, r = document) => r.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAPAS = [['plano', 'Plano del lugar'], ['base', 'Construcciones y caminos'], ['acceso', 'Puertas con control'], ['logistica', 'Contenedores y vehículos'], ['vegetacion', 'Árboles'], ['camaras', 'Cámaras'], ['campos', 'Campo de las cámaras'], ['wifi', 'Wi-Fi'], ['racks', 'Racks y gabinetes'], ['fibra', 'Fibra y cables'], ['equipos', 'Sensores y otros equipos'], ['etiquetas', 'Nombres'], ['techos', 'Techos'], ['transito', 'Camiones en movimiento (de ejemplo)']];
// los equipos se prenden y apagan por clase: cámaras, Wi-Fi, racks y gabinetes, fibra, y el resto
// sacar capas de la obra, de a una: techo, el piso de arriba, paredes cortadas, paredes al ras (botón de la barra y «Ver por dentro» en Capas)
const PELAR = [['Todo puesto'], ['Sin techo'], ['Sin el piso de arriba'], ['Paredes cortadas'], ['Paredes al ras']];
const CAPA_DE = { camara: 'camaras', ap: 'wifi', rack: 'racks', gabinete: 'racks', fibra: 'fibra', bandeja: 'fibra' }, CAPAS_EQ = ['camaras', 'campos', 'wifi', 'racks', 'fibra', 'equipos'];
const SIN_CAPA = { kliva: ['logistica', ...CAPAS_EQ] };
const EQ_DE = { cam: 'camara', ap: 'ap', sw: 'switch', gw: 'router', sen: 'sensor', otro: 'ups' };
const ESTADO = e => ['online', 'en_linea', 'abierta', 'cerrada'].includes(e) ? 'ok' : ['offline', 'caido'].includes(e) ? 'crit' : ['alerting', 'atencion'].includes(e) ? 'warn' : 'off';
const ESTX = { ok: 'En línea', crit: 'Caído', warn: 'Con alertas', off: 'Sin dato' };
// puertas con control de acceso: el estado de la puerta real, en palabras y en el punto de la etiqueta
const pest = e => PEST[e] || PEST.cerrada, PEST = { cerrada: ['Cerrada', 'ok'], abierta: ['Abierta', 'ok'], alerta: ['Abierta de más o forzada', 'warn'], caida: ['Sin conexión', 'crit'], sin: ['Sin enlazar', 'off'] };
const tipoReal = d => { if (/^sensor_/.test(d.tipo || '')) return 'sen'; if (d.tipo) return { camara: 'cam', nvr: 'cam', switch: 'sw', ap: 'ap', router: 'gw' }[d.tipo] || 'otro'; const t = [d.linea, d.modelo, d.nombre].join(' ').toLowerCase();
  if (/protect|camera|cámara|camara|bullet|dome|domo|turret|\bg[345]\b|nvr/.test(t)) return 'cam'; if (/usw|switch|flex mini/.test(t)) return 'sw'; if (/udm|uxg|usg|ucg|gateway|dream|router|cloud key/.test(t)) return 'gw'; if (/\bu[67]\b|uap|\bap\b|mesh|nanohd|access point|wi-?fi/.test(t)) return 'ap'; return 'otro'; };

// el logo de cada app en la barra (el mismo dibujo que su ícono)
const LOGO = {
};
LOGO.kliva = '<svg class="mapp" viewBox="0 0 38 38" aria-hidden="true"><rect width="38" height="38" rx="10" fill="#1E1F23"/><g fill="none" stroke="#F3F4F6" stroke-linecap="round"><path d="M12 9v20" stroke-width="3.2"/><path d="M14.5 19.5l9-8.3" stroke-width="2.4"/><path d="M16.5 21.5L25 29" stroke-width="1.4" stroke-dasharray="1.6 2.4" opacity=".6"/></g><circle cx="26.5" cy="9.5" r="2.8" fill="#9D7CFF"/></svg>';
const BUSCA = { olumi: 'Buscar sala, puesto o persona', kliva: 'Buscar puerta, galpón u oficina' };
const SIN = { kliva: ['Logística', 'Equipos', 'Personas y vehículos'] };
// barra de herramientas del editor: las teclas 1 a 8 las eligen en este orden
const HERR = [['mano', 'Mano: elegir y mover', 'H'], ['varias', 'Elegir varias y moverlas juntas', 'V'], ['pared', 'Pared: punto por punto', 'B'], ['recinto', 'Recinto: de esquina a esquina', 'N'], ['puerta', 'Puerta sobre una pared', ''], ['ventana', 'Ventana sobre una pared', ''], ['catalogo', 'Inventario: todo lo que se puede poner', 'Tab'], ['gotero', 'Gotero: copiar', 'E'], ['maza', 'Maza: sacar', 'K']];
const ORDEN = [...GRUPOS]; ORDEN.splice(ORDEN.indexOf('Construcción') + 1, 0, 'Puertas y ventanas');
const GAMMA = Uint8Array.from({ length: 256 }, (_, i) => Math.round(Math.pow(i / 255, 1 / 2.2) * 255));
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('es-UY', { maximumFractionDigits: 2 });

export async function abrirMaqueta(o) {
  const host = o.host || null, raiz = o.raiz || document.body, app = o.app || 'ondi';
  const puede = o.editable ?? (!host || host.role !== 'cli');
  let E = normal(o.escena || (host && host.state && host.state.escena) || { v: 1, nombre: (host && host.park) || 'Maqueta', piezas: [] }); altoPlanta(E.altoPlanta);   /* de piso a piso, si la maqueta dice otra cosa que 2,80 m */
  if (host && !E.piezas.length) E.piezas.push({ id: 'ter1', t: 'terreno', nombre: E.nombre, mat: 'tierra', pts: [[-60, -40], [60, -40], [60, 40], [-60, 40]] });
  // ---------- pantalla ----------
  raiz.insertAdjacentHTML('beforeend', `<canvas id="m3d" tabindex="0" aria-label="Maqueta 3D de ${esc(E.nombre)}. Arrastrá para mover; rueda o dos dedos para acercar; clic derecho, o dos dedos de costado, para girar."></canvas><div id="mlbl" aria-hidden="true"></div>
  <header class="mbar vidrio"><div class="mmarca">${LOGO[app] || `<i class="mapp mapp-${app}"></i>`}<div><b id="mnom">${esc(E.nombre)}</b><span id="mguar">${puede ? (host && host.guarda === false ? 'Simulación: los cambios no se guardan' : 'Los cambios se guardan solos') : 'Solo lectura'}</span></div></div>
    <label class="mbus">${svg('buscar', 16)}<input id="mq" type="search" placeholder="${BUSCA[app] || 'Buscar fila, galpón, equipo o IP'}" autocomplete="off" aria-label="Buscar"><div id="mres" class="vidrio" hidden></div></label>
    <div class="mbtns">${host && host.tema ? '' : `<button id="btema" data-tecla="L" class="mbtn" aria-label="Cambiar la hora del día" title="Hora del día: mañana, mediodía, hora azul, noche u hora real (L)">${svg('tema')}</button>`}<button id="bcapas" data-tecla="J" class="mbtn" aria-label="Capas y paredes" title="Capas y paredes (J)">${svg('capas')}</button><button id="bpelar" data-tecla="X" class="mbtn" aria-label="Sacar capas de la obra" title="Sacar capas: techo, piso de arriba, paredes. Cada toque saca una; con Mayúscula vuelve a poner (X)">${svg('pelar')}</button><button id="bplano" data-tecla="T" class="mbtn" aria-pressed="false" aria-label="Ver desde arriba" title="Ver desde arriba (planta) (T)">${svg('plano')}</button><button id="bvista" data-tecla="U" class="mbtn" aria-label="Vista general" title="Vista general (U)">${svg('vista')}</button><button id="bpaseo" data-tecla="C" class="mbtn" aria-pressed="false" aria-label="Recorrer caminando" title="Recorrer caminando (C)">${svg('caminar')}</button><button id="bfull" data-tecla="O" class="mbtn" aria-label="Pantalla completa" title="Pantalla completa (O)">${svg('full')}</button>${puede ? `<button id="bedit" class="mbtn pri" aria-pressed="false" title="Editar (F)">${svg('editar')}<span>Editar</span></button>` : ''}</div></header>
  <div id="mcapas" class="vidrio mpop" hidden><button class="mbtn mpresb" id="bpres">${svg('ojo', 16)}Recorrido de presentación</button><div class="mseg mclima" role="group" aria-label="Clima"><span>Clima</span><div>${[['real', 'Real'], ['despejado', 'Sol'], ['nublado', 'Nubes'], ['lluvia', 'Lluvia'], ['niebla', 'Niebla']].map(([k, n]) => `<button data-clima="${k}" aria-pressed="${k === 'despejado'}">${n}</button>`).join('')}</div></div>${CAPAS.filter(([k]) => !(SIN_CAPA[app] || []).includes(k) && !(k === 'transito' && app !== 'ondi')).map(([k, n]) => `<label class="msw"><span>${n}</span><input type="checkbox" data-capa="${k}" checked><i></i></label>`).join('')}
    <div class="mseg mpelar" role="group" aria-label="Ver por dentro"><span>Ver por dentro</span><div>${PELAR.map(([n], i) => `<button data-pelar="${i}" aria-pressed="${i === 0}" title="${n}">${i ? '−' + i : 'Todo'}</button>`).join('')}</div></div><div class="mseg" role="group" aria-label="Paredes"><span>Paredes</span><div>${[['alta', 'Altas'], ['corte', 'Cortadas'], ['baja', 'Al ras']].map(([k, n]) => `<button data-pared="${k}" aria-pressed="${k === 'alta'}">${n}</button>`).join('')}</div></div><div id="mlug"></div><p class="mvacio" id="mocultos" hidden></p><p class="mayuda">Con «Techos» apagado se ve cada nave por dentro.</p></div>
  <aside id="minfo" class="vidrio" hidden></aside>
  <nav id="mtool" class="vidrio" hidden aria-label="Herramientas"><span id="mbarra" role="group" aria-label="Barra rápida: teclas 1 a 0"></span><span class="msep"></span><button data-h="catalogo" aria-pressed="false" title="Inventario (Tab): arrastrá a la barra lo que uses seguido" aria-label="Inventario">${svg('catalogo')}</button>${host && host.puertas ? `<button id="beq" title="Puertas para ubicar" aria-label="Puertas para ubicar">${svg('puerta')}</button>` : host && host.equipos ? `<button id="beq" title="Equipos del cliente" aria-label="Equipos del cliente">${svg('equipos')}</button>` : ''}
    <span class="msep"></span><span class="mplanta" role="group" aria-label="Planta"><button id="bplbaja" title="Planta de abajo (Av Pág)" aria-label="Planta de abajo">▾</button><b id="bplnom" title="Planta en la que estás dibujando">Planta baja</b><button id="bplsube" title="Planta de arriba (Re Pág)" aria-label="Planta de arriba">▴</button></span>
    <span class="msep"></span><button id="bundo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${svg('deshacer')}</button><button id="bredo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer">${svg('rehacer')}</button><button id="bgrid" aria-pressed="true" title="Grilla (G)" aria-label="Grilla">${svg('grilla')}</button><button id="bpared" title="Paredes altas, cortadas o al ras (P)" aria-label="Vista de las paredes">${svg('paredes')}</button><button id="bpap" title="Papelera: recuperar lo sacado" aria-label="Papelera">${svg('restaurar')}</button></nav>
  <section id="mcat" class="vidrio mhoja" hidden aria-label="Inventario"><div class="mhead"><b>Inventario</b><input id="mcq" type="search" placeholder="Buscar" aria-label="Buscar en el inventario"><button class="mx" data-cerrar="mcat" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div id="mcl"></div><label class="mimp">${svg('mas', 16)}Importar piezas de un archivo (.json)<input id="mimp" type="file" accept=".json,application/json" hidden></label><input id="mimg" type="file" accept="image/*" hidden></section>
  <section id="meq" class="vidrio mhoja" hidden aria-label="${host && host.puertas ? 'Puertas para ubicar' : 'Equipos del cliente'}"><div class="mhead"><b>${host && host.puertas ? 'Puertas' : 'Equipos del cliente'}</b><input id="meqq" type="search" placeholder="${host && host.puertas ? 'Nombre de la puerta o del equipo' : 'Nombre, modelo o IP'}" aria-label="Buscar"><button class="mx" data-cerrar="meq" aria-label="Cerrar">${svg('cerrar', 16)}</button></div><div id="meql"></div></section>
  <div id="mmenu" class="vidrio" hidden role="menu"></div><div id="mconf" hidden></div>
  <div id="mhint" class="vidrio" hidden></div><div id="mtoast" class="vidrio" hidden role="status"></div>
  <div id="mstats" hidden></div>`);
  const canvas = $('#m3d'), motor = crearMotor(canvas, { tema: o.tema, ruedaConCtrl: o.ruedaConCtrl }), mundo = new THREE.Group(); motor.scene.add(mundo); motor.cota = cotaEn;
  let J = null;   // la capa de juego (juego.js): barra rápida, pausa, ajustes y reglas de ubicar; se arma más abajo, cuando ya está todo lo demás
  const objs = new Map(), lbl = $('#mlbl');
  let tostT; const toast = (m, ms = 2800) => { const t = $('#mtoast'); t.textContent = m; t.hidden = false; clearTimeout(tostT); tostT = setTimeout(() => t.hidden = true, ms); };
  // la pista de la herramienta se muestra chica y a los segundos se aclara sola, para no tapar
  // en la Mac la tecla Alt se llama Option (⌥): la ayuda la nombra como está escrita en el teclado
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent); let hintT; const hint = m => { const h = $('#mhint'); clearTimeout(hintT); h.hidden = !m; h.classList.remove('tenue'); if (m) { h.innerHTML = MAC ? String(m).replace(/<kbd>Alt<\/kbd>/g, '<kbd>⌥ Option</kbd>') : m; hintT = setTimeout(() => h.classList.add('tenue'), 9000); } };

  // suelo de fondo (pasto) que acompaña el tema
  const pg = new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2); { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9000, uv.getY(i) * 9000); }
  const suelo = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ roughness: 1 })); suelo.position.y = -0.02; suelo.receiveShadow = true; motor.scene.add(suelo);
  // de noche, una grilla de 10 m en el color de la app que se apaga hacia lo lejos (la vibra de tecnología)
  const grillaNoche = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(240, 240); t.anisotropy = 8;
    const f = document.createElement('canvas'); f.width = f.height = 256; const y = f.getContext('2d'), gr = y.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#888'); gr.addColorStop(1, '#000'); y.fillStyle = gr; y.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, alphaMap: new THREE.CanvasTexture(f), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -16, polygonOffsetUnits: -12 }));
    m.position.y = 0.06; m.renderOrder = 1; m.visible = false; motor.scene.add(m); return m; })();
  // con el plano del lugar en el piso, la grilla de noche no se le pone arriba
  let cuadricula = false; // el cuadriculado del piso se ve solo editando (de día y de noche)
  const pintaSuelo = () => { suelo.material = matSuelo('pasto', { roughness: 1 }); grillaNoche.visible = cuadricula && motor.tema === 'oscuro' && !E.piezas.some(p => p.t === 'plano'); grillaNoche.material.color.set(getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#3fc6ea'); };

  // ---------- equipos reales (Ondi) ----------
  const EQ = { lista: [], porUid: new Map(), at: 0 };
  async function leerEquipos(forzar) { if (!host || !host.equipos) return; if (!forzar && Date.now() - EQ.at < 55000) return; EQ.at = Date.now();
    try { const r = await host.equipos(); EQ.lista = (r && r.list) || []; EQ.errs = (r && r.errs) || []; } catch (e) { EQ.errs = ['No se pudieron leer los equipos']; }
    EQ.porUid = new Map(EQ.lista.map(d => [d.uid, d]));
    for (const p of E.piezas) if (p.uid && TIPOS[p.t] && TIPOS[p.t].equipo) { const d = EQ.porUid.get(p.uid), g = objs.get(p.id); if (d && d.nombre && p.nombre !== d.nombre) p.nombre = d.nombre; if (g && g.userData.estado !== ESTADO(d && d.estado)) rehacer(p); }
    if (!$('#meq').hidden) listaEquipos(); if (SEL) info(); }
  const ctx = { paredes: (host && host.paredes) || 'alta', estado: p => p.uid ? (EQ.porUid.has(p.uid) ? ESTADO(EQ.porUid.get(p.uid).estado) : 'off') : (p.estado || 'off'), glb: o.catalogo ? cargarGLB : null, modelo: o.catalogo ? modeloBase : null, piezas: () => E.piezas, dirty: () => { motor.dirty = true; }, vivo: p => vivoDe(p) };
  if (host && host.equipos) { leerEquipos(true); setInterval(() => leerEquipos(true), 60000); }

  // ---------- puertas con control de acceso (Kliva): estado en vivo y movimiento ----------
  // El anfitrión da la lista de puertas reales y avisa cada cambio. La hoja, el portón, el molinete o la barrera se mueven sin rearmar la pieza;
  // el lector se prende del color de lo que pasó (verde, rojo) unos segundos y vuelve al de su estado. Lo ámbar (abierta de más o forzada) titila.
  const PU = { lista: [], porId: new Map(), vivo: new Map() }, POSE = new Map(), MUEVE = new Set();
  let ARMA = {};   // la puerta que espera el segundo toque para abrirse
  function vivoDe(p) { if (!p.puerta) return { estado: host && host.puertas ? 'sin' : 'cerrada' }; return PU.vivo.get(p.puerta) || { estado: host && host.puertas ? 'sin' : 'cerrada' }; }
  async function leerPuertas() { if (!host || !host.puertas) return; try { PU.lista = (await host.puertas()) || []; } catch (e) { PU.lista = []; }
    PU.porId = new Map(PU.lista.map(d => [d.id, d])); for (const d of PU.lista) { const v = PU.vivo.get(d.id) || {}; v.estado = d.estado || 'cerrada'; PU.vivo.set(d.id, v); }
    for (const p of E.piezas) if (p.puerta && TIPOS[p.t] && TIPOS[p.t].vivo) { const d = PU.porId.get(p.puerta); if (d && d.nombre && p.nombre !== d.nombre) p.nombre = d.nombre; mover(p); }
    etiquetas(); if (!$('#meq').hidden) listaPuertas(); if (SEL) info(); }
  function vivo(m) { if (!m || !m.puerta) return; const v = PU.vivo.get(m.puerta) || { estado: 'cerrada' };
    if (m.estado) v.estado = m.estado; if (m.ev) { v.ev = m.ev; v.quien = m.quien || ''; v.at = Date.now(); v.hasta = v.at + (m.ev === 'pasa' ? 6000 : 4500); if (m.ev === 'pasa') v.giros = (v.giros || 0) + 1; }
    PU.vivo.set(m.puerta, v); let rot = false; for (const p of E.piezas) if (p.puerta === m.puerta && objs.has(p.id)) { mover(p); rot = true; } if (rot) rotulos(m.puerta); if (SEL && SEL.puerta === m.puerta && !ED.on) info(); }
  const mover = p => { MUEVE.add(p.id); motor.dirty = true; };
  motor.cada.push((dt, t) => { if (!MUEVE.size) return false; const ahora = Date.now(); let sigue = false;
    for (const id of MUEVE) { const g = objs.get(id), p = g && g.userData.pieza; if (!p || !g.userData.anima) { MUEVE.delete(id); continue; } const v = vivoDe(p), fresco = v.hasta > ahora;
      // a dónde va cada parte: abierta si la puerta está abierta; la barrera también sube un rato cuando alguien pasa; el molinete suma un tercio de vuelta por pasada
      const abre = v.estado === 'abierta' || v.estado === 'alerta' || (fresco && v.ev === 'pasa' && p.clase === 'barrera'), pose = POSE.get(id) || {}; let quieto = true;
      g.userData.anima.forEach((a, i) => { const meta = a.vuelta ? (v.giros || 0) * a.vuelta : abre ? a.abierto : a.cerrado, k = 'v' + i; if (pose[k] === undefined) pose[k] = a.vuelta ? meta : a.cerrado;
        pose[k] += (meta - pose[k]) * (1 - Math.exp(-dt * (a.vuelta ? 5 : 4.2))); if (Math.abs(meta - pose[k]) < 0.002) pose[k] = meta; else quieto = false;
        if (a.eje === 'x') a.o.position.x = pose[k]; else if (a.eje === 'rz') a.o.rotation.z = pose[k]; else a.o.rotation.y = pose[k]; });
      POSE.set(id, pose);
      // el color: lo que acaba de pasar manda; si no, el estado (lo ámbar titila)
      const titila = v.estado === 'alerta' && !fresco, est = fresco ? v.ev : v.estado, c = colorAcceso(titila && Math.sin(t * 7) < 0 ? 'sin' : est);
      if (g.userData.color !== c) { g.userData.color = c; for (const m of g.userData.luces) { m.color.set(c); if (m.emissive) m.emissive.set(c); } for (const m of g.userData.pisos) m.color.set(c); }
      if (quieto && !fresco && !titila) { MUEVE.delete(id); if (v.ev && !fresco) { v.ev = null; rotulos(p.puerta); } } else sigue = true; }
    return true; });
  if (host && host.alVivo) host.alVivo(vivo);
  if (host && host.puertas) leerPuertas();

  // ---------- modelos del catálogo de Olumi (personas y vehículos) ----------
  const GLB = {}, PERS = new Set(); let cat = null, loader = null, AVM = null, avAcc = 0;
  // el modelo tal cual viene del catálogo (sin copiar): lo usan los estacionamientos para dibujar muchos autos iguales de una vez
  async function modeloBase(tipo, id) { if (!loader) { const { GLTFLoader } = await import('three/addons/GLTFLoader.js'); loader = new GLTFLoader(); } cat = cat || await (await fetch(o.catalogo + 'catalogo.json')).json(); const it = (cat[tipo] || []).find(x => x.id === id); if (!it) return null;
    GLB[id] = GLB[id] || new Promise((ok, no) => loader.load(o.catalogo + it.archivo, x => ok(x.scene), undefined, no)); return { escena: await GLB[id], it }; }
  async function cargarGLB(tipo, id, g, color, pid) { try { if (!loader) { const { GLTFLoader } = await import('three/addons/GLTFLoader.js'); loader = new GLTFLoader(); }
      cat = cat || await (await fetch(o.catalogo + 'catalogo.json')).json(); const it = (cat[tipo] || []).find(x => x.id === id); if (!it) return;
      GLB[id] = GLB[id] || new Promise((ok, no) => loader.load(o.catalogo + it.archivo, x => ok(x.scene), undefined, no)); const base = await GLB[id];
      const { clone } = await import('three/addons/SkeletonUtils.js'); const m = clone(base); m.traverse(k => { if (k.isMesh) { k.castShadow = k.receiveShadow = true; if (k.isSkinnedMesh) k.frustumCulled = false; if (color && tipo === 'vehiculos') for (const q of [].concat(k.material)) if (q.name === 'pintura') { k.material = q.clone(); k.material.color.set(color); } } k.userData.dueño = g; });
      let pon = m;
      // personas: el mismo núcleo y la misma variedad de Olumi (reposo natural, respira y cambia el peso de pierna; piel, pelo y ropa propios de cada una)
      if (tipo === 'avatares') { let ob = null; try { AVM = AVM || await import('./avatar.js?v=c6d525a6'); ob = AVM.avatarGLB(m, it.alto * (1 + ((AVM.hsh(pid || id) % 7) - 3) * 0.006)); } catch (e) { ob = null; }
        if (ob) { AVM.variar(ob, pid || id); pon = new THREE.Group(); pon.rotation.y = -Math.PI / 2; pon.add(ob.g); ob.semilla = AVM.hsh(pid || id) % 997; const md = g.userData.pose === 'sentado' ? 'sit' : 'idle'; for (let i = 0; i < (md === 'sit' ? 12 : 1); i++) AVM.avPose(ob, md, md === 'sit' ? 0.2 : 0.016, { x: 0, y: 0, t: ob.semilla, asiento: 0.47, teclado: true }); ob.sync(); ob.dueño = g; PERS.add(ob); }
        else { const b = new THREE.Box3().setFromObject(m); m.scale.setScalar(it.alto / (b.max.y - b.min.y)); brazos(m); } }
      g.clear(); g.add(pon); motor.dirty = true; } catch (e) { /* sin catálogo: queda la figura simple */ } }

  // ---------- armar la escena ----------
  /* el cerco se corta solo donde hay un portón, un pilar, una caseta o una puerta con control: al ponerlos, moverlos o cambiarlos se rehacen los cercos */
  const CORTAN = /^(porton|pilar|caseta|acceso)$/; let firmaC = '', tCer = 0;
  function cercos() { clearTimeout(tCer); tCer = setTimeout(() => { const fi = E.piezas.filter(q => CORTAN.test(q.t)).map(q => [q.id, q.x, q.z, q.r, q.ancho, q.fondo, q.lado, q.pilares, q.clase, q.nivel].join()).join('|'); if (fi === firmaC) return; firmaC = fi;
    rehVec = true; try { for (const q of E.piezas) if (q.t === 'cerco' && objs.has(q.id)) rehacer(q); } finally { rehVec = false; } }, 120); }
  /* un portón o un pilar que se suelta a menos de 1,5 m de un cerco se pega a la línea; el portón además toma su dirección (de los dos sentidos, el más cercano al que tenía) */
  /* en qué tramo de la línea cae un punto (índice del punto de partida; en un cerco cerrado, el último tramo vuelve al primero) */
  function tramoDe(p, [x, z]) { const P = p.cerrado ? [...p.pts, p.pts[0]] : p.pts; let bi = 0, bd = Infinity;
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z); if (d < bd) { bd = d; bi = i - 1; } }
    return bi; }
  /* cortar un cerco en un poste: queda en dos (o, si era cerrado, abierto en ese punto), cada parte con su punta para separarla */
  function cortarCerco(p, pt) { const i = tramoDe(p, pt), P = p.pts, q = [+pt[0].toFixed(3), +pt[1].toFixed(3)];
    if (p.cerrado) { p.pts = [q, ...P.slice(i + 1), ...P.slice(0, i + 1), q.slice()]; p.cerrado = false; rehacer(p); }
    else { const b = { ...JSON.parse(JSON.stringify(p)), id: nuevoId('cerco'), pts: [q.slice(), ...P.slice(i + 1)] }; delete b.candado; p.pts = [...P.slice(0, i + 1), q]; E.piezas.push(b); rehacer(p); rehacer(b); }
    cambio(); puntos(); marcar(); toast('Cortado en ese poste: arrastrá la punta para separarlo'); }
  function pegarAlCerco(p) { if (!p || !/^(porton|pilar)$/.test(p.t) || nivelDe(p)) return false; let best = null; const px = p.x || 0, pz = p.z || 0;
    for (const c of E.piezas) { if (c.t !== 'cerco' || !c.pts || c.pts.length < 2) continue; const P = c.cerrado ? [...c.pts, c.pts[0]] : c.pts;
      for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2)), x = a[0] + dx * t, z = a[1] + dz * t, dd = Math.hypot(x - px, z - pz);
        if (dd < 1.5 && (!best || dd < best.dd)) best = { dd, x, z, r: Math.atan2(-dz, dx) }; } }
    if (!best) return false; let ch = false; const ang = a => Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(best.x - px) > 0.005 || Math.abs(best.z - pz) > 0.005) { p.x = +best.x.toFixed(3); p.z = +best.z.toFixed(3); ch = true; }
    if (p.t === 'porton') { const r0 = p.r || 0, r = Math.abs(ang(best.r - r0)) <= Math.abs(ang(best.r + Math.PI - r0)) ? best.r : best.r + Math.PI, rn = +ang(r).toFixed(4); if (Math.abs(ang(rn - r0)) > 0.002) { p.r = rn; ch = true; } }
    return ch; }
  function rehacer(p) { if (p.t === 'plano' && p.y != null && p.nivel == null) { p.nivel = Math.round((+p.y || 0) / 3); delete p.y; }
    if (NACEN.has(p.id)) { NACEN.delete(p.id); if (PL.act && p.nivel == null && conPlanta(p.t)) p.nivel = PL.act; }
    const v = objs.get(p.id); if (v) { mundo.remove(v); limpiar(v); } const g = armarPieza(p, ctx); if (!g) return; objs.set(p.id, g); mundo.add(g); aplicarCapas(g); if (g.userData.anima) { POSE.delete(p.id); mover(p); } motor.dirty = true; if (SEL === p) marcar(); if (TIPOS[p.t].etiqueta) etiquetas(); if (!rehVec && /^(calle|rotonda|terreno|estacionamiento|galpon|edificio|modulo|recinto)$/.test(p.t)) vecinos(); if (!rehVec && p.t === 'escaleraInt') losaArriba(p); if (!rehVec && CORTAN.test(p.t)) cercos(); }
  /* la losa de arriba se abre donde llega la escalera: al ponerla, moverla o cambiarla, se rehace el piso de la planta de arriba */
  let tEsc = 0; function losaArriba(p) { clearTimeout(tEsc); tEsc = setTimeout(() => { rehVec = true; try { for (const q of E.piezas) if (q.t === 'recinto' && objs.has(q.id) && nivelDe(q) === nivelDe(p) + 1) rehacer(q); } finally { rehVec = false; } }, 250); }
  // cordones, veredas, esquinas y matas de pasto dependen de lo que tienen al lado: un rato después de un cambio se rehacen calles y pastos
  let rehVec = false, tVec = 0; function vecinos() { clearTimeout(tVec); tVec = setTimeout(() => { rehVec = true; try { for (const q of E.piezas) if (objs.has(q.id) && (q.t === 'calle' || (q.t === 'terreno' && /pasto|monte/.test(q.mat || '')))) rehacer(q); } finally { rehVec = false; } }, 900); }
  // cada app muestra su parte del plano; lo que no muestra queda guardado tal cual para la app que lo usa
  const veo = p => ve(app, p);
  function ocultas() { const c = {}; for (const p of E.piezas) if (!veo(p)) c[dominio(p)] = (c[dominio(p)] || 0) + 1; const t = Object.entries(c).map(([k, n]) => `${n} de ${DOMINIOS[k]}`).join(' y '), el = $('#mocultos'); if (!el) return;
    el.hidden = !t; el.textContent = t ? `Este plano también tiene ${t}${c.equipos ? ' (se ven en Ondi)' : ''}. Acá no se muestran y no se tocan.` : ''; }
  function armarTodo() { for (const g of objs.values()) { mundo.remove(g); limpiar(g); } objs.clear(); ocultas(); for (const p of E.piezas) { if (!veo(p)) continue; const g = armarPieza(p, ctx); if (g) { objs.set(p.id, g); mundo.add(g); aplicarCapas(g); if (g.userData.anima) { POSE.delete(p.id); mover(p); } } } pintaSuelo(); etiquetas(); capasLugar(); revisarTr(); motor.dirty = true; }
  function limpiar(g) { g.traverse(k => { if (k.geometry && !k.geometry.parameters?.width && k.geometry.type !== 'BoxGeometry' && k.geometry.type !== 'CylinderGeometry' && k.geometry.type !== 'IcosahedronGeometry' && k.geometry.type !== 'ConeGeometry') k.geometry.dispose(); }); }
  const capas = Object.fromEntries(CAPAS.map(([k]) => [k, true])); // lo que cada uno apaga queda recordado en su navegador
  try { const g = JSON.parse(localStorage.getItem('motor.capas.' + app) || '{}'); for (const k in capas) if (g[k] === false) capas[k] = false; } catch (e) {}
  for (const c of raiz.querySelectorAll('[data-capa]')) c.checked = capas[c.dataset.capa] !== false;
  const LUG = new Set();   // lugares cuyas puertas están ocultas
  const PEL = { k: 0, max: 99 }, nivelTope = () => E.piezas.reduce((m, p) => conPlanta(p.t) && p.t !== 'plano' ? Math.max(m, nivelDe(p)) : m, 0);
  const PL = { act: 0 }, NACEN = new Set(), conPlanta = t => t === 'plano' || !!(TIPOS[t] && TIPOS[t].g !== 'Terreno');
  const plAct = () => motor.caminando ? 0 : PL.act;   // a pie se está en planta baja: todavía no hay escalera de interior
  const enPlanta = p => { if (!p || !conPlanta(p.t)) return true; const n = nivelDe(p); return p.t === 'plano' ? n === plAct() : ED.on ? n <= plAct() : n <= PEL.max; };
  const elegible = p => !ED.on || !p || (conPlanta(p.t) ? nivelDe(p) === plAct() : plAct() === 0);
  function aplicarCapas(g) { const T = g.userData.tipo, p = g.userData.pieza; g.visible = capas[(p && CAPA_DE[p.t]) || T.capa] !== false && !(T.vivo && LUG.size && LUG.has(lugarPuerta(p))) && enPlanta(p); g.traverse(k => { if (k.userData.techo) k.visible = capas.techos; if (k.userData.campo) k.visible = capas.campos; if (k.userData.interior) k.visible = !capas.techos; }); }
  motor.alTema.push(() => { armarTodo(); });
  function encuadre() { const b = new THREE.Box3(); for (const p of E.piezas) { const [x, z] = centro(p); if (p.pts) for (const q of p.pts) b.expandByPoint(new THREE.Vector3(q[0], 0, q[1])); else b.expandByPoint(new THREE.Vector3(x, 0, z)); }
    if (b.isEmpty()) return { tx: 0, tz: 0, yaw: 0.7, pitch: 0.75, d: 160 }; const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return { tx: c.x, tz: c.z, yaw: 0.7, pitch: 0.72, d: Math.max(60, Math.max(s.x, s.z) * 1.05) }; }

  // ---------- etiquetas (nombres de filas, galpones y equipos) ----------
  let TR = null, trT = 0; const revisarTr = () => { if (!TR) return; clearTimeout(trT); trT = setTimeout(() => TR.revisar(), 500); };
  let etq = []; const subt = new Map(); // subt: renglón chico debajo del nombre (por ejemplo, andenes ocupados de una nave)
  function subtitulo(id, txt) { if ((subt.get(id) || '') === (txt || '')) return; if (txt) subt.set(id, txt); else subt.delete(id); const e = etq.find(q => q.p.id === id); if (!e) return; let sm = e.el.querySelector('small'); if (!txt) { if (sm) sm.remove(); } else { if (!sm) { sm = document.createElement('small'); e.el.appendChild(sm); } sm.textContent = txt; } e.w = 0; motor.dirty = true; }
  function etiquetas() { lbl.innerHTML = ''; etq = [];
    for (const p of E.piezas) { const T = TIPOS[p.t]; if (!T || !T.etiqueta || !veo(p)) continue; const txt = T.etiqueta({ ...T.def, ...p }); if (!txt && !T.equipo) continue;
      const el = document.createElement('button'); el.tabIndex = -1; rotulo(el, p, T, txt); el.addEventListener('click', () => elegir(p, true)); lbl.appendChild(el);
      const [x, z] = centro(p); etq.push({ p, el, v: new THREE.Vector3(x, altoDe(p) + nivelDe(p) * ALTO_PLANTA + (T.equipo ? 0.25 : T.vivo ? 0 : 2), z), eq: !!(T.equipo || T.vivo), cap: T.capa, siempre: !!T.siempre }); }
    motor.dirty = true; }
  function rotulo(el, p, T, txt) { if (T.vivo) { const v = vivoDe(p), quien = v.ev && v.hasta > Date.now() ? (v.ev === 'pasa' ? v.quien || 'Pasó' : 'Rechazado') : '';
      el.className = 'metq eq pu ' + pest(v.estado)[1] + (quien ? ' ' + v.ev : ''); el.innerHTML = `<i></i><span>${esc(txt || T.n)}</span>${quien ? `<small>${esc(quien)}</small>` : ''}`; return; }
    el.className = 'metq' + (T.equipo ? ' eq ' + ctx.estado(p) : ''); el.innerHTML = T.equipo ? `<i></i><span>${esc(txt || T.n)}</span>` : `<span>${esc(txt)}</span>${subt.get(p.id) ? `<small>${esc(subt.get(p.id))}</small>` : ''}`; }
  function rotulos(id) { for (const e of etq) if (e.p.puerta === id) { const T = TIPOS[e.p.t]; rotulo(e.el, e.p, T, T.etiqueta({ ...T.def, ...e.p })); e.w = 0; } motor.dirty = true; }
  let lejosAntes = null;
  motor.despues.push(() => { const d = motor.C.d, lejos = d > 75, w = canvas.clientWidth, h = canvas.clientHeight, pase = RC.R.on; lbl.classList.toggle('lejos', lejos); if (lejos !== lejosAntes) { lejosAntes = lejos; for (const e of etq) e.w = 0; }
    const tope = ED.on ? 0 : Math.min(PEL.max, nivelTope());   /* mirando: los nombres de un piso de abajo que queda bajo la losa de uno de arriba no se muestran (si no, se pisan con los de arriba) */
    const losas = tope ? E.piezas.filter(q => q.t === 'recinto' && q.piso !== 'sin' && q.pts && nivelDe(q) > 0 && nivelDe(q) <= tope) : [];
    const tapado = p => { if (!losas.length || !conPlanta(p.t)) return false; const n = nivelDe(p), c = centro(p); return losas.some(q => nivelDe(q) > n && dentroDe(c, q.pts)); };
    for (const e of etq) { const g = objs.get(e.p.id), vis = capas.etiquetas && g && g.visible && !e.p._p && !(ED.on && PL.act && conPlanta(e.p.t) && nivelDe(e.p) < PL.act) && !tapado(e.p);   /* editando arriba, los nombres de abajo no tapan */ if (!vis) { e.fuera = true; continue; }
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
  // varias piezas a la vez: con la herramienta «Elegir varias» (o Mayús / ⌘ / Ctrl + clic con la mano) se suman; un recuadro en el piso elige todo lo que cae adentro; al arrastrar una, se mueven todas
  const MULTI = new Set(), cajasM = new THREE.Group(); motor.scene.add(cajasM); let recuadro = null; const modif = e => !!(e && (e.shiftKey || e.metaKey || e.ctrlKey));
  function marcarMulti() { while (cajasM.children.length) cajasM.remove(cajasM.children[0]); for (const q of [...MULTI]) { const g = objs.get(q.id); if (!g || !E.piezas.includes(q)) { MULTI.delete(q); continue; } cajasM.add(new THREE.Box3Helper(cajaDe(g, new THREE.Box3()).expandByScalar(0.12), 0xf5a524)); } cajasM.visible = true; motor.dirty = true; }
  const soltarMulti = () => { if (MULTI.size) { MULTI.clear(); marcarMulti(); } }, cuantas = () => MULTI.size + (MULTI.size === 1 ? ' pieza elegida' : ' piezas elegidas') + ' · arrastrá una para moverlas juntas';
  let SEL = null; const caja = new THREE.Box3Helper(new THREE.Box3(), 0x1d9bf0), cajaH = new THREE.Box3Helper(new THREE.Box3(), 0x8ecbff); caja.visible = cajaH.visible = false; motor.scene.add(caja, cajaH);
  const UI = { abierta: false }; try { UI.abierta = localStorage.getItem('motor.ficha') === '1'; } catch (e) {}
  // la caja de lo elegido no cuenta el campo de visión ni el aro del piso (si no, una cámara queda adentro de una caja enorme)
  const cajaDe = (g, b) => { b.makeEmpty(); g.updateMatrixWorld(true); g.traverse(m => { if (m.isMesh && m.visible && !m.userData.campo && !m.userData.noPica && m !== g.userData.aro) b.expandByObject(m); }); return b; };
  function marcar() { const g = SEL && objs.get(SEL.id); caja.visible = !!g && !(TIPOS[SEL.t].forma !== 'punto' && ED.on); if (g) cajaDe(g, caja.box).expandByScalar(0.15); puntos(); motor.dirty = true; }
  function elegir(p, enfocar) { if (!p) soltarMulti(); SEL = p; CON.alElegir(p); marcar(); info(); if (enfocar && p) { const [x, z] = centro(p); motor.ir({ tx: x, tz: z, d: Math.min(motor.C.d, TIPOS[p.t].equipo ? 45 : 140) }); } }
  // un equipo chico y lejos (un AP en el techo de un galpón) casi no tiene superficie para el rayo: se acepta el equipo cuyo centro cae cerca del toque en pantalla
  const _v = new THREE.Vector3(), _bb = new THREE.Box3();
  function equipoCerca(cx, cy, px = 34) { const r = canvas.getBoundingClientRect(); let mejor = null, md = px;
    for (const g of objs.values()) { const p = g.userData.pieza; if (!p || !g.visible || !TIPOS[p.t] || !TIPOS[p.t].equipo) continue; _bb.setFromObject(g); if (_bb.isEmpty()) continue; _bb.getCenter(_v);
      if (_v.distanceTo(motor.cam.position) > 90) continue; _v.project(motor.cam); if (_v.z > 1) continue;
      const d = Math.hypot(r.left + (_v.x + 1) / 2 * r.width - cx, r.top + (1 - _v.y) / 2 * r.height - cy); if (d < md) { md = d; mejor = p; } } return mejor; }
  function hallar(e) { const hit = motor.tocar(e.clientX, e.clientY, [...objs.values()].filter(g => g.visible && elegible(g.userData.pieza))); for (const h of hit) { const g = h.object.userData.dueño; if (g && g.visible) { if (h.object.userData.campo || g.userData.pieza._p || (!ED.on && g.userData.tipo.fondo)) continue; return { p: g.userData.pieza, h }; } } return null; }
  function info() { const box = $('#minfo'); if (!SEL) { box.hidden = true; return; } const T = TIPOS[SEL.t], q = { ...T.def, ...SEL }, cerrar = `<button class="mx" data-sel="no" aria-label="Cerrar">${svg('cerrar', 16)}</button>`;
    box.hidden = false; box.classList.toggle('abierta', UI.abierta); const propia = ED.on && puede && CON.ficha(); if (propia) { box.classList.add('abierta'); box.innerHTML = propia; return; }
    const d = SEL.uid && EQ.porUid.get(SEL.uid), est = T.equipo ? ctx.estado(SEL) : null, g = objs.get(SEL.id);
    const doc = T.protegido && host && host.abrirDoc ? `<button class="mic" data-acc="doc" title="Abrir su documentación (equipos, bocas y cables)" aria-label="Abrir documentación">${svg('doc')}</button>` : '';
    const mas = n => `<button class="mic" data-acc="mas" aria-expanded="${UI.abierta}" title="${n}" aria-label="${n}">${svg(ED.on ? 'ajustes' : 'abajo')}</button>`;
    if (ED.on && puede) { const conNombre = T.campos.some(c => c.k === 'nombre');
      box.innerHTML = `<div class="mfila"><div class="mtit"><small>${esc(T.n)}${SEL.t === 'recinto' ? ' · ' + fmt(Math.abs(areaSig(SEL.pts))) + ' m²' : ''}</small>${conNombre ? `<input class="mnom" data-k="nombre" value="${esc(q.nombre || '')}" placeholder="Nombre" aria-label="Nombre"${q.candado ? ' readonly' : ''}>` : ''}</div>
        <button class="mic${(q.candado || q.fijo) ? ' trabada' : ''}" data-acc="candado" aria-pressed="${!!(q.candado || q.fijo)}" title="${(q.candado || q.fijo) ? 'Tiene candado: no se mueve, no gira, no se borra ni se cambia. Tocá para sacarlo' : 'Poner candado: queda fija (no se mueve, no gira ni se borra)'}" aria-label="${(q.candado || q.fijo) ? 'Sacar candado' : 'Poner candado'}">${svg('candado')}</button>${(q.candado || q.fijo) ? `${doc}${cerrar}</div><p class="mtrab">Con candado: no se mueve ni se cambia. Tocá el candado para editarla.</p>` : `${T.archivo ? `<button class="mic" data-acc="medir" title="Ajustar la escala: medir algo que conozcas" aria-label="Ajustar la escala">${svg('regla')}</button><button class="mic" data-acc="imagen" title="Cambiar la imagen" aria-label="Cambiar la imagen">${svg('imagen')}</button><button class="mic" data-acc="contorno" title="Dibujar el contorno del edificio en esta planta: salen el piso y las paredes de afuera" aria-label="Dibujar el contorno">${svg('paredes')}</button>` : ''}${T.forma === 'linea' ? `<button class="mic" data-acc="seguir" title="Seguir dibujando desde la punta" aria-label="Seguir dibujando">${svg('editar')}</button>` : ''}<button class="mic" data-acc="girar" title="Girar 90° (R) · o arrastrá la manija naranja" aria-label="Girar 90°">${svg('girar')}</button>${T.archivo ? '' : `<button class="mic" data-acc="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">${svg('duplicar')}</button>`}${doc}<button class="mic peligro" data-acc="borrar" title="Sacar (Supr)${T.protegido ? ': pide la clave' : ''}" aria-label="Sacar">${svg(T.protegido ? 'candado' : 'borrar')}</button>${mas('Propiedades')}${cerrar}</div>`}
        ${q.candado ? '' : `<div class="mmas"><div class="mform">${T.campos.filter(c => c.k !== 'nombre').map(c => campo(c, q)).join('')}${T.equipo && EQ.lista.length ? vinculo(q) : ''}${T.vivo && host && host.puertas ? vinculoPuerta(q) : ''}${T.equipo && !q.uid && host && host.crearEquipo ? `<button class="mbtn" data-acc="alta">${svg('mas', 16)}Sumarlo a la lista de equipos del cliente</button>` : ''}${SEL.t === 'galpon' && q.estilo === 'logistico' ? `<p class="mtrab">En el frente: arrastrá las manijas para correr andenes, portones y puertas; doble clic saca.</p><div class="mfila2"><button class="mbtn" data-acc="fachada" data-v="puerta">+ Puerta de personal</button><button class="mbtn" data-acc="fachada" data-v="nivel">+ Portón a nivel</button><button class="mbtn" data-acc="fachada" data-v="anden">+ Andén</button><button class="mbtn" data-acc="fachada" data-v="simple">+ Portón sin rampa</button><button class="mbtn" data-acc="fachada" data-v="rampa">+ Rampa</button></div>` : ''}${SEL.t === 'losas' ? `<p class="mtrab">${(q.celdas || []).length} cuadros de ${q.celda || 5} m · ${fmt((q.celdas || []).length * (q.celda || 5) ** 2)} m²${q.mat === 'estacionamiento' ? ` · <b>entran ${cajones(q).n} autos</b> (cajones de 2,5 × 5 m, pasillo de 6 m)` : ''}</p><button class="mbtn" data-acc="pintar">${svg('editar', 16)}Pintar más en este piso</button><button class="mbtn" data-acc="separar">${svg('duplicar', 16)}Separar en partes sueltas</button>` : ''}</div></div>`}`; return; }
    if (T.vivo) { const v = vivoDe(SEL), [tx, cl] = pest(v.estado), dr = SEL.puerta && PU.porId.get(SEL.puerta), puede2 = host && host.abrir && SEL.puerta && !['caida', 'sin'].includes(v.estado);
      const ult = v.at ? `${v.ev === 'pasa' ? esc(v.quien || 'Alguien pasó') : 'Rechazo'} · ${new Date(v.at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}` : '';
      const filas2 = [['Estado', `<span class="mpill ${cl}">${tx}</span>`], ['Último movimiento', ult], ['Equipo', esc(dr && dr.equipo)], ['Dónde', esc(lugarPuerta(SEL))], ['Notas', esc(q.notas)]].filter(f => f[1]);
      box.innerHTML = `<div class="mfila"><i class="mest ${cl}" title="${tx}"></i><div class="mtit"><b>${esc(q.nombre || T.n)}</b><small>${esc((ACCESOS.find(a => a[0] === q.clase) || ACCESOS[0])[1])}</small></div>${puede2 ? `<button class="mic abre${ARMA.id === SEL.id && ARMA.hasta > Date.now() ? ' arma' : ''}" data-acc="abrir" title="${ARMA.id === SEL.id && ARMA.hasta > Date.now() ? 'Tocá de nuevo para abrir' : 'Abrir a distancia'}" aria-label="Abrir a distancia">${svg('abrir')}</button>` : ''}<button class="mic" data-acc="enfocar" title="Enfocar" aria-label="Enfocar">${svg('enfocar')}</button>${mas('Más datos')}${cerrar}</div>
        <div class="mmas"><dl class="mdl">${filas2.map(([k, v2]) => `<div><dt>${k}</dt><dd>${v2}</dd></div>`).join('')}</dl></div>`; return; }
    const filas = (T.equipo ? [['Estado', `<span class="mpill ${est}">${ESTX[est]}</span>`], ['Modelo', esc((d && d.modelo) || q.modelo)], ['IP', esc((d && d.ip) || q.ip)], ['MAC', esc((d && d.mac) || q.mac)], ['Altura', q.y != null ? q.y + ' m' : ''], ['Dónde', esc(lugarDe(SEL))], ['Notas', esc(q.notas)]]
      : SEL.t === 'fila' ? [['Contenedores', g && g.userData.cuenta], ['Tipo', q.carga === 'reefer' ? 'Refrigerados' : 'Secos'], ['Medida', q.pies + ' pies'], ['Ancho', q.ancho + ' contenedores'], ['Alto máximo', q.alto], ['Largo', q.largo + ' m']]
      : [...(SEL.t === 'recinto' ? [['Superficie', fmt(Math.abs(areaSig(SEL.pts))) + ' m²']] : []), ...T.campos.filter(c => !['nombre', 'x', 'z', 'r'].includes(c.k) && q[c.k] !== undefined && q[c.k] !== '' && c.t !== 'color').map(c => [c.n, c.t === 'sel' ? esc((c.ops.find(z => z[0] == q[c.k]) || [, q[c.k]])[1]) : c.t === 'bool' ? (q[c.k] ? 'Sí' : 'No') : esc(q[c.k])])]).filter(f => f[1] !== undefined && f[1] !== '' && f[1] !== null);
    const sub = T.equipo ? [T.n.replace(/ \(.*/, ''), (d && d.modelo) || q.modelo, (d && d.ip) || q.ip].filter(Boolean).join(' · ') : T.n;
    box.innerHTML = `<div class="mfila">${T.equipo ? `<i class="mest ${est}" title="${ESTX[est]}"></i>` : ''}<div class="mtit"><b>${esc(q.nombre || (d && d.nombre) || T.n)}</b><small>${esc(sub)}</small></div>${SEL.t === 'camara' ? `<button class="mic" data-acc="ver" title="Ver desde esta cámara" aria-label="Ver desde esta cámara">${svg('ojo')}</button>` : ''}<button class="mic" data-acc="enfocar" title="Enfocar" aria-label="Enfocar">${svg('enfocar')}</button>${doc}${filas.length ? mas('Más datos') : ''}${cerrar}</div>
      <div class="mmas"><dl class="mdl">${filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`; }
  function campo(c, q) { const v = q[c.k] ?? '', id = 'f_' + c.k;
    if (c.t === 'sel') return `<label><span>${c.n}</span><select id="${id}" data-k="${c.k}">${c.ops.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
    if (c.t === 'bool') return `<label class="msw"><span>${c.n}</span><input id="${id}" type="checkbox" data-k="${c.k}" ${v ? 'checked' : ''}><i></i></label>`;
    if (c.t === 'color') return `<label><span>${c.n}</span><span class="mcol"><input id="${id}" type="color" data-k="${c.k}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'}">${c.k === 'carga' || c.k === 'color' && !v ? `<button class="mbtn chico" data-sin="${c.k}">Sin</button>` : ''}</span></label>`;
    if (c.t === 'area') return `<label><span>${c.n}</span><textarea id="${id}" data-k="${c.k}" rows="2">${esc(v)}</textarea></label>`;
    if (c.t === 'ang') return `<label><span>${c.n}</span><input id="${id}" type="number" step="15" data-k="${c.k}" data-ang="1" value="${Math.round((+v || 0) * 180 / Math.PI)}"></label>`;
    return `<label><span>${c.n}</span><input id="${id}" ${c.t === 'num' ? `type="number" inputmode="decimal" step="${c.paso || 1}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''}` : 'type="text"'} data-k="${c.k}" value="${esc(v)}"${c.ph ? ` placeholder="${esc(String(c.ph(q)))}"` : ''}></label>`; }
  function vinculoPuerta(q) { const usadas = new Set(E.piezas.filter(p => p.puerta && p !== SEL).map(p => p.puerta));
    return `<label><span>Puerta real</span><select data-k="puerta"><option value="">Sin enlazar</option>${PU.lista.filter(d => !usadas.has(d.id) || d.id === q.puerta).map(d => `<option value="${esc(d.id)}" ${d.id === q.puerta ? 'selected' : ''}>${esc(d.nombre)}${d.equipo ? ' · ' + esc(d.equipo) : ''}</option>`).join('')}</select></label>`; }
  function vinculo(q) { const usados = new Set(E.piezas.filter(p => p.uid && p !== SEL).map(p => p.uid));
    return `<label><span>Equipo real</span><select data-k="uid"><option value="">Sin vincular</option>${EQ.lista.filter(d => !usados.has(d.uid) || d.uid === q.uid).map(d => `<option value="${esc(d.uid)}" ${d.uid === q.uid ? 'selected' : ''}>${esc(d.nombre)}${d.ip ? ' · ' + esc(d.ip) : ''}</option>`).join('')}</select></label>`; }
  // la ficha se arrastra de su fila de arriba (no de los botones ni del nombre) y queda donde se la deja, dentro de la pantalla
  (() => { const box = $('#minfo'); let D = null; const pos = () => { if (innerWidth <= 860) { box.style.left = box.style.top = box.style.right = ''; return; } try { const q = JSON.parse(localStorage.getItem('motor.ficha.pos') || 'null'); if (q && innerWidth > 860) { box.style.left = Math.max(4, Math.min(innerWidth - 120, q[0])) + 'px'; box.style.top = Math.max(4, Math.min(innerHeight - 80, q[1])) + 'px'; box.style.right = 'auto'; } } catch (e) {} }; pos(); addEventListener('resize', pos);
    box.addEventListener('pointerdown', e => { if (innerWidth <= 860 || !e.target.closest('.mfila') || e.target.closest('button,input,select,textarea,a')) return; const r = box.getBoundingClientRect(); D = { dx: e.clientX - r.left, dy: e.clientY - r.top }; box.classList.add('llevando'); try { box.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
    box.addEventListener('pointermove', e => { if (!D) return; const x = Math.max(4, Math.min(innerWidth - 120, e.clientX - D.dx)), y = Math.max(4, Math.min(innerHeight - 80, e.clientY - D.dy)); box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.right = 'auto'; });
    box.addEventListener('pointerup', () => { if (!D) return; D = null; box.classList.remove('llevando'); try { localStorage.setItem('motor.ficha.pos', JSON.stringify([parseInt(box.style.left), parseInt(box.style.top)])); } catch (e) {} });
    box.addEventListener('dblclick', e => { if (!e.target.closest('.mfila') || e.target.closest('button,input')) return; box.style.left = box.style.top = box.style.right = ''; try { localStorage.removeItem('motor.ficha.pos'); } catch (er) {} }); })();
  $('#minfo').addEventListener('input', e => { if (CON.entrada(e.target)) return; const el = e.target.closest('[data-k]'); if (!el || !SEL || SEL.candado) return; let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : +el.value) : el.value; if (el.dataset.ang) v = (+el.value || 0) * Math.PI / 180;
    if (el.dataset.k === 'uid') { const d = EQ.porUid.get(v); if (d) Object.assign(SEL, { nombre: d.nombre, modelo: d.modelo || SEL.modelo, ip: d.ip || SEL.ip, mac: d.mac || SEL.mac }); }
    if (el.dataset.k === 'puerta') { const d = PU.porId.get(v); if (d) SEL.nombre = d.nombre; }
    if (el.dataset.k === 'nivel') v = +v || 0;
    if (v === null || v === '') delete SEL[el.dataset.k]; else SEL[el.dataset.k] = v;
    if (el.dataset.k === 'nivel') { const p = SEL; setTimeout(() => { if (nivelDe(p) !== PL.act) { planta(nivelDe(p), false); elegir(p); } verPlantas(); toast(`${p.nombre || TIPOS[p.t].n}: ${NOM_PLANTA(nivelDe(p))}`); }, 0); }
    if (MEDIDAS.includes(el.dataset.k) && typeof v === 'number') { try { const M2 = JSON.parse(localStorage.getItem('motor.medidas') || '{}'), k = SEL.t + (SEL.estilo ? ':' + SEL.estilo : ''); M2[k] = { ...(M2[k] || {}), [el.dataset.k]: v }; localStorage.setItem('motor.medidas', JSON.stringify(M2)); } catch (er) {} } rehacer(SEL); cambio(true, el.type === 'text' || el.tagName === 'TEXTAREA'); if (el.dataset.k === 'uid' || el.dataset.k === 'puerta' || el.tagName === 'SELECT') info(); if (el.dataset.k === 'puerta') { capasLugar(); if (!$('#meq').hidden) listaPuertas(); } });
  $('#minfo').addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.sel === 'no') { CON.sub = null; elegir(null); return; } if (b.dataset.c) { CON.accion(b); return; } if (b.dataset.sin) { delete SEL[b.dataset.sin]; SEL[b.dataset.sin] = ''; rehacer(SEL); cambio(); info(); return; }
    const a = b.dataset.acc; if (a === 'ver') { if (RC.R.on) RC.paseo(false); XT.verCamara(SEL); return; }
    if (a === 'mas') { UI.abierta = !UI.abierta; try { localStorage.setItem('motor.ficha', UI.abierta ? '1' : '0'); } catch (er) {} $('#minfo').classList.toggle('abierta', UI.abierta); b.setAttribute('aria-expanded', UI.abierta); return; }
    if (a === 'alta') { const T = TIPOS[SEL.t], p = SEL; if (!p.nombre) { toast('Ponele un nombre primero'); return; } b.disabled = true;
      try { const r = await host.crearEquipo({ marca: p.marca || 'otra', tipo: T.ondi || 'otro', nombre: p.nombre, modelo: p.modelo || null, ip: p.ip || null, ubicacion: lugarDe(p), notas: p.notas || null });
        p.uid = 'man:' + r.id; await leerEquipos(true); rehacer(p); cambio(); info(); toast('Equipo sumado a la lista del cliente'); } catch (er) { b.disabled = false; toast('No se pudo: ' + ((er && er.message) || er)); } return; }
    // abrir a distancia: el primer toque arma (3 s) y el segundo abre; queda armado aunque la ficha se redibuje por algo que llegó en vivo
    if (a === 'abrir') { if (!(ARMA.id === SEL.id && ARMA.hasta > Date.now())) { ARMA = { id: SEL.id, hasta: Date.now() + 3000 }; info(); toast('Tocá de nuevo para abrir'); setTimeout(() => { if (ARMA.hasta <= Date.now()) { ARMA = {}; if (SEL) info(); } }, 3050); return; }
      const id = SEL.puerta; ARMA = {}; b.disabled = true; try { await host.abrir(id); toast('Puerta abierta'); } catch (er) { toast((er && er.message) || 'No se pudo abrir'); } finally { b.disabled = false; if (SEL) info(); } return; }
    if (a === 'medir') { medir(SEL); return; } if (a === 'contorno') { const n = nivelDe(SEL); if (n !== PL.act) planta(n, false); CON.empezar('pared', 'contorno'); return; } if (a === 'imagen') { cambiarImagen = SEL; $('#mimg').click(); return; }
    if (a === 'fachada') { ED.fach = { p: SEL, k: b.dataset.v }; hint(`<b>${b.textContent.replace('+ ', '')}</b>: tocá en el frente del galpón dónde va · <kbd>Esc</kbd> cancela`); return; }
    if (a === 'pintar') { CON.empezar('piso'); return; }
    if (a === 'separar') { const P = SEL, C = P.celdas || [], vis = new Set(), partes = []; const k = q => q[0] + ',' + q[1], hay = new Map(C.map(q => [k(q), q]));
      for (const q of C) { if (vis.has(k(q))) continue; const pila = [q], parte = []; vis.add(k(q)); while (pila.length) { const c = pila.pop(); parte.push(c); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c[0] + di, c[1] + dj], kn = k(n); if (hay.has(kn) && !vis.has(kn)) { vis.add(kn); pila.push(hay.get(kn)); } } } partes.push(parte); }
      if (partes.length < 2) { toast('Es un solo sector: no hay partes sueltas'); return; } P.celdas = partes[0]; rehacer(P); for (const pa of partes.slice(1)) { const n2 = { ...JSON.parse(JSON.stringify(P)), id: nuevoId('losas'), celdas: pa }; delete n2.nombre; E.piezas.push(n2); rehacer(n2); } cambio(); info(); toast(`Separado en ${partes.length} partes`); return; }
    if (a === 'candado') { if (SEL.candado || SEL.fijo) { delete SEL.candado; delete SEL.fijo; } else SEL.candado = true; cambio(); info(); puntos(); toast(SEL.candado ? 'Con candado: queda fija' : 'Sin candado: se puede editar'); return; } if (a === 'seguir') { seguirLinea(SEL); return; } if (a === 'enfocar') elegir(SEL, true); if (a === 'duplicar') duplicar(); if (a === 'borrar') sacar(SEL); if (a === 'girar') girarSel(Math.PI / 2); if (a === 'doc') host.abrirDoc(SEL); });

  // ---------- capas, buscar, vista, pantalla completa ----------
  $('#bcapas').onclick = () => { $('#mcapas').hidden = !$('#mcapas').hidden; };
  $('#mcapas').addEventListener('change', e => { const L = e.target.dataset.lugar; if (L != null) { if (e.target.checked) LUG.delete(L); else LUG.add(L); for (const g of objs.values()) aplicarCapas(g); if (RC.R.on) RC.obstaculos(); motor.dirty = true; return; } const k = e.target.dataset.capa; capas[k] = e.target.checked; try { localStorage.setItem('motor.capas.' + app, JSON.stringify(capas)); } catch (err) {} if (k === 'transito') { if (TR) TR.ver(capas[k]); return; } for (const g of objs.values()) aplicarCapas(g); motor.dirty = true; });
  $('#mcapas').addEventListener('click', e => { const b = e.target.closest('[data-pared]'); if (b) paredes(b.dataset.pared); const pe = e.target.closest('[data-pelar]'); if (pe) pelar(+pe.dataset.pelar); const cl = e.target.closest('[data-clima]'); if (cl) XT.ponerClima(cl.dataset.clima); const f = e.target.closest('[data-ir]'); if (f) irLugar(f.dataset.ir); });
  // las puertas agrupadas por lugar (el galpón, la oficina o la zona donde están): se muestran u ocultan por lugar y se puede ir a cada uno
  function capasLugar() { const box = $('#mlug'); if (!box) return; const c = new Map(); for (const p of E.piezas) if (TIPOS[p.t] && TIPOS[p.t].vivo && veo(p) && !p._p) { const L = lugarPuerta(p); c.set(L, (c.get(L) || 0) + 1); }
    for (const L of [...LUG]) if (!c.has(L)) LUG.delete(L);
    box.innerHTML = c.size > 1 || (c.size === 1 && ![...c.keys()].includes(E.nombre)) ? `<h5>Puertas por lugar</h5>${[...c].sort((a, b) => (a[0] === E.nombre) - (b[0] === E.nombre) || a[0].localeCompare(b[0], 'es')).map(([L, n]) => `<div class="mlugar"><button data-ir="${esc(L)}" title="Ir a ${esc(L === E.nombre ? 'la vista general' : L)}" aria-label="Ir a ${esc(L === E.nombre ? 'la vista general' : L)}">${svg('enfocar', 16)}</button><label class="msw"><span>${esc(L === E.nombre ? 'Fuera de los edificios' : L)}<small>${n} ${n > 1 ? 'puertas' : 'puerta'}</small></span><input type="checkbox" data-lugar="${esc(L)}" ${LUG.has(L) ? '' : 'checked'}><i></i></label></div>`).join('')}` : ''; }
  function irLugar(L) { const q = E.piezas.find(p => p.nombre === L && ['galpon', 'modulo', 'edificio', 'alero', 'recinto'].includes(p.t)); if (!q) { motor.vista(); return; } const [x, z] = centro(q), v = { ...TIPOS[q.t].def, ...q };
    const tam = q.pts ? Math.max(...q.pts.map(k => Math.hypot(k[0] - x, k[1] - z))) * 2 : Math.max(v.ancho || 10, v.fondo || 10); motor.ir({ tx: x, tz: z, d: Math.max(18, tam * 1.3) }); }
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
  // cuadrícula de referencia (F la prende, G la apaga): alrededor de donde se mira, en el color de la app, líneas de 1 m, 5 m y 25 m.
  // Va un poco arriba del terreno que hay en ese punto (así no la tapa un piso de hormigón ni la playa en altura) y se desvanece hacia los bordes.
  const grilla = (() => { const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
      uniforms: { cen: { value: new THREE.Vector2() }, rad: { value: 60 }, col: { value: new THREE.Color('#0b5fff') }, fino: { value: 1 } },
      vertexShader: 'varying vec2 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec2 cen; uniform float rad; uniform vec3 col; uniform float fino; varying vec2 vP;
        float linea(float paso) { vec2 q = vP / paso, g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-4)); return 1.0 - min(min(g.x, g.y), 1.0); }
        void main() { float f = 1.0 - smoothstep(0.5, 1.0, length(vP - cen) / rad); float a = max(max(linea(25.0) * 0.9, linea(5.0) * 0.6), linea(1.0) * 0.32 * fino) * f; if (a < 0.01) discard; gl_FragColor = vec4(col, a); }` });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m); g.renderOrder = 2; g.frustumCulled = false; g.visible = false; motor.scene.add(g); return g; })();
  motor.cada.push(() => { if (!grilla.visible) return false; const C = motor.C, U = grilla.material.uniforms, rad = RC.R.on ? 30 : Math.max(20, Math.min(320, C.d * 0.9)), y = (motor.pisoY || Math.max(0, motor.cota ? motor.cota(C.tx, C.tz) : 0)) + 0.08;
    grilla.position.set(C.tx, y, C.tz); grilla.scale.set(rad * 2.2, 1, rad * 2.2); U.cen.value.set(C.tx, C.tz); U.rad.value = rad; U.fino.value = Math.max(0, Math.min(1, 1 - (C.d - 45) / 90));
    const ac = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(); if (ac && ac !== grilla.userData.ac) { grilla.userData.ac = ac; U.col.value.set(ac); } return false; });
  // lo que se guarda y se deshace nunca lleva lo que todavía se está ubicando (piezas y aberturas marcadas con _p)
  const limpio = () => JSON.stringify(E.piezas.filter(p => !p._p), (k, v) => k === '_col' ? undefined : k === 'huecos' && Array.isArray(v) ? v.filter(h => !h._p) : v);
  const undo = [], redo = []; let foto = limpio();
  function cambio(guardarYa = true, escribiendo) { if (SEL && !escribiendo && pegarAlCerco(SEL)) rehacer(SEL); const ahora = limpio(); if (ahora === foto) return; revisarTr(); capasLugar(); if (SEL && SEL.t === 'escaleraInt') losaArriba(SEL); if (!escribiendo || !undo.length || undo[undo.length - 1].t < Date.now() - 1500) undo.push({ s: foto, t: Date.now() }); if (undo.length > 80) undo.shift(); redo.length = 0; foto = ahora; if (guardarYa) guardar(); if (RC.R.on) { clearTimeout(cambio.t); cambio.t = setTimeout(() => RC.R.on && RC.obstaculos(), 250); } }
  function volver(de, a) { if (!de.length) { toast(de === undo ? 'No hay nada para deshacer' : 'No hay nada para rehacer'); return; } CON.cancelar(); cancelar(true); a.push({ s: foto, t: 0 }); foto = de.pop().s; E.piezas = JSON.parse(foto); SEL = SEL && E.piezas.find(p => p.id === SEL.id) || null; armarTodo(); CON.alElegir(SEL); marcar(); info(); guardar(); }
  function editar(on) { if (!puede) return; if (!on && MED.p) finMedir(); ED.on = on; motor.editando = on; document.documentElement.classList.toggle('editando', on); $('#mtool').hidden = !on; $('#bedit').setAttribute('aria-pressed', on); $('#bedit').querySelector('span').textContent = on ? 'Listo' : 'Editar';
    if (on) { ED.grilla = true; $('#bgrid').setAttribute('aria-pressed', true); }   // al entrar a editar la cuadrícula aparece siempre (G la apaga)
    grilla.visible = on && ED.grilla; cuadricula = on && ED.grilla; pintaSuelo(); if (!on) { cancelarAgarre(); CON.cancelar(); cancelar(true); $('#mcat').hidden = true; $('#meq').hidden = true; menu(null); hint(''); } else herramienta('mano'); verPlantas(); CON.marcar(); marcar(); info(); motor.dirty = true; motor.alEditar && motor.alEditar(on); }
  if (puede) $('#bedit').onclick = () => editar(!ED.on);
  const PISTA = { varias: '<b>Elegir varias</b>: tocá las piezas para sumarlas o arrastrá un recuadro en el piso. Después arrastrá cualquiera de las elegidas y se mueven todas juntas. Con la mano también se puede: Mayús o ⌘ + clic', mano: '<b>Mano</b>: arrastrá el piso para moverte. Tocá algo para elegirlo y arrastralo para correrlo. Clic derecho abre su menú', maza: '<b>Maza</b>: tocá lo que quieras sacar', gotero: '<b>Gotero</b>: tocá algo para copiarlo y ubicar la copia' };
  function herramienta(h) { CON.cancelar(); cancelar(true); if (h === 'pared' || h === 'recinto') { CON.empezar(h); return; } if (h === 'puerta' || h === 'ventana') { CON.empezar('abertura', h); return; } if (h === 'catalogo') { catalogo($('#mcat').hidden); return; } ED.h = h; herrVis(null); }
  // qué botón queda marcado en la barra: la herramienta de construcción en curso o, si no hay, la mano, la maza o el gotero
  function herrVis(h) { const v = h || ED.h; canvas.dataset.h = v; document.documentElement.classList.toggle('ubicando', !!h && h !== 'mano' && h !== 'varias'); document.querySelectorAll('#mtool [data-h]').forEach(b => b.setAttribute('aria-pressed', b.dataset.h === v)); if (!h && ED.on && !ED.colocar && !ED.linea) hint(PISTA[ED.h]); puntos(); if (motor.mirando) motor.reapuntar(); J && J.marcar(); }
  $('#mtool').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.h) herramienta(b.dataset.h); if (b.id === 'beq') panelEquipos($('#meq').hidden); if (b.id === 'bundo') volver(undo, redo); if (b.id === 'bredo') volver(redo, undo); if (b.id === 'bpap') papelera(b);
    if (b.id === 'bpared') paredes({ alta: 'corte', corte: 'baja', baja: 'alta' }[ctx.paredes]);
    if (b.id === 'bgrid') { ED.grilla = !ED.grilla; b.setAttribute('aria-pressed', ED.grilla); grilla.visible = ED.on && ED.grilla; cuadricula = grilla.visible; pintaSuelo(); motor.dirty = true; } });
  document.addEventListener('click', e => { const b = e.target.closest('[data-cerrar]'); if (b) $('#' + b.dataset.cerrar).hidden = true; });
  const pegar = (v, alt) => alt ? Math.round(v * 100) / 100 : Math.round(v * 2) / 2;
  let nid = 1; const nuevoId = t => { let id; do id = t.slice(0, 3) + (nid++).toString(36); while (E.piezas.some(p => p.id === id)); NACEN.add(id); return id; };
  // ---------- plantas (como en Los Sims): Re Pág / Av Pág o las flechitas de la barra cambian la planta en la que se dibuja ----------
  // Lo que se pone nace en la planta activa y sube 2,8 m por planta. Editando se ven la planta activa y las de abajo; de cada plano, solo el de la planta activa.
  // El terreno (pasto, calles, lomas) es siempre de la planta baja.
  function verPlantas() { for (const g of objs.values()) aplicarCapas(g); motor.pisoY = ED.on ? plAct() * ALTO_PLANTA : 0; $('#bplnom').textContent = NOM_PLANTA(plAct()); PL.vista = motor.caminando; $('#bplbaja').disabled = PL.act <= 0; $('#bplsube').disabled = PL.act >= 5; motor.dirty = true; }
  function planta(n, aviso = true) { n = Math.max(0, Math.min(5, n)); if (n === PL.act) return; PL.act = n; CON.cancelar(); cancelar(true); if (SEL && !elegible(SEL)) elegir(null); verPlantas(); motor.ir({ ty: n * ALTO_PLANTA }, 0.35);
    if (aviso) { const hay = E.piezas.some(q => q.t !== 'plano' && conPlanta(q.t) && nivelDe(q) === n), pl = E.piezas.some(q => q.t === 'plano' && nivelDe(q) === n); toast(NOM_PLANTA(n) + (hay ? '' : pl ? ': vacía. Dibujá encima del plano: el contorno con Pared (B), cerrando en la primera esquina' : ': vacía. Podés subir su plano desde el inventario (Plano del lugar)')); } }
  motor.cada.push(() => { if (!!motor.caminando !== !!PL.vista && objs.size) verPlantas(); return false; });
  $('#bplsube').onclick = () => planta(PL.act + 1); $('#bplbaja').onclick = () => planta(PL.act - 1);
  // vistas de pared, como en Los Sims: altas, cortadas (se ve adentro) o al ras del piso
  function pelar(k, aviso = true) { const top = nivelTope(), N = PELAR.length; k = ((k % N) + N) % N; if (k === 2 && top === 0) k = PEL.k < 2 ? 3 : 1;   // sin pisos de arriba, ese paso se saltea
    PEL.k = k; PEL.max = k >= 2 ? Math.max(0, top - 1) : 99; capas.techos = k < 1; const ct = raiz.querySelector('[data-capa="techos"]'); if (ct) ct.checked = capas.techos;
    const pv = k >= 4 ? 'baja' : k >= 3 ? 'corte' : 'alta'; if (ctx.paredes !== pv && !(pv === 'alta' && !ctx.paredes)) paredes(pv, false);
    document.querySelectorAll('[data-pelar]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.pelar === k)); for (const g of objs.values()) aplicarCapas(g); motor.dirty = true; if (aviso) toast(PELAR[k][0]); }
  $('#bpelar').onclick = e => pelar(PEL.k + (e.shiftKey ? -1 : 1));
  function paredes(v, aviso = true) { ctx.paredes = v; document.querySelectorAll('[data-pared]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pared === v)); for (const p of E.piezas) if (CON.esMuro(p) && objs.has(p.id)) rehacer(p); CON.marcar(); if (aviso) toast({ alta: 'Paredes altas', corte: 'Paredes cortadas', baja: 'Paredes al ras' }[v]); }

  // catálogo: cada tipo de pieza (y sus variantes: cámara domo, rack de pared…) con su dibujo, lo más usado arriba, y las aberturas, que van sobre una pared
  const USO = (() => { try { return JSON.parse(localStorage.getItem('motor.usados')) || {}; } catch (e) { return {}; } })(); let CATO = new Map();
  const usar = k => { USO[k] = (USO[k] || 0) + 1; try { localStorage.setItem('motor.usados', JSON.stringify(USO)); } catch (e) {} };
  function ofertas() { const out = []; for (const [k, T] of Object.entries(TIPOS)) { if ((SIN[app] || []).includes(T.g)) continue; if (T.variantes) T.variantes.forEach((v, i) => out.push({ key: k + ':' + i, t: k, n: v.n, g: v.g || T.g, o: v.o, T })); else out.push({ key: k, t: k, n: T.n, g: T.g, o: {}, T }); }
    for (const [k, a] of Object.entries(ABERTURAS)) out.push({ key: 'ab:' + k, ab: k, n: a.n, g: 'Puertas y ventanas' }); out.push({ key: 'zona', zona: true, n: 'Zona (nombra un sector)', g: 'Construcción' });
    if (TIPOS.recinto) for (const [pies, L] of [[20, 6.06], [40, 12.19]]) out.push({ key: 'cont:' + pies, t: 'recinto', n: `Contenedor oficina ${pies} pies`, g: 'Construcción', T: TIPOS.recinto,
      o: { molde: 1, estilo: 'contenedor', nombre: `Contenedor oficina ${pies}'`, tipo: 'chapa', alto: 2.59, grosor: 0.06, color: '#e6eaed', piso: 'goma', pts: [[-L / 2, -1.22], [L / 2, -1.22], [L / 2, 1.22], [-L / 2, 1.22]] } });
    return out; }
  const HCORTO = { varias: 'Elegir varias', puerta: 'Puerta', ventana: 'Ventana' }, iconoOf = o => o.zona ? svg('zona', 30) : o.ab ? svg({ doble: 'puerta', vidrio: 'puerta' }[o.ab] || o.ab, 30) : o.t === 'persona' ? svg('caminar', 30) : o.t === 'vehiculo' ? svg('auto', 30) : '';
  function catalogo(abrir = true) { const box = $('#mcat'); box.hidden = !abrir; if (!abrir) { retomar(); return; } /* cerrar el inventario (Tab) devuelve el mouse a la mira */ motor.mira(false); $('#meq').hidden = true; const t = ($('#mcq').value || '').toLowerCase(), O = ofertas(), va = o => !t || (o.n + ' ' + o.g).toLowerCase().includes(t);
    const tarjeta = o => `<button data-of="${o.key}"><span class="mmini" data-mini="${o.key}">${iconoOf(o)}</span><span>${esc(o.n)}</span></button>`;
    // arriba de todo, las herramientas: así una que se sacó de la barra se puede volver a poner
    const herr = t ? '' : `<p class="mcat-tip">Arrastrá a la barra de abajo lo que uses seguido: queda en un número del 1 al 0.</p><h4>Herramientas</h4><div class="mgrid mherr">${HERR.filter(h => h[0] !== 'catalogo').map(([k, n]) => `<button data-herr="${k}"><span class="mmini">${svg(k, 26)}</span><span>${esc(HCORTO[k] || n.split(':')[0])}</span></button>`).join('')}</div>`;
    const usados = t ? [] : O.filter(o => USO[o.key]).sort((a, b) => USO[b.key] - USO[a.key]).slice(0, 6);
    $('#mcl').innerHTML = herr + ((usados.length ? `<h4>Más usados</h4><div class="mgrid">${usados.map(tarjeta).join('')}</div>` : '') + ORDEN.map(g => { const its = O.filter(o => o.g === g && va(o)); return its.length ? `<h4>${g}</h4><div class="mgrid">${its.map(tarjeta).join('')}</div>` : ''; }).join('')) || '<p class="mvacio">Nada con ese nombre.</p>';
    CATO = new Map(O.map(o => [o.key, o])); minis(); if (!motor.tactil) $('#mcq').focus(); }
  $('#mcq').addEventListener('input', () => catalogo());
  // elegir algo del inventario (desde su tarjeta o desde un casillero de la barra)
  function elegirOferta(o) { usar(o.key); $('#mcat').hidden = true; if (o.zona || o.ab) retomar(); if (o.zona) CON.empezar('recinto', 'zona'); else if (o.ab) CON.empezar('abertura', o.ab); else if (o.T && o.T.archivo) { cambiarImagen = null; $('#mimg').click(); } else empezar({ t: o.t, ...o.o }); }
  $('#mcl').addEventListener('click', e => { const hb = e.target.closest('[data-herr]'); if (hb) { $('#mcat').hidden = true; retomar(); herramienta(hb.dataset.herr); return; } const b = e.target.closest('[data-of]'), o = b && CATO.get(b.dataset.of); if (!o) return; if (J) J.mano = o.key; elegirOferta(o); });
  // el dibujo de cada cosa: se arma la pieza de verdad, sola, y se le saca una foto chica (de a pocas por cuadro, para no trabar)
  const MINI = new Map(); let miniT = null, miniCola = [], rt = null, escM = null, camM = null;
  function minis() { if (!CATO.size) CATO = new Map(ofertas().map(o => [o.key, o])); miniCola = [...document.querySelectorAll('#mcl [data-mini], #mbarra [data-mini]')].filter(el => !el.firstChild); if (!miniT && miniCola.length) miniT = requestAnimationFrame(miniPaso); }
  function miniPaso() { miniT = null; let n = 0; while (miniCola.length && n < 3) { const el = miniCola.shift(), o = el.isConnected && CATO.get(el.dataset.mini); if (!o || o.ab || o.zona) continue; const k = o.key + motor.tema; if (!MINI.has(k)) { let u = ''; try { u = fotoPieza(o, url => { MINI.set(k, url); if (url) document.querySelectorAll('#mcl [data-mini], #mbarra [data-mini]').forEach(q => { if (q.dataset.mini === o.key && !q.firstChild) q.innerHTML = `<img src="${url}" alt="" draggable="false">`; }); }); } catch (er) {} MINI.set(k, u || ''); n++; } const u = MINI.get(k); if (u) el.innerHTML = `<img src="${u}" alt="" draggable="false">`; }
    if (miniCola.length) miniT = requestAnimationFrame(miniPaso); else motor.dirty = true; }
  // `tarde(url)`: un mueble llega en dos tiempos (primero una caja gris, después el modelo). Si el modelo todavía no llegó, devuelve null y avisa por `tarde` cuando la foto está.
  function fotoPieza(o, tarde) { const T = o.T, p = { ...T.def, ...o.o, id: 'mini', t: o.t, nombre: '' }; let espera = null;
    if (T.herramienta === 'piso' && !(p.celdas && p.celdas.length)) { p.celdas = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]; p.celda = 2; }   // un piso vacío no tiene foto: se muestra un pedazo
    if (T.herramienta === 'relieve') { const A = {}, m = p.modo || 'subir'; for (let i = -4; i <= 4; i++) for (let j = -3; j <= 3; j++) { const r = Math.hypot(i, j * 1.2), b = Math.max(0, 1 - r / 4.2); A[i + ',' + j] = m === 'bajar' ? 1.6 - 1.4 * b * b : m === 'nivelar' ? (r < 2.6 ? 1.2 : 1.2 * Math.max(0, 1 - (r - 2.6) / 1.6)) : m === 'alisar' ? 0.35 + 0.9 * b * b * (1 + 0.25 * Math.sin(i * 1.7 + j)) : 2.2 * b * b; } p.alt = A; }   // el pincel muestra una loma de ejemplo
    if (T.forma === 'punto') { p.x = 0; p.z = 0; p.r = T.equipo ? 0.5 : -0.5; if (T.equipo) { p.alcance = 0; if (p.montaje !== 'techo') p.y = Math.min(p.y ?? 2, 2.2); } } else p.pts = T.forma === 'area' ? [[-4, -3], [4, -3], [4, 3], [-4, 3]] : [[-5, 0], [5, 0]];
    const g = armarPieza(p, { estado: () => 'ok', paredes: 'alta', vivo: () => ({ estado: 'cerrada' }), dirty: () => { if (espera) { const q = espera; espera = null; let u = ''; try { u = fotoDe(q); } catch (er) {} tarde(u); } } }); if (!g) return '';
    if (o.t === 'mueble' && tarde && !g.children.some(k => k.isMesh && k.geometry.type !== 'BoxGeometry')) { espera = g; return null; }
    return fotoDe(g); }
  function fotoDe(g) { const W = 336, H = 252;
    if (!rt) { rt = new THREE.WebGLRenderTarget(W, H); escM = new THREE.Scene(); escM.add(new THREE.HemisphereLight(0xffffff, 0x7a828a, 0.85)); const l = new THREE.DirectionalLight(0xffffff, 1.25); l.position.set(-3, 6, 4); escM.add(l); camM = new THREE.PerspectiveCamera(28, W / H, 0.05, 2000); }
    escM.environment = motor.scene.environment; escM.add(g); const b = cajaDe(g, new THREE.Box3()); if (b.isEmpty()) { escM.remove(g); return ''; }
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), chato = sz.y < 0.06 * Math.max(sz.x, sz.z), dist = Math.max(0.15, sz.length() / 2) / Math.sin(14 * Math.PI / 180) * (chato ? 0.72 : 1.04);   // lo chato (un piso, una pintura) se mira más de cerca
    camM.position.set(c.x + dist * 0.55, c.y + dist * 0.42, c.z + dist * 0.72); camM.lookAt(c); camM.near = dist / 60; camM.far = dist * 4; camM.updateProjectionMatrix();
    const R = motor.renderer, antes = R.getRenderTarget(), col = R.getClearColor(new THREE.Color()), al = R.getClearAlpha(), px = new Uint8Array(W * H * 4);
    R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(escM, camM); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(antes); R.setClearColor(col, al); escM.remove(g); limpiar(g);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), im = x.createImageData(W, H), fila = W * 4;
    for (let y = 0; y < H; y++) { const de = (H - 1 - y) * fila, a = y * fila; for (let i = 0; i < fila; i += 4) { im.data[a + i] = GAMMA[px[de + i]]; im.data[a + i + 1] = GAMMA[px[de + i + 1]]; im.data[a + i + 2] = GAMMA[px[de + i + 2]]; im.data[a + i + 3] = px[de + i + 3]; } }
    x.putImageData(im, 0, 0); return cv.toDataURL('image/png'); }
  const MEDIDAS = ['ancho', 'fondo', 'alto', 'largo', 'pisos', 'altoPiso', 'niveles', 'modulo', 'prof'];
  function empezar(tpl) { CON.cancelar(); cancelar(true); retomar(); const T = TIPOS[tpl.t];
    // algo con medida fija que se construye como recinto (el contenedor oficina): se toca dónde va y queda armado, listo para ponerle puertas y ventanas
    if (tpl.molde && tpl.pts) { ED.linea = { tpl, pts: [], p: null, rect: true, molde: true }; hint(`<b>${esc(tpl.nombre || T.n)}</b>: tocá dónde va el centro. Después: <kbd>R</kbd> gira, la puerta y las ventanas se agarran del inventario y se apoyan en la pared · <kbd>Shift</kbd> pone varios · <kbd>Esc</kbd> cancela`); herrVis('ubicar'); return; } if (T.herramienta) { CON.empezar(T.herramienta, T.herramienta === 'piso' || T.herramienta === 'relieve' ? tpl : undefined); return; }
    const ult = (() => { try { return (JSON.parse(localStorage.getItem('motor.medidas') || '{}'))[tpl.t + (tpl.estilo ? ':' + tpl.estilo : '')] || null; } catch (e) { return null; } })();
    if (ult) { tpl = { ...tpl, ...ult }; toast('Con las medidas de la última: ' + Object.entries(ult).map(([k, v]) => v + (['ancho', 'fondo', 'alto', 'largo'].includes(k) ? ' m' : ' ' + k)).join(' × ')); }
    if (T.forma === 'punto') { ED.colocar = { tpl, p: null }; hint(`<b>${esc(T.n)}</b>: tocá dónde va. ${T.equipo ? 'Apuntá a una pared, un techo o una columna y se pega ahí. ' : ''}<kbd>R</kbd> gira · <kbd>Shift</kbd> pone varios · <kbd>Alt</kbd> sin imán · <kbd>Esc</kbd> cancela`); }
    else { ED.linea = { tpl, pts: [], p: null }; hintLinea(T, ED.linea); } herrVis('ubicar'); }
  // recorriendo en la compu, lo que se elige en un panel (catálogo, equipos, gotero) devuelve el mouse a la mira para seguir apuntando
  // paneles flotantes (en la compu): la ficha, el inventario y la lista de equipos se arrastran desde la rayita de arriba, se ensanchan desde la esquina de abajo
  // y con doble clic en la rayita (o Y para la ficha) se minimizan a un renglón. Lo que cada uno deja queda guardado en este navegador.
  (() => { const fino = matchMedia('(pointer: fine) and (min-width: 900px)'), K = 'motor.paneles', leer = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (_) { return {}; } };
    const guardarP = (id, el) => { try { const o = leer(), r = el.getBoundingClientRect(); o[id] = { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: el.classList.contains('mhoja') ? Math.round(r.height) : undefined, mini: el.classList.contains('mchico') }; localStorage.setItem(K, JSON.stringify(o)); } catch (_) {} };
    const ubicar = (el, o) => { const W = innerWidth, H = innerHeight, w = Math.min(o.w || el.offsetWidth, W - 16), l = Math.max(8, Math.min(W - w - 8, o.l)), t = Math.max(64, Math.min(H - 60, o.t));
      Object.assign(el.style, { left: l + 'px', top: t + 'px', right: 'auto', width: w + 'px', maxHeight: Math.max(160, H - t - 84) + 'px' }); /* nunca tapa la barra de abajo */ if (el.classList.contains('mhoja')) Object.assign(el.style, { bottom: 'auto', height: Math.max(220, Math.min(H - t - 70, o.h || el.offsetHeight)) + 'px' }); };
    for (const id of ['minfo', 'mcat', 'meq']) { const el = $('#' + id); if (!el) continue; el.classList.add('mflota'); el.title = '';
      const o = leer()[id]; if (o && fino.matches) { ubicar(el, o); el.classList.toggle('mchico', !!o.mini); }
      let D = null; const enRaya = e => fino.matches && e.clientY - el.getBoundingClientRect().top < 16 && !e.target.closest('input,select,textarea,button,a');
      el.addEventListener('pointerdown', e => { if (!enRaya(e) || e.button !== 0) return; const r = el.getBoundingClientRect(); D = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height }; el.setPointerCapture(e.pointerId); el.classList.add('marrastre'); e.preventDefault(); e.stopPropagation(); });
      el.addEventListener('pointermove', e => { if (!D) return; ubicar(el, { l: e.clientX - D.dx, t: e.clientY - D.dy, w: D.w, h: D.h }); });
      el.addEventListener('pointerup', () => { if (!D) return; D = null; el.classList.remove('marrastre'); guardarP(id, el); });
      el.addEventListener('dblclick', e => { if (!enRaya(e)) return; el.classList.toggle('mchico'); guardarP(id, el); e.stopPropagation(); });
      new ResizeObserver(() => { if (!D && fino.matches && el.style.width) guardarP(id, el); }).observe(el); }
    addEventListener('keydown', e => { if (e.key.toLowerCase() !== 'y' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.target.closest('input,textarea,select')) return; const f = $('#minfo'); if (f && !f.hidden) { f.classList.toggle('mchico'); guardarP('minfo', f); } }); })();
  motor.alMiraFalla = () => { if (RC.R.on) toast('El navegador no soltó el mouse todavía: hacé clic en la maqueta o apretá M'); };
  const retomar = () => { if (RC.R.on && !motor.mirando && RC.puedeMira()) motor.mira(true); };
  function cancelar(todo) { J && J.limpio(); if (ED.colocar && ED.colocar.p) quitar(ED.colocar.p, true); if (ED.linea && ED.linea.p) { if (ED.linea.sigue) { ED.linea.p.pts = ED.linea.sigue; rehacer(ED.linea.p); } else quitar(ED.linea.p, true); } const habia = ED.colocar || ED.linea; ED.colocar = ED.linea = null; if (ED.on && !todo && habia) herrVis(null); }
  function quitar(p, sinFoto) { E.piezas = E.piezas.filter(x => x !== p); const g = objs.get(p.id); if (g) { mundo.remove(g); limpiar(g); objs.delete(p.id); } if (SEL === p) { SEL = null; CON.alElegir(null); marcar(); info(); } etiquetas(); motor.dirty = true; if (!sinFoto) cambio(); }
  // sacar: los racks y gabinetes (protegidos) piden la clave de borrado de la empresa; sin anfitrión, hay que mantener apretado. Lo sacado va a la papelera.
  async function sacar(p) { if (!p) return; if (p.candado) { toast('Tiene candado: sacalo para poder sacarla'); return; } const T = TIPOS[p.t], nom = p.nombre ? ` «${p.nombre}»` : '';
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
  // equipo adosado a una columna de luz: va sin poste propio, mirando hacia afuera; cada uno nuevo queda un cuarto de vuelta más allá, y se mueve con la columna
  function adosar(col, t) { const ya = E.piezas.filter(q => !q.pts && TIPOS[q.t] && TIPOS[q.t].equipo && Math.hypot((q.x || 0) - (col.x || 0), (q.z || 0) - (col.z || 0)) < 1.6).length, r = (col.r || 0) + ya * Math.PI / 2, H = { ...TIPOS.columna.def, ...col }.alto;
    const c = { ...TIPOS[t].def, t, id: nuevoId(t), x: Math.round(((col.x || 0) + Math.sin(r) * 0.3) * 100) / 100, z: Math.round(((col.z || 0) + Math.cos(r) * 0.3) * 100) / 100, r, montaje: 'pared', y: Math.max(3, Math.round((Math.min(H - 1.5, t === 'camara' ? 8 : 7) - ya * 0.6) * 10) / 10) }; E.piezas.push(c); rehacer(c); elegir(c); cambio(); toast('Quedó adosado a la columna. Se gira con la manija celeste.'); }
  function duplicar() { if (!SEL) return; const c = JSON.parse(JSON.stringify(SEL)); c.id = nuevoId(c.t); delete c.uid; delete c.doc; if (c.pts) c.pts = c.pts.map(q => [q[0] + 4, q[1] + 4, ...q.slice(2)]); else { c.x = (c.x || 0) + 4; c.z = (c.z || 0) + 4; } E.piezas.push(c); rehacer(c); elegir(c); cambio(); }
  let copia = null; function pegarCopia() { if (!copia) return; const c = JSON.parse(copia); delete c.id; delete c.uid; delete c.doc; if (c.pts) { c.id = nuevoId(c.t); c.pts = c.pts.map(q => [q[0] + 4, q[1] + 4, ...q.slice(2)]); E.piezas.push(c); rehacer(c); elegir(c); cambio(); } else empezar(c); }
  function girarSel(giro) { const p = ED.colocar ? ED.colocar.p || (ED.colocar.tpl.r = (ED.colocar.tpl.r || 0) + giro, null) : SEL; if (!p) return; if (p.candado) { toast('Tiene candado: sacalo para girarla'); return; }
    if (p.pts) { if (ED.colocar || ED.linea) return; CON.girar(p, giro); CON.marcar(); marcar(); cambio(); return; }
    const antes = p.r || 0, con = ED.colocar ? [] : CON.contenido(p); p.r = Math.round((antes + giro) / (Math.PI / 4)) * Math.PI / 4; const g = objs.get(p.id); if (g) g.rotation.y = p.r; if (ED.colocar) ED.colocar.tpl.r = p.r; else { rotarCon(p, p.r - antes, con); marcar(); cambio(); info(); } motor.dirty = true; }
  // al girar un edificio o un galpón, los equipos que tiene puestos giran con él
  function rotarCon(p, dg, lista) { if (!dg) return; const c = Math.cos(dg), s = Math.sin(dg); for (const q of lista || CON.contenido(p)) { const dx = (q.x || 0) - (p.x || 0), dz = (q.z || 0) - (p.z || 0); q.x = Math.round(((p.x || 0) + dx * c + dz * s) * 100) / 100; q.z = Math.round(((p.z || 0) - dx * s + dz * c) * 100) / 100; q.r = (q.r || 0) + dg; rehacer(q); } }
  // importar piezas de un archivo .json (una escena entera, una lista de piezas o una sola): caen juntas donde se está mirando y con identificadores nuevos si hacen falta
  function importar(txt) { let j; try { j = JSON.parse(txt); } catch (e) { toast('Ese archivo no es un .json válido'); return; } const L = (Array.isArray(j) ? j : (j.escena && j.escena.piezas) || j.piezas || (j.t ? [j] : [])).filter(q => q && TIPOS[q.t]); if (!L.length) { toast('No encontré piezas en ese archivo'); return; }
    const C2 = L.filter(q => q.t !== 'terreno').map(centro), n = Math.max(1, C2.length), cx = C2.reduce((a, q) => a + q[0], 0) / n, cz = C2.reduce((a, q) => a + q[1], 0) / n, dx = Math.round(motor.C.tx - cx), dz = Math.round(motor.C.tz - cz); let n2 = 0, grande = null;
    for (const q0 of L) { if (q0.t === 'terreno' && L.length > 1) continue; const q = JSON.parse(JSON.stringify(q0)); delete q._p; if (!q.id || E.piezas.some(z => z.id === q.id)) q.id = nuevoId(q.t); if (q.pts) q.pts = q.pts.map(k => [k[0] + dx, k[1] + dz, ...k.slice(2)]); else { q.x = (q.x || 0) + dx; q.z = (q.z || 0) + dz; }
      E.piezas.push(q); rehacer(q); n2++; if (['edificio', 'galpon', 'recinto'].includes(q.t) && !grande) grande = q; }
    cambio(); if (grande) elegir(grande); toast(`${n2} pieza${n2 > 1 ? 's' : ''} importada${n2 > 1 ? 's' : ''}${grande ? ': mové o girá el edificio y sus equipos van con él' : ''}`); }
  let cambiarImagen = null;
  async function leerImagen(f) { if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) throw new Error('El PDF no se puede leer acá: exportá el plano como imagen (PNG o JPG) o sacale una captura'); if (!/^image\//.test(f.type) && !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) throw new Error('Tiene que ser una imagen (PNG o JPG)');
    const bm = await createImageBitmap(f), k = Math.min(1, 2400 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0, c.width, c.height); const px = bm.width; bm.close && bm.close();
    let src = c.toDataURL('image/webp', 0.86); if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/jpeg', 0.86); return { img: src, aspecto: c.height / c.width, px }; }
  async function subirPlano(f) { if (!f) return; let r; try { r = await leerImagen(f); } catch (er) { toast(er.message); return; }
    if (cambiarImagen && E.piezas.includes(cambiarImagen)) { const p = cambiarImagen; cambiarImagen = null; Object.assign(p, r); rehacer(p); cambio(); elegir(p); toast('Imagen cambiada. Si la escala no es la misma, medí de nuevo'); return; }
    if (!ED.on) editar(true); const otros = E.piezas.filter(q => q.t === 'plano'); let n = PL.act;
    // con otro plano ya puesto, se pregunta de qué planta es: cada plano se ve solo en su planta, así no se enciman
    if (otros.length) { const max = Math.min(5, Math.max(...otros.map(nivelDe)) + 1), libre = [0, 1, 2, 3, 4, 5].find(k => !otros.some(q => nivelDe(q) === k));
      n = await pideOpcion('¿De qué planta es este plano?', 'Cada plano va en su planta y se ve solo cuando dibujás en ella, así no quedan encimados.', [0, 1, 2, 3, 4, 5].filter(k => k <= max).map(k => [k, NOM_PLANTA(k) + (otros.some(q => nivelDe(q) === k) ? ' · ya tiene un plano' : '')]), libre); if (n == null) return; }
    const p = { id: nuevoId('plano'), t: 'plano', nombre: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Plano del lugar', nivel: n, x: Math.round(motor.C.tx), z: Math.round(motor.C.tz), ancho: Math.round(Math.min(300, Math.max(20, motor.C.d * 0.9))), ...r };
    const mismo = otros.filter(q => nivelDe(q) === n), base = otros.filter(q => nivelDe(q) !== n).sort((a, b) => Math.abs(nivelDe(a) - n) - Math.abs(nivelDe(b) - n))[0];
    if (mismo.length || base) { const ref = base || mismo[0]; p.ancho = ref.px && r.px ? Math.round(ref.ancho / ref.px * r.px * 100) / 100 : ref.ancho; p.r = ref.r || 0; }
    if (mismo.length) { const der = Math.max(...mismo.map(q => (q.x || 0) + q.ancho / 2)); p.x = Math.round(der + 8 + p.ancho / 2); p.z = Math.round(mismo[0].z || 0); }   // otra hoja de la misma planta: al lado
    else if (base) { p.x = base.x || 0; p.z = base.z || 0; if (n > 0) p.opacidad = 0.7; }   // otra planta: encima, semitransparente, para calzarlo con lo de abajo
    E.piezas.unshift(p); if (n !== PL.act) planta(n, false); rehacer(p); cambio(); elegir(p); motor.ir({ tx: p.x, tz: p.z, d: p.ancho * 1.1, pitch: 1.2, ty: n * ALTO_PLANTA }, 0.6);
    if (mismo.length) toast(`Otra hoja ${n ? 'del ' + NOM_PLANTA(n).toLowerCase() : 'de la planta baja'}: quedó al lado, con la misma escala`, 5000);
    else if (base) toast(`${NOM_PLANTA(n)}: quedó encima del plano ${nivelDe(base) ? 'del ' + NOM_PLANTA(nivelDe(base)).toLowerCase() : 'de la planta baja'}, con la misma escala y semitransparente. Arrastralo (y giralo con R) hasta que calce con las paredes de abajo; después, el contorno desde su ficha`, 9000);
    else medir(p); }
  // elegir entre varias opciones (un botón por opción); devuelve el valor o null
  function pideOpcion(titulo, detalle, ops, def) { return new Promise(listo => { if (document.pointerLockElement) document.exitPointerLock(); const box = $('#mconf'); box.innerHTML = `<form class="vidrio mdialog" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><b>${esc(titulo)}</b><p>${esc(detalle)}</p><div class="mopciones">${ops.map(([v, t]) => `<button class="mbtn${v === def ? ' pri' : ''}" type="button" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div><div class="macts"><button class="mbtn" type="button" data-no>Cancelar</button></div></form>`; box.hidden = false;
      const fin = v => { box.hidden = true; box.innerHTML = ''; removeEventListener('keydown', tecla, true); listo(v); }, tecla = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); fin(null); } };
      box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const o = ops.find(([v]) => String(v) === b.dataset.v); fin(o ? o[0] : null); }); box.querySelector('[data-no]').onclick = () => fin(null); addEventListener('keydown', tecla, true); setTimeout(() => (box.querySelector('.pri') || box.querySelector('[data-v]')).focus(), 30); }); }
  $('#mimg').addEventListener('change', e => { subirPlano(e.target.files[0]); e.target.value = ''; });
  // ajustar la escala: se tocan dos puntos de algo que se conoce (una pared, un portón) y se escribe cuánto mide; el plano (y lo que tiene arriba) se agranda o achica desde el primer punto
  const MED = { p: null, pts: [], g: new THREE.Group() }; motor.scene.add(MED.g);
  function medir(p) { cancelar(true); CON.cancelar(); MED.p = p; MED.pts = []; MED.g.clear(); herrVis('regla'); hint('<b>Escala</b>: tocá el comienzo y el final de algo que sepas cuánto mide en la realidad. Si no tenés medidas, tocá los dos lados de una puerta del plano. <kbd>Esc</kbd> deja la escala como está'); }
  function medirPunto(q) { const P = MED.pts; P.push(q); const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), new THREE.MeshBasicMaterial({ color: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#3fc6ea', depthTest: false, toneMapped: false }));
    const r = Math.max(0.12, motor.C.d * 0.006); m.scale.setScalar(r * 2); m.position.set(q[0], (motor.pisoY || 0) + 0.2, q[1]); m.renderOrder = 9; MED.g.add(m);
    if (P.length === 2) { const ln = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m.material); const L = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]); ln.scale.set(L, r * 0.6, r * 0.6); ln.position.set((P[0][0] + P[1][0]) / 2, (motor.pisoY || 0) + 0.2, (P[0][1] + P[1][1]) / 2); ln.rotation.y = Math.atan2(-(P[1][1] - P[0][1]), P[1][0] - P[0][0]); ln.renderOrder = 9; MED.g.add(ln); }
    motor.dirty = true; if (P.length < 2) { hint('<b>Escala</b>: ahora tocá el final'); return; } const L = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]); if (L < 0.05) { MED.pts = []; MED.g.clear(); hint('<b>Escala</b>: los dos puntos están muy juntos. Tocá de nuevo el comienzo'); return; }
    pideNumero('¿Cuánto mide en la realidad?', `En el plano, de punta a punta hay ${fmt(L)} m con la escala de ahora. Si no tenés medidas, elegí qué marcaste.`, 'metros', [[0.9, 'Una puerta común (0,90 m)'], [0.8, 'La puerta de un baño (0,80 m)'], [2.5, 'Un cajón de estacionamiento (2,50 m)']]).then(real => { const p = MED.p; finMedir(); if (!real || !p || !E.piezas.includes(p)) return; const k = real / L, [ax, az] = P[0];
      const lleva = CON.contenido(p); for (const q of [p, ...lleva]) { if (q.pts) q.pts = q.pts.map(c => [Math.round((ax + (c[0] - ax) * k) * 100) / 100, Math.round((az + (c[1] - az) * k) * 100) / 100]); else { q.x = Math.round((ax + ((q.x || 0) - ax) * k) * 100) / 100; q.z = Math.round((az + ((q.z || 0) - az) * k) * 100) / 100; } rehacer(q); }
      p.ancho = Math.round(p.ancho * k * 100) / 100; rehacer(p); cambio(); elegir(p); info(); toast(`Escala ajustada: el plano mide ${fmt(p.ancho)} m de ancho`);
      // con la escala lista, lo siguiente es ubicar las puertas que todavía no están en el plano
      if (host && host.puertas && PU.lista.some(d => !E.piezas.some(q => q.puerta === d.id))) { panelEquipos(true); hint('<b>Puertas</b>: tocá una de la lista y después el lugar del plano donde está. <kbd>R</kbd> la gira'); }
      // con la escala lista y la planta vacía, lo siguiente es el contorno del edificio
      else if (!E.piezas.some(q => q.t !== 'plano' && conPlanta(q.t) && nivelDe(q) === nivelDe(p))) { if (nivelDe(p) !== PL.act) planta(nivelDe(p), false); CON.empezar('pared', 'contorno'); } }); }
  function finMedir() { MED.p = null; MED.pts = []; MED.g.clear(); herrVis(null); motor.dirty = true; }
  function pideNumero(titulo, detalle, unidad, atajos = []) { return new Promise(listo => { if (document.pointerLockElement) document.exitPointerLock(); const box = $('#mconf'); box.innerHTML = `<form class="vidrio mdialog" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><b>${esc(titulo)}</b><p>${esc(detalle)}</p>${atajos.length ? `<div class="mopciones">${atajos.map(([v, t]) => `<button class="mbtn" type="button" data-v="${v}">${esc(t)}</button>`).join('')}</div>` : ''}<label class="mnum"><input type="number" inputmode="decimal" step="0.01" min="0.1" required aria-label="${esc(titulo)}"><span>${esc(unidad)}</span></label><div class="macts"><button class="mbtn" type="button" data-no>Cancelar</button><button class="mbtn pri" type="submit">${svg('check', 16)}Ajustar</button></div></form>`; box.hidden = false;
      const f = box.querySelector('form'), inp = f.querySelector('input'), fin = v => { box.hidden = true; box.innerHTML = ''; removeEventListener('keydown', tecla, true); listo(v); }, tecla = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); fin(null); } };
      f.onsubmit = e => { e.preventDefault(); const v = parseFloat(String(inp.value).replace(',', '.')); if (v > 0) fin(v); }; f.querySelector('[data-no]').onclick = () => fin(null); f.querySelectorAll('[data-v]').forEach(b => b.onclick = () => fin(+b.dataset.v)); addEventListener('keydown', tecla, true); setTimeout(() => inp.focus(), 30); }); }
  const lee = f => { if (!f) return; if (/^image\//.test(f.type) || /\.pdf$/i.test(f.name)) { cambiarImagen = null; subirPlano(f); return; } if (!/\.json$/i.test(f.name)) { toast('Tiene que ser un archivo .json o la imagen de un plano'); return; } const r = new FileReader(); r.onload = () => importar(String(r.result)); r.readAsText(f); };
  canvas.addEventListener('dragover', e => { if (ED.on) e.preventDefault(); }); canvas.addEventListener('drop', e => { if (!ED.on) return; e.preventDefault(); lee(e.dataTransfer.files[0]); });
  $('#mimp').addEventListener('change', e => { lee(e.target.files[0]); e.target.value = ''; $('#mcat').hidden = true; });
  // menú del botón derecho
  function menu(items, x, y, arriba) { const m = $('#mmenu'); if (!items || !items.length) { m.hidden = true; return; }
    m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.peligro ? 'peligro' : ''}">${svg(it.ic, 16)}<span>${it.n}</span>${it.k ? `<kbd>${it.k}</kbd>` : ''}</button>`).join(''); m._it = items; m.hidden = false;
    const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px'; m.style.top = Math.max(8, Math.min(innerHeight - h - 8, arriba ? y - h : y)) + 'px'; }
  $('#mmenu').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const it = $('#mmenu')._it[+b.dataset.i]; menu(null); it.f(); });
  motor.alMenu = e => { if (cancelarAgarre()) return; if (motor.mirando) { if (!ED.on) return; if (MED.p) { finMedir(); return; } if (CON.cancelar()) return; if (ED.colocar || ED.linea) { cancelar(); return; } if (CON.sub) { CON.sub = null; info(); return; } if (SEL) { elegir(null); return; } if (ED.h !== 'mano') herramienta('mano'); return; }
    if ((RC.R.on && !ED.on) || ED.colocar || ED.linea || CON.T.h) return; const h = hallar(e), p = motor.enPiso(e.clientX, e.clientY), T = h && TIPOS[h.p.t], its = [];
    if (h) { elegir(h.p); its.push({ n: 'Enfocar', ic: 'enfocar', f: () => elegir(h.p, true) }); if (h.p.t === 'camara' && !RC.R.on) its.push({ n: 'Ver desde esta cámara', ic: 'ojo', f: () => XT.verCamara(h.p) }); if (T.protegido && host && host.abrirDoc) its.push({ n: 'Abrir documentación', ic: 'doc', f: () => host.abrirDoc(h.p) });
      if (ED.on && h.p.t === 'columna') its.push({ n: 'Sumar una cámara a la columna', ic: 'ojo', f: () => adosar(h.p, 'camara') }, { n: 'Sumar Wi-Fi a la columna', ic: 'equipos', f: () => adosar(h.p, 'ap') }, '-');
      if (ED.on) its.push({ n: h.p.candado ? 'Sacar candado' : 'Poner candado', ic: 'candado', f: () => { if (h.p.candado) delete h.p.candado; else h.p.candado = true; cambio(); info(); puntos(); } }, { n: 'Propiedades', ic: 'ajustes', f: () => { UI.abierta = true; info(); } }, { n: 'Duplicar', ic: 'duplicar', k: 'Ctrl D', f: duplicar }, { n: 'Girar 90°', ic: 'girar', k: 'R', f: () => girarSel(Math.PI / 2) }, '-', { n: 'Sacar', ic: T.protegido ? 'candado' : 'borrar', k: 'Supr', peligro: true, f: () => sacar(h.p) }); }
    else if (ED.on) { its.push({ n: 'Catálogo', ic: 'catalogo', k: 'Tab', f: () => catalogo(true) }); if (copia) its.push({ n: 'Pegar', ic: 'duplicar', k: 'Ctrl V', f: pegarCopia }); }
    if (p) its.push(...(its.length ? ['-'] : []), { n: 'Recorrer desde acá', ic: 'caminar', f: () => RC.paseo(true, [p.x, p.z]) });
    if (!h) its.push({ n: 'Vista general', ic: 'vista', f: () => motor.vista() }); menu(its, e.clientX, e.clientY); };

  // equipos del cliente (Ondi): los que todavía no están en la maqueta se ubican con un toque
  function panelEquipos(abrir = true) { $('#meq').hidden = !abrir; if (abrir) { $('#mcat').hidden = true; if (host && host.puertas) { leerPuertas(); listaPuertas(); } else { leerEquipos(); listaEquipos(); } } }
  function listaPuertas() { const t = ($('#meqq').value || '').toLowerCase(), usadas = new Map(E.piezas.filter(p => p.puerta && TIPOS[p.t] && TIPOS[p.t].vivo).map(p => [p.puerta, p]));
    const L = PU.lista.filter(d => !t || [d.nombre, d.equipo].join(' ').toLowerCase().includes(t)), sin = L.filter(d => !usadas.has(d.id)), con = L.filter(d => usadas.has(d.id));
    const fila = (d, u) => `<button data-pid="${esc(d.id)}" class="${u ? 'usado' : ''}"><i class="mest ${pest(d.estado)[1]}"></i><span><b>${esc(d.nombre)}</b><small>${esc(u ? lugarPuerta(usadas.get(d.id)) : d.equipo || '')}</small></span><em>${u ? 'Ver' : 'Ubicar'}</em></button>`;
    $('#meql').innerHTML = (!PU.lista.length ? '<p class="mvacio">Todavía no hay puertas. Aparecen solas al agregar un equipo.</p>' : '')
      + (sin.length ? `<h4>Sin ubicar (${sin.length})</h4>${sin.map(d => fila(d)).join('')}` : '') + (con.length ? `<h4>En el plano (${con.length})</h4>${con.map(d => fila(d, 1)).join('')}` : ''); }
  function listaEquipos() { const t = ($('#meqq').value || '').toLowerCase(), usados = new Map(E.piezas.filter(p => p.uid).map(p => [p.uid, p]));
    const L = EQ.lista.filter(d => !d.consola && (!t || [d.nombre, d.modelo, d.ip, d.mac].join(' ').toLowerCase().includes(t))), sin = L.filter(d => !usados.has(d.uid)), con = L.filter(d => usados.has(d.uid));
    const fila = (d, u) => `<button data-uid="${esc(d.uid)}" class="${u ? 'usado' : ''}"><i class="mest ${ESTADO(d.estado)}"></i><span><b>${esc(d.nombre)}</b><small>${esc([d.modelo, d.ip].filter(Boolean).join(' · '))}</small></span><em>${u ? 'Ver' : 'Ubicar'}</em></button>`;
    $('#meql').innerHTML = (EQ.errs || []).map(m => `<p class="merr">${esc(m)}</p>`).join('') + (!EQ.lista.length ? `<p class="mvacio">Todavía no hay equipos de este cliente. Enlazalo con UniFi o Meraki, o cargalos a mano en la pestaña Equipos. También podés poner equipos nuevos desde el catálogo (grupo Equipos).</p>` : '')
      + (sin.length ? `<h4>Sin ubicar (${sin.length})</h4>${sin.map(d => fila(d)).join('')}` : '') + (con.length ? `<h4>En la maqueta (${con.length})</h4>${con.map(d => fila(d, 1)).join('')}` : ''); }
  $('#meqq').addEventListener('input', () => host && host.puertas ? listaPuertas() : listaEquipos());
  $('#meql').addEventListener('click', e => { const bp = e.target.closest('[data-pid]'); if (bp) { const d = PU.porId.get(bp.dataset.pid), ya = E.piezas.find(p => p.puerta === bp.dataset.pid); if (!d) return;
      if (ya) { elegir(ya, true); return; } empezar({ t: 'acceso', clase: claseAcceso(d.nombre), puerta: d.id, nombre: d.nombre }); if (motor.tactil) $('#meq').hidden = true; return; }
    const b = e.target.closest('[data-uid]'); if (!b) return; const d = EQ.porUid.get(b.dataset.uid), ya = E.piezas.find(p => p.uid === b.dataset.uid);
    if (ya) { elegir(ya, true); return; } const t = EQ_DE[tipoReal(d)] || 'ups'; empezar({ t, uid: d.uid, nombre: d.nombre, modelo: d.modelo || '', ip: d.ip || '', mac: d.mac || '' }); if (motor.tactil) $('#meq').hidden = true; });
  // dónde está cada equipo: el galpón, la fila, la oficina o la columna más cercana
  function lugarDe(p) { const [x, z] = centro(p); let mejor = null, md = 1e9;
    for (const q of E.piezas) { if (q === p || !q.nombre || !['galpon', 'modulo', 'fila', 'alero', 'columna', 'terreno', 'rack'].includes(q.t)) continue; const T = TIPOS[q.t], v = { ...T.def, ...q }; let d;
      if (q.t === 'terreno') { d = dentro(x, z, q.pts) ? 50 : 1e9; } else { const dx = x - (q.x || 0), dz = z - (q.z || 0), c = Math.cos(-(q.r || 0)), s = Math.sin(-(q.r || 0)), lx = dx * c - dz * s, lz = dx * s + dz * c, hw = (v.ancho && q.t !== 'fila' ? v.ancho : v.largo || 4) / 2, hd = (q.t === 'fila' ? v.ancho * 1.4 : v.fondo || 4) / 2;
        d = Math.hypot(Math.max(0, Math.abs(lx) - hw), Math.max(0, Math.abs(lz) - hd)) + (q.t === 'columna' ? 2 : 0); }
      if (d < md) { md = d; mejor = q; } }
    return mejor && md < 40 ? mejor.nombre : E.nombre || 'Predio'; }
  function lugarPuerta(p) { const [x, z] = centro(p); let mejor = null, area = Infinity;
    for (const q of E.piezas) { if (q === p || !q.nombre || q._p || !['galpon', 'modulo', 'edificio', 'alero', 'recinto'].includes(q.t)) continue; let a;
      if (q.t === 'recinto') { if (!q.pts || q.pts.length < 3 || (!dentro(x, z, q.pts) && aBorde(x, z, q.pts) > 0.6)) continue; a = Math.abs(areaSig(q.pts)); }
      else { const v = { ...TIPOS[q.t].def, ...q }, dx = x - (q.x || 0), dz = z - (q.z || 0), c = Math.cos(-(q.r || 0)), s = Math.sin(-(q.r || 0)), lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) > v.ancho / 2 + 1.5 || Math.abs(lz) > v.fondo / 2 + 1.5) continue; a = v.ancho * v.fondo; }
      if (a < area) { area = a; mejor = q; } }
    return mejor ? mejor.nombre : (E.nombre || 'Predio'); }
  const aBorde = (x, z, P) => { let d = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ux = b[0] - a[0], uz = b[1] - a[1], L2 = ux * ux + uz * uz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / L2)); d = Math.min(d, Math.hypot(x - a[0] - ux * t, z - a[1] - uz * t)); } return d; };
  const dentro = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

  // manijas: en líneas y áreas, cada punto se arrastra (el del medio agrega uno, doble clic lo saca); en lo demás, una para girar y, si tiene altura, otra para subirlo o bajarlo
  const manijas = new THREE.Group(); motor.scene.add(manijas); const POSm = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }); const MAN = new THREE.SphereGeometry(1, 14, 10), MANm = new THREE.MeshBasicMaterial({ color: 0x1d9bf0, depthTest: false }), MEDm = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.85 }), ALTm = new THREE.MeshBasicMaterial({ color: 0xffb020, depthTest: false }), LINm = new THREE.LineBasicMaterial({ color: 0x1d9bf0, depthTest: false, transparent: true, opacity: 0.7 }), GIRm = new THREE.LineBasicMaterial({ color: 0xff8a1f, depthTest: false, transparent: true, opacity: 0.9 }), GIRm2 = new THREE.MeshBasicMaterial({ color: 0xff8a1f, depthTest: false });
  // lo que hay en el frente de un galpón y se puede correr: andenes (también los sin rampa), portones a nivel puestos a mano y puertas de personal
  const puertaPunta = p => (p.anexo === 'izq') !== (p.puerta === 'otra') ? p.ancho - 2.2 : 2.2;
  function fachada(p) { const out = [], AN = andenesDe(p), L = p.ancho, nv = (p.nivelEn || []).length, nr = (p.rampaEn || []).length;
    AN.forEach((q, i) => out.push({ k: 'anden', i, u: q[0], y: 3 })); nivelesDe(p, AN, L).forEach((q, i) => out.push({ k: 'nivel', i, u: q[0], y: 2.5, campo: i >= nv }));
    rampasDe(p, AN, L).forEach((q, i) => out.push({ k: 'rampa', i, u: q[0], y: 3.2, campo: i >= nr })); (p.puertasEn || []).forEach((q, i) => out.push({ k: 'puerta', i, u: Array.isArray(q) ? q[0] : q, y: (AN.length && !(Array.isArray(q) && q[1] === 'piso') ? 1.2 : 0) + 1.1 }));
    if (p.puerta !== 'no') out.push({ k: 'puerta', i: (p.puertasEn || []).length, u: puertaPunta(p), y: 1.1, campo: true }); return out; }
  // lo que venía de un campo («en la punta derecha») pasa a la lista puesta a mano, para poder correrlo o sacarlo uno por uno
  function fachFijar(p, f) { if (!f.campo) return; const AN = andenesDe(p), L = p.ancho;
    if (f.k === 'nivel') { p.nivelEn = nivelesDe(p, AN, L).map(q => [...q]); delete p.nivel; } else if (f.k === 'rampa') { p.rampaEn = rampasDe(p, AN, L).map(q => [...q]); delete p.rampa; } else if (f.k === 'puerta') { p.puertasEn = [...(p.puertasEn || []), [puertaPunta(p), 'piso']]; p.puerta = 'no'; } f.campo = false; }
  const NOMF = { anden: 'Andén', nivel: 'Portón a nivel', puerta: 'Puerta de personal', rampa: 'Rampa' };
  // el punto de la pared del frente que está bajo el puntero (sirve mirando de arriba o de frente)
  function uRayo(p, e) { const g = objs.get(p.id); if (!g) return null; const n = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, alFrente(p, 0, 0)), w = motor.rayo(e.clientX, e.clientY).ray.intersectPlane(pl, new THREE.Vector3()); return w ? uDe(p, w.x, w.z, e.altKey) : null; }
  const alFrente = (p, u, y) => { const g = objs.get(p.id); return g.localToWorld(new THREE.Vector3(-p.ancho / 2 + u, y, p.fondo / 2 + 0.7)); };
  const uDe = (p, x, z, alt) => { const g = objs.get(p.id), v = g.worldToLocal(new THREE.Vector3(x, 0, z)), q = alt ? 0.1 : 0.5; return Math.min(p.ancho - 2.5, Math.max(2.5, Math.round((v.x + p.ancho / 2) / q) * q)); };
  function fachLista(p, k) { if (k === 'rampa') return p.rampaEn || (p.rampaEn = []); if (k === 'anden') { if (!Array.isArray(p.andenesEn)) p.andenesEn = andenesDe(p).map(q => [...q]); return p.andenesEn; } if (k === 'nivel') return p.nivelEn || (p.nivelEn = []); return p.puertasEn || (p.puertasEn = []); }
  function puntos() { manijas.clear(); if (!ED.on || !SEL || SEL.candado || CON.T.h || ED.colocar || ED.linea || ED.h !== 'mano' || !objs.has(SEL.id)) return; const s = Math.max(0.12, motor.C.d * 0.006), pon = (x, y, z, m, ud, k = 1) => { const q = new THREE.Mesh(MAN, m); q.scale.setScalar(s * k); q.userData = { ...ud, k }; q.position.set(x, y, z); q.renderOrder = 9; manijas.add(q); return q; };
    const anillo = (cx, cz, rad, a) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = a - 0.96 + i / 24 * 1.92; pts.push(new THREE.Vector3(cx + Math.sin(t) * rad, 0.3, cz + Math.cos(t) * rad)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), GIRm); l.renderOrder = 9; manijas.add(l);
      // flechitas a los dos lados de la manija: se entiende que se arrastra en círculo
      for (const sg of [-1, 1]) { const b = a + sg * 0.96, q = []; q.push(new THREE.Vector3(cx + Math.sin(b) * rad, 0.3, cz + Math.cos(b) * rad)); const pu = q[q.length - 1], ta = new THREE.Vector3(Math.cos(b) * sg, 0, -Math.sin(b) * sg), ra = new THREE.Vector3(Math.sin(b), 0, Math.cos(b)), k = Math.min(rad * 0.12, s * 4);
        q.push(pu.clone().addScaledVector(ta, -k).addScaledVector(ra, k), pu, pu.clone().addScaledVector(ta, -k).addScaledVector(ra, -k)); const f = new THREE.Line(new THREE.BufferGeometry().setFromPoints(q), GIRm); f.renderOrder = 9; manijas.add(f); } };
    if (SEL.pts) { const P = SEL.pts, cerr = TIPOS[SEL.t].forma === 'area' || SEL.cerrado; P.forEach((q, i) => pon(q[0], 0.5, q[1], MANm, { vertice: i }));
      // en el cerco, una manija chica en cada poste: arrastrarla corre solo ese poste (el resto queda quieto); doble clic corta el cerco ahí para separarlo
      if (SEL.t === 'cerco') for (const [px, pz] of postesDe(SEL, ctx)) if (!P.some(q => Math.hypot(q[0] - px, q[1] - pz) < 0.3)) pon(px, 0.5, pz, POSm, { poste: [px, pz] }, 0.75); for (let i = 0; i < P.length - (cerr ? 0 : 1); i++) { const a = P[i], b = P[(i + 1) % P.length]; pon((a[0] + b[0]) / 2, 0.5, (a[1] + b[1]) / 2, MEDm, { medio: i + 1 }, 0.65); }
      if (!SEL.fijo) { const [cx, cz] = centro(SEL), rad = Math.min(motor.C.d * 0.09, Math.max(...P.map(q => Math.hypot(q[0] - cx, q[1] - cz))) + Math.max(1.2, s * 5)); pon(cx, 0.3, cz + rad, GIRm2, { giroPts: [cx, cz] }, 1.5); anillo(cx, cz, rad, 0); } return; }
    if (SEL.t === 'galpon' && SEL.estilo === 'logistico') for (const f of fachada(SEL)) { const v = alFrente(SEL, f.u, f.y); pon(v.x, v.y, v.z, f.k === 'puerta' ? GIRm2 : f.k === 'nivel' || f.k === 'rampa' ? ALTm : MEDm, { fach: f }, 1.3); }
    const T = TIPOS[SEL.t], x = SEL.x || 0, z = SEL.z || 0, r = SEL.r || 0, b = cajaDe(objs.get(SEL.id), new THREE.Box3()), rad = Math.min(motor.C.d * 0.09, Math.max(0.9, Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + Math.max(0.5, s * 3)));
    if (T.campos.some(c => c.k === 'r')) { pon(x + Math.sin(r) * rad, 0.3, z + Math.cos(r) * rad, GIRm2, { giro: 1 }, 1.5); anillo(x, z, rad, r); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.3, z), new THREE.Vector3(x + Math.sin(r) * rad, 0.3, z + Math.cos(r) * rad)]), LINm); l.renderOrder = 9; manijas.add(l); }
    if (T.campos.some(c => c.k === 'y')) pon(x, (SEL.y ?? T.def.y ?? 0) + Math.max(0.7, s * 3.5), z, ALTm, { altura: 1 });
    // manijas de medida (como empujar una pared en Los Sims): en lo que tiene ancho y fondo, una en cada borde; arrastrarla estira ese lado y el de enfrente queda quieto
    if (medidas(SEL)) { const q = { ...T.def, ...SEL }, c = Math.cos(r), sn = Math.sin(r), w = +q.ancho / 2, d = +q.fondo / 2; for (const [k, lx, lz, lado] of [['ancho', w, 0, 1], ['ancho', -w, 0, -1], ['fondo', 0, d, 1], ['fondo', 0, -d, -1]]) pon(x + lx * c + lz * sn, 0.4, z - lx * sn + lz * c, MANm, { medida: k, lado }, 1.15); } }
  const medidas = p => { const T = TIPOS[p.t]; return !T.equipo && !p.pts && T.campos.some(c => c.k === 'ancho' && c.t === 'num') && T.campos.some(c => c.k === 'fondo' && c.t === 'num'); };
  motor.cada.push(() => { const m = manijas.children.find(q => q.isMesh); if (!m) return false; const s = Math.max(0.12, motor.C.d * 0.006); if (Math.abs(m.scale.x / m.userData.k - s) > s * 0.1) { manijas.children.forEach(q => q.isMesh && q.scale.setScalar(s * q.userData.k)); return true; } return false; });

  // dónde cae un equipo que se está ubicando: en la pared que se apunta (a esa altura y mirando hacia afuera), colgado de un techo, arriba de algo, en una columna de luz cercana o en el piso
  const COLUMNAS = new Set(['columna', 'farol', 'postes']);
  function apoyar(C, e, p) { const P = C.p, T = TIPOS[P.t]; let s = null;
    if (T.equipo && !e.altKey) { const yo = objs.get(P.id), hit = motor.tocar(e.clientX, e.clientY, [...objs.values()].filter(g => g.visible && g !== yo && !TIPOS[g.userData.pieza.t].equipo)).find(h => h.face && !h.object.userData.campo);
      let hp = hit && hit.object; while (hp && !hp.userData.pieza) hp = hp.parent; hp = hp && hp.userData.pieza;
      if (hp && COLUMNAS.has(hp.t)) { const H = { ...TIPOS[hp.t].def, ...hp }.alto || 10; let nx = hit.point.x - (hp.x || 0), nz = hit.point.z - (hp.z || 0); const l = Math.hypot(nx, nz); if (l < 0.05) { nx = 0; nz = 1; } else { nx /= l; nz /= l; }
        s = { k: 'col', x: (hp.x || 0) + nx * 0.3, z: (hp.z || 0) + nz * 0.3, r: Math.atan2(nx, nz), montaje: 'pared', y: Math.round(Math.max(2.5, Math.min(H - 0.8, hit.point.y)) * 10) / 10 }; }
      else if (hit && hit.point.y > 0.4) { const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld), y = Math.round(hit.point.y * 10) / 10;
        if (Math.abs(n.y) < 0.5) s = { k: 'pared', x: hit.point.x + n.x * 0.02, z: hit.point.z + n.z * 0.02, y, r: Math.atan2(n.x, n.z), montaje: 'pared' };
        else if (n.y < 0) s = { k: 'techo', x: hit.point.x, z: hit.point.z, y, montaje: 'techo' };
        else s = { k: 'sobre', x: hit.point.x, z: hit.point.z, piso: y, y: y + ((T.def.y ?? 0) > 2 ? 1.2 : 0.02) }; }
      if (!s) { const col = E.piezas.find(q => COLUMNAS.has(q.t) && Math.hypot((q.x || 0) - p.x, (q.z || 0) - p.z) < 4.5); if (col) { let nx = p.x - (col.x || 0), nz = p.z - (col.z || 0); const l = Math.hypot(nx, nz); if (l < 0.05) { nx = 0; nz = 1; } else { nx /= l; nz /= l; } s = { k: 'col', x: (col.x || 0) + nx * 0.3, z: (col.z || 0) + nz * 0.3, r: Math.atan2(nx, nz), montaje: 'pared', y: C.tpl.y ?? Math.max(3, (col.alto || { ...TIPOS[col.t].def }.alto || 10) - (P.t === 'camara' ? 4 : 6)) }; } } }
    if (s && nivelDe(P)) { const off = nivelDe(P) * ALTO_PLANTA; if (s.y != null) s.y = Math.round((s.y - off) * 10) / 10; if (s.piso != null) s.piso = Math.round((s.piso - off) * 100) / 100; }
    for (const k of ['y', 'montaje', 'piso']) { if (s && s[k] != null) P[k] = s[k]; else if (C.tpl[k] == null) delete P[k]; else P[k] = C.tpl[k]; }
    if (s) { P.x = Math.round(s.x * 100) / 100; P.z = Math.round(s.z * 100) / 100; if (s.r != null) P.r = s.r; } else { P.x = pegar(p.x, e.altKey); P.z = pegar(p.z, e.altKey); if (P._col === 'pared') P.r = C.tpl.r || 0; }
    const firma = s ? s.k + (s.y ?? '') : ''; if (firma !== (P._col || '')) { P._col = firma; rehacer(P); }
    const g = objs.get(P.id); if (g) { g.position.set(P.x, (s ? 0 : 0.25) + nivelDe(P) * ALTO_PLANTA, P.z); g.rotation.y = P.r || 0; } motor.dirty = true; }

  // mouse: lo que el editor agarra no mueve la cámara
  let espacio = false; addEventListener('keydown', e => { if (e.key === ' ' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !RC.R.on) espacio = true; }, true); addEventListener('keyup', e => { if (e.key === ' ') espacio = false; }, true); addEventListener('blur', () => { espacio = false; });
  motor.pintaConShift = () => ED.on && (CON.T.h === 'piso' || CON.T.h === 'relieve');   // los materiales se pintan con Shift (pedido de Christian): sin Shift, el arrastre mueve el mapa
  motor.agarrar = e => { if (!ED.on || espacio || ED.fach) return false;
    if (SEL && ED.h === 'mano' && !ED.colocar && !ED.linea && !CON.T.h) { const mf = motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh && q.userData.fach))[0]; if (mf) { menu(null); const f = mf.object.userData.fach; fachFijar(SEL, f); ED.drag = { fach: f, m: mf.object }; return true; } }
    const p0 = motor.enPiso(e.clientX, e.clientY); if (!p0) return false; menu(null);
    // mientras se ubica o se dibuja algo, arrastrar mueve la vista y el toque es el que pone (solo el recinto se dibuja arrastrando)
    if (ED.colocar || ED.linea) return false; if (CON.T.h) return CON.agarrar(e, p0, null);
    const mh = SEL && ED.h === 'mano' && motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh))[0];
    if (mh) { const ud = mh.object.userData; if (ud.fach) { ED.drag = { fach: ud.fach, m: mh.object }; return true; } if (ud.giro) ED.drag = { giro: true }; else if (ud.giroPts) ED.drag = { giroPts: ud.giroPts, a0: Math.atan2(p0.x - ud.giroPts[0], p0.z - ud.giroPts[1]), hecho: 0 }; else if (ud.altura) { const n = new THREE.Vector3(Math.sin(motor.C.yaw), 0, Math.cos(motor.C.yaw)); ED.drag = { altura: new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(SEL.x || 0, 0, SEL.z || 0)) }; }
      else if (ud.medida) { const q = { ...TIPOS[SEL.t].def, ...SEL }; ED.drag = { medida: ud.medida, lado: ud.lado, w0: +q[ud.medida], x0: SEL.x || 0, z0: SEL.z || 0 }; }
      else if (ud.poste) ED.drag = { posteP: ud.poste };   /* el punto se agrega recién al arrastrar: así un doble clic en el poste lo corta */
      else if (ud.medio != null) { SEL.pts.splice(ud.medio, 0, [pegar(p0.x, e.altKey), pegar(p0.z, e.altKey)]); CON.insertado(SEL, ud.medio); ED.drag = { v: ud.medio }; rehacer(SEL); } else ED.drag = { v: ud.vertice }; return true; }
    if (ED.h === 'varias' || (ED.h === 'mano' && modif(e) && e.pointerType !== 'touch')) { const hv = hallar(e); if (hv && MULTI.has(hv.p) && !modif(e)) { tomar(hv.p, p0, e); return true; }
      if (!hv || hv.p.t === 'terreno' || hv.p.fijo || hv.p.candado) { recuadro = { x0: p0.x, z0: p0.z, suma: modif(e) }; return true; } return false; /* sobre una pieza suelta: el toque la suma y arrastrar mueve la vista */ }
    // Con la mano, arrastrar mueve la vista salvo que se agarre algo chico (un equipo, un auto, un árbol) o algo que ya estaba elegido.
    // Lo grande (galpones, edificios, calles, recintos) primero se elige con un toque; el terreno no se corre arrastrando, solo por sus puntos.
    // Con el dedo no se agarra de una lo que no estaba elegido (un arrastre corto mueve la vista): se elige con un toque o se mantiene apretado.
    const h = hallar(e); if (CON.agarrar(e, p0, h)) return true; if (h && ED.h === 'mano' && (h.p.fijo || h.p.candado) && (h.p === SEL || directo(h.p))) avisoCandado(h.p);
    if (!h || ED.h !== 'mano' || (h.p.t === 'terreno' && h.p !== SEL) || h.p.fijo || h.p.candado || MED.p || (h.p !== SEL && !MULTI.has(h.p) && (e.pointerType === 'touch' || !directo(h.p)))) return false;
    tomar(h.p, p0, e); return true; };
  const tomar = (p, p0, e) => { if (MULTI.size && !MULTI.has(p)) soltarMulti(); elegir(p); const lleva = new Set(e.altKey ? [] : CON.contenido(p)); if (MULTI.has(p)) for (const q of MULTI) if (q !== p) { lleva.add(q); for (const k of CON.contenido(q)) if (k !== p) lleva.add(k); }
    ED.drag = { p, x0: p0.x, z0: p0.z, orig: p.pts ? p.pts.map(q => [...q]) : [p.x || 0, p.z || 0], r0: p.r, y0: p.y, apoyado: !!(J && !p.pts && J.apoyada(p)), movido: false, con: [...lleva].map(q => ({ q, r: q.r, o: q.pts ? q.pts.map(k => [...k]) : [q.x || 0, q.z || 0] })) }; };
  // deja una pieza que se lleva (y lo que arrastra con ella) en un lugar dado
  function ponerEn(D, x, z, y) { const p = D.p, mx = x - D.orig[0], mz = z - D.orig[1]; p.x = x; p.z = z; if (y == null) delete p.y; else p.y = y; rehacer(p);
    for (const { q, o } of D.con) { if (q.pts) { q.pts = o.map(k => [Math.round((k[0] + mx) * 100) / 100, Math.round((k[1] + mz) * 100) / 100]); rehacer(q); } else { q.x = Math.round((o[0] + mx) * 100) / 100; q.z = Math.round((o[1] + mz) * 100) / 100; const g = objs.get(q.id); if (g) g.position.set(q.x, 0, q.z); } } }
  // «una vez que la agarro, no puedo dejarla igual que antes» (Christian, 19/11): clic derecho o Esc mientras se lleva algo lo devuelve exactamente a como estaba
  function cancelarAgarre() { const D = ED.drag; if (!D || !D.p || !D.movido) return false; ED.drag = null; const p = D.p;
    for (const c of D.con) if (!c.q.pts) { if (c.r == null) delete c.q.r; else c.q.r = c.r; const g = objs.get(c.q.id); if (g) g.rotation.y = c.q.r || 0; }
    if (p.pts) { p.pts = D.orig.map(q => [...q]); rehacer(p); for (const { q, o } of D.con) { if (q.pts) { q.pts = o.map(k => [...k]); rehacer(q); } else { q.x = o[0]; q.z = o[1]; const g = objs.get(q.id); if (g) g.position.set(q.x, 0, q.z); } } }
    else { if (D.r0 == null) delete p.r; else p.r = D.r0; ponerEn(D, D.orig[0], D.orig[1], D.y0); }
    canvas.classList.remove('lleva'); manijas.visible = true; if (MULTI.size) marcarMulti(); J && J.limpio(); marcar(); info(); CON.marcar(); motor.dirty = true; toast('Volvió a su lugar, como estaba'); return true; }
  addEventListener('mousedown', e => { if (e.button === 2) cancelarAgarre(); }, true);   // con el botón izquierdo apretado, el derecho no llega como toque: se mira acá
  // mantener apretado con el dedo sobre una pieza: la elige y la deja lista para arrastrar
  motor.agarrarLargo = e => { if (!ED.on || ED.colocar || ED.linea || CON.T.h || ED.h !== 'mano' || MED.p) return false; const p0 = motor.enPiso(e.clientX, e.clientY), h = hallar(e); if (!p0 || !h || (h.p.t === 'terreno' && h.p !== SEL)) return false; if (h.p.fijo || h.p.candado) { avisoCandado(h.p); return false; } menu(null); tomar(h.p, p0, e); canvas.classList.add('lleva'); hint('Agarrado: arrastrá para moverlo'); return true; };
  function arrastreFach(e, D) { const g = objs.get(SEL.id), n = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, alFrente(SEL, 0, 0)), w = motor.rayo(e.clientX, e.clientY).ray.intersectPlane(pl, new THREE.Vector3()); if (!w) return;
      const u = uDe(SEL, w.x, w.z, e.altKey), v = alFrente(SEL, u, D.fach.y); D.m.position.copy(v); D.u = u; D.movido = true; hint(`${NOMF[D.fach.k]} a <b>${fmt(u)} m</b> de la punta izquierda · <kbd>Alt</kbd> de a 10 cm · doble clic la saca`); }
  motor.mover = e => { if (recuadro) { const q = motor.enPiso(e.clientX, e.clientY); if (q) { const R = recuadro; R.x1 = q.x; R.z1 = q.z; if (!R.m) { R.m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf5a524, transparent: true, opacity: 0.2, depthWrite: false, depthTest: false })); R.m.renderOrder = 9; motor.scene.add(R.m); }
        R.m.scale.set(Math.abs(q.x - R.x0) || 0.01, 1, Math.abs(q.z - R.z0) || 0.01); R.m.position.set((q.x + R.x0) / 2, 0.25, (q.z + R.z0) / 2); motor.dirty = true; } return; }
    if (CON.mover(e)) return; const D = ED.drag; if (!D) return; if (MULTI.size) cajasM.visible = false;
    if (D.altura) { const v = motor.rayo(e.clientX, e.clientY).ray.intersectPlane(D.altura, new THREE.Vector3()); if (v) { const y = Math.max(0, Math.min(60, Math.round(v.y * (e.altKey ? 100 : 10)) / (e.altKey ? 100 : 10))); if (y !== SEL.y) { SEL.y = y; D.movido = true; rehacer(SEL); } } return; }
    if (D.fach) { arrastreFach(e, D); return; }
    const p = motor.enPiso(e.clientX, e.clientY); if (!p) return;
    if (D.giroPts) { const paso = e.altKey ? Math.PI / 180 : Math.PI / 12, a = Math.atan2(p.x - D.giroPts[0], p.z - D.giroPts[1]), d = Math.round((a - D.a0) / paso) * paso; if (d !== D.hecho) { CON.girar(SEL, d - D.hecho); D.hecho = d; D.movido = true; CON.marcar(); marcar(); hint(`Girado <b>${Math.round(d * 180 / Math.PI)}°</b> · <kbd>Alt</kbd> de a 1°`); } return; }
    // estirar un lado: el borde de enfrente queda quieto; se pega a la grilla de 25 cm (Alt sin imán) y a una columna que esté cerca del borde
    if (D.medida) { const r = SEL.r || 0, c = Math.cos(r), sn = Math.sin(r), dx = p.x - D.x0, dz = p.z - D.z0, eje = D.medida === 'ancho' ? 0 : 1, loc = eje ? dx * sn + dz * c : dx * c - dz * sn, opu = -D.lado * D.w0 / 2;
      let borde = e.altKey ? loc : Math.round(loc * 4) / 4; if (!e.altKey) { let mejor = 1.2; for (const q of E.piezas) { if (!COLUMNAS.has(q.t)) continue; const qx = (q.x || 0) - D.x0, qz = (q.z || 0) - D.z0, ql = eje ? qx * sn + qz * c : qx * c - qz * sn, qo = eje ? qx * c - qz * sn : qx * sn + qz * c, med = { ...TIPOS[SEL.t].def, ...SEL }[eje ? 'ancho' : 'fondo'] / 2; if (Math.abs(qo) > med + 1 || Math.abs(ql - loc) > mejor) continue; mejor = Math.abs(ql - loc); borde = ql + D.lado * 0.3; } }
      const cp = TIPOS[SEL.t].campos.find(k => k.k === D.medida), w = Math.max(cp.min || 1, Math.min(cp.max || 600, Math.round(D.lado * (borde - opu) * 100) / 100)), cl = opu + D.lado * w / 2;
      SEL[D.medida] = w; SEL.x = Math.round((D.x0 + (eje ? cl * sn : cl * c)) * 100) / 100; SEL.z = Math.round((D.z0 + (eje ? cl * c : -cl * sn)) * 100) / 100; D.movido = true; rehacer(SEL); puntos(); marcar(); hint(`${cp.n.replace(/ \(m\)/, '')}: <b>${fmt(w)} m</b> · <kbd>Alt</kbd> sin imán`); return; }
    if (D.giro) { const paso = e.altKey ? Math.PI / 180 : Math.PI / 12, r = Math.round(Math.atan2(p.x - (SEL.x || 0), p.z - (SEL.z || 0)) / paso) * paso; if (r !== (SEL.r || 0)) { D.con = D.con || CON.contenido(SEL); rotarCon(SEL, r - (SEL.r || 0), D.con); SEL.r = r; D.movido = true; const g = objs.get(SEL.id); if (g) g.rotation.y = r; marcar(); } return; }
    if (D.posteP) { if (Math.hypot(p.x - D.posteP[0], p.z - D.posteP[1]) < Math.max(0.12, motor.C.d * 0.004)) return; const i = tramoDe(SEL, D.posteP); SEL.pts.splice(i + 1, 0, [D.posteP[0], D.posteP[1]]); CON.insertado(SEL, i + 1); D.v = i + 1; D.posteP = null; hint('Moviendo un poste: el resto del cerco queda quieto · doble clic en un poste lo corta ahí'); }
    if (D.v != null) { SEL.pts[D.v] = [pegar(p.x, e.altKey), pegar(p.z, e.altKey), ...SEL.pts[D.v].slice(2)]; rehacer(SEL); CON.marcar(); return; }
    const dx = p.x - D.x0, dz = p.z - D.z0; if (!D.movido && Math.hypot(dx, dz) < motor.C.d * 0.004) return; D.movido = true; canvas.classList.add('lleva'); manijas.visible = false;
    // las líneas, áreas y recintos se corren enteros (el salto se pega a la grilla, la forma no se toca) y un recinto se lleva lo que tiene adentro
    let mx = pegar(dx, e.altKey), mz = pegar(dz, e.altKey);
    if (D.p.pts) { D.p.pts = D.orig.map(q => [Math.round((q[0] + mx) * 1000) / 1000, Math.round((q[1] + mz) * 1000) / 1000, ...q.slice(2)]);   /* la altura de cada punto (cables) se conserva */ rehacer(D.p); }
    else { const casa = !e.altKey && Math.hypot(dx, dz) < 0.3;   // cerca de donde estaba, vuelve justo ahí (aunque no estuviera en la grilla)
      D.p.x = casa ? D.orig[0] : pegar(D.orig[0] + dx, e.altKey); D.p.z = casa ? D.orig[1] : pegar(D.orig[1] + dz, e.altKey); mx = D.p.x - D.orig[0]; mz = D.p.z - D.orig[1]; let g = objs.get(D.p.id); g.position.set(D.p.x, 0.25, D.p.z);
      if (J) { J.probar(D.p, D, { ign: D.ign || (D.ign = new Set(D.con.map(c => c.q))), base: D.apoyado ? null : (D.y0 ?? null) }); g = objs.get(D.p.id); g.position.set(D.p.x, 0.25, D.p.z); if (!D.mal) D.bien = [D.p.x, D.p.z, D.p.y]; }
      cajaDe(g, caja.box).expandByScalar(0.15); motor.dirty = true; }
    for (const { q, o } of D.con) { if (q.pts) { q.pts = o.map(k => [Math.round((k[0] + mx) * 100) / 100, Math.round((k[1] + mz) * 100) / 100]); rehacer(q); } else { q.x = Math.round((o[0] + mx) * 100) / 100; q.z = Math.round((o[1] + mz) * 100) / 100; const g = objs.get(q.id); if (g) g.position.set(q.x, 0, q.z); } } };
  motor.soltar = (e, gesto) => { if (recuadro) { const R = recuadro; recuadro = null; if (R.m) { motor.scene.remove(R.m); R.m.geometry.dispose(); R.m.material.dispose(); }
      if (!gesto && R.x1 != null && Math.abs(R.x1 - R.x0) + Math.abs(R.z1 - R.z0) > 1.5) { const a = Math.min(R.x0, R.x1), b = Math.max(R.x0, R.x1), c = Math.min(R.z0, R.z1), d = Math.max(R.z0, R.z1); if (!R.suma) MULTI.clear();
        for (const q of E.piezas) { const g = objs.get(q.id); if (!g || !g.visible || q.t === 'terreno' || q.t === 'plano' || q.fijo || q.candado || q._p) continue; const [x, z] = centro(q); if (x >= a && x <= b && z >= c && z <= d) MULTI.add(q); } marcarMulti(); if (MULTI.size) { SEL = [...MULTI][0]; marcar(); info(); hint(cuantas()); } else hint('No quedó ninguna pieza adentro del recuadro'); }
      else if (!gesto) toqueEd(e); /* fue un toque, no un recuadro */
      motor.dirty = true; return; }
    if (MULTI.size) setTimeout(marcarMulti, 0); canvas.classList.remove('lleva'); manijas.visible = true; if (!gesto && CON.soltar(e)) return; const D = ED.drag; ED.drag = null; if (gesto || !D) return; if (D.p && !D.p.pts) { const g = objs.get(D.p.id); if (g) g.position.y = 0; }
    if (D.p && !D.p.pts && D.movido && D.mal) { const b = D.bien || [D.orig[0], D.orig[1], D.y0]; ponerEn(D, b[0], b[1], b[2]); toast(J.msj(D) + (D.bien ? ' Quedó en el último lugar libre.' : ' Volvió a su lugar.')); } J && J.limpio();
    if (D.fach) { if (D.movido && D.u != null) { const L = fachLista(SEL, D.fach.k), it = L[D.fach.i]; if (D.fach.k === 'puerta' && !Array.isArray(it)) L[D.fach.i] = D.u; else if (it) it[0] = D.u; if (D.fach.k === 'anden') L.sort((a, b) => a[0] - b[0]); rehacer(SEL); cambio(); } hint(''); puntos(); motor.dirty = true; return; }
    if (D.movido || D.v != null) { cambio(); marcar(); if (D.giro || D.giroPts || D.altura || D.medida) info(); if (D.medida) hint(''); if (D.giroPts) { hint(''); puntos(); } } else if (D.p && ED.h === 'varias') toqueEd(e); else if (D.p) info(); motor.dirty = true; };
  motor.pasar = e => { if (ED.on && CON.pasar(e)) return; const p = motor.enPiso(e.clientX, e.clientY);
    if (ED.colocar && p) { cajaH.visible = false; const C = ED.colocar; if (!C.p) { C.p = { ...JSON.parse(JSON.stringify(C.tpl)), id: nuevoId(C.tpl.t), x: 0, z: 0, r: C.tpl.r || 0, _p: 1 }; E.piezas.push(C.p); rehacer(C.p); } apoyar(C, e, p); if (J) J.probar(C.p, C, { base: C.tpl.y ?? null }); return; }
    if (ED.linea && p && ED.linea.rect && ED.linea.p && ED.linea.pts.length === 1) { const L = ED.linea; L.p.pts = rect(L.pts[0], [pegar(p.x, e.altKey), pegar(p.z, e.altKey)]); rehacer(L.p); return; }
    if (ED.linea && p && ED.linea.p) { const L = ED.linea; L.p.pts = [...L.pts, [pegar(p.x, e.altKey), pegar(p.z, e.altKey)]]; if (L.p.pts.length >= 2) rehacer(L.p); return; }
    if (e.pointerType !== 'mouse') return; const h = hallar(e), g = h && objs.get(h.p.id);
    if (!ED.on) { cajaH.material.color.set(0x8ecbff); cajaH.visible = !!g && h.p !== SEL && TIPOS[h.p.t].forma === 'punto' && (!motor.mirando || !!TIPOS[h.p.t].equipo); if (cajaH.visible) cajaDe(g, cajaH.box).expandByScalar(0.1); canvas.classList.toggle('sobre', !!h && TIPOS[h.p.t].forma === 'punto'); motor.dirty = true; }
    else { cajaH.visible = motor.mirando && !!g && h.p !== SEL && h.p.t !== 'terreno' && !(h.p.fijo || h.p.candado); if (cajaH.visible) { cajaH.material.color.set(ED.h === 'maza' ? 0xff453a : ED.h === 'gotero' ? 0x30d158 : 0x8ecbff); cajaDe(g, cajaH.box).expandByScalar(0.06); } if (motor.mirando) motor.dirty = true; canvas.classList.toggle('sobre', (!!h && ED.h === 'mano' && h.p.t !== 'terreno' && (h.p === SEL || directo(h.p))) || !!(SEL && motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh))[0])); } };
  // con la mira, la rueda gira lo que se tiene en la mano (lo que se está ubicando o lo que se lleva agarrado): un paso, 45°
  let ruG = 0; motor.alRueda = (e, dx, dy) => { if (!motor.mirando || !ED.on || !(ED.colocar || (ED.drag && ED.drag.p && !ED.drag.p.pts))) return false; ruG += dy; const n = Math.trunc(ruG / 60); if (n) { ruG -= n * 60; girarSel(Math.sign(n) * Math.PI / 4); if (ED.drag) ED.drag.movido = true; } return true; };
  let ultimoToque = 0;
  // lo que se arrastra sin elegirlo antes: equipos y cosas de menos de 8 m
  let avCand = 0; const avisoCandado = p => { const t = performance.now(); if (t - avCand < 2500) return; avCand = t; toast(`«${p.nombre || TIPOS[p.t].n}» tiene candado: tocalo en su ficha (arriba a la derecha) para poder moverla`); if (SEL !== p) elegir(p); };
  const directo = p => { if (p.pts) return false; if (TIPOS[p.t].equipo) return true; const g = objs.get(p.id); if (!g) return false; const b = cajaDe(g, new THREE.Box3()); return Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) < 8; };
  // un toque editando: la mano elige (tocar el terreno con otra cosa elegida solo la suelta), la maza saca y el gotero copia
  function toqueEd(e) { if (ED.fach) { const F = ED.fach; ED.fach = null; hint(''); const u = objs.has(F.p.id) ? uRayo(F.p, e) : null; if (u == null) { toast('Tocá sobre el frente del galpón'); return; }
      if (F.k === 'puerta') fachLista(F.p, 'puerta').push(u); else if (F.k === 'rampa') fachLista(F.p, 'rampa').push([u, 10, 1]); else if (F.k === 'nivel') fachLista(F.p, 'nivel').push([u, null]); else { const L = fachLista(F.p, 'anden'); L.push(F.k === 'simple' ? [u, null, 'simple'] : [u, null]); L.sort((a, b) => a[0] - b[0]); }
      rehacer(F.p); cambio(); elegir(F.p); toast('Listo: arrastrá la manija para ajustarlo'); return; }
    if (ED.colocar || ED.linea || CON.T.h || MED.p) return; const h = hallar(e);
    if (ED.h === 'varias' || (ED.h === 'mano' && modif(e))) { if (h && h.p.t !== 'terreno' && !(h.p.fijo || h.p.candado)) { if (!MULTI.size && SEL && SEL !== h.p && SEL.t !== 'terreno' && !SEL.fijo) MULTI.add(SEL); MULTI.has(h.p) ? MULTI.delete(h.p) : MULTI.add(h.p); marcarMulti(); const q = MULTI.has(h.p) ? h.p : [...MULTI][0]; if (q) { SEL = q; CON.alElegir(q); marcar(); info(); } hint(MULTI.size ? cuantas() : PISTA.varias); } else if (!modif(e)) { soltarMulti(); hint(PISTA.varias); } return; }
    if (ED.h === 'maza') { if (!h) return; const q = motor.enPiso(e.clientX, e.clientY), P = h.p;
      if (q && !e.shiftKey && !P.candado && P.t === 'losas') { const c = P.celda || 5, i = Math.floor((q.x - (P.x || 0)) / c), j = Math.floor((q.z - (P.z || 0)) / c), k = P.celdas.findIndex(w => w[0] === i && w[1] === j); if (k >= 0) { P.celdas.splice(k, 1); if (!P.celdas.length) quitar(P); else rehacer(P); cambio(); return; } }
      if (q && !e.shiftKey && !P.candado && P.pts && TIPOS[P.t].forma === 'linea' && P.pts.length > 2) { let bi = 0, bd = 1e9; for (let i = 1; i < P.pts.length; i++) { const a = P.pts[i - 1], b = P.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (q.z - a[1]) * dz) / L2)), d = Math.hypot(q.x - a[0] - t * dx, q.z - a[1] - t * dz); if (d < bd) { bd = d; bi = i; } }
        const A = P.pts.slice(0, bi), B = P.pts.slice(bi); delete P.cerrado; if (A.length >= 2) { P.pts = A; rehacer(P); if (B.length >= 2) { const n2 = { ...JSON.parse(JSON.stringify(P)), id: nuevoId(P.t), pts: B }; delete n2.uid; E.piezas.push(n2); rehacer(n2); } } else { P.pts = B; rehacer(P); }
        cambio(); toast('Tramo sacado · Shift+maza saca la línea entera'); return; }
      sacar(P); return; } if (ED.h === 'gotero') { if (!h) return; const c = JSON.parse(JSON.stringify(h.p)); delete c.id; delete c.uid; delete c.doc; delete c.pts; delete c.huecos; delete c.lados; empezar(c); return; }
    if (h && CON.tocar(h)) return; CON.sub = null; elegir(!h || (h.p.t === 'terreno' && SEL && SEL !== h.p) ? null : h.p); }
  motor.alTocar = e => { const retoma = RC.R.on && !motor.mirando && e.pointerType === 'mouse' && RC.puedeMira(), h = hallar(e);
    // recorriendo en la compu, el mundo se toca con la mira y el puntero suelto es para los paneles: un clic en la maqueta con el mouse suelto lo retoma
    // (salvo que se esté ubicando o dibujando algo con el puntero, o que se toque un equipo sin estar editando: ahí se abre su ficha)
    if (retoma && !ED.colocar && !ED.linea && !CON.T.h && !MED.p && (ED.on || !(h && TIPOS[h.p.t].equipo) && !equipoCerca(e.clientX, e.clientY))) { motor.mira(true); return; }
    if (ED.on) { toqueEd(e); return; }
    if (RC.R.on) { const eq = h && TIPOS[h.p.t].equipo ? h.p : equipoCerca(e.clientX, e.clientY); if (eq) { elegir(eq); motor.mira(false); return; } if (motor.mirando) return; const p = motor.enPiso(e.clientX, e.clientY, RC.R.y); if (p) RC.irA(p.x, p.z); return; }
    if (host && host.alTocar) { const q = motor.enPiso(e.clientX, e.clientY); if (host.alTocar(h ? h.p : null, q ? [q.x, q.z] : null)) return; }   // la app puede quedarse con el toque (Olumi abre el área de la sala)
    elegir(h && TIPOS[h.p.t].equipo ? h.p : equipoCerca(e.clientX, e.clientY, 22) || (h ? h.p : null)); };
  // doble clic: mirando, acerca a lo que se toca (o vuela a ese lugar del piso) y abre la documentación de un rack; editando, saca un punto de una línea
  motor.alDoble = e => { if ((RC.R.on && !ED.on) || ED.colocar || ED.linea || CON.T.h) return; const h = hallar(e);
    if (ED.on && SEL && SEL.t === 'galpon') { const mf = motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh && q.userData.fach))[0]; if (mf) { const f = mf.object.userData.fach; fachFijar(SEL, f); fachLista(SEL, f.k).splice(f.i, 1); rehacer(SEL); cambio(); puntos(); toast(NOMF[f.k] + ': sacado'); return; } }
    if (ED.on && SEL && SEL.t === 'cerco') { const mp = motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh && q.userData.poste))[0]; if (mp) { cortarCerco(SEL, mp.object.userData.poste); return; } }
    if (ED.on) { const mh = SEL && SEL.pts && motor.tocar(e.clientX, e.clientY, manijas.children.filter(q => q.isMesh))[0], i = mh && mh.object.userData.vertice; if (i != null) { if (SEL.pts.length <= (TIPOS[SEL.t].forma === 'area' ? 3 : 2)) { toast('No se puede sacar: quedaría sin forma'); return; } SEL.pts.splice(i, 1); CON.quitado(SEL, i); rehacer(SEL); CON.marcar(); cambio(); return; } }
    if (h && TIPOS[h.p.t].protegido && host && host.abrirDoc) { host.abrirDoc(h.p); return; } if (ED.on) return;
    if (h && TIPOS[h.p.t].forma === 'punto') { elegir(h.p, true); return; } const p = motor.enPiso(e.clientX, e.clientY); if (p) motor.ir({ tx: p.x, tz: p.z, d: Math.max(motor.C.min * 3, motor.C.d * 0.55) }, 0.6); };
  let abajo = null; canvas.addEventListener('pointerdown', e => { abajo = [e.clientX, e.clientY]; }, true);
  canvas.addEventListener('pointerup', e => { if (!ED.on || e.button !== 0) return; if (abajo && Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 6 && CON.T.h !== 'recinto') return;   // fue un arrastre para moverse, no un toque
    const p = motor.enPiso(e.clientX, e.clientY); if (!p) return; if (MED.p) { medirPunto([p.x, p.z]); return; } if (CON.clic(e, p)) return;
    if (ED.colocar && !ED.colocar.p) motor.pasar(e);
    if (ED.colocar && ED.colocar.p) { const C = ED.colocar; if (J) { J.probar(C.p, C, { base: C.tpl.y ?? null }); if (C.mal) { toast(J.msj(C)); return; } J.limpio(); } const nuevo = C.p, sigue = e.shiftKey || motor.mirando; delete nuevo._col; delete nuevo._p; rehacer(nuevo); C.p = null; if (!sigue) { ED.colocar = null; herrVis(null); toast(`${TIPOS[nuevo.t].n} ubicado`); } elegir(sigue ? null : nuevo); cambio(); if (sigue) motor.pasar(e); return; }   // con la mira queda en la mano para seguir poniendo (clic derecho la guarda)
    if (ED.linea) { const L = ED.linea, ahora = performance.now(), dbl = ahora - ultimoToque < 320; ultimoToque = ahora; const q = [pegar(p.x, e.altKey), pegar(p.z, e.altKey)];
      if (L.molde) { const n = { ...JSON.parse(JSON.stringify(L.tpl)), id: nuevoId(L.tpl.t) }; delete n.molde; n.pts = n.pts.map(k => [Math.round((k[0] + q[0]) * 100) / 100, Math.round((k[1] + q[1]) * 100) / 100]); E.piezas.push(n); rehacer(n);
        if (!e.shiftKey) { ED.linea = null; herrVis(null); } elegir(n); cambio(); toast(`${n.nombre} ubicado · R lo gira · la puerta y las ventanas se apoyan en sus paredes`); return; }
      if (L.rect && !L.sigue) { if (!L.pts.length) { L.pts.push(q); L.p = { ...JSON.parse(JSON.stringify(L.tpl)), id: nuevoId(L.tpl.t), pts: rect(q, [q[0] + 0.1, q[1] + 0.1]), _p: 1 }; E.piezas.push(L.p); rehacer(L.p); return; }
        if (Math.abs(q[0] - L.pts[0][0]) < 0.3 || Math.abs(q[1] - L.pts[0][1]) < 0.3) { toast('El rectángulo quedó sin ancho: tocá la esquina opuesta'); return; } L.pts = rect(L.pts[0], q); L.p.pts = [...L.pts]; cerrarRect(L); L.pts = L.p.pts; terminarLinea(); return; }
      if (dbl) { terminarLinea(); return; } L.pts.push(q); if (!L.p) { L.p = { ...JSON.parse(JSON.stringify(L.tpl)), id: nuevoId(L.tpl.t), pts: [...L.pts], _p: 1 }; E.piezas.push(L.p); } L.p.pts = [...L.pts]; if (L.pts.length >= 2) rehacer(L.p); } });
  const rect = (a, b) => [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
  // un rectángulo ya cerrado: el área queda con sus 4 esquinas; un cerco o una pared con 4 lados (cerrado); una calle o línea, con la vuelta completa
  function cerrarRect(L) { const T = TIPOS[L.tpl.t], P = L.p.pts; if (T.forma === 'area') return; if ('cerrado' in (T.def || {}) || T.campos.some(c => c.k === 'cerrado')) L.p.cerrado = true; else L.p.pts = [...P, [...P[0]]]; }
  const hintLinea = (T, L) => hint(L && L.rect ? `<b>${esc(T.n)}</b> · <b>rectángulo</b>: tocá una esquina y después la opuesta · <kbd>T</kbd> vuelve a punto por punto · <kbd>Esc</kbd> cancela`
    : `<b>${esc(T.n)}</b>: tocá cada ${T.forma === 'area' ? 'esquina' : 'punto'}. Doble clic o <kbd>Enter</kbd> termina · <kbd>T</kbd> rectángulo · <kbd>Retroceso</kbd> borra el último · <kbd>Esc</kbd> cancela${L && L.sigue ? ' (lo que ya estaba queda)' : ''}`);
  // seguir dibujando una línea que ya existe (un cerco, una pared, una calle) desde su punta final
  function seguirLinea(p) { if (!p || !p.pts || TIPOS[p.t].forma !== 'linea') return; cancelar(true); ED.linea = { tpl: p, pts: p.pts.map(q => [...q]), p, sigue: p.pts.map(q => [...q]) }; elegir(null); hintLinea(TIPOS[p.t], ED.linea); herrVis('ubicar'); }
  function terminarLinea() { const L = ED.linea; if (!L) return; const min = TIPOS[L.tpl.t].forma === 'area' ? 3 : 2; if (L.p && L.pts.length >= min) { L.p.pts = [...L.pts]; delete L.p._p; L.sigue = null; rehacer(L.p); const p = L.p; L.p = null; ED.linea = null; herrVis(null); elegir(p); cambio(); toast(`${TIPOS[p.t].n} listo`); } else { cancelar(); toast('Faltan puntos'); } }
  addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; } const k = motor.canon(e.key.toLowerCase()), mod = e.ctrlKey || e.metaKey;   // cada tecla pasa por las que eligió el jugador (Ajustes)
    if (k === 'escape') { if (ED.fach) { ED.fach = null; hint(''); return; } if (cancelarAgarre()) return; if (MED.p) { finMedir(); hint(''); toast('La escala quedó como estaba'); return; } if (!$('#mmenu').hidden) { menu(null); return; } if (!$('#mcat').hidden) { $('#mcat').hidden = true; retomar(); return; } if (!$('#meq').hidden) { $('#meq').hidden = true; return; } if (CON.cancelar()) return; if (ED.colocar || ED.linea) { cancelar(); return; }
      if (CON.sub) { CON.sub = null; info(); return; } if (SEL) { elegir(null); return; } if (ED.h !== 'mano' && ED.on) { herramienta('mano'); return; }
      J.pausa(true); return; }   // sin nada más que cerrar, Esc abre el menú de pausa (antes salía de editar o de la pantalla completa: eso ahora está en el menú)
    if (RC.R.on && ['w', 'a', 's', 'd', 'q', 'e', 'v', ' '].includes(k)) return;   // recorriendo, esas teclas son del muñeco
    if (k === 'f' && !mod && puede) { editar(!ED.on); return; }
    if ((k === 'pageup' || k === 'pagedown') && ED.on) { e.preventDefault(); planta(PL.act + (k === 'pageup' ? 1 : -1)); return; }
    if (k === 'p' && !mod) { paredes({ alta: 'corte', corte: 'baja', baja: 'alta' }[ctx.paredes]); return; }
    // cada botón de la pantalla tiene su letra (así no hace falta soltar el mouse para usarlos) y M suelta o vuelve a tomar el mouse recorriendo
    if (!mod && !e.repeat) { if (k === 'm' && RC.R.on && RC.puedeMira()) { if (motor.mirando) motor.mira(false); else { $('#mcat').hidden = true; motor.mira(true); } return; }
      if (k === 'x' && !ED.linea) { pelar(PEL.k + (e.shiftKey ? -1 : 1)); return; }
      const bk = { l: 'btema', j: 'bcapas', u: 'bvista', c: 'bpaseo', o: 'bfull', t: !ED.linea && !ED.colocar && !CON.T.h ? 'bplano' : '' }[k], bb = bk && $('#' + bk); if (bb) { bb.click(); return; } }
    if (!ED.on) return;
    if (mod && k === 'z') { e.preventDefault(); volver(e.shiftKey ? redo : undo, e.shiftKey ? undo : redo); return; } if (mod && k === 'y') { e.preventDefault(); volver(redo, undo); return; } if (mod && k === 'd') { e.preventDefault(); duplicar(); return; }
    if (mod && k === 'c' && SEL) { copia = JSON.stringify(SEL); toast('Copiado · Ctrl+V lo ubica'); return; } if (mod && k === 'v' && copia) { e.preventDefault(); pegarCopia(); return; }
    if (mod) return; if (CON.tecla(e, k)) return;
    if (k === 'tab' || k === 'i') { e.preventDefault(); catalogo($('#mcat').hidden); return; }
    if (/^[0-9]$/.test(k)) { J.usar(k === '0' ? 9 : +k - 1); return; }   // la barra rápida: 1 a 9 y 0
    const atajo = { h: 'mano', v: 'varias', k: 'maza', e: 'gotero', b: 'pared', n: 'recinto' }[k]; if (atajo) { herramienta(atajo); return; }
    if (k === 'g') { $('#bgrid').click(); return; }
    if (k === 't' && ED.linea && !ED.linea.sigue) { const L = ED.linea; L.rect = !L.rect; if (L.p) { quitar(L.p, true); L.p = null; } L.pts = []; hintLinea(TIPOS[L.tpl.t], L); return; }
    if (k === 'enter' && ED.linea) terminarLinea(); if (k === 'backspace' && ED.linea) { e.preventDefault(); ED.linea.pts.pop(); if (ED.linea.p) { ED.linea.p.pts = [...ED.linea.pts]; if (ED.linea.pts.length >= 2) rehacer(ED.linea.p); } return; }
    if ((k === 'delete' || k === 'backspace') && SEL) { e.preventDefault(); sacar(SEL); return; }
    const giro = k === ',' ? -Math.PI / 4 : k === '.' ? Math.PI / 4 : k === 'r' ? Math.PI / 2 : 0; if (giro) girarSel(giro); });
  const CON = construir({ motor, mundo, objs, TIPOS, canvas, ED, svg, esc, get E() { return E; }, get SEL() { return SEL; }, rehacer, quitar, cambio, elegir, nuevoId, hint, toast, herrVis, ficha: info, get planta() { return PL.act; }, nomPlanta: NOM_PLANTA });

  // ---------- guardar ----------
  let guardT = null; const estado = t => { const s = $('#mguar'); if (s) s.textContent = t; };
  function snapshot() { const ext = E.piezas.filter(p => p.uid).map(p => ({ uid: p.uid, id: p.id, nombre: p.nombre || '', lugar: lugarDe(p), nave: '' }));
    const pu = E.piezas.filter(p => p.puerta && TIPOS[p.t] && TIPOS[p.t].vivo && !p._p).map(p => ({ puerta: p.puerta, id: p.id, lugar: lugarPuerta(p) }));
    return { ...((host && host.state) || {}), v: 1, motor: 1, escena: { ...E, piezas: JSON.parse(limpio()) }, ext, ...(pu.length && { puertas: pu }) }; }
  function guardar() { if (!puede) return; estado('Guardando…'); clearTimeout(guardT); guardT = setTimeout(() => { const s = JSON.parse(JSON.stringify(snapshot()));
      if (host && host.save) { host.save(s); if (host) host.state = s; estado('Guardado ' + new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })); }
      else { try { localStorage.setItem(o.clave || 'motor.escena', JSON.stringify(s)); estado('Guardado en este navegador'); } catch (er) { estado('No se pudo guardar'); } }
      o.alGuardar && o.alGuardar(s); }, 900); }

  // ---------- animación de equipos caídos y medición ----------
  // recorrer a pie con el avatar (recorrer.js). Se puede editar mientras se recorre: V cambia entre tercera persona, ojos y vuelo.
  const RC = recorrer({ motor, mundo, objs, TIPOS, svg, esc, elegir, apuntado: () => { if (!motor.mirando) return null; const r = canvas.getBoundingClientRect(); return equipoCerca(r.left + r.width / 2, r.top + r.height / 2, 40); }, AVM: () => AVM, completa: host && host.juego ? on => pantalla(on) : null, llena: () => document.documentElement.classList.contains('mfull'),
    avatar: async g => { await cargarGLB('avatares', (host && host.personaje) || motor.aj.personaje || 'tec-h', g, null, 'yo-paseo'); for (const ob of PERS) if (ob.dueño === g) { PERS.delete(ob); return ob; } return null; } });
  $('#bpaseo').addEventListener('click', () => { if (!ED.on) elegir(null); if (XT.camara) XT.verCamara(null); RC.paseo(!RC.R.on); });
  // «Salir de la maqueta» (menú de pausa): deja de recorrer y de editar, sale de la pantalla completa y le avisa a la app (host.salir); sola, vuelve a la vista general
  function salir() { if (RC.R.on) RC.paseo(false); if (ED.on) editar(false); elegir(null); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.documentElement.classList.contains('mfull')) pantalla(false);
    if (host && host.salir) { try { host.salir(); } catch (er) {} } else $('#bvista').click(); }
  J = juego({ motor, objs, TIPOS, svg, esc, raiz, app, host, toast, canvas, HERR, puede, rehacer, ofertas, elegirOferta, herramienta, editar, minis, salir, cancelarAgarre, get E() { return E; }, get ED() { return ED; }, get RC() { return RC; },
    iconoOferta: k => { const of = CATO.get(k) || ofertas().find(x => x.key === k); return of ? iconoOf(of) : ''; }, construyendo: () => !!CON.T.h, panelAbierto: () => !$('#mconf').hidden, alternarPaseo: () => $('#bpaseo').click(),
    personajes: ((TIPOS.persona && TIPOS.persona.campos.find(c => c.k === 'modelo')) || { ops: [] }).ops });
  // recorrido de presentación, vista desde una cámara y hora real (extras.js)
  // el pulso de luz de las fibras: se corre la textura; solo pide dibujar si hay fibras a la vista
  let hayFibra = 0, tFib = 0; motor.cada.push(dt => { if (!AMB.flujo) return false; tFib -= dt; if (tFib <= 0) { tFib = 1.5; hayFibra = capas.fibra !== false && E.piezas.some(q => q.t === 'fibra' && !(q.y > 0)); } if (!hayFibra) return false; AMB.flujo.offset.y -= dt * 0.42; return true; });
  const XT = extras({ motor, objs, raiz, TIPOS, AMB, real: app === 'ondi', lugar: (o.lugar || (host && host.lugar)) || null, alClima: k => document.querySelectorAll('[data-clima]').forEach(b => b.setAttribute('aria-pressed', b.dataset.clima === k)), get E() { return E; }, toast, aplicarCapas, temaFijo: !!(o.tema || (host && host.tema)) });
  $('#bpres').addEventListener('click', () => { $('#mcapas').hidden = true; if (RC.R.on) RC.paseo(false); if (ED.on) editar(false); elegir(null); XT.presentar(true); });
  // camiones que entran, atracan y salen (transito.js): solo en Ondi, de ejemplo, y solo si hay naves con andenes
  TR = app === 'ondi' ? transito({ motor, mundo, get E() { return E; }, get objs() { return objs; }, aviso: m => toast(m), subtitulo }) : null; if (TR && capas.transito === false) TR.ver(false);
  // las personas respiran y cambian el peso de pierna (unos 24 cuadros por segundo, solo de cerca y con la página a la vista: lejos no se nota y gasta batería)
  motor.cada.push((dt, t) => { if (!PERS.size || motor.C.d > 150 || document.hidden) return false; avAcc += dt; if (avAcc < 1 / 24) return false; const d = avAcc; avAcc = 0;
    for (const ob of PERS) { if (!ob.dueño.parent) { PERS.delete(ob); continue; } AVM.avPose(ob, ob.dueño.userData.pose === 'sentado' ? 'sit' : 'idle', d, { x: 0, y: 0, t: t / 1000 + ob.semilla, asiento: 0.47, teclado: true }); ob.sync(); } return true; });   // sentada: en su silla, con las manos en el teclado
  motor.cada.push((dt, t) => { let x = false; for (const p of E.piezas) { const g = objs.get(p.id); if (g && g.userData.estado === 'crit' && g.userData.aro) { g.userData.aro.material.opacity = 0.45 + 0.45 * Math.sin(t * 0.008); x = true; } } return x; });
  if (/[?&]medir=1/.test(location.search)) { const s = $('#mstats'); s.hidden = false; setInterval(() => { const m = motor.stats; s.textContent = `${m.fps} c/s · ${m.ms} ms · ${m.dibujos} dibujos · ${Math.round(m.triangulos / 1000)} mil triángulos`; }, 700); }
  addEventListener('message', e => { const d = e.data || {}; if (d.tema) motor.ponerTema(d.tema === 'dark' || d.tema === 'oscuro' ? 'oscuro' : 'claro'); });
  let elegido = false; try { elegido = !!localStorage.getItem('motor.tema'); } catch (e) {}
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', m => { if (!o.tema && !(host && host.tema) && !elegido) motor.ponerTema(m.matches ? 'oscuro' : 'claro'); });
  // día o noche: lo elige cada uno y queda guardado en su navegador
  // el botón de día y noche recorre las cuatro horas: mañana, mediodía, hora azul y noche
  $('#btema')?.addEventListener('click', () => { elegido = true; XT.siguienteHora(); });
  document.addEventListener('fullscreenchange', () => document.documentElement.classList.toggle('mfull', !!document.fullscreenElement));

  armarTodo();
  const enc = E.inicio || encuadre(); motor.inicio(enc); if (o.intro !== false) { Object.assign(motor.C, { ...enc, d: enc.d * 1.35, yaw: enc.yaw - 0.45, pitch: Math.min(1.2, enc.pitch + 0.2) }); motor.ir(enc, 1.8); }
  // la app pidió ir a una pieza (por ejemplo «Ver en la maqueta» desde la documentación): se la elige y se la enfoca
  if (host && host.ir) { const pi = E.piezas.find(q => q.id === host.ir); if (pi) setTimeout(() => elegir(pi, true), 500); }
  const api = { multi: () => [...MULTI].map(q => q.id), importar, vivo, leerPuertas, subirPlano, medir, lugarPuerta, motor, E, objs, TR, XT, PASEO: RC.R, paseo: RC.paseo, fisica: RC, irA: RC.irA, CON, ED, elegir, editar, herramienta, empezar, paredes, guardar, juego: J, cancelarAgarre, salir, snapshot, armarTodo, leerEquipos, lugarDe, get sel() { return SEL; }, cargar(esc2) { E = normal(esc2); api.E = E; foto = limpio(); undo.length = redo.length = 0; SEL = null; armarTodo(); info(); $('#mnom').textContent = E.nombre; motor.inicio(E.inicio || encuadre()); motor.vista(); } };
  return api;
}
function dentroDe([x, z], P) { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; }
function normal(e) { e = JSON.parse(JSON.stringify(e || {})); e.v = 1; e.piezas = (e.piezas || []).filter(p => p && p.t && TIPOS[p.t]); let n = 0; const ids = new Set(); for (const p of e.piezas) { if (!p.id) p.id = p.t.slice(0, 3) + 'x' + (n++); if (ids.has(p.id)) { let i = 2; while (ids.has(p.id + '-' + i)) i++; p.id += '-' + i; } ids.add(p.id); } return e; }
// las personas del catálogo vienen con los brazos abiertos: se bajan al costado del cuerpo
function brazos(p) { p.updateMatrixWorld(true); const B = {}; p.traverse(o => { if (o.isBone) B[o.name.replace(/^mixamorig:?/, '')] = o; }); if (!B.LeftArm) return;
  const wp = n => B[n].getWorldPosition(new THREE.Vector3()), gira = (n, a, b, s) => { if (!B[n] || !B[b]) return; const d = wp(b).sub(wp(a)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(s * 0.12, -1, 0.04).normalize()), pw = B[n].parent.getWorldQuaternion(new THREE.Quaternion()), bw = B[n].getWorldQuaternion(new THREE.Quaternion());
    B[n].quaternion.copy(pw.invert().multiply(q).multiply(bw)); p.updateMatrixWorld(true); };
  const s = Math.sign(wp('LeftArm').x - wp('RightArm').x) || 1; gira('LeftArm', 'LeftArm', 'LeftForeArm', s); gira('LeftForeArm', 'LeftForeArm', 'LeftHand', s); gira('RightArm', 'RightArm', 'RightForeArm', -s); gira('RightForeArm', 'RightForeArm', 'RightHand', -s); }

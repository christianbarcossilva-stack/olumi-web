// Motor común · la capa de juego (19/11/2026). Christian: «estamos construyendo un motor potente, como si fuera un juego de computadora».
//  1. Barra rápida: diez casilleros (teclas 1 a 9 y 0). En cada uno va una herramienta o una cosa del inventario. Se cambian arrastrando: del
//     inventario (Tab) a la barra, de un casillero a otro (se cruzan) o afuera de la barra (se vacía). Se guarda en el equipo, una barra por app.
//  2. Menú de pausa (Esc): Volver, Ajustes, Terminar de editar, Dejar de recorrer, Salir de la maqueta.
//  3. Ajustes: sensibilidad del mouse, eje invertido, una tecla por acción, personaje, dejar encimar.
//  4. Reglas de ubicar: una cosa no entra adentro de otra ni atraviesa una pared («No entra ahí»), y lo que va arriba de una mesa se apoya en la mesa.
// Este módulo no guarda nada del jugador: los ajustes cuelgan de `motor` (motor.aj, motor.canon), porque un módulo importado con dos direcciones
// distintas se carga dos veces. Los paneles se arman acá adentro, sin depender de quién los abre, para poder dibujarlos mañana en un plano 3D (VR).
import { THREE } from './nucleo.js?v=16';

export function juego(M) {
  const { motor, objs, TIPOS, svg, esc, raiz, app, host, toast, canvas } = M, $ = (s, r = document) => r.querySelector(s);

  // ======================================================= 4. reglas de ubicar =======================================================
  // Lo que ocupa lugar en el piso. Queda afuera lo que se cuelga o se pega (cámaras, luces, paneles), la gente (se sienta en las sillas),
  // lo que es terreno o trazo (calles, canteros, cercos) y lo que contiene a otras cosas (galpones, módulos, edificios: esos cuentan por sus paredes).
  const SOLIDO = new Set(['mueble', 'vehiculo', 'rack', 'gabinete', 'ups', 'maquina', 'camion', 'chasis', 'arbol', 'tanque', 'escultura', 'columna', 'farol', 'cinta', 'pallets', 'fila', 'parada']);
  const ARRIBA = /^(computerScreen|laptop|televisionModern|kitchenCoffeeMachine|cardboardBoxClosed)$/;   // se apoyan sobre un mueble
  const ABAJO = /^(chair|chairDesk|chairModernCushion|stoolBar|trashcan)$/, MESA = /^(desk|deskCorner|table|tableCross|tableRound|tableCoffee|kitchenBar)$/;   // una silla entra abajo de una mesa
  const inv = new THREE.Matrix4(), m4 = new THREE.Matrix4(), mi = new THREE.Matrix4(), bx = new THREE.Box3(), b2 = new THREE.Box3(), v3 = new THREE.Vector3(), w3 = new THREE.Vector3();
  // la huella de una pieza: su caja en sus propios ejes (vale aunque esté girada). Se recuerda mientras no cambien sus mallas (un modelo puede llegar después).
  function huella(g) { let f = 0; g.traverse(k => { if (k.isMesh) f += 1 + (k.geometry.attributes.position ? k.geometry.attributes.position.count : 0); }); const ud = g.userData; if (ud._hu && ud._hu.f === f) return ud._hu;
    g.updateMatrixWorld(true); inv.copy(g.matrixWorld).invert(); bx.makeEmpty(); let alto = 0;
    g.traverse(k => { if (!k.isMesh || !k.visible || k.userData.campo || k.userData.noChoca) return; if (!k.geometry.boundingBox) k.geometry.computeBoundingBox(); m4.multiplyMatrices(inv, k.matrixWorld);
      const suma = () => { if (b2.max.y - b2.min.y < 0.03 && b2.max.y < 0.08) return; if (b2.min.y > 2.5) { alto = Math.max(alto, b2.max.y); return; } bx.union(b2); };   // lo chato pegado al piso no ocupa lugar; lo que está arriba de 2,5 m (brazos y focos de una columna, una copa) no ocupa lugar en el piso
      if (k.isInstancedMesh) { for (let i = 0; i < Math.min(k.count, 400); i++) { k.getMatrixAt(i, mi); b2.copy(k.geometry.boundingBox).applyMatrix4(mi.premultiply(m4)); suma(); } }
      else { b2.copy(k.geometry.boundingBox).applyMatrix4(m4); suma(); } });
    return ud._hu = bx.isEmpty() ? { f, vacia: true } : { f, cx: (bx.min.x + bx.max.x) / 2, cz: (bx.min.z + bx.max.z) / 2, hx: (bx.max.x - bx.min.x) / 2, hz: (bx.max.z - bx.min.z) / 2, y0: bx.min.y, y1: Math.max(bx.max.y, alto) }; }
  // un punto del mundo, en los ejes de la pieza
  const aLocal = (g, x, z) => { const dx = x - g.position.x, dz = z - g.position.z, c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y); return [dx * c - dz * s, dx * s + dz * c]; };
  const aMundo = (g, x, z) => { const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y); return [g.position.x + x * c + z * s, g.position.z - x * s + z * c]; };
  const adentro = (H, g, x, z, m = 0.02) => { const [lx, lz] = aLocal(g, x, z); return Math.abs(lx - H.cx) <= H.hx - m && Math.abs(lz - H.cz) <= H.hz - m; };
  // cuánto de la huella A cae adentro de la B (0 a 1), probando una grilla de puntos
  function parte(Ha, ga, Hb, gb) { let n = 0; const N = 6; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const [x, z] = aMundo(ga, Ha.cx + Ha.hx * ((i + 0.5) / N * 2 - 1) * 0.94, Ha.cz + Ha.hz * ((j + 0.5) / N * 2 - 1) * 0.94); if (adentro(Hb, gb, x, z)) n++; } return n / (N * N); }
  // ¿un tramo de pared cruza la huella? (el tramo, en los ejes de la pieza, contra su rectángulo achicado: apoyar contra la pared se puede, atravesarla no)
  function cruza(H, x0, z0, x1, z1) { const hx = Math.max(0.03, H.hx - 0.12), hz = Math.max(0.03, H.hz - 0.12); let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0;
    for (const [p, q] of [[-dx, x0 - (H.cx - hx)], [dx, (H.cx + hx) - x0], [-dz, z0 - (H.cz - hz)], [dz, (H.cz + hz) - z0]]) { if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; } const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
    return t1 - t0 > 1e-6 || (t0 <= t1 && Math.abs(dx) + Math.abs(dz) < 1e-6); }
  const nombreDe = q => { const T = TIPOS[q.t]; if (q.t === 'mueble' && T.variantes) { const v = T.variantes.find(v => v.o.modelo === q.modelo); if (v) return v.n; } return q.nombre || T.n; };
  // ¿entra la pieza donde está? Devuelve { ok, por } y, para lo que se apoya, la altura a la que queda (y) o null si va al piso.
  function entra(p, o = {}) { const g = objs.get(p.id), res = { ok: true }; if (!g || p.pts || !SOLIDO.has(p.t) || p.montaje) return res; const H = huella(g); if (H.vacia) return res;
    const alto = H.y1 - H.y0, sube = p.t === 'mueble' && ARRIBA.test(p.modelo || ''), [cx, cz] = aMundo(g, H.cx, H.cz), E = M.E; let apoyo = null; const cerca = [];
    for (const q of E.piezas) { if (q === p || q._p || q.pts || !SOLIDO.has(q.t) || (o.ign && o.ign.has(q))) continue; const gq = objs.get(q.id); if (!gq || !gq.visible) continue;
      if (Math.abs((q.x || 0) - cx) > 30 || Math.abs((q.z || 0) - cz) > 30) continue; const Hq = huella(gq); if (Hq.vacia || Hq.y1 - Hq.y0 < 0.08) continue;   // una alfombra no estorba
      if (Math.hypot(gq.position.x - cx, gq.position.z - cz) > Math.hypot(H.hx, H.hz) + Math.hypot(Hq.hx, Hq.hz) + Math.hypot(Hq.cx, Hq.cz) + 0.2) continue; cerca.push([q, gq, Hq]);
      if (sube && !(q.t === 'mueble' && (ARRIBA.test(q.modelo || '') || ABAJO.test(q.modelo || ''))) && Hq.y1 <= 1.9 && Hq.hx * Hq.hz > H.hx * H.hz && adentro(Hq, gq, cx, cz, 0) && (!apoyo || Hq.y1 > apoyo.y1)) apoyo = { q, y1: Hq.y1 }; }
    let y0 = H.y0; if (sube) { res.y = apoyo ? Math.round(apoyo.y1 * 100) / 100 : (o.base ?? null); y0 = res.y ?? 0; } const y1 = y0 + alto;
    if (motor.aj.encimar) return res;
    for (const [q, gq, Hq] of cerca) { if (apoyo && q === apoyo.q) continue; if (Math.min(y1, Hq.y1) - Math.max(y0, Hq.y0) < 0.06) continue;
      if (p.t === 'mueble' && q.t === 'mueble' && ((ABAJO.test(p.modelo || '') && MESA.test(q.modelo || '')) || (MESA.test(p.modelo || '') && ABAJO.test(q.modelo || '')))) continue;
      if (Math.max(parte(H, g, Hq, gq), parte(Hq, gq, H, g)) > 0.16) { res.ok = false; res.por = nombreDe(q); return res; } }
    // paredes: los tramos macizos de lo que tiene paredes (userData.segs, en los ejes de esa pieza)
    for (const gw of objs.values()) { const S = gw.userData.segs; if (!S || !S.length || !gw.visible || gw === g) continue; const pw = gw.userData.pieza; if (!pw || pw._p || (o.ign && o.ign.has(pw))) continue;
      const ud = gw.userData, kw = gw.position.x + ',' + gw.position.z + ',' + gw.rotation.y; if (ud._bwk !== kw) { gw.updateMatrixWorld(true); ud._bw = new THREE.Box3().setFromObject(gw).expandByScalar(1); ud._bwk = kw; } if (!ud._bw.containsPoint(v3.set(cx, Math.max(ud._bw.min.y + 0.01, Math.min(ud._bw.max.y - 0.01, y0 + 0.1)), cz))) continue;
      for (const s of S) { if (Math.min(y1, s[6]) - Math.max(y0, s[5]) < 0.1) continue; v3.set(s[0], 0, s[1]).applyMatrix4(gw.matrixWorld); w3.set(s[2], 0, s[3]).applyMatrix4(gw.matrixWorld); const a = aLocal(g, v3.x, v3.z), b = aLocal(g, w3.x, w3.z);
        if (cruza(H, a[0], a[1], b[0], b[1])) { res.ok = false; res.por = 'una pared'; return res; } } }
    return res; }
  // se llama cada vez que lo que se ubica o se lleva cambia de lugar: acomoda la altura de lo que se apoya, pinta de rojo si no entra y lo recuerda en `est`
  const cajaR = new THREE.Box3Helper(new THREE.Box3(), 0xff453a); cajaR.visible = false; cajaR.renderOrder = 10; cajaR.material.depthTest = false; motor.scene.add(cajaR);
  function probar(p, est, o) { let r = entra(p, o); if ('y' in r && Math.abs((p.y ?? 0) - (r.y ?? 0)) > 0.004) { if (r.y == null || r.y === 0) delete p.y; else p.y = r.y; M.rehacer(p); r = entra(p, o); }
    est.mal = !r.ok; est.por = r.por || ''; const g = objs.get(p.id); cajaR.visible = est.mal && !!g; if (cajaR.visible) { g.updateMatrixWorld(true); cajaR.box.setFromObject(g).expandByScalar(0.05); } canvas.classList.toggle('noentra', est.mal); motor.dirty = true; return r; }
  const limpio = () => { if (cajaR.visible || canvas.classList.contains('noentra')) { cajaR.visible = false; canvas.classList.remove('noentra'); motor.dirty = true; } };
  const msj = est => `No entra ahí${est && est.por ? ': está ' + (est.por === 'una pared' ? 'la pared' : '«' + est.por + '»') : ''}.`;
  // ¿la pieza está apoyada arriba de algo? (para saber, al agarrarla, si al sacarla de ahí tiene que bajar al piso)
  const apoyada = p => { if (!(p.y > 0.05) || !(p.t === 'mueble' && ARRIBA.test(p.modelo || ''))) return false; const r = entra(p, { base: null }); return r.y != null && Math.abs(r.y - p.y) < 0.03; };

  // ======================================================= 1. barra rápida =======================================================
  const CLAVE = 'motor.barra.' + app, NUM = i => (i === 9 ? '0' : String(i + 1)), HN = new Map(M.HERR.map(([k, n, t]) => [k, [n, t]]));
  // de fábrica quedan donde estaban las herramientas de siempre (1 mano, 2 varias, 3 pared, 4 recinto, 5 puerta, 6 ventana, 8 gotero, 9 maza) y dos cosas del inventario en 7 y 0
  const SUGERIDAS = { olumi: [['mueble', 'desk'], ['mueble', 'chairDesk']], ondi: [['camara'], ['rack']], kliva: [['acceso'], ['camara']] };
  function deFabrica() { const O = M.ofertas(), hay = ([t, modelo]) => O.find(o => o.t === t && (!modelo || (o.o && o.o.modelo === modelo))), sug = (SUGERIDAS[app] || []).map(hay).filter(Boolean);
    for (const o of O) { if (sug.length >= 2) break; if (o.t && o.T && o.T.forma === 'punto' && !o.T.archivo && !sug.includes(o)) sug.push(o); }
    const it = o => (o ? { of: o.key, n: o.n } : null); return [{ h: 'mano' }, { h: 'varias' }, { h: 'pared' }, { h: 'recinto' }, { h: 'puerta' }, { h: 'ventana' }, it(sug[0]), { h: 'gotero' }, { h: 'maza' }, it(sug[1])]; }
  let B = null, enMano = null;
  function leer() { let g = null; try { g = JSON.parse(localStorage.getItem(CLAVE)); } catch (er) {} const O = new Map(M.ofertas().map(o => [o.key, o]));
    B = Array.isArray(g) && g.length === 10 ? g.map(c => (c && c.h && HN.has(c.h) && c.h !== 'catalogo' ? { h: c.h } : c && c.of && O.has(c.of) ? { of: c.of, n: O.get(c.of).n } : null)) : deFabrica(); }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(B)); } catch (er) {} };
  function pintar() { const box = $('#mbarra'); if (!box) return; if (!B) leer();
    box.innerHTML = B.map((c, i) => { const n = NUM(i); if (!c) return `<button class="mslot vacio" data-slot="${i}" title="Casillero ${n} vacío: arrastrá acá algo del inventario" aria-label="Casillero ${n}, vacío"><sup>${n}</sup></button>`;
      if (c.h) { const [nom, t] = HN.get(c.h); return `<button class="mslot" data-slot="${i}" data-h="${c.h}" aria-pressed="false" title="${esc(nom)} (${n}${t ? ' o ' + t : ''})" aria-label="${esc(nom)}">${svg(c.h)}<sup>${n}</sup></button>`; }
      return `<button class="mslot" data-slot="${i}" data-of="${esc(c.of)}" aria-pressed="false" title="${esc(c.n)} (${n})" aria-label="${esc(c.n)}"><span class="mmini" data-mini="${esc(c.of)}">${M.iconoOferta(c.of)}</span><sup>${n}</sup></button>`; }).join('');
    M.minis(); marcar(); }
  // qué casillero queda marcado: el de la herramienta en uso o el de lo que se tiene en la mano
  function marcar() { const box = $('#mbarra'); if (!box) return; const ED = M.ED, v = canvas.dataset.h, ocupado = !!(ED.colocar || ED.linea || M.construyendo()); if (!ocupado) enMano = null;
    box.querySelectorAll('.mslot').forEach(b => b.setAttribute('aria-pressed', b.dataset.h ? b.dataset.h === v : !!b.dataset.of && ocupado && b.dataset.of === enMano)); }
  function usar(i) { const c = B && B[i]; if (!c) { toast(`El casillero ${NUM(i)} está vacío: arrastrá algo del inventario (${motor.nomTecla(motor.teclaDe('inventario'))})`); return; }
    if (c.h) { enMano = null; M.herramienta(c.h); return; } const o = M.ofertas().find(o => o.key === c.of); if (!o) return; if (enMano === c.of && (M.ED.colocar || M.ED.linea)) { M.herramienta('mano'); return; }   // tocar de nuevo lo que ya está en la mano lo guarda
    enMano = c.of; M.elegirOferta(o); marcar(); }
  const poner = (i, c) => { B[i] = c; guardar(); pintar(); };
  $('#mbarra').addEventListener('click', e => { const b = e.target.closest('.mslot'); if (!b || arr.fue) return; e.stopPropagation(); usar(+b.dataset.slot); });
  $('#mbarra').addEventListener('contextmenu', e => { const b = e.target.closest('.mslot'); if (!b) return; e.preventDefault(); const i = +b.dataset.slot; if (B[i]) { poner(i, null); toast(`Casillero ${NUM(i)} vacío`); } });

  // ---------- arrastrar: del inventario a la barra, de un casillero a otro, o afuera para vaciarlo ----------
  const arr = { on: false, fue: false, t: null }; let fant = null;
  const origen = el => { const s = el.closest('#mbarra .mslot'); if (s) return B[+s.dataset.slot] ? { de: +s.dataset.slot, c: B[+s.dataset.slot], el: s } : null; const c = el.closest('#mcl [data-of]'); if (c) return { c: { of: c.dataset.of, n: (c.lastElementChild || c).textContent }, el: c }; const h = el.closest('#mcl [data-herr]'); return h ? { c: { h: h.dataset.herr }, el: h } : null; };
  function empieza(o, e) { arr.on = true; arr.o = o; document.documentElement.classList.add('marrastra'); fant = document.createElement('div'); fant.id = 'mfant'; fant.className = 'vidrio'; const dib = o.el.querySelector('.mmini, svg'); fant.innerHTML = dib ? dib.outerHTML : ''; document.body.appendChild(fant); mueve(e); }
  function mueve(e) { if (!fant) return; fant.style.transform = `translate(${e.clientX - 24}px,${e.clientY - 24}px)`; const s = document.elementFromPoint(e.clientX, e.clientY), b = s && s.closest('#mbarra .mslot'); document.querySelectorAll('#mbarra .mslot.cae').forEach(k => k !== b && k.classList.remove('cae')); if (b) b.classList.add('cae'); }
  function termina(e, cancela) { clearTimeout(arr.t); removeEventListener('pointermove', sigue, true); removeEventListener('pointerup', suelta, true); removeEventListener('pointercancel', aborta, true); if (!arr.on) { arr.ini = null; return; }
    arr.on = false; arr.fue = true; setTimeout(() => { arr.fue = false; }, 0); document.documentElement.classList.remove('marrastra'); if (fant) { fant.remove(); fant = null; } document.querySelectorAll('#mbarra .mslot.cae').forEach(k => k.classList.remove('cae')); const o = arr.o; arr.o = arr.ini = null; if (cancela) return;
    const s = document.elementFromPoint(e.clientX, e.clientY), b = s && s.closest('#mbarra .mslot'), r = $('#mtool').getBoundingClientRect(), lejos = e.clientY < r.top - 36 || e.clientX < r.left - 36 || e.clientX > r.right + 36;
    if (b) { const i = +b.dataset.slot; if (o.de != null) { if (o.de !== i) { const x = B[i]; B[i] = B[o.de]; B[o.de] = x; guardar(); pintar(); } } else { poner(i, o.c); toast(`${o.c.h ? HN.get(o.c.h)[0].split(':')[0] : o.c.n} quedó en el ${NUM(i)}`); } }
    else if (o.de != null && lejos) { poner(o.de, null); toast(`Casillero ${NUM(o.de)} vacío`); } }
  const sigue = e => { const I = arr.ini; if (!I || e.pointerId !== I.id) return; if (!arr.on) { if (I.dedo) { if (Math.hypot(e.clientX - I.x, e.clientY - I.y) > 10) termina(e, true); return; } if (Math.hypot(e.clientX - I.x, e.clientY - I.y) < 7) return; empieza(I.o, e); } e.preventDefault(); mueve(e); };
  const suelta = e => { if (arr.ini && e.pointerId === arr.ini.id) termina(e, false); }, aborta = e => termina(e, true);
  addEventListener('pointerdown', e => { if (e.button !== 0 || !motor.editando) return; const o = origen(e.target); if (!o) return; arr.ini = { id: e.pointerId, x: e.clientX, y: e.clientY, o, dedo: e.pointerType === 'touch' };
    if (arr.ini.dedo) arr.t = setTimeout(() => { if (arr.ini) { arr.ini.dedo = false; empieza(o, e); } }, 380);   // con el dedo, mantener apretado (arrastrar corto es correr la lista)
    addEventListener('pointermove', sigue, true); addEventListener('pointerup', suelta, true); addEventListener('pointercancel', aborta, true); }, true);
  addEventListener('click', e => { if (arr.fue) { e.stopPropagation(); e.preventDefault(); } }, true);   // el clic que cierra un arrastre no elige nada

  // ======================================================= 2 y 3. pausa y ajustes =======================================================
  raiz.insertAdjacentHTML('beforeend', '<div id="mpausa" hidden><section class="vidrio" role="dialog" aria-modal="true" aria-label="Menú de pausa"></section></div>');
  const PA = $('#mpausa'), hoja = PA.firstElementChild; let vista = 'menu', pide = null, retoma = false;
  const NOMBRES = { adelante: 'Caminar hacia adelante', atras: 'Caminar hacia atrás', izq: 'Paso a la izquierda', der: 'Paso a la derecha', saltar: 'Saltar (dos veces: volar)', correr: 'Correr', subir: 'Subir, volando', bajar: 'Bajar, volando', vista: 'Cambiar la vista', editar: 'Editar', inventario: 'Abrir el inventario', girar: 'Girar lo que tengo en la mano' };
  const sw = (k, on) => `<button type="button" class="msw2" role="switch" aria-checked="${on}" data-sw="${k}"><i></i></button>`;
  function dibuja() { const R = M.RC.R, ED = M.ED, aj = motor.aj;
    if (vista === 'menu') hoja.innerHTML = `<p class="mpk">En pausa</p><h2>${esc(M.E.nombre || 'Maqueta')}</h2>
      <button type="button" class="mpb pri" data-p="volver">Volver</button><button type="button" class="mpb" data-p="ajustes">Ajustes</button>
      ${M.puede ? `<button type="button" class="mpb" data-p="editar">${ED.on ? 'Terminar de editar' : 'Editar la maqueta'}</button>` : ''}
      <button type="button" class="mpb" data-p="paseo">${R.on ? 'Dejar de recorrer' : 'Recorrer caminando'}</button>
      <button type="button" class="mpb sal" data-p="salir">Salir de la maqueta</button><p class="mpie"><kbd>Esc</kbd> vuelve</p>`;
    else hoja.innerHTML = `<header class="mph"><button type="button" class="mx" data-p="menu" aria-label="Volver al menú">${svg('atras', 16)}</button><h2>Ajustes</h2></header><div class="mpsc">
      <h4>Mouse</h4><label class="mpf"><span>Sensibilidad</span><input type="range" id="mpsens" min="0.2" max="3" step="0.05" value="${aj.sens}" aria-label="Sensibilidad del mouse"><output id="mpsv">× ${(+aj.sens).toFixed(2).replace('.', ',')}</output></label>
      <div class="mpf"><span>Invertir el eje vertical</span>${sw('invY', aj.invY)}</div>
      <h4>Controles</h4>${Object.keys(motor.ACC).map(a => `<div class="mpf"><span>${NOMBRES[a]}</span><button type="button" class="mkbd${pide === a ? ' pide' : ''}" data-tecla="${a}">${pide === a ? 'Apretá una tecla…' : esc(motor.nomTecla(motor.teclaDe(a)))}</button></div>`).join('')}
      <div class="mpf"><span>Barra rápida</span><b class="mkfija">1 a 0</b></div><div class="mpf"><span>Menú de pausa</span><b class="mkfija">Esc</b></div><div class="mpf"><span>Cancelar lo que tengo en la mano</span><b class="mkfija">Clic derecho</b></div>
      <p class="mpn" id="mpaviso" hidden></p><button type="button" class="mpb chico" data-p="fabrica">Volver a las teclas de fábrica</button>
      <h4>Construcción</h4><div class="mpf"><span>Dejar encimar cosas<small>Apagado, una cosa no entra adentro de otra ni atraviesa una pared.</small></span>${sw('encimar', aj.encimar)}</div>
      ${M.puede ? '<button type="button" class="mpb chico" data-p="barra">Volver a la barra rápida de fábrica</button>' : ''}
      ${host && host.personaje ? '' : `<h4>Mi personaje</h4><label class="mpf"><span>Cómo me ven al recorrer<small>Cambia la próxima vez que entres a recorrer.</small></span><select id="mpper" aria-label="Mi personaje">${M.personajes.map(([k, n]) => `<option value="${k}"${(aj.personaje || 'tec-h-epp') === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`}
      </div>`; }
  function pausa(on, v) { if (on === !PA.hidden && (!on || !v || v === vista)) return; if (on) { M.cancelarAgarre(); retoma = M.RC.R.on && M.RC.puedeMira(); if (motor.mirando) motor.mira(false); M.RC.R.k = {}; vista = v || 'menu'; pide = null; dibuja(); PA.hidden = false; document.documentElement.classList.add('mpausada'); const b = hoja.querySelector('button'); b && b.focus(); }
    else { PA.hidden = true; pide = null; document.documentElement.classList.remove('mpausada'); canvas.focus({ preventScroll: true }); } motor.dirty = true; }
  const volver = () => { pausa(false); if (retoma && M.RC.R.on) motor.mira(true); };   // el clic en «Volver» sirve para que el navegador deje tomar el mouse de nuevo
  const aviso = t => { const el = $('#mpaviso'); if (el) { el.textContent = t; el.hidden = !t; } };
  PA.addEventListener('click', e => { if (e.target === PA) { volver(); return; } const sws = e.target.closest('[data-sw]'), tk = e.target.closest('[data-tecla]'), b = e.target.closest('[data-p]');
    if (sws) { const k = sws.dataset.sw; motor.aj[k] = !motor.aj[k]; motor.guardarAj(); sws.setAttribute('aria-checked', motor.aj[k]); return; }
    if (tk) { pide = pide === tk.dataset.tecla ? null : tk.dataset.tecla; dibuja(); return; } if (!b) return; const p = b.dataset.p;
    if (p === 'volver') volver(); else if (p === 'ajustes' || p === 'menu') { vista = p; pide = null; dibuja(); const f = hoja.querySelector('button'); f && f.focus(); }
    else if (p === 'editar') { pausa(false); M.editar(!M.ED.on); if (retoma && M.RC.R.on) motor.mira(true); }
    else if (p === 'paseo') { pausa(false); M.alternarPaseo(); }
    else if (p === 'fabrica') { motor.aj.teclas = {}; motor.guardarAj(); pide = null; dibuja(); aviso('Las teclas volvieron a las de fábrica.'); }
    else if (p === 'barra') { B = deFabrica(); guardar(); pintar(); aviso('La barra rápida volvió a la de fábrica.'); }
    else if (p === 'salir') { pausa(false); M.salir(); } });
  PA.addEventListener('input', e => { if (e.target.id === 'mpsens') { motor.aj.sens = +e.target.value; $('#mpsv').textContent = '× ' + (+e.target.value).toFixed(2).replace('.', ','); motor.guardarAj(); } });
  PA.addEventListener('change', e => { if (e.target.id === 'mpper') { motor.aj.personaje = e.target.value; motor.guardarAj(); } });
  // con el menú abierto las teclas son del menú: Esc vuelve un paso; al pedir una tecla, la que se apriete queda para esa acción
  addEventListener('keydown', e => { if (PA.hidden) return; const k = e.key.toLowerCase(); if ((e.metaKey || e.ctrlKey) && !pide) return;
    if (pide) { e.preventDefault(); e.stopImmediatePropagation(); if (k === 'escape') { pide = null; dibuja(); return; } if (['control', 'meta', 'alt', 'altgraph', 'os', 'dead', 'unidentified', 'process'].includes(k)) return;
      if (/^[0-9]$/.test(k)) { aviso('Los números son de la barra rápida. Elegí otra tecla.'); return; }
      const a = pide, antes = motor.teclaDe(a), otra = Object.keys(motor.ACC).find(x => x !== a && motor.teclaDe(x) === k); motor.aj.teclas[a] = k; if (otra) motor.aj.teclas[otra] = antes;   // si la tecla era de otra acción, se cruzan
      for (const x in motor.aj.teclas) if (motor.aj.teclas[x] === motor.ACC[x]) delete motor.aj.teclas[x]; motor.guardarAj(); pide = null; dibuja(); if (otra) aviso(`«${NOMBRES[otra]}» quedó en ${motor.nomTecla(antes)}.`); return; }
    if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); if (vista !== 'menu') { vista = 'menu'; dibuja(); const f = hoja.querySelector('button'); f && f.focus(); } else volver(); return; }
    if (k === 'tab' || k === 'enter' || k === ' ' || k.startsWith('arrow')) { e.stopImmediatePropagation(); return; }   // moverse por el menú con el teclado
    if (!/^(INPUT|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); } e.stopImmediatePropagation(); }, true);
  addEventListener('keyup', e => { if (!PA.hidden) e.stopImmediatePropagation(); }, true);
  motor.alPausa = () => { if (PA.hidden && !M.panelAbierto()) pausa(true); };   // el navegador soltó el mouse (Esc o se cambió de ventana)
  motor.alRetomar = () => { if (!PA.hidden) pausa(false); };   // se volvió a tomar el mouse (un clic en la maqueta): la pausa terminó

  leer(); pintar();
  return { entra, probar, limpio, msj, apoyada, huella, pintar, marcar, usar, pausa, get pausada() { return !PA.hidden; }, get barra() { return B; }, set mano(k) { enMano = k; }, poner, SOLIDO };
}

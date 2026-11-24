// Motor común · modo construcción, a la manera de Los Sims: paredes punto por punto, recintos que se arrastran de esquina a esquina,
// puertas y ventanas que se apoyan en la pared, y cada pared se elige y se edita por separado.
//   Pared (B):    tocar punto por punto; cerrar sobre el primero arma un recinto. Enter termina, Retroceso deshace, Shift traba a 45°.
//   Recinto (N):  arrastrar de una esquina a la otra (o tocar las dos esquinas).
//   Abertura:     pasar por una pared y tocar. Después se desliza a lo largo de la pared.
//   Pincel de terreno: arrastrar sube (Alt baja); nivelar lleva a la altura donde se empezó; alisar empareja. + y − (o [ y ]) cambian el tamaño.
//   Con la mano:  tocar una pared la elige (tipo, color, aberturas, arrastrarla estira el recinto); tocar el piso elige el recinto entero,
//                 que se mueve con todo lo que tiene adentro (Alt lo mueve solo) y gira con R , y .
// Imán: las puntas se pegan a esquinas y paredes que ya existen y, si no, a la grilla de 25 cm (Alt: libre).
import { THREE } from './nucleo.js?v=20';
import { ABERTURAS, PAREDES, areaSig, centro, cotaEn } from './piezas.js?v=70';

export function construir(M) {
  const { motor, TIPOS, objs } = M, esMuro = p => !!p && (p.t === 'pared' || p.t === 'recinto');
  const T = { h: null }; let SUB = null, D = null;
  const guias = new THREE.Group(); motor.scene.add(guias);
  const mG = new THREE.MeshBasicMaterial({ color: 0x1d9bf0, transparent: true, opacity: 0.32, depthTest: false }), CAJA = new THREE.BoxGeometry(1, 1, 1), BOL = new THREE.SphereGeometry(1, 14, 10), mB = new THREE.MeshBasicMaterial({ color: 0x1d9bf0, depthTest: false });
  const gr = (v, libre) => libre ? Math.round(v * 100) / 100 : Math.round(v * 4) / 4, fmt = n => (Math.round(n * 100) / 100).toLocaleString('es-UY', { maximumFractionDigits: 2 });
  const pieza = id => M.E.piezas.find(q => q.id === id), anchoDe = h => h.w || ABERTURAS[h.k].w, nombreDe = p => p.nombre || TIPOS[p.t].n;
  const lados = p => { const P = p.pts, n = P.length, out = []; for (let i = 0; i < (p.t === 'recinto' ? n : n - 1); i++) out.push([P[i], P[(i + 1) % n], i]); return out; };
  // el lado de una pieza más cercano a un punto: i (cuál), s (metros desde su inicio), d (distancia), len (largo)
  function ladoDe(p, x, z, solo) { let m = null; for (const [a, b, i] of lados(p)) { if (solo != null && i !== solo) continue; const ax = b[0] - a[0], az = b[1] - a[1], len = Math.hypot(ax, az); if (len < 0.01) continue;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ax + (z - a[1]) * az) / (len * len))), d = Math.hypot(x - a[0] - ax * t, z - a[1] - az * t); if (!m || d < m.d) m = { i, s: t * len, d, len, a, b }; } return m; }
  function paredCerca(x, z, max, menos) { let m = null; for (const p of M.E.piezas) { if (!esMuro(p) || p === menos || !objs.has(p.id)) continue; const l = ladoDe(p, x, z); if (l && l.d < max && (!m || l.d < m.d) && ((p.lados || {})[l.i] || {}).tipo !== 'sin') m = { p, ...l }; } return m; }
  // imán: esquina que ya existe, pared que ya existe, ángulo de 45° (con Shift) o grilla
  function iman(p, e, prev) { const x = p.x, z = p.z, r = Math.max(0.3, motor.C.d * 0.012);
    if (!e.altKey) { let m = null, md = r; const prueba = q => { const d = Math.hypot(q[0] - x, q[1] - z); if (d < md) { md = d; m = q; } };
      for (const q of M.E.piezas) if (esMuro(q) && q !== T.p) q.pts.forEach(prueba); if (T.h === 'pared' && T.pts.length > 2) prueba(T.pts[0]); if (m) return [m[0], m[1]];
      const w = paredCerca(x, z, r * 0.7, T.p); if (w) { const k = w.s / w.len; return [w.a[0] + (w.b[0] - w.a[0]) * k, w.a[1] + (w.b[1] - w.a[1]) * k]; } }
    if (prev && e.shiftKey) { const a = Math.round(Math.atan2(z - prev[1], x - prev[0]) / (Math.PI / 4)) * Math.PI / 4, d = gr(Math.hypot(x - prev[0], z - prev[1]), e.altKey); return [prev[0] + Math.cos(a) * d, prev[1] + Math.sin(a) * d]; }
    return [gr(x, e.altKey), gr(z, e.altKey)]; }
  // medida que acompaña lo que se dibuja o se estira
  document.body.insertAdjacentHTML('beforeend', '<div id="mmed" class="vidrio" hidden></div>'); const med = document.getElementById('mmed'); let medV = null;
  function medir(txt, x, z, y = 1.4) { if (!txt) { med.hidden = true; medV = null; return; } med.textContent = txt; med.hidden = false; medV = new THREE.Vector3(x, y, z); motor.dirty = true; }
  motor.despues.push(() => { if (!medV) return; const s = motor.aPantalla(medV); med.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-140%)`; });
  const nombreNuevo = zona => { const b = zona ? 'Zona ' : 'Recinto '; let n = 1; while (M.E.piezas.some(q => q.nombre === b + n)) n++; return b + n; };
  const punto = (x, z) => { const m = new THREE.Mesh(BOL, mB); m.scale.setScalar(Math.max(0.12, motor.C.d * 0.005)); m.position.set(x, 0.3, z); m.renderOrder = 9; guias.add(m); motor.dirty = true; };

  // ---------- herramientas ----------
  function empezar(h, k) { const antes = M.SEL; cancelar(); SUB = null; T.h = h; T.zona = false; T.contorno = false; M.elegir(null); guias.position.y = motor.pisoY || 0;   // las guías, a la altura de la planta en la que se dibuja
    if (h === 'pared' && k === 'contorno') { T.pts = []; T.p = null; T.arr = null; T.contorno = true; M.hint(`<b>Contorno ${M.planta ? 'del ' + M.nomPlanta(M.planta).toLowerCase() : 'de la planta baja'}</b>: tocá cada esquina de afuera del edificio sobre el plano y terminá tocando la primera. Salen el piso y las paredes de afuera de esta planta. <kbd>Retroceso</kbd> deshace · <kbd>Shift</kbd> 45° · <kbd>Esc</kbd> sale`); }
    else if (h === 'pared') { T.pts = []; T.p = null; T.arr = null; M.hint('<b>Pared</b>: arrastrá de punta a punta, como en Los Sims (o tocá punto por punto). Si arrancás en la punta sigue la misma pared; si cerrás sobre el primero queda un recinto. <kbd>Enter</kbd> termina · <kbd>Retroceso</kbd> deshace · <kbd>Shift</kbd> 45° · <kbd>Espacio</kbd>+arrastrar mueve la vista · <kbd>Q</kbd>/<kbd>E</kbd> giran · <kbd>Esc</kbd> sale'); }
    if (h === 'recinto') { T.a = null; T.p = null; T.zona = k === 'zona'; M.hint(T.zona ? '<b>Zona</b>: arrastrá de una esquina a la otra sobre el sector que querés nombrar (una oficina, un depósito). No lleva paredes ni piso. <kbd>Esc</kbd> sale' : '<b>Recinto</b>: arrastrá de una esquina a la otra, o tocá las dos esquinas. <kbd>Esc</kbd> sale'); }
    if (h === 'piso') { T.losa = antes && antes.t === 'losas' && !antes.candado ? antes : null; T.base = k && typeof k === 'object' ? k : {}; M.hint(M.motor.tactil ? '<b>Piso por sector</b>: arrastrá un rectángulo y se pinta (reemplaza lo que había, sin encimar) · tocá un cuadro para sumar uno solo · si había un piso elegido, se suma a ese · el material se cambia en su ficha · con dos dedos se mueve la vista' : '<b>Piso por sector</b>: <kbd>Shift</kbd> + arrastrar pinta un rectángulo (reemplaza lo que había, sin encimar) · <kbd>Shift</kbd> + clic suma un cuadro · <kbd>Shift</kbd> + <kbd>Alt</kbd> borra · sin <kbd>Shift</kbd> el arrastre mueve la vista · si había un piso elegido, se suma a ese · <kbd>Esc</kbd> sale'); }
    if (h === 'relieve') { T.modo = (k && PINCEL[k.modo] && k.modo) || T.modo || 'subir'; T.radio = T.radio || 6; T.mat = (k && k.mat) || 'pasto'; pincelPista(); }
    if (h === 'abertura') { T.k = ABERTURAS[k] ? k : 'puerta'; T.en = null; M.hint(`<b>${ABERTURAS[T.k].n}</b>: pasá por una pared y tocá donde va. <kbd>Shift</kbd> pone varias · <kbd>Esc</kbd> sale`); }
    M.herrVis(h === 'abertura' ? T.k : h); }
  // ---------- piso por losas ----------
  // el cuadro (i, j) de un punto, en la grilla del piso (su x, z es la esquina de la celda 0, 0)
  const celdaDe = (L, x, z) => { const c = L.celda || 5; return [Math.floor((x - (L.x || 0)) / c), Math.floor((z - (L.z || 0)) / c)]; };
  function losaNueva(x, z) { const b = T.base || {}, c = b.celda || 5;
    const L = { id: M.nuevoId('losas'), t: 'losas', mat: b.mat || 'hormigon', celda: c, x: 0, z: 0, celdas: [] }; M.E.piezas.push(L); return L; }
  function losaPinta(L, cel, borra) { const k = cel.join(','), C = L.celdas, i = C.findIndex(q => q[0] === cel[0] && q[1] === cel[1]); if (borra) { if (i < 0) return false; C.splice(i, 1); return true; } if (i >= 0) return false; C.push(cel); return true; }
  function losaPaso(e, p) { const A = T.pint; if (!A) return; const cel = celdaDe(A.L, p.x, p.z); let cambio = false;
    { A.L.celdas = A.antes.map(q => [...q]); const [i0, j0] = A.c0; for (let i = Math.min(i0, cel[0]); i <= Math.max(i0, cel[0]); i++) for (let j = Math.min(j0, cel[1]); j <= Math.max(j0, cel[1]); j++) losaPinta(A.L, [i, j], A.borra); cambio = true;
      const c = A.L.celda || 5; medir(`${Math.abs(cel[0] - i0) + 1} × ${Math.abs(cel[1] - j0) + 1} losas · ${fmt((Math.abs(cel[0] - i0) + 1) * c)} × ${fmt((Math.abs(cel[1] - j0) + 1) * c)} m`, p.x, p.z, 1); }
    if (cambio) M.rehacer(A.L); }
  // ---------- pincel de terreno ----------
  // Un solo relieve por maqueta: crece donde se pinta. Mientras se mantiene apretado sigue subiendo (o bajando), como en Los Sims.
  const PINCEL = { subir: 'Subir', bajar: 'Bajar', nivelar: 'Nivelar', alisar: 'Alisar' };
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d9bf0, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  anillo.renderOrder = 9; anillo.visible = false; motor.scene.add(anillo);
  const pincelPista = () => M.hint(`<b>Pincel de terreno · ${PINCEL[T.modo]}</b>: ${M.motor.tactil ? '' : '<kbd>Shift</kbd> + '}${{ subir: 'mantené apretado y pasá por donde querés que suba', bajar: 'mantené apretado y pasá por donde querés que baje (hasta el nivel del piso)', nivelar: 'empezá donde está la altura que querés y arrastrá: lo demás queda a esa altura', alisar: 'pasá por encima para emparejar los pozos y los picos' }[T.modo]} · <kbd>Alt</kbd> ${T.modo === 'bajar' ? 'sube' : 'baja'} · <kbd>+</kbd> <kbd>−</kbd> tamaño (${fmt(T.radio * 2)} m) · ${M.motor.tactil ? 'con dos dedos se mueve la vista' : 'sin <kbd>Shift</kbd> el arrastre mueve la vista'} · <kbd>Esc</kbd> sale`);
  // dónde cae el puntero sobre el terreno (con lomas y relieve, no sobre el plano del piso)
  function enTerreno(e) { let p = motor.enPiso(e.clientX, e.clientY); if (!p) return null; for (let k = 0; k < 3; k++) { const q = motor.enPiso(e.clientX, e.clientY, cotaEn(p.x, p.z)); if (!q) break; p = q; } return p; }
  function verAnillo(p) { anillo.visible = !!p; if (p) { anillo.position.set(p.x, cotaEn(p.x, p.z) + 0.15, p.z); anillo.scale.setScalar(T.radio); } motor.dirty = true; }
  function relieveParaPintar() { const R = M.E.piezas.find(q => q.t === 'relieve'); if (R && (R.candado || R.fijo)) { M.toast('El relieve tiene candado: tocalo en su ficha para poder pintarlo'); return null; } if (R) return R;
    const N = { id: M.nuevoId('relieve'), t: 'relieve', mat: T.mat || 'pasto', celda: 2, x: 0, z: 0, alt: {} }; M.E.piezas.push(N); return N; }
  function pincelAplica() { const A = T.pin; if (!A || !A.p) return; const R = A.R, c = R.celda || 2, rad = T.radio, x = A.p.x - (R.x || 0), z = A.p.z - (R.z || 0), alt = R.alt || (R.alt = {}), H = (i, j) => alt[i + ',' + j] || 0;
    const modo = A.alt ? { subir: 'bajar', bajar: 'subir' }[A.modo] || A.modo : A.modo, cambios = [], ahora = performance.now(), paso = 1.5 * Math.min(0.25, A.t ? (ahora - A.t) / 1000 : 0.06); let hubo = false; A.t = ahora;   // 1,5 m por segundo en el centro, vaya rápida o lenta la compu
    for (let i = Math.floor((x - rad) / c); i <= Math.ceil((x + rad) / c); i++) for (let j = Math.floor((z - rad) / c); j <= Math.ceil((z + rad) / c); j++) {
      const d = Math.hypot(i * c - x, j * c - z); if (d > rad) continue; const w0 = 1 - (d / rad) ** 2, w = w0 * w0, h = H(i, j); let n = h;
      if (modo === 'subir') n = h + paso * w; else if (modo === 'bajar') n = h - paso * w; else if (modo === 'nivelar') n = h + (A.nivel - h) * Math.min(1, 0.35 * w + 0.05);
      else n = h + ((H(i - 1, j) + H(i + 1, j) + H(i, j - 1) + H(i, j + 1)) / 4 - h) * 0.5 * w;
      n = Math.max(0, Math.min(40, Math.round(n * 100) / 100)); if (n !== h) cambios.push([i + ',' + j, n]); }
    for (const [k, n] of cambios) { if (n < 0.01) delete alt[k]; else alt[k] = n; hubo = true; }
    A.toco = A.toco || [1e9, 1e9, -1e9, -1e9]; A.toco = [Math.min(A.toco[0], A.p.x - rad), Math.min(A.toco[1], A.p.z - rad), Math.max(A.toco[2], A.p.x + rad), Math.max(A.toco[3], A.p.z + rad)];
    if (hubo) { R.v = (R.v | 0) + 1; A.mov = true; M.rehacer(R); } verAnillo(A.p); const y = cotaEn(A.p.x, A.p.z); medir(`${PINCEL[modo]} · ${fmt(y)} m de alto`, A.p.x, A.p.z, y + 1.6); }
  function pincelEmpieza(e) { const p = enTerreno(e), R = p && relieveParaPintar(); if (!R) return; T.pin = { R, p, modo: T.modo, alt: e.altKey, nivel: cotaEn(p.x, p.z), mov: false }; pincelAplica();
    clearInterval(T.reloj); if (T.modo !== 'alisar') T.reloj = setInterval(pincelAplica, 60); }
  function pincelFin() { clearInterval(T.reloj); T.reloj = null; const A = T.pin; T.pin = null; medir(''); if (!A) return;
    if (A.R.alt && !Object.keys(A.R.alt).length) { M.quitar(A.R, true); return; }
    if (A.mov) { // lo que estaba apoyado en lo que se pintó acompaña al terreno
      const b = A.toco; for (const q of M.E.piezas) if (q !== A.R && q.x != null && !q.pts && q.t !== 'losas' && q.x >= b[0] && q.x <= b[2] && q.z >= b[1] && q.z <= b[3]) M.rehacer(q); M.cambio(); } }
  function cancelar() { if (!T.h) return false; if (T.h === 'relieve') { pincelFin(); verAnillo(null); } if (T.p) M.quitar(T.p, true); quitaPrev(); T.h = null; T.p = null; T.pts = []; T.a = null; guias.clear(); medir(''); marcar(); M.herrVis(null); return true; }
  // pared
  function paredPasar(p, e) { if (!T.pts.length) return; const a = T.pts[T.pts.length - 1], q = iman(p, e, a), pts = [...T.pts, q];
    if (!T.p) { T.p = { id: M.nuevoId('pared'), t: 'pared', pts, _p: 1 }; M.E.piezas.push(T.p); } T.p.pts = pts; M.rehacer(T.p); medir(fmt(Math.hypot(q[0] - a[0], q[1] - a[1])) + ' m', (a[0] + q[0]) / 2, (a[1] + q[1]) / 2, 3); }
  function paredClic(p, e) { const prev = T.pts[T.pts.length - 1], q = iman(p, e, prev);
    if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 0.05) { paredFin(); return; }                       // dos toques en el mismo lugar: termina
    if (T.pts.length > 2 && Math.hypot(q[0] - T.pts[0][0], q[1] - T.pts[0][1]) < 0.05) { recintoDe(T.pts); return; }   // volvió al primero: recinto
    T.pts.push(q); if (T.pts.length === 1) punto(q[0], q[1]); else paredPasar(p, e); }
  function paredFin() { const pts = T.pts; guias.clear(); medir(''); if (T.p && pts.length >= 2) { const p = T.p; p.pts = pts.map(q => [...q]); delete p._p; M.rehacer(p); T.p = null; T.pts = []; M.cambio(); M.toast('Pared lista'); } else { if (T.p) M.quitar(T.p, true); T.p = null; T.pts = []; } }
  function recintoDe(pts) { if (T.p) M.quitar(T.p, true); T.p = null; T.pts = []; T.a = null; guias.clear(); medir('');
    if (T.contorno) { const p = { id: M.nuevoId('recinto'), t: 'recinto', nombre: M.nomPlanta(M.planta), grosor: 0.2, piso: 'hormigon', pts: pts.map(q => [...q]) }; M.E.piezas.push(p); M.rehacer(p); M.cambio(); T.contorno = false; cancelar(); M.hint('');
      M.toast(`${p.nombre}: ${fmt(Math.abs(areaSig(p.pts)))} m² con su piso y las paredes de afuera. Ahora los ambientes de adentro con Pared (B) o Recinto (N)${M.planta ? '' : '; la planta de arriba, con Re Pág'}`, 6000); M.elegir(p); return p; }
    const p = { id: M.nuevoId('recinto'), t: 'recinto', nombre: nombreNuevo(T.zona), pts: pts.map(q => [...q]), ...(T.zona && { tipo: 'sin', piso: 'sin' }) }; M.E.piezas.push(p); M.rehacer(p); M.cambio(); M.toast(`${p.nombre}: ${fmt(Math.abs(areaSig(p.pts)))} m². Tocá el piso para moverlo entero`); return p; }
  // recinto de esquina a esquina
  function recPrev(p, e) { const q = iman(p, e), a = T.a, pts = [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]], w = Math.abs(q[0] - a[0]), f = Math.abs(q[1] - a[1]); T.q = q;
    if (w < 0.25 || f < 0.25) { if (T.p) { M.quitar(T.p, true); T.p = null; } medir(''); return false; }
    if (!T.p) { T.p = { id: M.nuevoId('recinto'), t: 'recinto', pts, _p: 1, ...(T.zona && { tipo: 'sin', piso: 'sin' }) }; M.E.piezas.push(T.p); } T.p.pts = pts; M.rehacer(T.p); medir(`${fmt(w)} × ${fmt(f)} m · ${fmt(w * f)} m²`, (a[0] + q[0]) / 2, (a[1] + q[1]) / 2, 3); return w >= 0.5 && f >= 0.5; }
  // abertura sobre una pared
  function quitaPrev() { if (!T.en) return; const p = T.en.p; p.huecos = (p.huecos || []).filter(h => h !== T.en.h); if (!p.huecos.length) delete p.huecos; M.rehacer(p); T.en = null; }
  function entra(p, i, a, w, menos) { return !(p.huecos || []).some(h => h !== menos && h.s === i && a < h.a + anchoDe(h) + 0.1 && a + w > h.a - 0.1); }
  function abPasar(p, e) { quitaPrev(); const w = paredCerca(p.x, p.z, 1.5), def = ABERTURAS[T.k]; M.canvas.classList.toggle('sobre', !!w); if (!w || w.len < def.w + 0.2) return;
    const a = Math.max(0.1, Math.min(w.len - def.w - 0.1, gr(w.s - def.w / 2, e.altKey))); if (!entra(w.p, w.i, a, def.w)) return;
    const h = { s: w.i, a, k: T.k, _p: 1 }; (w.p.huecos = w.p.huecos || []).push(h); T.en = { p: w.p, h }; M.rehacer(w.p); }
  function abClic(p, e) { abPasar(p, e); if (!T.en) { M.toast('Acercala a una pared con lugar libre'); return; } const en = T.en; delete en.h._p; T.en = null; M.cambio();
    if (!e.shiftKey) { T.h = null; M.herrVis(null); SUB = { id: en.p.id, hueco: en.p.huecos.indexOf(en.h) }; M.elegir(en.p); M.toast(ABERTURAS[en.h.k].n + ' puesta. Arrastrala para correrla'); } }

  // ---------- elegir y mover paredes y aberturas (con la mano) ----------
  function marcar() { guias.clear(); const p = SUB && pieza(SUB.id); if (!p || !M.ED.on || (SUB.hueco != null && !(p.huecos || [])[SUB.hueco])) { if (!T.h) SUB = SUB && p && M.ED.on ? SUB : null; motor.dirty = true; return; }
    const L = lados(p), h = SUB.hueco != null ? p.huecos[SUB.hueco] : null, l = L[h ? h.s : SUB.lado]; if (!l) { SUB = null; return; } const [a, b] = l, len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    const s0 = h ? h.a : 0, s1 = h ? h.a + anchoDe(h) : len, alto = h ? (h.h || ABERTURAS[h.k].h) : (p.alto ?? TIPOS[p.t].def.alto), y0 = (p.y || 0) + (h ? (h.y ?? ABERTURAS[h.k].y ?? 0) : 0), m = new THREE.Mesh(CAJA, mG);
    m.scale.set(s1 - s0 + 0.06, alto + 0.06, (p.grosor || 0.15) + 0.14); m.position.set(a[0] + dx * (s0 + s1) / 2, y0 + alto / 2, a[1] + dz * (s0 + s1) / 2); m.rotation.y = Math.atan2(-dz, dx); m.renderOrder = 8; guias.add(m); motor.dirty = true; }
  // lo que está adentro de un recinto (se mueve y gira con él)
  const adentro = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  function contenido(p) { if (p.t === 'recinto') return M.E.piezas.filter(q => q !== p && !q._p && (q.pts ? q.pts.every(k => adentro(k[0], k[1], p.pts)) : adentro(q.x || 0, q.z || 0, p.pts)));
    // el plano del lugar se lleva todo lo que está apoyado arriba (menos el terreno y otros planos)
    if (p.t === 'plano') { const d = { ...TIPOS.plano.def, ...p }, c = Math.cos(p.r || 0), s = Math.sin(p.r || 0), hw = d.ancho / 2, hd = d.ancho * (d.aspecto || 0.62) / 2;
      const sobre = (x, z) => { const dx = x - (p.x || 0), dz = z - (p.z || 0); return Math.abs(dx * c - dz * s) <= hw && Math.abs(dx * s + dz * c) <= hd; };
      return M.E.piezas.filter(q => q !== p && !q._p && !['terreno', 'plano'].includes(q.t) && (q.pts ? q.pts.every(k => sobre(k[0], k[1])) : sobre(q.x || 0, q.z || 0))); }
    // un edificio o un galpón se lleva los equipos y las puertas con control de acceso que tiene puestos (adentro o en sus paredes)
    // una columna de luz se lleva lo que tiene adosado (cámaras, Wi-Fi, sensores)
    if (p.t === 'columna') return M.E.piezas.filter(q => q !== p && !q._p && !q.pts && TIPOS[q.t] && TIPOS[q.t].equipo && Math.hypot((q.x || 0) - (p.x || 0), (q.z || 0) - (p.z || 0)) < 1.6);
    if (!['edificio', 'galpon', 'modulo', 'alero'].includes(p.t)) return []; const d = { ...TIPOS[p.t].def, ...p }, c = Math.cos(p.r || 0), s = Math.sin(p.r || 0), hw = d.ancho / 2 + 0.8, hd = d.fondo / 2 + 0.8;
    return M.E.piezas.filter(q => { if (q === p || q._p || q.pts || !(TIPOS[q.t].equipo || TIPOS[q.t].vivo)) return false; const dx = (q.x || 0) - (p.x || 0), dz = (q.z || 0) - (p.z || 0); return Math.abs(dx * c - dz * s) <= hw && Math.abs(dx * s + dz * c) <= hd; }); }
  // girar una línea, un área o un recinto (con lo que tiene adentro) alrededor de su centro
  function girar(p, ang, solo) { const [cx, cz] = centro(p), c = Math.cos(ang), s = Math.sin(ang), rot = q => [Math.round((cx + (q[0] - cx) * c + (q[1] - cz) * s) * 1000) / 1000, Math.round((cz - (q[0] - cx) * s + (q[1] - cz) * c) * 1000) / 1000];
    const dentro = solo ? [] : contenido(p); p.pts = p.pts.map(rot); M.rehacer(p);
    for (const q of dentro) { if (q.pts) q.pts = q.pts.map(rot); else { [q.x, q.z] = rot([q.x || 0, q.z || 0]); q.r = (q.r || 0) + ang; } M.rehacer(q); } }
  // al sumar o sacar una esquina, las paredes cambian de número: se corren sus tipos y sus aberturas
  function insertado(p, m) { if (!esMuro(p)) return; const P = p.pts, a = P[(m - 1 + P.length) % P.length], d = Math.hypot(P[m][0] - a[0], P[m][1] - a[1]), viejo = m - 1;
    if (p.lados) { const n = {}; for (const k in p.lados) { const i = +k; if (i >= m) n[i + 1] = p.lados[k]; else n[i] = p.lados[k]; if (i === viejo) n[m] = { ...p.lados[k] }; } p.lados = n; }
    for (const h of p.huecos || []) { if (h.s >= m) h.s++; else if (h.s === viejo && h.a >= d) { h.s = m; h.a = Math.round((h.a - d) * 100) / 100; } } }
  function quitado(p, i) { if (!esMuro(p)) return; const n = p.pts.length + 1, va = p.t === 'recinto' ? (i - 1 + n) % n : i - 1;   // la pared i se pierde; la anterior se estira
    if (p.lados) { const o = {}; for (const k in p.lados) { const j = +k; if (j === i) continue; o[j > i ? j - 1 : j] = p.lados[k]; } p.lados = o; }
    if (p.huecos) { p.huecos = p.huecos.filter(h => h.s !== i && h.s !== va).map(h => ({ ...h, s: h.s > i ? h.s - 1 : h.s })); if (!p.huecos.length) delete p.huecos; } }

  // ---------- lo que le llega del mouse (maqueta.js le pasa cada evento antes de usarlo) ----------
  // sobre qué pared o abertura cayó el toque (null si fue el piso de un recinto u otra cosa)
  function sobre(hit) { if (M.ED.h !== 'mano' || !hit || !esMuro(hit.p)) return null; const p = hit.p, l = ladoDe(p, hit.h.point.x, hit.h.point.z); if (!l) return null;
    const j = (p.huecos || []).findIndex(u => u.s === l.i && l.s >= u.a - 0.05 && l.s <= u.a + anchoDe(u) + 0.05);
    // la hoja de una puerta abierta sobresale hasta un metro de la pared: tocándola también se elige la puerta
    if (l.d > (p.grosor || 0.15) / 2 + (j >= 0 ? 1.1 : 0.22)) return null; return { p, l, j }; }
  // un toque con la mano: si cayó en una pared o una abertura, la elige
  function tocar(hit) { const s = sobre(hit); if (!s) { if (SUB) { SUB = null; marcar(); } return false; } SUB = s.j >= 0 ? { id: s.p.id, hueco: s.j } : { id: s.p.id, lado: s.l.i }; M.elegir(s.p); marcar(); M.ficha(); return true; }
  function agarrar(e, p0, hit) {
    if (T.h === 'recinto') { if (!T.a) { T.a = iman(p0, e); T.recien = true; punto(T.a[0], T.a[1]); } return true; }
    // pared: arrastrar dibuja un tramo (de punta a punta). Recién al moverse se decide si sigue la pared de antes (arrancó en su punta) o empieza otra
    if (T.h === 'pared') { T.arr = { q0: iman(p0, e, null), x: e.clientX, y: e.clientY, mov: false }; return true; }
    if (T.h === 'relieve') { pincelEmpieza(e); return true; }
    if (T.h === 'piso') { const L = T.losa && M.E.piezas.includes(T.losa) ? T.losa : (T.losa = losaNueva(p0.x, p0.z)); T.pint = { L, borra: e.altKey, c0: celdaDe(L, p0.x, p0.z), antes: L.celdas.map(q => [...q]), ult: null }; losaPaso(e, p0); return true; }
    if (T.h) return false;   // con abertura, arrastrar mueve la vista; el toque es el que la pone
    // una pared o una abertura se arrastra solo si ya estaba elegida (se elige con un toque): así arrastrar para moverse nunca corre nada por error
    const s = sobre(hit); if (!s || s.p.candado || !SUB || SUB.id !== s.p.id || (s.j >= 0 ? SUB.hueco !== s.j : SUB.lado !== s.l.i)) return false; const { p, l, j } = s;
    if (j >= 0) D = { p, h: p.huecos[j], off: l.s - p.huecos[j].a }; else if (p.t === 'recinto') D = { p, lado: l.i, x0: p0.x, z0: p0.z, orig: p.pts.map(q => [...q]) }; else return false;   // una pared suelta se mueve entera, como cualquier pieza
    return true; }
  function mover(e) { const p = motor.enPiso(e.clientX, e.clientY); if (!p) return !!(D || T.h);
    if (T.h === 'recinto' && T.a) { recPrev(p, e); return true; }
    if (T.h === 'piso' && T.pint) { losaPaso(e, p); return true; }
    if (T.h === 'relieve') { const q = enTerreno(e); if (T.pin && q) { T.pin.p = q; pincelAplica(); } else verAnillo(q); return true; }
    if (T.h === 'pared' && T.arr) { const A = T.arr; if (!A.mov) { if (Math.hypot(e.clientX - A.x, e.clientY - A.y) < 7) return true; A.mov = true; const ult = T.pts[T.pts.length - 1];
        if (!ult || Math.hypot(A.q0[0] - ult[0], A.q0[1] - ult[1]) > 0.3) { if (T.pts.length >= 2) paredFin(); else { if (T.p) M.quitar(T.p, true); T.p = null; guias.clear(); } T.pts = [A.q0]; punto(A.q0[0], A.q0[1]); } }
      paredPasar(p, e); return true; }
    if (T.h) return true; if (!D) return false;
    if (D.h) { const l = ladoDe(D.p, p.x, p.z, D.h.s), w = anchoDe(D.h), a = Math.max(0.1, Math.min(l.len - w - 0.1, gr(l.s - D.off, e.altKey))); if (a !== D.h.a && entra(D.p, D.h.s, a, w, D.h)) { D.h.a = a; D.mov = true; M.rehacer(D.p); marcar(); } return true; }
    const P = D.orig, n = P.length, i = D.lado, a = P[i], b = P[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len, k = gr((p.x - D.x0) * nx + (p.z - D.z0) * nz, e.altKey);
    if (!D.mov && Math.abs(k) < 0.01) return true; D.mov = true; const pts = P.map(q => [...q]); for (const j of [i, (i + 1) % n]) pts[j] = [Math.round((P[j][0] + nx * k) * 100) / 100, Math.round((P[j][1] + nz * k) * 100) / 100];
    D.p.pts = pts; M.rehacer(D.p); marcar(); const ant = pts[(i - 1 + n) % n]; medir(fmt(Math.hypot(pts[i][0] - ant[0], pts[i][1] - ant[1])) + ' m', (pts[i][0] + ant[0]) / 2, (pts[i][1] + ant[1]) / 2, 3); return true; }
  function soltar(e) {
    if (T.h === 'relieve') { pincelFin(); return true; }
    if (T.h === 'piso' && T.pint) { const A = T.pint, L = A.L; T.pint = null; medir('');
      // lo que se pintó deja de ser de los otros pisos pintados: nunca quedan dos encimados. Un piso con candado no se toca: se le respeta su lugar.
      if (!A.borra && L.celdas.length) { const antes = new Set(A.antes.map(q => q.join(','))), nuevas = new Set(L.celdas.map(q => q.join(',')).filter(k => !antes.has(k))); let sacadas = 0, trabadas = 0;
        for (const O of M.E.piezas.slice()) { if (O === L || O.t !== 'losas' || (O.celda || 5) !== (L.celda || 5) || (O.x || 0) !== (L.x || 0) || (O.z || 0) !== (L.z || 0)) continue;
          const quedan = O.celdas.filter(q => !nuevas.has(q.join(','))); if (quedan.length === O.celdas.length) continue;
          if (O.candado || O.fijo) { const suyas = new Set(O.celdas.map(q => q.join(','))); trabadas += L.celdas.length - (L.celdas = L.celdas.filter(q => !suyas.has(q.join(',')))).length; continue; }
          sacadas += O.celdas.length - quedan.length; O.celdas = quedan; if (!quedan.length) M.quitar(O, true); else M.rehacer(O); }
        if (trabadas) M.rehacer(L); if (sacadas || trabadas) M.toast(`${sacadas ? `Reemplazó ${sacadas} cuadros de otro piso` : ''}${sacadas && trabadas ? ' · ' : ''}${trabadas ? `${trabadas} cuadros quedaron como estaban (ese piso tiene candado)` : ''}`); }
      if (!L.celdas.length) { M.quitar(L, true); T.losa = null; } else M.cambio(); return true; }
    if (T.h === 'pared' && T.arr) { const A = T.arr; T.arr = null; if (!A.mov) return true;   // fue un toque: lo pone el clic, punto por punto
      const p = motor.enPiso(e.clientX, e.clientY); if (!p) return true; const prev = T.pts[T.pts.length - 1], q = iman(p, e, prev); if (Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 0.2) return true;
      if (T.pts.length > 2 && Math.hypot(q[0] - T.pts[0][0], q[1] - T.pts[0][1]) < 0.05) { recintoDe(T.pts); return true; } T.pts.push(q); punto(q[0], q[1]); paredPasar(p, e); return true; }
    if (T.h === 'recinto') { const p = motor.enPiso(e.clientX, e.clientY), ok = p && T.a && recPrev(p, e); if (ok) { const pz = T.p; delete pz._p; pz.nombre = nombreNuevo(); T.p = null; T.a = null; guias.clear(); medir(''); M.rehacer(pz); M.cambio(); M.toast(`${pz.nombre}: ${fmt(Math.abs(areaSig(pz.pts)))} m². Tocá el piso para moverlo entero`); } else if (!T.recien) M.toast('Muy chico: estiralo un poco más'); T.recien = false; return true; }
    if (T.h) return true; if (!D) return false; const d = D; D = null; medir(''); if (d.mov) M.cambio(); else M.ficha(); return true; }
  function pasar(e) { if (!T.h) return false; const p = motor.enPiso(e.clientX, e.clientY); if (!p) return true;
    if (T.h === 'relieve') { verAnillo(enTerreno(e)); return true; }
    if (T.h === 'pared') paredPasar(p, e); else if (T.h === 'recinto' && T.a) recPrev(p, e); else if (T.h === 'abertura') abPasar(p, e); return true; }
  function clic(e, p) { if (!T.h) return false; if (T.h === 'pared') paredClic(p, e); else if (T.h === 'abertura') abClic(p, e); return true; }
  function tecla(e, k) {
    if (T.h === 'pared') { if (k === 'enter') { paredFin(); return true; } if (k === 'backspace') { e.preventDefault(); T.pts.pop(); if (T.p) { if (T.pts.length) { T.p.pts = [...T.pts, T.p.pts[T.p.pts.length - 1]]; M.rehacer(T.p); } else { M.quitar(T.p, true); T.p = null; guias.clear(); medir(''); } } return true; } }
    if (T.h === 'relieve' && ['+', '=', ']', '-', '_', '['].includes(k)) { e.preventDefault(); T.radio = Math.max(2, Math.min(40, T.radio * (['+', '=', ']'].includes(k) ? 1.25 : 0.8))); T.radio = Math.round(T.radio * 4) / 4; if (anillo.visible) anillo.scale.setScalar(T.radio); motor.dirty = true; pincelPista(); return true; }
    if (T.h) return false; const p = SUB && pieza(SUB.id);
    if ((k === 'delete' || k === 'backspace') && p) { e.preventDefault(); borrarSub(p); return true; }
    return false; }
  function borrarSub(p) { if (SUB.hueco != null) { const h = p.huecos[SUB.hueco]; p.huecos.splice(SUB.hueco, 1); if (!p.huecos.length) delete p.huecos; SUB = null; M.rehacer(p); M.cambio(); M.ficha(); marcar(); M.toast(ABERTURAS[h.k].n + ' sacada · Ctrl+Z para volver'); return; }
    const i = SUB.lado; SUB = null;
    if (p.t === 'recinto') { p.lados = { ...(p.lados || {}), [i]: { ...((p.lados || {})[i] || {}), tipo: 'sin' } }; if (p.huecos) { p.huecos = p.huecos.filter(h => h.s !== i); if (!p.huecos.length) delete p.huecos; } M.rehacer(p); M.cambio(); M.ficha(); marcar(); M.toast('Pared sacada: ese lado queda abierto · Ctrl+Z para volver'); return; }
    // pared suelta: se saca ese tramo; si era del medio, la pared queda partida en dos
    const P = p.pts, izq = P.slice(0, i + 1), der = P.slice(i + 1), parte = (pts, corr) => ({ ...JSON.parse(JSON.stringify(p)), pts, lados: Object.fromEntries(Object.entries(p.lados || {}).filter(([k]) => +k - corr >= 0 && +k - corr < pts.length - 1).map(([k, v]) => [+k - corr, v])), huecos: (p.huecos || []).filter(h => h.s - corr >= 0 && h.s - corr < pts.length - 1).map(h => ({ ...h, s: h.s - corr })) });
    M.quitar(p, true); for (const [pts, corr] of [[izq, 0], [der, i + 1]]) if (pts.length >= 2) { const q = parte(pts, corr); q.id = M.nuevoId('pared'); if (!q.huecos.length) delete q.huecos; if (!Object.keys(q.lados).length) delete q.lados; M.E.piezas.push(q); M.rehacer(q); }
    M.cambio(); M.toast('Tramo de pared sacado · Ctrl+Z para volver'); }

  // ---------- ficha de una pared o de una abertura ----------
  function ficha() { const p = SUB && pieza(SUB.id); if (!p || M.SEL !== p || !M.ED.on) return null; const L = lados(p), cerrar = `<button class="mx" data-sel="no" aria-label="Cerrar">${M.svg('cerrar', 16)}</button>`;
    if (SUB.hueco != null) { const h = (p.huecos || [])[SUB.hueco]; if (!h) return null;
      return `<div class="mhead"><div><small>Abertura en ${M.esc(nombreDe(p))}</small><b>${ABERTURAS[h.k].n}</b></div>${cerrar}</div><div class="mform dos"><label><span>Tipo</span><select data-c="k">${Object.entries(ABERTURAS).map(([k, v]) => `<option value="${k}" ${k === h.k ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label><label><span>Ancho (m)</span><input type="number" data-c="w" step="0.1" min="0.4" max="12" value="${anchoDe(h)}"></label></div>
        <div class="macts"><button class="mbtn peligro" data-c="borrar">${M.svg('borrar', 16)}Sacar</button></div><p class="mnota">Arrastrala para correrla a lo largo de la pared.</p>`; }
    const l = L[SUB.lado]; if (!l) return null; const o = (p.lados || {})[SUB.lado] || {}, len = Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]), tipo = o.tipo || p.tipo || TIPOS[p.t].def.tipo, color = o.color || p.color || TIPOS[p.t].def.color;
    return `<div class="mhead"><div><small>Pared de ${M.esc(nombreDe(p))}</small><b>${fmt(len)} m</b></div>${cerrar}</div><div class="mform dos"><label><span>Tipo</span><select data-c="tipo">${PAREDES.slice(0, p.t === 'recinto' ? 6 : 5).map(([k, n]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label><span>Color</span><span class="mcol"><input type="color" data-c="color" value="${color}"></span></label></div>
      <div class="macts">${['puerta', 'ventana', 'paso'].map(k => `<button class="mbtn" data-c="mas" data-k="${k}">${M.svg(k, 16)}${ABERTURAS[k].n.replace(' sin puerta', '')}</button>`).join('')}</div>
      <div class="macts"><button class="mbtn" data-c="todo">${M.svg('recinto', 16)}${p.t === 'recinto' ? 'Recinto entero' : 'Pared entera'}</button><button class="mbtn peligro" data-c="borrar">${M.svg('borrar', 16)}Sacar pared</button></div><p class="mnota">${p.t === 'recinto' ? 'Arrastrá la pared para agrandar o achicar el recinto.' : 'Arrastrá los puntos celestes para mover cada punta.'}</p>`; }
  // un campo de la ficha cambió (devuelve true si era de acá)
  function entrada(el) { const c = el.dataset.c, p = SUB && pieza(SUB.id); if (!c || !p) return false;
    if (SUB.hueco != null) { const h = p.huecos[SUB.hueco]; if (c === 'k') { h.k = el.value; delete h.w; } if (c === 'w') { const w = Math.max(0.4, +el.value || anchoDe(h)), l = lados(p)[h.s], len = Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]); if (w < len - 0.2) { h.w = w; h.a = Math.min(h.a, len - w - 0.1); } } }
    else p.lados = { ...(p.lados || {}), [SUB.lado]: { ...((p.lados || {})[SUB.lado] || {}), [c]: el.value } };
    M.rehacer(p); marcar(); M.cambio(true, el.type === 'number'); if (c === 'k' || c === 'tipo') M.ficha(); return true; }
  function accion(b) { const c = b.dataset.c, p = SUB && pieza(SUB.id); if (!c || !p) return false;
    if (c === 'borrar') borrarSub(p);
    if (c === 'todo') { SUB = null; marcar(); M.ficha(); }
    if (c === 'mas') { const k = b.dataset.k, i = SUB.lado, l = lados(p)[i], len = Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]), w = ABERTURAS[k].w; let a = null;
      for (const q of [(len - w) / 2, 0.3, len - w - 0.3, ...Array.from({ length: Math.max(0, Math.floor(len / 0.5)) }, (_, n) => 0.1 + n * 0.5)]) if (q >= 0.1 && q + w <= len - 0.1 && entra(p, i, q, w)) { a = gr(q); break; }
      if (a == null) { M.toast('No entra en esta pared'); return true; } (p.huecos = p.huecos || []).push({ s: i, a, k }); SUB = { id: p.id, hueco: p.huecos.length - 1 }; M.rehacer(p); M.cambio(); marcar(); M.ficha(); }
    return true; }
  return { T, empezar, cancelar, tocar, agarrar, mover, soltar, pasar, clic, tecla, ficha, entrada, accion, marcar, contenido, girar, insertado, quitado, esMuro, get sub() { return SUB; }, set sub(v) { SUB = v; marcar(); }, alElegir(p) { if (SUB && (!p || p.id !== SUB.id)) { SUB = null; } marcar(); } }; }

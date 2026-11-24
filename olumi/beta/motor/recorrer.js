// Motor común · recorrer a pie, como en un juego en tercera persona.
// Caminar: W A S D o flechas (← → giran), Shift corre, clic en el piso camina hasta ahí (busca el camino por las puertas).
// Mirar: arrastrar, o dos dedos de costado en el trackpad. Rueda o pellizco: acerca la cámara; del todo cerca se ve por los ojos (V).
// E o clic sobre un equipo: abre su ficha. Esc sale. En el celular: palanca a la izquierda y arrastrar para mirar.
// V cambia la vista: tercera persona (para andar lejos), por los ojos (para armar de cerca) y vuelo (la cámara se suelta del muñeco:
// W A S D la llevan, E o Espacio suben, Q baja, Shift apura; al salir del vuelo el muñeco baja donde quedó la cámara).
// Se puede editar mientras se recorre: el toque pone o elige, arrastrar mira.
// En la compu se maneja como un juego: al entrar se toma el mouse (mover el mouse mira, sin arrastrar) y la mira del centro apunta. Espacio salta
// (se puede subir a lo bajo: un escritorio, un cantero) y dos veces seguidas pasa al vuelo o vuelve. Esc suelta el mouse; un clic en la maqueta lo retoma.
// No atraviesa nada: cajas de lo que ocupa lugar y tramos macizos de las paredes (userData.segs, que valen aunque la pieza esté girada).
import { THREE } from './nucleo.js?v=eb3c83a2';

export function recorrer(M) {
  const { motor, mundo, objs, TIPOS } = M, C = motor.C, $ = s => document.querySelector(s);
  const R = { on: false, x: 0, z: 0, y: 0, rumbo: 0, vx: 0, vz: 0, k: {}, joy: { x: 0, y: 0 }, dist: 7, ojos: false, piezas: [], edif: [], pis: [], hash: new Map() };
  // en tercera persona la cámara baja hasta mirar hacia arriba unos 50° (antes quedaba trancada mirando hacia abajo y había que pasar a los ojos)
  const PM3 = -0.85;
  const RADIO = 0.28, CAMINA = 3, CORRE = 6.5, SALTO = 6.2, PESO = 20, v3 = new THREE.Vector3();
  const puedeMira = () => !motor.sinMira && !motor.tactil && matchMedia('(pointer: fine)').matches;

  // ---------- lo que no se atraviesa ----------
  // Cada pieza aporta cajas en su propio marco (aunque esté girada): una por cada parte que se ve (aplanar() guarda las partes que junta en una malla),
  // los cilindros y esferas parados como redondos, y las partes inclinadas (una cinta, una rampa de balanza) en tramos, para que no sean una caja enorme.
  // Las piezas con userData.segs (paredes, naves, edificios) usan sus tramos macizos y userData.cajasL (volúmenes en su marco); userData.pisables son superficies que se pisan (rampas,
  // descansos, escaleras), macizas hasta el suelo (o hasta S.base; con S.abierta, abiertas por abajo a esa distancia de la superficie):
  // se sube si el escalón es de menos de 60 cm, si no, son pared.
  const MI = new THREE.Matrix4(), MR = new THREE.Matrix4(), MX = new THREE.Matrix4(), MQ = new THREE.Matrix4(), BX = new THREE.Box3(), VA = new THREE.Vector3(), VB = new THREE.Vector3(), ESQ = [...Array(8)].map(() => new THREE.Vector3());
  const REDONDO = /Cylinder|Sphere|Icosahedron|Dodecahedron|Octahedron|Cone|Capsule/;
  function cajasDe(bb, mm, tipo, out) { const e = mm.elements, uy = Math.hypot(e[4], e[5], e[6]) || 1, derecho = Math.abs(e[5] / uy) > 0.995, sx = Math.hypot(e[0], e[1], e[2]), sz = Math.hypot(e[8], e[9], e[10]);
    if (derecho && REDONDO.test(tipo || '') && Math.abs(sx * (bb.max.x - bb.min.x) - sz * (bb.max.z - bb.min.z)) < 0.25 * sx * (bb.max.x - bb.min.x) + 0.01) { BX.copy(bb).applyMatrix4(mm); const c = BX.getCenter(VA);
      out.push({ k: 1, cx: c.x, cz: c.z, rad: (sx * (bb.max.x - bb.min.x) + sz * (bb.max.z - bb.min.z)) / 4, y0: BX.min.y, y1: BX.max.y }); return; }
    const yaw = derecho && Math.abs(e[1] / sx) < 0.005 ? Math.atan2(e[8], e[0]) : 0, recto = derecho && Math.abs(Math.sin(2 * yaw)) < 0.01;
    if (derecho && !recto) { MQ.copy(mm).invert(); const q = MQ.elements; BX.copy(bb).applyMatrix4(mm);   // parada pero girada: caja orientada (la prueba pasa el punto al marco de la parte)
      out.push({ k: 2, a: q[0], b: q[8], c: q[12], d: q[2], f: q[10], g: q[14], x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, sx, sz, y0: BX.min.y, y1: BX.max.y, bx0: BX.min.x, bx1: BX.max.x, bz0: BX.min.z, bz1: BX.max.z }); return; }
    if (derecho) { BX.copy(bb).applyMatrix4(mm); out.push({ k: 0, x0: BX.min.x, x1: BX.max.x, z0: BX.min.z, z1: BX.max.z, y0: BX.min.y, y1: BX.max.y }); return; }
    // inclinada (una cinta, un cubo parado en un vértice): caja orientada en tres dimensiones; la prueba pasa a su marco unos puntos a la altura del cuerpo
    BX.copy(bb).applyMatrix4(mm); out.push({ k: 3, q: MQ.copy(mm).invert().elements.slice(), bb: bb.clone(), sx, sy: uy, sz, y0: BX.min.y, y1: BX.max.y, bx0: BX.min.x, bx1: BX.max.x, bz0: BX.min.z, bz1: BX.max.z }); }
  // ¿el punto (en el marco de la pieza) cae adentro de la caja, con un margen r?
  function enCaja(c, lx, lz, r, ya, yb) { if (c.k === 1) return Math.hypot(lx - c.cx, lz - c.cz) < c.rad + r;
    if (c.k === 3) { if (lx < c.bx0 - r || lx > c.bx1 + r || lz < c.bz0 - r || lz > c.bz1 + r) return false; const q = c.q, B = c.bb, rs = r / Math.min(c.sx, c.sy, c.sz), a = Math.max(ya ?? c.y0, c.y0), b = Math.min(yb ?? c.y1, c.y1);
      for (let y = a; y <= b + 1e-6; y += Math.max(0.05, Math.min(0.3, (b - a) / 4 || 1))) { const px = q[0] * lx + q[4] * y + q[8] * lz + q[12], py = q[1] * lx + q[5] * y + q[9] * lz + q[13], pz = q[2] * lx + q[6] * y + q[10] * lz + q[14];
        if (px > B.min.x - rs && px < B.max.x + rs && py > B.min.y - rs && py < B.max.y + rs && pz > B.min.z - rs && pz < B.max.z + rs) return true; } return false; }
    if (c.k === 2) { if (lx < c.bx0 - r || lx > c.bx1 + r || lz < c.bz0 - r || lz > c.bz1 + r) return false; const px = c.a * lx + c.b * lz + c.c, pz = c.d * lx + c.f * lz + c.g; return px > c.x0 - r / c.sx && px < c.x1 + r / c.sx && pz > c.z0 - r / c.sz && pz < c.z1 + r / c.sz; }
    return lx > c.x0 - r && lx < c.x1 + r && lz > c.z0 - r && lz < c.z1 + r; }
  // marco de la pieza: x, z del mundo → x, z de la pieza (solo gira en y)
  function marco(g) { g.updateMatrixWorld(true); const e = MI.copy(g.matrixWorld).invert().elements; return { g, a: e[0], b: e[8], c: e[12], d: e[2], f: e[10], h: e[14], oy: g.matrixWorld.elements[13] }; }
  const enMarco = (P, x, z) => [P.a * x + P.b * z + P.c, P.d * x + P.f * z + P.h];
  // altura de una superficie que se pisa en (lx, lz), o null si el punto queda afuera
  function alturaS(S, lx, lz, m = 0) { if (lx < S.x0 - m || lx > S.x1 + m || lz < S.z0 - m || lz > S.z1 + m) return null;
    if (S.rampa === 'z') return S.y0 + (S.y1 - S.y0) * Math.max(0, Math.min(1, (lz - S.za) / (S.zb - S.za)));
    if (S.rampa) return S.y0 + (S.y1 - S.y0) * Math.max(0, Math.min(1, (lx - S.xa) / (S.xb - S.xa)));
    const H = S.hueco; if (H && lx > H[0] && lx < H[2] && lz > H[1] && lz < H[3]) return null; return S.y; }
  const visto = (m, g) => { for (let a = m; a && a !== g; a = a.parent) if (!a.visible) return false; return true; };
  function obstaculos() { R.piezas = []; R.edif = []; R.pis = []; R.hash = new Map(); R.n = 0;
    const meter = (P, c) => { const xs = [], zs = []; if (c.k === 1) for (const [dx, dz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) { xs.push(c.cx + dx * c.rad); zs.push(c.cz + dz * c.rad); } else { const [x0, x1, z0, z1] = c.k >= 2 ? [c.bx0, c.bx1, c.bz0, c.bz1] : [c.x0, c.x1, c.z0, c.z1]; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { xs.push(x); zs.push(z); } }
      const M4 = P.g.matrixWorld.elements, wx = xs.map((x, i) => M4[0] * x + M4[8] * zs[i] + M4[12]), wz = xs.map((x, i) => M4[2] * x + M4[10] * zs[i] + M4[14]);
      const w = { x0: Math.min(...wx), x1: Math.max(...wx), z0: Math.min(...wz), z1: Math.max(...wz), y0: c.y0 + P.oy, y1: c.y1 + P.oy }, it = { P, c, w }; R.n++;
      for (let i = Math.floor((w.x0 - 1) / 8); i <= Math.floor((w.x1 + 1) / 8); i++) for (let j = Math.floor((w.z0 - 1) / 8); j <= Math.floor((w.z1 + 1) / 8); j++) { const k = i + ',' + j; (R.hash.get(k) || R.hash.set(k, []).get(k)).push(it); } };
    for (const g of objs.values()) { const p = g.userData.pieza; if (!g.visible || !p || p.t === 'persona') continue; const T = TIPOS[p.t] || {}, P = marco(g), U = g.userData;
      if (U.suelos) R.edif.push(g);
      if (U.pisables && U.pisables.length) { const b = new THREE.Box3(); for (const S of U.pisables) for (const [x, z] of [[S.x0, S.z0], [S.x1, S.z0], [S.x0, S.z1], [S.x1, S.z1]]) b.expandByPoint(VA.set(x, 0, z).applyMatrix4(g.matrixWorld)); R.pis.push({ P, S: U.pisables, b: b.expandByScalar(1) }); }
      for (const c of U.cajasL || []) meter(P, { k: 0, x0: c[0], z0: c[1], x1: c[2], z1: c[3], y0: c[4], y1: c[5] });   // volúmenes macizos que la pieza declara
      if (U.segs) { const vi = !U.interiorMalla || U.interiorMalla.visible, segs = vi ? U.segs : U.segs.filter(q => q[8] !== 'int'); if (segs.length) R.piezas.push({ g, P, b: new THREE.Box3().setFromObject(g).expandByScalar(0.6), segs, inv: g.matrixWorld.clone().invert() }); if (!U.mallas) continue; }
      else if (T.forma === 'area' && !U.mallas) continue;
      MR.copy(g.matrixWorld).invert(); const out = [];
      g.traverse(m => { if (!m.isMesh || m.userData.campo || m.userData.noChoca || (U.mallas && !m.userData.choca) || !visto(m, g)) return; MX.multiplyMatrices(MR, m.matrixWorld);
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        if (m.userData.partes) { for (const q of m.userData.partes) cajasDe(q.bb, MQ.multiplyMatrices(MX, q.mm).clone(), q.tipo, out); return; }
        if (m.isInstancedMesh) { const X = new THREE.Matrix4(), Y = new THREE.Matrix4(), n0 = out.length; for (let i = 0; i < Math.min(m.count, 4000); i++) { m.getMatrixAt(i, X); cajasDe(m.geometry.boundingBox, Y.multiplyMatrices(MX, X), m.geometry.type, out); }
          if (m.userData.follaje) for (let i = n0; i < out.length; i++) if (out[i].y0 > 1) out[i].y1 = -1; return; }
        cajasDe(m.geometry.boundingBox, MX.clone(), m.geometry.type, out); });
      for (const c of out) { const lx = c.k === 1 ? 2 * c.rad : c.k >= 2 ? c.bx1 - c.bx0 : c.x1 - c.x0, lz = c.k === 1 ? 2 * c.rad : c.k >= 2 ? c.bz1 - c.bz0 : c.z1 - c.z0; if (c.y1 < 0.35 || lx > 400 || lz > 400) continue; meter(P, c); } } }
  const aTramo = (x, z, s) => { const ax = s[2] - s[0], az = s[3] - s[1], l2 = ax * ax + az * az, t = l2 ? Math.max(0, Math.min(1, ((x - s[0]) * ax + (z - s[1]) * az) / l2)) : 0; return Math.hypot(x - s[0] - ax * t, z - s[1] - az * t); };
  // ¿el cuerpo (de 0,35 a 1,7 m sobre donde pisa) toca algo en ese lugar?
  function choca(x, z, y = R.y, r = RADIO) { const L = R.hash.get(Math.floor(x / 8) + ',' + Math.floor(z / 8));
    if (L) for (const { P, c, w } of L) { if (w.y1 <= y + 0.35 || w.y0 >= y + 1.7 || x < w.x0 - r || x > w.x1 + r || z < w.z0 - r || z > w.z1 + r) continue; const [lx, lz] = enMarco(P, x, z); if (enCaja(c, lx, lz, r, y + 0.35 - P.oy, y + 1.7 - P.oy)) return true; }
    for (const Q of R.piezas) { if (x < Q.b.min.x || x > Q.b.max.x || z < Q.b.min.z || z > Q.b.max.z) continue; const [lx, lz] = enMarco(Q.P, x, z), yy = y - Q.P.oy;
      for (const s of Q.segs) if (s[6] > yy + 0.35 && s[5] < yy + 1.7 && aTramo(lx, lz, s) < s[4] + r) return true; }
    for (const Q of R.pis) { if (x < Q.b.min.x || x > Q.b.max.x || z < Q.b.min.z || z > Q.b.max.z) continue; const [lx, lz] = enMarco(Q.P, x, z), yy = y - Q.P.oy;
      for (const S of Q.S) { const h = alturaS(S, lx, lz, Math.min(r, 0.1)); if (h != null && h > yy + 0.6 && (S.abierta ? h - S.abierta : S.base || 0) < yy + 1.7) return true; } }
    // las escaleras de adentro de los edificios son macizas desde el piso donde arrancan
    for (const g of R.edif) { const [lx, lz] = enEdif(g, x, z); for (const S of g.userData.suelos) { if (!S.rampa) continue; const h = alturaS(S, lx, lz, Math.min(r, 0.1)); if (h != null && h > y + 0.6 && Math.min(S.y0, S.y1) < y + 1.7) return true; } }
    return false; }
  // ¿ese punto del aire queda tapado para la cámara? (no cuenta lo que está escondido arriba del piso donde uno camina)
  function tapa(x, y, z) { const L = R.hash.get(Math.floor(x / 8) + ',' + Math.floor(z / 8));
    if (L) for (const { P, c, w } of L) { if (y < w.y0 - 0.1 || y > w.y1 + 0.15 || x < w.x0 - 0.15 || x > w.x1 + 0.15 || z < w.z0 - 0.15 || z > w.z1 + 0.15) continue; const [lx, lz] = enMarco(P, x, z); if (enCaja(c, lx, lz, 0.15, y - P.oy, y - P.oy)) return true; }
    for (const Q of R.piezas) { if (x < Q.b.min.x || x > Q.b.max.x || z < Q.b.min.z || z > Q.b.max.z) continue; const oculto = Q.g === R.dentro, [lx, lz] = enMarco(Q.P, x, z), yy = y - Q.P.oy;
      for (const s of Q.segs) { if ((oculto && (s[7] || 0) > R.piso) || s[4] < 0.1) continue; if (yy > s[5] - 0.1 && yy < s[6] + 0.15 && aTramo(lx, lz, s) < s[4] + 0.15) return true; } }
    return false; }
  // lo bajo a lo que uno se sube (un escritorio, un cantero, la plataforma de la balanza)
  function sobre(x, z, y) { const L = R.hash.get(Math.floor(x / 8) + ',' + Math.floor(z / 8)); let m = 0; if (L) for (const { P, c, w } of L) { if (w.y1 > y + 0.3 || w.y1 <= m || x < w.x0 - 0.05 || x > w.x1 + 0.05 || z < w.z0 - 0.05 || z > w.z1 + 0.05) continue; if (c.k === 3) continue; const [lx, lz] = enMarco(P, x, z); if (enCaja(c, lx, lz, 0.05)) m = w.y1; } return m; }
  // arranca donde mira la cámara; si ahí hay algo (un edificio, una pila), busca el lugar libre más cercano dando vueltas
  function libre(x, z) { if (!choca(x, z)) return [x, z]; for (let r = 1; r < 120; r += 1) for (let a = 0; a < 6.28; a += 0.9 / r) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!choca(px, pz)) return [px, pz]; } return [x, z]; }
  // pisos que se pisan (edificios por dentro): el más alto que queda a un paso (60 cm) de donde uno está; afuera, el suelo
  function enEdif(g, x, z) { v3.set(x, 0, z); g.worldToLocal(v3); return [v3.x, v3.z]; }
  function alturaEn(x, z, y) { let mejor = motor.cota ? Math.max(0, motor.cota(x, z)) : 0; for (const g of R.edif) { const [lx, lz] = enEdif(g, x, z);
      for (const S of g.userData.suelos) { const h = alturaS(S, lx, lz); if (h != null && h <= y + 0.6 && h > mejor) mejor = h; } }
    for (const Q of R.pis) { if (x < Q.b.min.x || x > Q.b.max.x || z < Q.b.min.z || z > Q.b.max.z) continue; const [lx, lz] = enMarco(Q.P, x, z);
      for (const S of Q.S) { const h = alturaS(S, lx, lz); if (h != null && h + Q.P.oy <= y + 0.6 && h + Q.P.oy > mejor) mejor = h + Q.P.oy; } } return mejor; }
  // adentro de un edificio se esconde lo que está arriba del piso donde uno camina (losas, paredes y techo); por los ojos se ve todo, como en la realidad
  function niveles(g, hasta) { const p = g.userData.pieza || {}; g.traverse(m => { if (m.isMesh && m.userData.nivel != null) m.visible = hasta == null ? !(p.corte && m.userData.nivel > 0) : m.userData.nivel <= hasta; }); motor.dirty = true; }
  function adentro(g, piso) { const ver = g && !R.ojos && !R.vuelo ? piso : null;
    if (R.dentro && R.dentro !== g) { niveles(R.dentro, null); if (R.afuera) { R.dist = R.afuera.d; R.incl = { a: R.afuera.pitch, t: 0.9 }; R.afuera = null; } }
    if (g && R.dentro !== g && !R.ojos && !R.vuelo) { R.afuera = { d: R.dist, pitch: C.pitch }; R.dist = Math.min(R.dist, 8); R.incl = { a: Math.max(C.pitch, 0.95), t: 0.9 }; }
    if (g && (R.dentro !== g || R.piso !== piso || R.verN !== ver)) niveles(g, ver);
    R.dentro = g; R.piso = piso; R.verN = ver; }

  // ---------- camino hasta donde se hizo clic: A* sobre una grilla de 40 cm, sin cortar esquinas, y después se endereza ----------
  function recta(x0, z0, x1, z1) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.2); for (let i = 1; i <= n; i++) if (choca(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)) return false; return true; }
  function camino(x0, z0, x1, z1) { if (recta(x0, z0, x1, z1)) return [[x1, z1]];
    const P = 0.4, mg = 12, ox = Math.min(x0, x1) - mg, oz = Math.min(z0, z1) - mg, W = Math.ceil((Math.abs(x1 - x0) + 2 * mg) / P), H = Math.ceil((Math.abs(z1 - z0) + 2 * mg) / P); if (W * H > 60000) return null;
    const est = new Uint8Array(W * H), pasa = i => { if (!est[i]) est[i] = choca(ox + (i % W + 0.5) * P, oz + (Math.floor(i / W) + 0.5) * P, R.y, RADIO + 0.05) ? 2 : 1; return est[i] === 1; };
    const celda = (x, z) => Math.min(H - 1, Math.max(0, Math.floor((z - oz) / P))) * W + Math.min(W - 1, Math.max(0, Math.floor((x - ox) / P)));
    const ini = celda(x0, z0); let fin = celda(x1, z1); est[ini] = 1;
    if (!pasa(fin)) { let m = -1, md = 1e9; const fi = fin % W, fj = Math.floor(fin / W); for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) { const i = fi + di, j = fj + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue; const d = di * di + dj * dj; if (d < md && pasa(j * W + i)) { md = d; m = j * W + i; } } if (m < 0) return null; fin = m; }
    const g = new Float32Array(W * H).fill(1e9), de = new Int32Array(W * H).fill(-1), cerr = new Uint8Array(W * H), heap = [], fi = fin % W, fj = Math.floor(fin / W), h = i => Math.hypot(i % W - fi, Math.floor(i / W) - fj);
    const mete = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const saca = () => { const t = heap[0], u = heap.pop(); if (heap.length) { heap[0] = u; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return t; };
    g[ini] = 0; mete(ini, h(ini)); let ok = false, vueltas = 0;
    while (heap.length && vueltas++ < 60000) { const [, i] = saca(); if (cerr[i]) continue; cerr[i] = 1; if (i === fin) { ok = true; break; } const ci = i % W, cj = Math.floor(i / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const n = nj * W + ni; if (cerr[n] || !pasa(n)) continue;
        if (di && dj && (!pasa(cj * W + ni) || !pasa(nj * W + ci))) continue; const c = g[i] + (di && dj ? 1.414 : 1); if (c < g[n]) { g[n] = c; de[n] = i; mete(n, c + h(n)); } } }
    if (!ok) return null; const pts = []; for (let i = fin; i !== -1 && i !== ini; i = de[i]) pts.push([ox + (i % W + 0.5) * P, oz + (Math.floor(i / W) + 0.5) * P]); pts.reverse();
    if (fin === celda(x1, z1) && !choca(x1, z1)) pts.push([x1, z1]);
    const out = []; let ax = x0, az = z0, k = 0; while (k < pts.length) { let j = pts.length - 1; while (j > k && !recta(ax, az, pts[j][0], pts[j][1])) j--; out.push(pts[j]); [ax, az] = pts[j]; k = j + 1; } return out; }
  const marca = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d9bf0, transparent: true, opacity: 0.9, depthWrite: false })); marca.visible = false; marca.renderOrder = 4; motor.scene.add(marca);
  function irA(x, z) { if (!R.on) return; const c = camino(R.x, R.z, x, z) || [[x, z]]; R.ruta = c; R.trabado = 0; const f = c[c.length - 1]; marca.position.set(f[0], R.y + 0.12, f[1]); marca.visible = true; motor.dirty = true; }

  // ---------- entrar y salir ----------
  async function paseo(on, donde) { if (on === R.on) { if (on && donde) irA(donde[0], donde[1]); return; } R.on = on; motor.caminando = on; if (on) { if (puedeMira()) { motor.mira(true); R.llena = !!M.completa && !M.llena(); if (R.llena) M.completa(true); } } else { motor.mira(false); if (R.llena) { R.llena = false; M.completa(false); } } const b = $('#bpaseo'); if (b) b.setAttribute('aria-pressed', on);
    document.body.classList.toggle('paseando', on); document.body.classList.toggle('tactil', !!motor.tactil || matchMedia('(pointer: coarse)').matches); R.joy = { x: 0, y: 0 }; R.k = {}; R.ruta = null; marca.visible = false; joyKnob();
    if (!on) { if (R.g) mundo.remove(R.g); R.g = R.ob = null; R.vuelo = false; adentro(null); R.afuera = null; R.y = 0; motor.piso = 0; R.ojos = false; Object.assign(C, R.antes.lim); C.ty = 0; R.incl = R.cerca = null; $('#musar').hidden = true; motor.ir(R.antes.cam, 0.6); M.alSalir && M.alSalir(); return; }
    R.antes = { cam: { tx: C.tx, tz: C.tz, d: Math.max(30, C.d), pitch: Math.max(0.3, C.pitch) }, lim: { min: C.min, max: C.max, pmin: C.pmin } }; Object.assign(C, { min: 0.05, max: 60, pmin: PM3 });
    R.y = 0; R.vx = R.vz = 0; R.vy = 0; R.ojos = false; R.vuelo = false; R.dist = motor.mirando || puedeMira() ? 4.2 : 7; obstaculos(); vistaTxt(); ayudaTxt(); [R.x, R.z] = libre(donde ? donde[0] : C.tx, donde ? donde[1] : C.tz); R.rumbo = C.yaw + Math.PI; R.puesta = null; motor.ir({ tx: R.x, tz: R.z, d: R.dist, pitch: 0.36 }, 0.7); R.viaje = 0.75;
    const g = new THREE.Group(); g.position.set(R.x, 0, R.z); mundo.add(g); R.g = g; ayuda(true); R.ob = await M.avatar(g); motor.dirty = true; }
  // por los ojos (V): la cámara va a la cabeza y el muñeco no se dibuja
  function ojos(on) { if (!R.on) return; if (on && !R.ojos) R.tercera = Math.max(2.5, R.dist); R.dist = on ? 0.05 : R.tercera || 7; }
  // vuelo: la cámara se suelta del muñeco y vuela sin chocar; al salir, el muñeco baja donde quedó
  function vuelo(on, vuelve) { if (!R.on || on === !!R.vuelo) return; R.vuelo = on; R.vy = 0; if (on) { R.deOjos = R.ojos; if (!R.ojos) R.tercera = Math.max(2.5, R.dist); R.fx = R.x; R.fz = R.z; R.fy = R.y + 1.62; R.ruta = null; marca.visible = false; C.pmin = -1.2; }
    else { [R.x, R.z] = libre(R.fx, R.fz); R.y = alturaEn(R.x, R.z, Math.max(0, R.fy - 1.6)); R.vx = R.vz = 0; const aOjos = vuelve && R.deOjos; R.dist = aOjos ? 0.05 : R.tercera || 7; R.ojos = !!aOjos; C.pmin = aOjos ? -1.2 : PM3; if (!aOjos && C.pitch < 0.2) C.pitch = 0.36; R.viaje = 0; R.puesta = null; } vistaTxt(); motor.dirty = true; }
  // V pasa de tercera persona a los ojos, de los ojos al vuelo y vuelve
  function vista() { if (R.vuelo) vuelo(false); else if (R.ojos || R.dist < 0.9) { vuelo(true); } else ojos(true); vistaTxt(); }
  function vistaTxt() { const b = $('#mpojos'); if (!b) return; const n = R.vuelo ? 'Vuelo' : R.dist < 0.9 ? 'Ojos' : '3.ª persona'; b.querySelector('span').textContent = n; b.setAttribute('aria-pressed', n !== '3.ª persona'); b.title = `Vista: ${n}. Cambiar (V)`; }

  // ---------- teclas, palanca y ayuda ----------
  document.body.insertAdjacentHTML('beforeend', `<div id="mmira" aria-hidden="true"></div><div id="mpaseo" role="status"><span class="tec"></span><button type="button" id="mpojos" aria-label="Cambiar la vista" title="Vista (V)">${M.svg('ojo', 16)}<span>3.ª persona</span></button><button type="button" id="mpsalir">Salir</button></div><div id="mjoy" aria-hidden="true"><i></i></div><div id="musar" class="vidrio" hidden></div>`);
  // la ayuda de abajo: lo más importante primero; entra lo que da el ancho (la maqueta puede estar en un recuadro angosto dentro de la app)
  const P = ' <i></i> ', largo = h => h.replace(/<[^>]+>/g, '').length + 3 + 1.5 * (h.match(/<kbd>/g) || []).length;
  function ayudaTxt() { const el = $('#mpaseo .tec'); if (!el) return;
    const N = a => motor.nomTecla(motor.teclaDe(a)), andar = `<kbd>${N('adelante')} ${N('izq')} ${N('atras')} ${N('der')}</kbd>`;
    const its = motor.mirando ? (motor.editando ? ['<b>Clic</b> pone, elige o agarra', '<b>Clic derecho</b> suelta o deja como estaba', '<kbd>1</kbd> a <kbd>0</kbd> barra rápida', `<kbd>${N('inventario')}</kbd> inventario`, '<b>Rueda</b> gira', '<kbd>Esc</kbd> menú']
        : R.vuelo ? ['<b>Mouse</b> mirar', `${andar} volar`, `<kbd>${N('saltar')}</kbd> sube`, `<kbd>${N('bajar')}</kbd> baja`, `<kbd>${N('saltar')}</kbd> dos veces: bajar`, `<kbd>${N('correr')}</kbd> rápido`, `<kbd>${N('editar')}</kbd> editar`, '<kbd>Esc</kbd> menú']
        : ['<b>Mouse</b> mirar', `${andar} caminar`, `<kbd>${N('editar')}</kbd> editar`, `<kbd>${N('saltar')}</kbd> saltar, dos veces vuela`, '<kbd>Esc</kbd> menú', '<kbd>M</kbd> soltar el mouse', `<kbd>${N('correr')}</kbd> correr`, `<kbd>${N('vista')}</kbd> vista`])
      : puedeMira() ? ['<kbd>M</kbd> o <b>clic en la maqueta</b> para volver a mirar', '<kbd>Esc</kbd> menú', `${andar} caminar`]
      : [`${andar} caminar`, `<kbd>${N('correr')}</kbd> correr`, '<b>clic</b> ir ahí', '<b>arrastrar</b> mirar', `<kbd>${N('vista')}</kbd> vista`, '<kbd>Esc</kbd> menú'];
    let cabe = Math.max(26, (Math.min(980, innerWidth - 230)) / 7.5), out = []; for (const h of its) { if (out.length && largo(h) > cabe) break; out.push(h); cabe -= largo(h); } el.innerHTML = out.join(P); }
  ayudaTxt(); motor.alAjustes = () => { R.k = {}; ayudaTxt(); }; motor.alMira = () => { if (!R.on) return; if (!motor.mirando) R.k = {}; ayudaTxt(); ayuda(true); }; motor.alEditar = () => { if (R.on) { ayudaTxt(); ayuda(true); } };
  let ayT; function ayuda(ver) { const el = $('#mpaseo'); el.classList.toggle('corta', !ver); clearTimeout(ayT); if (ver) ayT = setTimeout(() => el.classList.add('corta'), 9000); }
  $('#mpsalir').onclick = () => paseo(false); $('#mpojos').onclick = vista; $('#mpaseo').addEventListener('pointerenter', () => ayuda(true));
  const joy = $('#mjoy'); function joyKnob() { const j = R.joy || { x: 0, y: 0 }; joy.firstChild.style.transform = `translate(${j.x * 36}px,${j.y * 36}px)`; }
  const mueveJoy = e => { if (R.jp !== e.pointerId) return; const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / 40, y = (e.clientY - r.top - r.height / 2) / 40; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } R.joy = { x, y }; R.ruta = null; marca.visible = false; joyKnob(); };
  joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); R.jp = e.pointerId; mueveJoy(e); e.stopPropagation(); }); joy.addEventListener('pointermove', mueveJoy);
  const sueltaJoy = () => { R.jp = null; R.joy = { x: 0, y: 0 }; joyKnob(); }; joy.addEventListener('pointerup', sueltaJoy); joy.addEventListener('pointercancel', sueltaJoy);
  const TECLAS = ['w', 'a', 's', 'd', 'q', 'e', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'];
  addEventListener('keydown', e => { if (!R.on || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return; const k = motor.canon(e.key.toLowerCase());   // cada tecla pasa por las que eligió el jugador (Ajustes)
    if (k === 'escape') return;   // Esc ya no saca del recorrido: cierra lo que haya abierto y, si no hay nada, abre el menú de pausa (maqueta.js)
    if (k === 'v') { vista(); ayudaTxt(); return; } if (k === 'e' && R.cerca && !R.vuelo && !motor.editando) { e.stopImmediatePropagation(); M.elegir(R.cerca); motor.mira(false); return; }
    if (k === ' ' && !e.repeat) { const ya = e.timeStamp || performance.now(); if (ya - (R.tEsp || 0) < 300) { R.tEsp = 0; vuelo(!R.vuelo, true); ayudaTxt(); if (!R.vuelo) { R.k[' '] = 0; R.saltado = 1; e.preventDefault(); return; } } else R.tEsp = ya; }
    if (TECLAS.includes(k)) { R.k[k] = 1; if (k !== 'shift') { R.ruta = null; marca.visible = false; } if (k.startsWith('arrow') || k === ' ') e.preventDefault(); } }, true);
  addEventListener('keyup', e => { R.k[motor.canon(e.key.toLowerCase())] = 0; }); addEventListener('blur', () => { R.k = {}; }); addEventListener('resize', () => { if (R.on) ayudaTxt(); });

  // ---------- cada cuadro ----------
  let tCerca = 0;
  motor.cada.push((dt, t) => { if (!R.on || !R.g) return false; const K = R.k, J = R.joy;
    motor.piso = R.vuelo ? alturaEn(R.fx, R.fz, R.fy) : R.y;   // el piso que hay debajo: con él el núcleo sabe cuánto aire tiene la cámara (plano cercano y sombras)
    // la rueda, el pellizco o los dedos cambian la distancia de la cámara: eso pasa a ser lo que se quiere
    if (R.viaje > 0) R.viaje -= dt; else if (R.puesta != null && Math.abs(C.d - R.puesta) > 1e-4) R.dist = Math.min(C.max, Math.max(C.min, C.d));
    const giro = (K.arrowleft ? 1 : 0) - (K.arrowright ? 1 : 0); if (giro) C.yaw += giro * dt * 1.9;
    if (R.vuelo) { const f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) - J.y, l = (K.d ? 1 : 0) - (K.a ? 1 : 0) + J.x, sube = (K.e || K[' '] ? 1 : 0) - (K.q ? 1 : 0), v = (K.shift ? 26 : 9) * Math.max(0.5, Math.min(4, R.fy / 6)), fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw);
      R.fx += (fx * f - fz * l) * v * dt; R.fz += (fz * f + fx * l) * v * dt; R.fy = Math.min(400, Math.max(0.5, R.fy + sube * v * 0.7 * dt)); C.tx = R.fx; C.tz = R.fz; C.ty = R.fy; C.d = 0.05; R.puesta = C.d;
      R.g.visible = true; R.g.position.set(R.x, R.y, R.z); adentro(null); if (R.ob) { M.AVM().avPose(R.ob, 'idle', dt, { x: R.x, y: R.z, t: t / 1000 }); R.ob.sync(); } return true; }
    let f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) - J.y, l = (K.d ? 1 : 0) - (K.a ? 1 : 0) + J.x, corre = K.shift || Math.hypot(J.x, J.y) > 0.92, tx = 0, tz = 0;
    if (f || l) { const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw), m = Math.max(1, Math.hypot(f, l)); tx = (fx * f - fz * l) / m; tz = (fz * f + fx * l) / m; }
    else if (R.ruta && R.ruta.length) { const [px, pz] = R.ruta[0], d = Math.hypot(px - R.x, pz - R.z); if (d < 0.25) { R.ruta.shift(); if (!R.ruta.length) { R.ruta = null; marca.visible = false; } } else { tx = (px - R.x) / d; tz = (pz - R.z) / d; let resto = d; for (let i = 1; i < R.ruta.length; i++) resto += Math.hypot(R.ruta[i][0] - R.ruta[i - 1][0], R.ruta[i][1] - R.ruta[i - 1][1]); corre = resto > 14; if (resto < 1.2) { tx *= 0.6; tz *= 0.6; } } }
    const vel = corre ? CORRE : CAMINA, k = Math.min(1, dt * (tx || tz ? 9 : 12)); R.vx += (tx * vel - R.vx) * k; R.vz += (tz * vel - R.vz) * k; const v = Math.hypot(R.vx, R.vz);
    if (v > 0.02) { const nx = R.x + R.vx * dt, nz = R.z + R.vz * dt, x0 = R.x, z0 = R.z;
      if (choca(R.x, R.z) || !choca(nx, nz)) { R.x = nx; R.z = nz; } else if (!choca(nx, R.z)) { R.x = nx; R.vz *= 0.5; } else if (!choca(R.x, nz)) { R.z = nz; R.vx *= 0.5; } else { R.vx = R.vz = 0; }
      if (R.ruta) { R.trabado = Math.hypot(R.x - x0, R.z - z0) < vel * dt * 0.2 ? (R.trabado || 0) + dt : 0; if (R.trabado > 0.7) { R.ruta = null; marca.visible = false; } }
      const r = Math.atan2(R.vx, R.vz); let d = r - R.rumbo; d = Math.atan2(Math.sin(d), Math.cos(d)); R.rumbo += d * Math.min(1, dt * 10); } else R.vx = R.vz = 0;
    const yo = Math.max(alturaEn(R.x, R.z, R.y), sobre(R.x, R.z, R.y)); if (!K[' ']) R.saltado = 0; else if (!R.saltado && !R.vy && R.y - yo < 0.06) { R.vy = SALTO; R.saltado = 1; }
    if (R.vy || R.y > yo + 0.5) { R.vy = (R.vy || 0) - PESO * dt; R.y += R.vy * dt; if (R.y <= yo) { R.y = yo; R.vy = 0; } }   // en el aire: sube y cae con su peso
    else { R.y += (yo - R.y) * Math.min(1, dt * 14); if (Math.abs(yo - R.y) < 0.004) R.y = yo; }
    let dg = null, piso = 0; for (const g of R.edif) { const [lx, lz] = enEdif(g, R.x, R.z), S = g.userData.suelos[0]; if (lx > S.x0 - 0.2 && lx < S.x1 + 0.2 && lz > S.z0 - 0.2 && lz < S.z1 + 0.2) { dg = g; piso = Math.max(0, Math.floor((R.y + 0.9) / g.userData.altoPiso)); break; } }
    const eraOjos = R.ojos; R.ojos = R.dist < 0.9; if (R.ojos !== eraOjos) { C.pmin = R.ojos ? -1.2 : PM3; if (!R.ojos && C.pitch < PM3) C.pitch = PM3; vistaTxt(); }
    adentro(dg, piso); if (R.incl) { R.incl.t -= dt; if (!R.ojos) C.pitch += (R.incl.a - C.pitch) * Math.min(1, dt * 5); if (R.incl.t <= 0) R.incl = null; }
    // cámara: sigue al muñeco a la altura del pecho (o de los ojos) y se acerca si hay algo en el medio
    const hom = motor.mirando && !R.ojos ? Math.min(0.5, C.d * 0.14) : 0, hx0 = Math.cos(C.yaw) * hom, hz0 = -Math.sin(C.yaw) * hom, hl = hom && !tapa(R.x + hx0, R.y + 1.5, R.z + hz0), hx = hl ? hx0 : 0, hz = hl ? hz0 : 0;
    const alt = R.y + (R.ojos ? 1.62 : hom ? 1.55 : 1.35), kk = Math.min(1, dt * (R.ojos ? 28 : 9)); C.tx += (R.x + hx - C.tx) * kk; C.tz += (R.z + hz - C.tz) * kk; C.ty = (C.ty || 0) + (alt - (C.ty || 0)) * Math.min(1, dt * (R.ojos ? 22 : 9));
    let quiere = R.dist; if (!R.ojos && R.viaje <= 0) { const cp = Math.cos(C.pitch), ux = cp * Math.sin(C.yaw), uy = Math.sin(C.pitch), uz = cp * Math.cos(C.yaw); for (let s = 0.5; s <= R.dist; s += 0.25) if (tapa(R.x + hx + ux * s, alt + uy * s, R.z + hz + uz * s)) { quiere = Math.max(0.6, s - 0.35); break; } }
    if (R.viaje <= 0) { C.d += (quiere - C.d) * Math.min(1, dt * (quiere < C.d ? 14 : 5)); R.puesta = C.d; }
    R.g.visible = !R.ojos && C.d > 0.85; R.g.position.set(R.x, R.y, R.z); R.g.rotation.y = R.rumbo;
    if (marca.visible) { marca.material.opacity = 0.55 + 0.35 * Math.sin(t * 0.008); marca.position.y = R.y + 0.12; }
    if (R.ob) { const A = M.AVM(); A.avPose(R.ob, v > 0.25 ? 'walk' : 'idle', dt * (v > 4.5 ? 2 : v > 2.4 ? 1.45 : 1), { x: R.x, y: R.z, t: t / 1000 }); R.ob.sync(); }
    // el equipo que queda a mano (a menos de 2,2 m y adelante): E o clic lo abre
    if (t - tCerca > 220) { tCerca = t; let mejor = null, md = 2.2; for (const g of objs.values()) { const p = g.userData.pieza; if (!p || !g.visible || !TIPOS[p.t].equipo) continue; const d = Math.hypot((p.x || 0) - R.x, (p.z || 0) - R.z); if (d < md && Math.abs((+p.piso || 0) - R.y) < 2) { md = d; mejor = p; } }
      if (!mejor && M.apuntado) mejor = M.apuntado();   // lo que está en la mira aunque quede alto o lejos (un AP en el techo)
      if (mejor !== R.cerca) { R.cerca = mejor; const el = $('#musar'); el.hidden = !mejor || motor.tactil; if (mejor) el.innerHTML = `<kbd>E</kbd> ${M.esc(mejor.nombre || TIPOS[mejor.t].n)}`; } }
    return true; });
  return { R, paseo, irA, ojos, vuelo, vista, obstaculos, choca, alturaEn, sobre, puedeMira, ayudaTxt }; }

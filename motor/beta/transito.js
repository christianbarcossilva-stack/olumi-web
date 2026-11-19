// Motor común · tránsito: camiones que entran por la ruta, van a un andén, entran marcha atrás, se quedan un rato y salen.
// Sale solo de lo que hay armado: las calles son la red y los andenes de las naves son los destinos. Es movimiento de ejemplo
// (no son datos de una empresa): se prende y se apaga en Capas, y no se guarda con la maqueta.
// Todos los camiones se dibujan juntos en una sola llamada (cajas instanciadas), así no pesa aunque haya muchos.
import { THREE } from './nucleo.js?v=13';
import { andenesDe } from './piezas.js?v=29';

const PARTES = [ // centro (x, y, z), tamaño (x, y, z) y de qué color va: 0 oscuro, 1 caja, 2 cabina, 3 vidrio, 4 puertas, 5 faro, 6 luz de atrás, 7 metal
  [0, 1.2, 0, 12.4, 0.3, 2.3, 0], [0, 2.74, 0, 12.3, 2.78, 2.5, 1], [-4.2, 1.0, 0, 3.0, 0.12, 2.5, 0], [7.75, 1.95, 0, 2.7, 2.9, 2.45, 2],
  [9.12, 2.6, 0, 0.06, 1.0, 2.2, 3], [7.75, 3.52, 0, 2.2, 0.26, 2.3, 2], [6.0, 1.0, 0, 1.8, 0.4, 2.0, 0], [-6.17, 2.74, 0, 0.05, 2.55, 2.32, 4],
  [7.7, 2.6, 1.235, 1.3, 0.8, 0.03, 3], [7.7, 2.6, -1.235, 1.3, 0.8, 0.03, 3], [9.12, 1.0, 0, 0.08, 0.7, 2.3, 0], [9.14, 1.1, 0.85, 0.06, 0.2, 0.42, 5], [9.14, 1.1, -0.85, 0.06, 0.2, 0.42, 5],
  [-6.2, 1.05, 0.95, 0.06, 0.16, 0.4, 6], [-6.2, 1.05, -0.95, 0.06, 0.16, 0.4, 6], [-6.15, 0.75, 0, 0.1, 0.12, 2.4, 7], [-1.5, 0.85, 0, 0.5, 0.5, 2.3, 7], [8.9, 3.0, 1.42, 0.08, 0.42, 0.2, 0], [8.9, 3.0, -1.42, 0.08, 0.42, 0.2, 0]];
// ruedas (cilindros acostados): posición a lo largo y de qué lado; las de atrás y las de tracción van de a dos
const RUEDAS = [[-5.1, 1.05], [-5.1, -1.05], [-3.75, 1.05], [-3.75, -1.05], [-2.4, 1.05], [-2.4, -1.05], [6.6, 1.05], [6.6, -1.05], [8.6, 1.08], [8.6, -1.08]];
const CAJAS = ['#F4F5F6', '#F4F5F6', '#F4F5F6', '#E6EAED', '#c2415b', '#2f6fd6', '#3b4b58', '#5f7e6c', '#d9a441'], CABINAS = ['#2B333B', '#FFFFFF', '#4B6D83', '#C9D3DA', '#b8584e', '#FFFFFF'];
const MAX = 96, ang = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function transito(M) { const { motor, mundo } = M, oscuro = () => document.documentElement.dataset.tema === 'oscuro';
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.15 }), MAX * PARTES.length);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.raycast = () => {}; im.count = 0; im.visible = false; mundo.add(im);
  const ir = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.52, 0.52, 0.62, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.9 }), MAX * RUEDAS.length); ir.castShadow = true; ir.frustumCulled = false; ir.raycast = () => {}; ir.visible = false; mundo.add(ir);
  // de noche, la luz de los faros en el piso delante de cada camión que anda (un solo dibujo para todos)
  const cl = document.createElement('canvas'); cl.width = cl.height = 64; { const x = cl.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const il = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cl), color: '#ffe9bf', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12 }), MAX); il.frustumCulled = false; il.raycast = () => {}; il.renderOrder = 2; il.visible = false; mundo.add(il);
  const T = { on: true, firma: '', nodos: [], andenes: [], camiones: [], entradas: [], prox: 2, im, ir, il };
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), eu = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), col = new THREE.Color(), CERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX * PARTES.length; i++) { im.setMatrixAt(i, CERO); im.setColorAt(i, col.set('#ffffff')); } for (let i = 0; i < MAX * RUEDAS.length; i++) ir.setMatrixAt(i, CERO); for (let i = 0; i < MAX; i++) il.setMatrixAt(i, CERO);
  const rnd = (a, b) => a + Math.random() * (b - a), de = l => l[Math.floor(Math.random() * l.length)];

  // ---------- la red: un nodo cada pocos metros de cada calle; las calles que se tocan o se cruzan quedan unidas ----------
  function red() { const E = M.E, nodos = [], calles = E.piezas.filter(p => p.t === 'calle' && p.pts && p.pts.length > 1 && p.tipo !== 'sendero');
    const nuevo = (x, z, ruta, an) => { const n = { x, z, v: [], ruta, an, i: nodos.length }; nodos.push(n); return n; }, une = (a, b) => { if (a === b || a.v.includes(b)) return; a.v.push(b); b.v.push(a); };
    const filas = calles.map(c => { const f = [], an = c.ancho || 8, ruta = c.tipo === 'ruta'; for (let i = 0; i < c.pts.length - 1; i++) { const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 10));
        for (let k = i ? 1 : 0; k <= n; k++) f.push(nuevo(ax + (bx - ax) * k / n, az + (bz - az) * k / n, ruta, an)); } for (let i = 0; i < f.length - 1; i++) une(f[i], f[i + 1]); return f; });
    // rotondas: los nodos que caen sobre la isla se corren al anillo, así los camiones la rodean en vez de cruzarla
    for (const ro of E.piezas) { if (ro.t !== 'rotonda' || !(ro.isla > 0)) continue; const Ri = ro.isla + 3.5, Ra = Math.max(ro.isla + 4.5, ((ro.radio || 14) + ro.isla) / 2);
      for (const n of nodos) { let dx = n.x - ro.x, dz = n.z - ro.z; const d = Math.hypot(dx, dz); if (d >= Ri) continue; if (d < 0.6) { const m = n.v[0]; if (!m) continue; const l = Math.hypot(m.x - n.x, m.z - n.z) || 1; dx = -(m.z - n.z) / l; dz = (m.x - n.x) / l; } else { dx /= d; dz /= d; } n.x = ro.x + dx * Ra; n.z = ro.z + dz * Ra; } }
    // cruces y empalmes: dos nodos de calles distintas a menos de medio ancho se unen (con una grilla para no comparar todos contra todos)
    const G = new Map(), kk = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16); nodos.forEach(n => { const k = kk(n.x, n.z); (G.get(k) || G.set(k, []).get(k)).push(n); });
    filas.forEach((f, fi) => f.forEach((n, ni) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of G.get(kk(n.x + dx * 16, n.z + dz * 16)) || []) { if (o === n || filas[fi].includes(o)) continue; const d = Math.hypot(o.x - n.x, o.z - n.z), tol = Math.max(5.5, (n.an + o.an) / 4 + 1.5), punta = ni === 0 || ni === f.length - 1;
        if (d < (punta ? tol + 3 : tol)) une(n, o); } }));
    // componentes y entradas: las puntas de las rutas (o, si no hay, las puntas sueltas más lejanas)
    const partes = () => { let c = 0; for (const n of nodos) n.c = null; for (const n of nodos) { if (n.c != null) continue; const pila = [n]; n.c = c; while (pila.length) { const a = pila.pop(); for (const b of a.v) if (b.c == null) { b.c = c; pila.push(b); } } c++; } return c; };
    // los tramos que quedaron sueltos por poco (el hueco de una portería o de un portón) se empalman por los dos nodos más cercanos
    for (let vez = 0, nc = partes(); vez < 12 && nc > 1; vez++) { let mj = 45, par = null; for (const a of nodos) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (const o of G.get(kk(a.x + dx * 16, a.z + dz * 16)) || []) { if (o.c === a.c) continue; const d = Math.hypot(o.x - a.x, o.z - a.z); if (d < mj) { mj = d; par = [a, o]; } }
      if (!par) break; une(par[0], par[1]); nc = partes(); }
    // entradas de cada parte de la red: las puntas de las rutas; si no tiene, sus puntas sueltas
    T.nodos = nodos; T.entradas = []; const porParte = new Map(); for (const n of nodos) (porParte.get(n.c) || porParte.set(n.c, []).get(n.c)).push(n);
    for (const l of porParte.values()) { let e = l.filter(n => n.v.length === 1 && n.ruta); if (!e.length) e = l.filter(n => n.v.length === 1); if (!e.length && l.length) e = [l[0], l[l.length - 1]]; T.entradas.push(...e); }
    // andenes: lugar donde queda el camión, hacia dónde mira y el nodo de calle más cercano al frente
    T.andenes = []; for (const p of E.piezas) { if (p.t !== 'galpon' || p.estilo !== 'logistico' || p.libre) continue; const r = p.r || 0, cs = Math.cos(r), sn = Math.sin(r), w = p.ancho / 2, d = p.fondo / 2, nx = sn, nz = cs;
      for (const [u, num] of andenesDe({ andenes: 6, desde: 1, ...p })) { const lx = -w + u, X = p.x + lx * cs + d * sn, Z = p.z - lx * sn + d * cs, a = { p, num, x: X + nx * 6.9, z: Z + nz * 6.9, h: Math.atan2(-nz, nx), nx, nz, nodo: null, cam: null };
        let mj = 1e9; for (const n of nodos) { const dd = Math.hypot(n.x - (X + nx * 24), n.z - (Z + nz * 24)); if (dd < mj) { mj = dd; a.nodo = n; } } if (mj > 70) a.nodo = null; T.andenes.push(a); } } }

  // camino más corto entre dos nodos (Dijkstra simple: la red es chica)
  function camino(a, b) { if (!a || !b || a.c !== b.c) return null; const dist = new Map([[a, 0]]), ant = new Map(), abiertos = [a], visto = new Set();
    while (abiertos.length) { let k = 0; for (let i = 1; i < abiertos.length; i++) if (dist.get(abiertos[i]) < dist.get(abiertos[k])) k = i; const n = abiertos.splice(k, 1)[0]; if (n === b) break; if (visto.has(n)) continue; visto.add(n);
      for (const o of n.v) { const nd = dist.get(n) + Math.hypot(o.x - n.x, o.z - n.z) * (o.ruta ? 0.8 : 1); if (nd < (dist.get(o) ?? 1e12)) { dist.set(o, nd); ant.set(o, n); abiertos.push(o); } } }
    if (!ant.has(b) && a !== b) return null; const out = [b]; while (out[0] !== a) out.unshift(ant.get(out[0])); return out; }
  const curva = (P0, P1, P2, P3, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]; });
  const tramo = (pts, o = {}) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, largo: L[L.length - 1], v: 5, atras: false, carril: false, ...o }; };

  // ---------- un camión: tramos a recorrer, estado y lugar en el dibujo ----------
  function nuevoCamion() { const libre = new Set(T.camiones.map(c => c.i)); let i = 0; while (libre.has(i)) i++; if (i >= MAX) return null; const c = { i, x: 0, z: 0, h: 0, cola: [], s: 0, lado: 0, caja: de(CAJAS), cab: de(CABINAS), estado: '', t: 0, esc: 0 }; T.camiones.push(c); return c; }
  function pintar(c) { const os = oscuro(), cs = [os ? '#15181b' : '#2a2f34', c.caja, c.cab, '#18232d', c.caja, os ? '#fff3c4' : '#f4f1e6', os ? '#ff4a3d' : '#b3261e', os ? '#59616a' : '#9aa3ab']; PARTES.forEach((p, k) => { col.set(cs[p[6]]); if (os && (p[6] === 1 || p[6] === 2 || p[6] === 4)) col.multiplyScalar(0.55); if (os && p[6] >= 5 && p[6] <= 6) col.multiplyScalar(2.2); if (p[6] === 4) col.multiplyScalar(0.86); im.setColorAt(c.i * PARTES.length + k, col); }); im.instanceColor.needsUpdate = true; }
  function ubicar(c) { const cs = Math.cos(c.h), sn = Math.sin(c.h), e = c.esc; eu.set(0, c.h, 0); q4.setFromEuler(eu);
    PARTES.forEach((p, k) => { v3.set(c.x + (p[0] * cs + p[2] * sn) * e, p[1] * e, c.z + (-p[0] * sn + p[2] * cs) * e); m4.compose(v3, q4, s3.set(p[3] * e, p[4] * e, p[5] * e)); im.setMatrixAt(c.i * PARTES.length + k, m4); }); im.instanceMatrix.needsUpdate = true;
    RUEDAS.forEach((r, k) => { v3.set(c.x + (r[0] * cs + r[1] * sn) * e, 0.52 * e, c.z + (-r[0] * sn + r[1] * cs) * e); m4.compose(v3, q4, s3.set(e, e, e)); ir.setMatrixAt(c.i * RUEDAS.length + k, m4); }); ir.instanceMatrix.needsUpdate = true;
    if (oscuro() && (c.estado === 'va' || c.estado === 'sale') && !(c.cola[0] && c.cola[0].atras)) { eu.set(0, c.h, 0); q4.setFromEuler(eu); m4.compose(v3.set(c.x + 17 * cs, 0.09, c.z - 17 * sn), q4, s3.set(22 * e, 1, 11 * e)); il.setMatrixAt(c.i, m4); } else il.setMatrixAt(c.i, CERO); il.instanceMatrix.needsUpdate = true; }
  function sacar(c) { T.camiones.splice(T.camiones.indexOf(c), 1); for (let k = 0; k < PARTES.length; k++) im.setMatrixAt(c.i * PARTES.length + k, CERO); im.instanceMatrix.needsUpdate = true; for (let k = 0; k < RUEDAS.length; k++) ir.setMatrixAt(c.i * RUEDAS.length + k, CERO); ir.instanceMatrix.needsUpdate = true; il.setMatrixAt(c.i, CERO); il.instanceMatrix.needsUpdate = true; if (c.anden && c.anden.cam === c) c.anden.cam = null; }
  const dirH = h => [Math.cos(h), -Math.sin(h)];
  // maniobra de entrada: pasa de largo unos metros y retrocede en curva hasta quedar de cola contra el andén
  function entrar(c, a, ruta) { const pts = ruta.map(n => [n.x, n.z]), k = pts[pts.length - 1], pv = pts[pts.length - 2] || [k[0] - a.nz, k[1] + a.nx]; let dx = k[0] - pv[0], dz = k[1] - pv[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const F = [k[0] + dx * 15, k[1] + dz * 15], D = [a.x, a.z], dist = Math.hypot(F[0] - D[0], F[1] - D[1]), cc = Math.min(22, dist * 0.55); pts.push(F);
    c.cola = [tramo(pts, { carril: true }), tramo(curva(F, [F[0] - dx * cc, F[1] - dz * cc], [D[0] + a.nx * cc, D[1] + a.nz * cc], D), { atras: true, v: 1.9 })]; c.s = 0; c.anden = a; a.cam = c; c.estado = 'va'; }
  function salir(c) { const a = c.anden, sal = T.entradas.filter(n => a.nodo && n.c === a.nodo.c), fin = sal.length ? de(sal) : null, ruta = fin && camino(a.nodo, fin); if (!ruta || ruta.length < 2) { c.estado = 'chau'; c.t = 1; return; }
    const k = [ruta[0].x, ruta[0].z], sg = [ruta[1].x, ruta[1].z]; let dx = sg[0] - k[0], dz = sg[1] - k[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const D = [a.x, a.z], cc = Math.min(20, Math.hypot(k[0] - D[0], k[1] - D[1]) * 0.55);
    c.cola = [tramo(curva(D, [D[0] + a.nx * cc, D[1] + a.nz * cc], [k[0] - dx * cc, k[1] - dz * cc], k), { v: 2.6 }), tramo(ruta.map(n => [n.x, n.z]), { carril: true })]; c.s = 0; c.estado = 'sale'; }

  function armar() { for (const c of T.camiones.slice()) sacar(c); red(); const con = T.andenes.filter(a => a.nodo); im.visible = ir.visible = il.visible = T.on && T.andenes.length > 0; im.count = MAX * PARTES.length;
    // de entrada, cuatro de cada diez andenes ya tienen un camión
    for (const a of T.andenes) { if (Math.random() > 0.4) continue; const c = nuevoCamion(); if (!c) break; c.x = a.x; c.z = a.z; c.h = a.h; c.esc = 1; c.anden = a; a.cam = c; c.estado = 'anden'; c.t = a.nodo ? rnd(20, 240) : 1e9; pintar(c); ubicar(c); }
    T.con = con; T.prox = 1.5; avisar(); motor.dirty = true; }
  let avisado = ''; function avisar() { const porNave = new Map(); for (const a of T.andenes) { const o = porNave.get(a.p.id) || porNave.set(a.p.id, [0, 0]).get(a.p.id); o[1]++; if (a.cam && a.cam.estado === 'anden') o[0]++; }
    const f = JSON.stringify([...porNave]) + T.on; if (f === avisado) return; avisado = f; if (M.subtitulo) for (const [id, [oc, tot]] of porNave) M.subtitulo(id, T.on && tot ? `${oc}/${tot} andenes` : ''); }

  // ¿hay otro camión en el camino? Mira un pasillo del ancho del camión hacia donde se mueve (adelante, o atrás si retrocede).
  // Solo frenan los que van en el mismo sentido o los que están maniobrando: los que vienen de frente pasan por su carril.
  function tapado(c, tr) { const fx = Math.cos(c.h), fz = -Math.sin(c.h), at = !!tr.atras;
    for (const o of T.camiones) { if (o === c || (o.estado !== 'va' && o.estado !== 'sale')) continue; if (Math.abs(o.x - c.x) > 60 || Math.abs(o.z - c.z) > 60) continue;
      const ox = Math.cos(o.h), oz = -Math.sin(o.h), man = !!(o.cola[0] && o.cola[0].atras); if (!man && fx * ox + fz * oz < 0.2) continue;
      // si los dos se ven, pasa primero el que maniobra y, si no, el que está más adelante en su camino
      for (const k of [0, 8, 16]) { const rx = o.x + ox * k - c.x, rz = o.z + oz * k - c.z, f = rx * fx + rz * fz, l = Math.abs(-rx * fz + rz * fx); if (l > 2.9) continue;
        if (at ? (f < -0.5 && f > -9) : (f > 17 && f < 26)) return true; } }
    return false; }
  function paso(dt) { if (!T.on || !T.andenes.length || document.hidden) return false; dt = Math.min(dt, 0.1); let movio = false;
    T.prox -= dt; const andando = T.camiones.filter(c => c.estado === 'va' || c.estado === 'sale').length;
    if (T.prox <= 0) { T.prox = rnd(3.5, 8); const libres = (T.con || []).filter(a => !a.cam); if (libres.length && andando < Math.min(9, 2 + Math.ceil(T.andenes.length / 12))) { const a = de(libres), ent = T.entradas.filter(n => n.c === a.nodo.c), ini = ent.length ? de(ent) : null, ruta = ini && camino(ini, a.nodo);
        if (ruta && ruta.length > 1 && T.camiones.some(q => q.estado !== 'anden' && Math.hypot(q.x - ruta[0].x, q.z - ruta[0].z) < 34)) T.prox = 1.5; else if (ruta && ruta.length > 1) { const c = nuevoCamion(); if (c) { c.x = ruta[0].x; c.z = ruta[0].z; c.h = Math.atan2(-(ruta[1].z - ruta[0].z), ruta[1].x - ruta[0].x); pintar(c); entrar(c, a, ruta); } } } }
    for (const c of T.camiones.slice()) {
      if (c.estado === 'anden') { c.t -= dt; if (c.t <= 0) salir(c); continue; }
      if (c.estado === 'chau') { c.t -= dt * 1.5; c.esc = Math.max(0, c.t); ubicar(c); movio = true; if (c.t <= 0) sacar(c); continue; }
      const tr = c.cola[0]; if (!tr) { if (c.estado === 'va') { c.estado = 'anden'; c.t = rnd(45, 200); c.x = c.anden.x; c.z = c.anden.z; c.h = c.anden.h; c.lado = 0; ubicar(c); avisar(); } else { c.estado = 'chau'; c.t = 1; } movio = true; continue; }
      if (c.esc < 1) c.esc = Math.min(1, c.esc + dt * 1.5);
      if (tapado(c, tr) && (c.esp = (c.esp || 0) + dt) < 25) continue; c.esp = 0;
      // velocidad: más despacio en las curvas y al llegar al final del tramo
      const queda = tr.largo - c.s, vmax = tr.atras ? tr.v : (tr.carril ? 6 : tr.v), v = Math.max(0.9, Math.min(vmax, queda * 0.6 + 0.9) * (c.gira > 0.25 ? 0.55 : 1)); c.s += v * dt;
      if (c.s >= tr.largo) { c.cola.shift(); c.s = 0; if (c.estado === 'sale' && !c.cola.length) { c.estado = 'chau'; c.t = 1; } if (c.cola[0] && c.estado === 'sale' && c.anden) { if (c.anden.cam === c) c.anden.cam = null; avisar(); } continue; }
      let i = 1; while (i < tr.L.length - 1 && tr.L[i] < c.s) i++; const a = tr.pts[i - 1], b = tr.pts[i], f = (c.s - tr.L[i - 1]) / Math.max(0.001, tr.L[i] - tr.L[i - 1]); let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const hObj = tr.atras ? Math.atan2(dz, -dx) : Math.atan2(-dz, dx), dif = ang(c.h, hObj); c.gira = Math.abs(dif); c.h += Math.max(-1.5 * dt, Math.min(1.5 * dt, dif)) * (tr.atras ? 1.2 : 1);
      c.lado += ((tr.carril ? 1 : 0) - c.lado) * Math.min(1, dt * 0.8); const [hx, hz] = dirH(c.h), off = 2.1 * c.lado; c.x = a[0] + (b[0] - a[0]) * f - hz * off; c.z = a[1] + (b[1] - a[1]) * f + hx * off; ubicar(c); movio = true; }
    return movio; }

  motor.cada.push(paso); motor.alTema.push(() => { for (const c of T.camiones) { pintar(c); ubicar(c); } });
  // si cambian las calles o las naves (se editó), la red se arma de nuevo
  T.revisar = () => { const f = JSON.stringify(M.E.piezas.filter(p => p.t === 'calle' || (p.t === 'galpon' && p.estilo === 'logistico')).map(p => [p.id, p.x, p.z, p.r, p.ancho, p.fondo, p.pts, p.andenes, p.andenesEn, p.anexo, p.tipo])); if (f === T.firma) return; T.firma = f; armar(); };
  T.ver = on => { T.on = !!on; im.visible = ir.visible = il.visible = T.on && T.andenes.length > 0; avisado = ''; avisar(); motor.dirty = true; };
  T.revisar(); return T; }

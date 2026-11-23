// Revisión de físicas del recorrido a pie: arma cada pieza del catálogo sola (y algunas variantes) y la barre con una grilla.
// En cada punto compara lo que se ve (rayo hacia abajo desde 1,65 m) con lo que siente el muñeco (altura donde pisa y si choca).
//   «atraviesa»: el cuerpo del muñeco queda adentro de algo que se ve macizo (se hunde en una rampa, pasa a través de una columna).
//   «pared invisible»: el muñeco choca donde no hay nada a la vista.
// Los ejemplos van en metros de la pieza (x, z en su marco; con «atraviesa»: altura de lo que se ve y altura donde pisa el muñeco).
// Uso: node servidor/revisar_fisicas.js [http://127.0.0.1:8766] [regex de tipos]   (con un servidor local sirviendo el repo)
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, ''), SOLO = process.argv[3] ? new RegExp(process.argv[3]) : null;

// variantes que el catálogo no arma solo con lo de fábrica
const EXTRA = [
  { t: 'galpon', estilo: 'logistico', ancho: 60, fondo: 40, alto: 10, andenes: 4, alero: 8, rampa: 'der', rampaLargo: 10, nivel: 'izq', colInt: 12, puertasEn: [[50, 'piso'], 47], _n: 'galpón logístico con rampa, alero y escalera' },
  { t: 'galpon', estilo: 'logistico', ancho: 60, fondo: 40, alto: 10, andenes: 4, rampa: 'izq', rampaLargo: 8, r: 0.7, _n: 'galpón logístico girado, rampa a la izquierda' },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), ctx = await b.newContext({ viewport: { width: 900, height: 600 } }), p = await ctx.newPage();
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('motor.escena.fisica', JSON.stringify({ escena: { piezas: [] } })); } catch (e) {} });
  await p.goto(BASE + '/motor/beta/?escena=fisica', { waitUntil: 'load' }); await p.waitForFunction(() => window.__maqueta, null, { timeout: 60000 });
  const res = await p.evaluate(async ({ EXTRA, solo }) => {
    const THREE = await import('three'), M = window.__maqueta, { TIPOS } = await import(new URL('./piezas.js', location.href).href).catch(() => ({}));
    const tipos = TIPOS || {}, piezas = []; let i = 0;
    const lugar = () => { const k = i++; return [(k % 9) * 260, Math.floor(k / 9) * 260]; };
    for (const [t, T] of Object.entries(tipos)) { if (solo && !new RegExp(solo).test(t)) continue; const [x, z] = lugar(), q = { t, id: 'f' + t, x, z, _n: t };
      if (T.forma === 'linea') q.pts = [[x - 8, z], [x + 8, z]]; else if (T.forma === 'area' || T.forma === 'loma') q.pts = [[x - 8, z - 8], [x + 8, z - 8], [x + 8, z + 8], [x - 8, z + 8]];
      if (t === 'losas') q.celdas = [[0, 0], [1, 0], [0, 1]]; piezas.push(q); }
    for (const e of EXTRA) { if (solo && !new RegExp(solo).test(e.t)) continue; const [x, z] = lugar(); piezas.push({ ...e, id: 'fx' + i, x, z }); }
    const RC = M.fisica; const ray = new THREE.Raycaster(), abajo = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(), out = [];
    const visible = m => { for (let a = m; a; a = a.parent) if (!a.visible) return false; return true; };
    for (const q of piezas) { const c0 = { ...q }; delete c0._n; M.E.piezas.length = 0; M.E.piezas.push(c0); M.armarTodo(); for (const o2 of M.objs.values()) o2.updateMatrixWorld(true); RC.obstaculos(); const g = M.objs.get(q.id); if (!g) { out.push({ n: q._n, sin: true }); continue; }
      g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g); if (bb.isEmpty()) { out.push({ n: q._n, vacio: true }); continue; }
      const ms = []; g.traverse(m => { if (m.isMesh && visible(m) && !m.userData.techo) { ms.push(m); for (const mt of [].concat(m.material)) mt.side = THREE.DoubleSide; } });
      // lo macizo que hay en la vertical de un punto: tramos [abajo, arriba] (una cara hacia arriba y, más abajo, la cara hacia abajo del mismo volumen) y chapas sueltas
      const nm = new THREE.Vector3(), MI = new THREE.Matrix4(), YT = bb.max.y + 1, columna = (x, z) => { o.set(x, YT, z); ray.set(o, abajo); ray.far = YT + 1; const hs = ray.intersectObjects(ms, false), T = [];
        const L = hs.filter(h => h.face).map(h => { nm.copy(h.face.normal); if (h.object.isInstancedMesh && h.instanceId != null) { h.object.getMatrixAt(h.instanceId, MI); nm.transformDirection(MI); } nm.transformDirection(h.object.matrixWorld); return { y: h.point.y, up: nm.y > 0.05, dn: nm.y < -0.05, k: h.object.uuid + ':' + h.instanceId }; });
        const usado = new Set(); L.forEach((h, i) => { if (!h.up) return; const j = L.findIndex((q, jj) => jj > i && !usado.has(jj) && q.dn && q.k === h.k); if (j > 0) { usado.add(j); T.push([L[j].y, h.y]); } else T.push([h.y, h.y]); }); return T; };
      const tope = (T, y) => T.reduce((m, [a, b]) => a < y ? Math.max(m, Math.min(b, y)) : m, 0), ocupa = (T, y0, y1) => T.some(([a, b]) => b >= y0 && a <= y1);
      const lx = bb.max.x - bb.min.x, lz = bb.max.z - bb.min.z, paso = Math.max(0.25, Math.sqrt(lx * lz / 25000)), NX = Math.floor((lx + 2) / paso) + 1, NZ = Math.floor((lz + 2) / paso) + 1;
      const X = i => bb.min.x - 1 + (i % NX) * paso, Z = i => bb.min.z - 1 + Math.floor(i / NX) * paso, VIS = new Float32Array(NX * NZ), PIS = new Float32Array(NX * NZ), LIB = new Uint8Array(NX * NZ), LLEGA = new Uint8Array(NX * NZ), COL = [];
      for (let i = 0; i < NX * NZ; i++) { const x = X(i), z = Z(i); COL[i] = columna(x, z); VIS[i] = tope(COL[i], 1.65);
        PIS[i] = Math.max(RC.alturaEn(x, z, VIS[i] + 0.65), RC.sobre(x, z, VIS[i] + 0.05)); LIB[i] = RC.choca(x, z, PIS[i], 0.02) ? 0 : 1; }
      // hasta dónde se llega caminando desde afuera (los cuatro bordes de la grilla)
      const cola = []; for (let i = 0; i < NX * NZ; i++) { const c = i % NX, f = Math.floor(i / NX); if ((c === 0 || f === 0 || c === NX - 1 || f === NZ - 1) && LIB[i]) { LLEGA[i] = 1; cola.push(i); } }
      while (cola.length) { const i = cola.pop(), c = i % NX; for (const j of [c > 0 ? i - 1 : -1, c < NX - 1 ? i + 1 : -1, i - NX, i + NX]) if (j >= 0 && j < NX * NZ && !LLEGA[j] && LIB[j] && Math.abs(PIS[j] - PIS[i]) < 0.65) { LLEGA[j] = 1; cola.push(j); } }
      const pasa = (x, z) => { const [a, b] = loc(x, z); return (g.userData.pasos || []).some(q => a > q[0] && a < q[2] && b > q[1] && b < q[3]); }; let at = 0, inv = 0; const ejA = [], ejI = [], r1 = v => +v.toFixed(1), GI = g.matrixWorld.clone().invert(), loc = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(GI); return [r1(v.x), r1(v.z)]; };
      for (let i = 0; i < NX * NZ; i++) { const x = X(i), z = Z(i), c = i % NX;
        if (LLEGA[i] && VIS[i] > PIS[i] + 0.4 && !pasa(x, z)) { at++; if (ejA.length < 3) ejA.push([...loc(x, z), +VIS[i].toFixed(2), +PIS[i].toFixed(2)]); }
        const vec = [c > 0 ? i - 1 : -1, c < NX - 1 ? i + 1 : -1, i - NX, i + NX].filter(j => j >= 0 && j < NX * NZ && LLEGA[j]); if (!LIB[i] && vec.length) { const y0 = Math.min(...vec.map(j => PIS[j])); const rr = Math.ceil(0.35 / paso); let cerca = false; for (let dc = -rr; dc <= rr && !cerca; dc++) for (let df = -rr; df <= rr && !cerca; df++) { const j = i + dc + df * NX; if (j >= 0 && j < NX * NZ && Math.abs((j % NX) - c) <= rr && ocupa(COL[j], y0 - 0.25, y0 + 1.7)) cerca = true; } if (!cerca) for (const [ox, oz] of [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]) if (ocupa(columna(x + ox, z + oz), y0 - 0.25, y0 + 1.7)) { cerca = true; break; } if (!cerca) { inv++; if (ejI.length < 3) ejI.push([...loc(x, z)]); } } }
      out.push({ n: q._n, m2: +(lx * lz).toFixed(0), at: +(at * paso * paso).toFixed(1), inv: +(inv * paso).toFixed(1), ejA, ejI }); }
    return out; }, { EXTRA, solo: SOLO ? SOLO.source : null });
  await b.close(); let mal = 0;
  for (const r of res) { if (r.sin || r.vacio) { console.log('· ' + r.n + (r.sin ? ' (no se armó)' : ' (vacía)')); continue; }
    const bad = r.at >= 0.5 || r.inv >= 0.6; if (bad) mal++;
    console.log((bad ? '✗ ' : '✓ ') + r.n + (r.at ? `  atraviesa ${r.at} m² ${JSON.stringify(r.ejA)}` : '') + (r.inv ? `  pared invisible ${r.inv} m de borde ${JSON.stringify(r.ejI)}` : '')); }
  if (err.length) console.log('errores de la página:\n  ' + err.join('\n  '));
  console.log(mal ? `\n${mal} piezas con problemas de físicas` : '\nSin problemas de físicas'); process.exit(mal ? 1 : 0);
})();

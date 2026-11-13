// Motor común · piezas. Cada cosa de la maqueta es una pieza en datos: { id, t: tipo, x, z, r (giro), pts (líneas y áreas), ...opciones }.
// Cada tipo dice cómo se llama, en qué grupo del catálogo va, qué se puede editar (campos) y cómo se dibuja (armar).
// Sumar un tipo nuevo = sumar una entrada a TIPOS. Nada de la escena queda fijo en el código.
import { THREE } from './nucleo.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

// ---------- materiales y formas compartidas ----------
const MATS = new Map();
export function mat(c, o = {}) { const k = c + JSON.stringify(o); let m = MATS.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o)); MATS.set(k, m); } return m; }
const CAJA = new THREE.BoxGeometry(1, 1, 1), CIL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), BOLA = new THREE.IcosahedronGeometry(0.5, 1), CONO = new THREE.ConeGeometry(0.5, 1, 9), CILX = new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateX(Math.PI / 2);
const sombra = (m, c = true, r = true) => { m.castShadow = c; m.receiveShadow = r; return m; };
function caja(g, x0, y0, z0, x1, y1, z1, m, s = true) { const k = new THREE.Mesh(CAJA, m); k.scale.set(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), Math.max(0.01, z1 - z0)); k.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(sombra(k, s)); return k; }
function cil(g, x, y0, z, r, h, m, geo = CIL) { const k = new THREE.Mesh(geo, m); k.scale.set(r * 2, h, r * 2); k.position.set(x, y0 + h / 2, z); g.add(sombra(k)); return k; }
// muchas piezas iguales en un solo dibujo: items = [x, y, z, giro, sx, sy, sz, color]
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function lote(g, geo, m, items, s = true) { if (!items.length) return null; const im = new THREE.InstancedMesh(geo, m, items.length);
  items.forEach((t, i) => { _e.set(0, t[3] || 0, 0); _q.setFromEuler(_e); _m.compose(_v.set(t[0], t[1], t[2]), _q, _s.set(t[4] ?? 1, t[5] ?? 1, t[6] ?? 1)); im.setMatrixAt(i, _m); if (t[7] != null) im.setColorAt(i, _c.set(t[7])); });
  im.castShadow = s; im.receiveShadow = true; im.computeBoundingSphere(); im.computeBoundingBox && im.computeBoundingBox(); g.add(im); return im; }
// superficie plana con la forma de un polígono (x, z)
function area(g, pts, y, m) { if (pts.length < 3) return null; const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))); const geo = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  const k = new THREE.Mesh(geo, m); k.receiveShadow = true; g.add(k); return k; }
// cinta a lo largo de una línea (calles, canteros, guardarraíl visto de arriba)
function cinta(pts, ancho, y, cerrada) { const P = cerrada ? [...pts, pts[0]] : pts, v = [], ix = [], uv = []; let L = 0;
  for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], c = P[i]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let k = 1; if (i > 0 && i < P.length - 1) { const d1 = [c[0] - a[0], c[1] - a[1]], l1 = Math.hypot(...d1) || 1, d2 = [b[0] - c[0], b[1] - c[1]], l2 = Math.hypot(...d2) || 1; k = 1 / Math.max(0.35, Math.cos(Math.acos(Math.max(-1, Math.min(1, (d1[0] * d2[0] + d1[1] * d2[1]) / l1 / l2))) / 2)); }
    if (i) L += Math.hypot(c[0] - P[i - 1][0], c[1] - P[i - 1][1]); const h = ancho / 2 * k; v.push(c[0] - dz * h, y, c[1] + dx * h, c[0] + dz * h, y, c[1] - dx * h); uv.push(0, L, 1, L);
    if (i) { const j = i * 2; ix.push(j - 2, j, j - 1, j - 1, j, j + 1); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals();
  const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); return geo; }
// puntos cada `paso` metros sobre una línea
export function aLoLargo(pts, paso, cerrada) { const P = cerrada ? [...pts, pts[0]] : pts, out = []; let resto = 0;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dir = Math.atan2(b[0] - a[0], b[1] - a[1]); let s = resto;
    for (; s <= L; s += paso) out.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L, dir]); resto = s - L; }
  return out; }
const largoDe = pts => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
// azar repetible por pieza (la escena se ve igual cada vez que se abre)
export const azar = s => { let x = (Math.abs(s | 0) % 2147483646) + 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
const semilla = p => { let h = 2166136261; for (const ch of String(p.id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) + (p.semilla | 0) * 7919; };
const oscuro = () => document.documentElement.dataset.tema === 'oscuro';
const tex = new Map();
function rayas(c1, c2, n = 8) { const k = c1 + c2 + n; if (tex.has(k)) return tex.get(k); const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, 64, 64); x.fillStyle = c2; for (let i = 0; i < n; i++) x.fillRect(0, i * 64 / n, 64, 64 / n * 0.45);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; tex.set(k, t); return t; }
function textoTex(txt, fondo, tinta, w = 512, h = 160) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = fondo; x.fillRect(0, 0, w, h);
  x.fillStyle = tinta; let fs = h * 0.5; x.font = `700 ${fs}px "Instrument Sans", system-ui, sans-serif`; while (x.measureText(txt).width > w * 0.9 && fs > 10) { fs -= 2; x.font = `700 ${fs}px "Instrument Sans", system-ui, sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + fs * 0.04); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------- colores ----------
export const COL = {
  suelo: { pasto: '#9db78a', pasto2: '#7f9c6d', monte: '#6d8a5e', tierra: '#d9cfbb', ripio: '#c3bcb0', hormigon: '#cfd3d6', asfalto: '#8c9298', agua: '#7fa7bb', cultivo: '#a9bf8e' },
  sueloN: { pasto: '#2c3a2a', pasto2: '#243122', monte: '#1d281c', tierra: '#3a352d', ripio: '#36332e', hormigon: '#3a3e42', asfalto: '#2a2f34', agua: '#1d3340', cultivo: '#2a3524' },
  estado: { ok: '#21c16b', warn: '#f5a524', crit: '#ff3b30', off: '#8e99a3' }
};
const suelo = k => (oscuro() ? COL.sueloN : COL.suelo)[k] || k;
export const NAVIERAS = [['#2f6fd6', 'Azul'], ['#c2415b', 'Rojo'], ['#1e9e5a', 'Verde'], ['#e2b53a', 'Amarillo'], ['#d9692c', 'Naranja'], ['#5b4fb3', 'Violeta'], ['#7b8189', 'Gris'], ['#2b9bb3', 'Turquesa'], ['#8a5a3c', 'Marrón'], ['#e8ecef', 'Blanco (reefer)']];

// ---------- campos comunes ----------
const F = {
  nombre: { k: 'nombre', n: 'Nombre', t: 'txt' },
  x: { k: 'x', n: 'Posición X (m)', t: 'num', paso: 0.5 }, z: { k: 'z', n: 'Posición Z (m)', t: 'num', paso: 0.5 }, r: { k: 'r', n: 'Giro (°)', t: 'ang' },
  ancho: (n = 'Ancho (m)', min = 0.5, max = 400) => ({ k: 'ancho', n, t: 'num', min, max, paso: 0.5 }),
  fondo: (n = 'Fondo (m)', min = 0.5, max = 400) => ({ k: 'fondo', n, t: 'num', min, max, paso: 0.5 }),
  alto: (n = 'Alto (m)', min = 0.2, max = 60, paso = 0.1) => ({ k: 'alto', n, t: 'num', min, max, paso }),
  color: (n = 'Color') => ({ k: 'color', n, t: 'color' })
};
export const MARCAS = [['hikvision', 'Hikvision'], ['dahua', 'Dahua'], ['unifi', 'Ubiquiti UniFi'], ['meraki', 'Cisco Meraki'], ['tplink', 'TP-Link'], ['mikrotik', 'MikroTik'], ['cisco', 'Cisco'], ['intelbras', 'Intelbras'], ['honeywell', 'Honeywell'], ['sonoff', 'Sonoff'], ['otra', 'Otra']];
const EQ_CAMPOS = [F.nombre, { k: 'marca', n: 'Marca', t: 'sel', ops: MARCAS }, { k: 'modelo', n: 'Modelo', t: 'txt' }, { k: 'ip', n: 'IP', t: 'txt' }, { k: 'mac', n: 'MAC', t: 'txt' }, { k: 'y', n: 'Altura (m)', t: 'num', min: 0, max: 40, paso: 0.1 }, F.r, { k: 'notas', n: 'Notas', t: 'area' }];

// ---------- equipos de red y seguridad (Ondi): se dibujan chicos y con un aro del color de su estado ----------
function equipo(dibujo) { return (p, ctx) => { const g = new THREE.Group(), y = p.y ?? 3, est = (ctx.estado && ctx.estado(p)) || 'off', ec = COL.estado[est];
  const cuerpo = new THREE.Group(); cuerpo.position.y = y; g.add(cuerpo); dibujo(cuerpo, p, ec);
  if (y > 0.6) { const palo = cil(g, 0, 0, 0, 0.04, y - 0.1, mat('#9aa3ab', { metalness: 0.4, roughness: 0.5 })); palo.castShadow = false; }
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ec, transparent: true, opacity: 0.9, depthWrite: false })); aro.position.y = 0.09; aro.renderOrder = 2; g.add(aro);
  g.userData.estado = est; g.userData.aro = aro; return g; }; }
const blanco = () => mat('#f2f4f5', { roughness: 0.45 }), negro = () => mat('#1d2125', { roughness: 0.4, metalness: 0.3 }), led = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 });
function campoVision(g, p, ec) { const al = p.alcance ?? 25, ap = (p.apertura ?? 90) * Math.PI / 180; if (!al) return;
  const geo = new THREE.CircleGeometry(al, 32, Math.PI / 2 - ap / 2, ap).rotateX(-Math.PI / 2); const k = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ec, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
  k.position.y = 0.07 - (g.position.y || 0); k.rotation.y = Math.PI; k.renderOrder = 1; k.userData.campo = true; g.add(k); }

// ---------- tipos ----------
export const TIPOS = {
  // terreno y caminos
  terreno: { n: 'Terreno', g: 'Terreno', forma: 'area', capa: 'base', def: { mat: 'tierra' },
    campos: [F.nombre, { k: 'mat', n: 'Superficie', t: 'sel', ops: [['tierra', 'Tierra o balasto'], ['ripio', 'Ripio'], ['hormigon', 'Hormigón'], ['asfalto', 'Asfalto'], ['pasto', 'Pasto'], ['pasto2', 'Pasto oscuro'], ['monte', 'Monte'], ['cultivo', 'Cultivo en hileras'], ['agua', 'Agua']] }],
    armar(p) { const g = new THREE.Group(), y = { agua: 0.012, pasto: 0.016, pasto2: 0.018, monte: 0.018, cultivo: 0.02, tierra: 0.026, ripio: 0.03, hormigon: 0.034, asfalto: 0.038 }[p.mat] ?? 0.026;
      let m; if (p.mat === 'cultivo') { const t = rayas(suelo('cultivo'), oscuro() ? '#1d2818' : '#8eaa72', 10).clone(); t.needsUpdate = true; t.repeat.set(1 / 20, 1 / 20); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); }
      else m = mat(suelo(p.mat), { roughness: p.mat === 'agua' ? 0.15 : 0.97, metalness: p.mat === 'agua' ? 0.1 : 0, polygonOffset: true, polygonOffsetFactor: -Math.round(y * 100), polygonOffsetUnits: -2 });
      const k = area(g, p.pts, y, m); if (k && p.mat === 'cultivo') { const uv = k.geometry.attributes.uv, pos = k.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i)); } return g; } },
  bosque: { n: 'Monte o arboleda', g: 'Vegetación', forma: 'area', capa: 'vegetacion', def: { densidad: 40, tipo: 'fronda' },
    campos: [F.nombre, { k: 'tipo', n: 'Árboles', t: 'sel', ops: [['fronda', 'Fronda'], ['pino', 'Pino'], ['mixto', 'Mixto']] }, { k: 'densidad', n: 'Árboles por hectárea', t: 'num', min: 5, max: 200, paso: 5 }],
    armar(p) { const g = new THREE.Group(); area(g, p.pts, 0.014, mat(suelo('monte'), { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })); const xs = p.pts.map(q => q[0]), zs = p.pts.map(q => q[1]), R = azar(semilla(p)), dentro = (x, z) => { let c = false; for (let i = 0, j = p.pts.length - 1; i < p.pts.length; j = i++) { const a = p.pts[i], b = p.pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), n = Math.min(4000, Math.round((x1 - x0) * (z1 - z0) / 10000 * p.densidad)), pts = [];
      for (let i = 0; i < n * 1.6 && pts.length < n; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (dentro(x, z)) pts.push([x, z, R()]); }
      arbolado(g, pts.map(([x, z, k]) => [x, z, p.tipo === 'mixto' ? (k < 0.3 ? 'pino' : 'fronda') : p.tipo, 0.75 + k * 0.6])); return g; } },
  calle: { n: 'Calle o ruta', g: 'Terreno', forma: 'linea', capa: 'base', def: { ancho: 8, tipo: 'asfalto', linea: 'discontinua' },
    campos: [F.nombre, F.ancho('Ancho (m)', 2, 60), { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['asfalto', 'Asfalto'], ['ruta', 'Ruta (con banquinas)'], ['hormigon', 'Hormigón'], ['tierra', 'Tierra o balasto']] }, { k: 'linea', n: 'Línea del medio', t: 'sel', ops: [['discontinua', 'Discontinua'], ['continua', 'Continua'], ['no', 'Sin línea']] }],
    armar(p) { const g = new THREE.Group(), y = 0.05, c = { asfalto: oscuro() ? '#2b3036' : '#7d838a', ruta: oscuro() ? '#272c31' : '#73797f', hormigon: suelo('hormigon'), tierra: suelo('ripio') }[p.tipo] || '#7d838a';
      g.add(sombra(new THREE.Mesh(cinta(p.pts, p.ancho, y), mat(c, { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -4 })), false, true));
      const blanca = mat(oscuro() ? '#c9ced2' : '#f4f6f7', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -6 });
      if (p.linea !== 'no' && p.tipo !== 'tierra') { if (p.linea === 'continua') g.add(new THREE.Mesh(cinta(p.pts, 0.15, y + 0.005), blanca)); else for (const [x, z, d] of aLoLargo(p.pts, 9)) { const k = new THREE.Mesh(CAJA, blanca); k.scale.set(0.15, 0.01, 4.2); k.position.set(x, y + 0.005, z); k.rotation.y = d; g.add(k); } }
      if (p.tipo === 'ruta') for (const s of [-1, 1]) { const off = offset(p.pts, s * (p.ancho / 2 - 0.6)); g.add(new THREE.Mesh(cinta(off, 0.18, y + 0.005), blanca)); } return g; } },
  rotonda: { n: 'Rotonda', g: 'Terreno', forma: 'punto', capa: 'base', def: { radio: 14, isla: 7 },
    campos: [F.nombre, { k: 'radio', n: 'Radio (m)', t: 'num', min: 4, max: 60, paso: 0.5 }, { k: 'isla', n: 'Isla verde (m)', t: 'num', min: 0, max: 50, paso: 0.5 }],
    armar(p) { const g = new THREE.Group(); const k = new THREE.Mesh(new THREE.CircleGeometry(p.radio, 48).rotateX(-Math.PI / 2), mat(oscuro() ? '#2b3036' : '#7d838a', { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -5 })); k.position.y = 0.052; k.receiveShadow = true; g.add(k);
      if (p.isla > 0) { const i = new THREE.Mesh(new THREE.CylinderGeometry(p.isla, p.isla + 0.2, 0.25, 40), mat(suelo('pasto'))); i.position.y = 0.12; g.add(sombra(i)); const b = new THREE.Mesh(new THREE.TorusGeometry(p.isla, 0.14, 6, 48).rotateX(Math.PI / 2), mat('#e8eaec')); b.position.y = 0.2; g.add(b); } return g; } },
  cerco: { n: 'Cerco', g: 'Construcción', forma: 'linea', capa: 'base', def: { tipo: 'hormigon', alto: 2.4, cerrado: false },
    campos: [F.nombre, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['hormigon', 'Postes de hormigón y malla'], ['malla', 'Malla metálica'], ['muro', 'Muro'], ['guardarrail', 'Guardarraíl']] }, F.alto('Alto (m)', 0.5, 6), { k: 'cerrado', n: 'Cerrado (vuelve al inicio)', t: 'bool' }],
    armar(p) { const g = new THREE.Group(), gr = p.tipo === 'guardarrail', h = gr ? 0.8 : p.alto, P = p.cerrado ? [...p.pts, p.pts[0]] : p.pts;
      if (p.tipo === 'muro') { for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = new THREE.Mesh(CAJA, mat(oscuro() ? '#5b6166' : '#d6d8da')); k.scale.set(0.2, h, L); k.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2); k.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); g.add(sombra(k)); } return g; }
      const postes = aLoLargo(P, gr ? 4 : 3), col = gr ? '#9aa3ab' : p.tipo === 'hormigon' ? (oscuro() ? '#6e7377' : '#b8bcbf') : '#8c949b', w = p.tipo === 'hormigon' ? 0.13 : 0.07;
      lote(g, CAJA, mat(col, { roughness: 0.7, metalness: gr ? 0.5 : 0.1 }), postes.map(([x, z, d]) => [x, h / 2, z, d, w, h, w]));
      // malla vista como una superficie apenas visible (de lejos se lee la línea del cerco sin tapar lo de atrás)
      if (!gr) { const v = [], ix = []; for (let i = 0; i < P.length; i++) { v.push(P[i][0], 0.05, P[i][1], P[i][0], h, P[i][1]); if (i) { const j = i * 2; ix.push(j - 2, j - 1, j, j - 1, j + 1, j); } }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(ix); geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: oscuro() ? '#7d858c' : '#5f676e', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); g.add(m); }
      const riel = new THREE.Mesh(cintaVertical(P, gr ? 0.32 : 0.06, gr ? 0.55 : h - 0.03), mat(gr ? '#c2c8cd' : col, { metalness: gr ? 0.6 : 0.1, roughness: 0.4, side: THREE.DoubleSide })); g.add(sombra(riel)); return g; } },
  cantero: { n: 'Cantero o seto', g: 'Vegetación', forma: 'linea', capa: 'vegetacion', def: { ancho: 1.6, alto: 0.9 },
    campos: [F.nombre, F.ancho('Ancho (m)', 0.3, 20), F.alto('Alto del seto (m)', 0, 4)],
    armar(p) { const g = new THREE.Group(); g.add(sombra(new THREE.Mesh(cinta(p.pts, p.ancho, 0.06), mat(suelo('pasto'), { polygonOffset: true, polygonOffsetFactor: -8 })), false, true));
      if (p.alto > 0) for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = new THREE.Mesh(CAJA, mat(oscuro() ? '#22361f' : '#5f8a4f', { roughness: 1 })); k.scale.set(p.ancho * 0.8, p.alto, L); k.position.set((a[0] + b[0]) / 2, p.alto / 2, (a[1] + b[1]) / 2); k.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); g.add(sombra(k)); } return g; } },
  arboles: { n: 'Hilera de árboles', g: 'Vegetación', forma: 'linea', capa: 'vegetacion', def: { tipo: 'pino', paso: 7, alto: 1 },
    campos: [F.nombre, { k: 'tipo', n: 'Árbol', t: 'sel', ops: [['pino', 'Pino'], ['fronda', 'Fronda'], ['palmera', 'Palmera']] }, { k: 'paso', n: 'Cada (m)', t: 'num', min: 2, max: 40, paso: 0.5 }, { k: 'alto', n: 'Tamaño', t: 'num', min: 0.4, max: 2.5, paso: 0.1 }],
    armar(p) { const g = new THREE.Group(), R = azar(semilla(p)); arbolado(g, aLoLargo(p.pts, p.paso).map(([x, z]) => [x, z, p.tipo, p.alto * (0.85 + R() * 0.3)])); return g; } },
  arbol: { n: 'Árbol', g: 'Vegetación', forma: 'punto', capa: 'vegetacion', def: { tipo: 'fronda', alto: 1 },
    campos: [F.nombre, { k: 'tipo', n: 'Árbol', t: 'sel', ops: [['fronda', 'Fronda'], ['pino', 'Pino'], ['palmera', 'Palmera']] }, { k: 'alto', n: 'Tamaño', t: 'num', min: 0.4, max: 3, paso: 0.1 }],
    armar(p) { const g = new THREE.Group(); arbolado(g, [[0, 0, p.tipo, p.alto]]); return g; } },

  // construcciones
  galpon: { n: 'Galpón', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, siempre: true, def: { ancho: 40, fondo: 25, alto: 9, color: '#e4e8eb', techo: '#c9ced2', abierto: false, portones: 2 },
    campos: [F.nombre, F.ancho('Largo (m)', 3, 600), F.fondo('Fondo (m)', 3, 300), F.alto('Alto (m)', 2.5, 30, 0.5), F.color('Color de paredes'), { k: 'techo', n: 'Color del techo', t: 'color' }, { k: 'portones', n: 'Portones al frente', t: 'num', min: 0, max: 60, paso: 1 }, { k: 'abierto', n: 'Frente abierto (tinglado)', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2, h = p.alto, pa = mat(oscuro() ? mix(p.color, '#000', 0.5) : p.color, { roughness: 0.7 }), zo = mat(oscuro() ? '#4c5257' : '#aeb3b8'), e = 0.25;
      caja(g, -w, 0, -d, w, h, -d + e, pa); caja(g, -w, 0, -d, -w + e, h, d, pa); caja(g, w - e, 0, -d, w, h, d, pa);
      if (p.abierto) { const n = Math.max(2, Math.round(p.ancho / 8)); for (let i = 0; i <= n; i++) caja(g, -w + i * (p.ancho - 0.4) / n, 0, d - 0.4, -w + i * (p.ancho - 0.4) / n + 0.4, h, d, pa); }
      else { caja(g, -w, 0, d - e, w, h, d, pa); const n = p.portones | 0; for (let i = 0; i < n; i++) { const x = -w + (i + 0.5) * p.ancho / n, pw = Math.min(4.2, p.ancho / n * 0.7); caja(g, x - pw / 2, 0, d, x + pw / 2, Math.min(h - 1, 4.8), d + 0.06, mat(oscuro() ? '#5f666c' : '#d7dbde', { roughness: 0.5 })); } }
      for (const [x0, z0, x1, z1] of [[-w, -d, w, -d + e], [-w, d - e, w, d], [-w, -d, -w + e, d], [w - e, -d, w, d]]) caja(g, x0 - 0.02, 0, z0 - 0.02, x1 + 0.02, 1.1, z1 + 0.02, zo);
      const t = caja(g, -w - 0.3, h, -d - 0.3, w + 0.3, h + 0.35, d + 0.3, mat(oscuro() ? mix(p.techo, '#000', 0.55) : p.techo, { roughness: 0.55, metalness: 0.25 })); t.userData.techo = true;
      caja(g, -w - 0.32, h + 0.35, -d - 0.32, w + 0.32, h + 0.6, -d + 0.1, mat(oscuro() ? '#2a3036' : '#59616a')); caja(g, -w - 0.32, h + 0.35, d - 0.1, w + 0.32, h + 0.6, d + 0.32, mat(oscuro() ? '#2a3036' : '#59616a'));
      return g; } },
  modulo: { n: 'Oficina o módulo', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { ancho: 12, fondo: 6, pisos: 1, color: '#f5f6f7', ventanas: true },
    campos: [F.nombre, F.ancho('Largo (m)', 1, 120), F.fondo('Fondo (m)', 1, 60), { k: 'pisos', n: 'Pisos', t: 'num', min: 1, max: 12, paso: 1 }, F.color('Color'), { k: 'ventanas', n: 'Ventanas', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2, H = 3.1 * p.pisos; caja(g, -w, 0, -d, w, H, d, mat(oscuro() ? mix(p.color, '#000', 0.35) : p.color, { roughness: 0.6 }));
      if (p.ventanas) { const vm = mat(oscuro() ? '#ffd89a' : '#2c3e4f', { roughness: 0.1, metalness: 0.5, emissive: oscuro() ? '#ffcf80' : '#000000', emissiveIntensity: oscuro() ? 0.6 : 0 });
        for (let f = 0; f < p.pisos; f++) { const y = f * 3.1 + 1.0; caja(g, -w + 0.6, y, d, w - 0.6, y + 1.3, d + 0.04, vm, false); caja(g, -w + 0.6, y, -d - 0.04, w - 0.6, y + 1.3, -d, vm, false); } }
      caja(g, -w - 0.15, H, -d - 0.15, w + 0.15, H + 0.3, d + 0.15, mat(oscuro() ? '#555b61' : '#c9ced2')); return g; } },
  alero: { n: 'Alero o techado', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 12, fondo: 14, alto: 4.6, color: '#e9ecee' },
    campos: [F.nombre, F.ancho('Ancho (m)', 2, 120), F.fondo('Largo (m)', 2, 120), F.alto('Alto libre (m)', 2.2, 15), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2; caja(g, -w, p.alto, -d, w, p.alto + 0.28, d, mat(p.color, { roughness: 0.5, metalness: 0.2 })); const c = mat('#8c949b', { metalness: 0.5, roughness: 0.4 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) caja(g, sx * (w - 0.3) - 0.18, 0, sz * (d - 0.3) - 0.18, sx * (w - 0.3) + 0.18, p.alto, sz * (d - 0.3) + 0.18, c); return g; } },
  columna: { n: 'Columna de luz', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 25, focos: 3 },
    campos: [F.nombre, F.alto('Alto (m)', 4, 45, 0.5), { k: 'focos', n: 'Focos', t: 'num', min: 1, max: 12, paso: 1 }, F.r],
    armar(p) { const g = new THREE.Group(), H = p.alto, gris = mat(oscuro() ? '#7b838a' : '#a4acb3', { metalness: 0.5, roughness: 0.45 }); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, H, 10), gris); k.position.y = H / 2; g.add(sombra(k));
      const n = p.focos | 0, w = Math.max(1.2, n * 0.75); caja(g, -w / 2, H, -0.12, w / 2, H + 0.25, 0.12, gris); const lm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1cc', emissiveIntensity: oscuro() ? 2.5 : 0.25 });
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; caja(g, x - 0.28, H - 0.3, 0.05, x + 0.28, H, 0.6, lm, false); } return g; } },
  postes: { n: 'Línea de postes (UTE)', g: 'Construcción', forma: 'linea', capa: 'base', def: { paso: 38, alto: 10 },
    campos: [F.nombre, { k: 'paso', n: 'Cada (m)', t: 'num', min: 10, max: 120, paso: 1 }, F.alto('Alto (m)', 5, 20, 0.5)],
    armar(p) { const g = new THREE.Group(), m = mat(oscuro() ? '#4a3c2e' : '#8a7258'), P = aLoLargo(p.pts, p.paso); lote(g, CIL, m, P.map(([x, z]) => [x, p.alto / 2, z, 0, 0.3, p.alto, 0.3])); lote(g, CAJA, m, P.map(([x, z, d]) => [x, p.alto - 0.6, z, d + Math.PI / 2, 2, 0.14, 0.14]));
      const cable = new THREE.Mesh(cintaVertical(p.pts, 0.03, p.alto - 0.55), mat('#22262a')); g.add(cable); return g; } },
  cartel: { n: 'Cartel', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 4.8, alto: 2, texto: 'Bienvenidos', fondo: '#ffffff', tinta: '#0F7A55', altura: 2.2 },
    campos: [{ k: 'texto', n: 'Texto', t: 'txt' }, F.ancho('Ancho (m)', 0.5, 30), F.alto('Alto (m)', 0.3, 12), { k: 'altura', n: 'Altura del piso (m)', t: 'num', min: 0, max: 20, paso: 0.1 }, { k: 'fondo', n: 'Fondo', t: 'color' }, { k: 'tinta', n: 'Letra', t: 'color' }, F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, gris = mat('#8c949b', { metalness: 0.5 }); for (const x of [-w * 0.7, w * 0.7]) caja(g, x - 0.08, 0, -0.08, x + 0.08, p.altura, 0.08, gris);
      const t = textoTex(p.texto || '', p.fondo, p.tinta, 512, Math.round(512 * p.alto / p.ancho)), m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); caja(g, -w, p.altura, -0.1, w, p.altura + p.alto, 0.1, [gris, gris, gris, gris, m, m]); return g; } },
  porton: { n: 'Portón', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 7, alto: 2.1, color: '#E6C229' },
    campos: [F.nombre, F.ancho('Ancho (m)', 1, 30), F.alto('Alto (m)', 0.8, 6), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, m = mat(p.color, { metalness: 0.4, roughness: 0.5 }); caja(g, -w, 0.1, -0.05, w, 0.2, 0.05, m); caja(g, -w, p.alto - 0.1, -0.05, w, p.alto, 0.05, m);
      for (let x = -w; x <= w + 0.01; x += 0.25) caja(g, x - 0.02, 0.1, -0.02, x + 0.02, p.alto, 0.02, m, false); return g; } },
  barrera: { n: 'Barrera', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 4.5 },
    campos: [F.nombre, F.ancho('Largo del brazo (m)', 1, 10), F.r],
    armar(p) { const g = new THREE.Group(); caja(g, -0.35, 0, -0.35, 0.35, 1.1, 0.35, mat('#E5484D')); const b = rayas('#ffffff', '#E5484D', 6).clone(); b.needsUpdate = true; b.rotation = Math.PI / 2; b.repeat.set(1, p.ancho / 1.2);
      caja(g, 0.35, 0.95, -0.06, 0.35 + p.ancho, 1.07, 0.06, new THREE.MeshStandardMaterial({ map: b, roughness: 0.5 })); return g; } },
  monticulo: { n: 'Montículo de tierra', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 9, fondo: 60, alto: 2.4 },
    campos: [F.nombre, F.ancho('Ancho (m)', 1, 80), F.fondo('Largo (m)', 1, 300), F.alto('Alto (m)', 0.3, 15), F.r],
    armar(p) { const g = new THREE.Group(), s = new THREE.Shape([new THREE.Vector2(-p.ancho / 2, 0), new THREE.Vector2(-p.ancho * 0.18, p.alto), new THREE.Vector2(p.ancho * 0.18, p.alto), new THREE.Vector2(p.ancho / 2, 0)]);
      const geo = new THREE.ExtrudeGeometry(s, { depth: p.fondo, bevelEnabled: false }); geo.translate(0, 0, -p.fondo / 2); g.add(sombra(new THREE.Mesh(geo, mat(oscuro() ? '#3a3226' : '#c8b48f', { roughness: 1 })))); return g; } },
  cancha: { n: 'Cancha de fútbol', g: 'Terreno', forma: 'punto', capa: 'base', def: { ancho: 105, fondo: 68 },
    campos: [F.nombre, F.ancho('Largo (m)', 20, 130), F.fondo('Ancho (m)', 10, 90), F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2; caja(g, -w - 2, 0, -d - 2, w + 2, 0.03, d + 2, mat(oscuro() ? '#1c2b21' : '#a7cc96', { roughness: 1 }), false); const b = mat('#f4f6f2');
      for (const [x0, z0, x1, z1] of [[-w, -d, w, -d + 0.15], [-w, d - 0.15, w, d], [-w, -d, -w + 0.15, d], [w - 0.15, -d, w, d], [-0.08, -d, 0.08, d]]) caja(g, x0, 0.03, z0, x1, 0.045, z1, b, false);
      for (const s of [-1, 1]) { caja(g, s * w - 0.06, 0, -3.66, s * w + 0.06, 2.44, -3.54, b); caja(g, s * w - 0.06, 0, 3.54, s * w + 0.06, 2.44, 3.66, b); caja(g, s * w - 0.06, 2.34, -3.66, s * w + 0.06, 2.46, 3.66, b); } return g; } },
  parada: { n: 'Parada de ómnibus', g: 'Construcción', forma: 'punto', capa: 'base', def: {}, campos: [F.nombre, F.r],
    armar(p) { const g = new THREE.Group(); caja(g, -2, 0, -0.6, 2, 0.1, 0.9, mat('#bfc4c8')); caja(g, -1.9, 2.5, -0.7, 1.9, 2.7, 0.9, mat('#B23A3A')); for (const x of [-1.8, 1.8]) caja(g, x - 0.06, 0, 0.7, x + 0.06, 2.5, 0.82, mat('#2F5DA8'));
      caja(g, -1.9, 0, 0.78, 1.9, 2.5, 0.84, new THREE.MeshStandardMaterial({ color: '#dde3ea', transparent: true, opacity: 0.45 })); caja(g, -1.4, 0.45, 0, 1.4, 0.55, 0.5, mat('#2F5DA8')); return g; } },

  // logística
  fila: { n: 'Fila de contenedores', g: 'Logística', forma: 'punto', capa: 'logistica', siempre: true, etiqueta: p => [p.nombre, p.naviera].filter(Boolean).join(' · '), def: { largo: 100, ancho: 5, alto: 6, pies: 40, carga: 'seco', color: '#2f6fd6', ocupacion: 75, mezcla: 12 },
    campos: [F.nombre, { k: 'naviera', n: 'Naviera', t: 'txt' }, { k: 'largo', n: 'Largo (m)', t: 'num', min: 6, max: 600, paso: 0.5 }, { k: 'ancho', n: 'Ancho (contenedores)', t: 'num', min: 1, max: 20, paso: 1 }, { k: 'alto', n: 'Alto máximo (contenedores)', t: 'num', min: 1, max: 9, paso: 1 },
      { k: 'pies', n: 'Contenedores de', t: 'sel', ops: [[40, '40 pies'], [20, '20 pies']] }, { k: 'carga', n: 'Tipo', t: 'sel', ops: [['seco', 'Secos'], ['reefer', 'Refrigerados (reefer)']] }, { k: 'color', n: 'Color de la naviera', t: 'color' },
      { k: 'ocupacion', n: 'Ocupación (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'mezcla', n: 'Otras navieras mezcladas (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'semilla', n: 'Variante', t: 'num', min: 0, max: 999, paso: 1 }, F.r],
    armar(p) { const g = new THREE.Group(), L = +p.pies === 20 ? 6.06 : 12.19, pitch = L + 0.34, ns = Math.max(1, Math.floor(p.largo / pitch)), nr = p.ancho | 0, R = azar(semilla(p)), rf = p.carga === 'reefer', its = [], celdas = [];
      const x0 = -ns * pitch / 2, z0 = -(nr - 1) * 1.37, H = 2.59, occ = (p.ocupacion ?? 75) / 100;
      for (let s = 0; s < ns; s++) for (let r = 0; r < nr; r++) { const borde = r === 0 || r === nr - 1, lleno = R() < Math.min(1, occ * (borde ? 0.9 : 1.15)); if (!lleno) continue;
        const h = Math.max(1, Math.min(p.alto, Math.round((borde ? 0.45 : 0.62) * p.alto + (R() - 0.35) * p.alto * 0.7 * occ + occ * 1.2)));
        for (let t = 0; t < h; t++) { let c = rf ? (R() < 0.5 ? '#e9edf0' : '#dfe4e8') : R() * 100 < (p.mezcla ?? 12) ? NAVIERAS[Math.floor(R() * 8)][0] : p.color; _c.set(c).offsetHSL(0, 0, (R() - 0.5) * 0.06);
          its.push([x0 + (s + 0.5) * pitch, t * H + H / 2, z0 + r * 2.74, 0, L * 0.985, H * 0.985, 2.44 * 0.985, '#' + _c.getHexString()]); celdas.push([s, r, t]); } }
      const im = lote(g, CAJA, mat('#ffffff', { roughness: 0.62, metalness: 0.15 }), its); if (im) im.userData.celdas = celdas;
      caja(g, x0 - 0.2, 0, z0 - 1.5, -x0 + 0.2, 0.035, -z0 + 1.5, mat(oscuro() ? '#2c2a25' : '#cdc3ad', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -10 }), false);
      g.userData.cuenta = its.length; return g; } },
  chasis: { n: 'Semirremolque', g: 'Logística', forma: 'punto', capa: 'logistica', def: { carga: '' }, campos: [F.nombre, { k: 'carga', n: 'Contenedor arriba (color)', t: 'color' }, F.r],
    armar(p) { const g = new THREE.Group(), m = mat(oscuro() ? '#2c3136' : '#4a5057'); caja(g, -6.2, 1.05, -1.2, 6.2, 1.35, 1.2, m); caja(g, -6.2, 0.5, -0.9, -5.2, 1.05, 0.9, m);
      lote(g, CILX, mat('#1e2226'), [3.4, 4.7].flatMap(x => [-1.05, 1.05].map(z => [x, 0.5, z, 0, 1, 1, 0.3])));
      if (p.carga) caja(g, -6.1, 1.35, -1.22, 6.1, 3.94, 1.22, mat(p.carga, { roughness: 0.6, metalness: 0.15 })); return g; } },
  camion: { n: 'Camión con contenedor', g: 'Logística', forma: 'punto', capa: 'logistica', def: { carga: '#c2415b', cabina: '#f2f4f5' },
    campos: [F.nombre, { k: 'carga', n: 'Contenedor (color, vacío = sin carga)', t: 'color' }, { k: 'cabina', n: 'Cabina', t: 'color' }, F.r],
    armar(p) { const g = TIPOS.chasis.armar({ carga: p.carga }); const c = mat(p.cabina, { roughness: 0.4, metalness: 0.3 }); caja(g, 6.4, 0.6, -1.25, 9.2, 3.4, 1.25, c); caja(g, 8.9, 1.9, -1.1, 9.25, 2.9, 1.1, mat('#22313f', { roughness: 0.1, metalness: 0.6 }), false); return g; } },
  maquina: { n: 'Máquina de patio', g: 'Logística', forma: 'punto', capa: 'logistica', etiqueta: p => p.nombre, def: { tipo: 'apiladora', color: '#d8a31a' },
    campos: [F.nombre, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['apiladora', 'Apiladora de vacíos'], ['reach', 'Reach stacker'], ['autoelevador', 'Autoelevador']] }, F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), c = mat(p.color, { roughness: 0.5, metalness: 0.3 }), n = mat('#24282c', { metalness: 0.4 }), big = p.tipo !== 'autoelevador';
      caja(g, -3.2 * (big ? 1 : 0.5), 0.6, -1.4 * (big ? 1 : 0.6), 2.2 * (big ? 1 : 0.5), 2.2 * (big ? 1 : 0.7), 1.4 * (big ? 1 : 0.6), c); caja(g, -1.6, 2.2, -0.9, 0, 4.4, 0.9, mat('#2c3e4f', { roughness: 0.15, metalness: 0.5 }));
      if (p.tipo === 'reach') { const b = caja(g, -2, 3, -0.35, 6.5, 3.8, 0.35, c); b.rotation.z = 0.32; caja(g, 6, 4.5, -1.3, 6.6, 5.2, 1.3, n); }
      else { for (const z of [-0.9, 0.9]) caja(g, 2.3, 0.4, z - 0.15, 2.6, big ? 16 : 4.5, z + 0.15, n); caja(g, 2.6, big ? 12 : 1.2, -1.3, 3.1, big ? 12.5 : 1.4, 1.3, n); }
      for (const [x, z] of [[-2.4, -1.3], [-2.4, 1.3], [1.5, -1.3], [1.5, 1.3]]) { const w = cil(g, x * (big ? 1 : 0.5), 0, z * (big ? 1 : 0.6), big ? 0.75 : 0.35, 0.6, n); w.rotation.x = Math.PI / 2; w.position.y = big ? 0.75 : 0.35; } return g; } },
  vehiculo: { n: 'Vehículo', g: 'Personas y vehículos', forma: 'punto', capa: 'logistica', def: { modelo: 'suv', color: '' },
    campos: [F.nombre, { k: 'modelo', n: 'Modelo', t: 'sel', ops: [['suv', 'SUV'], ['eq7', 'Chery eQ7'], ['toro', 'Pickup (Fiat Toro)'], ['fiorino', 'Furgón chico (Fiorino)'], ['bipper', 'Utilitario (Bipper)']] }, { k: 'color', n: 'Color', t: 'color' }, F.r],
    armar(p, ctx) { const g = new THREE.Group(), c = mat(p.color || '#c9ced2', { roughness: 0.35, metalness: 0.4 }); caja(g, -2.2, 0.35, -0.9, 2.2, 1.1, 0.9, c); caja(g, -1.2, 1.1, -0.82, 1.0, 1.6, 0.82, mat('#2c3e4f', { roughness: 0.1, metalness: 0.6 }));
      ctx && ctx.glb && ctx.glb('vehiculos', p.modelo, g, p.color); return g; } },
  persona: { n: 'Persona', g: 'Personas y vehículos', forma: 'punto', capa: 'logistica', def: { modelo: 'tec-h-epp' },
    campos: [F.nombre, { k: 'modelo', n: 'Cómo es', t: 'sel', ops: [['tec-h-epp', 'Técnico con casco y chaleco'], ['tec-h', 'Técnico'], ['of-h', 'Oficina (hombre)'], ['of-m', 'Oficina (mujer)']] }, F.r],
    armar(p, ctx) { const g = new THREE.Group(); cil(g, 0, 0, 0, 0.22, 1.45, mat('#3b5b7a')); const k = new THREE.Mesh(BOLA, mat('#e0b493')); k.scale.setScalar(0.26); k.position.y = 1.62; g.add(sombra(k)); ctx && ctx.glb && ctx.glb('avatares', p.modelo, g); return g; } },

  // equipos (Ondi). y = altura de montaje; uid = vínculo con el equipo real de la app (UniFi, Meraki o cargado a mano)
  camara: { n: 'Cámara', g: 'Equipos', forma: 'punto', capa: 'equipos', equipo: 'cam', ondi: 'camara', etiqueta: p => p.nombre, def: { y: 6, alcance: 25, apertura: 90 },
    campos: [...EQ_CAMPOS.slice(0, 7), { k: 'alcance', n: 'Alcance (m)', t: 'num', min: 0, max: 200, paso: 1 }, { k: 'apertura', n: 'Apertura (°)', t: 'num', min: 10, max: 360, paso: 5 }, EQ_CAMPOS[7]],
    armar: equipo((g, p, ec) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.62, 16).rotateZ(Math.PI / 2), blanco()); b.position.z = 0.2; b.rotation.y = Math.PI / 2; g.add(sombra(b)); caja(g, -0.2, 0.12, -0.25, 0.2, 0.22, 0.32, blanco());
      const l = new THREE.Mesh(BOLA, led(ec)); l.scale.setScalar(0.07); l.position.set(0, 0.06, 0.52); g.add(l); campoVision(g, p, ec); }) },
  ap: { n: 'Wi-Fi (punto de acceso)', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'ap', equipo: 'ap', etiqueta: p => p.nombre, def: { y: 8 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.07, 24), blanco()); g.add(sombra(d)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 28).rotateX(Math.PI / 2), led(ec)); r.position.y = -0.04; g.add(r); }) },
  switch: { n: 'Switch', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'switch', equipo: 'sw', etiqueta: p => p.nombre, def: { y: 1.5 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.22, -0.03, -0.22, 0.22, 0.03, 0.22, negro()); for (let i = 0; i < 8; i++) caja(g, -0.18 + i * 0.05, -0.01, 0.22, -0.15 + i * 0.05, 0.02, 0.225, led(ec), false); }) },
  rack: { n: 'Rack o gabinete', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'otro', equipo: 'sw', etiqueta: p => p.nombre, def: { y: 0, alto: 1.2 }, campos: [...EQ_CAMPOS.slice(0, 5), F.alto('Alto (m)', 0.3, 2.4), F.r, EQ_CAMPOS[7]],
    armar: equipo((g, p, ec) => { const h = p.alto || 1.2; caja(g, -0.3, 0, -0.3, 0.3, h, 0.3, negro()); caja(g, -0.25, h - 0.15, 0.3, 0.25, h - 0.1, 0.31, led(ec), false); }) },
  nvr: { n: 'Grabador (NVR)', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'nvr', equipo: 'cam', etiqueta: p => p.nombre, def: { y: 1 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.22, -0.05, -0.18, 0.22, 0.05, 0.18, negro()); caja(g, 0.12, -0.02, 0.18, 0.18, 0.02, 0.185, led(ec), false); }) },
  router: { n: 'Router o firewall', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'router', equipo: 'gw', etiqueta: p => p.nombre, def: { y: 1.2 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.2, -0.04, -0.14, 0.2, 0.04, 0.14, blanco()); caja(g, -0.16, 0.04, 0.12, 0.16, 0.05, 0.14, led(ec), false); }) },
  sensor: { n: 'Sensor', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'sensor_mov', equipo: 'sen', etiqueta: p => p.nombre, def: { y: 2.2 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.06, -0.08, -0.03, 0.06, 0.08, 0.03, blanco()); const l = new THREE.Mesh(BOLA, led(ec)); l.scale.setScalar(0.035); l.position.set(0, 0.04, 0.035); g.add(l); }) },
  ups: { n: 'UPS', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'ups', equipo: 'otro', etiqueta: p => p.nombre, def: { y: 0 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.12, 0, -0.22, 0.12, 0.42, 0.22, negro()); caja(g, -0.04, 0.32, 0.22, 0.04, 0.36, 0.225, led(ec), false); }) },
  fibra: { n: 'Tendido de fibra o cable', g: 'Equipos', forma: 'linea', capa: 'equipos', def: { y: 0, color: '#ff8a00', hilos: 12 },
    campos: [F.nombre, { k: 'hilos', n: 'Hilos', t: 'num', min: 1, max: 288, paso: 1 }, { k: 'y', n: 'Altura (0 = subterráneo)', t: 'num', min: 0, max: 30, paso: 0.5 }, F.color('Color'), { k: 'notas', n: 'Notas', t: 'area' }],
    armar(p) { const g = new THREE.Group(), y = p.y || 0, m = new THREE.MeshBasicMaterial({ color: p.color, transparent: !y, opacity: y ? 1 : 0.85, depthWrite: !!y });
      if (y) { const c = new THREE.CatmullRomCurve3(p.pts.map(q => new THREE.Vector3(q[0], y, q[1])), false, 'catmullrom', 0); const k = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, p.pts.length * 8), 0.06, 6), m); g.add(k); }
      else for (const [x, z, d] of aLoLargo(p.pts, 2.2)) { const k = new THREE.Mesh(CAJA, m); k.scale.set(0.22, 0.02, 1.2); k.position.set(x, 0.09, z); k.rotation.y = d; k.renderOrder = 2; g.add(k); } return g; } }
};
export const GRUPOS = ['Terreno', 'Construcción', 'Logística', 'Vegetación', 'Equipos', 'Personas y vehículos'];

// árboles: tronco + copa, todos los de una pieza en dos o tres dibujos
function arbolado(g, lista) { const tr = [], co = [], pi = [], pa = [], R = azar(lista.length * 31 + 7);
  for (const [x, z, t, k = 1] of lista) { if (t === 'pino') { tr.push([x, 2 * k, z, 0, 0.4 * k, 4 * k, 0.4 * k]); pi.push([x, 6.2 * k, z, R() * 6, 4.4 * k, 7.5 * k, 4.4 * k], [x, 9.3 * k, z, R() * 6, 3.0 * k, 5 * k, 3.0 * k]); }
    else if (t === 'palmera') { tr.push([x, 4.5 * k, z, 0, 0.5 * k, 9 * k, 0.5 * k]); pa.push([x, 9.2 * k, z, R() * 6, 4.6 * k, 1.1 * k, 4.6 * k]); }
    else { tr.push([x, 1.6 * k, z, 0, 0.45 * k, 3.2 * k, 0.45 * k]); co.push([x, 4.6 * k, z, R() * 6, 5.2 * k * (0.9 + R() * 0.25), 4.4 * k, 5.2 * k * (0.9 + R() * 0.25)]); } }
  const T = oscuro(); lote(g, CIL, mat(T ? '#3b3026' : '#6b5440'), tr); lote(g, BOLA, mat(T ? '#22361f' : '#6f9a5c', { roughness: 1, flatShading: true }), co); lote(g, CONO, mat(T ? '#1a2c1c' : '#4d7a4b', { roughness: 1, flatShading: true }), pi);
  lote(g, CONO, mat(T ? '#22361f' : '#6f9a5c', { roughness: 1, flatShading: true }), pa.map(q => { q[5] *= -1; return q; })); }
// línea corrida hacia un costado (bordes de ruta)
function offset(pts, d) { return pts.map((c, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [c[0] - (b[1] - a[1]) / l * d, c[1] + (b[0] - a[0]) / l * d]; }); }
// cinta parada a una altura (riel, cable)
function cintaVertical(pts, alto, y) { const v = [], ix = []; for (let i = 0; i < pts.length; i++) { v.push(pts[i][0], y - alto / 2, pts[i][1], pts[i][0], y + alto / 2, pts[i][1]); if (i) { const j = i * 2; ix.push(j - 2, j - 1, j, j - 1, j + 1, j); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(ix); geo.computeVertexNormals(); return geo; }
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

// ---------- juntar en un solo dibujo las partes de una pieza que comparten material (menos llamadas a la placa de video) ----------
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4();
function aplanar(g) { g.updateMatrixWorld(true); _inv.copy(g.matrixWorld).invert(); const grupos = new Map();
  g.traverse(k => { if (!k.isMesh || k.isInstancedMesh || k.isSkinnedMesh || Array.isArray(k.material) || k.renderOrder || k.userData.techo || k.userData.campo) return;
    const sig = k.material.uuid + '|' + Object.keys(k.geometry.attributes).sort().join(',') + '|' + k.castShadow + k.receiveShadow; (grupos.get(sig) || grupos.set(sig, []).get(sig)).push(k); });
  for (const lista of grupos.values()) { if (lista.length < 2) continue; const geos = lista.map(k => { const q = k.geometry.index ? k.geometry.toNonIndexed() : k.geometry.clone(); q.applyMatrix4(_mm.multiplyMatrices(_inv, k.matrixWorld)); return q; });
    const geo = mergeGeometries(geos); geos.forEach(q => q.dispose()); if (!geo) continue; const m = new THREE.Mesh(geo, lista[0].material); m.castShadow = lista[0].castShadow; m.receiveShadow = lista[0].receiveShadow;
    for (const k of lista) k.parent.remove(k); g.add(m); } }

// ---------- armar una pieza completa en su lugar ----------
export function armarPieza(p, ctx = {}) { const T = TIPOS[p.t]; if (!T) return null; const q = { ...T.def, ...p };
  const g = T.armar(q, ctx) || new THREE.Group(); aplanar(g); if (T.forma === 'punto') { g.position.set(q.x || 0, 0, q.z || 0); g.rotation.y = q.r || 0; }
  g.userData.pieza = p; g.userData.tipo = T; g.traverse(o => { o.userData.dueño = g; }); return g; }
// centro de una pieza (para etiquetas, enfocar y calcular el "lugar")
export function centro(p) { if (p.pts && p.pts.length) { if (TIPOS[p.t] && TIPOS[p.t].forma === 'area') { const n = p.pts.length; return [p.pts.reduce((a, q) => a + q[0], 0) / n, p.pts.reduce((a, q) => a + q[1], 0) / n]; } const m = p.pts[Math.floor(p.pts.length / 2)]; return [m[0], m[1]]; } return [p.x || 0, p.z || 0]; }
export function altoDe(p) { const q = { ...(TIPOS[p.t] || {}).def, ...p }; return { galpon: q.alto, modulo: (q.pisos || 1) * 3.1, columna: q.alto, fila: (q.alto || 1) * 2.59, alero: q.alto, maquina: 6, cartel: (q.altura || 0) + (q.alto || 0) }[p.t] ?? (q.y != null ? q.y + 0.4 : 2); }
export { largoDe };

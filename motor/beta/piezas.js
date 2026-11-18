// Motor común · piezas. Cada cosa de la maqueta es una pieza en datos: { id, t: tipo, x, z, r (giro), pts (líneas y áreas), ...opciones }.
// Cada tipo dice cómo se llama, en qué grupo del catálogo va, qué se puede editar (campos) y cómo se dibuja (armar).
// Sumar un tipo nuevo = sumar una entrada a TIPOS. Nada de la escena queda fijo en el código.
import { THREE } from './nucleo.js?v=5';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { suelo as texSuelo, METROS, chapa, frente, matTex, macroDe } from '../texturas.js?v=4';

// ---------- materiales y formas compartidas ----------
const MATS = new Map();
export function mat(c, o = {}) { const k = c + JSON.stringify(o); let m = MATS.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o)); MATS.set(k, m); } return m; }
const PINOS = ['#2f5a3a', '#355f3c', '#2a4f36', '#3c6a43', '#30563b'], CONO2 = new THREE.ConeGeometry(0.5, 1, 14, 1, true);
const VERDES = ['#5f8f4e', '#6f9a5c', '#7aa363', '#587f48', '#86a96a', '#4f7a43'], BOLA2 = new THREE.IcosahedronGeometry(0.5, 1);
const CAJA = new THREE.BoxGeometry(1, 1, 1), CIL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), BOLA = new THREE.IcosahedronGeometry(0.5, 1), CONO = new THREE.ConeGeometry(0.5, 1, 9), CILX = new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateX(Math.PI / 2);
// contenedor: caja con chapa acanalada a los costados, puertas en los frentes y techo; el color lo pone cada uno (instancia)
const CONT = new THREE.BoxGeometry(1, 1, 1);
const MCONT = new Map();
function matsCont(costillas, reefer) { const k = costillas + '|' + reefer + '|' + oscuro(); if (MCONT.has(k)) return MCONT.get(k); const os = oscuro() ? '#a6b1bd' : '#ffffff';
  const lado = chapa(costillas), fr = frente(reefer), techo = chapa(Math.round(costillas / 2), 'techo');
  const M = (t, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ map: t, bumpMap: t, bumpScale: 2.2, color: os, roughness: 0.52, metalness: 0.32 }, o));
  const ms = [M(fr), M(fr), M(techo, { roughness: 0.75 }), new THREE.MeshStandardMaterial({ color: '#2a2c2e', roughness: 1 }), M(lado), M(lado)]; MCONT.set(k, ms); return ms; }
const sombra = (m, c = true, r = true) => { m.castShadow = c; m.receiveShadow = r; return m; };
function caja(g, x0, y0, z0, x1, y1, z1, m, s = true) { const k = new THREE.Mesh(CAJA, m); k.scale.set(Math.max(0.01, x1 - x0), Math.max(0.01, y1 - y0), Math.max(0.01, z1 - z0)); k.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(sombra(k, s)); return k; }
function cil(g, x, y0, z, r, h, m, geo = CIL) { const k = new THREE.Mesh(geo, m); k.scale.set(r * 2, h, r * 2); k.position.set(x, y0 + h / 2, z); g.add(sombra(k)); return k; }
// muchas piezas iguales en un solo dibujo: items = [x, y, z, giro, sx, sy, sz, color]
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function lote(g, geo, m, items, s = true) { if (!items.length) return null; const im = new THREE.InstancedMesh(geo, m, items.length);
  items.forEach((t, i) => { _e.set(0, t[3] || 0, 0); _q.setFromEuler(_e); _m.compose(_v.set(t[0], t[1], t[2]), _q, _s.set(t[4] ?? 1, t[5] ?? 1, t[6] ?? 1)); im.setMatrixAt(i, _m); if (t[7] != null) im.setColorAt(i, _c.set(t[7])); });
  im.castShadow = s; im.receiveShadow = true; im.computeBoundingSphere(); im.computeBoundingBox && im.computeBoundingBox(); g.add(im); return im; }
// caja con la textura repetida en metros (paso = metros por cuadro), para chapa de galpones
function cajaT(g, x0, y0, z0, x1, y1, z1, m, paso = 1, s = true) { const sx = Math.max(0.01, x1 - x0), sy = Math.max(0.01, y1 - y0), sz = Math.max(0.01, z1 - z0), geo = new THREE.BoxGeometry(sx, sy, sz), uv = geo.attributes.uv;
  // caras en orden: +x, -x, +y, -y, +z, -z (4 vértices cada una): u y v a lo ancho y alto de cada cara
  const dim = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]]; for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dim[f][0] / paso, uv.getY(j) * dim[f][1] / paso); }
  const k = new THREE.Mesh(geo, m); k.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(sombra(k, s)); return k; }
// sombra de contacto: una mancha oscura y suave debajo de cada pila, más marcada donde se juntan (la luz no entra entre contenedores)
let TEX_PIE = null;
function sombraPie(pos, sx, sz) { if (!TEX_PIE) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.shadowColor = '#000'; x.shadowBlur = 14; x.shadowOffsetX = 400; x.fillStyle = '#000'; x.fillRect(24 - 400, 24, 80, 80); TEX_PIE = new THREE.CanvasTexture(c); }
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, map: TEX_PIE, transparent: true, opacity: oscuro() ? 0.3 : 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -8, fog: true });
  const k = new THREE.InstancedMesh(PIE_GEO, m, pos.length), M4 = new THREE.Matrix4(); pos.forEach(([x, z], i) => k.setMatrixAt(i, M4.makeScale(sx, 1, sz).setPosition(x, 0.07, z))); k.renderOrder = 1; k.userData.noPick = true; k.raycast = () => {}; return k; }
const PIE_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
// material de suelo con textura (pedregullo, tierra, hormigón, asfalto, pasto, monte); uv en metros
const TINTE = { pasto2: '#d3dccb' }, SUELO_TEX = { tierra: 'tierra', ripio: 'pedregullo', hormigon: 'hormigon', asfalto: 'asfalto', pasto: 'pasto', pasto2: 'pasto', monte: 'monte' };
// asfalto y hormigón parejos: la textura trae manchas que, repetidas en una playa o una ruta larga, se ven como lunares. Se mezcla con su
// color promedio (el nivel más chico de la textura) y queda el grano fino sin el dibujo que se repite.
const CALMOS = new Map();
function calmo(base, k = 0.4) { const key = base.uuid + '|' + k; let m = CALMOS.get(key); if (m) return m; m = base.clone();
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n{ vec4 fino = texture2D( map, vMapUv ); vec4 prom = texture2D( map, vMapUv, 12.0 ); fino.rgb = mix( prom.rgb, fino.rgb, ' + k.toFixed(2) + ' ); diffuseColor *= fino; }\n#endif'); };
  m.customProgramCacheKey = () => 'calmo' + k; CALMOS.set(key, m); return m; }
export function matSuelo(k, o = {}, escala = 1) { const t = SUELO_TEX[k]; if (!t) return null; const m = METROS[t] * escala, parejo = t === 'hormigon' || t === 'asfalto';
  const b = matTex(texSuelo(t), oscuro() ? '#4b5866' : (TINTE[k] || '#ffffff'), [1 / m, 1 / m], Object.assign({ roughness: 0.97, macro: parejo ? 0 : macroDe(t) }, o)); return parejo ? calmo(b, 0.42) : b; }
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
// noche con aire de tecnología: el color de cada app en neón, luces que brillan y charcos de luz en el piso
const acento = () => ({ darvi: '#3ddc97', olumi: '#ffd23f', kliva: '#9d7cff' })[document.documentElement.dataset.app] || '#3fc6ea';
let _halo = null; const halo = () => { if (_halo) return _halo; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  _halo = new THREE.CanvasTexture(c); _halo.colorSpace = THREE.SRGBColorSpace; return _halo; };
const MHALO = new Map(); const matHalo = (c, op) => { const k = c + op; if (!MHALO.has(k)) MHALO.set(k, new THREE.SpriteMaterial({ map: halo(), color: c, opacity: op, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); return MHALO.get(k); };
function brillo(g, x, y, z, tam, c, op = 0.9) { const s = new THREE.Sprite(matHalo(c, op)); s.position.set(x, y, z); s.scale.set(tam, tam, 1); s.renderOrder = 3; g.add(s); return s; }
const MPOZO = new Map(); function pozo(g, x, z, r, c, op = 0.32) { const k = c + op; if (!MPOZO.has(k)) MPOZO.set(k, new THREE.MeshBasicMaterial({ map: halo(), color: c, opacity: op, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -8 }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), MPOZO.get(k)); m.position.set(x, 0.12, z); m.renderOrder = 2; g.add(m); return m; }
const neon = (c, op = 1) => { const k = 'neon' + c + op; return MHALO.get(k) || MHALO.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, toneMapped: false, blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: op >= 1, polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -10 })).get(k); };
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
// contenedores mezclados en una fila: otras navieras y los grises y beige de las empresas que alquilan contenedores
const MEZCLA = ['#2f6fd6', '#c2415b', '#1e9e5a', '#e2b53a', '#d9692c', '#5b4fb3', '#2b9bb3', '#9ea2a4', '#c4b596', '#8c8f8b', '#b9bdbf', '#9ea2a4'];
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
// montaje: en columna (con poste desde el piso), en pared o en el techo (sin poste). piso = altura del piso donde está (planta alta de un edificio)
const MONT = { k: 'montaje', n: 'Montaje', t: 'sel', ops: [['poste', 'En columna o poste'], ['pared', 'En pared'], ['techo', 'En el techo']] }, BASE = { k: 'piso', n: 'Altura del piso (m)', t: 'num', min: 0, max: 40, paso: 0.1 };
const EQ_CAMPOS = [F.nombre, { k: 'marca', n: 'Marca', t: 'sel', ops: MARCAS }, { k: 'modelo', n: 'Modelo', t: 'txt' }, { k: 'ip', n: 'IP', t: 'txt' }, { k: 'mac', n: 'MAC', t: 'txt' }, { k: 'y', n: 'Altura (m)', t: 'num', min: 0, max: 40, paso: 0.1 }, F.r, { k: 'notas', n: 'Notas', t: 'area' }, MONT, BASE];

// ---------- equipos de red y seguridad (Ondi) ----------
// Van un poco más grandes que en la realidad para que se vean en un predio, con su soporte según el montaje (columna o poste, pared, techo)
// y una luz del color de su estado. En el piso, un aro chico marca dónde están (más grande si van en columna).
function equipo(dibujo) { return (p, ctx) => { const g = new THREE.Group(), y = p.y ?? 3, est = (ctx.estado && ctx.estado(p)) || 'off', ec = COL.estado[est], mont = p.montaje || 'poste';
  const cuerpo = new THREE.Group(); cuerpo.position.y = y; g.add(cuerpo); dibujo(cuerpo, p, ec, mont);
  const b0 = +p.piso || 0; if (y - b0 > 0.6 && mont === 'poste') { const palo = cil(g, 0, b0, 0, 0.045, y - b0 - 0.05, mat('#9aa3ab', { metalness: 0.4, roughness: 0.5 })); palo.castShadow = false; cil(g, 0, b0, 0, 0.11, 0.05, mat('#7d868e', { metalness: 0.4, roughness: 0.6 })); }
  const r = mont === 'poste' ? 0.62 : 0.34, aro = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ec, transparent: true, opacity: mont === 'poste' ? 0.85 : 0.6, depthWrite: false })); aro.position.y = b0 + 0.09; aro.renderOrder = 2; g.add(aro);
  g.userData.estado = est; g.userData.aro = aro; return g; }; }
const blanco = () => mat('#f2f4f5', { roughness: 0.45 }), negro = () => mat('#1d2125', { roughness: 0.4, metalness: 0.3 }), led = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 });
const burbuja = () => mat('#12161a', { roughness: 0.06, metalness: 0.65 }), gris = () => mat('#c3c8cc', { roughness: 0.5, metalness: 0.25 });
const ESF = new THREE.SphereGeometry(0.5, 22, 14), MEDIA = new THREE.SphereGeometry(0.5, 22, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), CIL24 = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
function malla(g, geo, m, x, y, z, sx, sy, sz, s = true) { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.scale.set(sx, sy ?? sx, sz ?? sx); g.add(s ? sombra(k) : k); return k; }
const alFrente = k => { k.rotation.x = Math.PI / 2; return k; };   // un cilindro parado pasa a apuntar hacia adelante (+Z)
// soporte de un equipo: en pared, placa y brazo hacia adelante; en el techo, caño que baja de una roseta; en columna, brazo corto
function soporte(g, mont, largo, y = 0) { const b = blanco();
  if (mont === 'pared') { caja(g, -0.11, y - 0.13, -0.03, 0.11, y + 0.13, 0, b); if (largo > 0.04) alFrente(malla(g, CIL, b, 0, y, largo / 2, 0.06, largo, 0.06)); }
  else if (mont === 'techo') { malla(g, CIL24, b, 0, y + 0.3, 0, 0.2, 0.025, 0.2); malla(g, CIL, b, 0, y + 0.15, 0, 0.05, 0.3, 0.05); }
  else if (largo > 0.04) alFrente(malla(g, CIL, b, 0, y, largo / 2, 0.055, largo, 0.055)); }
// cámaras: bullet (cuerpo con visera, apunta), domo (burbuja oscura), PTZ (domo grande que gira) y ojo de pez (disco chato de techo)
export const CAMARAS = [['bullet', 'Bullet'], ['domo', 'Domo'], ['ptz', 'PTZ (gira y acerca)'], ['ojo', 'Ojo de pez (360°)']];
const APERTURA = { bullet: 80, domo: 110, ptz: 360, ojo: 360 };
function camBullet(g, p, ec, mont) { const b = blanco(), k = new THREE.Group(), z0 = mont === 'techo' ? 0 : 0.26; soporte(g, mont, z0); g.add(k);
  k.position.set(0, mont === 'techo' ? -0.02 : 0, z0); k.rotation.x = (p.inclina ?? 14) * Math.PI / 180;
  malla(k, ESF, b, 0, 0, 0, 0.11);                                                     // rótula
  alFrente(malla(k, CIL24, b, 0, 0, 0.3, 0.24, 0.56, 0.24));                           // cuerpo
  caja(k, -0.14, 0.1, 0, 0.14, 0.135, 0.68, b);                                        // visera
  alFrente(malla(k, CIL24, negro(), 0, 0, 0.59, 0.225, 0.03, 0.225));                  // frente oscuro
  malla(k, ESF, burbuja(), 0, 0, 0.6, 0.13, 0.13, 0.05);                               // lente
  malla(k, BOLA, led(ec), 0.07, -0.065, 0.61, 0.034, 0.034, 0.034, false); }           // luz de estado
function camDomo(g, p, ec, mont, ptz) { const b = blanco(), R = ptz ? 0.25 : 0.19; let cz = 0, cy = 0;
  if (mont === 'pared') { cz = R + 0.14; cy = 0.2; caja(g, -0.12, -0.04, -0.03, 0.12, 0.3, 0, b); alFrente(malla(g, CIL, b, 0, cy, cz / 2, 0.06, cz, 0.06)); }
  else if (mont === 'techo') { if (ptz) { cy = -0.16; malla(g, CIL, b, 0, -0.08, 0, 0.06, 0.2, 0.06); } malla(g, CIL24, b, 0, 0.012, 0, R * 2.2, 0.025, R * 2.2); }
  else { cz = R + 0.2; cy = 0.2; alFrente(malla(g, CIL, b, 0, cy, cz / 2, 0.055, cz, 0.055)); malla(g, CIL, b, 0, cy - 0.04, cz, 0.06, 0.1, 0.06); }
  const tapa = ptz ? 0.1 : 0.07, cuerpo = ptz ? 0.24 : 0; malla(g, CIL24, b, 0, cy - tapa / 2 - (mont === 'techo' ? 0 : 0.08), cz, R * 2.12, tapa, R * 2.12);
  const y1 = cy - tapa - (mont === 'techo' ? 0 : 0.08); if (ptz) malla(g, CIL24, b, 0, y1 - cuerpo / 2, cz, R * 2, cuerpo, R * 2);
  const yb = y1 - cuerpo; malla(g, CIL24, led(ec), 0, yb - 0.008, cz, R * 2.02, 0.016, R * 2.02, false);  // aro de luz de estado
  malla(g, MEDIA, burbuja(), 0, yb - 0.012, cz, R * 1.84);                               // burbuja
  malla(g, ESF, negro(), 0, yb - R * 0.5, cz + R * 0.3, R * 0.5, R * 0.5, R * 0.5, false); }  // el lente que se adivina adentro
function camOjo(g, p, ec, mont) { const b = blanco(), k = new THREE.Group(); g.add(k); if (mont !== 'techo') { k.rotation.x = -Math.PI / 2; k.position.z = mont === 'pared' ? 0.03 : 0.09; }
  malla(k, CIL24, b, 0, -0.03, 0, 0.42, 0.06, 0.42); malla(k, MEDIA, burbuja(), 0, -0.058, 0, 0.2, 0.09, 0.2); malla(k, CIL24, led(ec), 0, -0.062, 0, 0.26, 0.006, 0.26, false); }
// campo de visión en el piso: abanico (o disco, si ve todo alrededor) que se apaga hacia lo lejos, con el borde marcado
function campoVision(g, p, ec) { const al = p.alcance ?? 25, ap = Math.min(360, p.apertura || APERTURA[p.clase] || 90) * Math.PI / 180; if (!al) return;
  const y = (+p.piso || 0) + 0.07 - (g.position.y || 0), capa = (r, op) => { const geo = ap >= 6.28 ? new THREE.CircleGeometry(r, 48) : new THREE.CircleGeometry(r, 32, Math.PI / 2 - ap / 2, ap); geo.rotateX(-Math.PI / 2);
    const k = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ec, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); k.position.y = y; k.rotation.y = Math.PI; k.renderOrder = 1; k.userData.campo = true; g.add(k); };
  capa(al, ap >= 6.28 ? 0.035 : 0.05); capa(al * 0.55, ap >= 6.28 ? 0.035 : 0.05);
  const v = []; if (ap < 6.28) v.push(0, 0, 0); for (let i = 0; i <= 32; i++) { const a = -ap / 2 + ap * i / 32; v.push(Math.sin(a) * al, 0, Math.cos(a) * al); } if (ap < 6.28) v.push(0, 0, 0);
  const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3)), new THREE.LineBasicMaterial({ color: ec, transparent: true, opacity: 0.4, depthWrite: false })); l.position.y = y + 0.01; l.renderOrder = 1; l.userData.campo = true; g.add(l); }
// sensores y control de acceso
export const SENSORES = [['mov', 'Movimiento'], ['humo', 'Humo'], ['temp', 'Temperatura y humedad'], ['puerta', 'Apertura de puerta'], ['sirena', 'Sirena'], ['acceso', 'Control de acceso (lector)']];
function sensorDib(g, p, ec, mont) { const b = blanco(), c = p.clase || 'mov';
  if (c === 'humo') { malla(g, CIL24, b, 0, -0.03, 0, 0.3, 0.06, 0.3); malla(g, CIL24, gris(), 0, -0.07, 0, 0.16, 0.03, 0.16); malla(g, BOLA, led(ec), 0.1, -0.065, 0, 0.03, 0.03, 0.03, false); }
  else if (c === 'sirena') { caja(g, -0.13, -0.11, 0, 0.13, 0.11, 0.07, mat('#c5362c', { roughness: 0.5 })); malla(g, ESF, led(ec), 0, 0.02, 0.08, 0.12, 0.12, 0.07, false); }
  else if (c === 'acceso') { caja(g, -0.06, -0.1, 0, 0.06, 0.1, 0.035, negro()); caja(g, -0.035, -0.06, 0.035, 0.035, 0.02, 0.038, gris(), false); caja(g, -0.03, 0.055, 0.035, 0.03, 0.07, 0.039, led(ec), false); }
  else if (c === 'temp') { caja(g, -0.06, -0.06, 0, 0.06, 0.06, 0.03, b); caja(g, -0.035, -0.01, 0.03, 0.035, 0.035, 0.033, negro(), false); malla(g, BOLA, led(ec), 0, -0.035, 0.032, 0.024, 0.024, 0.024, false); }
  else if (c === 'puerta') { caja(g, -0.02, -0.05, 0, 0.02, 0.05, 0.02, b); caja(g, 0.03, -0.04, 0, 0.05, 0.04, 0.018, b); malla(g, BOLA, led(ec), 0, 0.03, 0.022, 0.02, 0.02, 0.02, false); }
  else { caja(g, -0.06, -0.08, 0, 0.06, 0.08, 0.05, b); malla(g, ESF, mat('#e9ecef', { roughness: 0.2 }), 0, -0.02, 0.05, 0.1, 0.1, 0.05); malla(g, BOLA, led(ec), 0, 0.05, 0.052, 0.024, 0.024, 0.024, false); } }

// ---------- paredes, aberturas y pisos (modo construcción) ----------
// Aberturas de una pared: { s: lado (0 = primer tramo), a: desde dónde (m, a lo largo), w: ancho, k: tipo }. Medidas de fábrica acá abajo.
export const ABERTURAS = { puerta: { n: 'Puerta', w: 0.9, h: 2.05 }, doble: { n: 'Puerta doble', w: 1.6, h: 2.05 }, vidrio: { n: 'Puerta de vidrio', w: 0.9, h: 2.05 }, ventana: { n: 'Ventana', w: 1.2, h: 1.15, y: 0.95 }, paso: { n: 'Paso sin puerta', w: 1, h: 2.05 }, porton: { n: 'Portón', w: 3.5, h: 3.2 } };
export const PAREDES = [['maciza', 'Maciza'], ['vidrio', 'Vidriada'], ['media', 'Media altura'], ['reja', 'Reja o malla'], ['sin', 'Sin pared (abierto)']];
export const PISOS = [['ceramica', 'Cerámica'], ['porcelanato', 'Porcelanato gris'], ['madera', 'Madera'], ['alfombra', 'Alfombra'], ['hormigon', 'Hormigón alisado'], ['goma', 'Goma técnica'], ['sin', 'Sin piso']];
export const areaSig = P => { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
// vistas de pared, como en Los Sims: altas, cortadas (para ver adentro) o al ras
const altoVista = (alto, ctx) => { const v = ctx && ctx.paredes; return v === 'baja' ? 0.12 : v === 'corte' ? Math.min(1.1, alto) : alto; };
const MPISO = new Map();
function matPiso(k) { const os = oscuro(), key = k + os; if (MPISO.has(key)) return MPISO.get(key); const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = azar(k.length * 97 + 5);
  x.fillStyle = ({ ceramica: os ? '#8d9296' : '#dfe2e3', porcelanato: os ? '#5d6368' : '#aeb3b6', madera: os ? '#6e5338' : '#b98f63', alfombra: os ? '#3f4852' : '#70808f', hormigon: os ? '#6c7073' : '#bfc2c3', goma: os ? '#23272b' : '#3d434a' })[k] || '#cfd2d3'; x.fillRect(0, 0, 256, 256);
  const raya = (x0, y0, x1, y1, c2) => { x.strokeStyle = c2; x.lineWidth = 2; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  if (k === 'madera') for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + R() * 0.07})`; x.fillRect(0, i * 32, 256, 32); raya(0, i * 32, 256, i * 32, 'rgba(0,0,0,.2)'); const j = Math.floor(R() * 256); raya(j, i * 32, j, i * 32 + 32, 'rgba(0,0,0,.2)'); }
  else if (k === 'ceramica' || k === 'porcelanato') { for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(255,255,255,${R() * 0.05})`; x.fillRect(R() * 256, R() * 256, 3, 3); } for (const q of [1, 128]) { raya(q, 0, q, 256, 'rgba(0,0,0,.15)'); raya(0, q, 256, q, 'rgba(0,0,0,.15)'); } }
  else for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.07})`; x.fillRect(R() * 256, R() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const m = { ceramica: 1.2, porcelanato: 1.2, madera: 1.6 }[k] || 2; t.repeat.set(1 / m, 1 / m);
  const M = new THREE.MeshStandardMaterial({ map: t, roughness: { ceramica: 0.35, porcelanato: 0.3, madera: 0.55 }[k] || 0.95, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -2 }); MPISO.set(key, M); return M; }
// un tramo de pared de a hasta b (metros del mundo) con sus aberturas; lo macizo se anota en segs: [x0, z0, x1, z1, medio grosor, y de abajo, y de arriba]
function tramoPared(g, a, b, o, hs, segs) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), t = o.tipo || 'maciza'; if (len < 0.05 || t === 'sin') return;
  const os = oscuro(), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, ang = Math.atan2(-dz, dx), y = o.y || 0, gr = t === 'vidrio' ? 0.07 : t === 'reja' ? 0.05 : o.grosor || 0.15, alto = t === 'media' ? Math.min(1.1, o.alto) : o.alto, real = t === 'media' ? Math.min(1.1, o.real || o.alto) : o.real || o.alto;
  const mP = mat(os ? mix(o.color, '#000', 0.38) : o.color, { roughness: 0.92 }), mM = mat('#2a2e33', { roughness: 0.5, metalness: 0.3 }), mV = mat(os ? '#a9c7d6' : '#d6e8f1', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.24, depthWrite: false });
  const mH = mat(os ? '#6b4e36' : '#9a7250', { roughness: 0.6 }), mR = mat('#5b656d', { roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.4, depthWrite: false });
  const seg = (s0, s1, y0, y1, m, gro = gr) => { if (s1 - s0 < 0.005 || y1 - y0 < 0.005) return; const k = new THREE.Mesh(CAJA, m); k.scale.set(s1 - s0, y1 - y0, gro); k.position.set(a[0] + dx * (s0 + s1) / 2, y + (y0 + y1) / 2, a[1] + dz * (s0 + s1) / 2); k.rotation.y = ang; k.castShadow = !m.transparent; k.receiveShadow = true; g.add(k); };
  const duro = (s0, s1, y0, y1) => { s0 = Math.max(0, s0); s1 = Math.min(len, s1); if (s1 - s0 > 0.02 && y1 - y0 > 0.3) segs.push([a[0] + dx * s0, a[1] + dz * s0, a[0] + dx * s1, a[1] + dz * s1, gr / 2, y + y0, y + y1]); };
  const lleno = (s0, s1) => { if (s1 - s0 < 0.01) return; duro(s0, s1, 0, real);
    if (t === 'vidrio') { seg(s0, s1, 0, 0.1, mM); seg(s0, s1, 0.1, alto - 0.06, mV, 0.03); seg(s0, s1, alto - 0.06, alto, mM); for (let q = Math.max(0, s0) + 1.2; q < s1 - 0.3; q += 1.2) seg(q - 0.02, q + 0.02, 0.1, alto - 0.06, mM); }
    else if (t === 'reja') { seg(s0, s1, 0.05, alto - 0.05, mR, 0.02); seg(s0, s1, alto - 0.05, alto, mM); const n = Math.max(1, Math.round((s1 - s0) / 2.5)); for (let i = 0; i <= n; i++) { const q = s0 + (s1 - s0) * i / n; seg(q - 0.03, q + 0.03, 0, alto, mM, 0.06); } }
    else seg(s0, s1, 0, alto, mP); };
  const A = (hs || []).map(h => ({ ...(ABERTURAS[h.k] || ABERTURAS.puerta), ...h })).map(h => { const w = Math.min(h.w, len - 0.2), a0 = Math.min(Math.max(0.1, h.a), len - 0.1 - w); return { ...h, w, a0, a1: a0 + w }; }).filter(h => h.w > 0.3).sort((m, n) => m.a0 - n.a0);
  let s = o.e0 ? -gr / 2 : 0; for (const h of A) { if (h.a0 < s) continue; lleno(s, h.a0); s = h.a1; const y0 = Math.min(h.y || 0, alto), top = Math.min((h.y || 0) + h.h, alto);
    if (y0 > 0) seg(h.a0, h.a1, 0, y0, mP); if (h.y) duro(h.a0, h.a1, 0, h.y); if (top < alto) seg(h.a0, h.a1, top, alto, t === 'vidrio' ? mV : mP, t === 'vidrio' ? 0.03 : gr);
    if (top - y0 < 0.4) continue;   // con las paredes al ras o cortadas por debajo no hay marco ni hoja
    for (const q of [h.a0, h.a1]) seg(q - 0.035, q + 0.035, y0, top, mM, gr + 0.03); seg(h.a0, h.a1, top - 0.05, top, mM, gr + 0.03);
    if (h.k === 'ventana') { seg(h.a0, h.a1, y0, y0 + 0.05, mM, gr + 0.07); seg(h.a0 + 0.035, h.a1 - 0.035, y0 + 0.05, top - 0.05, mV, 0.025); seg((h.a0 + h.a1) / 2 - 0.02, (h.a0 + h.a1) / 2 + 0.02, y0 + 0.05, top - 0.05, mM, 0.04); }
    else if (h.k === 'porton') seg(h.a0, h.a1, top - 0.4, top - 0.05, mat('#b9bec3', { metalness: 0.6, roughness: 0.4 }), gr + 0.14);   // cortina enrollada arriba: portón abierto
    else if (h.k !== 'paso') { const nx = -dz * (o.dentro || 1), nz = dx * (o.dentro || 1), c = Math.cos(1.25), sn = Math.sin(1.25);   // hojas abiertas hacia adentro del ambiente
      const hoja = (s0, w, sent) => { const ux = dx * sent * c + nx * sn, uz = dz * sent * c + nz * sn, k = new THREE.Mesh(CAJA, h.k === 'vidrio' ? mV : mH); k.scale.set(w, top - y0 - 0.07, 0.04);
        k.position.set(a[0] + dx * s0 + ux * w / 2, y + (y0 + top - 0.07) / 2 + 0.01, a[1] + dz * s0 + uz * w / 2); k.rotation.y = Math.atan2(-uz, ux); k.castShadow = h.k !== 'vidrio'; k.receiveShadow = true; g.add(k); };
      if (h.k === 'doble') { hoja(h.a0 + 0.04, h.w / 2 - 0.05, 1); hoja(h.a1 - 0.04, h.w / 2 - 0.05, -1); } else hoja(h.a0 + 0.04, h.w - 0.08, 1); } }
  lleno(s, len + (o.e1 ? gr / 2 : 0)); }

// ---------- zona: un velo tenue del color de la app que se puede tocar ----------
let MZONA = null, MZONA_K = ''; function matZona() { const k = acento() + oscuro(); if (MZONA && MZONA_K === k) return MZONA; MZONA_K = k;
  return MZONA = new THREE.MeshBasicMaterial({ color: acento(), transparent: true, opacity: oscuro() ? 0.08 : 0.1, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }); }

// ---------- plano del lugar: la imagen del plano (captura, foto o exportación del CAD) acostada en el piso, a escala ----------
// De noche se invierte el claro y el oscuro sin perder el color de lo marcado: líneas claras sobre fondo oscuro. Cada imagen se prepara una vez por tema.
const TEXP = new Map();
function texPlano(src, os, listo) { let e = TEXP.get(src); if (!e) TEXP.set(src, e = {}); if (e[os]) return e[os];
  const t = e[os] = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const im = new Image(); im.onload = () => { let f = im;
    if (os) { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) { const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2], k = 255 - 2 * L, cl = v => Math.max(0, Math.min(255, v + k)) * 0.72;
        a[i] = 19 + cl(a[i]); a[i + 1] = 21 + cl(a[i + 1]); a[i + 2] = 27 + cl(a[i + 2]); }
      x.putImageData(d, 0, 0); f = c; }
    t.image = f; t.needsUpdate = true; if (listo) listo(); };
  im.src = src; return t; }
// sin imagen todavía (la foto del catálogo): una hoja con grilla
const HOJA = {}; function hojaVacia(os) { if (HOJA[os]) return HOJA[os]; const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d');
  x.fillStyle = os ? '#15171c' : '#f6f7f9'; x.fillRect(0, 0, 512, 320); x.strokeStyle = os ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'; x.lineWidth = 2; for (let i = 32; i < 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 320); x.stroke(); } for (let i = 32; i < 320; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = os ? '#c9cdd6' : '#2b2e35'; x.lineWidth = 10; x.strokeRect(70, 60, 372, 200); x.lineWidth = 6; x.beginPath(); x.moveTo(250, 60); x.lineTo(250, 260); x.moveTo(250, 160); x.lineTo(442, 160); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return HOJA[os] = t; }

// ---------- puertas con control de acceso (Kliva) ----------
// La puerta dibujada como en un plano, pero en 3D: la hoja gira, el portón corre, el molinete gira y la barrera sube con el estado real de la puerta.
// En el piso, el giro punteado del color del estado, como en un plano de arquitectura. El lector tiene una luz: el color de la app en reposo,
// verde cuando alguien pasa, rojo si rechaza, ámbar si la puerta quedó abierta o la forzaron, gris si el equipo no responde.
// Lo que se mueve queda en g.userData.anima ({ o, eje, cerrado, abierto }) y lo que cambia de color en g.userData.luces: el motor lo anima sin rearmar.
export const ACCESOS = [['puerta', 'Puerta con lector'], ['doble', 'Puerta doble con lector'], ['vidrio', 'Puerta de vidrio con lector'], ['porton', 'Portón corredizo'], ['molinete', 'Molinete'], ['barrera', 'Barrera vehicular']];
export const ACC = { puerta: { w: 0.9, h: 2.1 }, doble: { w: 1.6, h: 2.1 }, vidrio: { w: 0.9, h: 2.1 }, porton: { w: 6, h: 2.2 }, molinete: { w: 0.62, h: 1 }, barrera: { w: 4.5, h: 1.05 } };
export const claseAcceso = n => /molinete|torniquete/i.test(n) ? 'molinete' : /barrera/i.test(n) ? 'barrera' : /port[oó]n/i.test(n) ? 'porton' : /doble/i.test(n) ? 'doble' : 'puerta';
// color de cada estado: luz del lector y marcas del piso (de día un poco más oscuro, para leerse sobre un plano blanco)
export function colorAcceso(est) { const os = oscuro(); return { cerrada: acento(), abierta: os ? '#3ee08f' : '#0f9d58', pasa: os ? '#3ee08f' : '#0f9d58', rechazo: os ? '#ff6b61' : '#d93025', alerta: os ? '#ffbe3d' : '#c77700', caida: os ? '#7d8592' : '#8a919c', sin: os ? '#59606b' : '#a3a9b2' }[est] || acento(); }
// trazos punteados acostados en el piso a lo largo de una línea (el giro de la hoja, el recorrido del portón)
function punteado(pts, ancho, y, paso = 0.16, lleno = 0.09) { const v = [], ix = []; let resto = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-4) continue; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz * ancho / 2, nz = ux * ancho / 2;
    for (let s = resto; s < L; s += paso) { const e = Math.min(L, s + lleno), x0 = a[0] + ux * s, z0 = a[1] + uz * s, x1 = a[0] + ux * e, z1 = a[1] + uz * e, n = v.length / 3;
      v.push(x0 + nx, y, z0 + nz, x0 - nx, y, z0 - nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz); ix.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    resto = (paso - ((L - resto) % paso)) % paso; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(ix); return geo; }
const arco = (cx, cz, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cz - Math.sin(a) * r]; });
function armarAcceso(p, ctx) { const g = new THREE.Group(), os = oscuro(), c = ACC[p.clase] ? p.clase : 'puerta', A = ACC[c], w = Math.max(0.4, p.ancho || A.w), H = A.h, v = (ctx.vivo && ctx.vivo(p)) || { estado: 'cerrada' };
  const col = colorAcceso(v.estado), luz = () => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: 0.3 });
  const piso = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10 });
  const velo = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: os ? 0.16 : 0.12, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -9 });
  const marco = mat(os ? '#17191d' : '#2b2e35', { roughness: 0.4, metalness: 0.45 }), claro = mat(os ? '#5b606b' : '#e4e6ea', { roughness: 0.55 }), vidrio = mat(os ? '#a9c7d6' : '#d6e8f1', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false });
  const luces = [], gr = 0.15, alto = altoVista(c === 'porton' ? 2.5 : 2.6, ctx), muro = p.muro !== false && c !== 'barrera', pon = (geo, m) => { const k = new THREE.Mesh(geo, m); k.renderOrder = 2; g.add(k); return k; };
  // un lector: caja negra con su luz; de noche, con un halo chico
  const lector = (x, y, z, cara = 1) => { caja(g, x - 0.045, y - 0.07, z - 0.016, x + 0.045, y + 0.07, z + 0.016, negro()); const m = luz(); luces.push(m); malla(g, BOLA, m, x, y + 0.035, z + cara * 0.02, 0.026, 0.026, 0.026, false); if (os) luces.push(brillo(g, x, y + 0.035, z + cara * 0.06, 0.5, col, 0.55).material); };
  const pared = (x0, x1, m = mat(os ? '#5a5f68' : '#eceeef', { roughness: 0.92 }), a = alto) => { if (x1 - x0 > 0.02) caja(g, x0, 0, -gr / 2, x1, a, gr / 2, m); };
  const reja = mat('#5b656d', { roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false });
  if (c === 'puerta' || c === 'doble' || c === 'vidrio') {
    if (muro) { pared(-w / 2 - 1.2, -w / 2 - 0.03); pared(w / 2 + 0.03, w / 2 + 1.2); if (alto > H + 0.05) caja(g, -w / 2, H, -gr / 2, w / 2, alto, gr / 2, mat(os ? '#5a5f68' : '#eceeef', { roughness: 0.92 })); }
    if (alto > 0.6) { for (const x of [-w / 2, w / 2]) caja(g, x - 0.035, 0, -gr / 2 - 0.015, x + 0.035, H, gr / 2 + 0.015, marco); caja(g, -w / 2 - 0.035, H - 0.05, -gr / 2 - 0.015, w / 2 + 0.035, H + 0.02, gr / 2 + 0.015, marco); }
    const hojas = c === 'doble' ? [[-w / 2 + 0.035, 1, w / 2 - 0.05], [w / 2 - 0.035, -1, w / 2 - 0.05]] : [[-w / 2 + 0.035, 1, w - 0.07]], giro = [];
    for (const [hx, s, lw] of hojas) { const o = new THREE.Group(); o.position.set(hx, 0, 0); g.add(o); const hh = Math.min(H - 0.04, Math.max(0.12, alto - 0.02));
      if (c === 'vidrio') { caja(o, s > 0 ? 0 : -lw, 0.02, -0.02, s > 0 ? lw : 0, hh, 0.02, vidrio, false); caja(o, s > 0 ? 0 : -lw, 0.02, -0.025, s > 0 ? lw : 0, 0.12, 0.025, marco); caja(o, s > 0 ? 0 : -lw, hh - 0.06, -0.025, s > 0 ? lw : 0, hh, 0.025, marco); }
      else caja(o, s > 0 ? 0 : -lw, 0.02, -0.022, s > 0 ? lw : 0, hh, 0.022, claro);
      if (hh > 1.1) caja(o, s * (lw - 0.1) - 0.015, 0.98, -0.07, s * (lw - 0.1) + 0.015, 1.12, 0.07, marco);   // manija
      giro.push({ o, s, lw }); }
    // en el piso: el giro punteado de cada hoja y la zona de paso, como en el plano
    for (const { o, s, lw } of giro) { pon(punteado(arco(o.position.x, 0, lw, s > 0 ? 0 : Math.PI, s > 0 ? -1.4 : Math.PI + 1.4), 0.045, 0.05), piso);
      pon(new THREE.CircleGeometry(lw, 24, s > 0 ? 0 : Math.PI - 1.4, 1.4).rotateX(-Math.PI / 2).translate(o.position.x, 0.048, 0).scale(1, 1, -1), velo); }
    g.userData.anima = giro.map(({ o, s }) => ({ o, eje: 'ry', cerrado: 0, abierto: s * 1.35 }));
    const lx = w / 2 + 0.2; lector(lx, 1.15, gr / 2 + 0.02); if (p.lector === 'ambos') lector(lx, 1.15, -gr / 2 - 0.02, -1); }
  else if (c === 'porton') {
    // portón corredizo de reja: corre sobre su riel hacia la izquierda, por detrás del tramo de cerco
    if (muro) { const m = reja; caja(g, -w * 1.5 - 0.5, 0, -0.03, -w / 2 - 0.12, Math.min(alto, 2.3), 0.03, m); caja(g, w / 2 + 0.12, 0, -0.03, w / 2 + 1.4, Math.min(alto, 2.3), 0.03, m); for (const x of [-w * 1.5 - 0.5, -w / 2 - 0.12, w / 2 + 0.12, w / 2 + 1.4]) caja(g, x - 0.05, 0, -0.05, x + 0.05, Math.min(alto, 2.4), 0.05, marco); }
    const o = new THREE.Group(); g.add(o); const hp = Math.min(H, Math.max(0.2, alto - 0.05)), mm = mat(os ? '#3c414a' : '#4d545d', { roughness: 0.45, metalness: 0.6 });
    caja(o, -w / 2, 0.06, 0.07, w / 2, 0.14, 0.13, mm); caja(o, -w / 2, hp - 0.08, 0.07, w / 2, hp, 0.13, mm); for (let x = -w / 2; x <= w / 2 + 1e-3; x += 0.14) caja(o, x - 0.018, 0.06, 0.082, x + 0.018, hp, 0.118, mm, false);
    caja(g, w / 2 + 0.02, 0, 0.0, w / 2 + 0.16, Math.min(alto, 2.4), 0.2, marco);   // poste de llegada
    pon(punteado([[-w * 1.5, 0.1], [w / 2, 0.1]], 0.05, 0.05), piso); pon(new THREE.PlaneGeometry(w, 1.2).rotateX(-Math.PI / 2).translate(0, 0.048, 0.75), velo);
    g.userData.anima = [{ o, eje: 'x', cerrado: 0, abierto: -w * 0.97 }]; lector(w / 2 + 0.75, 1.15, 0.9); caja(g, w / 2 + 0.7, 0, 0.86, w / 2 + 0.8, 1.05, 0.94, marco); }
  else if (c === 'molinete') {
    // molinete de trípode: el gabinete a un lado, el rotor inclinado y tres brazos; cada pasada gira un tercio de vuelta
    const mm = mat(os ? '#8a919c' : '#c9ced4', { roughness: 0.3, metalness: 0.7 }), x0 = -w / 2;
    caja(g, x0 - 0.3, 0, -0.42, x0, 0.92, 0.42, mm); caja(g, x0 - 0.31, 0.92, -0.43, x0 + 0.01, 0.98, 0.43, marco);
    if (muro) { caja(g, w / 2, 0, -0.4, w / 2 + 0.05, 1.0, 0.4, vidrio, false); caja(g, w / 2, 0.98, -0.42, w / 2 + 0.06, 1.02, 0.42, marco); }
    const piv = new THREE.Group(), eje = new THREE.Vector3(1, -1, 0).normalize(); piv.position.set(x0 + 0.02, 0.86, 0); piv.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eje); g.add(piv);
    const rot = new THREE.Group(); piv.add(rot); malla(rot, CIL24, mm, 0, 0.02, 0, 0.14, 0.08, 0.14);
    const d0 = new THREE.Vector3(1, 0, 0).applyQuaternion(piv.quaternion.clone().invert()), t0 = Math.atan2(d0.z, d0.x), L = w - 0.04;
    for (let k = 0; k < 3; k++) { const t = t0 + k * 2 * Math.PI / 3, d = new THREE.Vector3(Math.cos(t) * Math.SQRT1_2, Math.SQRT1_2, Math.sin(t) * Math.SQRT1_2), b = new THREE.Mesh(CIL, mm);
      b.scale.set(0.035, L, 0.035); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); b.position.copy(d).multiplyScalar(L / 2); b.castShadow = true; rot.add(b); }
    for (const z of [-0.45, 0.45]) pon(punteado([[x0, z], [w / 2, z]], 0.045, 0.05), piso); pon(new THREE.PlaneGeometry(w, 0.9).rotateX(-Math.PI / 2).translate(0, 0.048, 0), velo);
    g.userData.anima = [{ o: rot, eje: 'ry', cerrado: 0, vuelta: 2 * Math.PI / 3 }]; const m = luz(); luces.push(m); caja(g, x0 - 0.26, 0.985, 0.12, x0 - 0.04, 0.995, 0.34, m); if (os) luces.push(brillo(g, x0 - 0.15, 1.05, 0.23, 0.6, col, 0.5).material); }
  else {
    // barrera vehicular: columna, brazo a rayas que sube y la línea de frenado punteada en el piso
    const amarillo = mat('#e6b422', { roughness: 0.5 }), rojo = mat('#d0342c', { roughness: 0.5 }), blanco2 = mat('#f4f5f7', { roughness: 0.5 });
    caja(g, -w / 2 - 0.42, 0, -0.18, -w / 2 - 0.06, 1.05, 0.18, amarillo); caja(g, -w / 2 - 0.44, 1.05, -0.2, -w / 2 - 0.04, 1.1, 0.2, marco);
    const o = new THREE.Group(); o.position.set(-w / 2 - 0.12, 0.95, 0); g.add(o); for (let x = 0, i = 0; x < w + 0.1; x += 0.5, i++) caja(o, x, -0.04, -0.035, Math.min(w + 0.1, x + 0.5), 0.04, 0.035, i % 2 ? blanco2 : rojo);
    caja(g, w / 2 + 0.15, 0, -0.04, w / 2 + 0.23, 0.82, 0.04, marco); caja(g, w / 2 + 0.08, 0.82, -0.06, w / 2 + 0.3, 0.86, 0.06, marco);   // horquilla de apoyo
    pon(punteado([[-w / 2, 0.7], [w / 2, 0.7]], 0.08, 0.05, 0.4, 0.22), piso); pon(new THREE.PlaneGeometry(w, 2.8).rotateX(-Math.PI / 2).translate(0, 0.048, 1.4), velo);
    g.userData.anima = [{ o, eje: 'rz', cerrado: 0, abierto: 1.42 }]; caja(g, -w / 2 - 0.75, 0, 1.9, -w / 2 - 0.6, 1.0, 2.05, marco); lector(-w / 2 - 0.675, 1.1, 2.07); }
  g.userData.luces = luces; g.userData.pisos = [piso, velo]; g.userData.sinAplanar = true; return g; }

// ---------- tipos ----------
export const TIPOS = {
  // terreno y caminos
  terreno: { n: 'Terreno', g: 'Terreno', forma: 'area', capa: 'base', def: { mat: 'tierra' },
    campos: [F.nombre, { k: 'mat', n: 'Superficie', t: 'sel', ops: [['tierra', 'Tierra o balasto'], ['ripio', 'Ripio'], ['hormigon', 'Hormigón'], ['asfalto', 'Asfalto'], ['pasto', 'Pasto'], ['pasto2', 'Pasto oscuro'], ['monte', 'Monte'], ['cultivo', 'Cultivo en hileras'], ['agua', 'Agua']] }],
    armar(p) { const g = new THREE.Group(), y = { agua: 0.012, pasto: 0.016, pasto2: 0.018, monte: 0.018, cultivo: 0.02, tierra: 0.026, ripio: 0.03, hormigon: 0.034, asfalto: 0.038 }[p.mat] ?? 0.026;
      let m; if (p.mat === 'cultivo') { const t = rayas(suelo('cultivo'), oscuro() ? '#1d2818' : '#8eaa72', 10).clone(); t.needsUpdate = true; t.repeat.set(1 / 20, 1 / 20); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); }
      else { const po = { polygonOffset: true, polygonOffsetFactor: -Math.round(y * 100), polygonOffsetUnits: -2 }; m = matSuelo(p.mat, po) || mat(suelo(p.mat), { roughness: p.mat === 'agua' ? 0.15 : 0.97, metalness: p.mat === 'agua' ? 0.1 : 0, ...po }); }
      const k = area(g, p.pts, y, m); if (k && p.mat === 'cultivo') { const uv = k.geometry.attributes.uv, pos = k.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i)); } return g; } },
  bosque: { n: 'Monte o arboleda', g: 'Vegetación', forma: 'area', capa: 'vegetacion', def: { densidad: 40, tipo: 'fronda' },
    campos: [F.nombre, { k: 'tipo', n: 'Árboles', t: 'sel', ops: [['fronda', 'Fronda'], ['pino', 'Pino'], ['mixto', 'Mixto']] }, { k: 'densidad', n: 'Árboles por hectárea', t: 'num', min: 5, max: 200, paso: 5 }],
    armar(p) { const g = new THREE.Group(); area(g, p.pts, 0.014, matSuelo('monte', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })); const xs = p.pts.map(q => q[0]), zs = p.pts.map(q => q[1]), R = azar(semilla(p)), dentro = (x, z) => { let c = false; for (let i = 0, j = p.pts.length - 1; i < p.pts.length; j = i++) { const a = p.pts[i], b = p.pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), n = Math.min(4000, Math.round((x1 - x0) * (z1 - z0) / 10000 * p.densidad)), pts = [];
      for (let i = 0; i < n * 1.6 && pts.length < n; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (dentro(x, z)) pts.push([x, z, R()]); }
      arbolado(g, pts.map(([x, z, k]) => [x, z, p.tipo === 'mixto' ? (k < 0.3 ? 'pino' : 'fronda') : p.tipo, 0.75 + k * 0.6])); return g; } },
  calle: { n: 'Calle o ruta', g: 'Terreno', forma: 'linea', capa: 'base', def: { ancho: 8, tipo: 'asfalto', linea: 'discontinua' },
    campos: [F.nombre, F.ancho('Ancho (m)', 2, 60), { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['asfalto', 'Asfalto'], ['ruta', 'Ruta (con banquinas)'], ['hormigon', 'Hormigón'], ['tierra', 'Tierra o balasto']] }, { k: 'linea', n: 'Línea del medio', t: 'sel', ops: [['discontinua', 'Discontinua'], ['continua', 'Continua'], ['no', 'Sin línea']] }],
    armar(p) { const g = new THREE.Group(), y = 0.05, c = { asfalto: oscuro() ? '#2b3036' : '#7d838a', ruta: oscuro() ? '#272c31' : '#73797f', hormigon: suelo('hormigon'), tierra: suelo('ripio') }[p.tipo] || '#7d838a';
      const tq = { asfalto: 'asfalto', ruta: 'asfalto', hormigon: 'hormigon', tierra: 'pedregullo' }[p.tipo] || 'asfalto', mt = METROS[tq], po = { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -4 };
      const mc0 = matTex(texSuelo(tq), oscuro() ? '#55595c' : (p.tipo === 'ruta' ? '#e4e6e8' : '#ffffff'), [p.ancho / mt, 1 / mt], po), mc = tq === 'pedregullo' ? mc0 : calmo(mc0, 0.38);
      g.add(sombra(new THREE.Mesh(cinta(p.pts, p.ancho, y), mc), false, true));
      const blanca = oscuro() ? new THREE.MeshBasicMaterial({ color: '#cfe9ff', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -6 }) : mat('#f4f6f7', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -6 });
      if (p.linea !== 'no' && p.tipo !== 'tierra') { if (p.linea === 'continua') g.add(new THREE.Mesh(cinta(p.pts, 0.15, y + 0.005), blanca)); else for (const [x, z, d] of aLoLargo(p.pts, 9)) { const k = new THREE.Mesh(CAJA, blanca); k.scale.set(0.15, 0.01, 4.2); k.position.set(x, y + 0.005, z); k.rotation.y = d; g.add(k); } }
      if (p.tipo === 'ruta') for (const s of [-1, 1]) { const off = offset(p.pts, s * (p.ancho / 2 - 0.6)); g.add(new THREE.Mesh(cinta(off, 0.18, y + 0.005), blanca)); } return g; } },
  rotonda: { n: 'Rotonda', g: 'Terreno', forma: 'punto', capa: 'base', def: { radio: 14, isla: 7 },
    campos: [F.nombre, { k: 'radio', n: 'Radio (m)', t: 'num', min: 4, max: 60, paso: 0.5 }, { k: 'isla', n: 'Isla verde (m)', t: 'num', min: 0, max: 50, paso: 0.5 }],
    armar(p) { const g = new THREE.Group(); const k = new THREE.Mesh(new THREE.CircleGeometry(p.radio, 48).rotateX(-Math.PI / 2), calmo(matTex(texSuelo('asfalto'), oscuro() ? '#55595c' : '#ffffff', [p.radio * 2 / METROS.asfalto, p.radio * 2 / METROS.asfalto], { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -5 }), 0.38)); k.position.y = 0.052; k.receiveShadow = true; g.add(k);
      // la isla va por encima de las calles que cruzan por el centro (más alta y dibujada adelante)
      if (p.isla > 0) { const ad = { polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -12 }, i = new THREE.Mesh(new THREE.CylinderGeometry(p.isla, p.isla + 0.2, 0.35, 48), matSuelo('pasto', ad, 0.5)); i.position.y = 0.175; g.add(sombra(i)); const b = new THREE.Mesh(new THREE.CylinderGeometry(p.isla + 0.32, p.isla + 0.36, 0.3, 48, 1, true), mat(oscuro() ? '#7c858d' : '#DAE1E6', { side: THREE.DoubleSide, ...ad })); b.position.y = 0.15; g.add(b); g.userData.segs = []; } return g; } },
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
  galpon: { n: 'Galpón', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, siempre: true, def: { ancho: 40, fondo: 25, alto: 9, color: '#e4e8eb', techo: '#c9ced2', abierto: false, portones: 2, estilo: 'chapa', andenes: 6, anexo: '', cubierta: 'claraboyas', desde: 1, placa: '#1F4D3A' },
    campos: [F.nombre, F.ancho('Largo (m)', 3, 600), F.fondo('Fondo (m)', 3, 300), F.alto('Alto (m)', 2.5, 30, 0.5), F.color('Color de paredes'), { k: 'techo', n: 'Color del techo', t: 'color' }, { k: 'estilo', n: 'Tipo', t: 'sel', ops: [['chapa', 'Galpón de chapa'], ['logistico', 'Nave con andenes']] }, { k: 'portones', n: 'Portones al frente (chapa)', t: 'num', min: 0, max: 60, paso: 1 }, { k: 'abierto', n: 'Frente abierto (tinglado)', t: 'bool' },
      { k: 'andenes', n: 'Andenes (nave)', t: 'num', min: 0, max: 80, paso: 1 }, { k: 'desde', n: 'Primer número de andén', t: 'num', min: 0, max: 999, paso: 1 }, { k: 'placa', n: 'Color de las chapas de número', t: 'color' },
      { k: 'libre', n: 'Sin inquilino (no recibe camiones)', t: 'bool' }, { k: 'anexo', n: 'Oficina al frente (nave)', t: 'sel', ops: [['', 'Sin oficina'], ['izq', 'A la izquierda'], ['der', 'A la derecha']] }, { k: 'cubierta', n: 'Techo (nave)', t: 'sel', ops: [['lisa', 'Liso'], ['claraboyas', 'Con claraboyas'], ['solar', 'Con paneles solares']] }, F.r],
    armar(p) { if (p.estilo === 'logistico') return naveLog(p); const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2, h = p.alto, ch = chapa(16, 'galpon'), pa = matTex(ch, oscuro() ? mix(p.color, '#000', 0.5) : p.color, [1, 1], { bumpMap: ch, bumpScale: 0.8, roughness: 0.6, metalness: 0.2 }), zo = mat(oscuro() ? '#4c5257' : '#aeb3b8'), e = 0.25;
      cajaT(g, -w, 0, -d, w, h, -d + e, pa, 4); cajaT(g, -w, 0, -d, -w + e, h, d, pa, 4); cajaT(g, w - e, 0, -d, w, h, d, pa, 4);
      if (p.abierto) { const n = Math.max(2, Math.round(p.ancho / 8)); for (let i = 0; i <= n; i++) caja(g, -w + i * (p.ancho - 0.4) / n, 0, d - 0.4, -w + i * (p.ancho - 0.4) / n + 0.4, h, d, pa); }
      else { cajaT(g, -w, 0, d - e, w, h, d, pa, 4); const n = p.portones | 0; for (let i = 0; i < n; i++) { const x = -w + (i + 0.5) * p.ancho / n, pw = Math.min(4.2, p.ancho / n * 0.7); caja(g, x - pw / 2, 0, d, x + pw / 2, Math.min(h - 1, 4.8), d + 0.06, mat(oscuro() ? '#5f666c' : '#d7dbde', { roughness: 0.5 })); } }
      for (const [x0, z0, x1, z1] of [[-w, -d, w, -d + e], [-w, d - e, w, d], [-w, -d, -w + e, d], [w - e, -d, w, d]]) caja(g, x0 - 0.02, 0, z0 - 0.02, x1 + 0.02, 1.1, z1 + 0.02, zo);
      const t = cajaT(g, -w - 0.3, h, -d - 0.3, w + 0.3, h + 0.35, d + 0.3, matTex(ch, oscuro() ? mix(p.techo, '#000', 0.55) : p.techo, [1, 1], { bumpMap: ch, bumpScale: 0.8, roughness: 0.5, metalness: 0.3 }), 4); t.userData.techo = true;
      caja(g, -w - 0.32, h + 0.35, -d - 0.32, w + 0.32, h + 0.6, -d + 0.1, mat(oscuro() ? '#2a3036' : '#59616a')); caja(g, -w - 0.32, h + 0.35, d - 0.1, w + 0.32, h + 0.6, d + 0.32, mat(oscuro() ? '#2a3036' : '#59616a'));
      // de noche: tira de luz en el color de la app bajo el alero y luz sobre los portones
      if (oscuro()) { const nm = neon(acento()); for (const [x0, z0, x1, z1] of [[-w, -d - 0.05, w, -d], [-w, d, w, d + 0.05], [-w - 0.05, -d, -w, d], [w, -d, w + 0.05, d]]) caja(g, x0, h - 0.5, z0, x1, h - 0.38, z1, nm, false);
        if (!p.abierto) { const n = p.portones | 0; for (let i = 0; i < n; i++) { const x = -w + (i + 0.5) * p.ancho / n; brillo(g, x, Math.min(h - 0.6, 5.4), d + 0.5, 4, '#ffe2b0', 0.8); pozo(g, x, d + 5, 6, '#ffcf8a', 0.28); } } }
      return g; } },
  modulo: { n: 'Oficina o módulo', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { ancho: 12, fondo: 6, pisos: 1, color: '#f5f6f7', ventanas: true },
    campos: [F.nombre, F.ancho('Largo (m)', 1, 120), F.fondo('Fondo (m)', 1, 60), { k: 'pisos', n: 'Pisos', t: 'num', min: 1, max: 12, paso: 1 }, F.color('Color'), { k: 'ventanas', n: 'Ventanas', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2, H = 3.1 * p.pisos; caja(g, -w, 0, -d, w, H, d, mat(oscuro() ? mix(p.color, '#000', 0.35) : p.color, { roughness: 0.6 }));
      if (p.ventanas) { const vm = mat(oscuro() ? '#cfeeff' : '#2c3e4f', { roughness: 0.08, metalness: 0.6, emissive: oscuro() ? '#bfe6ff' : '#000000', emissiveIntensity: oscuro() ? 1.4 : 0 });
        for (let f = 0; f < p.pisos; f++) { const y = f * 3.1 + 1.0; caja(g, -w + 0.6, y, d, w - 0.6, y + 1.3, d + 0.04, vm, false); caja(g, -w + 0.6, y, -d - 0.04, w - 0.6, y + 1.3, -d, vm, false); } }
      caja(g, -w - 0.15, H, -d - 0.15, w + 0.15, H + 0.3, d + 0.15, mat(oscuro() ? '#555b61' : '#c9ced2')); return g; } },
  // edificio de oficinas que se camina por dentro: planta baja y altas, escalera, puerta, ventanales y franjas.
  // Cada nivel va aparte (userData.nivel) para esconder lo de arriba cuando uno camina adentro; las paredes chocan una por una;
  // los pisos y la escalera se pisan (userData.suelos, en metros del edificio). Por dentro queda vacío: las habitaciones se arman después.
  edificio: { n: 'Edificio de oficinas (por dentro)', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { ancho: 36, fondo: 30, pisos: 2, altoPiso: 3.6, color: '#2D3033', franjas: '#F2F3F4', ventanas: true, corte: false },
    campos: [F.nombre, F.ancho('Largo (m)', 6, 200), F.fondo('Fondo (m)', 6, 120), { k: 'pisos', n: 'Pisos', t: 'num', min: 1, max: 6, paso: 1 }, { k: 'altoPiso', n: 'Alto de cada piso (m)', t: 'num', min: 2.6, max: 6, paso: 0.1 }, F.color('Color de la fachada'), { k: 'franjas', n: 'Color de las franjas', t: 'color' }, { k: 'ventanas', n: 'Ventanales', t: 'bool' }, { k: 'corte', n: 'Ver por dentro (sin techo ni pisos de arriba)', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(); g.userData.sinAplanar = true; const w = p.ancho / 2, d = p.fondo / 2, hp = p.altoPiso, N = Math.max(1, Math.round(p.pisos)), t = 0.25, os = oscuro();
      const mFach = mat(os ? mix(p.color, '#000', 0.2) : p.color, { roughness: 0.7 }), mFr = mat(os ? mix(p.franjas, '#000', 0.35) : p.franjas, { roughness: 0.6 }), mIn = mat(os ? '#8d939a' : '#eceeef', { roughness: 0.9 });
      const mVid = mat(os ? '#9fd3f0' : '#3b5566', { roughness: 0.06, metalness: 0.5, transparent: true, opacity: 0.55, emissive: os ? '#bfe6ff' : '#000000', emissiveIntensity: os ? 0.5 : 0 });
      const mPiso = mat(os ? '#9aa0a6' : '#d9dcde', { roughness: 0.55 }), mLosa = mat(os ? '#6b7177' : '#bfc4c8', { roughness: 0.8 }), mEsc = mat(os ? '#7d848a' : '#c6cacd', { roughness: 0.7 }), mBar = mat('#454b51', { roughness: 0.4, metalness: 0.5 });
      const nv = (k, m) => { m.userData.nivel = k; return m; }, sc = m => { m.userData.noChoca = true; return m; };
      if (p.plano && p.plano.muros) return armarPlano(g, p, { mFach, mFr, mIn, mVid, mPiso, mLosa, mEsc, mBar }, nv, sc);
      // escalera: va contra la pared de atrás; las de pisos pares suben hacia la izquierda y las impares hacia la derecha (en zigzag), con descanso de 1,5 m
      const nEsc = Math.ceil(hp / 0.18), hue = 0.28, run = nEsc * hue, an = 1.3, xs1 = w - t - 1.5, xs0 = xs1 - run, suelos = [];
      const lane = k => { const z0 = -d + t + (k % 2) * (an + 0.1); return [z0, z0 + an]; };
      suelos.push({ x0: -w + t, z0: -d + t, x1: w - t, z1: d - t, y: 0 });
      nv(0, caja(g, -w + t, 0, -d + t, w - t, 0.07, d - t, mat('#' + mPiso.color.getHexString(), { roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
      for (let k = 0; k < N; k++) { const yb = k * hp, ar = k > 0;
        // losa del piso k (con el hueco de la escalera que llega desde abajo) y su borde visto desde afuera
        if (ar) { const [hz0, hz1] = lane(k - 1), Lm = mLosa; nv(k, caja(g, -w + t, yb - 0.3, -d + t, xs0, yb + 0.03, d - t, Lm)); nv(k, caja(g, xs1, yb - 0.3, -d + t, w - t, yb + 0.03, d - t, Lm));
          nv(k, caja(g, xs0, yb - 0.3, hz1, xs1, yb + 0.03, d - t, Lm)); if (hz0 > -d + t + 0.01) nv(k, caja(g, xs0, yb - 0.3, -d + t, xs1, yb + 0.03, hz0, Lm));
          suelos.push({ x0: -w + t, z0: -d + t, x1: w - t, z1: d - t, y: yb, hueco: [xs0, hz0, xs1, hz1] });
          // baranda alrededor del hueco (del lado de la sala y en la punta de abajo de la escalera)
          nv(k, caja(g, xs0, yb, hz1, xs1, yb + 1.0, hz1 + 0.05, mBar, false)); const xe = (k - 1) % 2 ? xs0 - 0.05 : xs1; nv(k, caja(g, xe, yb, hz0, xe + 0.05, yb + 1.0, hz1, mBar, false)); }
        // paredes: zócalo de fachada, ventanal y franja clara a la altura de la losa. Al frente de la planta baja va la puerta (2 m)
        const pared = (x0, z0, x1, z1, eje, conPuerta) => { const tramos = conPuerta ? [[eje === 'x' ? x0 : z0, -1], [1, eje === 'x' ? x1 : z1]] : [[eje === 'x' ? x0 : z0, eje === 'x' ? x1 : z1]];
          const box = (a, b, y0, y1, m, s2 = true) => nv(k, eje === 'x' ? caja(g, a, y0, z0, b, y1, z1, m, s2) : caja(g, x0, y0, a, x1, y1, b, m, s2));
          for (const [a, b] of tramos) { if (b - a < 0.05) continue; if (p.ventanas) { box(a, b, yb, yb + 0.9, mFach); box(a, b, yb + 0.9, yb + hp - 0.55, mVid, false); for (let q = a + 1.5; q < b - 0.2; q += 1.5) sc(box(q - 0.05, q + 0.05, yb + 0.9, yb + hp - 0.55, mFach)); } else box(a, b, yb, yb + hp - 0.55, mFach);
            box(a, b, yb + hp - 0.55, yb + hp, mFr); }
          if (conPuerta) { box(-1, 1, yb + 2.3, yb + hp - 0.55, mFach); sc(box(-1.08, -1, yb, yb + 2.3, mBar)); sc(box(1, 1.08, yb, yb + 2.3, mBar)); } };
        pared(-w, d - t, w, d, 'x', k === 0); pared(-w, -d, w, -d + t, 'x', false); pared(-w, -d + t, -w + t, d - t, 'z', false); pared(w - t, -d + t, w, d - t, 'z', false);
        // cara de adentro de las paredes (clara) para que las salas no queden oscuras
        sc(nv(k, caja(g, -w + t, yb + 0.03, -d + t, -w + t + 0.02, yb + 0.9, d - t, mIn, false))); sc(nv(k, caja(g, w - t - 0.02, yb + 0.03, -d + t, w - t, yb + 0.9, d - t, mIn, false)));
        // escalera al piso de arriba (escalones macizos: se pisan, no chocan)
        if (k < N - 1) { const [z0, z1] = lane(k), sube = k % 2 ? 1 : -1, xa = sube < 0 ? xs1 : xs0, it = [];
          for (let i = 0; i < nEsc; i++) { const xc = xa + sube * (i + 0.5) * hue, ytop = (i + 1) * hp / nEsc; it.push([xc, yb + ytop / 2, (z0 + z1) / 2, 0, hue, ytop, an]); }
          const L = lote(g, CAJA, mEsc, it); if (L) { L.userData.noChoca = true; L.userData.nivel = k; }
          suelos.push({ rampa: true, x0: xs0, x1: xs1, z0, z1, xa, xb: xa + sube * run, y0: yb, y1: yb + hp });
          // costado de la escalera del lado de la sala (deja entrar por abajo) y tope en la punta alta, a nivel del piso
          const pie = 1.0; nv(k, sube < 0 ? caja(g, xs0, yb, z1, xs1 - pie, yb + 1.0, z1 + 0.05, mBar, false) : caja(g, xs0 + pie, yb, z1, xs1, yb + 1.0, z1 + 0.05, mBar, false));
          const xt = sube < 0 ? xs0 - 0.05 : xs1; nv(k, caja(g, xt, yb, z0, xt + 0.05, yb + 2.0, z1, mEsc, false)); } }
      // techo con pretil y equipos de aire
      const H = N * hp; nv(N, caja(g, -w, H - 0.3, -d, w, H + 0.05, d, mLosa)); for (const [a, b, c, e] of [[-w, -d, w, -d + 0.2], [-w, d - 0.2, w, d], [-w, -d, -w + 0.2, d], [w - 0.2, -d, w, d]]) nv(N, caja(g, a, H, b, c, H + 0.8, e, mFr));
      nv(N, caja(g, -w * 0.4, H, -d * 0.3, -w * 0.4 + 3, H + 1.4, -d * 0.3 + 2, mat('#c9ced2', { roughness: 0.5 }))); nv(N, caja(g, w * 0.3, H, -d * 0.2, w * 0.3 + 3, H + 1.4, -d * 0.2 + 2, mat('#c9ced2', { roughness: 0.5 })));
      if (p.corte) g.traverse(m => { if (m.isMesh && m.userData.nivel > 0) m.visible = false; });
      g.userData.suelos = suelos; g.userData.altoPiso = hp; g.userData.pisos = N; return g; } },
  // pared suelta (uno o más tramos seguidos) y recinto (habitación: piso con sus paredes alrededor). Cada pared se edita por separado:
  // tipo, color y aberturas (puertas, ventanas, pasos, portones). Lo que no se atraviesa va en userData.segs (tramos macizos), no en cajas.
  pared: { n: 'Pared', g: 'Construcción', forma: 'linea', capa: 'base', herramienta: 'pared', def: { alto: 2.6, grosor: 0.15, tipo: 'maciza', color: '#eceeef' },
    campos: [F.nombre, F.alto('Alto (m)', 0.3, 12), { k: 'grosor', n: 'Grosor (m)', t: 'num', min: 0.05, max: 0.6, paso: 0.05 }, { k: 'tipo', n: 'Tipo de pared', t: 'sel', ops: PAREDES.slice(0, 4) }, F.color('Color')],
    armar(p, ctx) { const g = new THREE.Group(), segs = [], P = p.pts, alto = altoVista(p.alto, ctx);
      for (let i = 0; i < P.length - 1; i++) { const L = (p.lados || {})[i] || {}; tramoPared(g, P[i], P[i + 1], { y: p.y || 0, alto, real: p.alto, grosor: p.grosor, tipo: L.tipo || p.tipo, color: L.color || p.color, dentro: 1, e0: i > 0, e1: i < P.length - 2 }, (p.huecos || []).filter(h => h.s === i), segs); }
      g.userData.segs = segs; return g; } },
  recinto: { n: 'Recinto (habitación)', g: 'Construcción', forma: 'area', capa: 'base', herramienta: 'recinto', etiqueta: p => p.nombre, def: { alto: 2.6, grosor: 0.15, tipo: 'maciza', color: '#eceeef', piso: 'ceramica' },
    campos: [F.nombre, F.alto('Alto de las paredes (m)', 0.3, 12), { k: 'grosor', n: 'Grosor (m)', t: 'num', min: 0.05, max: 0.6, paso: 0.05 }, { k: 'tipo', n: 'Paredes', t: 'sel', ops: PAREDES }, F.color('Color de las paredes'), { k: 'piso', n: 'Piso', t: 'sel', ops: PISOS }],
    armar(p, ctx) { const g = new THREE.Group(), segs = [], P = p.pts, n = P.length; if (n < 3) return g; const y = p.y || 0, alto = altoVista(p.alto, ctx), dentro = areaSig(P) > 0 ? 1 : -1;
      if (p.piso !== 'sin') area(g, P, y + 0.045, matPiso(p.piso));
      else if (p.tipo === 'sin') area(g, P, y + 0.05, matZona());   // zona: sin paredes ni piso, nombra un sector (por ejemplo, sobre el plano del lugar)
      for (let i = 0; i < n; i++) { const L = (p.lados || {})[i] || {}; tramoPared(g, P[i], P[(i + 1) % n], { y, alto, real: p.alto, grosor: p.grosor, tipo: L.tipo || p.tipo, color: L.color || p.color, dentro, e0: true, e1: true }, (p.huecos || []).filter(h => h.s === i), segs); }
      g.userData.segs = segs; return g; } },
  tanque: { n: 'Tanque o silo', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { radio: 6, alto: 10, color: '#d9dde0' },
    campos: [F.nombre, { k: 'radio', n: 'Radio (m)', t: 'num', min: 0.5, max: 60, paso: 0.5 }, F.alto('Alto (m)', 1, 60, 0.5), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), m = mat(oscuro() ? mix(p.color, '#000', 0.4) : p.color, { roughness: 0.5, metalness: 0.35 }), cono = Math.max(0.4, p.radio * 0.22); malla(g, CIL24, m, 0, p.alto / 2, 0, p.radio * 2, p.alto, p.radio * 2);
      const t = new THREE.Mesh(new THREE.ConeGeometry(p.radio * 1.02, cono, 24), m); t.position.y = p.alto + cono / 2; g.add(sombra(t)); for (const y of [p.alto * 0.33, p.alto * 0.66]) malla(g, CIL24, mat('#9aa3ab', { roughness: 0.5, metalness: 0.5 }), 0, y, 0, p.radio * 2.03, 0.12, p.radio * 2.03, false); return g; } },
  // cinta transportadora, rampa y escalera de exterior (las tres suben hacia +x)
  cinta: { n: 'Cinta transportadora', g: 'Logística', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { largo: 40, alto: 8, ancho: 1.4 },
    campos: [F.nombre, { k: 'largo', n: 'Largo (m)', t: 'num', min: 4, max: 400, paso: 1 }, F.alto('Altura de la punta (m)', 1, 40, 0.5), F.ancho('Ancho (m)', 0.6, 4), F.r],
    armar(p) { const g = new THREE.Group(), L = p.largo, h = Math.max(1, p.alto), a = Math.atan2(h - 1, L), os = oscuro(), k = new THREE.Mesh(CAJA, mat(os ? '#3a444d' : '#59636C', { roughness: 0.6, metalness: 0.3 })); k.scale.set(Math.hypot(L, h - 1), 0.5, p.ancho); k.position.set(0, (1 + h) / 2, 0); k.rotation.z = a; g.add(sombra(k));
      const go = new THREE.Mesh(CAJA, mat('#1e2226', { roughness: 0.9 })); go.scale.set(Math.hypot(L, h - 1) - 0.4, 0.08, p.ancho - 0.3); go.position.set(0, (1 + h) / 2 + 0.27, 0); go.rotation.z = a; g.add(sombra(go, false));
      const po = mat(os ? '#83909A' : '#B6BFC7', { metalness: 0.4, roughness: 0.5 }); for (let x = -L / 2 + 2; x < L / 2; x += 10) { const yy = 1 + (h - 1) * (x + L / 2) / L - 0.25; for (const z of [-p.ancho / 2 + 0.2, p.ancho / 2 - 0.2]) caja(g, x - 0.14, 0, z - 0.12, x + 0.14, yy, z + 0.12, po); } return g; } },
  rampa: { n: 'Rampa', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 4.2, largo: 10, alto: 1.2 },
    campos: [F.nombre, F.ancho('Ancho (m)', 1, 30), { k: 'largo', n: 'Largo (m)', t: 'num', min: 1, max: 80, paso: 0.5 }, F.alto('Altura (m)', 0.2, 8, 0.1), F.r],
    armar(p) { const g = new THREE.Group(), L = p.largo / 2, sh = new THREE.Shape(); sh.moveTo(-L, 0); sh.lineTo(L, 0); sh.lineTo(L, p.alto); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: p.ancho, bevelEnabled: false }); geo.translate(0, 0, -p.ancho / 2);
      const k = new THREE.Mesh(geo, mat(oscuro() ? '#4a5258' : '#c2c8cd', { roughness: 0.95 })); k.userData.noChoca = true; g.add(sombra(k)); const am = mat('#F2C230'); for (const z of [-p.ancho / 2, p.ancho / 2 - 0.12]) { const b = new THREE.Mesh(CAJA, am); b.scale.set(Math.hypot(p.largo, p.alto), 0.1, 0.12); b.position.set(0, p.alto / 2 + 0.06, z + 0.06); b.rotation.z = Math.atan2(p.alto, p.largo); b.userData.noChoca = true; g.add(sombra(b, false)); } g.userData.segs = []; return g; } },
  escalera: { n: 'Escalera de exterior', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 3.6, ancho: 1.1 },
    campos: [F.nombre, F.alto('Altura (m)', 0.5, 20, 0.1), F.ancho('Ancho (m)', 0.7, 4), F.r],
    armar(p) { const g = new THREE.Group(), h = p.alto, w = p.ancho / 2, run = h * 1.55, n = Math.max(2, Math.round(h / 0.18)), rs = h / n, tr = run / n, ac = mat(oscuro() ? '#7c868e' : '#A9B3BA', { metalness: 0.5, roughness: 0.5 }), na = mat('#E8641E', { roughness: 0.6 }), ang = Math.atan2(h, run), lar = Math.hypot(h, run);
      for (let i = 0; i < n; i++) { const x = -run / 2 + i * tr; caja(g, x, (i + 1) * rs - 0.04, -w + 0.04, x + tr + 0.02, (i + 1) * rs, w - 0.04, ac, false); }
      for (const z of [-w, w]) { const v = new THREE.Mesh(CAJA, ac); v.scale.set(lar, 0.22, 0.06); v.position.set(0, h / 2 - 0.05, z); v.rotation.z = ang; g.add(sombra(v)); const b = new THREE.Mesh(CAJA, na); b.scale.set(lar, 0.05, 0.05); b.position.set(0, h / 2 + 0.95, z); b.rotation.z = ang; g.add(sombra(b, false));
        for (let i = 0; i <= n; i += Math.max(1, Math.round(n / 5))) { const x = -run / 2 + i * tr, y = i * rs; caja(g, x - 0.025, y, z - 0.025, x + 0.025, y + 1.0, z + 0.025, na, false); } }
      caja(g, run / 2, h - 0.06, -w, run / 2 + 1.2, h, w, ac, false); caja(g, run / 2 + 0.9, 0, -w, run / 2 + 1.0, h - 0.06, -w + 0.1, ac); caja(g, run / 2 + 0.9, 0, w - 0.1, run / 2 + 1.0, h - 0.06, w, ac); g.traverse(m => { m.userData.noChoca = true; }); g.userData.segs = []; return g; } },

  alero: { n: 'Alero o techado', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 12, fondo: 14, alto: 4.6, color: '#e9ecee' },
    campos: [F.nombre, F.ancho('Ancho (m)', 2, 120), F.fondo('Largo (m)', 2, 120), F.alto('Alto libre (m)', 2.2, 15), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2; caja(g, -w, p.alto, -d, w, p.alto + 0.28, d, mat(p.color, { roughness: 0.5, metalness: 0.2 })); const c = mat('#8c949b', { metalness: 0.5, roughness: 0.4 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) caja(g, sx * (w - 0.3) - 0.18, 0, sz * (d - 0.3) - 0.18, sx * (w - 0.3) + 0.18, p.alto, sz * (d - 0.3) + 0.18, c); return g; } },
  columna: { n: 'Columna de luz', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 25, focos: 3 },
    campos: [F.nombre, F.alto('Alto (m)', 4, 45, 0.5), { k: 'focos', n: 'Focos', t: 'num', min: 1, max: 12, paso: 1 }, F.r],
    armar(p) { const g = new THREE.Group(), H = p.alto, gris = mat(oscuro() ? '#7b838a' : '#a4acb3', { metalness: 0.5, roughness: 0.45 }); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, H, 10), gris); k.position.y = H / 2; g.add(sombra(k));
      const n = p.focos | 0, w = Math.max(1.2, n * 0.75); caja(g, -w / 2, H, -0.12, w / 2, H + 0.25, 0.12, gris); const lm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1cc', emissiveIntensity: oscuro() ? 2.5 : 0.25 });
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; caja(g, x - 0.28, H - 0.3, 0.05, x + 0.28, H, 0.6, lm, false); if (oscuro()) brillo(g, x, H - 0.4, 0.4, 7, '#ffe2b0', 0.85); }
      if (oscuro()) pozo(g, 0, 6, H * 1.05, '#ffcf8a', 0.3); return g; } },
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
    campos: [F.nombre, { k: 'naviera', n: 'Naviera', t: 'txt' }, { k: 'largo', n: 'Largo (m)', t: 'num', min: 6, max: 600, paso: 0.5 }, { k: 'ancho', n: 'Ancho (contenedores)', t: 'num', min: 1, max: 20, paso: 1 }, { k: 'orient', n: 'Contenedores', t: 'sel', ops: [['largo', 'A lo largo de la fila'], ['trans', 'Atravesados (uno al lado del otro)']] }, { k: 'bloque', n: 'Bloques de (0 = seguido)', t: 'num', min: 0, max: 30, paso: 1 }, { k: 'alto', n: 'Alto máximo (contenedores)', t: 'num', min: 1, max: 9, paso: 1 },
      { k: 'pies', n: 'Contenedores de', t: 'sel', ops: [[40, '40 pies'], [20, '20 pies']] }, { k: 'carga', n: 'Tipo', t: 'sel', ops: [['seco', 'Secos'], ['reefer', 'Refrigerados (reefer)']] }, { k: 'color', n: 'Color de la naviera', t: 'color' },
      { k: 'ocupacion', n: 'Ocupación (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'mezcla', n: 'Otras navieras mezcladas (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'semilla', n: 'Variante', t: 'num', min: 0, max: 999, paso: 1 }, F.r],
    armar(p) { const g = new THREE.Group(), L = +p.pies === 20 ? 6.06 : 12.19, tr = p.orient === 'trans', pitch = tr ? 2.74 : L + 0.34, paso = tr ? L + 0.34 : 2.74, ns = Math.max(1, Math.floor(p.largo / pitch)), nr = p.ancho | 0, R = azar(semilla(p)), rf = p.carga === 'reefer', its = [], celdas = [], som = [];
      const x0 = -ns * pitch / 2, z0 = -(nr - 1) * paso / 2, H = 2.59, occ = (p.ocupacion ?? 75) / 100;
      const blq = p.bloque | 0; for (let s = 0; s < ns; s++) for (let r = 0; r < nr; r++) { if (blq && s % (blq + 1) === blq) continue; const borde = tr && nr <= 2 ? R() < 0.25 : r === 0 || r === nr - 1, lleno = R() < Math.min(1, occ * (borde ? 0.9 : 1.15)); if (!lleno) continue;
        const h = Math.max(1, Math.min(p.alto, Math.round((borde ? 0.45 : 0.62) * p.alto + (R() - 0.35) * p.alto * 0.7 * occ + occ * 1.2))); som.push([x0 + (s + 0.5) * pitch, z0 + r * paso]);
        for (let t = 0; t < h; t++) { let c = rf ? (R() < 0.5 ? '#e9edf0' : '#dfe4e8') : R() * 100 < (p.mezcla ?? 12) ? MEZCLA[Math.floor(R() * MEZCLA.length)] : p.color; _c.set(c).offsetHSL(0, rf ? 0 : -0.04 - R() * 0.1, (R() - 0.5) * 0.08);
          its.push([x0 + (s + 0.5) * pitch, t * H + H / 2, z0 + r * paso, tr ? Math.PI / 2 : 0, L * 0.985, H * 0.985, 2.44 * 0.985, '#' + _c.getHexString()]); celdas.push([s, r, t]); } }
      const im = lote(g, CONT, matsCont(+p.pies === 20 ? 22 : 44, rf), its); if (im) im.userData.celdas = celdas; if (som.length) g.add(sombraPie(som, tr ? 3.3 : L + 1.3, tr ? L + 1.3 : 3.3));
      if (oscuro()) { const a = acento(), X = -x0 + 0.6, Z = -z0 + (tr ? L / 2 + 0.6 : 2); for (const [u0, v0, u1, v1] of [[-X, -Z, X, -Z], [-X, Z, X, Z], [-X, -Z, -X, Z], [X, -Z, X, Z]]) { const k = new THREE.Mesh(CAJA, neon(a)); k.position.set((u0 + u1) / 2, 0.16, (v0 + v1) / 2); k.scale.set(Math.abs(u1 - u0) + 0.3, 0.08, Math.abs(v1 - v0) + 0.22); g.add(k);
          const b = new THREE.Mesh(CAJA, neon(a, 0.16)); b.position.copy(k.position); b.scale.set(Math.abs(u1 - u0) + 1.6, 0.04, Math.abs(v1 - v0) + 1.6); b.renderOrder = 2; g.add(b); } }
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
    campos: [F.nombre, { k: 'modelo', n: 'Cómo es', t: 'sel', ops: [['tec-h-epp', 'Técnico con casco y chaleco'], ['tec-h', 'Técnico'], ['of-h', 'Oficina (hombre)'], ['of-h2', 'Oficina (hombre con suéter)'], ['of-m', 'Oficina (mujer)'], ['of-m2', 'Oficina (mujer con suéter)']] }, F.r],
    armar(p, ctx) { const g = new THREE.Group(); cil(g, 0, 0, 0, 0.22, 1.45, mat('#3b5b7a')); const k = new THREE.Mesh(BOLA, mat('#e0b493')); k.scale.setScalar(0.26); k.position.y = 1.62; g.add(sombra(k)); ctx && ctx.glb && ctx.glb('avatares', p.modelo, g, null, p.id); return g; } },

  // equipos (Ondi). y = altura de montaje; uid = vínculo con el equipo real de la app (UniFi, Meraki o cargado a mano)
  camara: { n: 'Cámara', g: 'Equipos', forma: 'punto', capa: 'equipos', equipo: 'cam', ondi: 'camara', etiqueta: p => p.nombre, def: { y: 6, alcance: 25, clase: 'bullet' },
    campos: [...EQ_CAMPOS.slice(0, 1), { k: 'clase', n: 'Modelo de cámara', t: 'sel', ops: CAMARAS }, ...EQ_CAMPOS.slice(1, 7), MONT, BASE, { k: 'inclina', n: 'Inclinación (°)', t: 'num', min: 0, max: 80, paso: 1 }, { k: 'alcance', n: 'Alcance (m)', t: 'num', min: 0, max: 200, paso: 1 }, { k: 'apertura', n: 'Apertura (°)', t: 'num', min: 10, max: 360, paso: 5 }, EQ_CAMPOS[7]],
    variantes: CAMARAS.map(([clase, n]) => ({ n: 'Cámara ' + n.replace(/ \(.*/, '').toLowerCase().replace('ptz', 'PTZ'), o: { clase } })),
    armar: equipo((g, p, ec, mont) => { const c = p.clase || 'bullet'; if (c === 'domo' || c === 'ptz') camDomo(g, p, ec, mont, c === 'ptz'); else if (c === 'ojo') camOjo(g, p, ec, mont); else camBullet(g, p, ec, mont); campoVision(g, p, ec); }) },
  ap: { n: 'Wi-Fi (punto de acceso)', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'ap', equipo: 'ap', etiqueta: p => p.nombre, def: { y: 8 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec, mont) => { const k = new THREE.Group(); g.add(k); if (mont !== 'techo') { k.rotation.x = Math.PI / 2; k.position.z = mont === 'pared' ? 0.045 : 0.1; caja(g, -0.1, -0.1, mont === 'pared' ? -0.03 : 0.02, 0.1, 0.1, mont === 'pared' ? 0.01 : 0.07, blanco()); }
      malla(k, CIL24, blanco(), 0, 0, 0, 0.58, 0.07, 0.58); const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 28).rotateX(Math.PI / 2), led(ec)); r.position.y = mont !== 'techo' ? 0.04 : -0.04; k.add(r); }) },
  switch: { n: 'Switch', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'switch', equipo: 'sw', etiqueta: p => p.nombre, def: { y: 1.5 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.22, -0.03, -0.22, 0.22, 0.03, 0.22, negro()); for (let i = 0; i < 8; i++) caja(g, -0.18 + i * 0.05, -0.01, 0.22, -0.15 + i * 0.05, 0.02, 0.225, led(ec), false); }) },
  // rack: de piso con puerta de vidrio, de pared (más chico, colgado) o abierto (dos parantes). Lo de adentro se documenta aparte (bocas, patch cords, fibras).
  rack: { n: 'Rack', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'otro', equipo: 'sw', protegido: true, etiqueta: p => p.nombre, def: { y: 0, alto: 2, clase: 'piso' },
    campos: [...EQ_CAMPOS.slice(0, 5), { k: 'clase', n: 'Tipo de rack', t: 'sel', ops: [['piso', 'De piso'], ['pared', 'De pared'], ['abierto', 'Abierto (parantes)']] }, F.alto('Alto (m)', 0.3, 2.4), { k: 'ancho', n: 'Ancho (m)', t: 'num', min: 0.4, max: 1, paso: 0.05 }, { k: 'fondo', n: 'Fondo (m)', t: 'num', min: 0.3, max: 1.2, paso: 0.05 }, { k: 'base', n: 'Altura del borde de abajo (m)', t: 'num', min: 0, max: 3, paso: 0.05 }, F.r, EQ_CAMPOS[7]],
    variantes: [{ n: 'Rack de piso', o: { clase: 'piso', alto: 2 } }, { n: 'Rack de pared', o: { clase: 'pared', alto: 0.5 } }, { n: 'Rack abierto', o: { clase: 'abierto', alto: 2 } }],
    armar: equipo((g, p, ec) => { const c = p.clase || 'piso', h = p.alto || (c === 'pared' ? 0.5 : 2), a = p.ancho || 0.6, f = p.fondo || (c === 'pared' ? 0.45 : c === 'abierto' ? 0.5 : 0.8), b = c === 'pared' ? (p.base ?? 1.5) : 0, ch = negro(), acero = mat('#2b3035', { roughness: 0.45, metalness: 0.5 });
      const frentes = z => { for (let yy = b + h - 0.16, i = 0; yy > b + 0.14 && i < 14; yy -= 0.135, i++) caja(g, -a / 2 + 0.07, yy, z, a / 2 - 0.07, yy + (i % 4 === 2 ? 0.085 : 0.04), z + 0.012, i % 3 === 1 ? gris() : mat('#3b4148', { roughness: 0.5, metalness: 0.3 }), false); };
      if (c === 'abierto') { caja(g, -a / 2, 0, -f / 2, a / 2, 0.04, f / 2, acero); caja(g, -a / 2, h - 0.04, -0.04, a / 2, h, 0.04, acero); for (const s of [-1, 1]) caja(g, s * (a / 2 - 0.025) - 0.025, 0, -0.04, s * (a / 2 - 0.025) + 0.025, h, 0.04, acero); frentes(0.04); }
      else { caja(g, -a / 2, b, -f / 2, a / 2, b + h, f / 2 - 0.025, ch); caja(g, -a / 2, b, f / 2 - 0.025, a / 2, b + h, f / 2, acero);
        frentes(f / 2 - 0.02); caja(g, -a / 2 + 0.035, b + 0.04, f / 2 + 0.001, a / 2 - 0.035, b + h - 0.04, f / 2 + 0.006, mat('#10151a', { roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.38 }), false);
        caja(g, a / 2 - 0.03, b + h * 0.45, f / 2 + 0.004, a / 2 - 0.015, b + h * 0.55, f / 2 + 0.02, gris(), false); }
      caja(g, -a / 2 + 0.06, b + h - 0.07, (c === 'abierto' ? 0.04 : f / 2) + 0.008, -a / 2 + 0.2, b + h - 0.05, (c === 'abierto' ? 0.04 : f / 2) + 0.014, led(ec), false); }) },
  // gabinete exterior de chapa (tipo IP66, gris claro) sobre dos perfiles galvanizados ranurados que bajan al piso, como el de E1 (foto del 16/11)
  gabinete: { n: 'Gabinete exterior', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'otro', equipo: 'sw', protegido: true, etiqueta: p => p.nombre, def: { y: 0, ancho: 0.6, alto: 0.8, fondo: 0.3, base: 1.0, rieles: true, color: '#D2D3CE' },
    campos: [...EQ_CAMPOS.slice(0, 5), { k: 'ancho', n: 'Ancho (m)', t: 'num', min: 0.3, max: 1.2, paso: 0.05 }, F.alto('Alto (m)', 0.3, 1.6, 0.05), { k: 'fondo', n: 'Fondo (m)', t: 'num', min: 0.15, max: 0.6, paso: 0.05 },
      { k: 'base', n: 'Altura del borde de abajo (m)', t: 'num', min: 0, max: 2.5, paso: 0.05 }, { k: 'rieles', n: 'Perfiles hasta el piso', t: 'bool' }, F.color('Color'), F.r, EQ_CAMPOS[7]],
    armar: equipo((g, p) => { const a = p.ancho || 0.6, h = p.alto || 0.8, f = p.fondo || 0.3, b = p.base ?? 1, z0 = p.rieles === false ? 0.01 : 0.045, chapa = mat(p.color || '#D2D3CE', { roughness: 0.55, metalness: 0.15 });
      const galv = mat('#A7ACAE', { roughness: 0.4, metalness: 0.75 }), pieza = mat('#C9CBC6', { roughness: 0.5, metalness: 0.15 }), traba = mat('#202326', { roughness: 0.5 });
      caja(g, -a / 2, b, z0, a / 2, b + h, z0 + f - 0.025, chapa);                                   // cuerpo
      caja(g, -a / 2 + 0.006, b + 0.006, z0 + f - 0.025, a / 2 - 0.006, b + h - 0.012, z0 + f, chapa); // puerta, con la luz de arriba
      caja(g, -a / 2 - 0.008, b + h - 0.004, z0 - 0.004, a / 2 + 0.008, b + h + 0.012, z0 + f + 0.012, pieza); // techito que corta el agua
      caja(g, -a / 2, b - 0.012, z0, a / 2, b, z0 + f, pieza);                                       // pie con los pasacables
      for (const yy of [b + 0.13, b + h - 0.15]) { caja(g, -a / 2 + 0.03, yy - 0.03, z0 + f, -a / 2 + 0.065, yy + 0.03, z0 + f + 0.012, traba); caja(g, a / 2 - 0.012, yy - 0.04, z0 + f - 0.03, a / 2 + 0.006, yy + 0.04, z0 + f + 0.004, pieza); } // trabas negras y bisagras
      if (p.rieles !== false) for (const s of [-1, 1]) { const x = s * a * 0.26; caja(g, x - 0.02, 0, 0, x + 0.02, b + h + 0.06, 0.04, galv);
        for (let yy = 0.06; yy < b - 0.02; yy += 0.06) caja(g, x - 0.006, yy, 0.04, x + 0.006, yy + 0.03, 0.041, traba, false); } }) },
  nvr: { n: 'Grabador (NVR)', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'nvr', equipo: 'cam', etiqueta: p => p.nombre, def: { y: 1 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.22, -0.05, -0.18, 0.22, 0.05, 0.18, negro()); caja(g, 0.12, -0.02, 0.18, 0.18, 0.02, 0.185, led(ec), false); }) },
  router: { n: 'Router o firewall', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'router', equipo: 'gw', etiqueta: p => p.nombre, def: { y: 1.2 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.2, -0.04, -0.14, 0.2, 0.04, 0.14, blanco()); caja(g, -0.16, 0.04, 0.12, 0.16, 0.05, 0.14, led(ec), false); }) },
  sensor: { n: 'Sensor', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'sensor_mov', equipo: 'sen', etiqueta: p => p.nombre, def: { y: 2.2, clase: 'mov', montaje: 'pared' },
    campos: [...EQ_CAMPOS.slice(0, 1), { k: 'clase', n: 'Tipo', t: 'sel', ops: SENSORES }, ...EQ_CAMPOS.slice(1)],
    variantes: [{ n: 'Sensor de movimiento', o: { clase: 'mov' } }, { n: 'Sensor de humo', o: { clase: 'humo', montaje: 'techo', y: 3 } }, { n: 'Temperatura y humedad', o: { clase: 'temp', y: 1.6 } }, { n: 'Control de acceso', o: { clase: 'acceso', y: 1.2 } }, { n: 'Sirena', o: { clase: 'sirena', y: 2.6 } }],
    armar: equipo(sensorDib) },
  ups: { n: 'UPS', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'ups', equipo: 'otro', etiqueta: p => p.nombre, def: { y: 0 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.12, 0, -0.22, 0.12, 0.42, 0.22, negro()); caja(g, -0.04, 0.32, 0.22, 0.04, 0.36, 0.225, led(ec), false); }) },
  fibra: { n: 'Tendido de fibra o cable', g: 'Equipos', forma: 'linea', capa: 'equipos', def: { y: 0, color: '#ff8a00', hilos: 12 },
    campos: [F.nombre, { k: 'hilos', n: 'Hilos', t: 'num', min: 1, max: 288, paso: 1 }, { k: 'y', n: 'Altura (0 = subterráneo)', t: 'num', min: 0, max: 30, paso: 0.5 }, F.color('Color'), { k: 'notas', n: 'Notas', t: 'area' }],
    armar(p) { const g = new THREE.Group(), y = p.y || 0, m = new THREE.MeshBasicMaterial({ color: p.color, transparent: !y, opacity: y ? 1 : 0.85, depthWrite: !!y });
      if (y) { const c = new THREE.CatmullRomCurve3(p.pts.map(q => new THREE.Vector3(q[0], y, q[1])), false, 'catmullrom', 0); const k = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, p.pts.length * 8), 0.06, 6), m); g.add(k); }
      else { const c = new THREE.Mesh(cinta(p.pts, 0.7, 0.085), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -8 })); c.renderOrder = 2; g.add(c);
        const cl = new THREE.MeshBasicMaterial({ color: mix(p.color, '#ffffff', 0.55), transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -10 }); for (const [x, z, d] of aLoLargo(p.pts, 3)) { const k = new THREE.Mesh(CAJA, cl); k.scale.set(0.22, 0.02, 1.2); k.position.set(x, 0.1, z); k.rotation.y = d; k.renderOrder = 3; g.add(k); } } return g; } },


  // ---------- plano del lugar y control de acceso ----------
  plano: { n: 'Plano del lugar (imagen)', g: 'Terreno', forma: 'punto', capa: 'plano', fondo: true, archivo: 'image/*', def: { ancho: 60, aspecto: 0.62, opacidad: 1, fijo: false },
    campos: [F.nombre, F.ancho('Ancho real (m)', 2, 3000), { k: 'opacidad', n: 'Opacidad', t: 'num', min: 0.2, max: 1, paso: 0.05 }, { k: 'fijo', n: 'Fijo: no se mueve al arrastrar', t: 'bool' }, F.r],
    armar(p, ctx) { const g = new THREE.Group(), w = p.ancho, d = p.ancho * (p.aspecto || 0.62), os = oscuro(), op = Math.min(1, Math.max(0.2, p.opacidad ?? 1));
      const m = new THREE.MeshBasicMaterial({ map: p.img ? texPlano(p.img, os, ctx && ctx.dirty) : hojaVacia(os), transparent: op < 1, opacity: op, depthWrite: op >= 1, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const k = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m); k.position.y = 0.04; g.add(k);
      caja(g, -w / 2 - 0.12, 0, -d / 2 - 0.12, w / 2 + 0.12, 0.034, d / 2 + 0.12, mat(os ? '#0b0c0f' : '#c3c8cf', { roughness: 0.9 }), false);   // el canto: se lee como una hoja apoyada
      g.userData.sinAplanar = true; return g; } },
  acceso: { n: 'Puerta con control de acceso', g: 'Control de acceso', forma: 'punto', capa: 'acceso', vivo: true, siempre: true, etiqueta: p => p.nombre, def: { clase: 'puerta', muro: true, lector: 'afuera' },
    campos: [F.nombre, { k: 'clase', n: 'Tipo', t: 'sel', ops: ACCESOS }, { k: 'ancho', n: 'Ancho del paso (m)', t: 'num', min: 0.4, max: 20, paso: 0.1, ph: q => (ACC[q.clase] || ACC.puerta).w }, { k: 'muro', n: 'Con un tramo de pared o cerco a cada lado', t: 'bool' },
      { k: 'lector', n: 'Lector', t: 'sel', ops: [['afuera', 'De un lado'], ['ambos', 'De los dos lados']] }, F.r, { k: 'notas', n: 'Notas', t: 'area' }],
    variantes: ACCESOS.map(([clase, n]) => ({ n, o: { clase } })),
    armar: armarAcceso },
};
export const GRUPOS = ['Terreno', 'Construcción', 'Control de acceso', 'Logística', 'Vegetación', 'Equipos', 'Personas y vehículos'];

// árboles: tronco + copa, todos los de una pieza en dos o tres dibujos
function arbolado(g, lista) { const tr = [], co = [], pi = [], pa = [], R = azar(lista.length * 31 + 7);
  for (const [x, z, t, k = 1] of lista) { if (t === 'pino') { tr.push([x, 2 * k, z, 0, 0.4 * k, 4 * k, 0.4 * k]); const v = PINOS[(R() * PINOS.length) | 0], e = 0.85 + R() * 0.3; pi.push([x, 5.4 * k, z, R() * 6, 5 * k * e, 6 * k, 5 * k * e, v], [x, 8.2 * k, z, R() * 6, 3.8 * k * e, 5.4 * k, 3.8 * k * e, v], [x, 10.8 * k, z, R() * 6, 2.4 * k * e, 4.2 * k, 2.4 * k * e, v]); }
    else if (t === 'palmera') { tr.push([x, 4.5 * k, z, 0, 0.5 * k, 9 * k, 0.5 * k]); pa.push([x, 9.2 * k, z, R() * 6, 4.6 * k, 1.1 * k, 4.6 * k]); }
    else { tr.push([x, 1.6 * k, z, 0, 0.45 * k, 3.2 * k, 0.45 * k]); const n = 2 + (R() * 2 | 0);
      // copa de varias bolas de verdes distintos: de lejos se lee como un árbol, no como una pelota
      for (let i = 0; i < n; i++) { const a = R() * 6.3, rr = (i ? 1.3 : 0) * k, sz = 5.2 * k * (i ? 0.62 + R() * 0.2 : 0.85 + R() * 0.2); co.push([x + Math.cos(a) * rr, (4.4 + (i ? R() * 1.4 : 0)) * k, z + Math.sin(a) * rr, R() * 6, sz, sz * (0.78 + R() * 0.15), sz, VERDES[(R() * VERDES.length) | 0]]); } } }
  const T = oscuro(); lote(g, CIL, mat(T ? '#3b3026' : '#6b5440'), tr); lote(g, BOLA2, mat(T ? '#5d6b5a' : '#ffffff', { roughness: 1 }), co); lote(g, CONO2, mat(T ? '#5d6b5a' : '#ffffff', { roughness: 1 }), pi);
  lote(g, CONO, mat(T ? '#22361f' : '#6f9a5c', { roughness: 1, flatShading: true }), pa.map(q => { q[5] *= -1; return q; })); }
// línea corrida hacia un costado (bordes de ruta)
function offset(pts, d) { return pts.map((c, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [c[0] - (b[1] - a[1]) / l * d, c[1] + (b[0] - a[0]) / l * d]; }); }
// cinta parada a una altura (riel, cable)
function cintaVertical(pts, alto, y) { const v = [], ix = []; for (let i = 0; i < pts.length; i++) { v.push(pts[i][0], y - alto / 2, pts[i][1], pts[i][0], y + alto / 2, pts[i][1]); if (i) { const j = i * 2; ix.push(j - 2, j - 1, j, j - 1, j + 1, j); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(ix); geo.computeVertexNormals(); return geo; }
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

// ---------- edificio armado desde un plano: paredes de cada piso con puertas y ventanas, escalera en U, losas con su hueco ----------
// p.plano = { muros: [[piso, tipo, u0, v0, u1, v1, [[desde, hasta, 'p'|'v'|'pc'], ...]]], esc: { v0, meseta, llegada, uA: [a, b], uB: [a, b] } }
// u = a lo ancho del plano (0 a fondo), v = a lo largo (0 a ancho), en metros desde la esquina de arriba a la izquierda del plano.
// Tipos: e fachada (zócalo oscuro, franja clara en la losa, ventanas sueltas), c cortina de vidrio, i tabique, g tabique vidriado, m tabique móvil.
// Huecos: tramo a lo largo de la pared (en u si es horizontal en el plano, en v si es vertical; en una diagonal, de 0 a 1): p puerta, v ventana, pc puerta cerrada.
function armarPlano(g, p, M, nv, sc) { const L = p.ancho, W = p.fondo, hp = p.altoPiso, N = Math.max(1, Math.round(p.pisos)), P = p.plano, os = oscuro(), suelos = [], duros = [];
  const X = v => v - L / 2, Z = u => u - W / 2, mPta = mat(os ? '#6b4e36' : '#8a6448', { roughness: 0.6 }), mMov = mat(os ? '#9aa1a8' : '#dfe2e4', { roughness: 0.8 });
  const mVidI = mat(os ? '#a9c7d6' : '#d6e8f1', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }), mMarco = mat('#2a2e33', { roughness: 0.5, metalness: 0.3 }), mFachI = mat(os ? '#7f868c' : '#e7e9ea', { roughness: 0.9 });
  // el piso de planta baja queda arriba del terreno (hormigón y asfalto van a 3 o 4 cm): si no, adentro se ve el terreno de afuera
  const mPB = mat('#' + M.mPiso.color.getHexString(), { roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  nv(0, caja(g, -L / 2, 0, -W / 2, L / 2, 0.07, W / 2, mPB)); suelos.push({ x0: -L / 2, z0: -W / 2, x1: L / 2, z1: W / 2, y: 0.07 });
  const E = P.esc, hue = E ? [X(E.v0), Z(Math.min(E.uA[0], E.uB[0])), X(E.llegada[0]), Z(Math.max(E.uA[1], E.uB[1]))] : null;
  // losas de los pisos de arriba (con el hueco de la escalera) y franja clara del canto
  for (let k = 1; k <= N; k++) { const yb = k * hp, top = k === N, H = !top && hue ? hue : null, rects = H ? [[-L / 2, -W / 2, H[0], W / 2], [H[2], -W / 2, L / 2, W / 2], [H[0], -W / 2, H[2], H[1]], [H[0], H[3], H[2], W / 2]] : [[-L / 2, -W / 2, L / 2, W / 2]];
    const sal = v => Math.abs(Math.abs(v) - L / 2) < 0.001 || Math.abs(Math.abs(v) - W / 2) < 0.001 ? v + Math.sign(v) * 0.04 : v; // los bordes de afuera sobresalen 4 cm: la franja de la losa no queda en el mismo plano que la pared
    for (const [a, b, c, d] of rects) if (c - a > 0.01 && d - b > 0.01) nv(k, caja(g, sal(a), yb - 0.3, sal(b), sal(c), yb + (top ? 0.05 : 0.03), sal(d), M.mLosa));
    if (!top) suelos.push({ x0: -L / 2, z0: -W / 2, x1: L / 2, z1: W / 2, y: yb, hueco: H }); }
  // paredes
  for (const [k, t, u0, v0, u1, v1, hs] of P.muros) { if (k >= N) continue; const yb = k * hp, x0 = X(v0), z0 = Z(u0), x1 = X(v1), z1 = Z(u1), len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) continue;
    const ext = t === 'e' || t === 'c', gro = ext ? 0.25 : t === 'm' ? 0.06 : 0.12, alto = hp - (ext ? 0 : 0.3), dx = (x1 - x0) / len, dz = (z1 - z0) / len, ang = Math.atan2(-dz, dx);
    const diag = Math.abs(u1 - u0) > 0.05 && Math.abs(v1 - v0) > 0.05, a0 = diag ? 0 : Math.abs(u1 - u0) > 0.05 ? Math.min(u0, u1) : Math.min(v0, v1), escH = diag ? len : 1, inv = !diag && (Math.abs(u1 - u0) > 0.05 ? u1 < u0 : v1 < v0);
    const H = (hs || []).map(([a, b, q]) => { let s0 = (a - a0) * escH, s1 = (b - a0) * escH; if (inv) [s0, s1] = [len - s1, len - s0]; return [Math.max(0, s0), Math.min(len, s1), q]; }).sort((m, n) => m[0] - n[0]);
    // un tramo de pared de s0 a s1 (metros a lo largo), de y0 a y1
    // la pared de fachada va en dos capas: el color de afuera por fuera y revoque claro por dentro (si no, adentro las paredes se ven oscuras).
    // mas = cuánto más gruesa que la pared va la parte (marcos y parantes): así no quedan en el mismo plano que la pared y no titilan.
    const nx = -dz, nz = dx, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, afuera = Math.hypot(mx + nx * 0.3, mz + nz * 0.3) >= Math.hypot(mx - nx * 0.3, mz - nz * 0.3) ? 1 : -1;
    const parte = (s0, s1, y0, y1, m, gr, corr) => { const k2 = new THREE.Mesh(CAJA, m); k2.scale.set(s1 - s0, y1 - y0, gr); k2.position.set(x0 + dx * (s0 + s1) / 2 + nx * corr, yb + (y0 + y1) / 2, z0 + dz * (s0 + s1) / 2 + nz * corr); k2.rotation.y = ang; k2.castShadow = k2.receiveShadow = true; nv(k, k2); k2.userData.noChoca = true; g.add(k2); return k2; };
    const seg = (s0, s1, y0, y1, m, choca = true, mas = 0) => { if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return; let k2;
      if (t === 'e' && !mas && (m === M.mFach || m === M.mFr)) { k2 = parte(s0, s1, y0, y1, m, 0.15, afuera * 0.05); parte(s0, s1, y0, y1, mFachI, 0.1, -afuera * 0.075); } else k2 = parte(s0, s1, y0, y1, m, gro + mas, 0);
      if (choca && y1 - y0 > 0.3) duros.push([x0 + dx * s0, z0 + dz * s0, x0 + dx * s1, z0 + dz * s1, gro / 2, yb + y0, yb + y1, k]); return k2; };
    const lleno = (s0, s1) => { // pared sin huecos en ese tramo, según el tipo
      if (t === 'c') { seg(s0, s1, 0, 0.12, mMarco); seg(s0, s1, 0.12, alto - 0.5, M.mVid); seg(s0, s1, alto - 0.5, alto, M.mFr); for (let q = s0 + 1.2; q < s1 - 0.1; q += 1.2) seg(q - 0.03, q + 0.03, 0.12, alto - 0.5, mMarco, false, 0.03); }
      else if (t === 'e') { seg(s0, s1, 0, alto - 0.55, M.mFach); seg(s0, s1, alto - 0.55, alto, M.mFr); }
      else if (t === 'g') { seg(s0, s1, 0, 0.9, mFachI); seg(s0, s1, 0.9, alto, mVidI); for (let q = s0 + 1.2; q < s1 - 0.1; q += 1.2) seg(q - 0.025, q + 0.025, 0.9, alto, mMarco, false, 0.03); }
      else seg(s0, s1, 0, alto, t === 'm' ? mMov : mFachI); };
    let s = 0; for (const [h0, h1, q] of H) { lleno(s, h0); s = Math.max(s, h1);
      if (q === 'v') { const vb = t === 'e' ? 0.9 : 0.12; seg(h0, h1, 0, vb, t === 'e' ? M.mFach : mMarco); seg(h0, h1, vb, alto - (t === 'e' ? 0.55 : 0.5), M.mVid); seg(h0, h1, alto - (t === 'e' ? 0.55 : 0.5), alto, t === 'e' || t === 'c' ? M.mFr : mFachI);
        seg(h0 - 0.05, h0 + 0.05, vb, alto - 0.55, mMarco, false, 0.03); seg(h1 - 0.05, h1 + 0.05, vb, alto - 0.55, mMarco, false, 0.03); seg((h0 + h1) / 2 - 0.03, (h0 + h1) / 2 + 0.03, vb, alto - 0.55, mMarco, false, 0.03); }
      else { const dintel = Math.min(2.2, alto - 0.3); seg(h0, h1, dintel, ext ? alto - 0.55 : alto, ext ? (t === 'c' ? M.mFr : M.mFach) : t === 'g' ? mVidI : mFachI); if (ext) seg(h0, h1, alto - 0.55, alto, M.mFr); // el dintel llega hasta la franja de arriba, sin pisarse con ella
        seg(h0 - 0.04, h0 + 0.04, 0, dintel, mMarco, false, 0.03); seg(h1 - 0.04, h1 + 0.04, 0, dintel, mMarco, false, 0.03); if (q === 'pc') seg(h0 + 0.04, h1 - 0.04, 0, dintel, mPta); } }
    lleno(s, len); }
  // escalera en U: primer tramo por el carril A desde la llegada hasta la meseta, meseta a media altura, segundo tramo por el carril B hasta el piso de arriba
  if (E) for (let k = 0; k < N - 1; k++) { const yb = k * hp, ym = yb + hp / 2, xm0 = X(E.meseta[0]), xm1 = X(E.meseta[1]), xl = X(E.llegada[0]), [a0, a1] = E.uA.map(Z), [b0, b1] = E.uB.map(Z), run = xl - xm1, n = Math.max(6, Math.round(hp / 2 / 0.17)), tr = run / n;
    const it = []; for (let i = 0; i < n; i++) { const yt = (i + 1) * hp / 2 / n; it.push([xl - (i + 0.5) * tr, yb + yt / 2, (a0 + a1) / 2, 0, tr, yt, a1 - a0]); it.push([xm1 + (i + 0.5) * tr, ym + yt / 2 - hp / 4, (b0 + b1) / 2, 0, tr, yt + hp / 2, b1 - b0]); }
    const Lt = lote(g, CAJA, M.mEsc, it); if (Lt) { Lt.userData.noChoca = true; Lt.userData.nivel = k; }
    sc(nv(k, caja(g, xm0, ym - 0.2, Math.min(a0, b0), xm1, ym, Math.max(a1, b1), M.mEsc)));
    suelos.push({ rampa: true, x0: xm1, x1: xl, z0: a0, z1: a1, xa: xl, xb: xm1, y0: yb, y1: ym }, { x0: xm0, x1: xm1, z0: Math.min(a0, b0), z1: Math.max(a1, b1), y: ym }, { rampa: true, x0: xm1, x1: xl, z0: b0, z1: b1, xa: xm1, xb: xl, y0: ym, y1: yb + hp });
    // baranda del piso de arriba alrededor del hueco: del lado del pasillo, sobre el carril A en la llegada, y entre carriles
    // (el carril A puede quedar de cualquiera de los dos lados: el pasillo está del lado de afuera de A y el hueco entre carriles, del lado de adentro)
    const ya = yb + hp, aMenor = a0 < b0, uP = aMenor ? a0 : a1, g0 = aMenor ? a1 : b1, g1 = aMenor ? b0 : a0; nv(k + 1, caja(g, xm0, ya, aMenor ? uP - 0.06 : uP, xl, ya + 1.0, aMenor ? uP : uP + 0.06, M.mBar, false)); nv(k + 1, caja(g, xl - 0.05, ya, a0, xl, ya + 1.0, a1, M.mBar, false));
    nv(k + 1, caja(g, xm1, ya, g0, xl, ya + 1.0, g1, M.mBar, false));
    nv(k, caja(g, xm1, yb, g0, xl, yb + hp / 2 + 1.0, g1, M.mEsc, false)); }
  // techo: pretil oscuro y turbina de ventilación
  const Ht = N * hp; for (const [a, b, c, d] of [[-L / 2, -W / 2, L / 2, -W / 2 + 0.2], [-L / 2, W / 2 - 0.2, L / 2, W / 2], [-L / 2, -W / 2, -L / 2 + 0.2, W / 2], [L / 2 - 0.2, -W / 2, L / 2, W / 2]]) { nv(N, caja(g, a, Ht - 0.6, b, c, Ht + 0.05, d, M.mFr)); nv(N, caja(g, a, Ht + 0.05, b, c, Ht + 0.9, d, M.mFach)); }
  nv(N, cil(g, L / 2 - 2, Ht, -W / 2 + 1.5, 0.08, 0.7, mat('#9aa0a6', { metalness: 0.6, roughness: 0.4 }))); nv(N, cil(g, L / 2 - 2, Ht + 0.7, -W / 2 + 1.5, 0.28, 0.4, mat('#b9bec3', { metalness: 0.7, roughness: 0.35 }), BOLA));
  if (p.corte) g.traverse(m => { if (m.isMesh && m.userData.nivel > 0) m.visible = false; });
  // lo que no se atraviesa, en metros del edificio (sirve aunque el edificio esté girado): las paredes ya se anotaron una por una; el resto (losas, barandas, pretil) sale de su caja
  g.updateMatrixWorld(true); g.traverse(m => { if (!m.isMesh || m.isInstancedMesh || m.userData.noChoca) return; const b = new THREE.Box3().setFromObject(m); if (b.isEmpty() || b.max.y < 0.35) return; m.userData.noChoca = true;
    const ex = b.max.x - b.min.x, ez = b.max.z - b.min.z, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; const nv2 = m.userData.nivel || 0; duros.push(ex >= ez ? [b.min.x + ez / 2, cz, b.max.x - ez / 2, cz, ez / 2, b.min.y, b.max.y, nv2] : [cx, b.min.z + ex / 2, cx, b.max.z - ex / 2, ex / 2, b.min.y, b.max.y, nv2]); });
  g.userData.segs = duros; g.userData.suelos = suelos; g.userData.altoPiso = hp; g.userData.pisos = N; return g; }

// ---------- nave logística: el galpón de un parque, con el frente hacia +z. Andenes numerados (portón, marco, visera y defensas), portones a nivel,
// oficina de dos plantas en una punta, pretil, banda oscura arriba y techo liso, con claraboyas o con paneles. Las medidas son las de la maqueta de Ondi.
// p.andenesEn = [[metros desde la punta izquierda, número]] fija cada andén; si no viene, se reparten p.andenes a lo largo. p.nivelEn = portones a nivel.
// p.cajas = [[u0, u1, v0, v1, y0, y1, color]] agrega volúmenes propios del lugar (un alero, un anexo) en metros del frente: u a lo largo, v hacia afuera.
const NAVE = { claro: { zocalo: '#D2D9DF', pretil: '#DAE1E6', banda: '#2B333B', porton: '#AAB5BF', liston: '#96A1AB', marco: '#59636C', goma: '#2E343A', vidrio: '#B4CEDC', clara: '#D3E6EE', panel: '#3D5466', aire: '#C6CED5' },
  oscuro: { zocalo: '#45515C', pretil: '#64717D', banda: '#20282F', porton: '#76838E', liston: '#67737D', marco: '#2E3841', goma: '#1c2125', vidrio: '#E2BC6E', clara: '#4A7486', panel: '#2A4459', aire: '#6A7682' } };
const SIETE = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };
export function andenesDe(p) { const L = p.ancho; if (Array.isArray(p.andenesEn)) return p.andenesEn.filter(q => q[0] > 2 && q[0] < L - 2); const n = Math.max(0, p.andenes | 0); if (!n) return [];
  const a = p.anexo === 'izq' ? 15 : 3, b = L - (p.anexo === 'der' ? 15 : 3), paso = Math.min(6.5, (b - a) / n), ini = (a + b) / 2 - paso * (n - 1) / 2, d0 = p.desde ?? 1; if (paso < 4) return andenesDe({ ...p, andenes: Math.floor((b - a) / 4) });
  return Array.from({ length: n }, (_, i) => [ini + i * paso, d0 + i]); }
function naveLog(p) { const g = new THREE.Group(), os = oscuro(), K = os ? NAVE.oscuro : NAVE.claro, L = p.ancho, w = L / 2, d = p.fondo / 2, h = p.alto, e = 0.25, ch = chapa(16, 'galpon');
  const pa = matTex(ch, os ? mix(p.color, '#000', 0.5) : p.color, [1, 1], { bumpMap: ch, bumpScale: 0.6, roughness: 0.62, metalness: 0.18 }), liso = mat(os ? mix(p.color, '#000', 0.5) : p.color, { roughness: 0.7 }), M = (k, o) => mat(K[k], o);
  const fr = (u0, u1, v0, v1, y0, y1, m, s = true) => caja(g, -w + u0, y0, d + v0, -w + u1, y1, d + v1, m, s);
  cajaT(g, -w, 0, -d, w, h, -d + e, pa, 4); cajaT(g, -w, 0, -d, -w + e, h, d, pa, 4); cajaT(g, w - e, 0, -d, w, h, d, pa, 4); cajaT(g, -w, 0, d - e, w, h, d, pa, 4);
  for (const [x0, z0, x1, z1] of [[-w, -d, w, -d + e], [-w, d - e, w, d], [-w, -d, -w + e, d], [w - e, -d, w, d]]) caja(g, x0 - 0.08, 0, z0 - 0.08, x1 + 0.08, 1.1, z1 + 0.08, M('zocalo'));
  const t = caja(g, -w + e, h - 0.15, -d + e, w - e, h, d - e, mat(os ? mix(p.techo, '#000', 0.55) : p.techo, { roughness: 0.75 })); t.userData.techo = true;
  for (const [x0, z0, x1, z1] of [[-w - 0.05, -d - 0.05, w + 0.05, -d + 0.45], [-w - 0.05, d - 0.45, w + 0.05, d + 0.05], [-w - 0.05, -d + 0.45, -w + 0.45, d - 0.45], [w - 0.45, -d + 0.45, w + 0.05, d - 0.45]]) caja(g, x0, h, z0, x1, h + 0.8, z1, M('pretil'));
  const ax = p.anexo === 'izq' ? [-0.2, 12] : p.anexo === 'der' ? [L - 12, L + 0.2] : null; if (p.banda !== false && h > 7) fr(p.anexo === 'izq' ? 12 : 0, p.anexo === 'der' ? L - 12 : L, 0, 0.12, h - 2.4, h - 0.6, M('banda'), false);
  // techo: claraboyas a lo largo del lado mayor, o paneles solares; y los equipos de aire
  const arriba = [], cub = p.cubierta || 'lisa';
  if (cub === 'claraboyas') { if (L >= p.fondo) for (let z = -d + 6; z < d - 4; z += 9) arriba.push([0, h + 0.14, z + 0.6, 0, L - 10, 0.26, 1.2, K.clara]); else for (let x = -w + 6; x < w - 4; x += 9) arriba.push([x + 0.6, h + 0.14, 0, 0, 1.2, 0.26, p.fondo - 10, K.clara]); }
  if (cub === 'solar') { const S = p.solarEn || [3, L - 3, 3, p.fondo - 3]; for (let x = S[0]; x < S[1] - 7; x += 7.4) for (let z = S[2]; z < S[3] - 5; z += 5.4) arriba.push([-w + x + 3.5, h + 0.5, -d + z + 2.5, 0, 7, 0.3, 5, K.panel]); }
  for (let i = 0, na = p.aires ?? (L > 30 ? 4 : 0); i < na; i++) arriba.push([-w + L * (0.2 + i * 0.2), h + 0.85, 0, 0, 3.4, 1.5, 2.8, K.aire]);
  const lt = lote(g, CAJA, mat('#ffffff', { roughness: 0.5, metalness: 0.2 }), arriba); if (lt) lt.userData.techo = true;
  // oficina al frente: dos plantas con ventanas corridas
  if (ax) { const ha = Math.min(8.6, h - 0.4), [u0, u1] = ax; fr(u0, u1, -9, 2.6, 0, ha, liso); fr(u0 - 0.1, u1 + 0.1, -9.1, 2.7, ha, ha + 0.5, M('pretil'));
    const vi = mat(K.vidrio, os ? { emissive: K.vidrio, emissiveIntensity: 0.55, roughness: 0.3 } : { roughness: 0.12, metalness: 0.5 }); for (const y of [1.4, 5]) { if (y + 2.4 > ha - 0.2) break; fr(u0 + 0.6, u1 - 0.6, 2.6, 2.64, y, y + 2.4, vi, false); const xl = p.anexo === 'izq' ? u0 - 0.04 : u1; fr(xl, xl + 0.04, -8.4, 2.0, y, y + 2.4, vi, false); } }
  // andenes: marco, portón con listones, visera, defensas de goma y la chapa con el número
  const placa = mat(p.placa || '#1F4D3A', { roughness: 0.6 }), bl = mat('#ffffff', os ? { emissive: '#ffffff', emissiveIntensity: 0.35 } : {}), am = mat('#F2C230');
  const num = (n, uc, y0 = 5.95) => { const txt = String(n), W = 0.22, H = 0.36, T = 0.05, yb = y0 + 0.07; fr(uc - 0.24 - txt.length * 0.17, uc + 0.24 + txt.length * 0.17, 0.32, 0.37, y0, y0 + 0.5, placa, false);
    [...txt].forEach((c, i) => { const x = uc + (i - (txt.length - 1) / 2) * 0.34, q = (a, b, y, yy) => fr(x + a, x + b, 0.37, 0.385, yb + y, yb + yy, bl, false);
      for (const k of SIETE[c] || '') { if (k === 'a') q(-W / 2, W / 2, H - T, H); if (k === 'd') q(-W / 2, W / 2, 0, T); if (k === 'g') q(-W / 2, W / 2, H / 2 - T / 2, H / 2 + T / 2); if (k === 'b') q(W / 2 - T, W / 2, H / 2, H); if (k === 'c') q(W / 2 - T, W / 2, 0, H / 2); if (k === 'f') q(-W / 2, -W / 2 + T, H / 2, H); if (k === 'e') q(-W / 2, -W / 2 + T, 0, H / 2); } }); };
  const AN = andenesDe(p); g.userData.andenes = AN.map(([u, n]) => ({ x: -w + u, z: d, n }));
  for (const [u, n] of AN) { fr(u - 1.9, u + 1.9, 0, 0.32, 0.9, 5.2, M('marco')); fr(u - 1.6, u + 1.6, 0, 0.4, 1.2, 4.9, M('porton'), false); for (let y = 1.7; y < 4.8; y += 0.7) fr(u - 1.6, u + 1.6, 0, 0.43, y, y + 0.06, M('liston'), false);
    if (h > 6.2) fr(u - 2.1, u + 2.1, 0, 1.6, 5.4, 5.7, M('pretil')); fr(u - 1.5, u - 1.1, 0, 0.6, 0.9, 1.5, M('goma'), false); fr(u + 1.1, u + 1.5, 0, 0.6, 0.9, 1.5, M('goma'), false); if (n != null && n !== '' && h > 6.8) num(n, u); }
  for (const [u, n] of p.nivelEn || []) { fr(u - 2.3, u + 2.3, 0, 0.3, 0, 4.9, M('marco')); fr(u - 2.05, u + 2.05, 0.3, 0.34, 0, 4.65, mat('#16191C'), false); if (n != null) num(n, u); for (const s of [-1, 1]) fr(u + s * 2.75 - 0.16, u + s * 2.75 + 0.16, 0.5, 0.82, 0, 1.15, am); }
  for (const c of p.cajas || []) { if (c[7] != null) num(c[7], (c[0] + c[1]) / 2, c[4]); else fr(c[0], c[1], c[2], c[3], c[4], c[5], mat(os && c[6] && /^#[EF]/i.test(c[6]) ? mix(c[6], '#000', 0.5) : c[6] || p.color, { roughness: 0.7 })); }
  if (os) { const nm = neon(acento()); for (const [x0, z0, x1, z1] of [[-w, -d - 0.05, w, -d], [-w - 0.05, -d, -w, d], [w, -d, w + 0.05, d]]) caja(g, x0, h - 0.5, z0, x1, h - 0.38, z1, nm, false); AN.forEach(([u], i) => { if (i % 2 === 0) { brillo(g, -w + u, 6.4, d + 0.6, 3.2, '#ffe2b0', 0.7); pozo(g, -w + u, d + 6, 7, '#ffcf8a', 0.22); } }); }
  // lo que no se atraviesa a pie: las cuatro paredes, la oficina y los volúmenes propios
  const sg = [[-w, -d, w, -d, e, 0, h], [-w, d, w, d, e, 0, h], [-w, -d, -w, d, e, 0, h], [w, -d, w, d, e, 0, h]]; if (ax) sg.push([-w + ax[0] + 5.8, d - 3.2, -w + ax[1] - 5.8, d - 3.2, 5.8, 0, 8.6]);
  for (const c of p.cajas || []) if (c[7] == null && c[4] < 1.6 && c[5] > 0.5) { const eu = Math.abs(c[1] - c[0]), ev = Math.abs(c[3] - c[2]), um = (c[0] + c[1]) / 2, vm = (c[2] + c[3]) / 2; sg.push(eu >= ev ? [-w + Math.min(c[0], c[1]) + ev / 2, d + vm, -w + Math.max(c[0], c[1]) - ev / 2, d + vm, ev / 2, c[4], c[5]] : [-w + um, d + Math.min(c[2], c[3]) + eu / 2, -w + um, d + Math.max(c[2], c[3]) - eu / 2, eu / 2, c[4], c[5]]); }
  g.userData.segs = sg; return g; }

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
  const g = T.armar(q, ctx) || new THREE.Group(); if (!g.userData.sinAplanar) aplanar(g); if (T.forma === 'punto') { g.position.set(q.x || 0, 0, q.z || 0); g.rotation.y = q.r || 0; }
  g.userData.pieza = p; g.userData.tipo = T; g.traverse(o => { o.userData.dueño = g; }); return g; }
// centro de una pieza (para etiquetas, enfocar y calcular el "lugar")
export function centro(p) { if (p.pts && p.pts.length) { if (TIPOS[p.t] && TIPOS[p.t].forma === 'area') { const n = p.pts.length; return [p.pts.reduce((a, q) => a + q[0], 0) / n, p.pts.reduce((a, q) => a + q[1], 0) / n]; } const m = p.pts[Math.floor(p.pts.length / 2)]; return [m[0], m[1]]; } return [p.x || 0, p.z || 0]; }
export function altoDe(p) { const q = { ...(TIPOS[p.t] || {}).def, ...p }; return { galpon: q.alto, modulo: (q.pisos || 1) * 3.1, edificio: (q.pisos || 1) * (q.altoPiso || 3.6) + 0.8, columna: q.alto, fila: (q.alto || 1) * 2.59, alero: q.alto, maquina: 6, tanque: q.alto, cartel: (q.altura || 0) + (q.alto || 0), recinto: 0.2, pared: q.alto - 1.4, rack: (q.clase === 'pared' ? (q.base ?? 1.5) : 0) + (q.alto || 2), gabinete: (q.base ?? 1) + (q.alto || 0.8), plano: 0.1, acceso: (ACC[q.clase] || ACC.puerta).h + 0.5 }[p.t] ?? (q.y != null ? q.y + 0.4 : 2); }
export { largoDe };

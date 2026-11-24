// Motor común · piezas. Cada cosa de la maqueta es una pieza en datos: { id, t: tipo, x, z, r (giro), pts (líneas y áreas), ...opciones }.
// Cada tipo dice cómo se llama, en qué grupo del catálogo va, qué se puede editar (campos) y cómo se dibuja (armar).
// Sumar un tipo nuevo = sumar una entrada a TIPOS. Nada de la escena queda fijo en el código.
import { THREE } from './nucleo.js?v=20';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { chapa as chapaReal, METROS_CHAPA as MCH, sombraDeApoyo } from './materiales.js?v=16';
import { suelo as texSuelo, METROS, chapa, frente, matTex, macroDe } from '../texturas.js?v=5';
import { matsCuerpo, marco as marcoCont, tanque as tanqueGeo, navieraDe, navieraAlAzar, H_CONT } from './contenedor.js?v=1';

// ---------- muebles: Furniture Kit de Kenney (CC0) en muebles.json, el mismo de la oficina de Olumi ----------
// { v, pal: [[r,g,b]…], m: { clave: { n, b: [ancho, alto, fondo], p: Int16 mm base64, q: Int8 normales base64, k: Uint8 índice de color base64 } } }
const MUEB = { data: null, prom: null, geo: new Map(), mat: null };
// de noche los muebles van un poco más oscuros: son casi blancos y con la luz de la sala encendida quedaban quemados y con resplandor
const NOCHE_MUEBLE = 0.72, LUZ_PISO = 1.95, tonoMueble = () => { if (MUEB.mat) MUEB.mat.color.setScalar(oscuro() ? NOCHE_MUEBLE : 1); };
const MUEB_URL = new URL('../../olumi/beta/3d/muebles.json', import.meta.url).href;
export // cada mueble con su sección del catálogo (Oficina, Cocina, Baño, Living y descanso)
const MUEBLES = [['desk', 'Escritorio', 'Oficina'], ['deskCorner', 'Escritorio en L', 'Oficina'], ['chairDesk', 'Silla de escritorio', 'Oficina'], ['computerScreen', 'Monitor', 'Oficina'], ['laptop', 'Notebook', 'Oficina'], ['table', 'Mesa', 'Cocina'], ['tableCross', 'Mesa de reunión', 'Oficina'], ['tableRound', 'Mesa redonda', 'Cocina'], ['chair', 'Silla', 'Cocina'], ['chairModernCushion', 'Silla moderna', 'Living y descanso'], ['loungeSofa', 'Sofá', 'Living y descanso'], ['loungeChair', 'Sillón', 'Living y descanso'], ['tableCoffee', 'Mesa ratona', 'Living y descanso'], ['bookcaseOpen', 'Estantería', 'Oficina'], ['bookcaseClosedWide', 'Archivo ancho', 'Oficina'], ['sideTableDrawers', 'Cajonera', 'Oficina'], ['pottedPlant', 'Planta grande', 'Living y descanso'], ['televisionModern', 'Televisor', 'Living y descanso'], ['kitchenCabinet', 'Bajo mesada', 'Cocina'], ['kitchenSink', 'Pileta de cocina', 'Cocina'], ['kitchenFridge', 'Heladera', 'Cocina'], ['kitchenCoffeeMachine', 'Cafetera', 'Cocina'], ['kitchenBar', 'Barra', 'Cocina'], ['stoolBar', 'Banqueta alta', 'Cocina'], ['toiletSquare', 'Inodoro', 'Baño'], ['bathroomSinkSquare', 'Lavatorio', 'Baño'], ['trashcan', 'Papelera', 'Oficina'], ['cardboardBoxClosed', 'Caja de cartón', 'Living y descanso'], ['rugRectangle', 'Alfombra', 'Living y descanso'], ['lampSquareFloor', 'Lámpara de pie', 'Living y descanso']];
function mueblesCargar() { if (!MUEB.prom) MUEB.prom = fetch(MUEB_URL).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(j => { MUEB.data = j.m;
    const pal = j.pal.map(c => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace)); MUEB.pal = pal; MUEB.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, envMapIntensity: 0.5 }); return j; });
  return MUEB.prom; }
const b64 = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
function muebleGeo(k) { if (MUEB.geo.has(k)) return MUEB.geo.get(k);
  const pr = mueblesCargar().then(() => { const m = MUEB.data[k]; if (!m) return null; const P = b64(m.p, Int16Array), Q = b64(m.q, Int8Array), K = b64(m.k, Uint8Array), n = K.length;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = P[i * 3] / 1000; pos[i * 3 + 1] = P[i * 3 + 1] / 1000; pos[i * 3 + 2] = P[i * 3 + 2] / 1000; nor[i * 3] = Q[i * 3] / 127; nor[i * 3 + 1] = Q[i * 3 + 1] / 127; nor[i * 3 + 2] = Q[i * 3 + 2] / 127; const c = MUEB.pal[K[i]] || MUEB.pal[0]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g; });
  MUEB.geo.set(k, pr); return pr; }
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
const TINTE = { pasto2: '#d3dccb', calzada: '#fff3e2', tosca: '#f2eadc' }, SUELO_TEX = { tierra: 'tierra', ripio: 'pedregullo', tosca: 'pedregullo', hormigon: 'hormigon', calzada: 'hormigon', asfalto: 'asfalto', pasto: 'pasto', pasto2: 'pasto', monte: 'monte' };
// asfalto y hormigón parejos: la textura trae manchas que, repetidas en una playa o una ruta larga, se ven como lunares. Se mezcla con su
// color promedio (el nivel más chico de la textura) y queda el grano fino sin el dibujo que se repite.
const CALMOS = new Map();
function calmo(base, k = 0.4) { const key = base.uuid + '|' + k; let m = CALMOS.get(key); if (m) return m; m = base.clone();
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n{ vec4 fino = texture2D( map, vMapUv ); vec4 prom = texture2D( map, vMapUv, 12.0 ); fino.rgb = mix( prom.rgb, fino.rgb, ' + k.toFixed(2) + ' ); diffuseColor *= fino; }\n#endif'); };
  m.customProgramCacheKey = () => 'calmo' + k; CALMOS.set(key, m); return m; }
// adoquines intertrabados grises (playa de andenes, patios): filas corridas media pieza, juntas oscuras y piezas de tono apenas distinto
let TEX_ADOQ = null; const ADOQ_M = 2.4;
function texAdoquin() { if (TEX_ADOQ) return TEX_ADOQ; const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), px = N / ADOQ_M, L = 0.225 * px, A = 0.1125 * px, R = azar(77);
  x.fillStyle = '#4d5052'; x.fillRect(0, 0, N, N); const filas = Math.round(N / A), cols = Math.round(N / L);
  for (let j = 0; j < filas; j++) for (let i = -1; i <= cols; i++) { const x0 = i * L + (j % 2) * L / 2, y0 = j * A, v = 118 + (R() * 26 | 0), w = L - 2.2, h = A - 2.2, o = w * 0.18;
    x.fillStyle = `rgb(${v},${v + 2},${v + 3})`; x.beginPath(); x.moveTo(x0 + 1, y0 + 1); x.lineTo(x0 + 1 + o, y0 + 1); x.quadraticCurveTo(x0 + 1 + w / 4, y0 + 1 + h * 0.22, x0 + 1 + w / 2, y0 + 1); x.quadraticCurveTo(x0 + 1 + w * 0.75, y0 + 1 - h * 0.0, x0 + 1 + w - o, y0 + 1);
    x.lineTo(x0 + 1 + w, y0 + 1); x.lineTo(x0 + 1 + w, y0 + 1 + h); x.lineTo(x0 + 1 + w - o, y0 + 1 + h); x.quadraticCurveTo(x0 + 1 + w / 4 * 3, y0 + 1 + h * 0.78, x0 + 1 + w / 2, y0 + 1 + h); x.lineTo(x0 + 1, y0 + 1 + h); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return TEX_ADOQ = t; }
// hormigón de calzada y de playas: losas de 5 × 5 m con su junta aserrada, cada losa con un gris apenas distinto, grano fino,
// manchas de agua y huellas de neumáticos suaves. Gris frío como el de las fotos (no beige).
let TEX_HORM = null; const HORM_M = 10;
function texHormigon() { if (TEX_HORM) return TEX_HORM; const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), R = azar(913), px = N / HORM_M, n = HORM_M / 5;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 186 + (R() * 14 | 0); x.fillStyle = `rgb(${v},${v},${v - 3})`; x.fillRect(i * 5 * px, j * 5 * px, 5 * px, 5 * px); }
  const im = x.getImageData(0, 0, N, N), d = im.data; for (let i = 0; i < d.length; i += 4) { const r = (R() - 0.5) * 16; d[i] += r; d[i + 1] += r; d[i + 2] += r; } x.putImageData(im, 0, 0);
  for (let i = 0; i < 26; i++) { const cx = R() * N, cy = R() * N, rr = 30 + R() * 160, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr), o = R() < 0.5; g.addColorStop(0, o ? 'rgba(90,90,86,.10)' : 'rgba(255,255,250,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
  x.strokeStyle = 'rgba(60,60,58,.07)'; for (let i = 0; i < 14; i++) { x.lineWidth = 6 + R() * 10; x.beginPath(); const y0 = R() * N; x.moveTo(-20, y0); x.bezierCurveTo(N * 0.3, y0 + (R() - 0.5) * 200, N * 0.7, y0 + (R() - 0.5) * 200, N + 20, y0 + (R() - 0.5) * 120); x.stroke(); }
  x.strokeStyle = 'rgba(70,70,68,.55)'; x.lineWidth = 2; for (let i = 0; i <= n; i++) { const p = i * 5 * px; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, N); x.moveTo(0, p); x.lineTo(N, p); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return TEX_HORM = t; }
export function matSuelo(k, o = {}, escala = 1) { if (k === 'calzada' || k === 'hormigon') return piso(matTex(texHormigon(), oscuro() ? '#56606b' : '#d4d6d8', [1 / (HORM_M * escala), 1 / (HORM_M * escala)], Object.assign({ roughness: 0.93 }, o))); if (k === 'adoquin') return piso(matTex(texAdoquin(), oscuro() ? '#5a6470' : '#ffffff', [1 / (ADOQ_M * escala), 1 / (ADOQ_M * escala)], Object.assign({ roughness: 0.95 }, o))); const t = SUELO_TEX[k]; if (!t) return null; const m = METROS[t] * escala, parejo = t === 'hormigon' || t === 'asfalto' || k === 'tosca';   // la tosca es pareja: sin manchones
  const b = matTex(texSuelo(t), oscuro() ? '#4b5866' : (TINTE[k] || '#ffffff'), [1 / m, 1 / m], Object.assign({ roughness: 0.97, macro: parejo ? 0 : macroDe(t) }, o)); return piso(parejo ? calmo(b, 0.3) : b); }
// con lluvia los pisos brillan: cada material de piso recuerda su aspereza de seco
export const AMB = { mojado: false };
function piso(m) { if (m.userData.r0 == null) m.userData.r0 = m.roughness; m.userData.suelo = true; m.roughness = AMB.mojado ? Math.min(m.userData.r0, 0.4) : m.userData.r0; return m; }
// un piso grande no puede ser dos triángulos de un kilómetro: de lejos la placa calcula mal su profundidad y se mezcla con el piso de al lado
// (el pasto del predio con la losa de los andenes). Toda arista más larga que L se corta al medio; como se decide por arista, los dos
// triángulos que la comparten la cortan en el mismo punto y no quedan rendijas.
function partir(geo, L) { const U = geo.attributes.uv; if (!geo.index || !U) return geo; geo.computeBoundingBox(); const bb = geo.boundingBox; if (bb.max.x - bb.min.x <= L && bb.max.y - bb.min.y <= L) return geo;
  const pos = Array.from(geo.attributes.position.array), uv = Array.from(U.array), L2 = L * L; let ix = Array.from(geo.index.array);
  for (let vuelta = 0; vuelta < 8; vuelta++) { const medio = new Map(), sal = []; let hubo = false;
    const mid = (a, b) => { const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1]; if (dx * dx + dy * dy <= L2) return -1; const k = a < b ? a * 1e7 + b : b * 1e7 + a; let i = medio.get(k);
      if (i === undefined) { i = pos.length / 3; pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, 0); uv.push((uv[a * 2] + uv[b * 2]) / 2, (uv[a * 2 + 1] + uv[b * 2 + 1]) / 2); medio.set(k, i); } return i; };
    for (let t = 0; t < ix.length; t += 3) { const a = ix[t], b = ix[t + 1], c = ix[t + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a), n = (ab >= 0) + (bc >= 0) + (ca >= 0); if (!n) { sal.push(a, b, c); continue; } hubo = true;
      if (n === 3) sal.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      else if (n === 1) { if (ab >= 0) sal.push(a, ab, c, ab, b, c); else if (bc >= 0) sal.push(a, b, bc, a, bc, c); else sal.push(a, b, ca, ca, b, c); }
      else if (ab < 0) sal.push(a, b, bc, a, bc, ca, ca, bc, c); else if (bc < 0) sal.push(a, ab, ca, ab, b, c, ab, c, ca); else sal.push(a, ab, c, ab, bc, c, ab, b, bc); }
    ix = sal; if (!hubo) break; }
  const n = pos.length / 3, nor = new Float32Array(n * 3); for (let i = 0; i < n; i++) nor[i * 3 + 2] = 1;
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(ix); geo.clearGroups(); geo.addGroup(0, ix.length, 0); geo.boundingBox = null; geo.boundingSphere = null; return geo; }
// superficie plana con la forma de un polígono (x, z)
function area(g, pts, y, m, huecos) { if (pts.length < 3) return null; const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))); if (huecos) for (const h of huecos) if (h.length > 2) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], -p[1])))); const geo = partir(new THREE.ShapeGeometry(sh), 96).rotateX(-Math.PI / 2); geo.translate(0, y, 0);
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
const acento = () => ({ olumi: '#ffd23f', kliva: '#9d7cff' })[document.documentElement.dataset.app] || '#3fc6ea';
let _halo = null; const halo = () => { if (_halo) return _halo; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  _halo = new THREE.CanvasTexture(c); _halo.colorSpace = THREE.SRGBColorSpace; return _halo; };
const MHALO = new Map(); const matHalo = (c, op) => { const k = c + op; if (!MHALO.has(k)) MHALO.set(k, new THREE.SpriteMaterial({ map: halo(), color: c, opacity: op, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); return MHALO.get(k); };
function brillo(g, x, y, z, tam, c, op = 0.9) { const s = new THREE.Sprite(matHalo(c, op)); s.position.set(x, y, z); s.scale.set(tam, tam, 1); s.renderOrder = 3; g.add(s); return s; }
let _luzPiso = null; const luzPiso = () => { if (_luzPiso) return _luzPiso; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${(Math.exp(-t * t * 3.2) * (1 - t)).toFixed(3)})`); } x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _luzPiso = new THREE.CanvasTexture(c); _luzPiso.colorSpace = THREE.SRGBColorSpace; return _luzPiso; };
const MPOZO = new Map(); function pozo(g, x, z, r, c, op = 0.32) { const k = c + op; if (!MPOZO.has(k)) MPOZO.set(k, new THREE.MeshBasicMaterial({ map: luzPiso(), color: c, opacity: op * 0.55, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -8 }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), MPOZO.get(k)); m.position.set(x, 0.12, z); m.renderOrder = 2; g.add(m); return m; }
const neon = (c, op = 1) => { const k = 'neon' + c + op; return MHALO.get(k) || MHALO.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, toneMapped: false, blending: op < 1 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: op >= 1, polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -10 })).get(k); };
const tex = new Map();
function rayas(c1, c2, n = 8) { const k = c1 + c2 + n; if (tex.has(k)) return tex.get(k); const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, 64, 64); x.fillStyle = c2; for (let i = 0; i < n; i++) x.fillRect(0, i * 64 / n, 64, 64 / n * 0.45);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; tex.set(k, t); return t; }
// cara de una señal de tránsito (círculo con aro rojo y número, octógono de PARE, triángulo de ceda)
function senalTex(tipo, valor) { const k = 'senal' + tipo + valor; if (tex.has(k)) return tex.get(k); const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), c = 128;
  const txt = (t, fs, col) => { x.fillStyle = col; x.font = `800 ${fs}px "Instrument Sans", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, c, c + fs * 0.04); };
  if (tipo === 'pare') { x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x.lineTo(c + Math.cos(a) * 124, c + Math.sin(a) * 124); } x.closePath(); x.fillStyle = '#C8102E'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#fff'; x.stroke(); txt('PARE', 70, '#fff'); }
  else if (tipo === 'ceda') { x.beginPath(); x.moveTo(c, 240); x.lineTo(14, 30); x.lineTo(242, 30); x.closePath(); x.fillStyle = '#C8102E'; x.fill(); x.beginPath(); x.moveTo(c, 196); x.lineTo(56, 56); x.lineTo(200, 56); x.closePath(); x.fillStyle = '#fff'; x.fill(); }
  else { x.beginPath(); x.arc(c, c, 124, 0, 7); x.fillStyle = '#C8102E'; x.fill(); x.beginPath(); x.arc(c, c, 96, 0, 7); x.fillStyle = '#fff'; x.fill();
    if (tipo === 'prohibido') { x.fillStyle = '#C8102E'; x.fillRect(40, 112, 176, 32); } else if (tipo === 'noestacionar') { txt('E', 120, '#1d1f22'); x.strokeStyle = '#C8102E'; x.lineWidth = 18; x.beginPath(); x.moveTo(62, 62); x.lineTo(194, 194); x.moveTo(194, 62); x.lineTo(62, 194); x.stroke(); } else if (tipo === 'peaton') { x.fillStyle = '#1d1f22'; x.beginPath(); x.arc(c, 74, 16, 0, 7); x.fill(); x.fillRect(116, 92, 24, 66); x.fillRect(104, 152, 14, 46); x.fillRect(138, 152, 14, 46); }
    else txt(String(valor || 15), String(valor || 15).length > 2 ? 92 : 112, '#1d1f22'); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; tex.set(k, t); return t; }
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
// un rack o un gabinete es un NODO de la red: tiene nombre, marca y modelo, pero no IP ni MAC (esas son de los equipos de adentro)
const NODO_CAMPOS = () => [{ k: 'nombre', n: 'Nombre del nodo', t: 'txt' }, EQ_CAMPOS[1], EQ_CAMPOS[2]];
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
export const CAMARAS = [['bullet', 'Bullet'], ['domo', 'Domo'], ['torreta', 'Torreta (ojo de bola)'], ['ptz', 'PTZ (gira y acerca)'], ['ojo', 'Ojo de pez (360°)'], ['multisensor', 'Panorámica multisensor (180°)'], ['lpr', 'Lectura de matrículas (LPR)'], ['termica', 'Térmica'], ['cubo', 'Cubo de interior']];
const APERTURA = { bullet: 80, domo: 110, torreta: 100, ptz: 360, ojo: 360, multisensor: 180, lpr: 30, termica: 50, cubo: 110 };
// bullet: también la de matrículas (más larga, con panel de luz infrarroja) y la térmica (frente oscuro y cuerpo gris)
function camBullet(g, p, ec, mont, c = 'bullet') { const b = c === 'termica' ? mat(oscuro() ? '#3a4046' : '#8e969d', { roughness: 0.5, metalness: 0.3 }) : blanco(), k = new THREE.Group(), z0 = mont === 'techo' ? 0 : 0.26, L = c === 'lpr' ? 1.45 : 1; soporte(g, mont, z0); g.add(k);
  k.position.set(0, mont === 'techo' ? -0.02 : 0, z0); k.rotation.x = (p.inclina ?? (c === 'lpr' ? 8 : 14)) * Math.PI / 180;
  malla(k, ESF, b, 0, 0, 0, 0.11);                                                     // rótula
  alFrente(malla(k, CIL24, b, 0, 0, 0.3 * L, 0.24, 0.56 * L, 0.24));                   // cuerpo
  caja(k, -0.14, 0.1, 0, 0.14, 0.135, 0.68 * L, b);                                    // visera
  alFrente(malla(k, CIL24, negro(), 0, 0, 0.59 * L, 0.225, 0.03, 0.225));              // frente oscuro
  malla(k, ESF, c === 'termica' ? negro() : burbuja(), 0, 0, 0.6 * L, c === 'termica' ? 0.16 : 0.13, c === 'termica' ? 0.16 : 0.13, 0.05);   // lente (la térmica, grande y oscuro)
  if (c === 'lpr') caja(k, -0.1, -0.185, 0.18, 0.1, -0.12, 0.62, mat('#3b1414', { roughness: 0.4, emissive: '#4a0d0d', emissiveIntensity: 0.4 }), false);   // panel de luz infrarroja
  malla(k, BOLA, led(ec), 0.07, -0.065, 0.61 * L, 0.034, 0.034, 0.034, false); }      // luz de estado
// torreta (ojo de bola): base redonda y la bola con el lente, sin burbuja
function camTorreta(g, p, ec, mont) { const b = blanco(); let cz = 0, cy = 0; if (mont === 'pared') { cz = 0.36; cy = 0.18; caja(g, -0.12, -0.04, -0.03, 0.12, 0.3, 0, b); alFrente(malla(g, CIL, b, 0, cy, cz / 2, 0.06, cz, 0.06)); } else if (mont !== 'techo') { cz = 0.4; cy = 0.18; alFrente(malla(g, CIL, b, 0, cy, cz / 2, 0.055, cz, 0.055)); }
  const y0 = mont === 'techo' ? 0 : cy - 0.06; malla(g, CIL24, b, 0, y0 - 0.03, cz, 0.42, 0.06, 0.42); const k = new THREE.Group(); k.position.set(0, y0 - 0.14, cz); k.rotation.x = (p.inclina ?? 30) * Math.PI / 180; g.add(k);
  malla(k, ESF, b, 0, 0, 0, 0.15); alFrente(malla(k, CIL24, negro(), 0, 0, 0.13, 0.13, 0.04, 0.13)); malla(k, ESF, burbuja(), 0, 0, 0.15, 0.07, 0.07, 0.03); malla(g, CIL24, led(ec), 0, y0 - 0.062, cz, 0.43, 0.012, 0.43, false); }
// panorámica multisensor: cuerpo ancho y curvo con cuatro lentes en abanico
function camMulti(g, p, ec, mont) { const b = blanco(), z0 = mont === 'techo' ? 0 : 0.3; soporte(g, mont, z0); const k = new THREE.Group(); k.position.set(0, mont === 'techo' ? -0.12 : -0.05, z0); k.rotation.x = (p.inclina ?? 18) * Math.PI / 180; g.add(k);
  malla(k, CIL24, b, 0, 0, 0.12, 0.62, 0.2, 0.36); for (let i = 0; i < 4; i++) { const a = (-0.66 + i * 0.44), x = Math.sin(a) * 0.28, z = 0.12 + Math.cos(a) * 0.17; const l = malla(k, CIL24, negro(), x, -0.01, z, 0.1, 0.04, 0.1); l.rotation.set(Math.PI / 2, 0, -a); malla(k, ESF, burbuja(), x * 1.06, -0.01, z + 0.02, 0.045, 0.045, 0.03); }
  malla(k, BOLA, led(ec), 0, 0.08, 0.3, 0.03, 0.03, 0.03, false); }
// cubo de interior: chiquito, para un escritorio o un estante
function camCubo(g, p, ec, mont) { const b = blanco(); if (mont === 'pared') caja(g, -0.06, -0.06, -0.02, 0.06, 0.06, 0, b); const y = mont === 'techo' ? -0.2 : 0; caja(g, -0.09, y - 0.09, 0.02, 0.09, y + 0.09, 0.2, b); alFrente(malla(g, CIL24, negro(), 0, y + 0.01, 0.2, 0.1, 0.012, 0.1)); malla(g, ESF, burbuja(), 0, y + 0.01, 0.205, 0.04, 0.04, 0.02); malla(g, BOLA, led(ec), 0.05, y - 0.05, 0.205, 0.02, 0.02, 0.02, false); }
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
const SWITCHES = [['escritorio', 'De escritorio'], ['rack', 'De rack (1U)'], ['din', 'Industrial (riel DIN)'], ['exterior', 'En caja de exterior']];
// Wi-Fi de exterior (cuerpo con dos antenas) y enlace punto a punto (plato que apunta hacia adelante)
function apExterior(g, p, ec, mont) { const b = blanco(), z0 = mont === 'techo' ? 0 : 0.22; soporte(g, mont, z0);
  if (p.clase === 'enlace') { const k = new THREE.Group(); k.position.set(0, 0, z0 + 0.05); g.add(k); const plato = malla(k, MEDIA, b, 0, 0, 0.12, 0.42, 0.14, 0.42); plato.rotation.x = -Math.PI / 2; alFrente(malla(k, CIL24, b, 0, 0, 0.13, 0.84, 0.02, 0.84)); alFrente(malla(k, CIL, negro(), 0, 0, 0.3, 0.05, 0.3, 0.05));   /* el plato mira hacia adelante, con el alimentador al centro */ malla(k, BOLA, led(ec), 0, -0.3, 0.02, 0.03, 0.03, 0.03, false); return; }
  caja(g, -0.1, -0.18, z0 - 0.03, 0.1, 0.18, z0 + 0.07, b); for (const x of [-0.07, 0.07]) malla(g, CIL, b, x, 0.36, z0 + 0.02, 0.025, 0.36, 0.025); malla(g, BOLA, led(ec), 0, -0.1, z0 + 0.075, 0.03, 0.03, 0.03, false); }
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
export const PAREDES = [['maciza', 'Maciza (revocada y pintada)'], ['bloque', 'Bloque de hormigón'], ['ladrillo', 'Ladrillo visto'], ['hormigon', 'Hormigón visto'], ['panel', 'Panel sándwich'], ['chapa', 'Chapa trapezoidal'], ['vidrio', 'Vidriada'], ['cortina', 'Muro cortina (fachada de vidrio)'], ['media', 'Media altura'], ['reja', 'Reja o malla'], ['sin', 'Sin pared (abierto)']];
// textura de cada material de pared: lo que mide el dibujo en metros (ancho, alto) para repetirlo a escala
const MUROS = { bloque: { m: [2.4, 1.2], f: '#a7a9a6', j: '#7f817e', p: [0.4, 0.2], t: 1 }, ladrillo: { m: [1.2, 0.6], f: '#a8553a', j: '#d9cdbd', p: [0.24, 0.075], t: 1 }, hormigon: { m: [2.4, 1.2], f: '#b8b8b2', j: '#9c9c96', p: [1.2, 0.6], t: 0 },
  panel: { m: [2, 2], f: '#eef0f0', j: '#c9cccd', p: [1, 99], t: 0 }, chapa: { m: [1, 1], f: '#d8dcdf', j: '#aeb3b7', p: [0.2, 99], t: 0 } };
const TEX_MURO = {};
function texMuro(k) { if (TEX_MURO[k]) return TEX_MURO[k]; const D = MUROS[k], N = 512, c = document.createElement('canvas'); c.width = N; c.height = Math.round(N * D.m[1] / D.m[0]); const x = c.getContext('2d'), sx = N / D.m[0], R = azar(k.length * 31);
  x.fillStyle = D.j; x.fillRect(0, 0, c.width, c.height); const pw = D.p[0] * sx, ph = Math.min(D.p[1], D.m[1]) * sx, jn = k === 'ladrillo' ? 2 : 1.5;
  for (let j = 0; j * ph < c.height; j++) for (let i = -1; i * pw < N + pw; i++) { const x0 = i * pw + (D.t && j % 2 ? pw / 2 : 0), v = (R() - 0.5) * (k === 'ladrillo' ? 30 : 12), b = new THREE.Color(D.f).offsetHSL(0, 0, v / 255); x.fillStyle = '#' + b.getHexString(); x.fillRect(x0 + jn / 2, j * ph + jn / 2, pw - jn, ph - jn); }
  if (k === 'hormigon') { x.fillStyle = 'rgba(80,80,76,.5)'; for (const [a, bb] of [[0.3, 0.3], [0.9, 0.3], [0.3, 0.9], [0.9, 0.9]]) for (const ox of [0, 1.2]) { x.beginPath(); x.arc((a + ox) * sx * 0.5 + 0.15 * sx, bb * sx * 0.5, 3, 0, 7); x.fill(); } }
  if (k === 'chapa') { const g = x.createLinearGradient(0, 0, pw, 0); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(0.35, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.05)'); for (let i = 0; i * pw < N; i++) { x.save(); x.translate(i * pw, 0); x.fillStyle = g; x.fillRect(0, 0, pw, c.height); x.restore(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return TEX_MURO[k] = t; }
// plantas de un edificio armado a mano (como en Los Sims): cada pieza guarda su planta en «nivel» (0 = planta baja) y sube ALTO_PLANTA por planta.
// 2,8 m = paredes de 2,6 m más la losa de 0,2 m: así la pared de abajo llega justo a la losa de arriba. Los planos que guardaban la altura en «y» (3, 6, 9 m) se leen igual.
export const ALTO_PLANTA = 2.8;
export const nivelDe = q => q.nivel != null ? +q.nivel || 0 : q.t === 'plano' ? Math.round((+q.y || 0) / 3) : 0;
export const NOM_PLANTA = n => n === 0 ? 'Planta baja' : ['', 'Primer piso', 'Segundo piso', 'Tercer piso', 'Cuarto piso', 'Quinto piso'][n] || n + '.º piso';
export const PLANTAS = [0, 1, 2, 3, 4, 5].map(n => [n, NOM_PLANTA(n)]);
export const PISOS = [['ceramica', 'Cerámica'], ['porcelanato', 'Porcelanato gris'], ['madera', 'Madera'], ['alfombra', 'Alfombra'], ['hormigon', 'Hormigón alisado'], ['goma', 'Goma técnica'], ['sin', 'Sin piso']];
export const areaSig = P => { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
// vistas de pared, como en Los Sims: altas, cortadas (para ver adentro) o al ras
// corte: cada pieza puede decir cómo se corta en la vista «cortada»: 'no' (queda entera, por ejemplo un vidrio que no tapa) o la altura en metros (1,1 si no dice)
const altoVista = (alto, ctx, p) => { const v = ctx && ctx.paredes; if (v === 'baja') return 0.12; if (v !== 'corte') return alto; const c = p && p.corte; return c === 'no' ? alto : typeof c === 'number' ? Math.min(c, alto) : Math.min(1.1, alto); };
const MPISO = new Map();
const TENIDOS = new Map();
function tenido(m, c) { const k = m.uuid + c; let t = TENIDOS.get(k); if (!t) { t = m.clone(); t.color = new THREE.Color(c); if (m.userData) t.userData = { ...m.userData }; TENIDOS.set(k, t); } return t; }
function matPiso(k) { const os = oscuro(), key = k + os; if (MPISO.has(key)) return MPISO.get(key); const N = FINO ? 1024 : 512, mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; }, cC = mk(), cB = mk(), cR = mk(), x = cC.getContext('2d'), xb = cB.getContext('2d'), xr = cR.getContext('2d'), R = azar(k.length * 97 + 5), u = N / 1024;
  const base = ({ ceramica: os ? '#8d9296' : '#e3e1dc', porcelanato: os ? '#5d6368' : '#b3b3b0', madera: os ? '#6e5338' : '#b5895c', alfombra: os ? '#3f4852' : '#6f7d8a', hormigon: os ? '#6c7073' : '#bdbdb8', goma: os ? '#23272b' : '#3d434a' })[k] || '#cfd2d3', rug = ({ ceramica: 0.4, porcelanato: 0.34, madera: 0.56, alfombra: 1, hormigon: 0.66, goma: 0.82 })[k] ?? 0.9, gr = v => { const q = Math.max(0, Math.min(255, Math.round(v * 255))); return `rgb(${q},${q},${q})`; };
  x.fillStyle = base; x.fillRect(0, 0, N, N); xb.fillStyle = gr(0.5); xb.fillRect(0, 0, N, N); xr.fillStyle = gr(rug); xr.fillRect(0, 0, N, N);
  // manchas suaves que se repiten sin costura (se dibujan también corridas una textura para cada lado)
  const nube = (c, n, r0, r1, a, cols) => { for (let i = 0; i < n; i++) { const px = R() * N, py = R() * N, r = (r0 + R() * (r1 - r0)) * u, col = cols[(R() * cols.length) | 0], al = a * (0.4 + R() * 0.6); for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { if (px + ox + r < 0 || px + ox - r > N || py + oy + r < 0 || py + oy - r > N) continue; const g = c.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(px + ox - r, py + oy - r, r * 2, r * 2); } } };
  const grano = (c, n, a) => { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * a})`; c.fillRect(R() * N, R() * N, 2 * u, 2 * u); } };
  const junta = (x0, y0, w, h, col, hondo) => { x.fillStyle = col; x.fillRect(x0, y0, w, h); xb.fillStyle = gr(hondo); xb.fillRect(x0, y0, w, h); xr.fillStyle = gr(0.95); xr.fillRect(x0, y0, w, h); };
  if (k === 'madera') { const filas = 16, hf = N / filas; // tablas de 15 cm por 1,2 m más o menos, corridas al tresbolillo
    for (let f = 0; f < filas; f++) { let x0 = -R() * N * 0.5; while (x0 < N) { const w = N * (0.38 + R() * 0.24), t = R(), tono = t < 0.5 ? `rgba(60,34,12,${0.05 + R() * 0.2})` : `rgba(255,226,180,${0.04 + R() * 0.16})`; x.fillStyle = tono; x.fillRect(x0, f * hf, w, hf); xr.fillStyle = gr(rug + (R() - 0.5) * 0.16); xr.fillRect(x0, f * hf, w, hf);
        for (let v = 0; v < 9; v++) { const yy = f * hf + 3 * u + R() * (hf - 6 * u), fase = R() * 6, amp = (0.6 + R() * 1.6) * u; x.strokeStyle = `rgba(70,40,16,${0.05 + R() * 0.13})`; x.lineWidth = (0.6 + R() * 1.2) * u; x.beginPath(); for (let q = 0; q <= 12; q++) { const xx = x0 + w * q / 12, y2 = yy + Math.sin(fase + q * 0.9) * amp; q ? x.lineTo(xx, y2) : x.moveTo(xx, y2); } x.stroke(); }
        if (R() < 0.18) { const kx = x0 + w * (0.2 + R() * 0.6), ky = f * hf + hf * (0.3 + R() * 0.4), g = x.createRadialGradient(kx, ky, 0, kx, ky, 9 * u); g.addColorStop(0, 'rgba(50,28,10,.55)'); g.addColorStop(1, 'rgba(50,28,10,0)'); x.fillStyle = g; x.fillRect(kx - 9 * u, ky - 9 * u, 18 * u, 18 * u); }
        junta(x0 + w - u, f * hf, 2 * u, hf, 'rgba(40,24,10,.5)', 0.3); x0 += w; } junta(0, f * hf - u, N, 2 * u, 'rgba(40,24,10,.5)', 0.28); } nube(xr, 30, 60, 200, 0.2, ['0,0,0', '255,255,255']); }
  else if (k === 'ceramica' || k === 'porcelanato') { const n = k === 'ceramica' ? 8 : 4, t = N / n, por = k === 'porcelanato'; nube(x, por ? 46 : 26, 60, por ? 260 : 160, por ? 0.1 : 0.06, ['255,255,255', '70,72,76', '120,112,100']); grano(x, 5000, 0.05);
    if (por) for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(255,255,255,${0.04 + R() * 0.07})`; x.lineWidth = (0.7 + R() * 1.5) * u; x.beginPath(); let px = R() * N, py = R() * N; x.moveTo(px, py); for (let q = 0; q < 6; q++) { px += (R() - 0.3) * 120 * u; py += (R() - 0.5) * 90 * u; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const d = (R() - 0.5) * 0.06; x.fillStyle = d > 0 ? `rgba(255,255,255,${d})` : `rgba(0,0,0,${-d})`; x.fillRect(i * t, j * t, t, t); xr.fillStyle = gr(rug + (R() - 0.5) * 0.1); xr.fillRect(i * t, j * t, t, t); }
    nube(xr, 40, 50, 220, 0.22, ['0,0,0', '255,255,255']); const cj = por ? 'rgba(74,76,78,.9)' : 'rgba(150,146,138,.9)'; for (let i = 0; i < n; i++) { junta(i * t - 1.5 * u, 0, 3 * u, N, cj, 0.25); junta(0, i * t - 1.5 * u, N, 3 * u, cj, 0.25); } }
  else if (k === 'alfombra') { nube(x, 30, 80, 260, 0.08, ['0,0,0', '255,255,255']); for (let i = 0; i < 26000; i++) { const px = R() * N, py = R() * N, c2 = R() < 0.5 ? '0,0,0' : '255,255,255', al = R() * 0.13; x.fillStyle = `rgba(${c2},${al})`; x.fillRect(px, py, 2 * u, 3 * u); xb.fillStyle = `rgba(${c2},${al * 2.4})`; xb.fillRect(px, py, 2 * u, 3 * u); } }
  else if (k === 'goma') { grano(x, 6000, 0.05); const t = N / 24; for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { const cx = (i + 0.5) * t, cy = (j + 0.5) * t, g = xb.createRadialGradient(cx, cy, 0, cx, cy, t * 0.34); g.addColorStop(0, gr(0.95)); g.addColorStop(0.8, gr(0.9)); g.addColorStop(1, gr(0.5)); xb.fillStyle = g; xb.beginPath(); xb.arc(cx, cy, t * 0.34, 0, 7); xb.fill(); x.fillStyle = 'rgba(255,255,255,.05)'; x.beginPath(); x.arc(cx - t * 0.06, cy - t * 0.06, t * 0.26, 0, 7); x.fill(); } }
  else { nube(x, 60, 70, 300, 0.045, ['255,255,255', '60,60,58', '120,116,106']); grano(x, 9000, 0.06); nube(xr, 50, 60, 260, 0.22, ['0,0,0', '255,255,255']); for (let i = 0; i < 3; i++) { x.strokeStyle = 'rgba(40,40,40,.14)'; x.lineWidth = u; x.beginPath(); let px = R() * N, py = R() * N; x.moveTo(px, py); for (let q = 0; q < 9; q++) { px += (R() - 0.5) * 90 * u; py += (R() - 0.2) * 70 * u; x.lineTo(px, py); } x.stroke(); } }
  const m = { ceramica: 2.4, porcelanato: 2.4, madera: 2.4, alfombra: 2, goma: 2.4 }[k] || 3, tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / m, 1 / m); return t; };
  const M = new THREE.MeshStandardMaterial({ map: tx(cC, true), bumpMap: tx(cB), bumpScale: k === 'alfombra' ? 1.2 : k === 'goma' ? 2 : 1.5, roughnessMap: tx(cR), roughness: 1, envMapIntensity: 0.55, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -2 }); MPISO.set(key, M); return M; }
// losa flotante sobre una pared (el borde del techo que asoma, como en los edificios de oficinas) con una tira de LED abajo que de noche se enciende
function losaPared(g, P, y, ancho) { const os = oscuro(), m = mat(os ? '#3a3e43' : '#f4f4f2', { roughness: 0.7 }), led = os ? neon('#ffe0b0') : mat('#ffffff', { roughness: 0.3 });
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue; const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    const k = new THREE.Mesh(CAJA, m); k.scale.set(L + ancho, 0.28, ancho); k.position.set(cx, y + 0.14, cz); k.rotation.y = ang; g.add(sombra(k));
    const l = new THREE.Mesh(CAJA, led); l.scale.set(L, 0.04, 0.05); l.position.set(cx, y - 0.03, cz); l.rotation.y = ang; g.add(l); } }
// un tramo de pared de a hasta b (metros del mundo) con sus aberturas; lo macizo se anota en segs: [x0, z0, x1, z1, medio grosor, y de abajo, y de arriba]
function tramoPared(g, a, b, o, hs, segs) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), t = o.tipo || 'maciza'; if (len < 0.05 || t === 'sin') return;
  const os = oscuro(), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, ang = Math.atan2(-dz, dx), y = o.y || 0, gr = t === 'vidrio' ? 0.07 : t === 'cortina' ? 0.1 : t === 'reja' ? 0.05 : o.grosor || 0.15, alto = t === 'media' ? Math.min(1.1, o.alto) : o.alto, real = t === 'media' ? Math.min(1.1, o.real || o.alto) : o.real || o.alto;
  const mP = MUROS[t] ? matTex(texMuro(t), os ? '#6f7478' : '#ffffff', [len / MUROS[t].m[0], (o.alto || 2.6) / MUROS[t].m[1]], { roughness: t === 'chapa' || t === 'panel' ? 0.6 : 0.93 }) : mat(os ? mix(o.color, '#000', 0.38) : o.color, { roughness: 0.92 }), mM = mat(o.aluminio || '#2a2e33', { roughness: 0.42, metalness: 0.45 }), mV = mat(os ? '#a9c7d6' : '#d6e8f1', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.24, depthWrite: false });
  const mE = mat(os ? '#b9c4cc' : '#ffffff', { roughness: 0.6, transparent: true, opacity: os ? 0.35 : 0.55, depthWrite: false }), mH = mat(os ? '#6b4e36' : '#9a7250', { roughness: 0.6 }), mR = mat('#5b656d', { roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.4, depthWrite: false });
  const seg = (s0, s1, y0, y1, m, gro = gr) => { if (s1 - s0 < 0.005 || y1 - y0 < 0.005) return; if (m === mP && MUROS[t]) m = matTex(texMuro(t), os ? '#6f7478' : '#ffffff', [(s1 - s0) / MUROS[t].m[0], (y1 - y0) / MUROS[t].m[1]], { roughness: t === 'chapa' || t === 'panel' ? 0.6 : 0.93 }); const k = new THREE.Mesh(CAJA, m); k.scale.set(s1 - s0, y1 - y0, gro); k.position.set(a[0] + dx * (s0 + s1) / 2, y + (y0 + y1) / 2, a[1] + dz * (s0 + s1) / 2); k.rotation.y = ang; k.castShadow = !m.transparent; k.receiveShadow = true; g.add(k); };
  const duro = (s0, s1, y0, y1) => { s0 = Math.max(0, s0); s1 = Math.min(len, s1); if (s1 - s0 > 0.02 && y1 - y0 > 0.3) segs.push([a[0] + dx * s0, a[1] + dz * s0, a[0] + dx * s1, a[1] + dz * s1, gr / 2, y + y0, y + y1]); };
  const lleno = (s0, s1) => { if (s1 - s0 < 0.01) return; duro(s0, s1, 0, real);
    if (t === 'vidrio') { seg(s0, s1, 0, 0.1, mM); seg(s0, s1, 0.1, alto - 0.06, mV, 0.03); seg(s0, s1, alto - 0.06, alto, mM); for (let q = Math.max(0, s0) + 1.2; q < s1 - 0.3; q += 1.2) seg(q - 0.02, q + 0.02, 0.1, alto - 0.06, mM);
      if (alto > 1.5) seg(s0, s1, 1.05, 1.3, mE, 0.034); }   // banda esmerilada a la altura de los ojos, como las divisiones de oficina de verdad
    else if (t === 'cortina') { const n = Math.max(1, Math.round((s1 - s0) / 2.2)), st = (s1 - s0) / n; seg(s0, s1, 0, 0.12, mM, 0.1); seg(s0, s1, 0.12, Math.max(0.13, alto - 0.06), mV, 0.03); seg(s0, s1, Math.max(0.12, alto - 0.06), alto, mM, 0.1);   // muro cortina: paños de 2,2 m entre parantes
      for (let i = 0; i <= n; i++) { const q = s0 + i * st; seg(q - 0.04, q + 0.04, 0.12, alto - 0.06, mM, 0.09); } }
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
// ---------- entorno: qué hay en el piso de toda la escena (calles, playones, construcciones). Lo usan los cordones, las veredas, las esquinas y el pasto ----------
const FINO = !matchMedia('(pointer:coarse)').matches;
// talud de una playa en altura: de la cresta (altura F) baja hasta el pie a F·tal metros, apenas panzón arriba y tendido abajo. Lo usan el dibujo y la altura para caminar.
const PERFIL_TAL = [[0, 1, 0.8], [0.3, 0.74, 0.6], [0.62, 0.36, 0.34], [0.86, 0.1, 0.12], [1, 0, 0]];   // [avance hacia afuera, altura, tierra a la vista]
function talud(F, d, tal, k = 1) { if (!(F > 0) || !(tal > 0)) return 0; const a = d / (F * tal); if (a >= 1) return 0; for (let i = 1; i < PERFIL_TAL.length; i++) { const A = PERFIL_TAL[i - 1], B = PERFIL_TAL[i]; if (a <= B[0]) { const t = (a - A[0]) / (B[0] - A[0]); return k === 1 ? F * (A[1] + (B[1] - A[1]) * t) : A[2] + (B[2] - A[2]) * t; } } return 0; }
const dPL = (x, z, P) => { let m = 1e9; for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], az = P[i - 1][1], bx = P[i][0] - ax, bz = P[i][1] - az, t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz || 1))), d = Math.hypot(x - ax - bx * t, z - az - bz * t); if (d < m) m = d; } return m; };
const enPoli = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const cajaDe = P => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of P) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return [x0, z0, x1, z1]; };
// esquinas redondeadas donde una calle llega a otra o la cruza: un abanico de asfalto entre los dos bordes, con su arco
function esquinas(calles) { const out = [];
  const cerca = (pt, P) => { let m = null; for (let i = 1; i < P.length; i++) { const ax = P[i - 1][0], az = P[i - 1][1], bx = P[i][0] - ax, bz = P[i][1] - az, l = Math.hypot(bx, bz) || 1, t = Math.max(0, Math.min(1, ((pt[0] - ax) * bx + (pt[1] - az) * bz) / (l * l))), x = ax + bx * t, z = az + bz * t, d = Math.hypot(pt[0] - x, pt[1] - z);
      if (!m || d < m.d) m = { d, x, z, bx: bx / l, bz: bz / l, punta: (i === 1 && t * l < 1) || (i === P.length - 1 && (1 - t) * l < 1) }; } return m; };
  const una = (A, B, jx, jz, ax, az, bx, bz) => { for (const s of [1, -1]) { const nax = -az * s, naz = ax * s; let nbx = -bz, nbz = bx; if (nbx * ax + nbz * az < 0) { nbx = -nbx; nbz = -nbz; }
      const cr = ax * bz - az * bx; if (Math.abs(cr) < 0.64) return; const pax = jx + nax * A.h, paz = jz + naz * A.h, pbx = jx + nbx * B.h, pbz = jz + nbz * B.h;
      // jx,jz está sobre el eje de B: el borde de B del lado de A y el borde de A de cada costado se cortan en C
      const t = ((pbx - pax) * bz - (pbz - paz) * bx) / cr, cx = pax + ax * t, cz = paz + az * t, sg = Math.sign(bx * nax + bz * naz) || 1, ex = bx * sg, ez = bz * sg;
      const co = Math.max(-0.95, Math.min(0.95, ax * ex + az * ez)), th = Math.acos(co), r = Math.min(4.5, A.h * 1.15, B.h * 1.15), d = r / Math.tan(th / 2), ll = Math.hypot(ax + ex, az + ez) || 1, ox = cx + (ax + ex) / ll * r / Math.sin(th / 2), oz = cz + (az + ez) / ll * r / Math.sin(th / 2);
      const p1 = [cx + ax * d, cz + az * d], p2 = [cx + ex * d, cz + ez * d]; let a1 = Math.atan2(p1[1] - oz, p1[0] - ox), a2 = Math.atan2(p2[1] - oz, p2[0] - ox); while (a2 - a1 > Math.PI) a2 -= Math.PI * 2; while (a2 - a1 < -Math.PI) a2 += Math.PI * 2;
      const arco = []; for (let i = 0; i <= 7; i++) { const a = a1 + (a2 - a1) * i / 7; arco.push([ox + Math.cos(a) * r, oz + Math.sin(a) * r]); }
      out.push({ de: A.id, c: [cx, cz], o: [ox, oz], arco, tri: [[cx, cz], p1, p2] }); } };
  for (const A of calles) for (const B of calles) { if (A === B || A.tipo === 'tierra' || B.tipo === 'tierra' || A.bb[0] > B.bb[2] || A.bb[2] < B.bb[0] || A.bb[1] > B.bb[3] || A.bb[3] < B.bb[1]) continue; const n = A.pts.length;
    for (const fin of [0, 1]) { const T0 = fin ? A.pts[n - 1] : A.pts[0], T1 = fin ? A.pts[n - 2] : A.pts[1], q = cerca(T0, B.pts); if (!q || q.punta || q.d > B.h + 0.8) continue; const l = Math.hypot(T1[0] - T0[0], T1[1] - T0[1]) || 1; una(A, B, q.x, q.z, (T1[0] - T0[0]) / l, (T1[1] - T0[1]) / l, q.bx, q.bz); }
    if (A.id < B.id) for (let i = 1; i < n; i++) for (let j = 1; j < B.pts.length; j++) { const p = A.pts[i - 1], p2 = A.pts[i], q = B.pts[j - 1], q2 = B.pts[j], rx = p2[0] - p[0], rz = p2[1] - p[1], sx = q2[0] - q[0], sz = q2[1] - q[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-6) continue;
        const t = ((q[0] - p[0]) * sz - (q[1] - p[1]) * sx) / den, u = ((q[0] - p[0]) * rz - (q[1] - p[1]) * rx) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue; const lr = Math.hypot(rx, rz), ls = Math.hypot(sx, sz), jx = p[0] + rx * t, jz = p[1] + rz * t;
        // solo cruces de verdad: lejos de las puntas de las dos calles
        if (Math.hypot(jx - A.pts[0][0], jz - A.pts[0][1]) < B.h + 2 || Math.hypot(jx - A.pts[n - 1][0], jz - A.pts[n - 1][1]) < B.h + 2 || Math.hypot(jx - B.pts[0][0], jz - B.pts[0][1]) < A.h + 2 || Math.hypot(jx - B.pts[B.pts.length - 1][0], jz - B.pts[B.pts.length - 1][1]) < A.h + 2) continue;
        una(A, B, jx, jz, rx / lr, rz / lr, sx / ls, sz / ls); una(A, B, jx, jz, -rx / lr, -rz / lr, sx / ls, sz / ls); } }
  return out; }
let ENT = null;
// playa en pendiente: sube en línea recta hasta «subeAlto» metros en el lado elegido (0 en el lado opuesto)
const RUMBO = { oeste: [-1, 0], este: [1, 0], norte: [0, -1], sur: [0, 1] };
export function cotaDe(p) { const r = RUMBO[p.sube], A = +p.subeAlto; if (!r || !(A > 0) || !p.pts || p.pts.length < 3) return null; let a = 1e9, b = -1e9; for (const [x, z] of p.pts) { const v = x * r[0] + z * r[1]; if (v < a) a = v; if (v > b) b = v; }
  const L = Math.max(1, b - a); return (x, z) => Math.max(0, Math.min(A, A * ((x * r[0] + z * r[1]) - a) / L)); }
// relieve pintado con el pincel de terreno (como en Los Sims): alturas en las esquinas de una grilla de 2 m, guardadas solo donde no son cero.
// La grilla arranca en x, z de la pieza; entre esquinas la altura se interpola. Se pisa, se camina y las cosas se apoyan encima, como en la loma.
export function relieveDe(p) { const A = p.alt; if (!A) return null; const c = p.celda || 2, ox = p.x || 0, oz = p.z || 0; let i0 = 1e9, j0 = 1e9, i1 = -1e9, j1 = -1e9, n = 0;
  for (const k in A) { if (!(A[k] > 0)) continue; const s = k.indexOf(','), i = +k.slice(0, s), j = +k.slice(s + 1); n++; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
  if (!n) return null; const h = (i, j) => A[i + ',' + j] || 0;
  const f = (x, z) => { const u = (x - ox) / c, v = (z - oz) / c, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j; return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b; };
  return { f, h, c, ox, oz, i0, j0, i1, j1, bb: [ox + (i0 - 1) * c, oz + (j0 - 1) * c, ox + (i1 + 1) * c, oz + (j1 + 1) * c] }; }
// franja a lo largo de una línea con varias columnas a lo ancho: cols(i) da [[desplazamiento, tierra], …] (la tierra es cuánto barro se ve en ese borde)
function franja(P, cols, y) { const v = [], uv = [], t = [], ix = []; let nC = 0;
  for (let i = 0; i < P.length; i++) { const A = P[Math.max(0, i - 1)], B = P[Math.min(P.length - 1, i + 1)]; let dx = B[0] - A[0], dz = B[1] - A[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const C = cols(i); nC = C.length;
    for (const [d, k] of C) { const x = P[i][0] - dz * d, z = P[i][1] + dx * d; v.push(x, y, z); uv.push(x, -z); t.push(k); } }
  for (let i = 1; i < P.length; i++) for (let c = 0; c < nC - 1; c++) { const a = (i - 1) * nC + c, b = i * nC + c; ix.push(a, a + 1, b, a + 1, b + 1, b); }   // de frente hacia arriba (el agua se ve de un solo lado)
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('tierra', new THREE.Float32BufferAttribute(t, 1)); geo.setIndex(ix);
  const nr = new Float32Array(v.length); for (let i = 1; i < nr.length; i += 3) nr[i] = 1; geo.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); geo.computeBoundingSphere(); return geo; }
let JUNCO = null, PIEDRA = null, TEX_HUELLA = null;
// los jacks de una toma o un puesto: «A01 A02», «A01, A02» o «A01-A04» (rango)
export function jacksDe(p) { const out = []; for (const t of String(p.jacks || '').split(/[\s,;]+/)) { if (!t) continue; const m = t.match(/^([A-Za-z]*)(\d+)-([A-Za-z]*)(\d+)$/); if (m && m[1] === (m[3] || m[1]) && +m[4] >= +m[2] && +m[4] - +m[2] < 48) { for (let i = +m[2]; i <= +m[4]; i++) out.push(m[1] + String(i).padStart(m[2].length, '0')); } else out.push(t); } return out; }
// la plaqueta: blanca, con un jack oscuro por boca y los códigos impresos arriba (de frente hacia +z)
function placa(J, n) { const g = new THREE.Group(), cols = n <= 2 ? n : n <= 4 ? 2 : 3, filas = Math.ceil(n / cols), w = 0.04 + cols * 0.03, h = 0.07 + filas * 0.03;
  caja(g, -w / 2, -h / 2, -0.006, w / 2, h / 2, 0.006, mat('#f6f6f3', { roughness: 0.4 }), false);
  for (let i = 0; i < n; i++) { const c = i % cols, f = Math.floor(i / cols), x = -w / 2 + 0.02 + 0.03 * c + 0.015, y = h / 2 - 0.05 - f * 0.03; caja(g, x - 0.008, y - 0.007, 0.004, x + 0.008, y + 0.007, 0.008, mat('#1f2326', { roughness: 0.5 }), false); }
  if (J.length) { const t = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.008, 0.022), new THREE.MeshBasicMaterial({ map: textoTex(J.join(' '), '#ffffff', '#1d3f8f', 512, 96), transparent: false })); t.position.set(0, h / 2 - 0.018, 0.0065); g.add(t); }
  return g; }
// loma o terraplén de pasto o tierra: sube desde el borde con la ladera pedida. «loma» es redondeada y algo despareja; «meseta» queda plana arriba
export function lomaDe(p) { const A = +p.alto, P = p.pts; if (!(A > 0) || !P || P.length < 3) return null; const C = [...P, P[0]], bb = cajaDe(P), nat = p.forma !== 'meseta'; let w = Math.max(0.5, A * (+p.talud || 2));
  if (nat) { let dm = 0; for (let i = 1; i < 18; i++) for (let j = 1; j < 18; j++) { const x = bb[0] + (bb[2] - bb[0]) * i / 18, z = bb[1] + (bb[3] - bb[1]) * j / 18; if (enPoli(x, z, P)) dm = Math.max(dm, dPL(x, z, C)); } w = Math.max(w, dm * 0.9); }
  const s0 = (semilla(p) % 628) / 100;
  return (x, z) => { if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3] || !enPoli(x, z, P)) return 0; const t = Math.min(1, dPL(x, z, C) / w), s = t * t * (3 - 2 * t);
    return A * s * (nat ? 1 + 0.06 * Math.sin(x * 0.13 + s0) * Math.cos(z * 0.11 - s0) + 0.03 * Math.sin((x - z) * 0.37 + s0) : 1); }; }
// cajones de un piso de estacionamiento: filas dobles de 5 m de fondo, cajones de 2,5 m y un pasillo de 6 m entre filas (franjas de 16 m, fijas en el mundo).
// Cuenta solo los cajones que entran enteros en lo pintado, así el número es lo que de verdad entra.
export function cajones(p) { const c = p.celda || 5, ox = p.x || 0, oz = p.z || 0, S = new Set((p.celdas || []).map(q => q[0] + ',' + q[1])), rayas = []; let n = 0;
  const pintado = (x, z) => S.has(Math.floor((x - ox) / c) + ',' + Math.floor((z - oz) / c)), lleno = (x0, z0, x1, z1) => pintado(x0 + 0.05, z0 + 0.05) && pintado(x1 - 0.05, z0 + 0.05) && pintado(x0 + 0.05, z1 - 0.05) && pintado(x1 - 0.05, z1 - 0.05);
  if (!S.size) return { n, rayas }; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const q of p.celdas) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); }
  x0 = x0 * c + ox; z0 = z0 * c + oz; x1 = (x1 + 1) * c + ox; z1 = (z1 + 1) * c + oz; if ((x1 - x0) * (z1 - z0) > 4e6) return { n: Math.floor((p.celdas.length * c * c) / 25), rayas };
  for (let zb = Math.floor(z0 / 16) * 16; zb < z1; zb += 16) for (const [za, zz] of [[zb, zb + 5], [zb + 11, zb + 16]]) for (let x = Math.floor(x0 / 2.5) * 2.5; x < x1; x += 2.5) {
    if (!lleno(x, za, x + 2.5, zz)) continue; n++; rayas.push([x, za, x, zz], [x + 2.5, za, x + 2.5, zz]); rayas.push(za === zb ? [x, zz, x + 2.5, zz] : [x, za, x + 2.5, za]); }
  return { n, rayas }; }
// altura del terreno en un punto (playas en pendiente con su talud, y lomas): para apoyar piezas y para caminar
export const cotaEn = (x, z) => ENT ? ENT.cota(x, z) : 0;
function entorno(ctx) { const L = ctx && ctx.piezas ? ctx.piezas() : null; if (!L) return null; let f = '' + L.length;
  for (const p of L) f += p.t === 'relieve' ? '|r' + p.id + (p.v | 0) + ',' + Math.round(p.x || 0) + ',' + Math.round(p.z || 0) : p.pts && p.pts.length ? '|' + p.id + p.pts.length + Math.round(p.pts[0][0]) + Math.round(p.pts[p.pts.length - 1][1]) + (p.ancho || '') + (p.mat || '') + (p.tipo || '') + (p.t === 'playa' ? '' + (p.sube || '') + (p.subeAlto || '') + (p.talud || '') : p.t === 'loma' ? '' + (p.alto || '') + (p.talud || '') + (p.forma || '') + (p.semilla || '') : '') : p.x != null ? '|' + Math.round(p.x) + ',' + Math.round(p.z) + (p.ancho || '') + (p.r ? Math.round(p.r * 10) : '') : '';
  if (ENT && ENT.f === f) return ENT; const calles = [], rot = [], duros = [], otros = [], cajas = [], playas = [];
  for (const p of L) { const T = TIPOS[p.t]; if (!T) continue; const d = { ...T.def, ...p };
    if (p.t === 'playa' && p.pts && p.pts.length > 2) { playas.push({ id: p.id, pts: p.pts, bb: cajaDe(p.pts), f: cotaDe(d), tal: +d.talud || 0, m: (+d.talud || 0) * (+d.subeAlto || 0) }); continue; }
    if (p.t === 'loma' && p.pts && p.pts.length > 2) { playas.push({ id: p.id, pts: p.pts, bb: cajaDe(p.pts), f: lomaDe(d), loma: true }); continue; }
    if (p.t === 'relieve') { const R = relieveDe(d); if (R) { const b = R.bb; playas.push({ id: p.id, pts: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], bb: b, f: R.f, loma: true }); } continue; }
    if (p.t === 'calle' && p.guia) continue; if (p.t === 'calle' && p.pts && p.pts.length > 1) { const b = cajaDe(p.pts), h = d.ancho / 2; calles.push({ id: p.id, pts: p.pts, h, tipo: d.tipo, bb: [b[0] - h - 9, b[1] - h - 9, b[2] + h + 9, b[3] + h + 9] }); }
    else if (p.t === 'rotonda' && !p.guia) rot.push([p.x, p.z, d.radio + 0.4]);
    else if ((p.t === 'terreno' || p.t === 'recinto') && p.pts && p.pts.length > 2) { const o = { id: p.id, pts: p.pts, bb: cajaDe(p.pts), huecos: p.huecos }; if (p.t === 'recinto' || !/pasto|monte|cultivo/.test(d.mat)) (/hormigon|asfalto/.test(d.mat) ? duros : otros).push(o); }
    else if (p.x != null && (p.t === 'estacionamiento' || (d.ancho && d.fondo))) { const hw = p.t === 'estacionamiento' ? (d.columnas * 2.6 + 1) / 2 : d.ancho / 2, hd = p.t === 'estacionamiento' ? (d.filas * 5.2 + 1) / 2 : d.fondo / 2; cajas.push({ x: p.x, z: p.z, c: Math.cos(p.r || 0), s: Math.sin(p.r || 0), hw, hd, R: Math.hypot(hw, hd) }); } }
  const esq = esquinas(calles), enPolis = (x, z, l, salvo) => { for (const o of l) if (o.id !== salvo && x >= o.bb[0] && x <= o.bb[2] && z >= o.bb[1] && z <= o.bb[3] && enPoli(x, z, o.pts) && !(o.huecos && o.huecos.some(h => enPoli(x, z, h)))) return true; return false; };
  ENT = { f, calles, rot, duros, otros, cajas, esq, enPolis, playas,
    playa(x, z, m = 0) { for (const o of playas) if (!o.loma && x >= o.bb[0] - m && x <= o.bb[2] + m && z >= o.bb[1] - m && z <= o.bb[3] + m && (enPoli(x, z, o.pts) || (m && dPL(x, z, [...o.pts, o.pts[0]]) < m))) return o; return null; },
    cota(x, z) { let y = 0; for (const o of playas) { if (!o.f) continue; const m = o.m || 0; if (x < o.bb[0] - m || x > o.bb[2] + m || z < o.bb[1] - m || z > o.bb[3] + m) continue;
        if (enPoli(x, z, o.pts)) y = Math.max(y, o.f(x, z)); else if (o.tal) y = Math.max(y, talud(o.f(x, z), dPL(x, z, o.ring || (o.ring = [...o.pts, o.pts[0]])), o.tal)); } return y; },
    enCalle(x, z, salvo, m = 0) { for (const c of calles) { if (c.id === salvo || x < c.bb[0] || x > c.bb[2] || z < c.bb[1] || z > c.bb[3]) continue; if (dPL(x, z, c.pts) < c.h + m) return true; } for (const r of rot) if (Math.hypot(x - r[0], z - r[1]) < r[2] + m) return true; return false; },
    enCaja(x, z, m = 0) { for (const k of cajas) { const dx = x - k.x, dz = z - k.z; if (Math.abs(dx) > k.R + m || Math.abs(dz) > k.R + m) continue; if (Math.abs(k.c * dx - k.s * dz) < k.hw + m && Math.abs(k.s * dx + k.c * dz) < k.hd + m) return true; } return false; },
    enEsq(x, z) { for (const e of esq) if (Math.abs(x - e.c[0]) < 12 && Math.abs(z - e.c[1]) < 12 && (enPoli(x, z, e.tri) || dPL(x, z, [e.tri[1], e.tri[0], e.tri[2]]) < 0.4)) return true; return false; },
    duro(x, z, salvo) { return this.enCalle(x, z, salvo, 0.05) || this.enEsq(x, z) || enPolis(x, z, duros) || this.enCaja(x, z, 0.15); } };
  return ENT; }
// tramos de una línea (muestreada cada `paso`) que quedan libres según `ok`
function tramosLibres(pts, paso, ok) { const out = []; let run = []; for (const q of aLoLargo(pts, paso)) { if (ok(q[0], q[1])) run.push([q[0], q[1]]); else { if (run.length > 1) out.push(run); run = []; } } if (run.length > 1) out.push(run); return out; }
const conUV = (geo, inv) => { const n = geo.attributes.position.count; if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); else if (inv) { const u = geo.attributes.uv; for (let i = 0; i < n; i++) u.setX(i, 1 - u.getX(i)); } return geo; };
// textura de baldosas de vereda y degradé de la mugre que se junta contra el cordón
let TEX_VER = null, TEX_ORI = null; const MAT_ORI = {};
function texVereda() { if (TEX_VER) return TEX_VER; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = azar(77); x.fillStyle = '#c8c6c0'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 196 + Math.floor(R() * 22); x.fillStyle = `rgb(${v},${v - 2},${v - 7})`; x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.06})`; x.fillRect(R() * 256, R() * 256, 2, 2); } x.strokeStyle = 'rgba(60,58,54,.55)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
  TEX_VER = new THREE.CanvasTexture(c); TEX_VER.wrapS = TEX_VER.wrapT = THREE.RepeatWrapping; TEX_VER.colorSpace = THREE.SRGBColorSpace; TEX_VER.anisotropy = 8; return TEX_VER; }
function matOrilla() { if (!TEX_ORI) { const c = document.createElement('canvas'); c.width = 64; c.height = 4; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#737373'); g.addColorStop(1, '#000000'); x.fillStyle = g; x.fillRect(0, 0, 64, 4); TEX_ORI = new THREE.CanvasTexture(c); }
  const os = oscuro(); if (!MAT_ORI[os]) MAT_ORI[os] = new THREE.MeshStandardMaterial({ color: '#1c1a17', alphaMap: TEX_ORI, transparent: true, opacity: os ? 0.3 : 0.26, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -7 }); return MAT_ORI[os]; }
// cordón, vereda, mugre de la orilla y esquinas de una calle. borde: 'auto' (cordón solo donde la calle da al pasto o a la tierra), 'vereda' (cordón y vereda), 'no'
function bordesDeCalle(g, p, ctx, y, mc) { const E = entorno(ctx); if (!E || p.borde === 'no' || p.tipo === 'tierra' || p.tipo === 'ruta') return; const h = p.ancho / 2, os = oscuro(), cord = [], ver = [], ori = [], fan = [];
  const fijo = p.borde && p.borde !== 'auto', ok = fijo ? (x, z) => !(E.enCalle(x, z, p.id, 0.05) || E.enEsq(x, z) || E.enCaja(x, z, 0.15)) : (x, z) => !E.duro(x, z, p.id), okV = (x, z) => ok(x, z) && !E.enPolis(x, z, E.otros);
  const tiraCordon = (run, s) => { cord.push(conUV(cinta(run, 0.16, 0.15)), conUV(cintaVertical(offset(run, -s * 0.08), 0.15, 0.075))); ori.push(conUV(cinta(offset(run, -s * 0.55), 0.95, y + 0.004), s < 0)); };
  for (const s of [1, -1]) { const linea = offset(p.pts, s * (h + 0.08));
    for (const run of tramosLibres(linea, 1.5, ok)) { tiraCordon(run, s);
      if (p.borde === 'vereda' || p.borde === (s > 0 ? 'vereda-izq' : 'vereda-der')) for (const rv of tramosLibres(offset(run, s * 1.92), 1.5, okV)) { ver.push(conUV(cinta(offset(rv, -s * 0.92), 1.84, 0.15))); cord.push(conUV(cintaVertical(rv, 0.15, 0.075))); } } }
  // esquinas de esta calle con las que cruza
  for (const e of E.esq) { if (e.de !== p.id || E.enCaja(e.o[0], e.o[1], 0.3) || E.enCalle(e.o[0], e.o[1], null, -0.3)) continue; const conCordon = fijo || !E.enPolis(e.o[0], e.o[1], E.duros); const v = [e.c[0], y + 0.002, e.c[1]], uv = [e.c[0] / p.ancho, e.c[1]], ix = []; const a1 = e.arco[0], a2 = e.arco[1], arriba = (a1[1] - e.c[1]) * (a2[0] - e.c[0]) - (a1[0] - e.c[0]) * (a2[1] - e.c[1]) > 0; e.arco.forEach((q, i) => { v.push(q[0], y + 0.002, q[1]); uv.push(q[0] / p.ancho, q[1]); if (i) arriba ? ix.push(0, i, i + 1) : ix.push(0, i + 1, i); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(v.map((_, i) => i % 3 === 1 ? 1 : 0), 3)); geo.setIndex(ix); fan.push(geo);
    const afuera = e.arco.map(q => { const dx = q[0] - e.o[0], dz = q[1] - e.o[1], l = Math.hypot(dx, dz) || 1; return [q[0] - dx / l * 0.08, q[1] - dz / l * 0.08]; }); if (conCordon) cord.push(conUV(cinta(afuera, 0.16, 0.15)), conUV(cintaVertical(e.arco, 0.15, 0.075))); }
  const pon = (lista, m, cast) => { if (!lista.length) return; const k = new THREE.Mesh(mergeGeometries(lista), m); k.castShadow = !!cast; k.receiveShadow = true; k.userData.noChoca = true; k.userData.noPica = true; g.add(k); lista.forEach(q => q.dispose()); };
  pon(fan, mc);
  pon(cord, mat(os ? '#5b6066' : '#cfccc4', { roughness: 0.9, side: THREE.DoubleSide }), true); pon(ori, matOrilla());
  if (ver.length) { const t = texVereda().clone(); t.needsUpdate = true; t.repeat.set(1.84 / 1.6, 1 / 1.6); pon(ver, new THREE.MeshStandardMaterial({ map: t, color: os ? '#6a7078' : '#ffffff', roughness: 0.93 }), false); } }

// ---------- vegetación ----------
// copa: una bola con bultos, más oscura abajo que arriba (se lee como follaje y no como pelota). En la compu, con más detalle
const HOJAS = (() => { const g = new THREE.IcosahedronGeometry(0.5, FINO ? 2 : 1), p = g.attributes.position, nrm = g.attributes.normal, n = p.count, col = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i).normalize(); const k = 1 + 0.17 * Math.sin(v.x * 7.1 + v.y * 3.3) * Math.cos(v.z * 6.3 - v.y * 4.7) + 0.08 * Math.sin(v.x * 15 + v.z * 13 + v.y * 11), s = 0.58 + 0.5 * (v.y * 0.5 + 0.5) + 0.07 * Math.sin(v.x * 23 + v.z * 19);
    nrm.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, v.x * 0.5 * k, v.y * 0.5 * k, v.z * 0.5 * k); col[i * 3] = s * 0.97; col[i * 3 + 1] = s; col[i * 3 + 2] = s * 0.92; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; })();
const TRONCO = new THREE.CylinderGeometry(0.28, 0.5, 1, 7);
// perfil New Jersey (ancho 1, alto 1, largo 1 en z): base ancha, quiebre a un tercio y lomo angosto
const JERSEY = (() => { const V = (a, b) => new THREE.Vector2(a, b), g = new THREE.ExtrudeGeometry(new THREE.Shape([V(-0.5, 0), V(0.5, 0), V(0.5, 0.1), V(0.22, 0.32), V(0.14, 1), V(-0.14, 1), V(-0.22, 0.32), V(-0.5, 0.1)]), { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
// mata de pasto: cinco hojas finas abiertas en abanico
const MATA = (() => { const l = []; for (let i = 0; i < 5; i++) { const a = i * 1.257, c = new THREE.ConeGeometry(0.035, 0.42 + (i % 3) * 0.1, 3, 1, true); c.translate(0, 0.21, 0); c.rotateZ(0.28 + (i % 2) * 0.22); c.rotateY(a); c.translate(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05); l.push(c); } return mergeGeometries(l); })();
const OLIVOS = ['#8a9a72', '#7f9168', '#95a47d', '#7a8c66'], V_EUCA = ['#7d9a80', '#6f8f78', '#88a58a', '#789b7c'], V_ALAMO = ['#5d8a47', '#679350', '#557f41'], V_ARBU = ['#5c8a4a', '#6b9856', '#4f7c41', '#7aa05f'], V_PASTO = ['#86a565', '#7b9b5c', '#93b072', '#6f9153', '#a3b97c'];
// pasto con vida: matas y algún arbusto donde el terreno es pasto y no hay calle, playón ni construcción encima
function matas(g, p, ctx) { const E = entorno(ctx), bb = cajaDe(p.pts), A = Math.abs(areaSig(p.pts)); if (A < 40) return; const R = azar(semilla(p)), monte = p.mat === 'monte', nM = Math.min(FINO ? 5200 : 500, Math.round(A / (monte ? 8 : 13))), nB = Math.min(FINO ? 60 : 16, Math.round(A / (monte ? 150 : 520)));
  const libre = (x, z, m) => enPoli(x, z, p.pts) && !(E && (E.enCalle(x, z, null, m) || E.enPolis(x, z, E.duros) || E.enPolis(x, z, E.otros) || E.enCaja(x, z, m)));
  // en un campo grande las matas sueltas se pierden: tres de cada cuatro van cerca de las calles, que es donde se mira
  const punto = () => { if (A > 40000 && E && E.calles.length && R() < 0.75) { const c = E.calles[(R() * E.calles.length) | 0], i = 1 + ((R() * (c.pts.length - 1)) | 0), a = c.pts[i - 1], b = c.pts[i], t = R(), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, o = (c.h + 2.6 + R() * R() * 26) * (R() < 0.5 ? 1 : -1); return [a[0] + dx * t - dz / l * o, a[1] + dz * t + dx / l * o]; } return [bb[0] + R() * (bb[2] - bb[0]), bb[1] + R() * (bb[3] - bb[1])]; };
  const ma = [], ar = [], os = oscuro(); for (let i = 0, k = 0; i < nM * 3 && k < nM; i++) { const [x, z] = punto(); if (!libre(x, z, 2.4)) continue; k++; const s = 0.55 + R() * 0.8; ma.push([x, 0.02, z, R() * 6.3, s, s * (0.6 + R() * 0.7), s, os ? '#2c3a2a' : V_PASTO[(R() * V_PASTO.length) | 0]]); }
  const lm = lote(g, MATA, mat('#ffffff', { roughness: 1, side: THREE.DoubleSide }), ma, false); if (lm) { lm.userData.noChoca = lm.userData.noPica = true; lm.raycast = () => {}; }
  for (let i = 0, k = 0; i < nB * 4 && k < nB; i++) { const [x, z] = punto(); if (!libre(x, z, 4)) continue; k++; ar.push([x, z, 'arbusto', 0.7 + R() * 0.9]); }
  if (ar.length) { const n0 = g.children.length; arbolado(g, ar); for (let i = n0; i < g.children.length; i++) { g.children[i].userData.noChoca = g.children[i].userData.noPica = true; g.children[i].raycast = () => {}; } } }
// autos de verdad en los estacionamientos: los modelos del catálogo (los mismos de la pieza «Vehículo»), todos los de un modelo en un solo dibujo
const MAT_AUTO = {}, AUTOS = new Map(), MOD_AUTO = ['suv', 'toro', 'fiorino', 'bipper', 'suv', 'eq7'];
function autoGeo(ctx, id) { if (!AUTOS.has(id)) AUTOS.set(id, ctx.modelo('vehiculos', id).then(r => { if (!r) return null; const G = { pintura: [], vidrio: [], resto: [] }; r.escena.updateMatrixWorld(true);
    r.escena.traverse(k => { if (!k.isMesh || !k.geometry.attributes.position) return; const m = [].concat(k.material)[0], g2 = k.geometry.clone().applyMatrix4(k.matrixWorld); for (const a of Object.keys(g2.attributes)) if (a !== 'position' && a !== 'normal') g2.deleteAttribute(a); if (!g2.attributes.normal) g2.computeVertexNormals();
      const d = m.name === 'pintura' ? 'pintura' : m.name === 'vidrio' ? 'vidrio' : 'resto'; if (d === 'resto') { const n = g2.attributes.position.count, col = new Float32Array(n * 3), c = m.color || new THREE.Color('#888'); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g2.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
      G[d].push(g2); });
    const une = l => { if (!l.length) return null; const todos = l.every(q => q.index); return mergeGeometries(todos ? l : l.map(q => q.index ? q.toNonIndexed() : q)); };
    return { pintura: une(G.pintura), vidrio: une(G.vidrio), resto: une(G.resto), it: r.it }; }).catch(() => null)); return AUTOS.get(id); }

// cordón alrededor de un terreno (canteros e islas) y de sus huecos
// contorno cerrado corrido hacia adentro (la franja de hormigón de un cantero o de la isla de una rotonda)
function adentro(pts, d) { const n = pts.length; let A = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; } const s = A > 0 ? 1 : -1;
  return pts.map((c, i) => { const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [c[0] - (b[1] - a[1]) / l * d * s, c[1] + (b[0] - a[0]) / l * d * s]; }); }
// hormigón de calzada: el mismo hormigón, más claro y con manchas suaves y grandes de uso (sin dibujo que se repita ni cuadriculado:
// la única grilla del piso es la del editor). Va en el propio material, sin capas encima.
const CALZ = new Map();
function calzadaReal(base) { let m = CALZ.get(base.uuid); if (m) return m; m = base.clone();
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n{ vec4 fino = texture2D( map, vMapUv ); vec4 prom = texture2D( map, vMapUv, 12.0 ); fino.rgb = mix( prom.rgb, fino.rgb, 0.34 );\n float ma = texture2D( map, vMapUv * 0.047 + vec2( 0.31, 0.17 ), 1.0 ).g - prom.g; float mb = texture2D( map, vMapUv.yx * 0.013 + vec2( 0.11, 0.63 ) ).r - prom.r;\n fino.rgb *= clamp( 1.0 + 0.28 * ma + 0.38 * mb, 0.93, 1.05 ); diffuseColor *= fino; }\n#endif'); };
  m.customProgramCacheKey = () => 'calzada3'; CALZ.set(base.uuid, m); return m; }
// borde de una isla: cordón ancho de hormigón con caída (bajo del lado de la calle, alto del lado del pasto) y, si se pide, flechas blancas
// con el sentido de giro, como en una rotonda. afuera y adentro son el mismo contorno, punto a punto.
function bordeIsla(g, afuera, adentro, y0, y1, flechas, po) { const n = afuera.length, v = [], uv = [], ix = []; for (let i = 0; i <= n; i++) { const a = afuera[i % n], b = adentro[i % n]; v.push(a[0], y0, a[1], b[0], y1, b[1]); uv.push(a[0], -a[1], b[0], -b[1]); if (i) { const j = i * 2; ix.push(j - 2, j, j - 1, j - 1, j, j + 1); } }
  let A = 0; for (let i = 0; i < n; i++) { const a = afuera[i], b = afuera[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; } if (A < 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals();
  const k = new THREE.Mesh(geo, matSuelo('hormigon', { side: THREE.DoubleSide, ...po }) || mat(suelo('hormigon'), { roughness: 0.95, side: THREE.DoubleSide, ...po })); k.receiveShadow = true; k.userData.noPica = true; g.add(k);
  // frente del cordón del lado de la calle
  const fr = new THREE.Mesh(cintaVertical([...afuera, afuera[0]], y0, y0 / 2), k.material); fr.userData.noPica = true; g.add(fr);
  if (flechas === 'anti' || flechas === 'hor') { const dir = (flechas === 'anti' ? 1 : -1) * (A < 0 ? 1 : -1), fv = [], forma = [[-0.42, 0.42], [0.08, 0.42], [0.08, 0.58], [-0.42, 0.58], [0.08, 0.27], [0.44, 0.5], [0.08, 0.73]]; let falta = 1.2;
    for (let i = 0; i < n; i++) { const a = afuera[i], b = afuera[(i + 1) % n], qa = adentro[i], qb = adentro[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue; let s = falta; for (; s < L; s += 3.3) { const t = s / L, ox = a[0] + (b[0] - a[0]) * t, oz = a[1] + (b[1] - a[1]) * t, ix2 = qa[0] + (qb[0] - qa[0]) * t - ox, iz2 = qa[1] + (qb[1] - qa[1]) * t - oz, tx = (b[0] - a[0]) / L * dir, tz = (b[1] - a[1]) / L * dir;
        const P3 = forma.map(([al, c]) => [ox + tx * al + ix2 * c, y0 + (y1 - y0) * c + 0.012, oz + tz * al + iz2 * c]); for (const [p, q, r] of [[0, 1, 2], [0, 2, 3], [4, 5, 6]]) fv.push(...P3[p], ...P3[q], ...P3[r]); } falta = s - L; }
    if (fv.length) { const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3)); fg.computeVertexNormals(); const fm = new THREE.Mesh(fg, oscuro() ? new THREE.MeshBasicMaterial({ color: '#8fa3b3', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -30, polygonOffsetUnits: -20 }) : mat('#f6f7f8', { roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -30, polygonOffsetUnits: -20 })); fm.userData.noPica = true; fm.userData.noChoca = true; g.add(fm); } }
  return k; }
// placa de hormigón premoldeado: 2 m de largo por 50 cm de alto, con su junta abajo y las marcas del molde
// alrededor de una playa: muro de placas de hormigón con sus postes (sigue la pendiente) y, si se pide, el talud de pasto que baja hasta el suelo
function muroPlaya(g, p, Y, os) { const P = p.pts, n = P.length, tal = +p.talud || 0, hay = P.some(([x, z]) => Y(x, z) > 0.05), mh = +p.muro > 0 ? +p.muro : hay && !(tal > 0) ? 0.25 : 0;   // en pendiente y sin muro ni talud: un murete la cierra hasta el suelo
  let A = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; } const sg = A > 0 ? -1 : 1; // normal hacia afuera de cada lado
  const nor = i => { const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [sg * (b[1] - a[1]) / L, -sg * (b[0] - a[0]) / L]; };
  const anillo = []; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 2)), na = nor((i + n - 1) % n), nb = nor(i);
    let mx = na[0] + nb[0], mz = na[1] + nb[1]; const ml = Math.hypot(mx, mz) || 1, c = Math.max(0.35, (mx * nb[0] + mz * nb[1]) / ml); mx /= ml * c; mz /= ml * c;
    for (let j = 0; j < k; j++) { const t = j / k; anillo.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, n: j ? nb : [mx, mz], d: L * t }); } }
  anillo.push({ ...anillo[0] }); let acc = 0; for (let i = 1; i < anillo.length; i++) { acc += Math.hypot(anillo[i].x - anillo[i - 1].x, anillo[i].z - anillo[i - 1].z); anillo[i].acc = acc; } anillo[0].acc = 0;
  if (mh > 0) { const pl = new THREE.MeshStandardMaterial({ map: placas(), color: os ? '#6f7478' : '#ffffff', roughness: 0.95, side: THREE.DoubleSide }), ph = mat(os ? '#676c70' : '#c3c4bf', { roughness: 0.92 }), v = [], uv = [], ix = [], po = [];
    anillo.forEach((q, i) => { const y = Y(q.x, q.z), y0 = tal > 0 ? y - 0.3 : -0.05, y1 = y + mh; v.push(q.x, y0, q.z, q.x, y1, q.z); uv.push(q.acc / 2, (y0 - y) / 0.5, q.acc / 2, mh / 0.5); if (i) { const j = i * 2; ix.push(j - 2, j - 1, j, j - 1, j + 1, j); }
      if (i < anillo.length - 1) po.push([q.x, (y0 + y1 + 0.12) / 2, q.z, 0, 0.22, y1 + 0.12 - y0, 0.22]); if (i) { const a = anillo[i - 1]; (g.userData.segs = g.userData.segs || []).push([a.x, a.z, q.x, q.z, 0.12, Math.min(y0, Y(a.x, a.z) - 0.3), Math.max(y1, Y(a.x, a.z) + mh)]); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals(); g.add(sombra(new THREE.Mesh(geo, pl))); lote(g, CAJA, ph, po); }
  // el talud: el terreno alrededor se arma como una grilla de alturas con el mismo perfil que se usa para caminar (talud()): en las esquinas hacia adentro
  // las dos laderas se juntan en una hondonada pareja, sin caras cruzadas. Tierra a la vista cerca de la cresta, pasto abajo.
  if (tal > 0 && hay) { const C = [...P, P[0]], bb = cajaDe(P), Fm = Math.max(...P.map(([x, z]) => Y(x, z)), +p.subeAlto || 0), M = Fm * tal + 1, x0 = bb[0] - M, z0 = bb[1] - M, X1 = bb[2] + M, Z1 = bb[3] + M;
    const s = Math.max(0.8, Math.min(3, Math.sqrt((X1 - x0) * (Z1 - z0) / 60000))), NX = Math.ceil((X1 - x0) / s) + 1, NZ = Math.ceil((Z1 - z0) / s) + 1, H = new Float32Array(NX * NZ), D = new Uint8Array(NX * NZ), idx = new Int32Array(NX * NZ).fill(-1);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = x0 + i * s, z = z0 + j * s, k = j * NX + i, F = Y(x, z); if (enPoli(x, z, P)) { D[k] = 1; H[k] = F - 0.3; } else H[k] = talud(F, dPL(x, z, C), tal); }
    const v = [], uv = [], ti = [], ix = [], vert = k => { if (idx[k] >= 0) return idx[k]; const i = k % NX, j = (k - i) / NX, x = x0 + i * s, z = z0 + j * s, h = H[k], F = Y(x, z), on = 0.6 + 0.4 * Math.sin(x * 0.21) * Math.sin(z * 0.057 + 1.3);
      v.push(x, h > 0.01 || D[k] ? h + 0.03 : -0.04, z); uv.push(x, -z); ti.push(D[k] ? 0.8 * on : F > 0.4 ? talud(F, dPL(x, z, C), tal, 2) * on : 0); return (idx[k] = v.length / 3 - 1); };
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; if (D[a] && D[b] && D[c] && D[d]) continue; if (Math.max(D[a] ? 0 : H[a], D[b] ? 0 : H[b], D[c] ? 0 : H[c], D[d] ? 0 : H[d]) < 0.02) continue;
      const A = vert(a), B = vert(b), Cc = vert(c), Dd = vert(d); ix.push(A, Cc, B, B, Cc, Dd); }
    if (ix.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('tierra', new THREE.Float32BufferAttribute(ti, 1)); geo.setIndex(ix); geo.computeVertexNormals();
    const k = new THREE.Mesh(geo, matLoma('pasto')); k.receiveShadow = true; g.add(k); } } }
// casilla de control de un ingreso: pared gris, losa blanca que sobresale, ventanas con reja en los cuatro lados, vereda alta con baranda amarilla y, si se pide, semáforo
function garita(p) { const g = new THREE.Group(), os = oscuro(), w = p.ancho / 2, d = p.fondo / 2, H = 2.75, V = 1.3, base = p.color && p.color !== '#f5f6f7' ? p.color : '#8d949a';
  const pa = mat(os ? mix(base, '#000', 0.4) : base, { roughness: 0.85 }), losa = mat(os ? '#7d8287' : '#eef0f1', { roughness: 0.6 }), vid = mat(os ? '#3a3f45' : '#28333d', { roughness: 0.2, metalness: 0.3, emissive: os ? '#ffdcaa' : '#000000', emissiveIntensity: os ? 0.5 : 0 }), rej = mat(os ? '#6b7075' : '#b7bcc0', { metalness: 0.5, roughness: 0.5 }), am = mat(os ? '#8a6f1a' : '#f2c230', { roughness: 0.55 }), ver = mat(os ? '#5d6267' : '#c9c8c1', { roughness: 0.95 });
  caja(g, -w - V, 0, -d - V, w + V, 0.18, d + V, ver); caja(g, -w, 0.18, -d, w, H, d, pa); caja(g, -w - 0.9, H, -d - 0.9, w + 0.9, H + 0.22, d + 0.9, losa);
  const ven = (u0, u1, lado, largo) => { if (u1 - u0 < 0.6) return; const z = lado * (largo ? d : w), y0 = 1.05, y1 = 2.2; if (largo) caja(g, u0, y0, z - 0.02 * lado - (lado < 0 ? 0.03 : 0), u1, y1, z + 0.03 * lado + (lado > 0 ? 0 : 0.03), vid, false); else caja(g, z - (lado < 0 ? 0.03 : 0), y0, u0, z + (lado > 0 ? 0.03 : 0), y1, u1, vid, false);
    const n = Math.max(2, Math.round((u1 - u0) / 0.13)); for (let i = 1; i < n; i++) { const u = u0 + (u1 - u0) * i / n; if (largo) caja(g, u - 0.012, y0, z + 0.03 * lado - 0.012, u + 0.012, y1, z + 0.03 * lado + 0.012, rej, false); else caja(g, z + 0.03 * lado - 0.012, y0, u - 0.012, z + 0.03 * lado + 0.012, y1, u + 0.012, rej, false); }
    if (largo) caja(g, u0 - 0.05, y0 - 0.06, Math.min(z, z + 0.25 * lado), u1 + 0.05, y0, Math.max(z, z + 0.25 * lado), mat(os ? '#5a3f2a' : '#8a5a3a', { roughness: 0.6 }), false); };
  if (p.ventanas !== false) for (const s of [-1, 1]) { ven(-w + 0.5, -0.4, s, true); ven(0.4, w - 0.5, s, true); ven(-d + 0.5, d - 0.5, s, false); }
  const po = []; for (const s of [-1, 1]) { const z = s * (d + V - 0.08), n = Math.max(2, Math.round((2 * w + 2 * V) / 1.6)); for (let i = 0; i <= n; i++) po.push([-w - V + 0.08 + (2 * w + 2 * V - 0.16) * i / n, 0.18 + 0.5, z, 0, 0.06, 1, 0.06]);
    caja(g, -w - V + 0.05, 1.12, z - 0.035, w + V - 0.05, 1.19, z + 0.035, am); caja(g, -w - V + 0.05, 0.66, z - 0.025, w + V - 0.05, 0.71, z + 0.025, am); }
  lote(g, CAJA, am, po);
  if (p.semaforo) { caja(g, w - 0.02, 1.9, d - 0.3, w + 0.3, 2.62, d - 0.02, negro()); const on = os ? neon('#3ddc84') : mat('#3ddc84', { emissive: '#3ddc84', emissiveIntensity: 0.8 }); caja(g, w + 0.3, 2.0, d - 0.25, w + 0.32, 2.2, d - 0.07, on, false); caja(g, w + 0.3, 2.32, d - 0.25, w + 0.32, 2.52, d - 0.07, mat('#4a1512', { roughness: 0.5 }), false); }
  return g; }
let _placas = null; function placas() { if (_placas) return _placas; const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'), R = azar(4411);
  x.fillStyle = '#c9cac6'; x.fillRect(0, 0, 256, 64); for (let i = 0; i < 2400; i++) { const v = 190 + ((R() - 0.5) * 34) | 0; x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(R() * 256, R() * 64, 1.5, 1.5); }
  const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,.10)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.85, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 64);
  x.fillStyle = 'rgba(60,60,58,.55)'; x.fillRect(0, 61, 256, 3); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 0, 256, 1.5);
  _placas = new THREE.CanvasTexture(c); _placas.wrapS = _placas.wrapT = THREE.RepeatWrapping; _placas.colorSpace = THREE.SRGBColorSpace; _placas.anisotropy = 8; return _placas; }
function cordonDe(g, p) { const os = oscuro(), l = []; for (const c of [p.pts, ...(p.huecos || [])]) { if (c.length < 3) continue; const cer = [...c, c[0], c[1]]; l.push(conUV(cinta(cer, 0.16, 0.15)), conUV(cintaVertical(offset(cer, 0.08), 0.15, 0.075)), conUV(cintaVertical(offset(cer, -0.08), 0.15, 0.075))); }
  if (!l.length) return; const k = new THREE.Mesh(mergeGeometries(l), mat(os ? '#5b6066' : '#cfccc4', { roughness: 0.9, side: THREE.DoubleSide })); k.castShadow = k.receiveShadow = true; k.userData.noChoca = k.userData.noPica = true; g.add(k); }
// manchas del pasto: zonas más secas, más oscuras y más tiernas, grandes y suaves (se repiten cada 64 m). Van adentro del material del pasto
// (como las manchas de uso del hormigón de calzada) y no en una capa transparente encima: esa capa, a 3 mm del pasto, de lejos se metía sobre
// el hormigón y la tierra de al lado, no recibía sombra y se perdía en los canteros.
let TEX_MAN = null; const CON_MAN = new Map();
function texManchas() { if (TEX_MAN) return TEX_MAN; const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), R = azar(4711), cols = ['52,84,30', '70,104,44', '176,168,92', '150,176,84', '96,124,50', '196,184,120'];
  for (let i = 0; i < 90; i++) { const px = R() * N, py = R() * N, r = 18 + R() * 70, col = cols[(R() * cols.length) | 0], al = 0.1 + R() * 0.2; for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { const gr = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2); } }
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '40,66,24' : '170,190,110'},${R() * 0.16})`; x.fillRect(R() * N, R() * N, 1 + R() * 2, 1 + R() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return TEX_MAN = t; }
function conManchas(base) { let m = CON_MAN.get(base.uuid); if (m) return piso(m); m = base.clone(); const antes = base.onBeforeCompile, clave = base.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { antes.call(m, sh, r); sh.uniforms.tManchas = { value: texManchas() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vManW;').replace('#include <project_vertex>', '#include <project_vertex>\nvManW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tManchas;\nvarying vec2 vManW;').replace('#include <map_fragment>', '#include <map_fragment>\n{ vec4 man = texture2D( tManchas, vManW / 64.0 ); diffuseColor.rgb = mix( diffuseColor.rgb, man.rgb, man.a ); }'); };
  m.customProgramCacheKey = () => clave + '|manchas'; CON_MAN.set(base.uuid, m); return piso(m); }
// pasto con tierra a la vista: cada vértice dice cuánta tierra se ve (laderas empinadas, la cresta de un talud)
const CON_TIE = new Map(), MAT_LOMA = new Map(), SOLO_SOMBRA = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
function conTierra(base, barro) { const ck = base.uuid + (barro ? '|b' : ''); let m = CON_TIE.get(ck); if (m) return piso(m); m = base.clone(); const antes = base.onBeforeCompile, clave = base.customProgramCacheKey(), col = barro ? (oscuro() ? '0.04, 0.035, 0.03' : '0.27, 0.21, 0.14') : oscuro() ? '0.05, 0.04, 0.03' : '0.50, 0.36, 0.21';
  m.onBeforeCompile = (sh, r) => { antes.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float tierra;\nvarying float vTierra;').replace('#include <project_vertex>', '#include <project_vertex>\nvTierra = tierra;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTierra;').replace('#include <color_fragment>', '{ float lt = dot( diffuseColor.rgb, vec3( 0.4, 0.5, 0.1 ) ); diffuseColor.rgb = mix( diffuseColor.rgb, vec3( ' + col + ' ) * ( 0.8 + 0.9 * lt ), clamp( vTierra, 0.0, 1.0 ) ); }\n#include <color_fragment>')
      // luz de terreno: la ladera toma parte de la luz como si mirara al cielo; así se ve su forma sin que el lado de sombra quede negro
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize( mix( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), 0.6 ) );'); };
  m.customProgramCacheKey = () => clave + '|tierra' + (barro ? '|barro' : ''); CON_TIE.set(ck, m); return piso(m); }
function matBarro() { const c = 'barro|' + (oscuro() ? 'n' : 'd'); let m = MAT_LOMA.get(c); if (!m) { const po = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -2, side: THREE.DoubleSide }; m = matSuelo('pasto', po) || mat(suelo('pasto'), { roughness: 0.97, ...po }); if (m.map && !oscuro()) m = conManchas(m); m = conTierra(m, true); m.userData.r0 = m.roughness = 0.7; MAT_LOMA.set(c, m); } return piso(m); }
function matLoma(k) { const c = k + (oscuro() ? '|n' : '|d'); let m = MAT_LOMA.get(c); if (!m) { const po = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -2, side: THREE.DoubleSide };
    m = matSuelo(k, po) || mat(suelo(k), { roughness: 0.97, ...po }); if (/^pasto/.test(k) && m.map && !oscuro()) m = conManchas(m); m = conTierra(m); MAT_LOMA.set(c, m); } return piso(m); }
// fibras: las que comparten un tramo van una al lado de la otra (cada una en su carril) y cada una con su color (el código de colores de las fibras)
const COL_FIBRA = ['#2f6fed', '#ff8a00', '#2fb457', '#a0673a', '#8b97a3', '#e9edf0', '#e5484d', '#f5d90a', '#8e4ec6', '#e93d82', '#12a594', '#59636e'];
let FIB = null;
function carrilesFibra(ctx) { const L = ctx && ctx.piezas ? ctx.piezas().filter(q => q.t === 'fibra' && q.pts && q.pts.length > 1 && !(q.y > 0)) : [], f = L.map(q => q.id + q.pts.length + q.pts[0] + q.pts[q.pts.length - 1]).join('|'); if (FIB && FIB.f === f) return FIB;
  const junto = (a, b, c, d) => { const ux = b[0] - a[0], uz = b[1] - a[1], l = Math.hypot(ux, uz); if (l < 0.5) return false; const nx = -uz / l, nz = ux / l; if (Math.abs((c[0] - a[0]) * nx + (c[1] - a[1]) * nz) > 0.45 || Math.abs((d[0] - a[0]) * nx + (d[1] - a[1]) * nz) > 0.45) return false; const tc = ((c[0] - a[0]) * ux + (c[1] - a[1]) * uz) / l, td = ((d[0] - a[0]) * ux + (d[1] - a[1]) * uz) / l; return Math.min(Math.max(tc, td), l) - Math.max(Math.min(tc, td), 0) > 1; };
  const comparte = (p, q) => { for (let i = 1; i < p.pts.length; i++) for (let j = 1; j < q.pts.length; j++) if (junto(p.pts[i - 1], p.pts[i], q.pts[j - 1], q.pts[j])) return true; return false; }, car = new Map();
  L.forEach((p, i) => { const us = new Set(); for (let j = 0; j < i; j++) if (comparte(p, L[j])) us.add(car.get(L[j].id)); let k = 0; while (us.has(k)) k++; car.set(p.id, k); });
  FIB = { f, car, idx: new Map(L.map((q, i) => [q.id, i])) }; return FIB; }
// el pulso de luz que corre por las fibras (la textura se va corriendo cuadro a cuadro desde la maqueta)
function texFlujo() { if (AMB.flujo) return AMB.flujo; const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.82, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1 / 6); AMB.flujo = t; return t; }
// autos livianos (pocas caras) para las playas con cientos de autos: cuatro carrocerías genéricas, sin marca
const AUTITOS = {};
function autito(t) { if (AUTITOS[t]) return AUTITOS[t]; const D = { hatch: [4.0, 1.72, [[-2, .3], [2, .3], [2, .78], [1.8, .98], [.9, 1.02], [.35, 1.48], [-1.5, 1.48], [-2, 1.02]], [-1.35, .5, 1.08, 1.4], 1], sedan: [4.5, 1.76, [[-2.25, .3], [2.25, .3], [2.25, .76], [2.05, .94], [1.05, .98], [.45, 1.44], [-.95, 1.44], [-1.5, 1], [-2.25, .96]], [-.85, .6, 1.04, 1.36], 1], suv: [4.5, 1.84, [[-2.25, .36], [2.25, .36], [2.25, .9], [2, 1.12], [1.1, 1.16], [.6, 1.7], [-1.85, 1.7], [-2.25, 1.2]], [-1.7, .75, 1.22, 1.6], 1], furgon: [4.7, 1.9, [[-2.35, .38], [2.35, .38], [2.35, .95], [2.1, 1.22], [1.5, 1.27], [1.1, 1.98], [-2.35, 1.98]], [.3, 1.05, 1.32, 1.84], 0], pickup: [5.2, 1.84, [[-2.6, .38], [2.6, .38], [2.6, .92], [2.35, 1.14], [1.5, 1.18], [1, 1.74], [-.35, 1.74], [-.45, 1.12], [-2.6, 1.12]], [-.3, 1.12, 1.22, 1.64], 0] }[t] || null; if (!D) return autito('hatch');
  const [L, W, P, V, luneta] = D, cu = new THREE.ExtrudeGeometry(new THREE.Shape(P.map(q => new THREE.Vector2(q[0], q[1]))), { depth: W - 0.14, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 1, curveSegments: 1 }); cu.translate(0, 0, -(W - 0.14) / 2); cu.deleteAttribute('uv');
  const det = [], pon = (geo, hex) => { const g2 = geo.index ? geo.toNonIndexed() : geo; g2.deleteAttribute('uv'); const n = g2.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(hex); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g2.setAttribute('color', new THREE.BufferAttribute(col, 3)); det.push(g2); }, bx = (x0, x1, y0, y1, z0, z1, hex) => pon(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), hex);
  bx(V[0], V[1], V[2], V[3], -W / 2 - 0.012, W / 2 + 0.012, '#11161b'); bx(V[1] - 0.05, V[1] + 0.34, V[2] + 0.05, V[3] - 0.03, -W / 2 + 0.2, W / 2 - 0.2, '#11161b'); if (luneta) bx(V[0] - 0.3, V[0] + 0.05, V[2] + 0.07, V[3] - 0.03, -W / 2 + 0.22, W / 2 - 0.22, '#11161b');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pon(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10).rotateX(Math.PI / 2).translate(sx * (L / 2 - 0.78), 0.34, sz * (W / 2 - 0.1)), '#17191c');
  for (const sz of [-1, 1]) { bx(L / 2 - 0.03, L / 2 + 0.075, 0.66, 0.8, sz * (W / 2 - 0.5) - 0.2, sz * (W / 2 - 0.5) + 0.2, '#f6f2e4'); bx(-L / 2 - 0.075, -L / 2 + 0.03, 0.78, 0.92, sz * (W / 2 - 0.45) - 0.18, sz * (W / 2 - 0.45) + 0.18, '#b3261e'); }
  return (AUTITOS[t] = { cuerpo: cu, det: mergeGeometries(det) }); }

// ---------- camión con semirremolque: una sola forma para los que andan, los que esperan en un andén y los estacionados ----------
// Metros, largo sobre x (la cabina mira a +x), el centro en el medio del semirremolque. El tractor gira sobre el perno (x = PERNO).
// Cada parte viene en dos mallas: la que toma el color de la pieza (chapa, con lo oscuro pintado encima) y los detalles con su color propio.
export const PERNO = 4.9;
let CAMION = null;
export function camionGeo() { if (CAMION) return CAMION; const seg = FINO ? 18 : 10;
  const junta = () => { const L = [], pon = (geo, hex, k = 1) => { const g2 = geo.index ? geo.toNonIndexed() : geo; g2.deleteAttribute('uv'); const n = g2.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(hex); for (let i = 0; i < n; i++) { col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; } g2.setAttribute('color', new THREE.BufferAttribute(col, 3)); L.push(g2); };
    const bx = (x0, x1, y0, y1, z0, z1, hex, k) => pon(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), hex, k);
    const cil = (x, y, z, r, l, eje, hex, k, sg = seg) => { const g = new THREE.CylinderGeometry(r, r, l, sg); if (eje === 'z') g.rotateX(Math.PI / 2); else if (eje === 'x') g.rotateZ(Math.PI / 2); pon(g.translate(x, y, z), hex, k); };
    const perfil = (pts, ancho, bisel) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1]))), { depth: ancho - bisel * 2, bevelEnabled: true, bevelSize: bisel, bevelThickness: bisel, bevelSegments: FINO ? 2 : 1, curveSegments: 1 }); g.translate(0, 0, -(ancho - bisel * 2) / 2); return g; };
    // rueda: cubierta, llanta clara hacia afuera y maza
    const rueda = (x, z, an) => { const s = Math.sign(z); cil(x, 0.52, z, 0.52, an, 'z', '#15171a'); cil(x, 0.52, z + s * (an / 2 - 0.02), 0.31, 0.06, 'z', '#c3c8cd'); cil(x, 0.52, z + s * (an / 2 + 0.01), 0.11, 0.07, 'z', '#5d646b', 1, 8); };
    return { pon, bx, cil, perfil, rueda, fin: () => mergeGeometries(L) }; };
  const B = '#ffffff', OSC = '#101316', AL = '#aab1b8';
  // ---- semirremolque: chasis, ejes, patas, paragolpes, luces ----
  const R = junta(); R.bx(-6.05, 3.6, 0.98, 1.3, -0.56, -0.4, '#24282c'); R.bx(-6.05, 3.6, 0.98, 1.3, 0.4, 0.56, '#24282c'); R.bx(3.6, 6.1, 1.18, 1.3, -0.56, 0.56, '#24282c'); R.bx(-6.15, 6.15, 1.3, 1.38, -1.25, 1.25, '#2d3237');
  for (const x of [-5.1, -3.8, -2.5]) { R.rueda(x, 0.98, 0.62); R.rueda(x, -0.98, 0.62); R.cil(x, 0.52, 0, 0.09, 1.6, 'z', '#3a4047', 1, 6); R.bx(x - 0.66, x + 0.66, 1.1, 1.15, 0.64, 1.3, '#1b1e22'); R.bx(x - 0.66, x + 0.66, 1.1, 1.15, -1.3, -0.64, '#1b1e22'); }
  for (const z of [-1, 1]) { R.bx(-5.9, -5.86, 0.3, 1.0, z * 0.68, z * 1.28, '#16181b'); R.bx(-1.5, 3.1, 0.52, 0.6, z * 1.2 - 0.02, z * 1.2 + 0.02, AL); R.bx(-1.5, 3.1, 0.84, 0.92, z * 1.2 - 0.02, z * 1.2 + 0.02, AL); for (const x of [-1.45, 0.8, 3.05]) R.bx(x - 0.04, x + 0.04, 0.52, 1.3, z * 1.2 - 0.02, z * 1.2 + 0.02, AL);
    R.bx(3.42, 3.56, 0.14, 1.0, z * 0.84, z * 0.98, AL); R.bx(3.32, 3.66, 0.08, 0.14, z * 0.76, z * 1.06, '#7e868d'); R.bx(-6.21, -6.15, 0.86, 1.02, z * 0.72, z * 1.16, '#ff2a1c', 2.6); R.bx(-6.21, -6.15, 0.86, 1.02, z * 0.56, z * 0.7, '#ff9d1c', 1.5); for (const x of [-4.4, -0.6, 2.2, 5.2]) R.bx(x - 0.07, x + 0.07, 1.31, 1.37, z * 1.25, z * 1.275, '#ff9d1c', 1.6); }
  R.bx(-6.2, -6.1, 0.52, 0.68, -1.2, 1.2, '#c9ced2'); for (const z of [-0.85, -0.25, 0.35, 0.95]) R.bx(-6.21, -6.2, 0.53, 0.67, z - 0.14, z + 0.14, '#d7261e'); R.bx(-6.215, -6.2, 0.74, 0.86, -0.26, 0.26, '#f4f5f6'); R.bx(3.49, 3.5, 0.5, 0.56, -0.9, 0.9, AL); R.cil(PERNO, 1.14, 0, 0.42, 0.08, 'y', '#1b1e22'); R.bx(0.3, 1.9, 0.56, 1.0, -1.18, -0.5, '#3a4047');
  // ---- caja lisa (furgón o frigorífico) y contenedor: toman el color de la pieza ----
  const F = junta(); F.bx(-6.15, 6.15, 1.38, 4.13, -1.27, 1.27, B); for (const z of [-1, 1]) { F.bx(-6.17, 6.17, 1.36, 1.5, z * 1.27, z * 1.29, B, 0.55); F.bx(-6.17, 6.17, 4.02, 4.15, z * 1.27, z * 1.29, B, 0.7); for (let x = -4.92; x < 6; x += 1.23) F.bx(x - 0.012, x + 0.012, 1.5, 4.02, z * 1.27, z * 1.277, B, 0.78); }
  F.bx(-6.19, -6.15, 1.38, 4.13, -1.27, 1.27, B, 0.8); F.bx(-6.2, -6.19, 1.5, 4.02, -0.012, 0.012, B, 0.4); for (const z of [-0.95, -0.35, 0.35, 0.95]) { F.cil(-6.22, 2.76, z, 0.028, 2.5, 'y', B, 0.45, 6); F.bx(-6.26, -6.19, 2.2, 2.26, z - 0.02, z + 0.14, B, 0.45); }
  F.bx(6.15, 6.4, 2.45, 4.02, -0.85, 0.85, B, 0.92); F.bx(6.4, 6.42, 2.7, 3.7, -0.66, 0.66, OSC, 0.6); F.bx(6.4, 6.415, 2.5, 2.64, -0.3, 0.3, B, 0.6);
  const C = junta(), paso = FINO ? 0.56 : 1.12; C.bx(-6.03, 6.03, 1.44, 3.93, -1.17, 1.17, B, 0.9); for (const z of [-1, 1]) { for (let x = -5.88; x < 5.9; x += paso) C.bx(x, x + paso * 0.5, 1.56, 3.83, z * 1.17, z * 1.192, B, 0.94); C.bx(-6.1, 6.1, 1.38, 1.56, z * 1.14, z * 1.22, B, 0.72); C.bx(-6.1, 6.1, 3.83, 3.97, z * 1.14, z * 1.22, B, 0.72);
    for (const x of [-6.1, 5.94]) { C.bx(x, x + 0.16, 1.38, 3.97, z * 1.06, z * 1.22, B, 0.72); for (const y of [1.38, 3.8]) C.bx(x - 0.01, x + 0.17, y, y + 0.17, z * 1.05, z * 1.23, B, 0.45); } }
  C.bx(-6.07, -6.03, 1.5, 3.9, -1.08, 1.08, B, 0.85); C.bx(-6.08, -6.07, 1.5, 3.9, -0.012, 0.012, B, 0.35); for (const z of [-0.8, -0.3, 0.3, 0.8]) { C.cil(-6.1, 2.7, z, 0.026, 2.36, 'y', B, 0.5, 6); C.bx(-6.14, -6.07, 2.3, 2.36, z - 0.02, z + 0.13, B, 0.5); } for (let y = 1.7; y < 3.8; y += 0.42) C.bx(6.03, 6.06, y, y + 0.21, -1.06, 1.06, B);
  // ---- tractor: cabina (toma el color), vidrios y parrilla oscuros encima ----
  const K = junta(); K.pon(K.perfil([[6.55, 1.1], [9.12, 1.1], [9.16, 1.9], [9.1, 2.25], [8.93, 3.35], [8.72, 3.72], [6.75, 3.78], [6.55, 3.6]], 2.5, 0.06), B); K.pon(K.perfil([[6.62, 3.8], [8.62, 3.8], [8.3, 4.03], [6.8, 4.3], [6.62, 4.3]], 2.36, 0.04), B);
  K.pon(new THREE.BoxGeometry(0.04, 1.0, 2.16).rotateZ(0.153).translate(9.085, 2.82, 0), OSC, 0.5); for (const z of [-1, 1]) { K.bx(7.95, 8.86, 2.42, 3.2, z * 1.245, z * 1.262, OSC, 0.5); K.bx(7.38, 7.9, 2.42, 3.2, z * 1.245, z * 1.262, OSC, 0.5); K.bx(7.2, 7.215, 1.3, 3.5, z * 1.25, z * 1.258, B, 0.5); K.bx(7.5, 7.62, 1.95, 2.0, z * 1.25, z * 1.275, OSC); K.bx(7.72, 9.05, 1.1, 1.32, z * 1.0, z * 1.27, B, 0.8); }
  K.bx(9.19, 9.235, 1.2, 2.06, -0.96, 0.96, OSC, 0.6); K.bx(8.98, 9.34, 3.37, 3.46, -1.22, 1.22, OSC, 0.9); K.bx(9.2, 9.24, 2.1, 2.2, -0.5, 0.5, B, 0.5);
  const D = junta(); D.bx(3.85, 9.0, 0.78, 1.05, -0.5, -0.38, '#22262a'); D.bx(3.85, 9.0, 0.78, 1.05, 0.38, 0.5, '#22262a'); D.bx(3.85, 3.95, 0.78, 1.05, -0.5, 0.5, '#22262a'); D.bx(8.98, 9.3, 0.5, 1.1, -1.27, 1.27, '#2b3035'); D.bx(9.3, 9.315, 0.56, 0.7, -0.26, 0.26, '#f4f5f6');
  for (const z of [-1, 1]) { D.rueda(8.35, z * 1.05, 0.36); D.rueda(PERNO, z * 0.98, 0.62); D.bx(4.2, 5.6, 1.08, 1.13, z * 0.64, z * 1.3, '#1b1e22'); D.bx(4.2, 4.25, 0.5, 1.08, z * 0.66, z * 1.28, '#16181b'); D.bx(9.3, 9.33, 0.74, 0.97, z * 0.72, z * 1.17, '#fff3d6', 3.2); D.bx(9.3, 9.33, 0.6, 0.69, z * 0.82, z * 1.12, '#ff9d1c', 1.5);
    D.cil(6.55, 0.84, z * 0.96, 0.33, 1.5, 'x', '#b4bbc1'); D.bx(6.1, 6.16, 0.5, 1.18, z * 0.62, z * 1.3, '#2b3035'); D.bx(6.94, 7.0, 0.5, 1.18, z * 0.62, z * 1.3, '#2b3035'); D.bx(7.3, 7.75, 0.56, 0.62, z * 1.0, z * 1.26, AL); D.bx(7.3, 7.75, 0.84, 0.9, z * 1.0, z * 1.26, AL);
    D.bx(9.0, 9.08, 2.5, 3.16, z * 1.4, z * 1.56, '#17191c'); D.bx(8.99, 9.03, 2.8, 2.86, z * 1.25, z * 1.42, '#17191c'); D.bx(3.86, 3.9, 0.82, 0.98, z * 0.58, z * 0.9, '#ff2a1c', 2.4); }
  D.cil(6.44, 2.55, 1.1, 0.07, 2.9, 'y', '#aeb5bb', 1, 8); D.cil(PERNO, 1.09, 0, 0.5, 0.08, 'y', '#15171a'); for (const y of [1.36, 1.58, 1.8]) D.bx(9.235, 9.25, y, y + 0.05, -0.9, 0.9, '#c9ced2');
  CAMION = { remolque: R.fin(), lisa: F.fin(), contenedor: C.fin(), cabina: K.fin(), tractor: D.fin() }; return CAMION; }
// materiales compartidos: el que toma el color de cada pieza y el de los detalles
const MAT_CAM = {};
// reach stacker (tipo Kalmar DRF), armado de cerca: chasis, capot y contrapeso con cantos redondeados, guardabarros curvos sobre las ruedas dobles,
// cubiertas con dibujo y llanta con maza, cabina vidriada con parantes, techo, faros, espejos y baliza, escape, barandas y escalones;
// pluma de sección ochavada que nace atrás entre dos chapas con su perno, tramo telescópico, bandeja de mangueras que bajan al rotador;
// dos cilindros de levante (camisa y vástago cromado, con sus ojos); en la punta el rotador y el spreader atravesado con vigas,
// cabezales y twistlocks. Pintura con polvo y desgaste dibujados acá (no salen de ningún archivo). Adelante (+x) va el spreader.
let RSG = null; const RSM = new Map();
function rsTex(clave, dibujar, w = 256, h = 256) { let t = RSM.get('t' + clave); if (t) return t; const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; RSM.set('t' + clave, t); return t; }
function rsMat(c, o = {}) { const os = oscuro(), k = c + os + JSON.stringify(o); let m = RSM.get(k); if (m) return m;
  const R = azar(7), sucio = rsTex('pint', (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 150 + R() * 90 | 0; x.fillStyle = `rgba(${v},${v - 10},${v - 24},${0.3 + R() * 0.4})`; x.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 2); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,100,80,${0.05 + R() * 0.08})`; x.fillRect(R() * w, R() * h * 0.4 + h * 0.6, 4 + R() * 30, 1 + R() * 4); } });
  const { sinPolvo, ...oo } = o, gastado = sinPolvo ? c : mix(c, '#8f8478', 0.16); m = new THREE.MeshStandardMaterial(Object.assign({ color: os && !o.emissive ? mix(gastado, '#000', 0.35) : gastado, roughness: 0.6, metalness: 0.2 }, sinPolvo ? {} : { map: sucio, roughnessMap: sucio }, oo)); RSM.set(k, m); return m; }
function rsGeo() { if (RSG) return RSG;
  const V = (x, y) => new THREE.Vector2(x, y), ext = (pts, w, bev = 0.05) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => V(x, y))), { depth: Math.max(0.01, w - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2 }); g.translate(0, 0, -(w - 2 * bev) / 2); return g; };
  const arco = (R, r, w, a0 = 0.15) => { const s = new THREE.Shape(); s.absarc(0, 0, R, a0, Math.PI - a0, false); s.absarc(0, 0, r, Math.PI - a0, a0, true); const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 18 }); g.translate(0, 0, -w / 2); return g; };
  const ocha = (W, H, c) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape([[-W / 2 + c, -H / 2], [W / 2 - c, -H / 2], [W / 2, -H / 2 + c], [W / 2, H / 2 - c], [W / 2 - c, H / 2], [-W / 2 + c, H / 2], [-W / 2, H / 2 - c], [-W / 2, -H / 2 + c]].map(([x, y]) => V(x, y))), { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2); return g; };
  const cub = [[0.6, -0.5], [0.86, -0.5], [0.95, -0.44], [1, -0.24], [1, 0.24], [0.95, 0.44], [0.86, 0.5], [0.6, 0.5]].map(([r, y]) => V(r, y)), llanta = [[0, -0.42], [0.5, -0.42], [0.6, -0.46], [0.62, -0.44], [0.62, 0.44], [0.6, 0.46], [0.5, 0.46], [0.22, 0.5], [0.12, 0.62], [0, 0.62]].map(([r, y]) => V(r, y));
  RSG = { chasis: ext([[2.35, 0.6], [2.35, 1.25], [1.9, 1.7], [-5.3, 1.7], [-5.3, 0.6]], 2.1, 0.04), capot: ext([[-2.35, 1.7], [-2.35, 2.45], [-2.62, 2.8], [-5.1, 2.8], [-5.38, 2.5], [-5.38, 1.7]], 1.95, 0.06),
    contra: ext([[-5.3, 0.5], [-5.3, 2.72], [-5.52, 2.98], [-6.4, 2.98], [-6.82, 2.58], [-6.95, 1.2], [-6.72, 0.5]], 2.95, 0.08), placa: ext([[-4.95, 1.7], [-3.6, 1.7], [-3.8, 3.35], [-4.55, 3.5], [-4.95, 3.1]], 0.12, 0.02),
    gAd: arco(1.0, 0.92, 1.32), gAt: arco(0.86, 0.79, 0.62, 0.35), botalon: ocha(0.86, 1.05, 0.15), tramo: ocha(0.66, 0.8, 0.11), viga: ocha(0.36, 0.5, 0.06),
    cub: new THREE.LatheGeometry(cub, 30).rotateX(Math.PI / 2), llanta: new THREE.LatheGeometry(llanta, 20).rotateX(Math.PI / 2), tubo: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), perno: new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateX(Math.PI / 2) };
  // polvo de abajo hacia arriba: más oscuro y terroso cerca del piso, como se ensucia una máquina que anda en tosca
  for (const [k, y0, y1] of [['chasis', 0.5, 1.9], ['capot', 1.6, 2.9], ['contra', 0.4, 2.9], ['placa', 1.6, 3.4]]) { const P = RSG[k].attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const t = Math.min(1, Math.max(0, (P.getY(i) - y0) / (y1 - y0))), v = 0.34 + 0.66 * t * t * (3 - 2 * t); col[i * 3] = v; col[i * 3 + 1] = v * (0.9 + 0.1 * t); col[i * 3 + 2] = v * (0.78 + 0.22 * t); }
    RSG[k].setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  return RSG; }
function reachStacker(g, p) {
  const G = rsGeo(), os = oscuro(), rojo = p.color || '#c23b2a', C = rsMat(rojo, { roughness: 0.5, metalness: 0.25 }), GR = rsMat('#5a6065', { roughness: 0.55, metalness: 0.45 }), N = rsMat('#24272b', { roughness: 0.75, metalness: 0.3 }),
    NE = rsMat('#141618', { roughness: 0.9, sinPolvo: true }), GO = rsMat('#17191b', { roughness: 0.96, sinPolvo: true, bumpMap: rsTex('surco', (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#000'; for (let i = 0; i < 26; i++) { const u = i * w / 26; x.beginPath(); x.moveTo(u, 0); x.lineTo(u + 14, h / 2); x.lineTo(u, h); x.lineTo(u + 10, h); x.lineTo(u + 24, h / 2); x.lineTo(u + 10, 0); x.fill(); } }, 1024, 64), bumpScale: 2.5 }), CR = rsMat('#e2e6e9', { roughness: 0.12, metalness: 0.95, sinPolvo: true }), LL = rsMat('#7d8388', { roughness: 0.45, metalness: 0.6 }),
    VI = rsMat('#6f8a99', { roughness: 0.04, metalness: 0.55, transparent: true, opacity: 0.38, sinPolvo: true }), OX = rsMat('#7c4a33', { roughness: 0.85, metalness: 0.35 }),
    AM = rsMat('#ffb020', { emissive: '#ff8a00', emissiveIntensity: os ? 1.4 : 0.5, sinPolvo: true }), FA = rsMat('#f5f3ea', { emissive: '#fff6d8', emissiveIntensity: os ? 1.6 : 0.15, sinPolvo: true }), RO = rsMat('#a5121b', { emissive: '#ff1a1a', emissiveIntensity: os ? 1 : 0.2, sinPolvo: true });
  const pon = (geo, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); g.add(sombra(k)); return k; };
  const _u = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  const barra = (a, b, r, m) => { _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _d.length(), k = pon(G.tubo, m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); k.scale.set(r * 2, L, r * 2); k.quaternion.setFromUnitVectors(_u, _d.normalize()); return k; };
  const largo = (geo, a, b, z, m) => { const k = pon(geo, m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z); k.scale.x = Math.hypot(b[0] - a[0], b[1] - a[1]); k.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); return k; };
  const perno = (x, y, z, r, w, m = CR) => { const k = pon(G.perno, m, x, y, z); k.scale.set(r * 2, r * 2, w); return k; };
  // ruedas: adelante dobles (motrices), atrás simples (las que doblan)
  const rueda = (x, z, r, w, afuera) => { const c = pon(G.cub, GO, x, r, z); c.scale.set(r, r, w); const l = pon(G.llanta, LL, x, r, z); l.scale.set(r, r, w * 0.55 * afuera); return c; };
  for (const s of [-1, 1]) { rueda(1.3, s * 1.34, 0.84, 0.6, s); rueda(1.3, s * 1.97, 0.84, 0.6, s); rueda(-4.55, s * 1.3, 0.72, 0.58, s); }
  perno(1.3, 0.84, 0, 0.16, 3.2, N); perno(-4.55, 0.72, 0, 0.13, 2.3, N);   // ejes
  const CV = rsMat(rojo, { roughness: 0.5, metalness: 0.25, vertexColors: true }); pon(G.chasis, CV); pon(G.capot, CV); pon(G.contra, CV); caja(g, -5.35, 0.52, -1.1, 2.4, 0.98, 1.1, N);
  for (const s of [-1, 1]) { pon(G.gAd, C, 1.3, 0.84, s * 1.66); pon(G.gAt, C, -4.55, 0.72, s * 1.3).scale.z = s; caja(g, 0.5, 1.62, s > 0 ? 1.05 : -1.12, 2.1, 1.7, s > 0 ? 1.12 : -1.05, N); }
  // capot: rejillas a los costados, barandas arriba, escape; contrapeso: paragolpes, luces de atrás y el número
  for (const s of [-1, 1]) { for (let i = 0; i < 6; i++) caja(g, -4.95, 1.98 + i * 0.09, s * 1.035 - 0.012, -3.25, 2.02 + i * 0.09, s * 1.035 + 0.012, N, false);
    barra([-5.1, 2.82, s * 0.85], [-5.1, 3.25, s * 0.85], 0.025, rsMat('#e8c23a', { sinPolvo: true })); barra([-2.7, 2.82, s * 0.85], [-2.7, 3.25, s * 0.85], 0.025, rsMat('#e8c23a', { sinPolvo: true })); barra([-5.1, 3.25, s * 0.85], [-2.7, 3.25, s * 0.85], 0.025, rsMat('#e8c23a', { sinPolvo: true }));
    caja(g, -6.99, 2.2, s * 1.2 - 0.14, -6.9, 2.4, s * 1.2 + 0.14, RO, false); caja(g, -6.99, 2.0, s * 1.2 - 0.08, -6.9, 2.15, s * 1.2 + 0.08, FA, false); }
  caja(g, -7.05, 0.42, -1.55, -6.82, 0.92, 1.55, N);
  for (const s of [-1, 1]) { for (const x of [-5.45, -3.6]) caja(g, x - 0.012, 1.75, s * 1.035 - 0.012, x + 0.012, 2.78, s * 1.035 + 0.012, N, false); caja(g, -6.7, 1.6, s * 1.565 - 0.01, -5.4, 1.625, s * 1.565 + 0.01, N, false);
    for (let i = 0; i < 4; i++) for (const y of [0.75, 2.75]) cil(g, -6.6 + i * 0.36, y, s * 1.52, 0.035, 0.07, N).rotation.x = Math.PI / 2; }   // juntas de chapa y bulones del contrapeso barra([-2.75, 2.8, -0.72], [-2.75, 4.0, -0.72], 0.075, NE); barra([-2.75, 4.0, -0.72], [-2.95, 4.15, -0.72], 0.075, NE);
  if (p.nombre && p.nombre.length <= 8) { const t = rsTex('n' + p.nombre, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f4f4f0'; x.font = 'bold 92px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.nombre, w / 2, h / 2 + 4); }, 512, 128);
    for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, color: os ? '#9a9a96' : '#ffffff' })); k.position.set(-6.0, 2.35, s * 1.565); k.rotation.y = s > 0 ? 0 : Math.PI; g.add(k); } }
  // cabina: base, vidrios grandes, parantes, puerta con manija, techo con visera, faros de trabajo, baliza, espejos, escalones
  caja(g, -2.32, 1.7, -1.0, -0.3, 2.25, 1.0, N); caja(g, -2.22, 2.25, -0.92, -0.4, 3.95, 0.92, VI);
  caja(g, -2.0, 2.25, -0.35, -1.5, 2.7, 0.35, NE); caja(g, -2.1, 2.7, -0.35, -1.95, 3.35, 0.35, NE); caja(g, -1.1, 2.25, -0.5, -0.5, 2.85, 0.5, N); barra([-0.95, 2.85, 0], [-1.25, 3.05, 0], 0.025, NE); cil(g, -1.28, 3.02, 0, 0.17, 0.04, NE);   // asiento, consola y volante
  for (const [x, z] of [[-2.27, -0.97], [-2.27, 0.97], [-0.35, -0.97], [-0.35, 0.97], [-1.3, -0.97], [-1.3, 0.97]]) caja(g, x - 0.05, 2.25, z - 0.04, x + 0.05, 3.97, z + 0.04, N);
  for (const y of [2.25, 3.95]) for (const s of [-1, 1]) caja(g, -2.3, y - 0.04, s * 0.97 - 0.04, -0.32, y + 0.04, s * 0.97 + 0.04, N);
  caja(g, -2.42, 3.95, -1.06, -0.2, 4.12, 1.06, N); caja(g, -2.3, 4.12, -0.94, -0.36, 4.2, 0.94, rsMat('#2e3236')); caja(g, -0.2, 3.98, -1.0, 0.02, 4.06, 1.0, N);
  for (const s of [-1, 1]) { caja(g, -0.18, 4.12, s * 0.62 - 0.12, -0.05, 4.3, s * 0.62 + 0.12, FA); caja(g, -0.5, 4.12, s * 0.62 - 0.14, -0.18, 4.32, s * 0.62 + 0.14, N);
    barra([-0.35, 3.6, s * 0.97], [-0.05, 3.7, s * 1.35], 0.025, N); caja(g, -0.1, 3.35, s * 1.35 - 0.04, 0.0, 3.8, s * 1.35 + 0.04, N); }
  cil(g, -1.6, 4.2, 0.55, 0.11, 0.18, AM); caja(g, -1.25, 3.0, -1.0, -1.1, 3.05, -0.97, CR);
  for (let i = 0; i < 4; i++) caja(g, -1.85, 0.45 + i * 0.36, -1.42, -1.15, 0.5 + i * 0.36, -1.08, N); barra([-1.95, 0.6, -1.42], [-1.95, 2.3, -1.42], 0.022, rsMat('#e8c23a', { sinPolvo: true }));
  // pluma: chapas de la torre con el perno, tramo de afuera, tramo telescópico, bandeja con mangueras
  const P = [-4.3, 3.1], A = 0.4, ca = Math.cos(A), sa = Math.sin(A), en = (d, n = 0) => [P[0] + ca * d - sa * n, P[1] + sa * d + ca * n], T = en(12.4);
  for (const s of [-1, 1]) pon(G.placa, CV, 0, 0, s * 0.58); perno(P[0], P[1], 0, 0.2, 1.45);
  largo(G.botalon, en(-0.6), en(8.7), 0, GR); largo(G.tramo, en(8.4), T, 0, GR);
  for (const s of [-1, 1]) largo(G.tramo, en(0.4, 0.2), en(8.4, 0.2), s * 0.44, N).scale.set(1, 0.06, 0.04);   // cordón de soldadura
  largo(G.tramo, en(0.9, 0.58), en(8.2, 0.58), 0, N).scale.set(1, 0.08, 0.75);
  for (const z of [-0.18, -0.06, 0.06, 0.18]) largo(G.perno, en(0.9, 0.65), en(8.2, 0.65), z, NE).scale.set(1, 0.07, 0.07);
  for (const s of [-1, 1]) { const q = en(10.5, 0.45), h = new THREE.CatmullRomCurve3([new THREE.Vector3(...en(8.2, 0.65), s * 0.12), new THREE.Vector3(q[0], q[1] + 0.35, s * 0.25), new THREE.Vector3(T[0] - 0.1, T[1] - 0.2, s * 0.42), new THREE.Vector3(T[0] + 0.05, T[1] - 1.3, s * 0.3)]);
    g.add(sombra(new THREE.Mesh(new THREE.TubeGeometry(h, 24, 0.035, 6), NE))); }
  for (const d of [3.0, 6.0]) for (const s of [-1, 1]) caja(g, ...en(d, 0.53), s * 0.2 - 0.07, ...en(d + 0.15, 0.62), s * 0.2 + 0.07, FA).rotation.z = A;
  // cilindros de levante: camisa abajo, vástago cromado arriba, ojos con perno
  const B = en(5.0, -0.5); for (const s of [-1, 1]) { const z = s * 0.58, a = [1.6, 1.85, z], m = [1.6 + (B[0] - 1.6) * 0.56, 1.85 + (B[1] - 1.85) * 0.56, z]; caja(g, 1.25, 1.6, z - 0.2, 1.95, 2.05, z + 0.2, C);
    barra(a, m, 0.2, N); barra([m[0] - 0.06, m[1] - 0.25, z], [m[0] + 0.04, m[1] + 0.1, z], 0.23, N); barra(m, [B[0], B[1], z], 0.11, CR); perno(1.6, 1.85, z, 0.13, 0.5); perno(B[0], B[1], z, 0.13, 0.5); }
  // rotador y spreader atravesado: vigas telescópicas, marco del medio, cabezales en las puntas y twistlocks
  caja(g, T[0] - 0.5, T[1] - 0.55, -0.45, T[0] + 0.5, T[1] + 0.42, 0.45, GR); perno(T[0], T[1] - 0.1, 0, 0.18, 1.1);
  caja(g, T[0] - 0.32, T[1] - 1.5, -0.32, T[0] + 0.32, T[1] - 0.55, 0.32, OX); const Y = T[1] - 2.35;
  cil(g, T[0], Y + 0.5, 0, 0.6, 0.32, N); caja(g, T[0] - 0.62, Y, -1.15, T[0] + 0.62, Y + 0.52, 1.15, OX);
  for (const s of [-1, 1]) { const v = pon(G.viga, OX, T[0] + s * 0.32, Y + 0.25, 0); v.scale.x = 6.2; v.rotation.y = Math.PI / 2;
    const cz = s * 3.05; caja(g, T[0] - 1.25, Y - 0.05, cz - 0.17, T[0] + 1.25, Y + 0.45, cz + 0.17, OX);
    for (const u of [-1, 1]) { caja(g, T[0] + u * 1.13 - 0.16, Y - 0.22, cz - 0.16, T[0] + u * 1.13 + 0.16, Y - 0.05, cz + 0.16, N); cil(g, T[0] + u * 1.13, Y - 0.34, cz, 0.06, 0.12, CR); } }
  for (const s of [-1, 1]) barra([T[0] + 0.62, Y + 0.3, s * 0.4], [T[0] + 0.62, Y + 0.3, s * 2.9], 0.03, NE);
  return g; }

export function matCamion() { if (!MAT_CAM.t) { MAT_CAM.t = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, metalness: 0.22 }); MAT_CAM.d = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.62, metalness: 0.3 }); } return MAT_CAM; }
// un camión o un semirremolque quieto, armado como pieza (color de carga vacío = chasis solo)
function camionQuieto(g, carga, cabina) { const G = camionGeo(), M = matCamion(), pinta = hex => { const m = M.t.clone(); m.color.set(oscuro() ? mix(hex, '#000', 0.4) : hex); return m; }, pon = (geo, m, s = true) => { const k = new THREE.Mesh(geo, m); k.castShadow = s; k.receiveShadow = true; g.add(k); return k; };
  pon(G.remolque, M.d); if (carga) pon(/^#(f|e|d)/i.test(carga) ? G.lisa : G.contenedor, pinta(carga)); if (cabina) { pon(G.cabina, pinta(cabina)); pon(G.tractor, M.d); } g.userData.sinAplanar = true; return g; }

// estacionamiento de camiones: lugares largos (derechos o en ángulo) con sus líneas pintadas y semirremolques esperando. El fondo de cada lugar mira a +z.
function estCamiones(p, g, os, C, R, po) { const LU = +p.lugar > 3.2 ? +p.lugar : 4, DP = 16.5, a = Math.max(-60, Math.min(60, +p.angulo || 0)) * Math.PI / 180, w = C * LU / 2, d = R * DP / 2, lg = DP / Math.cos(a), co = Math.abs(Math.tan(a)) * DP / 2, sn = Math.sin(a), cs = Math.cos(a);
  if (!p.sinPiso) { const ps = new THREE.Mesh(new THREE.PlaneGeometry(C * LU + co * 2 + 1, R * DP + 1).rotateX(-Math.PI / 2), calmo(matTex(texSuelo('asfalto'), os ? '#55595c' : '#ffffff', [(C * LU + co * 2 + 1) / METROS.asfalto, (R * DP + 1) / METROS.asfalto], { roughness: 0.94, ...po }), 0.38)); ps.position.y = 0.045; ps.receiveShadow = true; ps.userData.noChoca = true; g.add(ps); }
  const lin = [], lisos = [], conts = [], R0 = azar(semilla(p)), COL = os ? ['#9aa1a8', '#8b949c', '#a3a9ae', '#59463a', '#4e3b30', '#27405f', '#7a3230'] : ['#eceff1', '#f4f5f6', '#dfe3e6', '#f4f5f6', '#8a5a3c', '#7b4a32', '#2f5f9e', '#a8322b', '#3d6b4f'];
  for (let r = 0; r < R; r++) { const zc = -d + r * DP + DP / 2; for (let c = 0; c <= C; c++) lin.push([-w + c * LU, 0.054, zc, a, 0.14, 0.012, lg]);
    for (let c = 0; c < C; c++) { if (R0() * 100 >= p.ocupacion) continue; const col = COL[(R0() * COL.length) | 0], k = (R0() - 0.5) * 0.9, it = [-w + (c + 0.5) * LU + sn * k, 0, zc + cs * k, a + Math.PI / 2, 1, 1, 1, col]; (/^#(f|e|d|9|a)/i.test(col) ? lisos : conts).push(it); } }
  const ll = lote(g, CAJA, mat(os ? '#9fb2c2' : '#f2f4f5', { roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -8 }), lin, false); if (ll) ll.userData.noChoca = true;
  // semirremolques esperando (sin tractor): los claros son furgones y los de color, contenedores
  const G = camionGeo(), M = matCamion(); lote(g, G.remolque, M.d, [...lisos, ...conts].map(q => q.slice(0, 7))); lote(g, G.lisa, M.t, lisos); lote(g, G.contenedor, M.t, conts); return g; }

export const TIPOS = {
  // terreno y caminos
  terreno: { n: 'Terreno', g: 'Terreno', forma: 'area', capa: 'base', def: { mat: 'tierra' },
    campos: [F.nombre, { k: 'mat', n: 'Superficie', t: 'sel', ops: [['tierra', 'Tierra o balasto'], ['ripio', 'Ripio'], ['tosca', 'Tosca (patio de contenedores)'], ['hormigon', 'Hormigón'], ['calzada', 'Hormigón de calzada'], ['asfalto', 'Asfalto'], ['adoquin', 'Adoquines'], ['pasto', 'Pasto'], ['pasto2', 'Pasto oscuro'], ['monte', 'Monte'], ['cultivo', 'Cultivo en hileras'], ['agua', 'Agua']] }, { k: 'cordon', n: 'Con cordón alrededor (cantero o isla)', t: 'bool' }, { k: 'borde', n: 'Cordón ancho de hormigón hacia adentro (m)', t: 'num', min: 0, max: 12, paso: 0.1 }, { k: 'flechas', n: 'Flechas de sentido en el cordón', t: 'sel', ops: [['', 'Sin flechas'], ['anti', 'Giro antihorario'], ['hor', 'Giro horario']] }],
    armar(p, ctx) { const g = new THREE.Group(), y = ({ agua: 0.012, pasto: 0.016, pasto2: 0.018, monte: 0.018, cultivo: 0.02, tierra: 0.026, ripio: 0.03, tosca: 0.03, hormigon: 0.034, asfalto: 0.038, calzada: 0.038 }[p.mat] ?? 0.026) + (p.sobre ? 0.03 : 0), bo = +p.borde > 0 && p.pts.length > 2 ? adentro(p.pts, +p.borde) : null;
      let m; if (p.mat === 'cultivo') { const t = rayas(suelo('cultivo'), oscuro() ? '#1d2818' : '#8eaa72', 10).clone(); t.needsUpdate = true; t.repeat.set(1 / 20, 1 / 20); m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); }
      else { const po = { polygonOffset: true, polygonOffsetFactor: -Math.round(y * 100) - (bo ? 2 : 0), polygonOffsetUnits: -2 }; m = matSuelo(p.textura || p.mat, po) || mat(suelo(p.mat), { roughness: p.mat === 'agua' ? 0.15 : 0.97, metalness: p.mat === 'agua' ? 0.1 : 0, ...po }); if (p.mat === 'calzada' && m.map) m = calzadaReal(m); else if (/^(pasto|pasto2)$/.test(p.mat) && m.map && !oscuro()) m = conManchas(m); }
      // con borde: cordón ancho de hormigón con caída alrededor y la superficie adentro, un escalón más arriba (la isla de una rotonda)
      const ALTO_B = 0.15; if (bo) try { bordeIsla(g, p.pts, bo, y + 0.004, y + ALTO_B, p.flechas, { polygonOffset: true, polygonOffsetFactor: -Math.round(y * 100) - 1, polygonOffsetUnits: -2 }); } catch (e) { console.warn('borde', e); }
      const k = area(g, bo || p.pts, y + (bo ? ALTO_B : 0), m, bo ? null : p.huecos); if (p.cordon && !bo) try { cordonDe(g, p); } catch (e) {} if (ctx && ctx.piezas && /^(pasto|pasto2|monte)$/.test(p.mat) && p.matas !== false) try { matas(g, bo ? { ...p, pts: bo, huecos: null } : p, ctx); } catch (e) { console.warn('matas', e); } if (k && p.mat === 'cultivo') { const uv = k.geometry.attributes.uv, pos = k.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i)); } return g; } },
  bosque: { n: 'Monte o arboleda', g: 'Vegetación', forma: 'area', capa: 'vegetacion', def: { densidad: 40, tipo: 'fronda' },
    campos: [F.nombre, { k: 'tipo', n: 'Árboles', t: 'sel', ops: [['fronda', 'Fronda'], ['pino', 'Pino'], ['mixto', 'Mixto']] }, { k: 'densidad', n: 'Árboles por hectárea', t: 'num', min: 5, max: 200, paso: 5 }],
    armar(p) { const g = new THREE.Group(); area(g, p.pts, 0.014, matSuelo('monte', { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })); const xs = p.pts.map(q => q[0]), zs = p.pts.map(q => q[1]), R = azar(semilla(p)), dentro = (x, z) => { let c = false; for (let i = 0, j = p.pts.length - 1; i < p.pts.length; j = i++) { const a = p.pts[i], b = p.pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), n = Math.min(4000, Math.round((x1 - x0) * (z1 - z0) / 10000 * p.densidad)), pts = [];
      for (let i = 0; i < n * 1.6 && pts.length < n; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (dentro(x, z)) pts.push([x, z, R()]); }
      arbolado(g, pts.map(([x, z, k]) => [x, z, p.tipo === 'mixto' ? (k < 0.3 ? 'pino' : 'fronda') : p.tipo, 0.75 + k * 0.6])); return g; } },
  loma: { n: 'Loma o terraplén (pasto o tierra)', g: 'Terreno', forma: 'area', capa: 'base', etiqueta: p => p.nombre, def: { mat: 'pasto', alto: 3, talud: 2, forma: 'loma' },
    campos: [F.nombre, { k: 'mat', n: 'De qué es', t: 'sel', ops: [['pasto', 'Pasto, con tierra a la vista en la ladera'], ['pasto2', 'Pasto parejo'], ['tierra', 'Tierra'], ['ripio', 'Ripio o balasto']] }, F.alto('Altura (m)', 0.3, 40, 0.1),
      { k: 'talud', n: 'Ladera: metros de ancho por cada metro de altura', t: 'num', min: 0.5, max: 12, paso: 0.25 }, { k: 'forma', n: 'Forma', t: 'sel', ops: [['loma', 'Loma natural, redondeada'], ['meseta', 'Terraplén, plano arriba']] }],
    armar(p) { const g = new THREE.Group(), f = lomaDe(p); g.userData.sinAplanar = true; if (!f) return g; const bb = cajaDe(p.pts), L = Math.max(1.2, Math.min(7, Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 70));
      const geo = partir(new THREE.ShapeGeometry(new THREE.Shape(p.pts.map(q => new THREE.Vector2(q[0], -q[1])))), L).rotateX(-Math.PI / 2), a = geo.attributes.position, t = new Float32Array(a.count);
      for (let i = 0; i < a.count; i++) a.setY(i, 0.03 + f(a.getX(i), a.getZ(i))); a.needsUpdate = true; geo.computeVertexNormals(); const N = geo.attributes.normal;
      // donde la ladera es empinada el pasto no agarra del todo y se ve la tierra, en manchones
      if (p.mat === 'pasto') for (let i = 0; i < a.count; i++) { const ny = Math.max(0.2, N.getY(i)), pend = Math.sqrt(Math.max(0, 1 - ny * ny)) / ny, x = a.getX(i), z = a.getZ(i); t[i] = Math.max(0, Math.min(0.9, (pend - 0.14) * 3 * (0.6 + 0.4 * Math.sin(x * 0.23 + z * 0.17) * Math.sin(z * 0.29 - x * 0.11)))); }
      geo.setAttribute('tierra', new THREE.BufferAttribute(t, 1)); geo.computeBoundingSphere(); g.add(sombra(new THREE.Mesh(geo, matLoma(p.mat)))); return g; } },
  // relieve: no se ubica como una pieza, se pinta con el pincel (subir, bajar, nivelar, alisar). Hay uno por maqueta y crece donde se pinta.
  relieve: { n: 'Relieve (subir y bajar el terreno con el pincel)', g: 'Terreno', forma: 'punto', capa: 'base', herramienta: 'relieve', etiqueta: p => p.nombre, def: { mat: 'pasto', celda: 2, alt: {} },
    variantes: [{ n: 'Pincel de terreno: subir', o: { modo: 'subir' } }, { n: 'Pincel de terreno: bajar', o: { modo: 'bajar' } }, { n: 'Pincel de terreno: nivelar', o: { modo: 'nivelar' } }, { n: 'Pincel de terreno: alisar', o: { modo: 'alisar' } }],
    campos: [F.nombre, { k: 'mat', n: 'De qué es', t: 'sel', ops: [['pasto', 'Pasto, con tierra a la vista en lo empinado'], ['pasto2', 'Pasto parejo'], ['tierra', 'Tierra'], ['ripio', 'Ripio o balasto']] }],
    armar(p) { const g = new THREE.Group(); g.userData.sinAplanar = true; const R = relieveDe(p); if (!R) return g; const { c, h } = R, I0 = R.i0 - 1, J0 = R.j0 - 1, nI = R.i1 - R.i0 + 3, nJ = R.j1 - R.j0 + 3;
      const pos = new Float32Array(nI * nJ * 3), uv = new Float32Array(nI * nJ * 2), idx = [];
      for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const k = j * nI + i, x = (I0 + i) * c, z = (J0 + j) * c; pos[k * 3] = x; pos[k * 3 + 1] = 0.03 + h(I0 + i, J0 + j); pos[k * 3 + 2] = z; uv[k * 2] = x + R.ox; uv[k * 2 + 1] = -(z + R.oz); }
      for (let j = 0; j < nJ - 1; j++) for (let i = 0; i < nI - 1; i++) { const a = j * nI + i, b = a + nI, e = a + 1, d = b + 1; if (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[e * 3 + 1] + pos[d * 3 + 1] < 0.13) continue; idx.push(a, b, e, e, b, d); }
      if (!idx.length) return g; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const N = geo.attributes.normal, t = new Float32Array(nI * nJ);
      if (p.mat === 'pasto') for (let k = 0; k < t.length; k++) { const ny = Math.max(0.2, N.getY(k)), pend = Math.sqrt(Math.max(0, 1 - ny * ny)) / ny, x = pos[k * 3], z = pos[k * 3 + 2]; t[k] = Math.max(0, Math.min(0.9, (pend - 0.14) * 3 * (0.6 + 0.4 * Math.sin(x * 0.23 + z * 0.17) * Math.sin(z * 0.29 - x * 0.11)))); }
      geo.setAttribute('tierra', new THREE.BufferAttribute(t, 1)); geo.computeBoundingSphere(); g.add(sombra(new THREE.Mesh(geo, matLoma(p.mat)))); return g; } },
  // arroyo, cañada o zanja: se dibuja como una calle. Agua al medio, orilla de barro que se pierde en el pasto, juncos en el arroyo y piedras en la cañada.
  // Va sobre terreno plano (no se hunde en el piso ni sigue una loma).
  arroyo: { n: 'Arroyo o cañada', g: 'Terreno', forma: 'linea', capa: 'base', etiqueta: p => p.nombre, def: { ancho: 3, tipo: 'arroyo', orilla: 2 },
    variantes: [{ n: 'Arroyo (con agua y juncos)', o: { tipo: 'arroyo', ancho: 3, orilla: 2 } }, { n: 'Cañada (casi seca, con piedras)', o: { tipo: 'canada', ancho: 2.5, orilla: 1.5 } }, { n: 'Zanja o cuneta con agua', o: { tipo: 'zanja', ancho: 1.2, orilla: 0.6 } }],
    campos: [F.nombre, F.ancho('Ancho del cauce (m)', 0.5, 40), { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['arroyo', 'Arroyo, con agua y juncos'], ['canada', 'Cañada, casi seca, con piedras'], ['zanja', 'Zanja o cuneta con agua']] }, { k: 'orilla', n: 'Orilla de barro a cada lado (m)', t: 'num', min: 0, max: 15, paso: 0.25 }],
    armar(p) { const g = new THREE.Group(); if (!p.pts || p.pts.length < 2) return g; const a = Math.max(0.3, +p.ancho || 3), o = Math.max(0, +p.orilla || 0), R = azar(semilla(p)), largo = largoDe(p.pts), tipo = p.tipo || 'arroyo';
      const cur = new THREE.CatmullRomCurve3(p.pts.map(q => new THREE.Vector3(q[0], 0, q[1])), false, 'centripetal'), P = cur.getSpacedPoints(Math.max(6, Math.ceil(largo / 0.8))).map(v => [v.x, v.z]);
      // el cauce cambia un poco de ancho, como uno de verdad (en la zanja no: es hecha a mano)
      const s0 = (semilla(p) % 628) / 100, mitad = P.map((q, i) => a / 2 * (tipo === 'zanja' ? 1 : 1 + 0.16 * Math.sin(i * 0.19 + s0) + 0.07 * Math.sin(i * 0.61 - s0)));
      const lecho = i => { const m = mitad[i]; return o > 0 ? [[-m - o, 0], [-m - o * 0.5, 0.35], [-m, 0.8], [m, 0.8], [m + o * 0.5, 0.35], [m + o, 0]] : [[-m, 0.8], [m, 0.8]]; };
      const orilla = new THREE.Mesh(franja(P, lecho, 0.045), matBarro()); orilla.receiveShadow = true; orilla.userData.noChoca = true; g.add(orilla);
      const ag = tipo === 'canada' ? 0.16 : 0.9, agua = new THREE.Mesh(franja(P, i => { const c = tipo === 'canada' ? mitad[i] * 0.5 * Math.sin(i * 0.13 + s0 * 2) : 0; return [[c - mitad[i] * ag, 0], [c + mitad[i] * ag, 0]]; }, 0.06), mat(oscuro() ? '#1c3946' : '#4d7c90', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -3 }));
      agua.receiveShadow = true; agua.userData.noChoca = true; g.add(agua);
      if (tipo === 'canada') { const it = []; PIEDRA = PIEDRA || new THREE.DodecahedronGeometry(1, 0);
        P.forEach((q, i) => { const n = 1 + Math.floor(R() * 3); for (let k = 0; k < n; k++) { const d = (R() * 2 - 1) * mitad[i] * 0.95, A = P[Math.max(0, i - 1)], B = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, s = 0.06 + R() * R() * 0.3;
          it.push([q[0] - (B[1] - A[1]) / l * d, 0.04 + s * 0.3, q[1] + (B[0] - A[0]) / l * d, R() * 6, s * (1 + R() * 0.5), s * 0.55, s, ['#9b958b', '#8a857d', '#b0aa9f', '#7f7a72'][Math.floor(R() * 4)]]); } });
        lote(g, PIEDRA, mat('#ffffff', { roughness: 0.95 }), it); }
      if (tipo === 'arroyo' && o > 0) { const it = []; JUNCO = JUNCO || new THREE.ConeGeometry(0.045, 1, 4).translate(0, 0.5, 0);
        P.forEach((q, i) => { if (R() < 0.35) return; const A = P[Math.max(0, i - 1)], B = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, lado = R() < 0.5 ? -1 : 1, d = lado * (mitad[i] * 0.85 + R() * o * 0.5), n = 3 + Math.floor(R() * 5);
          for (let k = 0; k < n; k++) { const x = q[0] - (B[1] - A[1]) / l * d + (R() - 0.5) * 0.4, z = q[1] + (B[0] - A[0]) / l * d + (R() - 0.5) * 0.4, h = 0.5 + R() * 0.8; it.push([x, 0.04, z, R() * 6, 1, h, 1, ['#5b7442', '#6d8048', '#4b6338', '#7a8a4c'][Math.floor(R() * 4)]]); } });
        lote(g, JUNCO, mat('#ffffff', { roughness: 0.8 }), it, false); }
      return g; } },
  // huellas de las máquinas y los camiones en un patio de tosca o tierra: dos bandas oscuras y gastadas, se dibujan como una calle
  huellas: { n: 'Huellas de máquinas', g: 'Terreno', forma: 'linea', capa: 'base', etiqueta: () => '', def: { trocha: 2.6, ancho: 0.8, marca: 45 },
    campos: [F.nombre, { k: 'trocha', n: 'Distancia entre ruedas (m)', t: 'num', min: 1, max: 4, paso: 0.1 }, { k: 'ancho', n: 'Ancho de cada huella (m)', t: 'num', min: 0.3, max: 2, paso: 0.1 }, { k: 'marca', n: 'Qué tan marcadas (%)', t: 'num', min: 10, max: 90, paso: 5 }],
    armar(p) { const g = new THREE.Group(); if (!p.pts || p.pts.length < 2) return g; const cur = new THREE.CatmullRomCurve3(p.pts.map(q => new THREE.Vector3(q[0], 0, q[1])), false, 'centripetal'), P = cur.getSpacedPoints(Math.max(4, Math.ceil(largoDe(p.pts) / 1.5))).map(v => [v.x, v.z]);
      if (!TEX_HUELLA) { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const k = c.getContext('2d'), gr = k.createLinearGradient(0, 0, 64, 0); k.fillStyle = '#000'; k.fillRect(0, 0, 64, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,.8)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = gr; k.fillRect(0, 0, 64, 256);   // la transparencia sale del canal verde: blanco = se ve
        for (let i = 0; i < 60; i++) { k.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.4})`; k.fillRect(8 + Math.random() * 48, Math.random() * 256, 2 + Math.random() * 10, 1 + Math.random() * 6); } TEX_HUELLA = new THREE.CanvasTexture(c); TEX_HUELLA.wrapT = THREE.RepeatWrapping; }
      const m = new THREE.MeshBasicMaterial({ color: oscuro() ? 0x000000 : 0x4a3a28, alphaMap: TEX_HUELLA, transparent: true, opacity: Math.min(0.9, (+p.marca || 45) / 100), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -4, fog: true, side: THREE.DoubleSide });
      for (const lado of [-1, 1]) { const d = lado * (+p.trocha || 2.6) / 2, w = (+p.ancho || 0.8) / 2, v = [], uv = [], ix = []; let acum = 0;
        P.forEach((q, i) => { const A = P[Math.max(0, i - 1)], B = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / l, nz = (B[0] - A[0]) / l; if (i) acum += Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]);
          for (const k of [-1, 1]) { v.push(q[0] + nx * (d + k * w), 0.045, q[1] + nz * (d + k * w)); uv.push(k < 0 ? 0 : 1, acum / 6); } if (i) { const a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); const k = new THREE.Mesh(geo, m); k.renderOrder = 1; k.userData.noChoca = true; g.add(k); }
      return g; } },
  // ---------- cableado estructurado: tomas (plaquetas) y puestos de trabajo con sus jacks numerados como en el plano ----------
  // «jacks»: los códigos del plano separados por espacio o coma (A01 A02). «rack»: a qué rack va el cable. Lo lee la documentación.
  toma: { n: 'Toma de red (plaqueta)', g: 'Equipos', forma: 'punto', capa: 'equipos', etiqueta: p => jacksDe(p).join(' ') || p.nombre, def: { montaje: 'pared', y: 0.35 },
    campos: [F.nombre, { k: 'jacks', n: 'Jacks (como en el plano: A01 A02)', t: 'txt' }, { k: 'montaje', n: 'Dónde va', t: 'sel', ops: [['pared', 'En la pared'], ['piso', 'Caja de piso'], ['techo', 'En el techo (para un AP o una cámara)']] }, { k: 'y', n: 'Altura (m)', t: 'num', min: 0, max: 6, paso: 0.05 }, { k: 'rack', n: 'Va al rack', t: 'txt' }, { k: 'notas', n: 'Notas', t: 'area' }, F.r],
    armar(p) { const g = new THREE.Group(), J = jacksDe(p), n = Math.max(1, J.length), mont = p.montaje || 'pared', pl = placa(J, n);
      if (mont === 'piso') { caja(g, -0.09, 0, -0.09, 0.09, 0.05, 0.09, mat('#8d9398', { roughness: 0.5, metalness: 0.6 })); pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.052, 0); g.add(pl); }
      else if (mont === 'techo') { const y = p.y ?? 2.55; pl.rotation.x = Math.PI / 2; pl.position.set(0, y, 0); g.add(pl); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), mat('#f3f4f2', { roughness: 0.5 })); k.position.y = y - 0.03; g.add(sombra(k)); }
      else { pl.position.set(0, p.y ?? 0.35, 0.007); g.add(pl); }
      g.userData.sinAplanar = true; return g; } },
  puesto: { n: 'Puesto de trabajo (mesa con jacks)', g: 'Equipos', forma: 'punto', capa: 'equipos', etiqueta: p => jacksDe(p).join(' ') || p.nombre, def: { ancho: 1.4, fondo: 0.7, tipo: 'puesto', color: '#e8e2d6' },
    variantes: [{ n: 'Puesto de trabajo', o: { tipo: 'puesto', ancho: 1.4, fondo: 0.7 } }, { n: 'Mesa de reunión', o: { tipo: 'mesa', ancho: 2.4, fondo: 1.1 } }],
    campos: [F.nombre, { k: 'jacks', n: 'Jacks (como en el plano: B01 B02)', t: 'txt' }, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['puesto', 'Puesto (una silla)'], ['mesa', 'Mesa de reunión (sillas a los dos lados)']] }, F.ancho('Largo (m)', 0.6, 6), F.fondo('Fondo (m)', 0.4, 2), F.color('Color de la tapa'), { k: 'rack', n: 'Va al rack', t: 'txt' },
      { k: 'bandeja', n: 'Bandeja para cables debajo de la tapa', t: 'bool' }, { k: 'columna', n: 'Columna por donde suben los cables del piso', t: 'sel', ops: [['', 'Ninguna'], ['centro', 'Al medio, atrás (en la mesa de reunión, al centro)'], ['izq', 'En la esquina de atrás, a la izquierda'], ['der', 'En la esquina de atrás, a la derecha']] }, F.r],
    armar(p) { const g = new THREE.Group(), w = +p.ancho || 1.4, d = +p.fondo || 0.7, top = 0.74, mt = mat(p.color || '#e8e2d6', { roughness: 0.6 }), mf = mat('#3a3f44', { roughness: 0.45, metalness: 0.6 }), J = jacksDe(p);
      caja(g, -w / 2, top - 0.025, -d / 2, w / 2, top, d / 2, mt);
      for (const sx of [-1, 1]) { const x = sx * (w / 2 - 0.05); caja(g, x - 0.025, 0, -d / 2 + 0.05, x + 0.025, top - 0.025, -d / 2 + 0.1, mf); caja(g, x - 0.025, 0, d / 2 - 0.1, x + 0.025, top - 0.025, d / 2 - 0.05, mf); caja(g, x - 0.025, 0, -d / 2 + 0.05, x + 0.025, 0.04, d / 2 - 0.05, mf); }
      if (p.tipo !== 'mesa') caja(g, -w / 2 + 0.02, top, -d / 2, w / 2 - 0.02, top + 0.32, -d / 2 + 0.025, mat('#7d8a8f', { roughness: 0.9 }));   // panel de atrás
      // caja de mesa con los jacks (atrás al medio; en la mesa de reunión, al centro)
      const cz = p.tipo === 'mesa' ? 0 : -d / 2 + 0.09; caja(g, -0.1, top, cz - 0.04, 0.1, top + 0.03, cz + 0.04, mat('#2f3337', { roughness: 0.4, metalness: 0.5 }));
      if (J.length) { const pl = placa(J, J.length); pl.rotation.x = -Math.PI / 2; pl.position.set(0, top + 0.032, cz); pl.scale.setScalar(0.9); g.add(pl); }
      const mb = mat('#4a5056', { roughness: 0.5, metalness: 0.7 });
      if (p.bandeja) { const bz = p.tipo === 'mesa' ? 0 : -d / 2 + 0.09; caja(g, -w / 2 + 0.06, top - 0.16, bz - 0.06, w / 2 - 0.06, top - 0.15, bz + 0.06, mb, false); for (const s of [-1, 1]) caja(g, -w / 2 + 0.06, top - 0.16, bz + s * 0.06 - 0.003, w / 2 - 0.06, top - 0.11, bz + s * 0.06 + 0.003, mb, false); }   // bandeja de alambre colgada debajo de la tapa
      if (p.columna) { const cx = p.columna === 'izq' ? -w / 2 : p.columna === 'der' ? w / 2 : 0, cz2 = p.columna === 'centro' ? cz : -d / 2; caja(g, cx - 0.045, 0, cz2 - 0.045, cx + 0.045, top - 0.025, cz2 + 0.045, mat('#30353a', { roughness: 0.5, metalness: 0.5 })); }   // columna pasacables: por acá suben los cables que vienen picados por el piso
      const silla = (x, z, giro) => { const h = new THREE.Group(), ms = mat('#2b2f33', { roughness: 0.7 }); caja(h, -0.23, 0.42, -0.23, 0.23, 0.48, 0.23, ms); caja(h, -0.22, 0.48, 0.19, 0.22, 0.95, 0.24, ms); cil(h, 0, 0.05, 0, 0.03, 0.37, mf); cil(h, 0, 0, 0, 0.28, 0.05, mf); h.position.set(x, 0, z); h.rotation.y = giro; g.add(h); };
      if (p.tipo === 'mesa') { const ns = Math.max(1, Math.floor(w / 0.75)); for (let i = 0; i < ns; i++) { const x = -w / 2 + (i + 0.5) * w / ns; silla(x, d / 2 + 0.35, 0); silla(x, -d / 2 - 0.35, Math.PI); } }
      else silla(0, d / 2 + 0.4, 0);
      g.userData.sinAplanar = true; return g; } },
  // bandeja portacables aérea: se dibuja como una línea, a la altura que se elija, colgada del techo con varillas
  bandeja: { n: 'Bandeja portacables (aérea)', g: 'Equipos', forma: 'linea', capa: 'equipos', etiqueta: () => '', def: { ancho: 0.3, y: 2.4, tipo: 'rejilla', techo: 2.6 },
    campos: [F.nombre, { k: 'ancho', n: 'Ancho (m)', t: 'num', min: 0.05, max: 0.9, paso: 0.05 }, { k: 'y', n: 'Altura (m)', t: 'num', min: 0, max: 12, paso: 0.05 }, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['rejilla', 'De rejilla (alambre)'], ['chapa', 'De chapa perforada'], ['ducto', 'Ducto cerrado']] }, { k: 'techo', n: 'Altura del techo, para las varillas (m)', t: 'num', min: 0, max: 15, paso: 0.05 }, { k: 'notas', n: 'Notas', t: 'area' }],
    armar(p) { const g = new THREE.Group(); if (!p.pts || p.pts.length < 2) return g; const w = Math.max(0.05, +p.ancho || 0.3), y = +p.y || 2.4, hb = p.tipo === 'ducto' ? 0.08 : 0.06, L = [], V = [], th = +p.techo || 0;
      const m = mat(p.tipo === 'chapa' ? '#b8bec4' : p.tipo === 'ducto' ? '#e9ebec' : '#9aa2a9', { roughness: 0.45, metalness: p.tipo === 'ducto' ? 0 : 0.7, side: THREE.DoubleSide });
      for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 0.01) continue; const ang = Math.atan2(-dz, dx), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
        const pon = (gx, gy, gz, ox, oy, oz) => { const k = new THREE.BoxGeometry(gx, gy, gz); k.translate(ox, oy, oz); k.rotateY(ang); k.translate(cx, 0, cz); L.push(k); };
        pon(l + 0.02, 0.006, w, 0, y, 0); for (const sz of [-1, 1]) pon(l + 0.02, hb, 0.006, 0, y + hb / 2, sz * w / 2);   // fondo y los dos costados
        if (p.tipo === 'ducto') pon(l + 0.02, 0.006, w, 0, y + hb, 0);   // tapa
        if (th > y + 0.05) for (let s2 = 0.3; s2 < l; s2 += 1.5) for (const sz of [-1, 1]) { const k = new THREE.CylinderGeometry(0.004, 0.004, th - y, 5); k.translate(-l / 2 + s2, y + (th - y) / 2, sz * (w / 2 + 0.01)); k.rotateY(ang); k.translate(cx, 0, cz); V.push(k); } }   // varillas al techo cada 1,5 m
      if (L.length) { const k = new THREE.Mesh(mergeGeometries(L), m); k.castShadow = true; g.add(k); }
      if (V.length) { const k = new THREE.Mesh(mergeGeometries(V), mat('#6d747a', { roughness: 0.5, metalness: 0.6 })); k.userData.noChoca = true; g.add(k); }
      g.userData.sinAplanar = true; return g; } },
  // escalera entre plantas: recta, sube desde el punto hacia adelante. Con descanso si se elige en L o en U
  escaleraInt: { n: 'Escalera de interior (entre plantas)', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { ancho: 1.1, alto: 2.8, forma: 'recta', baranda: true, color: '#d8d6d1' },
    variantes: [{ n: 'Escalera recta', o: { forma: 'recta' } }, { n: 'Escalera en U (con descanso)', o: { forma: 'u' } }, { n: 'Escalera en L', o: { forma: 'l' } }],
    campos: [F.nombre, { k: 'forma', n: 'Forma', t: 'sel', ops: [['recta', 'Recta'], ['u', 'En U, con descanso a la mitad'], ['l', 'En L, con descanso']] }, { k: 'ancho', n: 'Ancho (m)', t: 'num', min: 0.6, max: 3, paso: 0.05 }, F.alto('Sube (m)', 0.5, 6, 0.05), F.color('Color'), { k: 'baranda', n: 'Con baranda', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(), w = +p.ancho || 1.1, H = +p.alto || 2.8, n = Math.max(3, Math.round(H / 0.175)), sube = H / n, hue = 0.28, me = mat(oscuro() ? mix(p.color || '#d8d6d1', '#000', 0.4) : (p.color || '#d8d6d1'), { roughness: 0.75 }), mb = mat('#30363b', { roughness: 0.42, metalness: 0.55 }), L = [], B = [];
      const tramo = (k0, k1, x0, z0, dx, dz, giro) => { for (let k = k0; k < k1; k++) { const i = k - k0, c = new THREE.BoxGeometry(w, sube * (k + 1), hue); c.translate(0, sube * (k + 1) / 2, 0); c.rotateY(giro); c.translate(x0 + dx * (i + 0.5) * hue, 0, z0 + dz * (i + 0.5) * hue); L.push(c); }
        if (p.baranda) for (const sd of [-1, 1]) { const ox = Math.cos(giro) * sd * (w / 2 - 0.03), oz = -Math.sin(giro) * sd * (w / 2 - 0.03), a = new THREE.Vector3(x0 + ox, sube * (k0 + 1) + 0.9, z0 + oz), b = new THREE.Vector3(x0 + dx * (k1 - k0) * hue + ox, sube * k1 + 0.9, z0 + dz * (k1 - k0) * hue + oz), d = b.clone().sub(a), c = new THREE.CylinderGeometry(0.02, 0.02, d.length(), 6);
          c.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1))); B.push(c);
          for (const [px, py, pz] of [[a.x, a.y, a.z], [b.x, b.y, b.z]]) { const v = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6); v.translate(px, py - 0.45, pz); B.push(v); } } };
      if (p.forma === 'u' || p.forma === 'l') { const m1 = Math.floor(n / 2), dsc = new THREE.BoxGeometry(w * (p.forma === 'u' ? 2 + 0.1 : 1), sube * m1, w); const zl = m1 * hue; tramo(0, m1, 0, 0, 0, -1, 0);
        dsc.translate(p.forma === 'u' ? w / 2 + 0.05 : 0, sube * m1 / 2, -zl - w / 2); L.push(dsc);
        if (p.forma === 'u') tramo(m1, n, w + 0.1, -zl, 0, 1, Math.PI); else tramo(m1, n, w / 2, -zl - w / 2, 1, 0, -Math.PI / 2); }
      else tramo(0, n, 0, 0, 0, -1, 0);
      if (L.length) g.add(sombra(new THREE.Mesh(mergeGeometries(L.map(q => q.index ? q.toNonIndexed() : q)), me)));
      if (B.length) { const k = new THREE.Mesh(mergeGeometries(B.map(q => q.index ? q.toNonIndexed() : q)), mb); k.userData.noChoca = true; g.add(k); }
      g.userData.sinAplanar = true; return g; } },
  calle: { n: 'Calle o ruta', g: 'Terreno', forma: 'linea', capa: 'base', def: { ancho: 8, tipo: 'asfalto', linea: 'discontinua', borde: 'auto', mano: 'doble' },
    campos: [F.nombre, F.ancho('Ancho (m)', 2, 60), { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['asfalto', 'Asfalto'], ['ruta', 'Ruta (con banquinas)'], ['hormigon', 'Hormigón'], ['tierra', 'Tierra o balasto']] }, { k: 'linea', n: 'Línea del medio', t: 'sel', ops: [['discontinua', 'Discontinua'], ['corta', 'Discontinua corta (calle de barrio)'], ['continua', 'Continua'], ['no', 'Sin línea']] }, { k: 'borde', n: 'Borde', t: 'sel', ops: [['auto', 'Cordón donde da al pasto'], ['cordon', 'Cordón en todo el largo'], ['vereda', 'Cordón y vereda a los dos lados'], ['vereda-izq', 'Vereda de un lado'], ['vereda-der', 'Vereda del otro lado'], ['no', 'Sin cordón']] }, { k: 'mano', n: 'Mano (para los camiones)', t: 'sel', ops: [['doble', 'Doble mano'], ['unica', 'Mano única, en el sentido en que se dibujó']] }],
    armar(p, ctx) { if (p.guia) return new THREE.Group(); const g = new THREE.Group(), y = 0.05, c = { asfalto: oscuro() ? '#2b3036' : '#7d838a', ruta: oscuro() ? '#272c31' : '#73797f', hormigon: suelo('hormigon'), tierra: suelo('ripio') }[p.tipo] || '#7d838a';
      const tq = { asfalto: 'asfalto', ruta: 'asfalto', hormigon: 'hormigon', tierra: 'pedregullo' }[p.tipo] || 'asfalto', mt = METROS[tq], po = { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -4 };
      const mc0 = matTex(texSuelo(tq), oscuro() ? '#55595c' : (p.tipo === 'ruta' ? '#e4e6e8' : '#ffffff'), [p.ancho / mt, 1 / mt], po), mc = piso(tq === 'pedregullo' ? mc0 : calmo(mc0, 0.38));
      g.add(sombra(new THREE.Mesh(cinta(p.pts, p.ancho, y), mc), false, true)); try { bordesDeCalle(g, p, ctx, y, mc); } catch (e) { console.warn('bordes de calle', e); }
      const blanca = oscuro() ? new THREE.MeshBasicMaterial({ color: '#6d7a85', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -6 }) : mat('#f4f6f7', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -6 });
      if (p.linea !== 'no' && p.tipo !== 'tierra') { if (p.linea === 'continua') g.add(new THREE.Mesh(cinta(p.pts, 0.15, y + 0.005), blanca)); else if (p.linea === 'corta') { const mc = oscuro() ? mat('#8d969d', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -6 }) : blanca; for (const [x, z, d] of aLoLargo(p.pts, 3)) { const k = new THREE.Mesh(CAJA, mc); k.scale.set(0.1, 0.01, 1.5); k.position.set(x, y + 0.005, z); k.rotation.y = d; g.add(k); } } else for (const [x, z, d] of aLoLargo(p.pts, 9)) { const k = new THREE.Mesh(CAJA, blanca); k.scale.set(0.15, 0.01, 4.2); k.position.set(x, y + 0.005, z); k.rotation.y = d; g.add(k); } }
      if (p.tipo === 'ruta') for (const s of [-1, 1]) { const off = offset(p.pts, s * (p.ancho / 2 - 0.6)); g.add(new THREE.Mesh(cinta(off, 0.18, y + 0.005), blanca)); } return g; } },
  vereda: { n: 'Vereda', g: 'Terreno', forma: 'linea', capa: 'base', def: { ancho: 1.8 },
    campos: [F.nombre, F.ancho('Ancho (m)', 0.6, 12)],
    armar(p) { const g = new THREE.Group(), os = oscuro(), w = p.ancho, t = texVereda().clone(); t.needsUpdate = true; t.repeat.set(w / 1.6, 1 / 1.6);
      const l = [conUV(cinta(p.pts, w, 0.15)), conUV(cintaVertical(offset(p.pts, w / 2), 0.15, 0.075)), conUV(cintaVertical(offset(p.pts, -w / 2), 0.15, 0.075))], k = new THREE.Mesh(l[0], new THREE.MeshStandardMaterial({ map: t, color: os ? '#6a7078' : '#ffffff', roughness: 0.93 })); k.receiveShadow = true; k.userData.noChoca = true; g.add(k);
      const b = new THREE.Mesh(mergeGeometries([l[1], l[2]]), mat(os ? '#5b6066' : '#cfccc4', { roughness: 0.9, side: THREE.DoubleSide })); b.receiveShadow = true; b.userData.noChoca = true; g.add(b); return g; } },
  balanza: { n: 'Balanza de camiones', g: 'Logística', forma: 'punto', capa: 'logistica', etiqueta: p => p.nombre, def: { largo: 22, ancho: 3.4, guias: 'baranda', piso: 'acero' },
    campos: [F.nombre, { k: 'largo', n: 'Largo (m)', t: 'num', min: 6, max: 40, paso: 0.5 }, F.ancho('Ancho (m)', 2.5, 6), { k: 'piso', n: 'Plataforma', t: 'sel', ops: [['acero', 'Chapa de acero'], ['hormigon', 'Hormigón']] }, { k: 'guias', n: 'Guías a los costados', t: 'sel', ops: [['baranda', 'Baranda amarilla'], ['cordon', 'Cordones de hormigón (alto del lado de la calle)']] }, F.r],
    armar(p) { const g = new THREE.Group(), os = oscuro(), L = p.largo / 2, W = p.ancho / 2, ac = p.piso === 'hormigon' ? mat(os ? '#5d6267' : '#c4c3bc', { roughness: 0.92 }) : mat(os ? '#3b4148' : '#5d666e', { metalness: 0.55, roughness: 0.5 }), hor = mat(os ? '#5a6066' : '#b9bbb6', { roughness: 0.95 }), am = mat(os ? '#8a6f1a' : '#f0b429', { roughness: 0.6 });
      caja(g, -L, 0, -W, L, 0.28, W, ac); for (let i = -3; i <= 3; i++) caja(g, i * L / 3.5 - 0.03, 0.28, -W + 0.1, i * L / 3.5 + 0.03, 0.287, W - 0.1, mat(os ? '#2c3136' : '#474e55', { roughness: 0.6 }), false);
      for (const s of [-1, 1]) { const r = new THREE.Mesh(CAJA, hor); r.scale.set(3.1, 0.06, p.ancho); r.position.set(s * (L + 1.5), 0.125, 0); r.rotation.z = -s * 0.092; g.add(sombra(r, false, true));
        if (p.guias === 'cordon') { const h = s > 0 ? 0.62 : 0.24, a = s > 0 ? 0.34 : 0.22, z0 = s * W, z1 = s * (W + a); caja(g, -L - 2.6, 0, Math.min(z0, z1), L + 2.6, h, Math.max(z0, z1), hor); caja(g, -L - 2.62, 0, Math.min(z0, z1) - 0.01, -L - 1.4, h + 0.01, Math.max(z0, z1) + 0.01, am, false); caja(g, L + 1.4, 0, Math.min(z0, z1) - 0.01, L + 2.62, h + 0.01, Math.max(z0, z1) + 0.01, am, false); continue; }
        caja(g, -L, 0.28, s * W - 0.06, L, 0.5, s * W + 0.06, am); for (const e of [-1, 1]) { const b = new THREE.Mesh(CIL, am); b.scale.set(0.22, 1, 0.22); b.position.set(e * (L + 0.5), 0.5, s * (W + 0.5)); g.add(sombra(b)); } }
      caja(g, L + 1.3, 0, W + 0.9, L + 1.42, 2.2, W + 1.02, mat('#2a2c31', { metalness: 0.5, roughness: 0.5 })); caja(g, L + 1.12, 2.2, W + 0.84, L + 1.6, 2.95, W + 1.08, negro()); caja(g, L + 1.2, 2.6, W + 0.82, L + 1.52, 2.86, W + 0.845, os ? neon('#3ddc84') : mat('#3ddc84', { emissive: '#3ddc84', emissiveIntensity: 0.7 }), false); caja(g, L + 1.2, 2.28, W + 0.82, L + 1.52, 2.54, W + 0.845, mat('#4a1512', { roughness: 0.5 }), false); return g; } },
  pallets: { n: 'Zona de pallets', g: 'Logística', forma: 'punto', capa: 'logistica', def: { columnas: 4, filas: 3, dx: 1.5, dz: 1.4, alto: 1.5 },
    campos: [F.nombre, { k: 'columnas', n: 'Columnas', t: 'num', min: 1, max: 80, paso: 1 }, { k: 'filas', n: 'Filas', t: 'num', min: 1, max: 80, paso: 1 }, { k: 'dx', n: 'Separación entre columnas (m)', t: 'num', min: 1.2, max: 8, paso: 0.1 }, { k: 'dz', n: 'Separación entre filas (m)', t: 'num', min: 1.1, max: 8, paso: 0.1 }, F.r],
    armar(p) { const g = new THREE.Group(), R = azar(semilla(p)), os = oscuro(), base = [], carga = [], C = os ? ['#6b6f73', '#7a6a55', '#5d6a75'] : ['#d9d3c4', '#c9b28a', '#e7e9ea', '#b8c4cc', '#d8c7a6'];
      for (let i = 0; i < p.columnas; i++) for (let j = 0; j < p.filas; j++) { const x = (i - (p.columnas - 1) / 2) * p.dx, z = (j - (p.filas - 1) / 2) * p.dz; base.push([x, 0.07, z, 0, 1.2, 0.14, 1]); if (R() < 0.88) { const h = (0.6 + R() * 0.9) * (p.alto / 1.5); carga.push([x, 0.14 + h / 2, z, 0, 1.12, h, 0.94, C[(R() * C.length) | 0]]); } }
      lote(g, CAJA, mat(os ? '#5a4632' : '#b08a58', { roughness: 0.95 }), base); lote(g, CAJA, mat('#ffffff', { roughness: 0.8 }), carga); return g; } },
  escultura: { n: 'Escultura', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { alto: 3.2, color: '#c8352e', estilo: 'vertice' },
    campos: [F.nombre, { k: 'estilo', n: 'Forma', t: 'sel', ops: [['vertice', 'Cubo parado en un vértice, con base'], ['inclinada', 'Bloque inclinado de acero, sin base'], ['cubo', 'Cubo de acero apoyado en una arista, con cara de vidrio']] }, F.alto('Tamaño (m)', 1, 12, 0.1), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), a = p.alto;
      // bloque inclinado: un cubo de acero oxidado apoyado en una arista, con losas escalonadas arriba, una ventana y la cara de abajo de piedra
      if (p.estilo === 'cubo') { // marco de acero oxidado, una cara de bloques de vidrio en grilla, apoyado en una arista
        const k = new THREE.Group(), os = oscuro(), A = a / 2, t = a * 0.07, ac = mat(os ? mix(p.color, '#000', 0.45) : p.color, { roughness: 0.85, metalness: 0.15 }), vi = mat(os ? '#2c3a44' : '#5f7482', { roughness: 0.12, metalness: 0.6 }), mc = mat(os ? '#6d7276' : '#c9ccce', { roughness: 0.5, metalness: 0.4 }), th = 0.72;
        for (const u of [-1, 1]) for (const v of [-1, 1]) { caja(k, -A, u * A - (u > 0 ? t : 0), v * A - (v > 0 ? t : 0), A, u * A + (u < 0 ? t : 0), v * A + (v < 0 ? t : 0), ac); caja(k, u * A - (u > 0 ? t : 0), -A, v * A - (v > 0 ? t : 0), u * A + (u < 0 ? t : 0), A, v * A + (v < 0 ? t : 0), ac); caja(k, u * A - (u > 0 ? t : 0), v * A - (v > 0 ? t : 0), -A, u * A + (u < 0 ? t : 0), v * A + (v < 0 ? t : 0), A, ac); }
        caja(k, -A, -A, -A, A, -A + t * 0.5, A, ac); caja(k, -A, -A, -A, -A + t * 0.4, A * 0.15, A, ac); caja(k, -A, -A, A - t * 0.4, A * 0.2, A, A, ac); caja(k, -A * 0.5, -A, -A * 0.4, A * 0.3, A * 0.1, -A * 0.1, ac);
        const n = 4, m = 3, cw = (2 * A - 2 * t) / n, cd = (2 * A - 2 * t) / m; caja(k, -A + t, A - t * 1.1, -A + t, A - t, A - t * 0.9, A - t, mc, false);
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const x0 = -A + t + i * cw + cw * 0.07, z0 = -A + t + j * cd + cd * 0.07; caja(k, x0, A - t * 0.9, z0, x0 + cw * 0.86, A - t * 0.9 + a * 0.05, z0 + cd * 0.86, vi, false); }
        k.rotation.z = th; k.position.y = A * (Math.sin(th) + Math.cos(th)) - a * 0.02; g.add(k); return g; }
      if (p.estilo === 'inclinada') { const k = new THREE.Group(), w = a * 0.74, h = a * 0.74, d = a * 0.7, ac = mat(oscuro() ? mix(p.color, '#000', 0.45) : p.color, { roughness: 0.88, metalness: 0.12 }), ne = mat('#1b1512', { roughness: 0.5, metalness: 0.3 }), pi = mat(oscuro() ? '#3d4043' : '#6f716e', { roughness: 1 }), th = 0.5;
        caja(k, -w / 2, -h / 2, -d / 2, w / 2, h / 2, d / 2, ac); caja(k, -w * 0.56, h * 0.5, -d * 0.5, w * 0.2, h * 0.58, d * 0.5, ac); caja(k, -w * 0.5, h * 0.58, -d * 0.44, -w * 0.02, h * 0.68, d * 0.3, ac); caja(k, -w * 0.3, h * 0.68, -d * 0.2, -w * 0.08, h * 0.78, d * 0.12, ac); caja(k, w * 0.5, -h * 0.5, -d * 0.5, w * 0.58, -h * 0.2, d * 0.5, ac);
        caja(k, -w * 0.38, h * 0.12, d / 2, -w * 0.12, h * 0.3, d / 2 + 0.03, ne, false); caja(k, -w * 0.46, -h / 2 - 0.02, -d * 0.46, w * 0.46, -h / 2, d * 0.46, pi, false); caja(k, w * 0.1, -h * 0.44, d / 2, w * 0.44, -h * 0.2, d / 2 + 0.025, pi, false);
        k.rotation.z = -th; k.position.y = w / 2 * Math.sin(th) + h / 2 * Math.cos(th) - a * 0.03; g.add(k); return g; }
      const k = new THREE.Mesh(CAJA, mat(p.color, { roughness: 0.45, metalness: 0.2 })); k.scale.setScalar(a); k.rotation.set(Math.atan(Math.SQRT1_2), 0, Math.PI / 4); k.position.y = a * 0.87 + 0.3; g.add(sombra(k)); caja(g, -a * 0.5, 0, -a * 0.5, a * 0.5, 0.3, a * 0.5, mat(oscuro() ? '#5a6066' : '#c4c5c0', { roughness: 0.95 })); return g; } },
  playa: { n: 'Playa de autos', g: 'Personas y vehículos', forma: 'area', capa: 'logistica', etiqueta: p => p.nombre, def: { ocupacion: 85, giro: 0, piso: 'asfalto', sube: 'no', subeAlto: 0, muro: 0, talud: 0 },
    campos: [F.nombre, { k: 'ocupacion', n: 'Ocupación (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'giro', n: 'Giro de las filas (grados)', t: 'num', min: -90, max: 90, paso: 5 }, { k: 'piso', n: 'Piso', t: 'sel', ops: [['asfalto', 'Asfalto'], ['hormigon', 'Hormigón'], ['ripio', 'Ripio'], ['no', 'Sin piso']] },
      { k: 'sube', n: 'Terreno en pendiente', t: 'sel', ops: [['no', 'Plano'], ['oeste', 'Sube hacia la izquierda (oeste)'], ['este', 'Sube hacia la derecha (este)'], ['norte', 'Sube hacia el norte'], ['sur', 'Sube hacia el sur']] }, { k: 'subeAlto', n: 'Altura en la punta más alta (m)', t: 'num', min: 0, max: 60, paso: 0.5 },
      { k: 'muro', n: 'Muro de hormigón alrededor (m de alto, 0 = sin muro)', t: 'num', min: 0, max: 6, paso: 0.1 }, { k: 'talud', n: 'Talud de pasto afuera (m de ancho por cada m de altura)', t: 'num', min: 0, max: 6, paso: 0.25 }],
    armar(p) { const g = new THREE.Group(), os = oscuro(), F = cotaDe(p), Y = F || (() => 0); if (p.piso !== 'no') { const k = area(g, p.pts, 0.04, matSuelo(p.piso, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -2 }) || mat(suelo(p.piso), { roughness: 0.97 }));
        if (k && F) { const a = k.geometry.attributes.position; for (let i = 0; i < a.count; i++) a.setY(i, 0.04 + F(a.getX(i), a.getZ(i))); a.needsUpdate = true; k.geometry.computeVertexNormals(); k.geometry.computeBoundingSphere(); const so = new THREE.Mesh(k.geometry, SOLO_SOMBRA); so.castShadow = true; so.renderOrder = 1; g.add(so); } }   // la losa en altura da sombra (con una malla invisible: un plano de una cara no la da), así los autos no se «dibujan» en el suelo de abajo
      if (F || +p.muro > 0) muroPlaya(g, p, Y, os);
      const bb = cajaDe(p.pts), cx = (bb[0] + bb[2]) / 2, cz = (bb[1] + bb[3]) / 2, a = (p.giro || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), R = azar(semilla(p)), rad = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + 3, MAX = FINO ? 6500 : 1200, T = ['hatch', 'suv', 'sedan', 'pickup', 'hatch', 'suv', 'furgon'], por = {}, COL = os ? ['#7d858c', '#8b949c', '#6a727a', '#3b4249', '#22262a', '#5a2f2c', '#27405f'] : ['#f2f3f4', '#f2f3f4', '#f2f3f4', '#d5d9dd', '#b9bec4', '#8e969d', '#2b2f33', '#a8322b', '#2f5f9e'];
      // filas de a dos (cola con cola) y un pasillo; cada tramo de fila es de un mismo modelo, como llegan los autos nuevos
      const L = []; for (let v = -rad, f = 0; v < rad; v += f % 2 ? 6.8 : 4.9, f++) { let tipo = T[(R() * T.length) | 0], tramo = 0; const giro = Math.atan2(-c, s) + (f % 2 ? Math.PI : 0);
        for (let u = -rad; u < rad; u += 2.55) { const x = cx + u * c + v * s, z = cz - u * s + v * c; if (--tramo < 0) { tipo = T[(R() * T.length) | 0]; tramo = 6 + ((R() * 14) | 0); } if (!enPoli(x, z, p.pts) || !enPoli(x + 2.5 * s, z + 2.5 * c, p.pts) || !enPoli(x - 2.5 * s, z - 2.5 * c, p.pts) || R() * 100 > p.ocupacion) continue; L.push([tipo, [x, Y(x, z), z, giro, 1, 1, 1, COL[(R() * COL.length) | 0]]]); } }
      const paso = Math.max(1, L.length / MAX); for (let i = 0; i < L.length; i += paso) { const [tipo, q] = L[i | 0]; (por[tipo] = por[tipo] || []).push(q); }
      g.userData.mallas = true; g.userData.segs = g.userData.segs || [];   // para caminar: los autos (cajas) y el muro (tramos)
      for (const t of Object.keys(por)) { const A = autito(t), k = lote(g, A.cuerpo, mat('#ffffff', { roughness: 0.38, metalness: 0.4 }), por[t], FINO); if (k) k.userData.choca = true; lote(g, A.det, mat('#ffffff', { roughness: 0.5, metalness: 0.2, vertexColors: true }), por[t].map(q => q.slice(0, 7)), false); } return g; } },
  panelacc: { n: 'Panel de control de acceso', g: 'Control de acceso', forma: 'punto', capa: 'acceso', etiqueta: p => p.nombre, def: { y: 1.5, puertas: 4 },
    campos: [F.nombre, { k: 'puertas', n: 'Puertas que maneja', t: 'num', min: 1, max: 64, paso: 1 }, { k: 'y', n: 'Altura (m)', t: 'num', min: 0.3, max: 4, paso: 0.05 }, F.r, { k: 'notas', n: 'Notas', t: 'area' }],
    armar(p) { const g = new THREE.Group(), y = p.y, os = oscuro(); caja(g, -0.2, y - 0.25, 0, 0.2, y + 0.25, 0.11, mat(os ? '#7d868e' : '#dfe3e6', { metalness: 0.5, roughness: 0.45 })); caja(g, -0.17, y - 0.22, 0.11, 0.17, y + 0.22, 0.116, mat(os ? '#6c757d' : '#cdd3d7', { metalness: 0.5, roughness: 0.5 }), false);
      caja(g, 0.09, y + 0.14, 0.116, 0.13, y + 0.18, 0.122, os ? neon('#3ddc84') : mat('#3ddc84', { emissive: '#3ddc84', emissiveIntensity: 0.8 }), false); caja(g, -0.02, Math.max(0, y - 1.1), 0.02, 0.02, y - 0.25, 0.06, mat('#8b9197', { roughness: 0.6 }), false); return g; } },
  aplique: { n: 'Aplique de pared (luz de afuera)', g: 'Construcción', forma: 'punto', capa: 'base', def: { y: 3.2 },
    campos: [F.nombre, { k: 'y', n: 'Altura (m)', t: 'num', min: 1.5, max: 14, paso: 0.1 }, F.r],
    armar(p) { const g = new THREE.Group(), y = p.y, os = oscuro(); caja(g, -0.16, y - 0.05, 0, 0.16, y + 0.05, 0.24, mat('#2a2c31', { metalness: 0.6, roughness: 0.4 })); caja(g, -0.13, y - 0.062, 0.03, 0.13, y - 0.05, 0.22, os ? neon('#ffe2b0') : mat('#f4f1e6', { roughness: 0.3 }), false); if (os) pozo(g, 0, 1.6, Math.min(5, y * 1.3), '#ffd9a0', 0.34); return g; } },
  plafon: { n: 'Panel de luz de techo', g: 'Muebles', forma: 'punto', capa: 'base', def: { y: 2.6, lado: 0.6 },
    campos: [F.nombre, { k: 'lado', n: 'Lado (m)', t: 'num', min: 0.3, max: 1.5, paso: 0.05 }, { k: 'y', n: 'Altura (m)', t: 'num', min: 1.8, max: 12, paso: 0.05 }, F.r],
    armar(p) { const g = new THREE.Group(), y = p.y, l = p.lado / 2, os = oscuro(); caja(g, -l, y, -l, l, y + 0.04, l, mat('#d7dade', { metalness: 0.4, roughness: 0.4 }), false); caja(g, -l + 0.03, y - 0.008, -l + 0.03, l - 0.03, y, l - 0.03, os ? neon('#ffe6bd') : mat('#fffdf5', { roughness: 0.3, emissive: '#ffe9c4', emissiveIntensity: 0.55 }), false); if (os) pozo(g, 0, 0, Math.min(4, y * 1.1), '#ffd9a0', 0.22); return g; } },
  // piso por losas, como los pisos de Los Sims: se pinta de a cuadros (5 m por defecto) arrastrando; cada cuadro se saca solo con la maza
  // piso por sector: se pinta con rectángulos sobre una cuadrícula de 5 m. Queda arriba del terreno del plano (pintar reemplaza lo que había)
  // y dos pisos pintados nunca se enciman: lo que se pinta se le saca al que estaba ahí. El estacionamiento lleva cajones pintados y dice cuántos autos entran.
  losas: { n: 'Piso por sector (se pinta con rectángulos)', g: 'Terreno', forma: 'punto', capa: 'base', herramienta: 'piso', etiqueta: p => p.nombre, def: { mat: 'hormigon', celda: 5, celdas: [] },
    variantes: [{ n: 'Piso: hormigón', o: { mat: 'hormigon' } }, { n: 'Piso: hormigón de calzada', o: { mat: 'calzada' } }, { n: 'Piso: asfalto', o: { mat: 'asfalto' } }, { n: 'Piso: estacionamiento', o: { mat: 'estacionamiento' } },
      { n: 'Piso: pasto', o: { mat: 'pasto' } }, { n: 'Piso: tierra o balasto', o: { mat: 'tierra' } }, { n: 'Piso: ripio', o: { mat: 'ripio' } }, { n: 'Piso: adoquines', o: { mat: 'adoquin' } }],
    campos: [F.nombre, { k: 'mat', n: 'Material', t: 'sel', ops: [['hormigon', 'Hormigón (losas con junta)'], ['calzada', 'Hormigón de calzada'], ['asfalto', 'Asfalto'], ['estacionamiento', 'Estacionamiento (cajones pintados)'], ['adoquin', 'Adoquines'], ['ripio', 'Ripio'], ['tierra', 'Tierra o balasto'], ['pasto', 'Pasto'], ['pasto2', 'Pasto oscuro']] }],
    armar(p) { const g = new THREE.Group(), c = p.celda || 5, C = p.celdas || []; if (!C.length) return g; const pos = [], uv = [], idx = [];
      C.forEach(([i, j], n) => { const x0 = i * c, z0 = j * c, x1 = x0 + c, z1 = z0 + c, k = n * 4, ox = p.x || 0, oz = p.z || 0; pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); uv.push(x0 + ox, -(z0 + oz), x1 + ox, -(z0 + oz), x1 + ox, -(z1 + oz), x0 + ox, -(z1 + oz)); idx.push(k, k + 2, k + 1, k, k + 3, k + 2); });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const k = p.mat === 'estacionamiento' ? 'asfalto' : p.mat || 'hormigon', po = { polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -4 };
      let ms = matSuelo(k, po) || mat(suelo(k), { roughness: 0.95, ...po }); if (/^(pasto|pasto2)$/.test(k) && ms.map && !oscuro()) ms = conManchas(ms); else if (k === 'calzada' && ms.map) ms = calzadaReal(ms);
      const m = new THREE.Mesh(geo, ms); m.position.y = 0.05; m.receiveShadow = true; m.userData.noChoca = true; g.add(m);   // arriba del terreno del plano (0,012 a 0,04): pintar un sector lo reemplaza
      // cajones: franjas pintadas de 12 cm (una línea de un píxel se perdía), arriba del asfalto
      if (p.mat === 'estacionamiento') { const L = cajones(p), ox = p.x || 0, oz = p.z || 0, pos = [], ix = [], w = 0.06;
        for (const [x0, z0, x1, z1] of L.rayas) { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w, nz = dx / l * w, k = pos.length / 3;
          pos.push(x0 - ox + nx, 0, z0 - oz + nz, x1 - ox + nx, 0, z1 - oz + nz, x1 - ox - nx, 0, z1 - oz - nz, x0 - ox - nx, 0, z0 - oz - nz); ix.push(k, k + 2, k + 1, k, k + 3, k + 2); }
        if (pos.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setIndex(ix); lg.computeVertexNormals();
          const ln = new THREE.Mesh(lg, mat(oscuro() ? '#6b7178' : '#f1f1ec', { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -6, side: THREE.DoubleSide })); ln.position.y = 0.055; ln.receiveShadow = true; ln.userData.noChoca = true; g.add(ln); }
        g.userData.cuenta = L.n; }
      return g; } },
  estanteria: { n: 'Estantería (rack de pallets)', g: 'Logística', forma: 'linea', capa: 'logistica', etiqueta: p => p.nombre, def: { modulo: 2, prof: 1.1, alto: 6, niveles: 4, doble: false, ocupacion: 70, color: '#2F6FD6' },
    campos: [F.nombre, { k: 'modulo', n: 'Largo de cada módulo (m)', t: 'num', min: 1, max: 4, paso: 0.1 }, { k: 'prof', n: 'Fondo (m)', t: 'num', min: 0.4, max: 1.6, paso: 0.05 }, F.alto('Alto (m)', 1.5, 14), { k: 'niveles', n: 'Niveles', t: 'num', min: 1, max: 10, paso: 1 }, { k: 'doble', n: 'Doble (espalda con espalda)', t: 'bool' }, { k: 'ocupacion', n: 'Con pallets (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'color', n: 'Color de los parantes', t: 'color' }],
    armar(p) { const g = new THREE.Group(), os = oscuro(), P = p.pts || [], md = +p.modulo || 2, pr = +p.prof || 1.1, H = +p.alto || 6, nl = Math.max(1, +p.niveles || 4), R = azar(P.length * 97 + (p.id || '').length), filas = p.doble ? [-(pr / 2 + 0.1), pr / 2 + 0.1] : [0];
      const pa = mat(os ? mix(p.color || '#2F6FD6', '#000', 0.45) : p.color || '#2F6FD6', { roughness: 0.5, metalness: 0.3 }), vi = mat(os ? '#7a4a12' : '#F08A24', { roughness: 0.5, metalness: 0.3 }), pal = mat(os ? '#5b4a36' : '#b48a5a', { roughness: 0.9 }), car = mat(os ? '#6f7880' : '#d9d6cc', { roughness: 0.8 });
      const ip = [], iv = [], ipl = [], ic = []; let n = 0;
      for (let i = 1; i < P.length; i++) { const [x0, z0] = P[i - 1], [x1, z1] = P[i], dx = x1 - x0, dz = z1 - z0, Lg = Math.hypot(dx, dz); if (Lg < 0.5) continue; const k = Math.max(1, Math.round(Lg / md)), ux = dx / Lg, uz = dz / Lg, nx = -uz, nz = ux, d = Math.atan2(dx, dz), m = md;
        for (const off of filas) { for (let j = 0; j <= k; j++) for (const s of [-pr / 2, pr / 2]) ip.push([x0 + ux * j * m + nx * (off + s), H / 2, z0 + uz * j * m + nz * (off + s), d, 0.09, H, 0.09]);
          for (let j = 0; j < k; j++) { const cx = x0 + ux * (j + 0.5) * m + nx * off, cz = z0 + uz * (j + 0.5) * m + nz * off; n++;
            for (let l = 0; l < nl; l++) { const y = 0.15 + l * (H - 0.4) / nl; for (const s of [-pr / 2, pr / 2]) iv.push([cx + nx * s, y + 0.08, cz + nz * s, d, 0.06, 0.12, m - 0.1]);
              if (R() * 100 < (p.ocupacion ?? 70)) for (const q of [-0.25, 0.25]) { const qx = cx + ux * q * m, qz = cz + uz * q * m; ipl.push([qx, y + 0.21, qz, d, pr * 0.95, 0.14, m * 0.42]); ic.push([qx, y + 0.28 + 0.45, qz, d, pr * 0.9, 0.9 + R() * 0.25, m * 0.4]); } } } } }
      lote(g, CAJA, pa, ip); lote(g, CAJA, vi, iv); lote(g, CAJA, pal, ipl); lote(g, CAJA, car, ic); g.userData.modulos = n; return g; } },
  pintura: { n: 'Línea pintada en el piso', g: 'Terreno', forma: 'linea', capa: 'base', def: { tipo: 'continua', color: '#E5C35A', ancho: 0.15 },
    campos: [F.nombre, { k: 'tipo', n: 'Línea', t: 'sel', ops: [['continua', 'Continua'], ['doble', 'Doble continua'], ['discontinua', 'Discontinua'], ['flecha', 'Continua con flecha al final']] }, { k: 'color', n: 'Color', t: 'sel', ops: [['#E5C35A', 'Amarilla'], ['#F2F2EE', 'Blanca'], ['#D5483F', 'Roja'], ['#2F6FD6', 'Azul']] }, { k: 'ancho', n: 'Ancho de la línea (m)', t: 'num', min: 0.05, max: 1, paso: 0.05 }, { k: 'cerrado', n: 'Cerrada (vuelve al primer punto)', t: 'bool' }],
    armar(p) { const g = new THREE.Group(), os = oscuro(), c = p.color || '#E5C35A', m = mat(os ? mix(c, '#000', 0.45) : c, { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -8 }), a = p.ancho || 0.15, it = [], P = (p.pts || []).slice(); if (p.cerrado && P.length > 2) P.push(P[0]);
      const tramo = (x0, z0, x1, z1, off) => { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) return; const d = Math.atan2(dx, dz), nx = dz / L, nz = -dx / L;
        const pon = (s0, s1) => { const f = (s0 + s1) / 2 / L; it.push([x0 + dx * f + nx * off, 0.045, z0 + dz * f + nz * off, d, a, 0.012, s1 - s0]); };
        if (p.tipo === 'discontinua') for (let s = 0; s < L; s += 6) pon(s, Math.min(L, s + 3)); else pon(0, L); };
      for (let i = 1; i < P.length; i++) { const [x0, z0] = P[i - 1], [x1, z1] = P[i]; if (p.tipo === 'doble') { tramo(x0, z0, x1, z1, -a * 1.3); tramo(x0, z0, x1, z1, a * 1.3); } else tramo(x0, z0, x1, z1, 0); }
      const k = lote(g, CAJA, m, it, false); if (k) k.userData.noChoca = true;
      if (p.tipo === 'flecha' && P.length > 1) { const [x0, z0] = P[P.length - 2], [x1, z1] = P[P.length - 1], d = Math.atan2(x1 - x0, z1 - z0), s0 = new THREE.Shape([new THREE.Vector2(-0.7, 0), new THREE.Vector2(0.7, 0), new THREE.Vector2(0, 1.4)]), fm = new THREE.Mesh(new THREE.ShapeGeometry(s0).rotateX(-Math.PI / 2).rotateY(Math.PI), m);
        fm.rotation.y = d + Math.PI; fm.position.set(x1, 0.047, z1); fm.userData.noChoca = true; g.add(fm); }
      return g; } },
  rayado: { n: 'Zona rayada (pintura de piso)', g: 'Terreno', forma: 'area', capa: 'base', def: { paso: 1.6, giro: 45 },
    campos: [F.nombre, { k: 'paso', n: 'Separación de las rayas (m)', t: 'num', min: 0.6, max: 6, paso: 0.1 }, { k: 'giro', n: 'Giro de las rayas (grados)', t: 'num', min: -90, max: 90, paso: 5 }],
    armar(p) { const g = new THREE.Group(), P = p.pts || [], n = P.length; if (n < 3) return g; const a = (p.giro || 0) * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), nx = -uz, nz = ux, it = [], po = { polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -8 }, paso = Math.max(0.6, +p.paso || 1.6);
      let lo = 1e9, hi = -1e9; for (const q of P) { const t = q[0] * nx + q[1] * nz; lo = Math.min(lo, t); hi = Math.max(hi, t); }
      // cada raya se corta contra el contorno: queda solo lo que cae adentro
      for (let t = lo + paso / 2; t < hi && it.length < 600; t += paso) { const cs = []; for (let i = 0; i < n; i++) { const A = P[i], B = P[(i + 1) % n], ta = A[0] * nx + A[1] * nz - t, tb = B[0] * nx + B[1] * nz - t; if ((ta > 0) !== (tb > 0)) { const f = ta / (ta - tb); cs.push((A[0] + (B[0] - A[0]) * f) * ux + (A[1] + (B[1] - A[1]) * f) * uz); } } cs.sort((x, y) => x - y);
        for (let i = 0; i + 1 < cs.length; i += 2) { const L = cs[i + 1] - cs[i], sm = (cs[i] + cs[i + 1]) / 2; if (L > 0.4) it.push([nx * t + ux * sm, 0.058, nz * t + uz * sm, Math.atan2(ux, uz), 0.24, 0.012, L]); } }
      const bl = oscuro() ? new THREE.MeshBasicMaterial({ color: '#7f93a3', toneMapped: false, ...po }) : mat('#f4f6f7', { roughness: 0.6, ...po }), ll = lote(g, CAJA, bl, it, false); if (ll) ll.userData.noChoca = true;
      const co = new THREE.Mesh(cinta([...P, P[0]], 0.16, 0.058), bl); co.userData.noChoca = true; g.add(co); return g; } },
  senda: { n: 'Senda peatonal', g: 'Terreno', forma: 'punto', capa: 'base', def: { ancho: 8, largo: 3 },
    campos: [F.ancho('Ancho de la calle (m)', 2, 40), { k: 'largo', n: 'Ancho de la senda (m)', t: 'num', min: 1.5, max: 8, paso: 0.5 }, F.r],
    armar(p) { const g = new THREE.Group(), it = [], n = Math.max(2, Math.round(p.ancho / 1.0)), po = { polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -8 }; for (let i = 0; i < n; i++) it.push([-p.ancho / 2 + (i + 0.5) * (p.ancho / n), 0.058, 0, 0, 0.5, 0.012, p.largo]);
      const ll = lote(g, CAJA, oscuro() ? new THREE.MeshBasicMaterial({ color: '#7f93a3', toneMapped: false, ...po }) : mat('#f4f6f7', { roughness: 0.6, ...po }), it, false); if (ll) ll.userData.noChoca = true; return g; } },
  rotonda: { n: 'Rotonda', g: 'Terreno', forma: 'punto', capa: 'base', def: { radio: 14, isla: 7, flechas: 'anti' },
    campos: [F.nombre, { k: 'radio', n: 'Radio (m)', t: 'num', min: 4, max: 60, paso: 0.5 }, { k: 'isla', n: 'Isla verde (m)', t: 'num', min: 0, max: 50, paso: 0.5 }, { k: 'flechas', n: 'Flechas de sentido en el cordón', t: 'sel', ops: [['anti', 'Giro antihorario'], ['hor', 'Giro horario'], ['no', 'Sin flechas']] }],
    armar(p) { if (p.guia) return new THREE.Group(); const g = new THREE.Group(); const k = new THREE.Mesh(new THREE.CircleGeometry(p.radio, 48).rotateX(-Math.PI / 2), calmo(matTex(texSuelo('asfalto'), oscuro() ? '#55595c' : '#ffffff', [p.radio * 2 / METROS.asfalto, p.radio * 2 / METROS.asfalto], { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -5 }), 0.38)); k.position.y = 0.052; k.receiveShadow = true; g.add(k);
      // la isla va por encima de las calles que cruzan por el centro (más alta y dibujada adelante)
      if (p.isla > 0) { const ad = { polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -12 }, i = new THREE.Mesh(new THREE.CylinderGeometry(p.isla, p.isla + 0.2, 0.35, 48), matSuelo('pasto', ad, 0.5)); i.position.y = 0.175; g.add(sombra(i)); const cir = r => { const l = []; for (let k = 0; k < 48; k++) l.push([r * Math.cos(k / 48 * 6.2832), -r * Math.sin(k / 48 * 6.2832)]); return l; }; try { bordeIsla(g, cir(p.isla + 0.62), cir(p.isla + 0.02), 0.058, 0.33, p.flechas === 'no' ? '' : (p.flechas || 'anti'), ad); } catch (e) { console.warn('borde', e); } g.userData.segs = []; } return g; } },
  cerco: { n: 'Cerco', g: 'Construcción', forma: 'linea', capa: 'base', def: { tipo: 'hormigon', alto: 2.4, cerrado: false },
    campos: [F.nombre, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['hormigon', 'Postes de hormigón y malla'], ['malla', 'Malla metálica'], ['muro', 'Muro'], ['premoldeado', 'Placas de hormigón premoldeado'], ['guardarrail', 'Guardarraíl'], ['baranda', 'Baranda de caño'], ['jersey', 'Bloques de hormigón (New Jersey)']] }, F.alto('Alto (m)', 0.5, 6), { k: 'color', n: 'Color (baranda o bloques)', t: 'color' }, { k: 'cerrado', n: 'Cerrado (vuelve al inicio)', t: 'bool' }],
    armar(p) { const g = new THREE.Group(), gr = p.tipo === 'guardarrail', h = gr ? 0.8 : p.alto, P = p.cerrado ? [...p.pts, p.pts[0]] : p.pts;
      if (p.tipo === 'muro') { for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = new THREE.Mesh(CAJA, mat(oscuro() ? '#5b6166' : '#d6d8da')); k.scale.set(0.2, h, L); k.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2); k.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); g.add(sombra(k)); } return g; }
      // placas premoldeadas: postes de hormigón cada 2 m y placas de 50 cm encastradas entre ellos, con la junta de cada placa
      if (p.tipo === 'premoldeado') { const os = oscuro(), ph = mat(os ? '#676c70' : '#c3c4bf', { roughness: 0.92 }), pl = new THREE.MeshStandardMaterial({ map: placas(), color: os ? '#6f7478' : '#ffffff', roughness: 0.95, side: THREE.DoubleSide }), v = [], uv = [], ix = [];
        let acc = 0; for (let i = 0; i < P.length; i++) { if (i) acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); v.push(P[i][0], 0, P[i][1], P[i][0], h, P[i][1]); uv.push(acc / 2, 0, acc / 2, h / 0.5); if (i) { const j = i * 2; ix.push(j - 2, j - 1, j, j - 1, j + 1, j); } }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals(); g.add(sombra(new THREE.Mesh(geo, pl)));
        lote(g, CAJA, ph, aLoLargo(P, 2).map(([x, z, d]) => [x, (h + 0.12) / 2, z, d, 0.2, h + 0.12, 0.2])); return g; }
      // bloques New Jersey sueltos, de 2 m, uno detrás del otro con una junta (los amarillos que cortan un carril)
      if (p.tipo === 'jersey') { const hb = Math.min(1.1, p.alto || 0.8), c = p.color || '#E9C23A', it = []; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = Math.atan2(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2)), l = L / n;
          for (let j = 0; j < n; j++) { const f = (j + 0.5) / n; it.push([a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f, d, 0.6, hb, l - 0.18]); } }
        lote(g, JERSEY, mat(oscuro() ? mix(c, '#000', 0.45) : c, { roughness: 0.85 }), it); return g; }
      if (p.tipo === 'baranda') { const ca = p.color ? mat(oscuro() ? mix(p.color, '#000', 0.4) : p.color, { roughness: 0.5, metalness: 0.3 }) : mat(oscuro() ? '#6c747b' : '#8f979d', { roughness: 0.5, metalness: 0.4 }), it = aLoLargo(P, 2.4).map(([x, z, d]) => [x, h / 2, z, d, 0.06, h, 0.06]); for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), r = Math.atan2(b[0] - a[0], b[1] - a[1]); for (const y of [h - 0.03, h * 0.5]) it.push([(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, r, 0.05, 0.05, L]); } lote(g, CAJA, ca, it); return g; }
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
      if (p.alto > 0) { const R = azar(semilla(p)), w = Math.max(0.5, p.ancho * 0.95), it = aLoLargo(p.pts, w * 0.55).map(([x, z]) => [x + (R() - 0.5) * 0.15, p.alto * 0.48, z + (R() - 0.5) * 0.15, R() * 6.3, w * (0.95 + R() * 0.2), p.alto * (1.05 + R() * 0.2), w * (0.95 + R() * 0.2), oscuro() ? '#3d5238' : V_ARBU[(R() * V_ARBU.length) | 0]]); lote(g, HOJAS, mat('#ffffff', { roughness: 1, vertexColors: true }), it); } return g; } },
  arboles: { n: 'Hilera de árboles', g: 'Vegetación', forma: 'linea', capa: 'vegetacion', def: { tipo: 'pino', paso: 7, alto: 1 },
    campos: [F.nombre, { k: 'tipo', n: 'Árbol', t: 'sel', ops: [['pino', 'Pino'], ['fronda', 'Fronda'], ['alamo', 'Álamo'], ['eucalipto', 'Eucalipto'], ['palmera', 'Palmera'], ['arbusto', 'Arbusto'], ['olivo', 'Olivo (chico)']] }, { k: 'paso', n: 'Cada (m)', t: 'num', min: 2, max: 40, paso: 0.5 }, { k: 'alto', n: 'Tamaño', t: 'num', min: 0.4, max: 2.5, paso: 0.1 }, { k: 'maceta', n: 'Maceta', t: 'sel', ops: [['', 'Sin maceta (en la tierra)'], ['corten', 'Redonda de acero corten'], ['hormigon', 'Redonda de hormigón']] }],
    armar(p, ctx) { const g = new THREE.Group(), R = azar(semilla(p)), E = entorno(ctx); arbolado(g, aLoLargo(p.pts, p.paso).filter(([x, z]) => !(E && (E.enCalle(x, z, null, 2.5) || E.enCaja(x, z, 2.5) || E.enPolis(x, z, E.duros) || E.playa(x, z, 3)))).map(([x, z]) => p.maceta ? [x, z, p.tipo, p.alto * (0.9 + R() * 0.2), p.maceta] : [x + (R() - 0.5) * 1.2, z + (R() - 0.5) * 1.2, p.tipo, p.alto * (0.8 + R() * 0.4)])); return g; } },
  arbol: { n: 'Árbol', g: 'Vegetación', forma: 'punto', capa: 'vegetacion', def: { tipo: 'fronda', alto: 1 },
    campos: [F.nombre, { k: 'tipo', n: 'Árbol', t: 'sel', ops: [['fronda', 'Fronda'], ['pino', 'Pino'], ['alamo', 'Álamo'], ['eucalipto', 'Eucalipto'], ['palmera', 'Palmera'], ['arbusto', 'Arbusto'], ['olivo', 'Olivo (chico)']] }, { k: 'alto', n: 'Tamaño', t: 'num', min: 0.4, max: 3, paso: 0.1 }, { k: 'maceta', n: 'Maceta', t: 'sel', ops: [['', 'Sin maceta (en la tierra)'], ['corten', 'Redonda de acero corten'], ['hormigon', 'Redonda de hormigón']] }],
    armar(p, ctx) { const g = new THREE.Group(), E = entorno(ctx); if (E && E.playa(p.x || 0, p.z || 0, 3)) return g; arbolado(g, [[0, 0, p.tipo, p.alto, p.maceta]]); return g; } },

  // construcciones
  galpon: { n: 'Galpón', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, siempre: true, def: { ancho: 40, fondo: 25, alto: 9, color: '#e4e8eb', techo: '#c9ced2', abierto: false, portones: 2, estilo: 'chapa', perfil: 'trapezoidal', terminacion: 'prepintada', andenes: 6, anexo: '', cubierta: 'claraboyas', desde: 1, placa: '#1F4D3A', alero: 0, losa: 22 },
    campos: [F.nombre, F.ancho('Largo (m)', 3, 600), F.fondo('Fondo (m)', 3, 300), F.alto('Alto (m)', 2.5, 30, 0.5), F.color('Color de paredes'), { k: 'techo', n: 'Color del techo', t: 'color' }, { k: 'estilo', n: 'Tipo', t: 'sel', ops: [['chapa', 'Galpón de chapa'], ['logistico', 'Nave con andenes']] }, { k: 'perfil', n: 'Chapa', t: 'sel', ops: [['trapezoidal', 'Trapezoidal'], ['acanalada', 'Acanalada (onda)']] }, { k: 'terminacion', n: 'Terminación', t: 'sel', ops: [['prepintada', 'Prepintada'], ['galvanizada', 'Galvanizada (cinc)'], ['vieja', 'Vieja, sin brillo']] }, { k: 'portones', n: 'Portones al frente (chapa)', t: 'num', min: 0, max: 60, paso: 1 }, { k: 'abierto', n: 'Frente abierto (tinglado)', t: 'bool' },
      { k: 'andenes', n: 'Andenes (nave)', t: 'num', min: 0, max: 80, paso: 1 }, { k: 'desde', n: 'Primer número de andén', t: 'num', min: 0, max: 999, paso: 1 }, { k: 'alero', n: 'Alero sobre los andenes (m, 0 = sin alero)', t: 'num', min: 0, max: 30, paso: 0.5 }, { k: 'losa', n: 'Piso frente a los andenes (m, 0 = sin piso)', t: 'num', min: 0, max: 60, paso: 1 }, { k: 'losaMat', n: 'Piso de la playa de andenes', t: 'sel', ops: [['hormigon', 'Hormigón'], ['adoquin', 'Adoquines']] }, { k: 'abrigo', n: 'Abrigos de goma en los portones', t: 'bool' }, { k: 'rampa', n: 'Rampa al patio (al lado del último andén)', t: 'sel', ops: [['', 'Sin rampa'], ['der', 'En la punta derecha'], ['izq', 'En la punta izquierda'], ['ambas', 'En las dos puntas']] }, { k: 'rampaLargo', n: 'Largo de la rampa (m)', t: 'num', min: 4, max: 30, paso: 0.5 }, { k: 'nivel', n: 'Portón a nivel del piso (sin andén, para autoelevador o auto)', t: 'sel', ops: [['', 'Sin portón a nivel'], ['der', 'En la punta derecha'], ['izq', 'En la punta izquierda'], ['ambas', 'En las dos puntas']] }, { k: 'colInt', n: 'Columnas adentro: cada cuántos metros (0 = sin columnas)', t: 'num', min: 0, max: 40, paso: 1 }, { k: 'puerta', n: 'Puerta de personal en el frente', t: 'sel', ops: [['', 'En la punta (contraria a la oficina)'], ['otra', 'En la otra punta'], ['no', 'Sin puerta de personal']] }, { k: 'placa', n: 'Color de las chapas de número', t: 'color' },
      { k: 'libre', n: 'Sin inquilino (no recibe camiones)', t: 'bool' }, { k: 'anexo', n: 'Oficina al frente (nave)', t: 'sel', ops: [['', 'Sin oficina'], ['izq', 'A la izquierda'], ['der', 'A la derecha']] }, { k: 'cubierta', n: 'Techo (nave)', t: 'sel', ops: [['lisa', 'Liso'], ['claraboyas', 'Con claraboyas'], ['solar', 'Con paneles solares']] }, F.r],
    armar(p) { if (p.estilo === 'logistico') return naveLog(p); const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2, h = p.alto, CH = { perfil: p.perfil || 'trapezoidal', terminacion: p.terminacion || 'prepintada' }, pa = chapaReal(oscuro() ? mix(p.color, '#000', 0.5) : p.color, CH), zo = mat(oscuro() ? '#4c5257' : '#aeb3b8'), e = 0.25;
      cajaT(g, -w, 0, -d, w, h, -d + e, pa, MCH); cajaT(g, -w, 0, -d, -w + e, h, d, pa, MCH); cajaT(g, w - e, 0, -d, w, h, d, pa, MCH);
      if (p.abierto) { const n = Math.max(2, Math.round(p.ancho / 8)); for (let i = 0; i <= n; i++) caja(g, -w + i * (p.ancho - 0.4) / n, 0, d - 0.4, -w + i * (p.ancho - 0.4) / n + 0.4, h, d, pa); }
      else { cajaT(g, -w, 0, d - e, w, h, d, pa, MCH); const n = p.portones | 0; for (let i = 0; i < n; i++) { const x = -w + (i + 0.5) * p.ancho / n, pw = Math.min(4.2, p.ancho / n * 0.7); caja(g, x - pw / 2, 0, d, x + pw / 2, Math.min(h - 1, 4.8), d + 0.06, mat(oscuro() ? '#5f666c' : '#d7dbde', { roughness: 0.5 })); } }
      for (const [x0, z0, x1, z1] of [[-w, -d, w, -d + e], [-w, d - e, w, d], [-w, -d, -w + e, d], [w - e, -d, w, d]]) caja(g, x0 - 0.02, 0, z0 - 0.02, x1 + 0.02, 1.1, z1 + 0.02, zo);
      const t = cajaT(g, -w - 0.3, h, -d - 0.3, w + 0.3, h + 0.35, d + 0.3, chapaReal(oscuro() ? mix(p.techo, '#000', 0.55) : p.techo, { perfil: CH.perfil, terminacion: 'galvanizada' }), MCH); t.userData.techo = true; sombraDeApoyo(g, w, d, { fuerza: oscuro() ? 0.22 : 0.4 });
      caja(g, -w - 0.32, h + 0.35, -d - 0.32, w + 0.32, h + 0.6, -d + 0.1, mat(oscuro() ? '#2a3036' : '#59616a')); caja(g, -w - 0.32, h + 0.35, d - 0.1, w + 0.32, h + 0.6, d + 0.32, mat(oscuro() ? '#2a3036' : '#59616a'));
      // de noche: tira de luz en el color de la app bajo el alero y luz sobre los portones
      if (oscuro()) { const nm = neon(acento()); for (const [x0, z0, x1, z1] of [[-w, -d - 0.05, w, -d], [-w, d, w, d + 0.05], [-w - 0.05, -d, -w, d], [w, -d, w + 0.05, d]]) caja(g, x0, h - 0.5, z0, x1, h - 0.38, z1, nm, false);
        if (!p.abierto) { const n = p.portones | 0; for (let i = 0; i < n; i++) { const x = -w + (i + 0.5) * p.ancho / n; brillo(g, x, Math.min(h - 0.6, 5.4), d + 0.5, 4, '#ffe2b0', 0.8); pozo(g, x, d + 5, 6, '#ffcf8a', 0.28); } } }
      return g; } },
  modulo: { n: 'Oficina o módulo', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { ancho: 12, fondo: 6, pisos: 1, color: '#f5f6f7', ventanas: true, estilo: 'liso', semaforo: false },
    campos: [F.nombre, { k: 'estilo', n: 'Estilo', t: 'sel', ops: [['liso', 'Módulo liso'], ['garita', 'Casilla de control (alero, rejas y vereda con baranda)']] }, F.ancho('Largo (m)', 1, 120), F.fondo('Fondo (m)', 1, 60), { k: 'pisos', n: 'Pisos', t: 'num', min: 1, max: 12, paso: 1 }, F.color('Color'), { k: 'ventanas', n: 'Ventanas', t: 'bool' }, { k: 'semaforo', n: 'Semáforo en la esquina', t: 'bool' }, F.r],
    armar(p) { if (p.estilo === 'garita') return garita(p); const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2, H = 3.1 * p.pisos; caja(g, -w, 0, -d, w, H, d, mat(oscuro() ? mix(p.color, '#000', 0.35) : p.color, { roughness: 0.6 }));
      if (p.ventanas) { const vm = mat(oscuro() ? '#3a3f45' : '#2c3e4f', { roughness: 0.25, metalness: 0.35, emissive: oscuro() ? '#ffdcaa' : '#000000', emissiveIntensity: oscuro() ? 0.55 : 0 });   // de noche, luz cálida de adentro (antes encandilaba)
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
    campos: [F.nombre, F.alto('Alto (m)', 0.3, 12), { k: 'grosor', n: 'Grosor (m)', t: 'num', min: 0.05, max: 0.6, paso: 0.05 }, { k: 'tipo', n: 'Tipo de pared', t: 'sel', ops: PAREDES.filter(q => q[0] !== 'sin') }, F.color('Color'), { k: 'aluminio', n: 'Color del aluminio (marcos, puertas y ventanas)', t: 'sel', ops: [['', 'Negro'], ['#c9ccce', 'Natural (anodizado)'], ['#f2f3f2', 'Blanco'], ['#6f5a45', 'Bronce'], ['#7d8186', 'Gris'], ['#a8794e', 'Símil madera']] }, { k: 'losa', n: 'Losa arriba con luz (fachada)', t: 'bool' }],
    armar(p, ctx) { const g = new THREE.Group(), segs = [], P = p.pts, alto = altoVista(p.alto, ctx, p);
      for (let i = 0; i < P.length - 1; i++) { const L = (p.lados || {})[i] || {}; tramoPared(g, P[i], P[i + 1], { y: p.y || 0, alto, real: p.alto, grosor: p.grosor, tipo: L.tipo || p.tipo, color: L.color || p.color, aluminio: p.aluminio, dentro: 1, e0: i > 0, e1: i < P.length - 2 }, (p.huecos || []).filter(h => h.s === i), segs); }
      if (p.losa && alto >= p.alto - 0.01) losaPared(g, P, (p.y || 0) + p.alto, p.losa === true ? 0.7 : +p.losa);
      g.userData.segs = segs; return g; } },
  recinto: { n: 'Recinto (habitación)', g: 'Construcción', forma: 'area', capa: 'base', herramienta: 'recinto', etiqueta: p => p.nombre, def: { alto: 2.6, grosor: 0.15, tipo: 'maciza', color: '#eceeef', piso: 'ceramica' },
    campos: [F.nombre, F.alto('Alto de las paredes (m)', 0.3, 12), { k: 'grosor', n: 'Grosor (m)', t: 'num', min: 0.05, max: 0.6, paso: 0.05 }, { k: 'tipo', n: 'Paredes', t: 'sel', ops: PAREDES }, F.color('Color de las paredes'), { k: 'aluminio', n: 'Color del aluminio (marcos, puertas y ventanas)', t: 'sel', ops: [['', 'Negro'], ['#c9ccce', 'Natural (anodizado)'], ['#f2f3f2', 'Blanco'], ['#6f5a45', 'Bronce'], ['#7d8186', 'Gris'], ['#a8794e', 'Símil madera']] }, { k: 'piso', n: 'Piso', t: 'sel', ops: PISOS }, { k: 'colorPiso', n: 'Color del piso', t: 'color' }, { k: 'techo', n: 'Techo', t: 'sel', ops: [['', 'Sin techo (abierto arriba)'], ['losa', 'Losa de hormigón'], ['chapa', 'Chapa']] }, { k: 'luz', n: 'Luz encendida de noche', t: 'bool' }],
    armar(p, ctx) { const g = new THREE.Group(), segs = [], P = p.pts, n = P.length; if (n < 3) return g; const y = p.y || 0, alto = altoVista(p.alto, ctx, p), dentro = areaSig(P) > 0 ? 1 : -1;
      if (p.piso !== 'sin') area(g, P, y + 0.045, p.colorPiso ? tenido(matPiso(p.piso), p.colorPiso) : matPiso(p.piso));
      if (nivelDe(p) > 0 && p.piso !== 'sin') { const sh = new THREE.Shape(inflar(P, (+p.grosor || 0.15) / 2).map(q => new THREE.Vector2(q[0], -q[1]))), lo = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false }).rotateX(-Math.PI / 2), mat(oscuro() ? mix(p.color || '#eceeef', '#000', 0.45) : (p.color || '#eceeef'), { roughness: 0.92 }));   /* del color de las paredes: de afuera el canto de la losa sigue la fachada */
        lo.position.y = y - 0.21; lo.castShadow = lo.receiveShadow = true; lo.userData.losa = true; g.add(lo); }   // la losa: piso de esta planta y techo de la de abajo
      if (p.luz && oscuro()) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }   // de noche, la luz del ambiente encendida (cálida, como la de las luminarias)
        // Un foco que apunta al piso, alto (5,2 m) y con el cono justo para la sala. Alto, para que alumbre parejo: más bajo, lo que está más cerca
        // (la tapa de un escritorio) recibía mucha más luz que el piso y quedaba quemado. Con cono, para que no se sume la luz de las salas vecinas
        // (las luces no hacen sombra: una lámpara sin cono atravesaba las paredes y en el medio de la oficina se juntaban cuatro o cinco).
        // En una sala alargada van dos o tres focos a lo largo. LUZ_H ** 1.6 pasa de «cuánta luz llega al piso» a la fuerza del foco.
        const w = x1 - x0, d = z1 - z0, lg = Math.max(w, d), ch = Math.max(0.5, Math.min(w, d)), n = Math.max(1, Math.min(3, Math.round(lg / ch / 1.6))), LUZ_H = 5.2, radio = 0.5 * Math.max(ch, lg / n) * 1.45, f = +p.luz > 0 && p.luz !== true ? +p.luz : 1;
        for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, cx = w >= d ? x0 + w * u : (x0 + x1) / 2, cz = w >= d ? (z0 + z1) / 2 : z0 + d * u, l = new THREE.SpotLight('#ffd9a8', LUZ_PISO * LUZ_H ** 1.6 * f, LUZ_H * 2.4, Math.min(1.2, Math.atan(radio / LUZ_H)), 0.45, 1.6);
          l.position.set(cx, y + LUZ_H, cz); l.target.position.set(cx, y, cz); g.add(l, l.target); } }
      else if (p.tipo === 'sin') area(g, P, y + 0.05, matZona());   // zona: sin paredes ni piso, nombra un sector (por ejemplo, sobre el plano del lugar)
      for (let i = 0; i < n; i++) { const L = (p.lados || {})[i] || {}; tramoPared(g, P[i], P[(i + 1) % n], { y, alto, real: p.alto, grosor: p.grosor, tipo: L.tipo || p.tipo, color: L.color || p.color, aluminio: p.aluminio, dentro, e0: true, e1: true }, (p.huecos || []).filter(h => h.s === i), segs); }
      // contenedor oficina: techo de chapa, esquineros y bastidor de abajo; el techo se saca cuando las paredes se ven cortadas o con la capa de techos apagada
      if (p.estilo === 'contenedor') { const H = y + (+p.alto || 2.59), oc = oscuro(), fr = mat(oc ? '#30363c' : mix(p.color || '#e6eaed', '#000', 0.3), { roughness: 0.5, metalness: 0.45 });
        for (const [x, z] of P) caja(g, x - 0.09, y, z - 0.09, x + 0.09, H + 0.07, z + 0.09, fr);
        if (alto >= p.alto - 0.01) { const t = area(g, P, H + 0.06, mat(oc ? mix(p.color || '#e6eaed', '#000', 0.6) : mix(p.color || '#e6eaed', '#000', 0.08), { roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide })); if (t) t.userData.techo = true; }
        area(g, P, y + 0.012, mat(oc ? '#1b1f23' : '#5b6167', { roughness: 0.9 })); }
      if (p.techo && alto >= p.alto - 0.01) { const H = (p.y || 0) + (+p.alto || 2.6), sh = new THREE.Shape(inflar(P, (+p.grosor || 0.15) / 2 + (p.techo === 'chapa' ? 0.15 : 0)).map(q => new THREE.Vector2(q[0], -q[1]))), ch = p.techo === 'chapa', e = ch ? 0.06 : 0.2;
        const t = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: e, bevelEnabled: false }).rotateX(-Math.PI / 2), mat(ch ? (oscuro() ? '#5b636b' : '#b9c0c6') : '#c3c5c7', { roughness: ch ? 0.45 : 0.92, metalness: ch ? 0.5 : 0 }));
        t.position.y = H - 0.01; t.castShadow = t.receiveShadow = true; t.userData.techo = true; g.add(t); }   // techo del recinto: se saca con la capa «Techos» o al pelar la maqueta
      g.userData.segs = segs; return g; } },
  tanque: { n: 'Tanque o silo', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { radio: 6, alto: 10, color: '#d9dde0' },
    campos: [F.nombre, { k: 'radio', n: 'Radio (m)', t: 'num', min: 0.5, max: 60, paso: 0.5 }, F.alto('Alto (m)', 1, 60, 0.5), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), m = mat(oscuro() ? mix(p.color, '#000', 0.4) : p.color, { roughness: 0.5, metalness: 0.35 }), cono = Math.max(0.4, p.radio * 0.22); malla(g, CIL24, m, 0, p.alto / 2, 0, p.radio * 2, p.alto, p.radio * 2);
      const t = new THREE.Mesh(new THREE.ConeGeometry(p.radio * 1.02, cono, 24), m); t.position.y = p.alto + cono / 2; g.add(sombra(t)); for (const y of [p.alto * 0.33, p.alto * 0.66]) malla(g, CIL24, mat('#9aa3ab', { roughness: 0.5, metalness: 0.5 }), 0, y, 0, p.radio * 2.03, 0.12, p.radio * 2.03, false); return g; } },
  // estacionamiento con autos: playa de asfalto con los lugares pintados y autos estacionados (todos en un solo dibujo). Cada lugar mide 2,6 × 5,2 m.
  estacionamiento: { n: 'Estacionamiento con autos', g: 'Personas y vehículos', forma: 'punto', capa: 'logistica', etiqueta: p => p.nombre, def: { columnas: 8, filas: 1, ocupacion: 70, lugar: 2.6, cargadores: false, para: 'autos', angulo: 0, sinPiso: false },
    campos: [F.nombre, { k: 'columnas', n: 'Lugares por fila', t: 'num', min: 1, max: 80, paso: 1 }, { k: 'filas', n: 'Filas', t: 'num', min: 1, max: 12, paso: 1 }, { k: 'ocupacion', n: 'Ocupación (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'lugar', n: 'Ancho de cada lugar (m)', t: 'num', min: 2.2, max: 6, paso: 0.1 }, { k: 'cargadores', n: 'Cargadores para eléctricos', t: 'bool' }, { k: 'para', n: 'Para', t: 'sel', ops: [['autos', 'Autos'], ['camiones', 'Camiones y remolques']] }, { k: 'angulo', n: 'Ángulo de los lugares (grados, camiones)', t: 'num', min: -60, max: 60, paso: 5 }, { k: 'sinPiso', n: 'Sin piso propio (solo las líneas)', t: 'bool' }, F.r],
    armar(p, ctx) { const g = new THREE.Group(), os = oscuro(), C = Math.max(1, p.columnas | 0), R = Math.max(1, p.filas | 0), LU = +p.lugar || 2.6, w = C * LU / 2, d = R * 5.2 / 2, po = { polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -6 }; if (p.para === 'camiones') return estCamiones(p, g, os, C, R, po);
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(C * LU + 1, R * 5.2 + 1).rotateX(-Math.PI / 2), calmo(matTex(texSuelo('asfalto'), os ? '#55595c' : '#ffffff', [(C * LU + 1) / METROS.asfalto, (R * 5.2 + 1) / METROS.asfalto], { roughness: 0.94, ...po }), 0.38)); piso.position.y = 0.045; piso.receiveShadow = true; piso.userData.noChoca = true; if (!p.sinPiso) g.add(piso);
      const lin = []; for (let r = 0; r < R; r++) for (let c = 0; c <= C; c++) lin.push([-w + c * LU, 0.052, -d + r * 5.2 + 2.6, 0, 0.1, 0.012, 4.9]); const ll = lote(g, CAJA, mat(os ? '#9fb2c2' : '#f2f4f5', { roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -8 }), lin, false); if (ll) ll.userData.noChoca = true;
      if (p.cargadores) { const ev = [], ln = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const x = -w + c * LU + LU / 2, z0 = -d + r * 5.2; ev.push([x + LU / 2 - 0.45, 0.55, z0 + 0.25, 0, 0.22, 1.1, 0.18, '#f4f4f2']); ln.push([x, 0.053, z0 + 5.05, 0, LU * 0.8, 0.012, 0.1]); }   // cargador al fondo de cada lugar y la línea verde al frente
        lote(g, CAJA, mat('#ffffff', { roughness: 0.4 }), ev); const lv = lote(g, CAJA, os ? neon('#2fbf5b') : mat('#2fbf5b', { roughness: 0.5, emissive: '#2fbf5b', emissiveIntensity: 0.15 }), ln, false); if (lv) lv.userData.noChoca = true; }
      // autos: carrocería, cabina vidriada y ruedas; el color y cuáles lugares están ocupados salen del nombre de la pieza (siempre igual)
      let sm = 7; for (const ch of String(p.id || 'e')) sm = (sm * 31 + ch.charCodeAt(0)) % 2147483647; const az = () => { sm = (sm * 16807 + 11) % 2147483647; return (sm & 0xffff) / 0xffff; };
      const COL = os ? ['#6f7a84', '#8b949c', '#3b4249', '#22262a', '#5a2f2c', '#27405f', '#77808a'] : ['#f1f3f4', '#c9ced3', '#8e969d', '#2b2f33', '#a8322b', '#2f5f9e', '#e9e4d6', '#5c6670', '#f1f3f4', '#b9bec4'], it = [], autos = [], vd = os ? '#1b2a36' : '#2b3a47', ru = '#17191c';
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { if (az() * 100 >= p.ocupacion) continue; const x = -w + c * LU + LU / 2 + (az() - 0.5) * 0.25, z = -d + r * 5.2 + 2.6 + (az() - 0.5) * 0.5, col = COL[Math.floor(az() * COL.length)], f = az() < 0.5 ? 1 : -1, alto = az() < 0.3; autos.push({ x, z, f, col, mod: MOD_AUTO[Math.floor(az() * MOD_AUTO.length)] });
        it.push([x, alto ? 0.66 : 0.58, z, 0, 1.78, alto ? 0.78 : 0.6, alto ? 4.5 : 4.25, col], [x, alto ? 1.32 : 1.1, z - f * 0.3, 0, 1.52, alto ? 0.56 : 0.46, alto ? 2.6 : 1.95, vd], [x, alto ? 1.62 : 1.345, z - f * 0.3, 0, 1.4, 0.05, alto ? 2.3 : 1.6, col]);
        for (const sx of [-0.82, 0.82]) for (const sz of [-1.35, 1.35]) it.push([x + sx, 0.32, z + sz, 0, 0.24, 0.64, 0.64, ru]); }
      const lc = lote(g, CAJA, mat('#ffffff', { roughness: 0.45, metalness: 0.35 }), it);
      // los autos de caja son el relleno mientras llegan los modelos del catálogo; si hay catálogo, se cambian por autos de verdad
      if (ctx && ctx.modelo && autos.length) Promise.all([...new Set(autos.map(a => a.mod))].map(id => autoGeo(ctx, id).then(G => [id, G]))).then(L => { if (L.some(q => !q[1] || !q[1].pintura)) return; if (lc) { g.remove(lc); lc.dispose(); }
        if (!MAT_AUTO.p) { MAT_AUTO.p = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.14 }); MAT_AUTO.v = new THREE.MeshStandardMaterial({ color: '#141b22', roughness: 0.07, metalness: 0.85 }); MAT_AUTO.r = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }); }
        for (const [id, G] of L) { const its = autos.filter(a => a.mod === id).map(a => [a.x, 0, a.z, a.f > 0 ? Math.PI / 2 : -Math.PI / 2, 1, 1, 1, a.col]), sin = its.map(q => q.slice(0, 7)); lote(g, G.pintura, MAT_AUTO.p, its, FINO); if (G.vidrio) lote(g, G.vidrio, MAT_AUTO.v, sin, false); if (G.resto) lote(g, G.resto, MAT_AUTO.r, sin, FINO); }
        ctx.dirty && ctx.dirty(); }).catch(() => {});
      return g; } },

  // cinta transportadora, rampa y escalera de exterior (las tres suben hacia +x)
  cinta: { n: 'Cinta transportadora', g: 'Logística', forma: 'punto', capa: 'base', etiqueta: p => p.nombre, def: { largo: 40, alto: 8, ancho: 1.4 },
    campos: [F.nombre, { k: 'largo', n: 'Largo (m)', t: 'num', min: 4, max: 400, paso: 1 }, F.alto('Altura de la punta (m)', 1, 40, 0.5), F.ancho('Ancho (m)', 0.6, 4), F.r],
    armar(p) { const g = new THREE.Group(), L = p.largo, h = Math.max(1, p.alto), a = Math.atan2(h - 1, L), os = oscuro(), k = new THREE.Mesh(CAJA, mat(os ? '#3a444d' : '#59636C', { roughness: 0.6, metalness: 0.3 })); k.scale.set(Math.hypot(L, h - 1), 0.5, p.ancho); k.position.set(0, (1 + h) / 2, 0); k.rotation.z = a; g.add(sombra(k));
      const go = new THREE.Mesh(CAJA, mat('#1e2226', { roughness: 0.9 })); go.scale.set(Math.hypot(L, h - 1) - 0.4, 0.08, p.ancho - 0.3); go.position.set(0, (1 + h) / 2 + 0.27, 0); go.rotation.z = a; g.add(sombra(go, false));
      const po = mat(os ? '#83909A' : '#B6BFC7', { metalness: 0.4, roughness: 0.5 }); for (let x = -L / 2 + 2; x < L / 2; x += 10) { const yy = 1 + (h - 1) * (x + L / 2) / L - 0.25; for (const z of [-p.ancho / 2 + 0.2, p.ancho / 2 - 0.2]) caja(g, x - 0.14, 0, z - 0.12, x + 0.14, yy, z + 0.12, po); } return g; } },
  rampa: { n: 'Rampa', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 4.2, largo: 10, alto: 1.2 },
    campos: [F.nombre, F.ancho('Ancho (m)', 1, 30), { k: 'largo', n: 'Largo (m)', t: 'num', min: 1, max: 80, paso: 0.5 }, F.alto('Altura (m)', 0.2, 8, 0.1), F.r],
    armar(p) { const g = new THREE.Group(), L = p.largo / 2, sh = new THREE.Shape(); sh.moveTo(-L, 0); sh.lineTo(L, 0); sh.lineTo(L, p.alto); sh.closePath(); const geo = new THREE.ExtrudeGeometry(sh, { depth: p.ancho, bevelEnabled: false }); geo.translate(0, 0, -p.ancho / 2);
      const k = new THREE.Mesh(geo, mat(oscuro() ? '#4a5258' : '#c2c8cd', { roughness: 0.95 })); k.userData.noChoca = true; g.add(sombra(k)); const am = mat('#F2C230'); for (const z of [-p.ancho / 2, p.ancho / 2 - 0.12]) { const b = new THREE.Mesh(CAJA, am); b.scale.set(Math.hypot(p.largo, p.alto), 0.1, 0.12); b.position.set(0, p.alto / 2 + 0.06, z + 0.06); b.rotation.z = Math.atan2(p.alto, p.largo); b.userData.noChoca = true; g.add(sombra(b, false)); } g.userData.segs = [];
      g.userData.pisables = [{ rampa: true, x0: -L, x1: L, z0: -p.ancho / 2, z1: p.ancho / 2, xa: -L, xb: L, y0: 0, y1: p.alto }]; return g; } },
  escalera: { n: 'Escalera de exterior', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 3.6, ancho: 1.1 },
    campos: [F.nombre, F.alto('Altura (m)', 0.5, 20, 0.1), F.ancho('Ancho (m)', 0.7, 4), F.r],
    armar(p) { const g = new THREE.Group(), h = p.alto, w = p.ancho / 2, run = h * 1.55, n = Math.max(2, Math.round(h / 0.18)), rs = h / n, tr = run / n, ac = mat(oscuro() ? '#7c868e' : '#A9B3BA', { metalness: 0.5, roughness: 0.5 }), na = mat('#E8641E', { roughness: 0.6 }), ang = Math.atan2(h, run), lar = Math.hypot(h, run);
      for (let i = 0; i < n; i++) { const x = -run / 2 + i * tr; caja(g, x, (i + 1) * rs - 0.04, -w + 0.04, x + tr + 0.02, (i + 1) * rs, w - 0.04, ac, false); }
      for (const z of [-w, w]) { const v = new THREE.Mesh(CAJA, ac); v.scale.set(lar, 0.22, 0.06); v.position.set(0, h / 2 - 0.05, z); v.rotation.z = ang; g.add(sombra(v)); const b = new THREE.Mesh(CAJA, na); b.scale.set(lar, 0.05, 0.05); b.position.set(0, h / 2 + 0.95, z); b.rotation.z = ang; g.add(sombra(b, false));
        for (let i = 0; i <= n; i += Math.max(1, Math.round(n / 5))) { const x = -run / 2 + i * tr, y = i * rs; caja(g, x - 0.025, y, z - 0.025, x + 0.025, y + 1.0, z + 0.025, na, false); } }
      caja(g, run / 2, h - 0.06, -w, run / 2 + 1.2, h, w, ac, false); caja(g, run / 2 + 0.9, 0, -w, run / 2 + 1.0, h - 0.06, -w + 0.1, ac); caja(g, run / 2 + 0.9, 0, w - 0.1, run / 2 + 1.0, h - 0.06, w, ac); g.traverse(m => { m.userData.noChoca = true; });
      // se sube por los escalones (como una rampa) hasta el descanso; por abajo se pasa donde da la altura (es de acero, abierta); las patas no se atraviesan
      g.userData.pisables = [{ rampa: true, x0: -run / 2, x1: run / 2, z0: -w - 0.04, z1: w + 0.04, xa: -run / 2, xb: run / 2, y0: 0, y1: h, abierta: 0.35 }, { x0: run / 2, x1: run / 2 + 1.2, z0: -w, z1: w, y: h, base: h - 0.06 }];
      g.userData.segs = [[run / 2 + 0.95, -w + 0.05, run / 2 + 0.95, -w + 0.05, 0.06, 0, h], [run / 2 + 0.95, w - 0.05, run / 2 + 0.95, w - 0.05, 0.06, 0, h]]; return g; } },

  alero: { n: 'Alero o techado', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 12, fondo: 14, alto: 4.6, color: '#e9ecee', columnas: true },
    campos: [F.nombre, F.ancho('Ancho (m)', 2, 120), F.fondo('Largo (m)', 2, 120), F.alto('Alto libre (m)', 2.2, 15), F.color('Color'), { k: 'columnas', n: 'Con columnas (sin columnas es una losa que apoya en las paredes)', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(), w = p.ancho / 2, d = p.fondo / 2; caja(g, -w, p.alto, -d, w, p.alto + 0.28, d, mat(p.color, { roughness: 0.5, metalness: 0.2 })); const c = mat('#8c949b', { metalness: 0.5, roughness: 0.4 });
      // columnas en el borde, cada 8 m como mucho (un alero largo no queda volando); se cuentan y se ven en la ficha
      if (p.columnas !== false) { const nx = Math.max(1, Math.ceil((2 * w - 0.6) / 8)), nz = Math.max(1, Math.ceil((2 * d - 0.6) / 8)), ya = new Set(), col = (x, z) => { const k = x.toFixed(1) + ',' + z.toFixed(1); if (ya.has(k)) return; ya.add(k); caja(g, x - 0.18, 0, z - 0.18, x + 0.18, p.alto, z + 0.18, c); };
        for (let i = 0; i <= nx; i++) { const x = -(w - 0.3) + (2 * w - 0.6) * i / nx; col(x, -(d - 0.3)); col(x, d - 0.3); } for (let j = 0; j <= nz; j++) { const z = -(d - 0.3) + (2 * d - 0.6) * j / nz; col(-(w - 0.3), z); col(w - 0.3, z); } g.userData.cuenta = ya.size; } return g; } },
  senal: { n: 'Señal de tránsito', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: () => '', def: { tipo: 'velocidad', valor: 15, alto: 2.2 },
    campos: [{ k: 'tipo', n: 'Señal', t: 'sel', ops: [['velocidad', 'Velocidad máxima'], ['pare', 'PARE'], ['ceda', 'Ceda el paso'], ['prohibido', 'Prohibido pasar'], ['noestacionar', 'Prohibido estacionar'], ['peaton', 'Peatones']] }, { k: 'valor', n: 'Velocidad (km/h)', t: 'num', min: 5, max: 120, paso: 5 }, F.alto('Alto del poste (m)', 1, 4), F.r],
    armar(p) { const g = new THREE.Group(), h = p.alto || 2.2, gris = mat(oscuro() ? '#5d646a' : '#9aa1a7', { metalness: 0.5, roughness: 0.45 }); lote(g, CIL, gris, [[0, h / 2, 0, 0, 0.07, h, 0.07]]);
      const m = new THREE.MeshStandardMaterial({ map: senalTex(p.tipo, p.valor), roughness: 0.5, transparent: true, alphaTest: 0.5 }), pl = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), m); pl.position.set(0, h + 0.3, 0.05); g.add(pl);
      const dorso = new THREE.Mesh(new THREE.CircleGeometry(0.37, 24), gris); dorso.position.set(0, h + 0.3, 0.035); dorso.rotation.y = Math.PI; g.add(dorso); return g; } },
  incendio: { n: 'Seguridad e instalaciones (pared)', g: 'Construcción', forma: 'punto', capa: 'base', etiqueta: () => '', def: { tipo: 'extintor' },
    campos: [F.nombre, { k: 'tipo', n: 'Qué es', t: 'sel', ops: [['extintor', 'Extintor con cartel'], ['manguera', 'Gabinete de incendio (manguera)'], ['central', 'Central de alarma de incendio'], ['tablero', 'Armario de tableros eléctricos'], ['felpudo', 'Felpudo de entrada']] }, F.r],
    armar(p) { const g = new THREE.Group(), os = oscuro(), rojo = mat(os ? '#7a1f1c' : '#C8302A', { roughness: 0.45 }), bl = mat(os ? '#8a9096' : '#f2f3f1', { roughness: 0.7 }), ne = mat('#24272b', { roughness: 0.5 }), t = p.tipo || 'extintor';
      if (t === 'extintor') { const c = new THREE.Mesh(CIL, rojo); c.scale.set(0.17, 0.55, 0.17); c.position.set(0, 0.62, 0.12); g.add(c); caja(g, -0.04, 0.9, 0.08, 0.04, 1.0, 0.16, ne); caja(g, -0.18, 1.45, 0, 0.18, 1.75, 0.02, rojo); caja(g, -0.13, 1.5, 0.021, 0.13, 1.7, 0.024, bl, false); }
      if (t === 'manguera') { caja(g, -0.4, 0.7, 0, 0.4, 1.6, 0.22, rojo); caja(g, -0.33, 0.78, 0.221, 0.33, 1.52, 0.226, mat('#cfe3ea', { roughness: 0.1, transparent: true, opacity: 0.45 }), false); const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 20), rojo); r.position.set(0, 1.15, 0.12); g.add(r); const ca = new THREE.Mesh(CIL, rojo); ca.scale.set(0.06, 2.6, 0.06); ca.position.set(0.5, 1.3, 0.06); g.add(ca); }
      if (t === 'central') { caja(g, -0.28, 1.3, 0, 0.28, 1.75, 0.1, ne); caja(g, -0.2, 1.6, 0.101, 0.2, 1.68, 0.104, mat('#9fd0a8', os ? { emissive: '#3cff7a', emissiveIntensity: 0.6 } : {}), false); for (let i = 0; i < 3; i++) caja(g, -0.2, 1.36 + i * 0.07, 0.101, 0.2, 1.4 + i * 0.07, 0.103, mat('#3a3f45'), false); }
      if (t === 'tablero') { caja(g, -0.7, 0, 0, 0.7, 2.6, 0.6, bl); caja(g, -0.005, 0.05, 0.6, 0.005, 1.95, 0.605, mat('#c9cccf'), false); caja(g, -0.7, 1.97, 0.6, 0.7, 1.99, 0.605, mat('#c9cccf'), false); for (const x of [-0.08, 0.05]) caja(g, x, 0.9, 0.6, x + 0.03, 1.15, 0.63, mat('#8d9399', { metalness: 0.6 }), false); }
      if (t === 'felpudo') caja(g, -0.75, 0, -0.45, 0.75, 0.02, 0.45, ne);
      return g; } },
  semaforo: { n: 'Semáforo', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 2.6, poste: false, luz: 'verde' },
    campos: [F.nombre, { k: 'luz', n: 'Luz prendida', t: 'sel', ops: [['verde', 'Verde'], ['roja', 'Roja']] }, F.alto('Altura (m)', 1.5, 6, 0.05), { k: 'poste', n: 'Con poste propio', t: 'bool' }, F.r],
    armar(p) { const g = new THREE.Group(), os = oscuro(), h = p.alto, on = c => os ? neon(c) : mat(c, { emissive: c, emissiveIntensity: 0.85 }), off = c => mat(c, { roughness: 0.5 });
      if (p.poste) caja(g, -0.05, 0, -0.05, 0.05, h - 0.4, 0.05, mat('#3a3f44', { metalness: 0.5, roughness: 0.5 })); caja(g, -0.16, h - 0.4, -0.12, 0.16, h + 0.36, 0.12, negro());
      caja(g, -0.1, h - 0.3, 0.12, 0.1, h - 0.06, 0.135, p.luz === 'verde' ? on('#3ddc84') : off('#123d24'), false); caja(g, -0.1, h + 0.02, 0.12, 0.1, h + 0.26, 0.135, p.luz === 'roja' ? on('#ff3b30') : off('#4a1512'), false); return g; } },
  columna: { n: 'Columna de luz', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 25, focos: 3 },
    campos: [F.nombre, F.alto('Alto (m)', 4, 45, 0.5), { k: 'focos', n: 'Focos', t: 'num', min: 1, max: 12, paso: 1 }, F.r],
    armar(p) { const g = new THREE.Group(), H = p.alto, gris = mat(oscuro() ? '#7b838a' : '#a4acb3', { metalness: 0.5, roughness: 0.45 }); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, H, 10), gris); k.position.y = H / 2; g.add(sombra(k));
      const n = p.focos | 0, w = Math.max(1.2, n * 0.75); caja(g, -w / 2, H, -0.12, w / 2, H + 0.25, 0.12, gris); const lm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1cc', emissiveIntensity: oscuro() ? 1.6 : 0.25 });
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; caja(g, x - 0.28, H - 0.3, 0.05, x + 0.28, H, 0.6, lm, false); if (oscuro()) brillo(g, x, H - 0.4, 0.4, 4.5, '#ffe2b0', 0.55); }
      if (oscuro()) pozo(g, 0, 6, H * 1.05, '#ffcf8a', 0.3); return g; } },
  // farol de calle o de estacionamiento: poste fino con el cabezal largo; de noche, luz cálida en el piso hacia donde mira (−z)
  farol: { n: 'Farol', g: 'Construcción', forma: 'punto', capa: 'base', def: { alto: 3.6 },
    campos: [F.nombre, F.alto('Alto (m)', 2, 12, 0.1), F.r],
    armar(p) { const g = new THREE.Group(), os = oscuro(), H = p.alto, ac = mat('#2a2c31', { metalness: 0.6, roughness: 0.4 }); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, H, 10), ac); k.position.y = H / 2; g.add(sombra(k));
      caja(g, -0.45, H - 0.05, -0.08, 0.45, H + 0.03, 0.08, ac); caja(g, -0.42, H - 0.07, -0.06, 0.42, H - 0.05, 0.06, os ? neon('#ffe2b0') : mat('#f1f2f3', { roughness: 0.3 }), false);
      if (os) { brillo(g, 0, H - 0.15, 0, 1.6, '#ffe2b0', 0.8); pozo(g, 0, -1.6, 3.4, '#ffcf8a', 0.42); } return g; } },
  // luminaria colgante lineal (oficinas): cuelga de dos tensores; de noche, la tira de LED se enciende
  luminaria: { n: 'Luminaria colgante', g: 'Muebles', forma: 'punto', capa: 'base', def: { largo: 1.6, y: 2.42 },
    campos: [F.nombre, { k: 'largo', n: 'Largo (m)', t: 'num', min: 0.4, max: 6, paso: 0.1 }, { k: 'y', n: 'Altura (m)', t: 'num', min: 1.8, max: 6, paso: 0.05 }, F.r],
    armar(p) { const g = new THREE.Group(), os = oscuro(), L = p.largo, y = p.y; caja(g, -L / 2, y, -0.04, L / 2, y + 0.05, 0.04, mat('#c9ccd2', { metalness: 0.6, roughness: 0.35 }), false);
      caja(g, -L / 2 + 0.02, y - 0.006, -0.02, L / 2 - 0.02, y, 0.02, os ? neon('#ffd59a') : mat('#ffffff', { roughness: 0.3, emissive: '#ffd59a', emissiveIntensity: 0.15 }), false);
      for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) caja(g, x - 0.004, y + 0.05, -0.004, x + 0.004, y + 0.6, 0.004, mat('#2a2c31'), false);
      if (os) pozo(g, 0, 0, Math.max(1.6, L * 1.1), '#ffd9a8', 0.16); return g; } },
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
  barrera: { n: 'Barrera', g: 'Construcción', forma: 'punto', capa: 'base', def: { ancho: 4.5, color: '#E5484D' },
    campos: [F.nombre, { k: 'estilo', n: 'Tipo', t: 'sel', ops: [['brazo', 'Barrera automática (brazo rayado)'], ['cano', 'Tranquera de caño (a mano, con rueda)']] }, F.ancho('Largo del brazo (m)', 1, 10), F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), col = p.color || '#E5484D';
      if (p.estilo === 'cano') { // tranquera de caño: poste con bisagra, caño arriba y otro en diagonal, pata con rueda a la mitad
        const L = p.ancho || 6, am = mat(oscuro() ? mix(col, '#000', 0.4) : col, { roughness: 0.45, metalness: 0.3 }), ne = mat('#2a2c31', { roughness: 0.6 });
        lote(g, CIL, am, [[0, 0.65, 0, 0, 0.12, 1.3, 0.12], [L / 2 + 0.2, 0.55, 0, 0, 0.06, 0.9, 0.06]]); const c = new THREE.Mesh(CIL, am); c.scale.set(0.08, L, 0.08); c.rotation.z = Math.PI / 2; c.position.set(L / 2 + 0.1, 1.05, 0); g.add(c);
        const dg = new THREE.Mesh(CIL, am), dl = Math.hypot(L * 0.45, 0.7); dg.scale.set(0.05, dl, 0.05); dg.rotation.z = Math.atan2(L * 0.45, 0.7); dg.position.set(0.1 + L * 0.225, 0.68, 0); g.add(dg);
        const ru = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), ne); ru.rotation.x = Math.PI / 2; ru.position.set(L / 2 + 0.2, 0.1, 0); g.add(ru); return g; } caja(g, -0.5, 0, -0.5, 0.5, 0.12, 0.5, mat(oscuro() ? '#5a6066' : '#b9bbb6', { roughness: 0.95 })); caja(g, -0.3, 0.12, -0.3, 0.3, 1.15, 0.3, mat(col, { roughness: 0.5 })); caja(g, -0.75, 0.9, -0.09, -0.3, 1.12, 0.09, mat('#2a2c31', { metalness: 0.5, roughness: 0.5 })); caja(g, -0.2, 1.15, -0.2, 0.2, 1.22, 0.2, mat('#2a2c31', { roughness: 0.6 }), false); const b = rayas('#ffffff', col, 6).clone(); b.needsUpdate = true; b.rotation = Math.PI / 2; b.repeat.set(1, p.ancho / 1.2);
      caja(g, 0.3, 0.95, -0.06, 0.3 + p.ancho, 1.07, 0.06, new THREE.MeshStandardMaterial({ map: b, roughness: 0.5 })); return g; } },
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
      { k: 'pies', n: 'Contenedores de', t: 'sel', ops: [[40, '40 pies'], [20, '20 pies']] }, { k: 'carga', n: 'Tipo', t: 'sel', ops: [['seco', 'Secos'], ['reefer', 'Refrigerados (reefer)'], ['tanque', 'Tanques (cisterna de 20 pies)']] }, { k: 'color', n: 'Color de la naviera', t: 'color' },
      { k: 'colores', n: 'Colores', t: 'sel', ops: [['', 'El color que elegí'], ['navieras', 'El de la naviera real más parecida']] },
      { k: 'ocupacion', n: 'Ocupación (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'mezcla', n: 'Otras navieras mezcladas (%)', t: 'num', min: 0, max: 100, paso: 5 }, { k: 'semilla', n: 'Variante', t: 'num', min: 0, max: 999, paso: 1 }, F.r],
    // cada contenedor: el cuerpo (chapa con relieve, puertas, óxido) y su esqueleto (esquineros, encastres, largueros, barras) en un tono más oscuro.
    // Tanques: cilindro en marco abierto, siempre de 20 pies. Colores «navieras»: el color medido pasa al de la naviera real más parecida.
    armar(p) { const tq = p.carga === 'tanque', pies = tq ? 20 : +p.pies === 20 ? 20 : 40, g = new THREE.Group(), L = pies === 20 ? 6.06 : 12.19, tr = p.orient === 'trans', pitch = tr ? 2.74 : L + 0.34, paso = tr ? L + 0.34 : 2.74, ns = Math.max(1, Math.floor(p.largo / pitch)), nr = p.ancho | 0, R = azar(semilla(p)), rf = p.carga === 'reefer', its = [], esq = [], celdas = [], som = [];
      const x0 = -ns * pitch / 2, z0 = -(nr - 1) * paso / 2, H = H_CONT, occ = (p.ocupacion ?? 75) / 100, propio = p.colores === 'navieras' ? navieraDe(p.color || '#2f6fd6')[1] : p.color;
      const blq = p.bloque | 0; for (let s = 0; s < ns; s++) for (let r = 0; r < nr; r++) { if (blq && s % (blq + 1) === blq) continue; const borde = tr && nr <= 2 ? R() < 0.25 : r === 0 || r === nr - 1, lleno = R() < Math.min(1, occ * (borde ? 0.9 : 1.15)); if (!lleno) continue;
        const h = Math.max(1, Math.min(p.alto, Math.round((borde ? 0.45 : 0.62) * p.alto + (R() - 0.35) * p.alto * 0.7 * occ + occ * 1.2))); som.push([x0 + (s + 0.5) * pitch, z0 + r * paso]);
        for (let t = 0; t < h; t++) { let c = rf ? (R() < 0.5 ? '#e9edf0' : '#dfe4e8') : R() * 100 < (p.mezcla ?? 12) ? navieraAlAzar(R) : propio; _c.set(c).offsetHSL(0, rf ? 0 : -R() * 0.06, (R() - 0.5) * 0.07);
          const x = x0 + (s + 0.5) * pitch, y = t * H + H / 2, z = z0 + r * paso, gi = tr ? Math.PI / 2 : 0, cuerpo = '#' + _c.getHexString();
          if (tq) { its.push([x, t * H, z, gi, 1, 1, 1, R() < 0.7 ? '#a9b0b5' : '#8d959b']); esq.push([x, t * H, z, gi, 1, 1, 1, cuerpo]); }
          else { its.push([x, y, z, gi, L - 0.05, H - 0.03, 2.44 - 0.05, cuerpo]); _c.multiplyScalar(rf ? 0.92 : 0.74); esq.push([x, t * H, z, gi, 1, 1, 1, '#' + _c.getHexString()]); }
          celdas.push([s, r, t]); } }
      const im = tq ? lote(g, tanqueGeo().cuerpo, mat('#ffffff', { roughness: 0.38, metalness: 0.45 }), its) : lote(g, CONT, FINO ? matsCuerpo(pies, rf, oscuro()) : matsCont(pies === 20 ? 22 : 44, rf), its);
      if (im) im.userData.celdas = celdas;
      if (esq.length && (FINO || tq)) { const m = lote(g, tq ? tanqueGeo().marco : marcoCont(pies), mat('#ffffff', { roughness: 0.62, metalness: 0.3 }), esq, !!tq); if (m) m.userData.noPick = !tq; }
      if (som.length) g.add(sombraPie(som, tr ? 3.3 : L + 1.3, tr ? L + 1.3 : 3.3));
      if (oscuro()) { const a = acento(), X = -x0 + 0.6, Z = -z0 + (tr ? L / 2 + 0.6 : 2); for (const [u0, v0, u1, v1] of [[-X, -Z, X, -Z], [-X, Z, X, Z], [-X, -Z, -X, Z], [X, -Z, X, Z]]) { const k = new THREE.Mesh(CAJA, neon(a)); k.position.set((u0 + u1) / 2, 0.16, (v0 + v1) / 2); k.scale.set(Math.abs(u1 - u0) + 0.3, 0.08, Math.abs(v1 - v0) + 0.22); g.add(k);
          const b = new THREE.Mesh(CAJA, neon(a, 0.16)); b.position.copy(k.position); b.scale.set(Math.abs(u1 - u0) + 1.6, 0.04, Math.abs(v1 - v0) + 1.6); b.renderOrder = 2; g.add(b); } }
      g.userData.cuenta = its.length; return g; } },
  chasis: { n: 'Semirremolque', g: 'Logística', forma: 'punto', capa: 'logistica', def: { carga: '' }, campos: [F.nombre, { k: 'carga', n: 'Contenedor arriba (color)', t: 'color' }, F.r],
    armar(p) { return camionQuieto(new THREE.Group(), p.carga, ''); } },
  camion: { n: 'Camión con contenedor', g: 'Logística', forma: 'punto', capa: 'logistica', def: { carga: '#c2415b', cabina: '#f2f4f5' },
    campos: [F.nombre, { k: 'carga', n: 'Contenedor (color, vacío = sin carga)', t: 'color' }, { k: 'cabina', n: 'Cabina', t: 'color' }, F.r],
    armar(p) { return camionQuieto(new THREE.Group(), p.carga, p.cabina || '#f2f4f5'); } },
  maquina: { n: 'Máquina de patio', g: 'Logística', forma: 'punto', capa: 'logistica', etiqueta: p => p.nombre, def: { tipo: 'apiladora', color: '#d8a31a' },
    campos: [F.nombre, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['apiladora', 'Apiladora de vacíos'], ['reach', 'Reach stacker'], ['autoelevador', 'Autoelevador']] }, F.color('Color'), F.r],
    armar(p) { const g = new THREE.Group(), c = mat(p.color, { roughness: 0.5, metalness: 0.3 }), n = mat('#24282c', { metalness: 0.4 }), big = p.tipo !== 'autoelevador';
      caja(g, -3.2 * (big ? 1 : 0.5), 0.6, -1.4 * (big ? 1 : 0.6), 2.2 * (big ? 1 : 0.5), 2.2 * (big ? 1 : 0.7), 1.4 * (big ? 1 : 0.6), c); caja(g, -1.6, 2.2, -0.9, 0, 4.4, 0.9, mat('#2c3e4f', { roughness: 0.15, metalness: 0.5 }));
      if (p.tipo === 'reach') return reachStacker(g, p);
      else { for (const z of [-0.9, 0.9]) caja(g, 2.3, 0.4, z - 0.15, 2.6, big ? 16 : 4.5, z + 0.15, n); caja(g, 2.6, big ? 12 : 1.2, -1.3, 3.1, big ? 12.5 : 1.4, 1.3, n); }
      for (const [x, z] of [[-2.4, -1.3], [-2.4, 1.3], [1.5, -1.3], [1.5, 1.3]]) { const w = cil(g, x * (big ? 1 : 0.5), 0, z * (big ? 1 : 0.6), big ? 0.75 : 0.35, 0.6, n); w.rotation.x = Math.PI / 2; w.position.y = big ? 0.75 : 0.35; } return g; } },
  vehiculo: { n: 'Vehículo', g: 'Personas y vehículos', forma: 'punto', capa: 'logistica', def: { modelo: 'suv', color: '' },
    campos: [F.nombre, { k: 'modelo', n: 'Modelo', t: 'sel', ops: [['suv', 'SUV'], ['eq7', 'Chery eQ7'], ['toro', 'Pickup (Fiat Toro)'], ['fiorino', 'Furgón chico (Fiorino)'], ['bipper', 'Utilitario (Bipper)']] }, { k: 'color', n: 'Color', t: 'color' }, F.r],
    armar(p, ctx) { const g = new THREE.Group(), c = mat(p.color || '#c9ced2', { roughness: 0.35, metalness: 0.4 }); caja(g, -2.2, 0.35, -0.9, 2.2, 1.1, 0.9, c); caja(g, -1.2, 1.1, -0.82, 1.0, 1.6, 0.82, mat('#2c3e4f', { roughness: 0.1, metalness: 0.6 }));
      ctx && ctx.glb && ctx.glb('vehiculos', p.modelo, g, p.color); return g; } },
  persona: { n: 'Persona', g: 'Personas y vehículos', forma: 'punto', capa: 'logistica', etiqueta: p => p.cartel ? p.nombre : '', def: { modelo: 'tec-h-epp' },
    campos: [F.nombre, { k: 'modelo', n: 'Cómo es', t: 'sel', ops: [['tec-h-epp', 'Técnico con casco y chaleco'], ['tec-h', 'Técnico con mameluco'], ['of-h', 'Oficina (hombre)'], ['of-h2', 'Oficina (hombre con suéter)'], ['of-m', 'Oficina (mujer)'], ['of-m2', 'Oficina (mujer con suéter)'], ['of-h5', 'Oficina (hombre, chomba y cargo)'], ['of-h6', 'Oficina (hombre, camisa a rayas)'], ['of-h7', 'Oficina (hombre, remera y pantalón de vestir)'], ['of-m5', 'Oficina (mujer, remera y jean)'], ['of-m6', 'Oficina (mujer, remera y botas)'], ['of-m7', 'Oficina (mujer, blusa y pollera)']] }, { k: 'pose', n: 'Postura', t: 'sel', ops: [['', 'Parada'], ['sentado', 'Sentada (en su puesto)']] }, F.r],
    armar(p, ctx) { const g = new THREE.Group(); g.userData.pose = p.pose || ''; cil(g, 0, 0, 0, 0.22, 1.45, mat('#3b5b7a')); const k = new THREE.Mesh(BOLA, mat('#e0b493')); k.scale.setScalar(0.26); k.position.y = 1.62; g.add(sombra(k)); ctx && ctx.glb && ctx.glb('avatares', p.modelo, g, null, p.id); return g; } },

  // equipos (Ondi). y = altura de montaje; uid = vínculo con el equipo real de la app (UniFi, Meraki o cargado a mano)
  camara: { n: 'Cámara', g: 'Equipos', forma: 'punto', capa: 'equipos', equipo: 'cam', ondi: 'camara', etiqueta: p => p.nombre, def: { y: 6, alcance: 25, clase: 'bullet' },
    campos: [...EQ_CAMPOS.slice(0, 1), { k: 'clase', n: 'Modelo de cámara', t: 'sel', ops: CAMARAS }, ...EQ_CAMPOS.slice(1, 7), MONT, BASE, { k: 'inclina', n: 'Inclinación (°)', t: 'num', min: 0, max: 80, paso: 1 }, { k: 'alcance', n: 'Alcance (m)', t: 'num', min: 0, max: 200, paso: 1 }, { k: 'apertura', n: 'Apertura (°)', t: 'num', min: 10, max: 360, paso: 5 }, EQ_CAMPOS[7]],
    variantes: CAMARAS.map(([clase, n]) => ({ n: 'Cámara ' + n.replace(/ \(.*/, '').toLowerCase().replace('ptz', 'PTZ'), o: { clase } })),
    armar: equipo((g, p, ec, mont) => { const c = p.clase || 'bullet'; if (c === 'domo' || c === 'ptz') camDomo(g, p, ec, mont, c === 'ptz'); else if (c === 'ojo') camOjo(g, p, ec, mont); else if (c === 'torreta') camTorreta(g, p, ec, mont); else if (c === 'multisensor') camMulti(g, p, ec, mont); else if (c === 'cubo') camCubo(g, p, ec, mont); else camBullet(g, p, ec, mont, c); campoVision(g, p, ec); }) },
  ap: { n: 'Wi-Fi (punto de acceso)', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'ap', equipo: 'ap', etiqueta: p => p.nombre, def: { y: 8, clase: 'techo' },
    campos: [...EQ_CAMPOS.slice(0, 1), { k: 'clase', n: 'Tipo', t: 'sel', ops: [['techo', 'De techo o pared (disco)'], ['exterior', 'De exterior (antenas)'], ['enlace', 'Enlace punto a punto (antena plato)']] }, ...EQ_CAMPOS.slice(1)],
    variantes: [{ n: 'Wi-Fi de techo', o: { clase: 'techo' } }, { n: 'Wi-Fi de exterior', o: { clase: 'exterior', y: 6 } }, { n: 'Enlace punto a punto', o: { clase: 'enlace', y: 10 } }],
    armar: equipo((g, p, ec, mont) => { if (p.clase === 'exterior' || p.clase === 'enlace') { apExterior(g, p, ec, mont); return; } const k = new THREE.Group(); g.add(k); if (mont !== 'techo') { k.rotation.x = Math.PI / 2; k.position.z = mont === 'pared' ? 0.045 : 0.1; caja(g, -0.1, -0.1, mont === 'pared' ? -0.03 : 0.02, 0.1, 0.1, mont === 'pared' ? 0.01 : 0.07, blanco()); }
      malla(k, CIL24, blanco(), 0, 0, 0, 0.58, 0.07, 0.58); const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 28).rotateX(Math.PI / 2), led(ec)); r.position.y = mont !== 'techo' ? 0.04 : -0.04; k.add(r); }) },
  // switch: de escritorio, de rack (24 o 48 bocas, 1U), industrial de riel DIN o en caja de exterior; la cantidad de bocas se ve en el frente
  switch: { n: 'Switch', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'switch', equipo: 'sw', etiqueta: p => p.nombre, def: { y: 1.5, clase: 'escritorio', bocas: 8 },
    campos: [...EQ_CAMPOS.slice(0, 1), { k: 'clase', n: 'Tipo de switch', t: 'sel', ops: SWITCHES }, { k: 'bocas', n: 'Bocas', t: 'num', min: 4, max: 52, paso: 1 }, ...EQ_CAMPOS.slice(1)],
    variantes: [{ n: 'Switch de escritorio (8 bocas)', o: { clase: 'escritorio', bocas: 8 } }, { n: 'Switch de rack 24 bocas', o: { clase: 'rack', bocas: 24, y: 1.2 } }, { n: 'Switch de rack 48 bocas', o: { clase: 'rack', bocas: 48, y: 1.2 } }, { n: 'Switch industrial (riel DIN)', o: { clase: 'din', bocas: 8, montaje: 'pared', y: 1.6 } }, { n: 'Switch PoE de exterior (caja)', o: { clase: 'exterior', bocas: 8, y: 3 } }],
    armar: equipo((g, p, ec, mont) => { const c = p.clase || 'escritorio', n = Math.max(4, Math.min(52, +p.bocas || 8)), gris = mat(oscuro() ? '#2f353b' : '#9aa3ab', { roughness: 0.45, metalness: 0.4 });
      if (c === 'din') { caja(g, -0.06, -0.12, -0.01, 0.06, 0.12, 0.13, gris); for (let i = 0; i < Math.min(n, 10); i++) caja(g, -0.045, -0.1 + i * 0.022, 0.13, -0.02, -0.088 + i * 0.022, 0.135, led(ec), false); return; }
      if (c === 'exterior') { caja(g, -0.2, -0.24, -0.02, 0.2, 0.24, 0.16, mat(oscuro() ? '#3a4046' : '#d9dde0', { roughness: 0.6 })); caja(g, -0.16, -0.2, 0.16, 0.16, 0.2, 0.17, gris); for (let i = 0; i < 4; i++) malla(g, CIL, negro(), -0.12 + i * 0.08, -0.27, 0.07, 0.03, 0.06, 0.03); malla(g, BOLA, led(ec), 0.13, 0.17, 0.175, 0.025, 0.025, 0.025, false); return; }
      const W = c === 'rack' ? 0.48 : 0.44, D = c === 'rack' ? 0.32 : 0.44, H = c === 'rack' ? 0.05 : 0.06; caja(g, -W / 2, -H / 2, -D / 2, W / 2, H / 2, D / 2, c === 'rack' ? gris : negro());
      const fil = n > 24 ? 2 : 1, col = Math.ceil(n / fil), paso = (W - 0.08) / col; for (let f = 0; f < fil; f++) for (let i = 0; i < col; i++) caja(g, -W / 2 + 0.04 + i * paso, -H / 2 + 0.008 + f * H * 0.45, D / 2, -W / 2 + 0.04 + i * paso + paso * 0.7, -H / 2 + 0.008 + f * H * 0.45 + H * 0.35, D / 2 + 0.005, led(ec), false); }) },
  // rack: de piso con puerta de vidrio, de pared (más chico, colgado) o abierto (dos parantes). Lo de adentro se documenta aparte (bocas, patch cords, fibras).
  rack: { n: 'Rack', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'otro', equipo: 'sw', protegido: true, etiqueta: p => p.nombre, def: { y: 0, alto: 2, clase: 'piso' },
    campos: [...NODO_CAMPOS(), { k: 'clase', n: 'Tipo de rack', t: 'sel', ops: [['piso', 'De piso'], ['pared', 'De pared'], ['abierto', 'Abierto (parantes)']] }, F.alto('Alto (m)', 0.3, 2.4), { k: 'ancho', n: 'Ancho (m)', t: 'num', min: 0.4, max: 1, paso: 0.05 }, { k: 'fondo', n: 'Fondo (m)', t: 'num', min: 0.3, max: 1.2, paso: 0.05 }, { k: 'base', n: 'Altura del borde de abajo (m)', t: 'num', min: 0, max: 3, paso: 0.05 }, F.r, EQ_CAMPOS[7]],
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
    campos: [...NODO_CAMPOS(), { k: 'ancho', n: 'Ancho (m)', t: 'num', min: 0.3, max: 1.2, paso: 0.05 }, F.alto('Alto (m)', 0.3, 1.6, 0.05), { k: 'fondo', n: 'Fondo (m)', t: 'num', min: 0.15, max: 0.6, paso: 0.05 },
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
  // la entrada de internet del cliente: el equipo que pone el proveedor (Antel, Tigo, Claro, Dedicado…). Es lo primero que se mira cuando «no hay internet»
  proveedor: { n: 'Equipo del proveedor de internet', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'router', equipo: 'gw', etiqueta: p => p.nombre, def: { y: 1.2, proveedor: 'antel', tipo: 'ont', montaje: 'pared' },
    variantes: [{ n: 'Router de fibra de Antel (ZTE F6600 / F680)', o: { proveedor: 'antel', tipo: 'ont', modelo: 'ZTE F6600' } }, { n: 'Wi-Fi Max de Antel (repetidor)', o: { proveedor: 'antel', tipo: 'mesh', modelo: 'Wi-Fi Max ZTE', y: 1.6 } },
      { n: 'Router 4G/5G (Tigo, Claro, Antel)', o: { proveedor: 'tigo', tipo: 'lte' } }, { n: 'Antena de radio (Dedicado)', o: { proveedor: 'dedicado', tipo: 'radio', montaje: 'poste', y: 6 } }],
    campos: [F.nombre, { k: 'proveedor', n: 'Proveedor', t: 'sel', ops: [['antel', 'Antel'], ['tigo', 'Tigo (antes Movistar)'], ['claro', 'Claro'], ['dedicado', 'Dedicado'], ['starlink', 'Starlink'], ['otro', 'Otro']] },
      { k: 'tipo', n: 'Equipo', t: 'sel', ops: [['ont', 'Router de fibra (ONT)'], ['mesh', 'Repetidor Wi-Fi del proveedor'], ['lte', 'Router 4G / 5G'], ['radio', 'Antena de radio'], ['sat', 'Antena satelital']] },
      { k: 'modelo', n: 'Modelo', t: 'txt' }, { k: 'servicio', n: 'Número de servicio o de cliente', t: 'txt' }, { k: 'ippub', n: 'IP pública (si tiene fija)', t: 'txt' }, ...EQ_CAMPOS.slice(3)],
    armar: equipo((g, p, ec) => { const b = blanco(), os = oscuro(), ng = mat(os ? '#2a2f34' : '#3b4248', { roughness: 0.6 });
      if (p.tipo === 'radio') { caja(g, -0.16, -0.2, -0.05, 0.16, 0.2, 0.05, b); caja(g, -0.05, -0.05, -0.12, 0.05, 0.05, -0.05, ng); caja(g, -0.1, 0.12, 0.05, 0.1, 0.13, 0.055, led(ec), false); return; }   // panel direccional en el poste
      if (p.tipo === 'sat') { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.04, 28), b); d.rotation.x = -0.9; g.add(sombra(d)); caja(g, -0.03, -0.25, -0.03, 0.03, 0, 0.03, ng); return; }
      if (p.tipo === 'mesh' || p.tipo === 'lte') { caja(g, -0.06, -0.11, -0.06, 0.06, 0.11, 0.06, b); caja(g, -0.035, 0.07, 0.06, 0.035, 0.08, 0.065, led(ec), false); return; }   // torre chica parada
      caja(g, -0.13, -0.11, -0.04, 0.13, 0.11, 0.04, b); caja(g, -0.1, 0.06, 0.04, 0.1, 0.065, 0.045, led(ec), false); for (const x of [-0.09, 0.09]) caja(g, x - 0.012, 0.11, -0.012, x + 0.012, 0.27, 0.012, ng); }) },   // ONT de fibra con sus dos antenas
  sensor: { n: 'Sensor', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'sensor_mov', equipo: 'sen', etiqueta: p => p.nombre, def: { y: 2.2, clase: 'mov', montaje: 'pared' },
    campos: [...EQ_CAMPOS.slice(0, 1), { k: 'clase', n: 'Tipo', t: 'sel', ops: SENSORES }, ...EQ_CAMPOS.slice(1)],
    variantes: [{ n: 'Sensor de movimiento', o: { clase: 'mov' } }, { n: 'Sensor de humo', o: { clase: 'humo', montaje: 'techo', y: 3 } }, { n: 'Temperatura y humedad', o: { clase: 'temp', y: 1.6 } }, { n: 'Control de acceso', o: { clase: 'acceso', y: 1.2 } }, { n: 'Sirena', o: { clase: 'sirena', y: 2.6 } }],
    armar: equipo(sensorDib) },
  ups: { n: 'UPS', g: 'Equipos', forma: 'punto', capa: 'equipos', ondi: 'ups', equipo: 'otro', etiqueta: p => p.nombre, def: { y: 0 }, campos: EQ_CAMPOS,
    armar: equipo((g, p, ec) => { caja(g, -0.12, 0, -0.22, 0.12, 0.42, 0.22, negro()); caja(g, -0.04, 0.32, 0.22, 0.04, 0.36, 0.225, led(ec), false); }) },
  fibra: { n: 'Tendido de fibra o cable', g: 'Equipos', forma: 'linea', capa: 'equipos', def: { y: 0, color: '#ff8a00', hilos: 12 },
    campos: [F.nombre, { k: 'tipo', n: 'Tipo', t: 'sel', ops: [['', 'Fibra óptica'], ['utp', 'Cable UTP (cobre)']] }, { k: 'hilos', n: 'Hilos o cables', t: 'num', min: 1, max: 288, paso: 1 }, { k: 'y', n: 'Altura (0 = subterráneo)', t: 'num', min: 0, max: 30, paso: 0.5 }, F.color('Color'), { k: 'notas', n: 'Notas', t: 'area' }],
    armar(p, ctx) { if (p.pts && p.pts.some(q => q.length > 2)) return tendido3d(p);   /* con altura en cada punto: baja por la pared, corre por el piso, sube por la mesa */
      const g = new THREE.Group(), y = p.y || 0, F = carrilesFibra(ctx), k = F.car.get(p.id) || 0, off = k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.62 : 0, color = (!p.color || p.color === '#ff8a00') && F.idx.size > 1 ? COL_FIBRA[(F.idx.get(p.id) || 0) % COL_FIBRA.length] : p.color, pts = off && !y ? offset(p.pts, off) : p.pts, m = new THREE.MeshBasicMaterial({ color });
      if (y) { const c = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(q[0], y, q[1])), false, 'catmullrom', 0); g.add(new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(8, pts.length * 8), p.tipo === 'utp' ? 0.008 + 0.004 * Math.sqrt(p.hilos || 1) : 0.06, 6), m)); }   // UTP: el mazo de cables, del grueso que da la cantidad
      else { const po = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -8 }, c = new THREE.Mesh(cinta(pts, 0.46, 0.085), new THREE.MeshBasicMaterial({ color, opacity: 0.92, ...po })); c.renderOrder = 2; g.add(c);
        // el pulso de luz que corre por la fibra: se ve que está viva y hacia dónde va
        const fl = new THREE.Mesh(cinta(pts, 0.3, 0.09), new THREE.MeshBasicMaterial({ color: mix(color, '#ffffff', 0.7), map: texFlujo(), toneMapped: false, ...po, polygonOffsetFactor: -12, polygonOffsetUnits: -10 })); fl.renderOrder = 3; fl.raycast = () => {}; g.add(fl); } return g; } },


  // ---------- plano del lugar y control de acceso ----------
  plano: { n: 'Plano del lugar (imagen)', g: 'Terreno', forma: 'punto', capa: 'plano', fondo: true, archivo: 'image/*', def: { ancho: 60, aspecto: 0.62, opacidad: 1, fijo: false },
    campos: [F.nombre, F.ancho('Ancho real (m)', 2, 3000), { k: 'nivel', n: 'Planta de este plano', t: 'sel', ops: PLANTAS }, { k: 'opacidad', n: 'Opacidad', t: 'num', min: 0.2, max: 1, paso: 0.05 }, { k: 'fijo', n: 'Fijo: no se mueve al arrastrar', t: 'bool' }, F.r],
    armar(p, ctx) { const g = new THREE.Group(), w = p.ancho, d = p.ancho * (p.aspecto || 0.62), os = oscuro(), op = Math.min(1, Math.max(0.2, p.opacidad ?? 1));
      const m = new THREE.MeshBasicMaterial({ map: p.img ? texPlano(p.img, os, ctx && ctx.dirty) : hojaVacia(os), transparent: op < 1, opacity: op, depthWrite: op >= 1, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -6 });
      const k = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m); k.position.y = 0.075; g.add(k);   // por encima del piso de los recintos (que lo tapaba) y debajo de las paredes; el de un piso alto sube con su planta
      caja(g, -w / 2 - 0.12, 0, -d / 2 - 0.12, w / 2 + 0.12, 0.034, d / 2 + 0.12, mat(os ? '#0b0c0f' : '#c3c8cf', { roughness: 0.9 }), false);   // el canto: se lee como una hoja apoyada
      g.userData.sinAplanar = true; return g; } },
  acceso: { n: 'Puerta con control de acceso', g: 'Control de acceso', forma: 'punto', capa: 'acceso', vivo: true, siempre: true, etiqueta: p => p.nombre, def: { clase: 'puerta', muro: true, lector: 'afuera' },
    campos: [F.nombre, { k: 'clase', n: 'Tipo', t: 'sel', ops: ACCESOS }, { k: 'ancho', n: 'Ancho del paso (m)', t: 'num', min: 0.4, max: 20, paso: 0.1, ph: q => (ACC[q.clase] || ACC.puerta).w }, { k: 'muro', n: 'Con un tramo de pared o cerco a cada lado', t: 'bool' },
      { k: 'lector', n: 'Lector', t: 'sel', ops: [['afuera', 'De un lado'], ['ambos', 'De los dos lados']] }, F.r, { k: 'notas', n: 'Notas', t: 'area' }],
    variantes: ACCESOS.map(([clase, n]) => ({ n, o: { clase } })),
    armar: armarAcceso },

  // muebles (18/11, para la oficina de Olumi y las oficinas de Ondi): el Furniture Kit de Kenney (CC0), el mismo archivo que usa la oficina de Olumi
  mueble: { n: 'Mueble', g: 'Muebles', forma: 'punto', capa: 'base', etiqueta: () => '', def: { modelo: 'desk' },
    campos: [{ k: 'modelo', n: 'Qué es', t: 'sel', ops: MUEBLES }, { k: 'y', n: 'Altura sobre el piso (m)', t: 'num', min: 0, max: 3, paso: 0.05 }, F.r],
    variantes: MUEBLES.map(([modelo, n, g]) => ({ n, g, o: { modelo } })),
    armar(p, ctx) { const g = new THREE.Group(); g.userData.sinAplanar = true; tonoMueble(); const b = (MUEB.data && MUEB.data[p.modelo] && MUEB.data[p.modelo].b) || [0.8, 0.8, 0.6];
      const caja0 = new THREE.Mesh(CAJA, mat('#c9ced2', { transparent: true, opacity: 0.35 })); caja0.scale.set(b[0], b[1], b[2]); caja0.position.y = b[1] / 2 + (p.y || 0); g.add(caja0);
      muebleGeo(p.modelo).then(geo => { if (!geo) return; g.remove(caja0); tonoMueble(); const m = new THREE.Mesh(geo, MUEB.mat); m.position.y = p.y || 0; m.castShadow = m.receiveShadow = true; m.userData.dueño = caja0.userData.dueño; /* el modelo llega después: hereda de quién es, para que se pueda tocar y elegir */ g.add(m); ctx && ctx.dirty && ctx.dirty(); }).catch(() => {});
      return g; } },
};
export const GRUPOS = ['Terreno', 'Construcción', 'Oficina', 'Cocina', 'Baño', 'Living y descanso', 'Muebles', 'Control de acceso', 'Logística', 'Vegetación', 'Equipos', 'Personas y vehículos'];

// árboles: tronco + copa, todos los de una pieza en dos o tres dibujos
function arbolado(g, lista) { const tr = [], co = [], pi = [], pa = [], ma = { corten: [], hormigon: [] }, R = azar(lista.length * 31 + 7), T = oscuro();
  const copa = (x, y, z, sx, sy, sz, cols) => co.push([x, y, z, R() * 6.3, sx, sy, sz, cols[(R() * cols.length) | 0]]);
  for (let [x, z, t, k = 1, mc] of lista) {
    // maceta redonda: el árbol queda plantado arriba de la tierra de la maceta (y los que no son olivo, más chicos)
    const y0 = mc && ma[mc] ? 0.56 : 0, n0 = [tr.length, co.length, pi.length, pa.length]; if (y0) { ma[mc].push([x, 0.28, z, 0, 1.4, 0.56, 1.4]); if (t !== 'olivo') k *= 0.6; }
    if (t === 'olivo') { // olivo chico de vereda: tronco corto que se abre en dos o tres ramas y copa rala gris verdosa
      const h = 1.5 * k, n = 2 + (R() * 2 | 0), a0 = R() * 6.3; tr.push([x, y0 + h / 2, z, 0, 0.22 * k, h, 0.22 * k]);
      for (let i = 0; i < n; i++) { const a = a0 + i * 6.283 / n, rr = 0.55 * k; tr.push([x + Math.cos(a) * rr * 0.5, y0 + h + 0.55 * k, z + Math.sin(a) * rr * 0.5, 0, 0.12 * k, 1.2 * k, 0.12 * k]);
        copa(x + Math.cos(a) * rr, y0 + h + 1.5 * k + R() * 0.3 * k, z + Math.sin(a) * rr, 1.9 * k, 1.35 * k, 1.9 * k, OLIVOS); }
      copa(x, y0 + h + 2.1 * k, z, 1.6 * k, 1.1 * k, 1.6 * k, OLIVOS); continue; }
    if (t === 'pino') { tr.push([x, 2 * k, z, 0, 0.5 * k, 4 * k, 0.5 * k]); const v = PINOS[(R() * PINOS.length) | 0], e = 0.85 + R() * 0.3; pi.push([x, 4.6 * k, z, R() * 6, 5.4 * k * e, 5.2 * k, 5.4 * k * e, v], [x, 7 * k, z, R() * 6, 4.4 * k * e, 5 * k, 4.4 * k * e, v], [x, 9.3 * k, z, R() * 6, 3.3 * k * e, 4.6 * k, 3.3 * k * e, v], [x, 11.4 * k, z, R() * 6, 2.1 * k * e, 3.8 * k, 2.1 * k * e, v]); }
    else if (t === 'palmera') { tr.push([x, 4.5 * k, z, 0, 0.5 * k, 9 * k, 0.5 * k]); pa.push([x, 9.2 * k, z, R() * 6, 4.6 * k, 1.1 * k, 4.6 * k]); }
    else if (t === 'arbusto') { const n = 2 + (R() * 2 | 0); for (let i = 0; i < n; i++) { const a = R() * 6.3, rr = i ? 0.55 * k : 0, s = (1.3 + R() * 0.7) * k * (i ? 0.75 : 1); copa(x + Math.cos(a) * rr, s * 0.36, z + Math.sin(a) * rr, s, s * 0.8, s, V_ARBU); } }
    else if (t === 'alamo') { const h = (11 + R() * 3) * k; tr.push([x, h * 0.2, z, 0, 0.5 * k, h * 0.4, 0.5 * k]); for (let i = 0; i < 6; i++) { const w = (i === 0 ? 1.7 : 2.25 - i * 0.26) * k; copa(x + (R() - 0.5) * 0.25 * k, h * (0.24 + i * 0.135), z + (R() - 0.5) * 0.25 * k, w, h * 0.27, w, V_ALAMO); } }
    else if (t === 'eucalipto') { const h = (13 + R() * 4) * k; tr.push([x, h * 0.34, z, 0, 0.6 * k, h * 0.68, 0.6 * k]); const n = 8 + (R() * 3 | 0); for (let i = 0; i < n; i++) { const a = R() * 6.3, f = i / n, rr = (0.5 + R() * 2.6) * k * (1 - f * 0.5), s = (3.6 + R() * 2.4) * k * (1 - f * 0.3); copa(x + Math.cos(a) * rr, h * (0.5 + f * 0.48), z + Math.sin(a) * rr, s, s * 0.9, s, V_EUCA); } }
    else { // fronda: una copa central, un anillo de bultos más bajos y un remate arriba; cada bulto de un verde distinto
      const h = (3 + R() * 0.8) * k, s0 = (4.3 + R() * 1.2) * k, n = 4 + (R() * 2 | 0), a0 = R() * 6.3; tr.push([x, h / 2, z, 0, 0.55 * k, h, 0.55 * k]); copa(x, h + s0 * 0.33, z, s0, s0 * 0.86, s0, VERDES);
      for (let i = 0; i < n; i++) { const a = a0 + i * 6.283 / n + (R() - 0.5) * 0.5, rr = s0 * (0.3 + R() * 0.12), s = s0 * (0.52 + R() * 0.2); copa(x + Math.cos(a) * rr, h + s0 * (0.12 + R() * 0.2), z + Math.sin(a) * rr, s, s * 0.85, s, VERDES); }
      copa(x + (R() - 0.5) * k, h + s0 * 0.68, z + (R() - 0.5) * k, s0 * 0.55, s0 * 0.5, s0 * 0.55, VERDES); }
    if (y0) for (const [L, i0] of [[tr, n0[0]], [co, n0[1]], [pi, n0[2]], [pa, n0[3]]]) for (let i = i0; i < L.length; i++) L[i][1] += y0; }
  if (ma.corten.length) lote(g, CIL24, mat(T ? '#4a3326' : '#7b4a2f', { roughness: 0.9, metalness: 0.15 }), ma.corten);
  if (ma.hormigon.length) lote(g, CIL24, mat(T ? '#64686b' : '#b9bbb6', { roughness: 0.95 }), ma.hormigon);
  lote(g, TRONCO, mat(T ? '#3b3026' : '#6b5440', { roughness: 1 }), tr); const fo = [lote(g, HOJAS, mat(T ? '#5d6b5a' : '#ffffff', { roughness: 1, vertexColors: true }), co), lote(g, CONO2, mat(T ? '#5d6b5a' : '#ffffff', { roughness: 1 }), pi),
  lote(g, CONO, mat(T ? '#22361f' : '#6f9a5c', { roughness: 1, flatShading: true }), pa.map(q => { q[5] *= -1; return q; }))]; for (const k of fo) if (k) k.userData.follaje = true; }   // las copas: se pasa por abajo de las que arrancan arriba de la cintura
// línea corrida hacia un costado (bordes de ruta)
// tendido con altura en cada punto [x, z, y]: el mazo es un tubo recto por tramo (las esquinas en ángulo, como se tiende de verdad).
// y = 0: va picado en el piso, se marca la canaleta tapada con mortero y el mazo apenas asomando para que se lea el recorrido.
// Los tramos verticales van por adentro de la pared de yeso o suben por la columna de la mesa.
function tendido3d(p) { const g = new THREE.Group(), utp = p.tipo === 'utp', r = utp ? 0.008 + 0.004 * Math.sqrt(p.hilos || 1) : 0.03, PISO = 0.075,
    enPiso = q => !(q.length > 2 && q[2] > 0), P = p.pts.map(q => new THREE.Vector3(q[0], enPiso(q) ? PISO + r : q[2], q[1])), L = [[], []], up = new THREE.Vector3(0, 1, 0);
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], d = b.clone().sub(a), l = d.length(), k2 = enPiso(p.pts[i - 1]) && enPiso(p.pts[i]) ? 1 : 0; if (l < 0.002) continue;
    const c = new THREE.CylinderGeometry(r, r, l, 7, 1, true); c.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, d.normalize()), new THREE.Vector3(1, 1, 1))); L[k2].push(c);
    if (i < P.length - 1) { const k = new THREE.SphereGeometry(r, 7, 5); k.translate(b.x, b.y, b.z); L[k2].push(k); } }
  /* lo que va por el piso se dibuja por encima de la canaleta y del plano; lo que va por adentro de la pared, sin empujar, para que la pared lo tape */
  L.forEach((l, k2) => { if (!l.length) return; const k = new THREE.Mesh(mergeGeometries(l.map(q => q.index ? q.toNonIndexed() : q)), mat(p.color || '#1f6fd6', { roughness: 0.55, ...(k2 ? { polygonOffset: true, polygonOffsetFactor: -15, polygonOffsetUnits: -10 } : {}) })); k.userData.noChoca = true; g.add(k); l.forEach(q => q.dispose()); });
  // las canaletas del piso: los tramos seguidos que van por el piso
  const tramos = []; let t = []; p.pts.forEach(q => { if (!(q.length > 2 && q[2] > 0)) t.push([q[0], q[1]]); else { if (t.length > 1) tramos.push(t); t = []; } }); if (t.length > 1) tramos.push(t);
  const mc = new THREE.MeshBasicMaterial({ color: oscuro() ? '#3b3f44' : '#a9a69d', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -13, polygonOffsetUnits: -8 });
  for (const q of tramos) { const k = new THREE.Mesh(cinta(q, Math.max(0.05, r * 4), PISO + 0.004), mc); k.renderOrder = 2; k.raycast = () => {}; g.add(k); }
  g.userData.sinAplanar = true; return g; }
// el contorno agrandado d metros para afuera (esquinas en inglete): para que una losa o un techo tapen el grosor de las paredes
function inflar(P, d) { const n = P.length, of = k => P.map((c, i) => { const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], l1 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, l2 = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
    const n1 = [-(c[1] - a[1]) / l1, (c[0] - a[0]) / l1], n2 = [-(b[1] - c[1]) / l2, (b[0] - c[0]) / l2], m = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(m[0], m[1]) || 1, cs = Math.max(0.35, (m[0] * n1[0] + m[1] * n1[1]) / ml);
    return [c[0] + k * d * m[0] / ml / cs, c[1] + k * d * m[1] / ml / cs]; });
  const A = of(1), B = of(-1); return Math.abs(areaSig(A)) > Math.abs(areaSig(B)) ? A : B; }
function offset(pts, d) { return pts.map((c, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [c[0] - (b[1] - a[1]) / l * d, c[1] + (b[0] - a[0]) / l * d]; }); }
// cinta parada a una altura (riel, cable)
function cintaVertical(pts, alto, y) { const v = [], ix = []; for (let i = 0; i < pts.length; i++) { v.push(pts[i][0], y - alto / 2, pts[i][1], pts[i][0], y + alto / 2, pts[i][1]); if (i) { const j = i * 2; ix.push(j - 2, j - 1, j, j - 1, j + 1, j); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(ix); geo.computeVertexNormals(); return geo; }
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

// ---------- edificio armado desde un plano: paredes de cada piso con puertas y ventanas, escalera en U, losas con su hueco ----------
// p.plano = { muros: [[piso, tipo, u0, v0, u1, v1, [[desde, hasta, 'p'|'v'|'pc'], ...]]], esc: { v0, meseta, llegada, uA: [a, b], uB: [a, b] } }
// u = a lo ancho del plano (0 a fondo), v = a lo largo (0 a ancho), en metros desde la esquina de arriba a la izquierda del plano.
// Tipos: e fachada (zócalo oscuro, franja clara en la losa, ventanas sueltas), c cortina de vidrio, i tabique, g tabique vidriado, m tabique móvil.
// Huecos: tramo a lo largo de la pared (en u si es horizontal en el plano, en v si es vertical; en una diagonal, de 0 a 1): p puerta, v ventana, pc puerta cerrada,
// pv puerta de entrada de vidrio de dos hojas con marco oscuro (la principal).
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
        seg(h0 - 0.04, h0 + 0.04, 0, dintel, mMarco, false, 0.03); seg(h1 - 0.04, h1 + 0.04, 0, dintel, mMarco, false, 0.03); if (q === 'pc') seg(h0 + 0.04, h1 - 0.04, 0, dintel, mPta);
        if (q === 'pv') { const br = mat(os ? '#2b2420' : '#3b2f28', { roughness: 0.45, metalness: 0.35 }), m = (h0 + h1) / 2; seg(h0 + 0.02, h1 - 0.02, 0.02, dintel - 0.03, M.mVid, false, 0.02);
          for (const [a, b] of [[h0, h0 + 0.09], [m - 0.05, m + 0.05], [h1 - 0.09, h1]]) seg(a, b, 0, dintel, br, false, 0.06); seg(h0, h1, dintel - 0.09, dintel, br, false, 0.06); seg(h0, h1, 0, 0.06, br, false, 0.06);
          for (const c of [m - 0.16, m + 0.12]) seg(c, c + 0.04, 0.95, 1.25, br, false, 0.1); } } }
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
  // luz: paneles en el cielorraso de cada piso (de noche encendidos, con su mancha de luz en el piso) y apliques afuera, sobre las dos fachadas largas
  try { for (let k = 0; k < N; k++) { const it = [], yy = k * hp + hp - 0.26; for (let x = -L / 2 + 1.5; x < L / 2 - 0.9; x += 3) for (let z = -W / 2 + 1.4; z < W / 2 - 0.9; z += 2.6) it.push([x, yy, z, 0, 1.2, 0.03, 0.3]);
      const lp = lote(g, CAJA, os ? neon('#ffe6bd') : mat('#fffdf5', { roughness: 0.3, emissive: '#ffe9c4', emissiveIntensity: 0.55 }), it, false); if (lp) sc(nv(k, lp)); if (os) for (const q of it) { const pz = pozo(g, q[0], q[2], 2.4, '#ffd9a0', 0.15); pz.position.y = k * hp + 0.1; sc(nv(k, pz)); } }
    const nA = Math.max(1, Math.round((L - 3) / 6)); for (const zz of [-W / 2 - 0.13, W / 2 + 0.13]) for (let i = 0; i <= nA; i++) { const x = -L / 2 + 1.5 + i * (L - 3) / nA, ya = Math.min(hp - 0.45, 3.1); caja(g, x - 0.16, ya, zz - 0.11, x + 0.16, ya + 0.09, zz + 0.11, mat('#2a2c31', { metalness: 0.6, roughness: 0.4 }), false); caja(g, x - 0.13, ya - 0.012, zz - 0.09, x + 0.13, ya, zz + 0.09, os ? neon('#ffe2b0') : mat('#f4f1e6', { roughness: 0.3 }), false); if (os) sc(pozo(g, x, zz + Math.sign(zz) * 1.3, 3.8, '#ffd9a0', 0.3)); } } catch (e) { console.warn('luz del edificio', e); }
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
function naveLog(p) { const PIS = [], SG = [], HUE = [], g = new THREE.Group(), os = oscuro(), K = os ? NAVE.oscuro : NAVE.claro, L = p.ancho, w = L / 2, d = p.fondo / 2, h = p.alto, e = 0.25, CH = { perfil: p.perfil || 'trapezoidal', terminacion: p.terminacion || 'prepintada' };
  const pa = chapaReal(os ? mix(p.color, '#000', 0.5) : p.color, CH), liso = mat(os ? mix(p.color, '#000', 0.5) : p.color, { roughness: 0.7 }), M = (k, o) => mat(K[k], o);
  const fr = (u0, u1, v0, v1, y0, y1, m, s = true) => caja(g, -w + u0, y0, d + v0, -w + u1, y1, d + v1, m, s);
  cajaT(g, -w, 0, -d, w, h, -d + e, pa, MCH); cajaT(g, -w, 0, -d, -w + e, h, d, pa, MCH); cajaT(g, w - e, 0, -d, w, h, d, pa, MCH); cajaT(g, -w, 0, d - e, w, h, d, pa, MCH);
  for (const [x0, z0, x1, z1] of [[-w, -d, w, -d + e], [-w, d - e, w, d], [-w, -d, -w + e, d], [w - e, -d, w, d]]) caja(g, x0 - 0.08, 0, z0 - 0.08, x1 + 0.08, 1.2, z1 + 0.08, M('zocalo'));
  const t = cajaT(g, -w + e, h - 0.15, -d + e, w - e, h, d - e, chapaReal(os ? mix(p.techo, '#000', 0.55) : p.techo, { perfil: CH.perfil, terminacion: 'galvanizada' }), MCH); t.userData.techo = true; sombraDeApoyo(g, w, d, { fuerza: os ? 0.22 : 0.4 });
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
  const placa = mat(p.placa || '#1F4D3A', { roughness: 0.6 }), bl = mat('#ffffff', os ? { emissive: '#ffffff', emissiveIntensity: 0.35 } : {}), am = mat('#F2C230'), ace = mat(os ? '#4a525a' : '#8a9299', { metalness: 0.65, roughness: 0.42 });
  const num = (n, uc, y0 = 5.95) => { const txt = String(n), W = 0.22, H = 0.36, T = 0.05, yb = y0 + 0.07; fr(uc - 0.24 - txt.length * 0.17, uc + 0.24 + txt.length * 0.17, 0.32, 0.37, y0, y0 + 0.5, placa, false);
    [...txt].forEach((c, i) => { const x = uc + (i - (txt.length - 1) / 2) * 0.34, q = (a, b, y, yy) => fr(x + a, x + b, 0.37, 0.385, yb + y, yb + yy, bl, false);
      for (const k of SIETE[c] || '') { if (k === 'a') q(-W / 2, W / 2, H - T, H); if (k === 'd') q(-W / 2, W / 2, 0, T); if (k === 'g') q(-W / 2, W / 2, H / 2 - T / 2, H / 2 + T / 2); if (k === 'b') q(W / 2 - T, W / 2, H / 2, H); if (k === 'c') q(W / 2 - T, W / 2, 0, H / 2); if (k === 'f') q(-W / 2, -W / 2 + T, H / 2, H); if (k === 'e') q(-W / 2, -W / 2 + T, 0, H / 2); } }); };
  const AN = andenesDe(p); g.userData.andenes = AN.filter(q => q[2] !== 'simple').map(([u, n]) => ({ x: -w + u, z: d, n }));
  for (const [u, n, k] of AN) { if (k === 'simple') { fr(u - 1.75, u + 1.75, 0, 0.3, 1.0, 4.85, M('marco')); fr(u - 1.5, u + 1.5, 0, 0.34, 1.2, 4.6, M('porton'), false); for (let y = 1.75; y < 4.5; y += 0.7) fr(u - 1.5, u + 1.5, 0, 0.36, y, y + 0.05, M('liston'), false); if (n != null && n !== '' && h > 6.8) num(n, u); continue; }
    fr(u - 1.9, u + 1.9, 0, 0.32, 0.9, 5.2, M('marco')); fr(u - 1.6, u + 1.6, 0, 0.4, 1.2, 4.9, M('porton'), false); for (let y = 1.7; y < 4.8; y += 0.7) fr(u - 1.6, u + 1.6, 0, 0.43, y, y + 0.06, M('liston'), false);
    fr(u - 1.05, u + 1.05, 0.4, 0.62, 1.1, 1.2, ace); fr(u - 1, u + 1, 0.62, 0.67, 0.8, 1.2, ace); fr(u - 1, u + 1, 0.67, 0.68, 1.08, 1.18, am, false); fr(u - 1, u + 1, 0.67, 0.68, 0.84, 0.9, am, false);
    fr(u - 0.35, u + 0.35, 0.43, 0.45, 2.55, 2.85, mat(os ? '#ffdcaa' : '#2c3640', { roughness: 0.2, metalness: 0.3 }), false); // mirilla
    if (p.abrigo) { const go = mat(os ? '#141618' : '#24272a', { roughness: 0.9 }); fr(u - 2.15, u + 2.15, 0.32, 0.95, 4.75, 5.9, go); fr(u - 2.15, u - 1.62, 0.32, 0.9, 1.15, 4.75, go); fr(u + 1.62, u + 2.15, 0.32, 0.9, 1.15, 4.75, go); }
    SG.push([-w + u - 1.5, d + 0.35, -w + u + 1.5, d + 0.35, 0.36, 0.8, 1.5]); if (p.abrigo) SG.push([-w + u - 1.85, d + 0.63, -w + u + 1.85, d + 0.63, 0.32, 1.15, 5.9]);
    if (h > 6.2 && !p.abrigo) fr(u - 2.1, u + 2.1, 0, 1.6, 5.4, 5.7, M('pretil')); fr(u - 1.5, u - 1.1, 0, 0.6, 0.9, 1.5, M('goma'), false); fr(u + 1.1, u + 1.5, 0, 0.6, 0.9, 1.5, M('goma'), false); if (n != null && n !== '' && h > 6.8) num(n, u); }
  // losa de hormigón frente a los andenes: donde paran y maniobran los camiones nunca hay pasto
  if (AN.length && +p.losa > 0) { const us = AN.map(q => q[0]), a = Math.max(0, Math.min(...us) - 4.5), b = Math.min(L, Math.max(...us) + 4.5), P = +p.losa;
    const k = area(g, [[-w + a, d + 0.02], [-w + b, d + 0.02], [-w + b, d + P], [-w + a, d + P]], 0.035, matSuelo(p.losaMat === 'adoquin' ? 'adoquin' : 'hormigon', { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -2 }) || mat(suelo('hormigon'), { roughness: 0.95 })); if (k) k.userData.noChoca = true; }
  // pintura del piso: una calle por andén (líneas amarillas de 16 m) y la franja rayada al pie de los portones
  if (AN.length) { const pin = mat(os ? '#b89a3a' : '#E5C35A', { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -8 }), us = AN.map(q => q[0]), it = [];
    us.forEach((u, i) => { it.push([-w + u - 2.5, 0.05, d + 8.2, 0, 0.16, 0.012, 15.6]); if (i === us.length - 1 || us[i + 1] - u > 6.5) it.push([-w + u + 2.5, 0.05, d + 8.2, 0, 0.16, 0.012, 15.6]); it.push([-w + u, 0.05, d + 0.9, 0, 3.4, 0.012, 0.16]); });
    const lp = lote(g, CAJA, pin, it, false); if (lp) lp.userData.noChoca = true; }
  // alero sobre los andenes (p.alero = metros desde la pared hasta la línea de columnas): chapa con caída hacia afuera, columnas entre andenes y viga. Los camiones quedan abajo.
  if (+p.alero > 0 && AN.length) { const A = +p.alero, us = AN.map(q => q[0]); let u0 = Math.max(p.anexo === 'izq' ? 12.6 : 0.3, Math.min(...us) - 4.2), u1 = Math.min(p.anexo === 'der' ? L - 12.6 : L - 0.3, Math.max(...us) + 4.2), prof = A + 1.9, yc = Math.min(h - 1.6, 6.05), cae = Math.min(0.9, prof * 0.06), alt = v => yc + cae / 2 - cae * v / prof;
    const RA = rampasDe(p, AN, L); for (const [ru, rl, rs] of RA) { if (rs > 0) u1 = Math.min(L - 0.3, Math.max(u1, ru + 2.2 + rl)); else u0 = Math.max(0.3, Math.min(u0, ru - 2.2 - rl)); }
    const tc = cajaT(g, -w + u0, yc - 0.07, d + 0.1, -w + u1, yc + 0.07, d + prof, chapaReal(os ? mix(p.techo, '#000', 0.55) : p.techo, { perfil: CH.perfil, terminacion: 'galvanizada' }), MCH); tc.rotation.x = Math.atan2(cae, prof); tc.userData.techo = true;
    const ac = mat(os ? '#4a545d' : '#8d979f', { metalness: 0.5, roughness: 0.5 }), cols = [u0 + 0.35]; for (let i = 0; i < us.length - 1; i++) { const m = (us[i] + us[i + 1]) / 2; if (m - cols[cols.length - 1] >= 8.5 && u1 - 0.35 - m >= 5) cols.push(m); } cols.push(u1 - 0.35);
    const hc = alt(A) - 0.09; for (const u of cols) { SG.push([-w + u, d + A, -w + u, d + A, 0.57, 0, hc]); fr(u - 0.17, u + 0.17, A - 0.17, A + 0.17, 0, hc - 0.34, ac); fr(u - 0.4, u + 0.4, A - 0.4, A + 0.4, 0, 0.5, am); fr(u - 0.09, u + 0.09, 0.2, A, alt(A / 2) - 0.36, alt(A / 2) - 0.12, ac, false).rotation.x = Math.atan2(cae, prof); }
    fr(u0, u1, A - 0.13, A + 0.13, hc - 0.34, hc, ac); fr(u0, u1, prof - 0.08, prof, alt(prof) - 0.2, alt(prof) + 0.12, M('pretil'), false);
    if (os) fr(u0 + 0.5, u1 - 0.5, A - 0.05, A + 0.05, hc - 0.4, hc - 0.34, neon('#ffe2b0'), false); }
  for (const [u, largo = 12, sen = 1] of rampasDe(p, AN, L)) { const hp = 1.2, an = 3.6, hor = mat(os ? '#4c5157' : '#c9cbc7', { roughness: 0.92, side: THREE.DoubleSide }), b0 = u + sen * 2.2, b1 = b0 + sen * largo;
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(largo, 0), new THREE.Vector2(0, hp)]), rg = new THREE.ExtrudeGeometry(sh, { depth: an, bevelEnabled: false }), rm = new THREE.Mesh(rg, hor);
    rm.scale.x = sen; rm.position.set(-w + b0, 0, d + 0.02); rm.castShadow = rm.receiveShadow = true; g.add(rm); fr(u - 2.2, u + 2.2, 0, an, 0, hp, hor); // descanso frente al portón
    fr(u - 1.8, u + 1.8, 0, 0.32, hp, hp + 3.8, M('marco')); fr(u - 1.6, u + 1.6, 0.32, 0.36, hp, hp + 3.6, mat('#16191C'), false);
    const ba = [], n = Math.max(2, Math.round(largo / 1.5)); for (let i = 0; i <= n; i++) { const t = i / n, uu = b0 + (b1 - b0) * t, y = hp * (1 - t); ba.push([-w + uu, y + 0.5, d + an - 0.08, 0, 0.05, 1, 0.05]); }
    lote(g, CIL, am, ba); const pa = new THREE.Mesh(CIL, am), dl = Math.hypot(largo, hp); pa.scale.set(0.05, dl, 0.05); pa.rotation.z = sen * Math.atan2(largo, hp); pa.position.set(-w + (b0 + b1) / 2, hp / 2 + 1, d + an - 0.08); g.add(pa);
    PIS.push({ x0: -w + u - 2.2, x1: -w + u + 2.2, z0: d, z1: d + an, y: hp }, { rampa: true, x0: -w + Math.min(b0, b1), x1: -w + Math.max(b0, b1), z0: d, z1: d + an, xa: -w + b0, xb: -w + b1, y0: hp, y1: 0 }); SG.push([-w + b0, d + an - 0.08, -w + b1, d + an - 0.08, 0.05, 0, hp + 1.5]); }
  for (const q of p.puertasEn || []) { const u = Array.isArray(q) ? q[0] : q, y0 = AN.length && !(Array.isArray(q) && q[1] === 'piso') ? 1.2 : 0; if (!y0) HUE.push([u - 0.62, u + 0.62]); fr(u - 0.62, u + 0.62, 0, 0.3, y0, y0 + 2.25, M('marco')); fr(u - 0.5, u + 0.5, 0.3, 0.34, y0, y0 + 2.12, M('porton'), false); fr(u + 0.3, u + 0.4, 0.33, 0.37, y0 + 1, y0 + 1.12, M('goma'), false);
    if (y0) { const ac = mat(os ? '#5b6168' : '#8d9399', { roughness: 0.5, metalness: 0.5 }); fr(u - 0.75, u + 0.75, 0, 1.1, y0 - 0.06, y0, ac); for (let i = 0; i < 4; i++) fr(u - 0.55, u + 0.55, 1.1 + i * 0.28, 1.38 + i * 0.28, y0 - 0.3 * (i + 1) - 0.04, y0 - 0.3 * (i + 1), ac);
      PIS.push({ x0: -w + u - 0.75, x1: -w + u + 0.75, z0: d, z1: d + 1.1, y: y0 }, { rampa: 'z', x0: -w + u - 0.55, x1: -w + u + 0.55, z0: d + 1.1, z1: d + 2.22, za: d + 1.1, zb: d + 2.22, y0, y1: 0 });
      for (const sx of [-0.62, 0.62]) { fr(u + sx - 0.025, u + sx + 0.025, 1.05, 1.1, y0, y0 + 1.0, am); fr(u + sx - 0.025, u + sx + 0.025, 2.2, 2.25, 0, 1.0, am); } } }
  for (const [u, n] of nivelesDe(p, AN, L)) { HUE.push([u - 2.05, u + 2.05]); fr(u - 2.3, u + 2.3, 0, 0.3, 0, 4.9, M('marco')); fr(u - 2.05, u + 2.05, 0.3, 0.34, 0, 4.65, mat('#16191C'), false); if (n != null) num(n, u); for (const s of [-1, 1]) fr(u + s * 2.75 - 0.16, u + s * 2.75 + 0.16, 0.5, 0.82, 0, 1.15, am); }
  for (const c of p.cajas || []) { if (c[7] != null) num(c[7], (c[0] + c[1]) / 2, c[4]); else fr(c[0], c[1], c[2], c[3], c[4], c[5], mat(os && c[6] && /^#[EF]/i.test(c[6]) ? mix(c[6], '#000', 0.5) : c[6] || p.color, { roughness: 0.7 })); }
  if (os) { const nm = neon(acento()); for (const [x0, z0, x1, z1] of [[-w, -d - 0.05, w, -d], [-w - 0.05, -d, -w, d], [w, -d, w + 0.05, d]]) caja(g, x0, h - 0.5, z0, x1, h - 0.38, z1, nm, false); AN.forEach(([u]) => { brillo(g, -w + u, 6.4, d + 0.6, 3.2, '#ffe2b0', 0.7); pozo(g, -w + u, d + 6.5, 8, '#ffcf8a', 0.24); }); // cada andén con su luz y su charco de luz en el piso
    if (ax) pozo(g, -w + (ax[0] + ax[1]) / 2, d + 6, 9, '#ffe9c4', 0.2); }
  if (+p.colInt > 0) { const sp = Math.max(6, +p.colInt), it = [], nu = Math.max(1, Math.round(L / sp)), nv = Math.max(1, Math.round(p.fondo / sp)), cm = mat(os ? '#4c5560' : '#c9ced3', { roughness: 0.6, metalness: 0.2 });
    for (let i = 1; i < nu; i++) for (let j = 1; j < nv; j++) { it.push([-w + i * L / nu, (h - 0.6) / 2, -d + j * p.fondo / nv, 0, 0.45, h - 0.6, 0.45]); SG.push([-w + i * L / nu, -d + j * p.fondo / nv, -w + i * L / nu, -d + j * p.fondo / nv, 0.5, 0, h]); }
    lote(g, CAJA, cm, it); const pie = mat(os ? '#7a6a22' : '#F2C230', { roughness: 0.6 }); lote(g, CAJA, pie, it.map(q => [q[0], 0.5, q[2], 0, 0.7, 1, 0.7]), false); }
  // lo que no se atraviesa a pie: las cuatro paredes, la oficina y los volúmenes propios
  // puerta de personal en el frente, en la punta contraria a la oficina: por ahí se entra a pie
  const pu = p.puerta !== 'no', uP = (p.anexo === 'izq') !== (p.puerta === 'otra') ? L - 2.2 : 2.2; if (pu) { fr(uP - 0.62, uP + 0.62, 0, 0.3, 0, 2.25, M('marco')); fr(uP - 0.5, uP + 0.5, 0.3, 0.33, 0.05, 2.15, mat(os ? '#8fa0ad' : '#dfe4e8', { roughness: 0.5 }), false); fr(uP + 0.32, uP + 0.4, 0.33, 0.37, 1.0, 1.12, M('goma'), false); }
  // el frente es macizo salvo por donde se entra a pie: la puerta de personal, las puertas a nivel del piso y los portones a nivel (abiertos)
  if (pu) HUE.push([uP - 0.62, uP + 0.62]); HUE.sort((a, b) => a[0] - b[0]); const ep = e / 2 + 0.08, ef = ep + 0.15, zf = d - e / 2 + 0.15, sg = [[-w, -d + e / 2, w, -d + e / 2, ep, 0, h], [-w + e / 2, -d, -w + e / 2, d, ep, 0, h], [w - e / 2, -d, w - e / 2, d, ep, 0, h]];   // el frente, más grueso hacia afuera: marcos y portones sobresalen 30 cm
  { let a = 0; for (const [h0, h1] of HUE) { if (h0 - ef > a) sg.push([-w + a, zf, -w + h0 - ef, zf, ef, 0, h]); a = Math.max(a, h1 + ef); } if (a < L) sg.push([-w + a, zf, w, zf, ef, 0, h]); }
  g.userData.pasos = HUE.map(([h0, h1]) => [-w + h0, d - 0.5, -w + h1, d + 0.6]);   // por acá se pasa aunque se vea la puerta (para la revisión de físicas)
  // por dentro: piso, estanterías con mercadería y luces colgantes. Se ve apagando «Techos» en Capas (en el celular no se arma, para no pesar)
  if (p.interior !== false && L > 24 && p.fondo > 26 && !matchMedia('(pointer:coarse)').matches) { let sm = 11; for (const c of String(p.id || 'n')) sm = (sm * 31 + c.charCodeAt(0)) % 2147483647; const az = () => { sm = (sm * 16807 + 11) % 2147483647; return (sm & 0xffff) / 0xffff; };
    const gr = L * p.fondo > 30000, paso = gr ? 8.4 : 5.8, bahia = gr ? 3.6 : 2.7, niv = Math.max(2, Math.min(5, Math.floor((h - 2.4) / 1.9))), hR = niv * 1.9 + 0.3, z0 = -d + 2.4, z1 = d - 15, it = [], CAR = os ? ['#6b5433', '#7a6a4c', '#4d3d26', '#77736a', '#3f5565', '#5e645c'] : ['#b98a4e', '#c9a46a', '#8a6a3c', '#d8d2c4', '#6f8fa8', '#a8b0a4'], azul = os ? '#274a6e' : '#2f5f9e', nar = os ? '#8a4a1c' : '#e07b2a';
    for (let x = -w + 4; x < w - 4; x += paso) { for (let z = z0; z < z1 - bahia; z += bahia) { it.push([x - 1.15, hR / 2, z, 0, 0.1, hR, 0.1, azul], [x + 1.15, hR / 2, z, 0, 0.1, hR, 0.1, azul]);
        for (let n = 0; n < niv; n++) { const y = n * 1.9; if (n) it.push([x, y + 0.02, z + bahia / 2, 0, 2.4, 0.1, bahia, nar]); if (az() < 0.8) { const hc = 0.8 + az() * 0.85; it.push([x, y + 0.12 + hc / 2, z + bahia / 2, 0, 2.1, hc, bahia - 0.35, CAR[Math.floor(az() * CAR.length)]]); } } }
      sg.push([x, z0, x, z1, 1.25, 0, hR, 0, 'int']); }
    const li = lote(g, CAJA, mat('#ffffff', { roughness: 0.8 }), it, false); if (li) { li.userData.interior = true; li.visible = false; g.userData.interiorMalla = li; }
    const ps = caja(g, -w + e, 0, -d + e, w - e, 0.07, d - e, mat(os ? '#5b646c' : '#c9cdd0', { roughness: 0.32, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), false); ps.userData.interior = true; ps.visible = false;
    const lz = []; for (let x = -w + 6; x < w - 5; x += 12) for (let z = -d + 6; z < d - 5; z += 12) lz.push([x, h - 0.9, z, 0, 1.4, 0.12, 0.5]); const ll = lote(g, CAJA, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1cc', emissiveIntensity: os ? 2.6 : 0.5 }), lz, false); if (ll) { ll.userData.interior = true; ll.visible = false; } }
  // extractores en el techo
  { const ex = []; for (let x = -w + 9; x < w - 8; x += 16) ex.push([x, h + 0.42, d * 0.35, 0, 0.9, 0.7, 0.9], [x + 8, h + 0.42, -d * 0.35, 0, 0.9, 0.7, 0.9]); const le = lote(g, CIL, mat(os ? '#6a7682' : '#b9c0c6', { metalness: 0.6, roughness: 0.4 }), ex); if (le) le.userData.techo = true; }
  const CJ = []; if (ax) CJ.push([-w + ax[0], d - 9, -w + ax[1], d + 2.6, 0, 8.6]);   // la oficina, maciza (cajas en metros de la pieza: x0, z0, x1, z1, y0, y1)
  for (const c of p.cajas || []) if (c[7] == null && c[4] < 1.6 && c[5] > 0.5) CJ.push([-w + Math.min(c[0], c[1]), d + Math.min(c[2], c[3]), -w + Math.max(c[0], c[1]), d + Math.max(c[2], c[3]), c[4], c[5]]);
  g.userData.segs = sg.concat(SG); g.userData.pisables = PIS; g.userData.cajasL = CJ; return g; }

// ---------- juntar en un solo dibujo las partes de una pieza que comparten material (menos llamadas a la placa de video) ----------
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4();
function aplanar(g) { g.updateMatrixWorld(true); _inv.copy(g.matrixWorld).invert(); const grupos = new Map();
  g.traverse(k => { if (!k.isMesh || k.isInstancedMesh || k.isSkinnedMesh || Array.isArray(k.material) || k.renderOrder || k.userData.techo || k.userData.campo) return;
    const sig = k.material.uuid + '|' + Object.keys(k.geometry.attributes).sort().join(',') + '|' + k.castShadow + k.receiveShadow; (grupos.get(sig) || grupos.set(sig, []).get(sig)).push(k); });
  for (const lista of grupos.values()) { if (lista.length < 2) continue; const geos = lista.map(k => { const q = k.geometry.index ? k.geometry.toNonIndexed() : k.geometry.clone(); q.applyMatrix4(_mm.multiplyMatrices(_inv, k.matrixWorld)); return q; });
    const geo = mergeGeometries(geos); geos.forEach(q => q.dispose()); if (!geo) continue; const m = new THREE.Mesh(geo, lista[0].material); m.castShadow = lista[0].castShadow; m.receiveShadow = lista[0].receiveShadow;
    // las partes que se juntan siguen siendo cosas sueltas para caminar (si no, la caja de la malla junta cubre todo lo de en medio)
    m.userData.partes = lista.filter(k => !k.userData.noChoca).map(k => { if (!k.geometry.boundingBox) k.geometry.computeBoundingBox(); return { bb: k.geometry.boundingBox.clone(), mm: new THREE.Matrix4().multiplyMatrices(_inv, k.matrixWorld), tipo: k.geometry.type }; });
    if (!m.userData.partes.length) m.userData.noChoca = true; if (lista.every(k => k.userData.interior)) m.userData.interior = true;
    for (const k of lista) k.parent.remove(k); g.add(m); } }

// ---------- armar una pieza completa en su lugar ----------
export function armarPieza(p, ctx = {}) { const T = TIPOS[p.t]; if (!T) return null; const q = { ...T.def, ...p };
  const g = T.armar(q, ctx) || new THREE.Group(); if (!g.userData.sinAplanar) aplanar(g); if (T.forma === 'punto') { const E = q.t !== 'playa' && q.t !== 'relieve' && entorno(ctx); g.position.set(q.x || 0, E && E.playas.length ? E.cota(q.x || 0, q.z || 0) : 0, q.z || 0); g.rotation.y = q.t === 'relieve' ? 0 : q.r || 0; if (q.t === 'relieve') entorno(ctx); } else if (q.t === 'loma' || q.t === 'playa') entorno(ctx);   // el terreno que sube también se pisa, aunque no haya otra pieza que lo calcule
  const nv = nivelDe(q); if (nv) g.position.y += nv * ALTO_PLANTA;   // los equipos guardan su altura desde el piso de su planta
  g.userData.pieza = p; g.userData.tipo = T; g.traverse(o => { o.userData.dueño = g; }); return g; }
// centro de una pieza (para etiquetas, enfocar y calcular el "lugar")
export function centro(p) { if (p.pts && p.pts.length) { if (TIPOS[p.t] && TIPOS[p.t].forma === 'area') { const n = p.pts.length; return [p.pts.reduce((a, q) => a + q[0], 0) / n, p.pts.reduce((a, q) => a + q[1], 0) / n]; } const m = p.pts[Math.floor(p.pts.length / 2)]; return [m[0], m[1]]; } return [p.x || 0, p.z || 0]; }
// rampas de un galpón con andenes: [u del portón, largo, sentido]. El campo «rampa» la pone pegada al último (o primer) andén y que no se pase de la pared
// portones a nivel del piso (sin andén): los puestos a mano en nivelEn y el del campo «nivel», pasando el último (o antes del primer) andén y su rampa
export function nivelesDe(p, AN, L) { const R = (p.nivelEn || []).slice(); if (p.nivel && AN.length) { const us = AN.map(q => q[0]), ra = rampasDe(p, AN, L);
    const lejos = sg => ra.filter(r => r[2] === sg).reduce((m, r) => Math.max(m, 2.2 + r[1] + 1.5), 0);
    if (p.nivel === 'der' || p.nivel === 'ambas') { const u = Math.min(L - 3, Math.max(...us) + 5.5 + lejos(1)); R.push([u, null]); }
    if (p.nivel === 'izq' || p.nivel === 'ambas') { const u = Math.max(3, Math.min(...us) - 5.5 - lejos(-1)); R.push([u, null]); } }
  return R; }
export function rampasDe(p, AN, L) { const R = (p.rampaEn || []).slice(); if (p.rampa && AN.length) { const us = AN.map(q => q[0]), lg = +p.rampaLargo || 10;
    if (p.rampa === 'der' || p.rampa === 'ambas') { const u = Math.max(...us) + 5; R.push([u, Math.max(3, Math.min(lg, L - u - 2.4)), 1]); }
    if (p.rampa === 'izq' || p.rampa === 'ambas') { const u = Math.min(...us) - 5; R.push([u, Math.max(3, Math.min(lg, u - 2.4)), -1]); } }
  return R; }
export function altoDe(p) { const q = { ...(TIPOS[p.t] || {}).def, ...p }; return { galpon: q.alto, modulo: (q.pisos || 1) * 3.1, edificio: (q.pisos || 1) * (q.altoPiso || 3.6) + 0.8, columna: q.alto, fila: (q.alto || 1) * 2.59, alero: q.alto, maquina: 6, tanque: q.alto, cartel: (q.altura || 0) + (q.alto || 0), recinto: 0.2, pared: q.alto - 1.4, rack: (q.clase === 'pared' ? (q.base ?? 1.5) : 0) + (q.alto || 2), gabinete: (q.base ?? 1) + (q.alto || 0.8), plano: 0.1, acceso: (ACC[q.clase] || ACC.puerta).h + 0.5 }[p.t] ?? (q.y != null ? q.y + 0.4 : 2); }
export { largoDe };

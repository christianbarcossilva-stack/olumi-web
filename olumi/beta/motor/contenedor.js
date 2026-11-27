// Motor común (beta) · el contenedor de verdad, para las filas de un depósito (24/11/2026).
// Lo que tiene uno real y se ve de cerca: chapa trapezoidal con relieve, esquineros con sus encastres (corner castings),
// largueros arriba y abajo, las dos puertas con sus cuatro barras de cierre y manijas, óxido y polvo.
// Todo en geometría instanciada: un depósito de 3.000 contenedores sigue siendo un puñado de dibujos.
import { THREE } from './nucleo.js?v=5214cd8e';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export const H_CONT = 2.59, W_CONT = 2.44;
export const largoCont = pies => +pies === 20 ? 6.06 : 12.19;

// ---------- colores de las navieras y de las empresas que alquilan contenedores ----------
// Aproximados a cómo se ven en un patio (el color de fábrica gastado por el sol). Solo el color: ni nombres ni logos en la maqueta.
export const NAVIERAS = [
  ['Maersk', '#4a9fcc'], ['Hapag-Lloyd', '#e0631b'], ['MSC', '#d3ad55'], ['CMA CGM', '#22468f'], ['Evergreen', '#2c7944'], ['ONE', '#c02d70'],
  ['COSCO', '#2d5bb0'], ['Hamburg Süd', '#bd3a2c'], ['Triton', '#6c777d'], ['Textainer', '#c9bc9b'], ['Seaco', '#3d6ea3'], ['CAI', '#d9dbd7'],
  ['Yang Ming', '#85603a'], ['ZIM', '#2d3977'], ['Beacon', '#b04a34'], ['Florens', '#26808d'], ['Sea Lease', '#86976f'], ['Óxido', '#8f5638']];
const _a = new THREE.Color(), _b = new THREE.Color(), HA = {}, HB = {};
// el color real más parecido a uno medido (por ejemplo, sacado del satélite, que aclara y apaga todo)
export function navieraDe(hex) { _a.set(hex).getHSL(HA); let mejor = NAVIERAS[0], dm = 1e9;
  for (const n of NAVIERAS) { _b.set(n[1]).getHSL(HB); let dh = Math.abs(HA.h - HB.h); dh = Math.min(dh, 1 - dh);
    const s = Math.min(HA.s, HB.s), d = dh * 4 * s + Math.abs(HA.l - HB.l) * 1.1 + Math.abs(HA.s - HB.s) * 0.7; if (d < dm) { dm = d; mejor = n; } }
  return mejor; }
// mezcla de otras navieras en una fila: pesos parecidos a un depósito de vacíos de la región
const PESOS = [9, 7, 8, 6, 4, 3, 4, 4, 8, 7, 4, 4, 2, 2, 3, 2, 2, 3];
export function navieraAlAzar(R) { const t = PESOS.reduce((a, b) => a + b, 0); let k = R() * t; for (let i = 0; i < NAVIERAS.length; i++) { k -= PESOS[i]; if (k <= 0) return NAVIERAS[i][1]; } return NAVIERAS[0][1]; }

// ---------- texturas (dibujadas acá: no salen de ningún archivo) ----------
const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const azar = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const TEX = new Map();
function tex(c, rep) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
function texGris(c) { const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t; }
// perfil trapezoidal: cresta plana, flancos inclinados, valle plano (como la chapa de un contenedor ISO)
function perfil(u) { u = u - Math.floor(u); if (u < 0.30) return 1; if (u < 0.40) return 1 - (u - 0.30) / 0.10; if (u < 0.80) return 0; if (u < 0.90) return (u - 0.80) / 0.10; return 1; }
// lado: color (polvo, óxido, raspones; el resto blanco para que lo tiña el color de cada contenedor) y relieve aparte (solo la chapa)
function lado(ondas, cual) { const k = 'lado' + ondas + cual; if (TEX.has(k)) return TEX.get(k); const W = 2048, H = 256, R = azar(ondas * 131 + 7);
  const [cr, xr] = lienzo(W, H), img = xr.createImageData(W, H);
  for (let i = 0; i < W; i++) { const v = perfil(i / W * ondas), sh = 150 + v * 105; for (let j = 0; j < H; j++) { const o = (j * W + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = sh; img.data[o + 3] = 255; } }
  xr.putImageData(img, 0, 0); xr.fillStyle = '#ffffff'; xr.fillRect(0, 0, W, 10); xr.fillRect(0, H - 12, W, 12);   // larguero de arriba y de abajo: lisos
  const [cc, x] = lienzo(W, H); x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  // los flancos que miran para abajo quedan un poco más oscuros (sombra propia de la onda)
  for (let i = 0; i < W; i++) { const u = (i / W * ondas) % 1, a = u >= 0.80 && u < 0.90 ? 0.30 : u >= 0.30 && u < 0.40 ? 0.12 : u >= 0.40 && u < 0.80 ? 0.07 : 0; if (a) { x.fillStyle = `rgba(0,0,0,${a})`; x.fillRect(i, 10, 1, H - 22); } }
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 10, W, 3); x.fillRect(0, H - 15, W, 3);   // sombra bajo el larguero de arriba y sobre el de abajo
  // polvo pegado abajo y en los valles
  let g = x.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, 'rgba(120,104,84,0)'); g.addColorStop(1, 'rgba(120,104,84,.45)'); x.fillStyle = g; x.fillRect(0, H * 0.55, W, H * 0.45);
  // chorreaduras de óxido desde el larguero de arriba y desde algunas abolladuras
  for (let n = 0; n < (cual === 'gastado' ? 70 : 30); n++) { const sx = R() * W, l = 20 + R() * (cual === 'gastado' ? 200 : 110), a = 0.14 + R() * (cual === 'gastado' ? 0.35 : 0.22);
    g = x.createLinearGradient(0, 10, 0, 10 + l); g.addColorStop(0, `rgba(120,60,28,${a})`); g.addColorStop(1, 'rgba(120,60,28,0)'); x.fillStyle = g; x.fillRect(sx, 10, 1.5 + R() * 5, l); }
  // óxido en el larguero de abajo y en los cantos
  for (let n = 0; n < 60; n++) { x.fillStyle = `rgba(110,58,30,${0.15 + R() * 0.35})`; x.fillRect(R() * W, H - 14 - R() * 8, 4 + R() * 28, 3 + R() * 8); }
  // raspones (se ve el gris de abajo) y parches de pintura de otro tono (reparaciones)
  for (let n = 0; n < 22; n++) { x.fillStyle = `rgba(90,90,90,${0.15 + R() * 0.25})`; x.fillRect(R() * W, 20 + R() * (H - 50), 10 + R() * 60, 1 + R() * 2); }
  const t = { map: tex(cc), bump: texGris(cr) }; TEX.set(k, t); return t; }
// las puertas: dos hojas con chapa vertical de paneles, burletes y bisagras (las barras van en geometría)
function puertas(reefer) { const k = 'puertas' + !!reefer; if (TEX.has(k)) return TEX.get(k); const W = 512, H = 512, R = azar(reefer ? 9 : 5);
  const [cr, xr] = lienzo(W, H); xr.fillStyle = '#b0b0b0'; xr.fillRect(0, 0, W, H); const [cc, x] = lienzo(W, H); x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  if (reefer) { // equipo de frío: rejilla, ventilador y tablero
    xr.fillStyle = '#7a7a7a'; xr.fillRect(30, 30, W - 60, H - 60); x.fillStyle = '#8f9498'; x.fillRect(30, 30, W - 60, H - 60);
    x.fillStyle = '#2c3034'; for (let i = 0; i < 26; i++) x.fillRect(60, 60 + i * 13, W - 230, 6);
    x.fillStyle = '#41464b'; x.beginPath(); x.arc(W - 105, 130, 52, 0, 7); x.fill(); x.strokeStyle = '#25292c'; x.lineWidth = 4; for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(W - 105, 130); x.lineTo(W - 105 + 50 * Math.cos(a), 130 + 50 * Math.sin(a)); x.stroke(); }
    x.fillStyle = '#e9ecee'; x.fillRect(W - 150, 230, 90, 130); x.fillStyle = '#3c4146'; x.fillRect(W - 140, 245, 70, 40); }
  else { for (let h = 0; h < 2; h++) { const x0 = 26 + h * (W - 52) / 2, ancho = (W - 52) / 2 - 6;
      for (let p = 0; p < 5; p++) { const y0 = 26 + p * (H - 52) / 5; xr.fillStyle = '#c8c8c8'; xr.fillRect(x0 + 4, y0 + 6, ancho - 8, (H - 52) / 5 - 12); xr.fillStyle = '#9a9a9a'; xr.fillRect(x0 + 4, y0 + (H - 52) / 5 - 8, ancho - 8, 3); } }
    x.fillStyle = 'rgba(25,25,25,.75)'; x.fillRect(W / 2 - 3, 24, 6, H - 48);   // la junta entre las dos hojas
    x.fillStyle = 'rgba(40,40,40,.5)'; for (const y of [70, 200, 330, 450]) { x.fillRect(22, y, 18, 26); x.fillRect(W - 40, y, 18, 26); }   // bisagras
    for (let n = 0; n < 18; n++) { const sx = 30 + R() * (W - 60), l = 20 + R() * 120, g = x.createLinearGradient(0, 26, 0, 26 + l); g.addColorStop(0, `rgba(120,60,28,${0.15 + R() * 0.25})`); g.addColorStop(1, 'rgba(120,60,28,0)'); x.fillStyle = g; x.fillRect(sx, 26, 2 + R() * 4, l); } }
  x.fillStyle = 'rgba(30,30,30,.55)'; x.fillRect(0, 0, W, 22); x.fillRect(0, H - 26, W, 26); x.fillRect(0, 0, 22, H); x.fillRect(W - 22, 0, 22, H);   // el marco del frente
  const g = x.createLinearGradient(0, H * 0.7, 0, H); g.addColorStop(0, 'rgba(120,104,84,0)'); g.addColorStop(1, 'rgba(120,104,84,.35)'); x.fillStyle = g; x.fillRect(0, H * 0.7, W, H * 0.3);
  const t = { map: tex(cc), bump: texGris(cr) }; TEX.set(k, t); return t; }

// materiales del cuerpo: caras de la caja en el orden de three (+x puertas, −x frente ciego, +y techo, −y piso, +z y −z lados)
const MATS = new Map();
export function matsCuerpo(pies, reefer, noche) { const k = pies + '|' + reefer + '|' + noche; if (MATS.has(k)) return MATS.get(k);
  const ondas = +pies === 20 ? 26 : 54, L = lado(ondas, 'comun'), Lg = lado(ondas, 'gastado'), F = puertas(reefer), T = lado(Math.round(ondas / 2), 'techo'), C = lado(Math.round(ondas / 9) * 2 + 4, 'comun');
  const base = noche ? '#a6b1bd' : '#ffffff', M = (t, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ map: t.map, bumpMap: t.bump, bumpScale: 3.2, color: base, roughness: 0.55, metalness: 0.28 }, o));
  const ms = [M(F, { bumpScale: 2 }), M(C), M(T, { roughness: 0.8, bumpScale: 1.5 }), new THREE.MeshStandardMaterial({ color: '#2a2c2e', roughness: 1 }), M(L), M(Lg)];
  MATS.set(k, ms); return ms; }

// ---------- el esqueleto: esquineros, encastres, largueros, travesaños y las barras de las puertas ----------
// Se dibuja aparte del cuerpo, en un tono más oscuro del mismo color, sin escalar (medidas de verdad).
const MARCOS = new Map();
export function marco(pies) { const k = +pies; if (MARCOS.has(k)) return MARCOS.get(k); const L = largoCont(pies), H = H_CONT, W = W_CONT, P = [];
  const bx = (x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); P.push(g); };
  const hx = L / 2, hz = W / 2, e = 0.17;   // esquinero de 17 cm
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bx(sx * hx - sx * e, sx * hx + sx * 0.012, 0, H, sz * hz - sz * e, sz * hz + sz * 0.012);                            // poste de esquina
    for (const y of [0, H - 0.12]) bx(sx * hx - sx * 0.18, sx * hx + sx * 0.02, y, y + 0.12, sz * hz - sz * 0.18, sz * hz + sz * 0.02); }   // encastres arriba y abajo
  for (const sz of [-1, 1]) { bx(-hx, hx, 0, 0.16, sz * hz - sz * 0.06, sz * hz + sz * 0.012); bx(-hx, hx, H - 0.1, H, sz * hz - sz * 0.06, sz * hz + sz * 0.012); }   // largueros de los lados
  for (const sx of [-1, 1]) { bx(sx * hx - sx * 0.06, sx * hx + sx * 0.012, H - 0.22, H, -hz, hz); bx(sx * hx - sx * 0.06, sx * hx + sx * 0.012, 0, 0.26, -hz, hz); }   // cabezales de los frentes
  // puertas (+x): cuatro barras verticales con sus guías y manijas
  const X = hx + 0.035; for (const z of [-0.93, -0.36, 0.36, 0.93]) { const c = new THREE.CylinderGeometry(0.022, 0.022, H - 0.36, 6, 1, true); c.translate(X, H / 2, z); P.push(c);
    bx(X - 0.01, X + 0.06, 1.0, 1.08, z - 0.03, z + 0.22 * (z < 0 ? 1 : -1)); }                    // manija
  for (const q of P) { q.deleteAttribute('uv'); }   // todo indexado y sin uv: unas 600 esquinas por contenedor
  const g = mergeGeometries(P); MARCOS.set(k, g); return g; }

// ---------- contenedor tanque (ISO tank de 20 pies): cilindro en un marco abierto con diagonales y pasarela arriba ----------
let TANQUE = null;
export function tanque() { if (TANQUE) return TANQUE; const L = 6.06, H = H_CONT, W = W_CONT, hx = L / 2, hz = W / 2, M = [], C = [];
  const bx = (A, x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); A.push(g.toNonIndexed()); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(M, sx * hx - sx * 0.17, sx * hx, 0, H, sz * hz - sz * 0.17, sz * hz);
  for (const sz of [-1, 1]) for (const y of [0, H - 0.14]) bx(M, -hx, hx, y, y + 0.14, sz * hz - sz * 0.12, sz * hz);
  for (const sx of [-1, 1]) for (const y of [0, H - 0.14]) bx(M, sx * hx - sx * 0.12, sx * hx, y, y + 0.14, -hz, hz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const d = new THREE.BoxGeometry(0.09, Math.hypot(1.6, H - 0.3), 0.09); d.rotateZ(sx * Math.atan2(1.6, H - 0.3)); d.translate(sx * (hx - 0.95), H / 2, sz * (hz - 0.05)); M.push(d.toNonIndexed()); }   // diagonales
  bx(M, -1.2, 1.2, H - 0.06, H - 0.02, -0.3, 0.3);   // pasarela de arriba
  const cil = new THREE.CylinderGeometry(1.08, 1.08, L - 1.0, 28, 1, true); cil.rotateZ(Math.PI / 2); cil.translate(0, H / 2 + 0.04, 0); C.push(cil.toNonIndexed());
  for (const sx of [-1, 1]) { const t = new THREE.SphereGeometry(1.08, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2); t.scale(1, 0.3, 1); t.rotateZ(-sx * Math.PI / 2); t.translate(sx * (hx - 0.5), H / 2 + 0.04, 0); C.push(t.toNonIndexed()); }
  const tapa = new THREE.CylinderGeometry(0.25, 0.25, 0.12, 14); tapa.translate(0, H / 2 + 1.12, 0); C.push(tapa.toNonIndexed());   // boca de carga
  TANQUE = { marco: mergeGeometries(M), cuerpo: mergeGeometries(C) }; TANQUE.marco.computeVertexNormals(); TANQUE.cuerpo.computeVertexNormals(); return TANQUE; }

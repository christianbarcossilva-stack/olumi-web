// Ondi · el rack de la tapa. Gabinete de pared de 9U cerrado (laterales con rejillas, techo con ventilador, puerta de vidrio abierta),
// armado en milímetros reales y con los frentes de cada equipo dibujados a mano en un lienzo. Sin modelos ni fotos de terceros.
// montar(cv, ctx) → { listo }. ctx: { ev() → {boca, est}, reducir, globo }
import * as THREE from '/olumi/beta/lib/three.module.min.js';
import { RoomEnvironment } from '/olumi/beta/lib/RoomEnvironment.js';
import { RoundedBoxGeometry } from '/olumi/beta/lib/RoundedBoxGeometry.js';

const UM = 44.45, NU = 9, PL = 482.6, ANCHO = 600, ALTO = 500, PROF = 450, TOP = 450, BOT = TOP - NU * UM; // mm
const yU = (u, n = 1) => TOP - (u - 1) * UM - n * UM / 2;
const PX = 2.4; // píxeles por mm en los frentes

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.round(w * PX); c.height = Math.round(h * PX); const x = c.getContext('2d'); x.scale(PX, PX); return [c, x]; }
function textura(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function azar(s) { let v = s * 9301 + 49297; return () => (v = (v * 16807) % 2147483647) / 2147483647; }
const LETRA = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';

// fondo de chapa: pintura texturada o aluminio cepillado
function chapa(x, w, h, base, cepillado, semilla = 1) { const R = azar(semilla); x.fillStyle = base; x.fillRect(0, 0, w, h);
  if (cepillado) { for (let i = 0; i < h * 3; i++) { x.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${.025 + R() * .05})`; x.fillRect(0, i / 3, w, .25 + R() * .4); } }
  else { for (let i = 0; i < w * h * .06; i++) { x.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${.03 + R() * .05})`; x.fillRect(R() * w, R() * h, .5, .5); } }
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.12, 'rgba(255,255,255,0)'); g.addColorStop(.88, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
  x.fillStyle = g; x.fillRect(0, 0, w, h); }
// orejas con sus dos tornillos de jaula
function orejas(x, w, h, claro) { for (const ox of [0, w - 16]) { x.fillStyle = claro ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.04)'; x.fillRect(ox, 0, 16, h);
    x.fillStyle = claro ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.5)'; x.fillRect(ox + (ox ? 0 : 15.4), 0, .6, h); } }
// boca RJ45 de frente: marco, hueco, traba y los contactos dorados
function rj45(x, cx, cy, abajo, claro) { const w = 11.8, h = 10.2; x.fillStyle = claro ? '#9aa1a7' : '#2a2e33'; x.fillRect(cx - w / 2 - .9, cy - h / 2 - .9, w + 1.8, h + 1.8);
  x.fillStyle = '#050607'; x.fillRect(cx - w / 2, cy - h / 2, w, h);
  const tr = abajo ? cy + h / 2 - 2.4 : cy - h / 2; x.fillRect(cx - 3, abajo ? cy + h / 2 : cy - h / 2 - 1.6, 6, 1.6);
  x.fillStyle = '#b8954a'; for (let i = 0; i < 8; i++) x.fillRect(cx - 4.2 + i * 1.2, abajo ? cy - h / 2 + 1 : cy + h / 2 - 2.2, .5, 1.2);
  const g = x.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - w / 2, cy - h / 2, w, h); void tr; }
function texto(x, t, px, py, tam, col, peso = 600, al = 'left') { x.font = `${peso} ${tam}px ${LETRA}`; x.fillStyle = col; x.textAlign = al; x.textBaseline = 'middle'; x.fillText(t, px, py); }
function rejilla(x, x0, y0, w, h, paso, alto, col) { x.fillStyle = col; for (let px = x0; px < x0 + w - paso * .4; px += paso) { const r = 1.2; x.beginPath(); x.roundRect ? x.roundRect(px, y0 + (h - alto) / 2, paso * .55, alto, r) : x.rect(px, y0 + (h - alto) / 2, paso * .55, alto); x.fill(); } }

// ---------- frentes de los equipos (coordenadas en mm sobre la placa de 482,6) ----------
function frenteODF() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#1d2023', false, 3); orejas(x, PL, h);
  texto(x, 'ODF 12 SC · TRONCAL', 26, 9, 6.2, '#9aa3ab', 600); const pos = [];
  for (let k = 0; k < 12; k++) { const cx = 120 + k * 27, cy = 25; x.fillStyle = '#0d0f11'; x.fillRect(cx - 9, cy - 9, 18, 18); texto(x, String(k + 1), cx, 9, 5.4, '#c6ccd1', 600, 'center'); pos.push([cx, cy]); }
  x.fillStyle = '#e9ebe8'; x.fillRect(PL - 92, 8, 62, 12); texto(x, 'FO-01 · 12 h', PL - 61, 14, 6, '#20252a', 700, 'center'); return [c, pos]; }
function frenteSwitch() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#d7dadc', true, 7); orejas(x, PL, h, true);
  texto(x, 'SW-N1', 24, 12, 8, '#30363b', 700); texto(x, '24 PoE · 2 SFP+', 24, 22, 5.6, '#6a7177', 500);
  x.fillStyle = '#3b4146'; x.beginPath(); x.arc(28, 32, 1.6, 0, 7); x.fill(); texto(x, 'PWR', 32, 32, 4.4, '#6a7177', 600);
  const pos = []; for (let k = 0; k < 24; k++) { const col = k >> 1, fila = k & 1, cx = 96 + col * 16.4 + Math.floor(col / 6) * 7, cy = fila ? 30.5 : 13.6; rj45(x, cx, cy, fila === 1, true);
    texto(x, String(k + 1), cx + (fila ? 0 : 0), fila ? 41 : 3.2, 3.6, '#6a7177', 600, 'center'); pos.push([cx, cy]); }
  for (let k = 0; k < 2; k++) { const cx = 340 + k * 22, cy = 21; x.fillStyle = '#8f969c'; x.fillRect(cx - 8, cy - 6.5, 16, 13); x.fillStyle = '#060708'; x.fillRect(cx - 7, cy - 5, 14, 10); pos.push([cx, cy]); texto(x, 'SFP+ ' + (k + 25), cx, 4, 3.6, '#6a7177', 600, 'center'); }
  x.fillStyle = '#c3c7ca'; x.fillRect(392, 9, 52, 24); for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(394 + i * 5.6, 11, 2.6, 20); }
  return [c, pos]; }
function frentePatchera() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#1b1e21', false, 11); orejas(x, PL, h);
  texto(x, 'PP-N1', 22, 11, 7, '#c6ccd1', 700); texto(x, 'Cat 6 · 24', 22, 21, 5.2, '#8a939b', 500);
  const pos = []; for (let k = 0; k < 24; k++) { const cx = 84 + k * 15.6 + Math.floor(k / 6) * 6.5, cy = 15.5; rj45(x, cx, cy, false, false); pos.push([cx, cy]);
    x.fillStyle = '#eceeeb'; x.fillRect(cx - 7.2, 25.5, 14.4, 8.6); texto(x, 'C-0' + (41 + k), cx, 30, 3.8, '#2a3035', 700, 'center'); texto(x, String(k + 1), cx, 4.2, 3.6, '#8a939b', 600, 'center'); }
  return [c, pos]; }
function frenteOrganizador() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#16191c', false, 13); orejas(x, PL, h);
  x.fillStyle = '#0b0c0e'; x.fillRect(30, 26, PL - 60, 10); return [c, []]; }
function frenteSwCam() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#2b3035', true, 17); orejas(x, PL, h);
  texto(x, 'SW-CCTV', 24, 12, 7.4, '#d9dde0', 700); texto(x, '8 PoE+ · 120 W', 24, 22, 5.4, '#99a1a8', 500);
  const pos = []; for (let k = 0; k < 8; k++) { const cx = 190 + k * 17, cy = 22; rj45(x, cx, cy, false, false); texto(x, String(k + 1), cx, 10, 3.8, '#99a1a8', 600, 'center'); pos.push([cx, cy]); }
  for (let k = 0; k < 2; k++) { const cx = 350 + k * 22; x.fillStyle = '#555c62'; x.fillRect(cx - 8, 15.5, 16, 13); x.fillStyle = '#060708'; x.fillRect(cx - 7, 17, 14, 10); }
  return [c, pos]; }
function frenteCiego() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#191c1f', false, 19); orejas(x, PL, h);
  rejilla(x, 60, 0, PL - 120, h, 9, 22, '#07080a'); return [c, []]; }
function frenteUPS() { const h = 2 * UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#22262a', false, 23); orejas(x, PL, h);
  x.fillStyle = '#121518'; x.fillRect(40, 10, 150, 68); x.fillStyle = '#0a2a31'; x.fillRect(52, 20, 74, 34);
  texto(x, 'UPS 1500 VA', 52, 66, 6.2, '#c6ccd1', 700); for (let k = 0; k < 3; k++) { x.fillStyle = '#3a4046'; x.beginPath(); x.arc(150 + k * 14, 37, 4.2, 0, 7); x.fill(); }
  rejilla(x, 216, 10, 240, 68, 7.4, 60, '#07080a'); return [c, []]; }
function pantallaUPS(seg) { const [c, x] = lienzo(74, 34); x.fillStyle = '#0e3a44'; x.fillRect(0, 0, 74, 34); x.fillStyle = 'rgba(160,240,255,.14)'; x.fillRect(0, 0, 74, 2);
  texto(x, '230 V', 5, 10, 8.4, '#9ff0ff', 700); texto(x, 'BAT 100 %', 5, 24, 6.4, '#9ff0ff', 600); texto(x, '48 min', 69, 24, 6.4, '#9ff0ff', 600, 'right');
  x.fillStyle = '#9ff0ff'; for (let i = 0; i < 5; i++) x.fillRect(46 + i * 4.6, 6, 3.4, 8); void seg; return c; }
function frentePDU() { const h = UM - 1, [c, x] = lienzo(PL, h); chapa(x, PL, h, '#1a1d20', false, 29); orejas(x, PL, h);
  for (let k = 0; k < 8; k++) { const cx = 96 + k * 40, cy = 21.5; x.fillStyle = '#0c0d0f'; x.beginPath(); x.arc(cx, cy, 13.5, 0, 7); x.fill(); x.fillStyle = '#26292d'; x.beginPath(); x.arc(cx, cy, 11.5, 0, 7); x.fill();
    x.fillStyle = '#060708'; x.beginPath(); x.arc(cx - 4.6, cy, 2.1, 0, 7); x.arc(cx + 4.6, cy, 2.1, 0, 7); x.fill(); x.fillStyle = '#9aa1a6'; x.fillRect(cx - .9, cy - 11.5, 1.8, 2.6); x.fillRect(cx - .9, cy + 8.9, 1.8, 2.6); }
  texto(x, 'PDU 8 × 10 A', 420, 30, 5.6, '#99a1a8', 600, 'center'); return [c, []]; }

// rejilla del lateral y techo: mapa de color y de relieve
function panelLateral(w, h, techo) { const [c, x] = lienzo(w, h), [b, y] = lienzo(w, h); chapa(x, w, h, '#1c1f22', false, techo ? 31 : 37); y.fillStyle = '#808080'; y.fillRect(0, 0, w, h);
  const fila = (yy) => { for (let px = 60; px < w - 60; px += 15) { x.fillStyle = '#050607'; x.fillRect(px, yy, 8, 46); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(px, yy - 1.5, 8, 1.5);
      y.fillStyle = '#000'; y.fillRect(px, yy, 8, 46); y.fillStyle = '#fff'; y.fillRect(px - 1.5, yy - 3, 11, 3); } };
  if (techo) { const cx = w / 2, cy = h * .42; for (let r = 18; r < 58; r += 8) { x.strokeStyle = '#08090a'; x.lineWidth = 3.4; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); y.strokeStyle = '#000'; y.lineWidth = 3.4; y.beginPath(); y.arc(cx, cy, r, 0, 7); y.stroke(); }
    x.fillStyle = '#0c0d0f'; x.fillRect(80, h - 70, w - 160, 34); y.fillStyle = '#000'; y.fillRect(80, h - 70, w - 160, 34); // pasacables con cepillo
    x.fillStyle = 'rgba(70,74,78,.9)'; for (let px = 82; px < w - 82; px += 1.6) x.fillRect(px, h - 68, .7, 30); }
  else { fila(40); fila(h - 86); // cerradura
    x.fillStyle = '#9aa0a5'; x.beginPath(); x.arc(w - 70, h / 2, 9, 0, 7); x.fill(); x.fillStyle = '#2a2e32'; x.fillRect(w - 71.2, h / 2 - 6, 2.4, 12);
    x.fillStyle = '#eef0ec'; x.fillRect(46, h / 2 - 16, 96, 32); texto(x, 'RK-N1', 94, h / 2 - 3, 13, '#14171A', 700, 'center'); texto(x, 'GALPÓN N1 · 9U', 94, h / 2 + 9.5, 6, '#4a525a', 600, 'center'); }
  return [textura(c), textura(b, false)]; }

export async function montar(cv, ctx) {
  let ren; try { ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  ren.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0; ren.outputColorSpace = THREE.SRGBColorSpace;
  const esc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 2, 1, 400), pm = new THREE.PMREMGenerator(ren);
  esc.environment = pm.fromScene(new RoomEnvironment(), .03).texture; esc.environmentIntensity = .8;
  esc.add(new THREE.HemisphereLight(0xdfe8f0, 0x14171a, .35));
  const clave = new THREE.DirectionalLight(0xfff4e6, 2.1); clave.position.set(-7, 9, 10); esc.add(clave);
  const borde = new THREE.DirectionalLight(0x9cc0ff, 1.1); borde.position.set(9, 4, -8); esc.add(borde);
  const relleno = new THREE.DirectionalLight(0xffffff, .35); relleno.position.set(4, -3, 8); esc.add(relleno);

  const S = new THREE.Group(), K = 1 / 170; S.scale.setScalar(K); const rack = new THREE.Group(); rack.add(S); esc.add(rack);
  const mat = (o) => new THREE.MeshStandardMaterial(Object.assign({ color: 0x1c1f22, roughness: .5, metalness: .45 }, o));
  const pintura = mat({ color: 0x1b1e21, roughness: .58, metalness: .4 }), riel = mat({ color: 0x8c949a, roughness: .35, metalness: .9 });
  const caja = (w, h, d, m, x, y, z, r = 0) => { const g = r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); S.add(o); return o; };

  // gabinete: laterales con rejilla y cerradura, techo con ventilador y pasacables, piso, fondo
  const zF = 96, zB = zF - PROF, zC = (zF + zB) / 2, e = 8;
  const [latC, latB] = panelLateral(PROF, ALTO, false), [lat2C] = panelLateral(PROF, ALTO, false), [techoC, techoB] = panelLateral(ANCHO, PROF, true);
  const mLat = mat({ color: 0xffffff, map: latC, bumpMap: latB, bumpScale: 2.2, roughness: .55, metalness: .45 }), mTecho = mat({ color: 0xffffff, map: techoC, bumpMap: techoB, bumpScale: 2.2, roughness: .55, metalness: .45 });
  const lado = (s) => { caja(e, ALTO, PROF, pintura, s * (ANCHO / 2 - e / 2), ALTO / 2, zC, 3); const cara = new THREE.Mesh(new THREE.PlaneGeometry(PROF - 6, ALTO - 6), s > 0 ? mLat : mat({ color: 0xffffff, map: lat2C, roughness: .55, metalness: .45 })); cara.rotation.y = s * Math.PI / 2;
    cara.position.set(s * (ANCHO / 2 + .3), ALTO / 2, zC); S.add(cara); };
  lado(1); lado(-1);
  caja(ANCHO, e, PROF, pintura, 0, ALTO - e / 2, zC, 3); { const t = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO - 6, PROF - 6), mTecho); t.rotation.x = -Math.PI / 2; t.position.set(0, ALTO + .3, zC); S.add(t); }
  caja(ANCHO, e, PROF, pintura, 0, e / 2, zC, 3); caja(ANCHO - 2 * e, ALTO - 2 * e, 4, mat({ color: 0x111315, roughness: .7 }), 0, ALTO / 2, zB + 2);
  // marco del frente y rieles con agujeros cuadrados
  for (const s of [-1, 1]) { caja(28, ALTO, 10, pintura, s * (ANCHO / 2 - 14), ALTO / 2, zF - 5, 2); caja(16, NU * UM + 10, 2.4, riel, s * (465 / 2 + 6), (TOP + BOT) / 2, -1.5); }
  caja(ANCHO, 26, 10, pintura, 0, ALTO - 13, zF - 5, 2); caja(ANCHO, 26, 10, pintura, 0, 13, zF - 5, 2);
  { const g = new THREE.BoxGeometry(5.5, 5.5, 1), m = new THREE.MeshBasicMaterial({ color: 0x050607 }), im = new THREE.InstancedMesh(g, m, NU * 3 * 2), M4 = new THREE.Matrix4(); let n = 0;
    for (const s of [-1, 1]) for (let u = 0; u < NU; u++) for (const dy of [-15.9, 0, 15.9]) { M4.makeTranslation(s * (465 / 2 + 6), TOP - u * UM - UM / 2 + dy, -.1); im.setMatrixAt(n++, M4); } S.add(im); }

  // equipos
  const placa = (u, n, [cv2, pos], prof, metal, rough, base = 0x1c1f22) => { const h = n * UM - 1, t = textura(cv2), front = mat({ color: 0xffffff, map: t, roughness: rough, metalness: metal }), cuerpo = mat({ color: base, roughness: .5, metalness: .5 });
    const o = new THREE.Mesh(new THREE.BoxGeometry(PL, h, 3.2), [cuerpo, cuerpo, cuerpo, cuerpo, front, cuerpo]); o.position.set(0, yU(u, n), 1.6); S.add(o);
    caja(440, h - 2, prof, cuerpo, 0, yU(u, n), -prof / 2); return pos.map(([px, py]) => new THREE.Vector3(px - PL / 2, yU(u, n) + (h / 2 - py), 3.3)); };
  const pODF = placa(1, 1, frenteODF(), 120, .4, .5), pSW = placa(2, 1, frenteSwitch(), 300, .85, .32, 0xcfd3d6), pPP = placa(3, 1, frentePatchera(), 110, .4, .5);
  placa(4, 1, frenteOrganizador(), 60, .4, .55); const pCam = placa(5, 1, frenteSwCam(), 220, .75, .36, 0x2b3035); placa(6, 1, frenteCiego(), 4, .4, .55);
  placa(7, 2, frenteUPS(), 320, .4, .55); placa(9, 1, frentePDU(), 60, .4, .55);
  // pantalla de la UPS, que alumbra
  const tUPS = textura(pantallaUPS(0)); { const o = new THREE.Mesh(new THREE.PlaneGeometry(74, 34), new THREE.MeshBasicMaterial({ map: tUPS, toneMapped: false })); o.position.set(-PL / 2 + 52 + 37, yU(7, 2) + (2 * UM - 1) / 2 - 37, 3.4); S.add(o); }
  // botón de encendido rojo de la regleta
  { const o = new THREE.Mesh(new THREE.BoxGeometry(14, 20, 6), new THREE.MeshStandardMaterial({ color: 0xd2272b, emissive: 0xff2a2a, emissiveIntensity: .7, roughness: .35 })); o.position.set(-PL / 2 + 44, yU(9), 5); S.add(o); }
  // tornillos de las orejas
  { const g = new THREE.CylinderGeometry(3.6, 3.6, 2.2, 16); g.rotateX(Math.PI / 2); const im = new THREE.InstancedMesh(g, mat({ color: 0xb9bfc4, metalness: .95, roughness: .25 }), 9 * 4 + 4), M4 = new THREE.Matrix4(); let n = 0;
    for (const [u, nn] of [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 2], [9, 1]]) for (const s of [-1, 1]) for (const dy of nn === 2 ? [-UM / 2, UM / 2] : [0]) { M4.makeTranslation(s * (465 / 2 + 6), yU(u, nn) + dy, 4.4); im.setMatrixAt(n++, M4); }
    im.count = n; S.add(im); }
  // aros del organizador
  { const g = new THREE.TorusGeometry(13, 2.6, 8, 18, Math.PI), m = mat({ color: 0x15181b, roughness: .6, metalness: .3 }); for (let k = 0; k < 6; k++) { const o = new THREE.Mesh(g, m); o.rotation.set(0, Math.PI / 2, Math.PI / 2); o.position.set(-180 + k * 72, yU(4) + 4, 16); S.add(o); } }

  // luces de enlace: 24 del switch + 2 SFP + 8 del de cámaras
  const gLed = new THREE.BoxGeometry(2.8, 1.8, 1), mLed = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const luces = new THREE.InstancedMesh(gLed, mLed, 34), M4 = new THREE.Matrix4();
  pSW.forEach((p, i) => { const arriba = i < 24 ? (i & 1) === 0 : true; M4.makeTranslation(p.x + (i < 24 ? 3.6 : 0), p.y + (arriba ? 7.2 : -7.2), 3.6); luces.setMatrixAt(i, M4); });
  pCam.forEach((p, i) => { M4.makeTranslation(p.x + 3.6, p.y + 7.4, 3.6); luces.setMatrixAt(26 + i, M4); }); S.add(luces);
  for (let i = 0; i < 34; i++) luces.setColorAt(i, new THREE.Color(0x22e07a));

  // cables: fichas RJ45 con su capuchón y el cable que cae en curva hasta la patchera
  const mCable = (c) => mat({ color: c, roughness: .55, metalness: 0 });
  const ficha = (p, col, abajo) => { const g = new THREE.Group(); const capu = new THREE.Mesh(new RoundedBoxGeometry(12.6, 11, 22, 2, 2.2), mCable(col)); capu.position.z = 14; g.add(capu);
    const cl = new THREE.Mesh(new THREE.BoxGeometry(11.4, 9.6, 6), mat({ color: 0xdfe6ea, roughness: .15, metalness: 0, transparent: true, opacity: .8 })); cl.position.z = 3; g.add(cl); g.position.copy(p); g.position.y += abajo ? -.6 : .6; S.add(g); };
  const tubo = (pts, col, r = 3.1) => { const cu = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .5); S.add(new THREE.Mesh(new THREE.TubeGeometry(cu, 48, r, 8), mCable(col))); };
  const colores = [0x2f6fd6, 0x2f6fd6, 0x2f6fd6, 0x2f6fd6, 0x2f6fd6, 0x2f6fd6, 0x8d979f, 0x8d979f, 0x8d979f, 0x8d979f, 0xe6be1e, 0x18a957, 0x2f6fd6, 0x2f6fd6, 0x8d979f, 0x8d979f];
  for (let k = 0; k < 16; k++) { const a = pSW[k], b = pPP[k < 12 ? k : k + 2], col = colores[k], abajo = (k & 1) === 1; ficha(a, col, abajo); ficha(b, col, false);
    const sa = a.clone().add(new THREE.Vector3(0, 0, 25)), sb = b.clone().add(new THREE.Vector3(0, 0, 25)), cola = 30 + (k % 4) * 9;
    tubo([sa, sa.clone().add(new THREE.Vector3(0, -6, cola * .7)), new THREE.Vector3((sa.x + sb.x) / 2, (sa.y + sb.y) / 2 - 10, sa.z + cola), sb.clone().add(new THREE.Vector3(0, 8, cola * .6)), sb], col); }
  // del switch de cámaras salen al costado izquierdo y bajan por el lateral
  for (let k = 0; k < 6; k++) { const a = pCam[k]; ficha(a, 0x2f6fd6, false); const sa = a.clone().add(new THREE.Vector3(0, 0, 25)), y0 = sa.y;
    tubo([sa, sa.clone().add(new THREE.Vector3(-10, -8, 22)), new THREE.Vector3(-160 - k * 6, y0 - 22, sa.z + 22), new THREE.Vector3(-262 - k * 3, y0 - 40, 0), new THREE.Vector3(-266 - k * 3, BOT - 20, -60 - k * 8)], 0x2f6fd6); }
  // fibra: dos jumpers amarillos del ODF a los SFP del switch, con su conector SC azul
  const mSC = mat({ color: 0x2f6fd6, roughness: .35, metalness: 0 }), mLC = mat({ color: 0x2f6fd6, roughness: .35, metalness: 0 });
  for (let k = 0; k < 2; k++) { const a = pODF[k], b = pSW[24 + k]; const sc = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 24), mSC); sc.position.copy(a).add(new THREE.Vector3(0, 0, 12)); S.add(sc);
    const lc = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 20), mLC); lc.position.copy(b).add(new THREE.Vector3(0, 0, 10)); S.add(lc);
    const sa = a.clone().add(new THREE.Vector3(0, 0, 28)), sb = b.clone().add(new THREE.Vector3(0, 0, 24));
    tubo([sa, sa.clone().add(new THREE.Vector3(-6, -14, 30)), new THREE.Vector3((sa.x + sb.x) / 2 - 30, sa.y - 40, 70 + k * 10), sb.clone().add(new THREE.Vector3(10, 12, 30)), sb], 0xf2c500, 1.6); }
  // bandeja de los cables que bajan por la izquierda: precinto de velcro
  for (const y of [yU(6), yU(8)]) { const o = new THREE.Mesh(new THREE.TorusGeometry(14, 1.8, 6, 16), mat({ color: 0x111111, roughness: .8, metalness: 0 })); o.rotation.x = Math.PI / 2; o.position.set(-268, y, -28); S.add(o); }

  // puerta de vidrio templado sobre la bisagra izquierda, entreabierta
  const puerta = new THREE.Group(), PW = ANCHO - 6, PH = ALTO - 6; puerta.position.set(-ANCHO / 2 + 3, ALTO / 2, zF + 4); S.add(puerta);
  const marco = mat({ color: 0x15181b, roughness: .4, metalness: .6 });
  for (const [w, h, x, y] of [[PW, 26, PW / 2, PH / 2 - 13], [PW, 26, PW / 2, -PH / 2 + 13], [26, PH, 13, 0], [30, PH, PW - 15, 0]]) { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, 12, 2, 3), marco); o.position.set(x, y, 0); puerta.add(o); }
  { const v = new THREE.Mesh(new THREE.PlaneGeometry(PW - 50, PH - 48), new THREE.MeshPhysicalMaterial({ color: 0x9fb2bd, metalness: 0, roughness: .04, transparent: true, opacity: .16, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false }));
    v.position.set(PW / 2, 0, 0); puerta.add(v);
    const man = new THREE.Mesh(new RoundedBoxGeometry(14, 110, 16, 2, 4), mat({ color: 0xaeb4b9, metalness: .95, roughness: .25 })); man.position.set(PW - 15, 0, 12); puerta.add(man); }
  puerta.rotation.y = -.42; // entreabierta: se ve el vidrio y el frente queda a la vista

  // dónde quedan las bocas en la pantalla, para el aviso
  const bocas = pSW.slice(0, 24).concat(pCam);

  /* encuadre: en compu a la derecha, de costado; en el celular arriba al centro */
  let base = { x: 8, y: -1, s: 1 }, angosto = false;
  function medir() { const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; ren.setSize(w, h, false); cam.aspect = w / h; angosto = w / h < 1.1;
    cam.position.set(0, 2.4, angosto ? 46 : 34); cam.lookAt(0, -.4, 0); cam.updateProjectionMatrix();
    base = angosto ? { x: -.7, y: 4.6, s: .98 } : { x: Math.min(9.6, 7.4 + (w / h - 1.4) * 3), y: -2.9, s: 1.32 }; }
  addEventListener('resize', medir); medir();

  let mx = 0, my = 0, tx = 0, ty = 0, visible = true, ultLed = 0; const t0 = performance.now(), col = new THREE.Color(), pa = new THREE.Vector3();
  addEventListener('pointermove', ev => { mx = ev.clientX / innerWidth - .5; my = ev.clientY / innerHeight - .5; }, { passive: true });
  const VERDE = new THREE.Color(0x22e07a), AMBAR = new THREE.Color(0xf7b500), ROJO = new THREE.Color(0xff3b3b), APAG = new THREE.Color(0x0e1214);
  function pintarLeds(seg) { const E = ctx.ev();
    for (let i = 0; i < 34; i++) { const boca = i < 24 ? i : i >= 26 ? 24 + (i - 26) : -1, e = boca === E.boca ? E.est : '';
      if (e === 'r') col.copy(Math.floor(seg * 2) % 2 ? ROJO : APAG); else if (e === 'a') col.copy(Math.random() < .5 ? AMBAR : APAG); else col.copy(Math.random() < .82 ? VERDE : APAG.clone().lerp(VERDE, .15));
      luces.setColorAt(i, col); } luces.instanceColor.needsUpdate = true; }
  function cuadro(now) { if (!visible && !ctx.reducir) return; const seg = ctx.reducir ? 2 : (now - t0) / 1000;
    tx += (mx - tx) * .05; ty += (my - ty) * .05;
    rack.position.set(base.x + tx * .5, base.y + Math.sin(seg * .7) * .1 - ty * .25, 0); rack.scale.setScalar(base.s);
    rack.rotation.set(.2 + ty * .05, -.62 + tx * .3 + Math.sin(seg * .25) * .04, 0); rack.updateMatrixWorld();
    if (now - ultLed > 90 || ctx.reducir) { ultLed = now; pintarLeds(seg); }
    const g = ctx.globo; if (g && !angosto) { const E = ctx.ev(); pa.copy(bocas[Math.min(E.boca, bocas.length - 1)]).applyMatrix4(S.matrixWorld).project(cam); const r = cv.getBoundingClientRect();
      g.style.left = ((pa.x + 1) / 2 * r.width - 6) + 'px'; g.style.top = ((1 - pa.y) / 2 * r.height) + 'px'; g.style.color = E.est === 'r' ? '#FF5A5D' : E.est === 'a' ? '#F7C600' : '#3ADB86'; }
    ren.render(esc, cam); if (!ctx.reducir) requestAnimationFrame(cuadro); }
  if ('IntersectionObserver' in window) new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible && !ctx.reducir) requestAnimationFrame(cuadro); }).observe(cv);
  requestAnimationFrame(n => { cuadro(n); cv.classList.add('listo'); });
  return { listo: true, rack: S, cam };
}

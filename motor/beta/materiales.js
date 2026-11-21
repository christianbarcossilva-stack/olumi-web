// Motor común · materiales propios (beta). Acá va lo que hace que la maqueta se vea nuestra y no «de cajas»:
// chapa con el perfil de verdad (trapezoidal o acanalada), con relieve que agarra la luz, tornillos, solapes entre chapas y el reflejo del cielo.
// Todo se dibuja en el momento (sin fotos de terceros) y cada combinación se arma una sola vez.
import { THREE } from './nucleo.js?v=16';

const TEX = new Map(), MATS = new Map();
const azar = s => () => { s = (s * 16807 + 11) % 2147483647; return (s & 0xffff) / 0xffff; };
// perfil de la chapa en una onda (0 a 1): altura de 0 (valle) a 1 (cresta)
const PERFIL = {
  trapezoidal: t => t < 0.5 ? 0 : t < 0.62 ? (t - 0.5) / 0.12 : t < 0.88 ? 1 : 1 - (t - 0.88) / 0.12,   // valle ancho, cresta angosta (T-101)
  acanalada: t => 0.5 - 0.5 * Math.cos(t * Math.PI * 2)                                               // onda pareja (sinusoidal)
};
// La textura cubre METROS × METROS de pared. ondas = cuántas ondas entran; cada «chapa» mide 4 ondas de ancho.
export const METROS_CHAPA = 6;
function texturas(perfil, ondas) { const k = perfil + ondas; if (TEX.has(k)) return TEX.get(k);
  const W = 2048, H = 1024, f = PERFIL[perfil] || PERFIL.trapezoidal, R = azar(ondas * 31 + perfil.length), p = W / ondas;
  const cC = document.createElement('canvas'), cN = document.createElement('canvas'), cR = document.createElement('canvas'); for (const c of [cC, cN, cR]) { c.width = W; c.height = H; }
  const xc = cC.getContext('2d'), xn = cN.getContext('2d'), xr = cR.getContext('2d');
  // una fila de 1 px con el perfil: color (sombra propia en los flancos y en el fondo del valle), relieve y brillo
  const filaC = xc.createImageData(W, 1), filaN = xn.createImageData(W, 1), filaR = xr.createImageData(W, 1), tono = []; for (let i = 0; i < Math.ceil(ondas / 4) + 1; i++) tono.push(0.955 + R() * 0.06);
  for (let x = 0; x < W; x++) { const t = (x % p) / p, h = f(t), dh = (f(((x + 1) % p) / p) - f(((x - 1 + W) % p) / p)) * 0.5, ch = tono[Math.floor(x / p / 4)];
    const luz = (0.86 + 0.14 * h - Math.abs(dh) * 0.9) * ch, v = Math.max(0, Math.min(255, Math.round(luz * 255)));
    filaC.data.set([v, v, v, 255], x * 4); const nx = Math.max(-1, Math.min(1, -dh * 9)), nz = Math.sqrt(Math.max(0.05, 1 - nx * nx));
    filaN.data.set([Math.round((nx * 0.5 + 0.5) * 255), 128, Math.round((nz * 0.5 + 0.5) * 255), 255], x * 4); const r = Math.round((0.86 + 0.14 * (1 - h)) * 255); filaR.data.set([r, r, r, 255], x * 4); }
  for (let y = 0; y < H; y++) { xc.putImageData(filaC, 0, y); xn.putImageData(filaN, 0, y); xr.putImageData(filaR, 0, y); }
  // solape entre chapas a lo largo (una línea de sombra arriba de la textura) y a lo ancho (cada 4 ondas)
  xc.fillStyle = 'rgba(0,0,0,.34)'; xc.fillRect(0, 0, W, 3); xc.fillStyle = 'rgba(255,255,255,.22)'; xc.fillRect(0, 3, W, 2); xn.fillStyle = 'rgb(128,60,200)'; xn.fillRect(0, 0, W, 3);
  for (let i = 0; i < ondas; i += 4) { xc.fillStyle = 'rgba(0,0,0,.2)'; xc.fillRect(Math.round(i * p + p * 0.5), 0, 2, H); }
  // tornillos autoperforantes con arandela, en hileras (una correa cada metro y medio), sobre cada cresta
  const hileras = [0.07, 0.32, 0.57, 0.82], cx = perfil === 'acanalada' ? 0.5 : 0.75;
  for (const hy of hileras) for (let i = 0; i < ondas; i++) { if (perfil === 'acanalada' && i % 2) continue; const x = (i + cx) * p, y = hy * H;
    xc.fillStyle = 'rgba(0,0,0,.28)'; xc.beginPath(); xc.ellipse(x + 1, y + 3, 6, 5, 0, 0, 7); xc.fill(); xc.fillStyle = '#5d646a'; xc.beginPath(); xc.arc(x, y, 5, 0, 7); xc.fill(); xc.fillStyle = '#c9cfd4'; xc.beginPath(); xc.arc(x - 1, y - 1, 2.6, 0, 7); xc.fill();
    xr.fillStyle = '#555'; xr.beginPath(); xr.arc(x, y, 5, 0, 7); xr.fill(); }
  // la vida de la chapa: chorreaduras finas debajo de algunos tornillos y manchas de polvo muy suaves (sin dibujo que se note al repetir)
  for (let i = 0; i < 46; i++) { const x = (Math.floor(R() * ondas) + cx) * p + (R() - 0.5) * 4, y = hileras[Math.floor(R() * 4)] * H + 5, l = 40 + R() * 150, g = xc.createLinearGradient(0, y, 0, y + l);
    g.addColorStop(0, `rgba(96,84,70,${0.1 + R() * 0.12})`); g.addColorStop(1, 'rgba(96,84,70,0)'); xc.fillStyle = g; xc.fillRect(x - 1.5, y, 3 + R() * 2, l); }
  for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H, r = 60 + R() * 160, g = xc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R() < 0.5 ? '255,255,255' : '70,70,66'},${0.035 + R() * 0.03})`); g.addColorStop(1, 'rgba(128,128,128,0)'); xc.fillStyle = g; xc.fillRect(x - r, y - r, r * 2, r * 2); }
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const o = { color: tx(cC, true), normal: tx(cN, false), rugoso: tx(cR, false) }; TEX.set(k, o); return o; }

// chapa(color, { perfil, terminacion, ondas }): material listo para cajaT(…, METROS_CHAPA). El uv va en metros / METROS_CHAPA.
// terminacion: 'prepintada' (color parejo con brillo de pintura al horno), 'galvanizada' (cinc: gris con reflejo de metal) o 'vieja' (opaca).
export function chapa(color = '#e8ecee', o = {}) { const perfil = o.perfil || 'trapezoidal', term = o.terminacion || 'prepintada', ondas = o.ondas || (perfil === 'acanalada' ? 80 : 24), k = [color, perfil, term, ondas].join('|'); if (MATS.has(k)) return MATS.get(k);
  const T = texturas(perfil, ondas), F = { prepintada: { metalness: 0.32, roughness: 0.46, env: 1.0 }, galvanizada: { metalness: 0.88, roughness: 0.34, env: 1.15 }, vieja: { metalness: 0.2, roughness: 0.8, env: 0.6 } }[term] || {};
  const m = new THREE.MeshStandardMaterial({ color, map: T.color, normalMap: T.normal, normalScale: new THREE.Vector2(perfil === 'acanalada' ? 0.8 : 1.25, 1), roughnessMap: T.rugoso, roughness: F.roughness, metalness: F.metalness, envMapIntensity: F.env });
  MATS.set(k, m); return m; }

// sombra de apoyo al pie de una construcción: una franja que se oscurece contra la pared y se redondea en las esquinas
// (lo que una luz de verdad hace sola y da el «está apoyado»)
let texPie = null, texEsq = null;
export function sombraDeApoyo(g, w, d, o = {}) {
  if (!texPie) { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64); texPie = new THREE.CanvasTexture(c);
    const e = document.createElement('canvas'); e.width = e.height = 64; const y = e.getContext('2d'), rr = y.createRadialGradient(0, 0, 0, 0, 0, 64); rr.addColorStop(0, 'rgba(0,0,0,1)'); rr.addColorStop(0.35, 'rgba(0,0,0,.42)'); rr.addColorStop(1, 'rgba(0,0,0,0)'); y.fillStyle = rr; y.fillRect(0, 0, 64, 64); texEsq = new THREE.CanvasTexture(e); }
  const an = o.ancho || 3, base = { color: 0x000000, transparent: true, opacity: o.fuerza ?? 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -10, toneMapped: false }, m = new THREE.MeshBasicMaterial({ map: texPie, ...base }), me = new THREE.MeshBasicMaterial({ map: texEsq, ...base });
  const pon = (k, x, z, giro) => { k.position.set(x, 0.062, z); k.rotation.y = giro; k.renderOrder = 1; k.userData.noChoca = true; k.userData.noPica = true; k.raycast = () => {}; g.add(k); };
  for (const [x, z, largo, giro] of [[0, d, w * 2, 0], [0, -d, w * 2, Math.PI], [w, 0, d * 2, Math.PI / 2], [-w, 0, d * 2, -Math.PI / 2]]) pon(new THREE.Mesh(new THREE.PlaneGeometry(largo, an).rotateX(-Math.PI / 2).translate(0, 0, an / 2), m), x, z, giro);
  // esquinas: un cuarto de círculo con el centro (lo más oscuro) en la esquina de la pared
  for (const [x, z, giro] of [[w, d, 0], [w, -d, Math.PI / 2], [-w, -d, Math.PI], [-w, d, -Math.PI / 2]]) pon(new THREE.Mesh(new THREE.PlaneGeometry(an, an).rotateX(-Math.PI / 2).translate(an / 2, 0, an / 2), me), x, z, giro); }

// Motor común · texturas dibujadas en el momento (sin archivos ni fotos de terceros): pedregullo, tierra, hormigón, asfalto,
// pasto, chapa acanalada y puertas de contenedor. Cada una se dibuja una sola vez y se repite en metros.
import { THREE } from './nucleo.js';

const CACHE = new Map();
const lienzo = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
// azar repetible: la misma textura cada vez que se abre
function rnd(s) { let x = s * 9301 + 49297; return () => (x = (x * 16807) % 2147483647) / 2147483647; }

// suelo: color base, granos claros y oscuros, manchas grandes y suaves (charcos secos, huellas)
const SUELOS = {
  pedregullo: { base: '#b4b2ac', granos: 30000, g: 14, tam: [0.6, 1.8], manchas: 40, mv: 8 },
  tierra:     { base: '#c2bba9', granos: 22000, g: 11, tam: [0.6, 1.6], manchas: 40, mv: 8 },
  hormigon:   { base: '#c9ccca', granos: 9000,  g: 8,  tam: [0.5, 1.2], manchas: 24, mv: 6, juntas: 4 },
  asfalto:    { base: '#6d7277', granos: 30000, g: 10, tam: [0.5, 1.3], manchas: 24, mv: 6 },
  pasto:      { base: '#93ad7c', granos: 34000, g: 10, tam: [0.8, 2], manchas: 50, mv: 7, verde: true },
  monte:      { base: '#6f8a5e', granos: 26000, g: 10, tam: [0.8, 2.2], manchas: 40, mv: 8, verde: true }
};
export function suelo(k) { const key = 'suelo:' + k; if (CACHE.has(key)) return CACHE.get(key); const S = SUELOS[k] || SUELOS.tierra, N = 512, [cv, x] = lienzo(N), R = rnd(k.length * 131 + N);
  x.fillStyle = S.base; x.fillRect(0, 0, N, N); const b = new THREE.Color(S.base), c = new THREE.Color();
  // manchas grandes: se dibujan también corridas un lienzo para que la repetición no muestre costuras
  for (let i = 0; i < S.manchas; i++) { const px = R() * N, py = R() * N, r = 20 + R() * 90, d = (R() - 0.5) * S.mv / 100; c.copy(b).offsetHSL(S.verde ? (R() - 0.5) * 0.03 : 0, 0, d);
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const gr = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); gr.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2); } }
  for (let i = 0; i < S.granos; i++) { const v = (R() - 0.5) * S.g; c.copy(b).offsetHSL(S.verde ? (R() - 0.5) * 0.05 : (R() - 0.5) * 0.01, S.verde ? (R() - 0.5) * 0.1 : 0, v / 100); x.fillStyle = '#' + c.getHexString();
    const t = S.tam[0] + R() * (S.tam[1] - S.tam[0]); x.fillRect(R() * N, R() * N, t, t); }
  if (S.juntas) { x.strokeStyle = 'rgba(70,72,72,.35)'; x.lineWidth = 1.2; for (let i = 0; i <= S.juntas; i++) { const p = i * N / S.juntas; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, N); x.moveTo(0, p); x.lineTo(N, p); x.stroke(); } }
  const t = tex(cv); CACHE.set(key, t); return t; }
// tamaño en metros de un cuadro de cada suelo
export const METROS = { pedregullo: 14, tierra: 18, hormigon: 16, asfalto: 12, pasto: 40, monte: 40 };

// chapa acanalada (contenedores y galpones): gris claro para multiplicar por el color; sirve también de relieve
export function chapa(costillas = 44, tipo = 'cont') { const key = 'chapa:' + costillas + tipo; if (CACHE.has(key)) return CACHE.get(key); const W = 1024, H = 256, [cv, x] = lienzo(W, H), R = rnd(costillas * 7);
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, W, H); const p = W / costillas;
  for (let i = 0; i < costillas; i++) { const g = x.createLinearGradient(i * p, 0, (i + 1) * p, 0); g.addColorStop(0, '#cfcfcf'); g.addColorStop(0.18, '#f2f2f2'); g.addColorStop(0.5, '#e0e0e0'); g.addColorStop(0.72, '#b4b4b4'); g.addColorStop(1, '#cfcfcf'); x.fillStyle = g; x.fillRect(i * p, 0, p, H); }
  if (tipo === 'cont') { x.fillStyle = 'rgba(40,40,40,.55)'; x.fillRect(0, 0, W, 9); x.fillRect(0, H - 11, W, 11); x.fillRect(0, 0, 10, H); x.fillRect(W - 10, 0, 10, H);
    // óxido y suciedad: chorreaduras desde arriba y polvo abajo
    for (let i = 0; i < 26; i++) { const sx = R() * W, l = 20 + R() * 120; const g = x.createLinearGradient(0, 9, 0, 9 + l); g.addColorStop(0, `rgba(110,62,30,${0.18 + R() * 0.2})`); g.addColorStop(1, 'rgba(110,62,30,0)'); x.fillStyle = g; x.fillRect(sx, 9, 2 + R() * 5, l); }
    const g = x.createLinearGradient(0, H * 0.7, 0, H); g.addColorStop(0, 'rgba(90,80,65,0)'); g.addColorStop(1, 'rgba(90,80,65,.35)'); x.fillStyle = g; x.fillRect(0, H * 0.7, W, H * 0.3); }
  const t = tex(cv); CACHE.set(key, t); return t; }

// frente de un contenedor: dos puertas con sus cuatro barras de cierre; reefer: el equipo de frío con su rejilla
export function frente(reefer) { const key = 'frente:' + !!reefer; if (CACHE.has(key)) return CACHE.get(key); const W = 256, H = 256, [cv, x] = lienzo(W, H);
  x.fillStyle = '#d4d4d4'; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(40,40,40,.6)'; x.fillRect(0, 0, W, 12); x.fillRect(0, H - 14, W, 14); x.fillRect(0, 0, 12, H); x.fillRect(W - 12, 0, 12, H);
  if (reefer) { x.fillStyle = '#9a9ea2'; x.fillRect(22, 22, W - 44, H - 48); x.fillStyle = '#2e3236'; for (let i = 0; i < 14; i++) x.fillRect(40, 40 + i * 11, W - 120, 5); x.fillStyle = '#5b6066'; x.beginPath(); x.arc(W - 52, 70, 22, 0, 7); x.fill(); x.fillStyle = '#e9ecee'; x.fillRect(W - 76, 120, 48, 70); }
  else { for (let i = 0; i < 2; i++) { const x0 = 14 + i * (W - 28) / 2; for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#c4c4c4' : '#e6e6e6'; x.fillRect(x0, 14 + k * (H - 28) / 8, (W - 28) / 2, (H - 28) / 8); } }
    x.fillStyle = 'rgba(30,30,30,.7)'; x.fillRect(W / 2 - 1.5, 12, 3, H - 26); x.fillStyle = '#5c5f62'; for (const bx of [44, 92, 164, 212]) x.fillRect(bx, 14, 5, H - 28); for (const bx of [44, 92, 164, 212]) { x.fillRect(bx - 6, H / 2 - 4, 16, 9); } }
  const t = tex(cv); CACHE.set(key, t); return t; }

// materiales con textura repetida en metros (cada combinación una sola vez)
const MATS = new Map();
export function matTex(t, color, rep = [1, 1], o = {}) { const k = t.uuid + color + rep.join(',') + JSON.stringify(o, (n, v) => v && v.isTexture ? v.uuid : v); let m = MATS.get(k); if (m) return m;
  const r = t.clone(); r.needsUpdate = true; r.repeat.set(rep[0], rep[1]); if (o.bumpMap === t) o = { ...o, bumpMap: r };
  m = new THREE.MeshStandardMaterial(Object.assign({ map: r, color, roughness: 0.92, metalness: 0 }, o)); MATS.set(k, m); return m; }

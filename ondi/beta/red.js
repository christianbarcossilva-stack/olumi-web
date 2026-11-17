/* Ondi · documentación de conexiones: racks, bocas, cables y fibras.
   No depende del motor 3D: recibe los datos (racks, fibras, equipos) y avisa cuando hay que guardar.
   La usan la maqueta actual y la maqueta nueva. Datos: los mismos de siempre (cabs / fibs), con campos nuevos opcionales. */
(function () {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const corto = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const may = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const dec = v => v == null || v === '' ? '' : String(v).replace('.', ',');

/* ---------- catálogo ---------- */
const CAT = {
  sw8: { n: 'Switch 8 puertos PoE', U: 1, rj: 8, sfp: 2, g: 'Red' },
  sw16: { n: 'Switch 16 puertos PoE', U: 1, rj: 16, sfp: 2, g: 'Red' },
  sw24: { n: 'Switch 24 puertos PoE', U: 1, rj: 24, sfp: 4, g: 'Red' },
  sw48: { n: 'Switch 48 puertos PoE', U: 1, rj: 48, sfp: 4, g: 'Red' },
  swc: { n: 'Switch de fibra 16 SFP', U: 1, rj: 0, sfp: 16, g: 'Red' },
  gw: { n: 'Router / gateway', U: 1, rj: 8, sfp: 2, g: 'Red' },
  fw: { n: 'Firewall', U: 1, rj: 8, sfp: 2, g: 'Red' },
  pc24: { n: 'Patchera de cobre 24 bocas', U: 1, rj: 24, pp: true, g: 'Patcheras' },
  pc48: { n: 'Patchera de cobre 48 bocas', U: 2, rj: 48, pp: true, g: 'Patcheras' },
  pp12: { n: 'Patchera de fibra 12 SC', U: 1, fo: 12, con: 'SC', g: 'Patcheras' },
  pp24: { n: 'Patchera de fibra 24 LC', U: 1, fo: 24, con: 'LC', g: 'Patcheras' },
  ros: { n: 'Roseta de fibra 4 SC', U: 1, fo: 4, con: 'SC', g: 'Patcheras' },
  odf: { n: 'Bandeja de empalme', U: 1, g: 'Patcheras' },
  nvr: { n: 'NVR 16 canales', U: 1, rj: 1, g: 'Equipos' },
  srv: { n: 'Servidor', U: 1, rj: 2, g: 'Equipos' },
  org: { n: 'Organizador de cables', U: 1, g: 'Orden y energía' },
  ups: { n: 'UPS', U: 2, g: 'Orden y energía' },
  pdu: { n: 'Regleta de energía', U: 1, g: 'Orden y energía' },
  shelf: { n: 'Bandeja fija', U: 1, g: 'Orden y energía' },
  blank: { n: 'Tapa ciega', U: 1, g: 'Orden y energía' }
};
// switches de marca (datos de la ficha de cada fabricante): el modelo define puertos, SFP y PoE. Sumar uno es sumar un renglón.
// [id, marca, modelo, puertos de cobre, SFP, puertos PoE, presupuesto PoE en W, SFP+ (10 G)]
const MOD = [
  ['ubi-lite8p', 'Ubiquiti', 'USW-Lite-8-PoE', 8, 0, 4, 52], ['ubi-16p', 'Ubiquiti', 'USW-16-PoE', 16, 2, 8, 42], ['ubi-24', 'Ubiquiti', 'USW-24', 24, 2, 0, 0], ['ubi-24p', 'Ubiquiti', 'USW-24-PoE', 24, 2, 16, 95],
  ['ubi-pro24p', 'Ubiquiti', 'USW-Pro-24-PoE', 24, 2, 24, 400, 1], ['ubi-48', 'Ubiquiti', 'USW-48', 48, 4, 0, 0], ['ubi-48p', 'Ubiquiti', 'USW-48-PoE', 48, 4, 32, 195], ['ubi-pro48p', 'Ubiquiti', 'USW-Pro-48-PoE', 48, 4, 48, 600, 1],
  ['ubi-agg', 'Ubiquiti', 'USW-Aggregation', 0, 8, 0, 0, 1],
  ['tpl-2210mp', 'TP-Link', 'TL-SG2210MP', 8, 2, 8, 150], ['tpl-1016pe', 'TP-Link', 'TL-SG1016PE', 16, 0, 8, 110], ['tpl-1024d', 'TP-Link', 'TL-SG1024D', 24, 0, 0, 0], ['tpl-2428p', 'TP-Link', 'TL-SG2428P', 24, 4, 24, 250],
  ['tpl-3428', 'TP-Link', 'TL-SG3428', 24, 4, 0, 0], ['tpl-3428mp', 'TP-Link', 'TL-SG3428MP', 24, 4, 24, 384], ['tpl-3452', 'TP-Link', 'TL-SG3452', 48, 4, 0, 0], ['tpl-3452p', 'TP-Link', 'TL-SG3452P', 48, 4, 48, 384],
  ['tpl-3008f', 'TP-Link', 'TL-SX3008F', 0, 8, 0, 0, 1],
  ['cis-1000-8p', 'Cisco', 'Catalyst C1000-8P-2G-L', 8, 2, 8, 67], ['cis-1000-24t', 'Cisco', 'Catalyst C1000-24T-4G-L', 24, 4, 0, 0], ['cis-1000-24p', 'Cisco', 'Catalyst C1000-24P-4G-L', 24, 4, 24, 195],
  ['cis-1000-48t', 'Cisco', 'Catalyst C1000-48T-4G-L', 48, 4, 0, 0], ['cis-1000-48p', 'Cisco', 'Catalyst C1000-48P-4G-L', 48, 4, 48, 370], ['cis-350-24p', 'Cisco', 'CBS350-24P-4G', 24, 4, 24, 195],
  ['cis-350-48p', 'Cisco', 'CBS350-48P-4G', 48, 4, 48, 370], ['cis-9200-24p', 'Cisco', 'Catalyst C9200L-24P-4G', 24, 4, 24, 370], ['cis-9200-48p', 'Cisco', 'Catalyst C9200L-48P-4G', 48, 4, 48, 370]];
for (const [id, marca, modelo, rj, sfp, poe, w, x] of MOD) CAT['sw-' + id] = { n: marca + ' ' + modelo, U: 1, rj, sfp, g: 'Switches de marca', marca, modelo, poe, w, x: !!x };
// patcheras y distribuidores de fibra de marca (Furukawa): [id, marca, modelo, bocas de cobre, U, categoría, fibras, conector]
const PPM = [['fk-gl6-24', 'Furukawa', 'Patch panel GigaLan Cat.6 24 bocas', 24, 1, 'Cat 6'], ['fk-gl6-48', 'Furukawa', 'Patch panel GigaLan Cat.6 48 bocas', 48, 2, 'Cat 6'],
  ['fk-gl6a-24', 'Furukawa', 'Patch panel GigaLan Augmented Cat.6A 24 bocas', 24, 1, 'Cat 6A'], ['fk-sp6-24', 'Furukawa', 'Patch panel Sohoplus Cat.6 24 bocas', 24, 1, 'Cat 6'], ['fk-ml5-24', 'Furukawa', 'Patch panel MultiLan Cat.5e 24 bocas', 24, 1, 'Cat 5e'],
  ['fk-dio-sc12', 'Furukawa', 'DIO 1U 12 fibras SC', 0, 1, '', 12, 'SC'], ['fk-dio-lc24', 'Furukawa', 'DIO 1U 24 fibras LC', 0, 1, '', 24, 'LC']];
for (const [id, marca, modelo, rj, U, cat, fo, con] of PPM) CAT['pp-' + id] = Object.assign({ n: marca + ' ' + modelo, U, g: 'Patcheras', marca, modelo, cat }, rj ? { rj, pp: true } : { fo, con });
// accesorios de rack de VF Networking (proveedor en Uruguay): se dibujan como su tipo genérico (base)
for (const [id, n, base, g] of [['vf-pdu9', 'PDU 9 tomas schuko en línea 19"', 'pdu', 'Orden y energía'], ['vf-pdu8u', 'PDU 8 tomas universales 19"', 'pdu', 'Orden y energía'], ['vf-pdu6t', 'PDU 6 tomas schuko con llave térmica 19"', 'pdu', 'Orden y energía']])
  CAT['ac-' + id] = { n: 'VF Networking ' + n, U: 1, g, marca: 'VF Networking', modelo: n, base };
// racks y gabinetes más usados (para «Marca y modelo» del rack: al elegir uno se ajusta el tamaño)
const RACKS = ['VF Networking piso 42U 600×1000 puerta vidrio', 'VF Networking piso 32U 600×1000 puerta vidrio', 'VF Networking piso 27U 600×1000 puerta vidrio', 'VF Networking piso 27U 800×1000 puertas hiperventiladas', 'VF Networking piso 22U 600×800 puerta vidrio', 'VF Networking piso 22U 600×600 puertas hiperventiladas',
  'VF Networking pared 15U puerta vidrio', 'VF Networking pared 9U fijo 600×600 con PDU 6 tomas', 'VF Networking exterior galvanizado 9U 600×600 IP66', 'VF Networking 4U fijo 12"', 'Furukawa rack de piso 44U', 'Gabinete metálico de pared 6U', 'Gabinete metálico de pared 12U'];
// cajas de fibra para el otro extremo de una fibra (cuando no termina en un rack)
const CAJAS = ['Caja de empalme', 'Caja FTTH 16 hilos', 'Caja FTTH 4 hilos', 'Caja FTTH 2 hilos', 'Caja FTTH 1 hilo', 'Caja exterior IP65 2 hilos', 'Caja exterior IP65 4 hilos', 'Roseta óptica', 'ODF del proveedor (UTE / Antel)', 'Cámara de registro'];
const MARCAS = [...new Set(MOD.map(m => m[1]))];
const modTxt = K => K.pp ? `${K.rj} bocas · ${K.cat}${K.U > 1 ? ' · ' + K.U + 'U' : ''}` : K.fo ? `${K.fo} fibras ${K.con}` : [K.rj ? K.rj + ' puertos' : '', K.sfp ? K.sfp + (K.x ? ' SFP+' : ' SFP') : '', K.poe ? (K.poe === K.rj ? 'todos PoE' : K.poe + ' PoE') + ' · ' + K.w + ' W' : K.rj ? 'sin PoE' : ''].filter(Boolean).join(' · ');
// buscador: «cisco 24 poe», «48», «usw pro», «simple» (sin PoE), «fibra» (solo SFP)
function modBusca(q, marca) { const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  return Object.keys(CAT).filter(k => { const K = CAT[k]; if (!K.marca || K.pp || K.fo || (marca && K.marca !== marca)) return false; const t = (K.n + ' ' + K.rj + ' ' + (K.poe ? 'poe' : 'simple') + (K.rj ? '' : ' fibra sfp') + (K.x ? ' 10g sfp+' : '')).toLowerCase(); return w.every(x => t.includes(x)); }); }
function modPick(V, r) { const L = modBusca(V.mq, V.mm);
  return `<div class="red-mp"><input data-r="mq" type="search" placeholder="Buscar: cisco 24 poe, usw 48, tl-sg…" value="${esc(V.mq || '')}" aria-label="Buscar modelo de switch" autocomplete="off">
    <div class="red-mm">${['', ...MARCAS].map(m => `<button data-r="mm" data-v="${esc(m)}" class="${(V.mm || '') === m ? 'on' : ''}">${m || 'Todas'}</button>`).join('')}</div>
    <div class="red-mres" data-mr="${r}">${modLista(L, r)}</div></div>`; }
const modLista = (L, r) => L.length ? `<ul class="red-ml">${L.map(k => `<li><button data-r="${r}" data-v="${k}"><b>${esc(CAT[k].n)}</b><span>${modTxt(CAT[k])}</span></button></li>`).join('')}</ul>` : '<p class="red-nada">No hay modelos con eso. Probá con menos palabras.</p>';
// miniatura del frente de cada componente (el mismo lenguaje que el dibujo grande)
function mini(k0) { const K = CAT[k0] || {}, k = K.base || k0, U = K.U || 1, W = 120, h = 16 * U, fondo = K.marca === 'Ubiquiti' ? '#D5DADE' : K.marca === 'Cisco' ? '#24364D' : (K.pp || K.fo || ['org', 'blank', 'shelf', 'odf', 'pdu'].includes(k)) ? '#1E2226' : '#30363C';
  let g = `<rect x="1" y="1" width="${W - 2}" height="${h - 2}" rx="2" fill="${fondo}" stroke="rgba(0,0,0,.35)"/>`; const tinta = K.marca === 'Ubiquiti' ? '#5B646C' : '#C9D1D8';
  const fila = (n, y, w, col) => { const paso = Math.min(4.2, 88 / Math.max(1, n)); for (let i = 0; i < n; i++) g += `<rect x="${22 + i * paso}" y="${y}" width="${Math.max(1.6, paso - 1)}" height="${w}" rx=".4" fill="${col}"/>`; };
  if (K.rj) { const n = Math.min(K.rj, 48), a = n > 24 ? Math.ceil(n / 2) : n; fila(a, h / 2 - (n > 24 ? 5 : 2.5), 4, tinta); if (n > 24) fila(n - a, h / 2 + 1, 4, tinta); }
  if (K.sfp) for (let i = 0; i < Math.min(K.sfp, 8); i++) g += `<rect x="${W - 22 + (i % 2) * 8}" y="${h / 2 - 5 + Math.floor(i / 2) * 5.5}" width="6" height="4" rx=".5" fill="none" stroke="${tinta}" stroke-width=".8"/>`;
  if (K.fo) for (let i = 0; i < Math.min(K.fo, 24); i++) g += `<circle cx="${24 + i * (80 / Math.min(K.fo, 24))}" cy="${h / 2}" r="1.6" fill="${K.con === 'LC' ? '#35C2C1' : '#2F6FD6'}"/>`;
  if (k === 'org') for (let i = 0; i < 6; i++) g += `<path d="M${20 + i * 15} ${h / 2 - 4}v4a3 3 0 0 0 6 0v-4" fill="none" stroke="#8D979F" stroke-width="1.2"/>`;
  if (k === 'pdu') for (let i = 0; i < 8; i++) g += `<rect x="${22 + i * 11}" y="${h / 2 - 3}" width="7" height="6" rx="1.5" fill="#0d0f11" stroke="#555d64" stroke-width=".6"/>`;
  if (k === 'ups') g += `<rect x="18" y="${h / 2 - 6}" width="24" height="12" rx="1.5" fill="#0f2a1e"/><text x="30" y="${h / 2 + 2.5}" font-size="6" text-anchor="middle" fill="#3DDC84">230V</text>` + Array.from({ length: 12 }, (_, i) => `<rect x="${55 + i * 4.6}" y="${h / 2 - 9}" width="2" height="18" fill="#141719"/>`).join('');
  if (k === 'shelf') g += `<rect x="12" y="${h - 6}" width="96" height="2" fill="#6a737b"/>`;
  if (k === 'odf') g += `<rect x="16" y="${h / 2 - 3}" width="88" height="6" rx="3" fill="none" stroke="#E6BE1E" stroke-width="1"/>`;
  if (['nvr', 'srv', 'gw', 'fw'].includes(k)) g += `<circle cx="12" cy="${h / 2}" r="1.6" fill="#3DDC84"/><rect x="${W - 40}" y="${h / 2 - 4}" width="26" height="8" rx="1" fill="#15181b"/>`;
  return `<svg viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" aria-hidden="true">${g}</svg>`; }
const GAL = [['', 'Todo'], ['Red', 'Red'], ['Switches de marca', 'Marcas'], ['Patcheras', 'Patcheras'], ['Equipos', 'Equipos'], ['Orden y energía', 'Orden y energía']];
// componentes: un solo buscador para todo (patcheras, organizadores, PDU, rosetas, switches de marca…); se arrastran al rack o se tocan
let galG = '';
function compBusca(q) { const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const L = Object.keys(CAT).filter(k => { const K = CAT[k], t = (K.n + ' ' + K.g + ' ' + (K.marca ? K.rj + ' ' + (K.poe ? 'poe' : 'simple') : '') + ' ' + k + (k === 'pdu' ? ' pdu zapatilla energia regleta' : '') + (k === 'ups' ? ' energia bateria' : '') + (k === 'odf' ? ' empalme fusion' : '') + (k === 'org' ? ' peine' : '') + (k === 'ros' ? ' roseta' : '')).toLowerCase(); return (galG ? K.g === galG : true) && (w.length ? w.every(x => t.includes(x)) : galG ? true : !K.marca); });
  return L.slice(0, 48); }
const compLista = L => L.length ? `<div class="red-gal">${L.map(k => `<button draggable="true" data-r="addc" data-v="${k}" title="Arrastralo al rack o tocalo">${mini(k)}<b>${esc(CAT[k].n)}</b><span>${CAT[k].marca ? modTxt(CAT[k]) : (CAT[k].U || 1) + 'U'}</span></button>`).join('')}</div>` : '<p class="red-nada">No hay componentes con eso.</p>';
const compPick = V => { galG = V.cg || ''; return `<div class="red-mp"><input data-r="cq" type="search" placeholder="Buscar: organizador, PDU, roseta, cisco 24 poe…" value="${esc(V.cq || '')}" aria-label="Buscar componente" autocomplete="off"><div class="red-mm">${GAL.map(([g, t]) => `<button data-r="cg" data-v="${esc(g)}" class="${(V.cg || '') === g ? 'on' : ''}">${t}</button>`).join('')}</div><div class="red-cres">${compLista(compBusca(V.cq))}</div><p class="red-ayuda">Arrastralo al lugar del rack donde va, o tocalo y queda en el primer lugar libre.</p></div>`; };
// poner un componente en una U (o en la más cercana libre)
function poner(H, V, tp, u0) { const c = H.cabs[V.cid], K = CAT[tp]; if (!c || !K) return false; let u = 0;
  const prueba = x => x >= 1 && entra(c, { type: tp }, x); if (u0 && prueba(u0)) u = u0; else if (u0) { for (let d = 1; d <= c.cap && !u; d++) { if (prueba(u0 - d)) u = u0 - d; else if (prueba(u0 + d)) u = u0 + d; } } else for (let x = 1; x + K.U - 1 <= c.cap && !u; x++) if (prueba(x)) u = x;
  if (!u) { H.aviso('No hay lugar: quitá un equipo o usá un rack más grande'); return false; }
  let n = 1; while (c.items.some(x => x.iid === tp + n)) n++; c.items.push(Object.assign({ iid: tp + n, type: tp, u }, K.marca ? { modelo: K.n } : {})); c.items.sort((x, y) => x.u - y.u); V.sel = null; V.mpick = false; H.aviso(K.n + ' en la U' + u + '. Tocalo para ponerle nombre, modelo y serie.'); return true; }
// cambiar el nombre en el mismo lugar: rack (título) o equipo (en el dibujo)
function renombrar(el, v) { const { H, V } = el.__red, c = H.cabs[V.cid]; if (!c || !H.editar()) return; const esR = v === 'rack', it = esR ? null : itemDe(c, v.slice(3)); if (!esR && !it) return;
  const ref = esR ? el.querySelector('.red-tt h3 span') : el.querySelector(`[data-nm="${CSS.escape(it.iid)}"]`); if (!ref) return; const r = ref.getBoundingClientRect(), base = el.getBoundingClientRect();
  const inp = document.createElement('input'); inp.className = 'red-ren'; inp.maxLength = 50; inp.value = esR ? (c.nombre || '') : (it.name || ''); inp.placeholder = esR ? 'Nombre del rack' : nomIt({ type: it.type });
  Object.assign(inp.style, { left: (r.left - base.left - 6) + 'px', top: (r.top - base.top - 6) + 'px', width: Math.max(220, r.width + 40) + 'px' }); el.style.position = el.style.position || 'relative'; el.appendChild(inp); inp.focus(); inp.select();
  let hecho = false; const fin = ok => { if (hecho) return; hecho = true; const val = inp.value.trim(); inp.remove(); if (!ok) return; if (esR) { if (val) c.nombre = val; else delete c.nombre; } else { if (val) it.name = val; else delete it.name; } H.guardar(); V._mismo = true; pintar(el, H, V); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }); inp.addEventListener('blur', () => fin(true)); inp.addEventListener('click', e => e.stopPropagation(), true); }
// arrastrar un componente desde la lista hasta una U del dibujo
function soltar(el) { const zona = () => el.querySelector('.red-svg'), uDe = (svg, y) => { const c = el.__red.H.cabs[el.__red.V.cid], r = svg.getBoundingClientRect(), k = (30 + c.cap * 56 + 30) / r.height; return Math.max(1, Math.min(c.cap, Math.floor(((y - r.top) * k - 30) / 56) + 1)); };
  let marca = null; const limpia = () => { if (marca) marca.remove(); marca = null; };
  el.addEventListener('dragstart', e => { const b = e.target.closest && e.target.closest('[data-r="addc"]'); if (!b) return; e.dataTransfer.setData('text/x-ondi-comp', b.dataset.v); e.dataTransfer.effectAllowed = 'copy'; el.__arrComp = b.dataset.v; });
  el.addEventListener('dragover', e => { const svg = zona(); if (!el.__arrComp || !svg || !svg.contains(e.target)) { limpia(); return; } e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const c = el.__red.H.cabs[el.__red.V.cid], K = CAT[el.__arrComp], u = uDe(svg, e.clientY), ok = entra(c, { type: el.__arrComp }, u);
    if (!marca) { marca = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); marca.setAttribute('class', 'r-dz'); marca.setAttribute('x', 46); marca.setAttribute('width', 608); marca.setAttribute('rx', 3); svg.appendChild(marca); }
    marca.setAttribute('y', 30 + (u - 1) * 56 + 1); marca.setAttribute('height', K.U * 56 - 2); marca.classList.toggle('no', !ok); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) limpia(); });
  el.addEventListener('dragend', () => { el.__arrComp = null; limpia(); });
  el.addEventListener('drop', e => { const svg = zona(), tp = el.__arrComp; limpia(); el.__arrComp = null; if (!svg || !tp || !svg.contains(e.target)) return; e.preventDefault(); const { H, V } = el.__red; if (!H.editar()) return; if (poner(H, V, tp, uDe(svg, e.clientY))) { H.guardar(); V._mismo = true; pintar(el, H, V); } }); }
const COL = { azul: ['Azul', '#2F6FD6'], gris: ['Gris', '#8D979F'], blanco: ['Blanco', '#E9ECEE'], amarillo: ['Amarillo', '#E6BE1E'], verde: ['Verde', '#2E9E5B'], rojo: ['Rojo', '#D2474B'], naranja: ['Naranja', '#E07A1F'], violeta: ['Violeta', '#8E5BD0'], negro: ['Negro', '#3A4046'], aqua: ['Aguamarina', '#35C2C1'] };
// colores de los hilos de fibra, norma TIA-598
const TIA = [['azul', '#2F6FD6'], ['naranja', '#E07A1F'], ['verde', '#2E9E5B'], ['marrón', '#8A5A3C'], ['gris', '#8D979F'], ['blanco', '#EDEFF1'], ['rojo', '#D2474B'], ['negro', '#23272B'], ['amarillo', '#E6BE1E'], ['violeta', '#8E5BD0'], ['rosa', '#E58FB1'], ['aguamarina', '#35C2C1']];
const hiloCol = h => TIA[(h - 1) % 12];
const hiloTxt = (h, F) => `hilo ${h} · ${hiloCol(h)[0]}${F && F.hilos > 12 ? ' · tubo ' + Math.ceil(h / 12) : ''}`;
const CATS = ['Cat 5e', 'Cat 6', 'Cat 6A', 'Cat 7', 'Coaxial', 'Otro'];
const POE = { af: '802.3af · 15 W', at: '802.3at · 30 W', bt60: '802.3bt · 60 W', bt90: '802.3bt · 90 W', pas: 'Pasivo 24 V' };
const VEL = ['100 M', '1 G', '2,5 G', '10 G'];
const CERT = { ok: 'Aprobado', falla: 'Falló' };
const FTIPO = { os2: ['Monomodo OS2 (9/125)', 'amarillo'], om3: ['Multimodo OM3 (50/125)', 'aqua'], om4: ['Multimodo OM4 (50/125)', 'aqua'], om2: ['Multimodo OM2 (50/125)', 'naranja'] };
const FCON = { 'lc-upc': 'LC/UPC', 'lc-apc': 'LC/APC', 'sc-upc': 'SC/UPC', 'sc-apc': 'SC/APC' };
const FTEND = ['Aéreo', 'Ducto', 'Bandeja', 'Enterrada'];
const PIEL = { plata: 'Plata', grafito: 'Grafito', azul: 'Azul oscuro', negro: 'Negro' };
const EST = { ok: 'en línea', warn: 'atención', crit: 'sin señal' };

/* ---------- datos ---------- */
const puertos = type => { const c = CAT[type] || {}, out = []; for (let i = 1; i <= (c.rj || 0); i++) out.push({ id: 'p' + i, k: 'rj', n: i }); for (let i = 1; i <= (c.sfp || 0); i++) out.push({ id: 's' + i, k: 'sfp', n: i }); for (let i = 1; i <= (c.fo || 0); i++) out.push({ id: 'f' + i, k: 'fo', n: i }); return out; };
const itemDe = (c, iid) => c && c.items.find(x => x.iid === iid);
const esPP = it => !!(it && CAT[it.type] && (CAT[it.type].pp || CAT[it.type].fo));
const esSW = it => !!(it && CAT[it.type] && (CAT[it.type].rj || CAT[it.type].sfp) && !CAT[it.type].pp && !['nvr', 'srv'].includes(it.type));
const tb = it => (it && CAT[it.type] && CAT[it.type].base) || (it && it.type);
const nomIt = it => it ? (it.name || (CAT[it.type] || {}).n || it.type) : '—';
const nomP = (it, pid) => (pid[0] === 's' ? 'SFP ' : esPP(it) ? 'boca ' : 'puerto ') + pid.slice(1);
const pd = (c, iid, pid, crear) => { if (crear) { const a = c.ports[iid] = c.ports[iid] || {}; return a[pid] = a[pid] || {}; } return ((c.ports[iid] || {})[pid]) || {}; };
// cobre con cobre, fibra con fibra (patchera de fibra y SFP): un patch cord de cobre no entra en un puerto de fibra
const medio = (c, iid, pid) => { const it = c.items.find(x => x.iid === iid), p = it ? puertos(it.type).find(x => x.id === pid) : null; return p ? (p.k === 'rj' ? 'cobre' : 'fibra') : ''; };
const noEntra = (c, a, b) => { const m1 = medio(c, a[0], a[1]), m2 = medio(c, b[0], b[1]); return m1 && m2 && m1 !== m2 ? (m1 === 'cobre' ? 'Ese puerto es de fibra: un patch cord de cobre no entra ahí' : 'Ese puerto es de cobre: va un patch cord de cobre, no uno de fibra') : ''; };
const lk = (c, iid, pid) => c.links.find(l => (l[0][0] === iid && l[0][1] === pid) || (l[1][0] === iid && l[1][1] === pid));
const otro = (l, iid, pid) => l[0][0] === iid && l[0][1] === pid ? l[1] : l[0];
const fibDe = (H, id) => H.fibs.find(f => f.id === id);
const fibCol = F => COL[(FTIPO[(F && F.tipo) || 'os2'] || FTIPO.os2)[1]][1];
const pcCol = (H, c, l) => { if (l[2] && l[2].col && COL[l[2].col]) return COL[l[2].col][1];
  for (const e of [l[0], l[1]]) { const f = pd(c, e[0], e[1]).fib; if (f) return fibCol(fibDe(H, f[0])); }
  return (l[0][1][0] === 'f' || l[1][1][0] === 'f' || (l[0][1][0] === 's' && l[1][1][0] === 's')) ? COL.amarillo[1] : COL.azul[1]; };
const mapaDevs = H => Object.fromEntries(H.devs().map(d => [d.id, d]));
const nomDev = d => d ? (d.nombre ? d.nombre + ' (' + d.id + ')' : d.id) : '';

/* recorrido completo de una boca: sigue patch cords, cables y fibras, también de un rack a otro */
function cadena(H, cid, iid, pid) {
  const visto = new Set([cid + '|' + iid + '|' + pid]), nodo = (a, b, c) => ({ t: 'p', cid: a, iid: b, pid: c });
  const andar = porPC => { const out = []; let cur = [cid, iid, pid], via = porPC;
    for (let n = 0; n < 40; n++) { const c = H.cabs[cur[0]]; if (!c) break;
      if (via) { const l = lk(c, cur[1], cur[2]); if (!l) break; const o = otro(l, cur[1], cur[2]), k = cur[0] + '|' + o[0] + '|' + o[1]; if (visto.has(k) || !itemDe(c, o[0])) break; visto.add(k);
        out.push({ t: 'pc', l, cid: cur[0] }, nodo(cur[0], o[0], o[1])); cur = [cur[0], o[0], o[1]]; via = false; continue; }
      const p = pd(c, cur[1], cur[2]);
      if (p.fib) { const F = fibDe(H, p.fib[0]); let far = null;
        for (const c2 in H.cabs) { const cc = H.cabs[c2]; for (const i2 in cc.ports) for (const p2 in cc.ports[i2]) { const f = cc.ports[i2][p2].fib; if (f && f[0] === p.fib[0] && f[1] === p.fib[1] && !(c2 === cur[0] && i2 === cur[1] && p2 === cur[2]) && itemDe(cc, i2)) far = [c2, i2, p2]; } }
        out.push({ t: 'fo', F, id: p.fib[0], hilo: p.fib[1] });
        if (!far) { out.push({ t: 'fin', txt: F ? 'sin conectar en ' + ((F.from === cur[0] ? F.to : F.from) || 'la otra punta') : 'fibra sin dibujar' }); break; }
        const k = far.join('|'); if (visto.has(k)) break; visto.add(k); out.push(nodo(far[0], far[1], far[2])); cur = far; via = true; continue; }
      if (p.dev || p.txt) out.push({ t: 'cb', p }, { t: 'eq', dev: p.dev || null, txt: p.txt || '' });
      break; }
    return out; };
  const a = andar(true), b = andar(false); let ch = [...a.reverse(), nodo(cid, iid, pid), ...b];
  // el equipo de la punta va último; si las dos puntas son puertos, se empieza por la boca elegida
  if (ch[0].t === 'eq' || ch[0].t === 'fin' || (!b.length && a.length && ch[ch.length - 1].t === 'p')) ch = ch.reverse();
  return ch; }
function estadoP(H, devs, cid, iid, pid) { const ch = cadena(H, cid, iid, pid), eq = ch.find(x => x.t === 'eq');
  if (eq && eq.dev) { const d = devs[eq.dev]; return d ? d.estado || 'ok' : 'uso'; } return ch.length > 1 ? 'uso' : ''; }

// enlaces de un switch que terminan en otro switch (por patch cord o por fibra, en este rack o en otro)
function subidas(H, cid, iid) { const c = H.cabs[cid], it = itemDe(c, iid), out = [], mio = x => x.t === 'p' && x.cid === cid && x.iid === iid; if (!it) return out;
  for (const p of puertos(it.type)) { let ch = cadena(H, cid, iid, p.id); if (ch.length < 3) continue; if (!mio(ch[0])) ch = ch.slice().reverse(); const fin = ch[ch.length - 1];
    if (!mio(ch[0]) || fin.t !== 'p' || mio(fin) || !esSW(itemDe(H.cabs[fin.cid], fin.iid))) continue; out.push({ ch, fin }); }
  return out; }
// árbol de la red: desde el firewall, el router o el switch principal hacia abajo. Devuelve, para cada switch, por dónde sube
function arbol(H) { const sw = []; for (const cid in H.cabs) for (const it of H.cabs[cid].items) if (esSW(it)) sw.push([cid, it]); if (!sw.length) return {};
  const pref = t => sw.find(x => x[1].type === t), raiz = pref('fw') || pref('gw') || pref('swc') || sw[0], padre = {}, cola = [raiz[0] + '|' + raiz[1].iid], visto = new Set(cola);
  while (cola.length) { const k = cola.shift(), [cid, iid] = k.split('|'); for (const s of subidas(H, cid, iid)) { const k2 = s.fin.cid + '|' + s.fin.iid; if (visto.has(k2)) { if (padre[k2] && padre[k2].de === k) padre[k2].n++; continue; }
      visto.add(k2); padre[k2] = { de: k, n: 1, ch: s.ch.slice().reverse() }; cola.push(k2); } }
  return padre; }
function alPrincipal(H, cid, iid) { const P = arbol(H), out = []; let k = cid + '|' + iid; while (P[k] && out.length < 6) { out.push(P[k]); k = P[k].de; } return out; }

/* ---------- frente del rack ---------- */
const LED = { crit: '#F0464C', warn: '#F2B01E', ok: '#3DDC84', uso: '#2FAE6A', '': '#2b3035' };
const pielDe = it => it.piel && PIEL[it.piel] ? it.piel : /usw|unifi|udm|ucg|ubiquiti|u7|u6/i.test((it.modelo || '') + ' ' + (it.name || '')) ? 'plata' : /cisco|catalyst|cbs|forti/i.test((it.modelo || '') + ' ' + (it.name || '')) ? 'azul' : (esPP(it) || ['org', 'blank', 'shelf', 'odf', 'pdu'].includes(tb(it))) ? 'negro' : 'grafito';
const gP = (o, extra) => `<g data-rp="${o.id}" class="r-p${o.on ? ' on' : ''}${o.hot ? ' hot' : ''}${o.st === 'crit' ? ' crit' : ''}${extra || ''}"><title>${esc(o.tip)}</title>`;
function jack(x, y, w, up, o) { const h = 12, d = up ? `M${x} ${y + 2.4}h${(w - 5.6) / 2}v-2.4h5.6v2.4h${(w - 5.6) / 2}v${h - 2.4}h-${w}z` : `M${x} ${y}h${w}v${h - 2.4}h-${(w - 5.6) / 2}v2.4h-5.6v-2.4h-${(w - 5.6) / 2}z`;
  let s = gP(o) + `<rect x="${x - 1.5}" y="${y - 2}" width="${w + 3}" height="${h + 4}" class="r-hit"/><path d="${d}" class="r-jk"/>`;
  s += o.plug ? `<rect x="${x + 2.4}" y="${y + (up ? 3.4 : 1.4)}" width="${w - 4.8}" height="${h - 4.8}" rx="1.2" fill="${o.plug}" class="r-plug"/><rect x="${x + 4.2}" y="${y + (up ? 5 : 3)}" width="${w - 8.4}" height="1.8" rx=".6" fill="rgba(255,255,255,.55)"/>`
    : `<rect x="${x + 3}" y="${y + (up ? h - 3.6 : 2)}" width="${w - 6}" height="1.4" fill="#a98a48" opacity=".75"/>`;
  s += `<rect x="${x + .7}" y="${up ? y + h - 2.1 : y + .5}" width="2.8" height="1.6" rx=".5" fill="${LED[o.st] || LED['']}" class="r-led"/>`;
  if (o.poe != null) s += `<rect x="${x + w - 3.5}" y="${up ? y + h - 2.1 : y + .5}" width="2.8" height="1.6" rx=".5" fill="${o.poe ? '#F2B01E' : '#2b3035'}"/>`;
  return s + '</g>'; }
function sfp(x, y, o) { const w = 16, h = 10; let s = gP(o) + `<rect x="${x - 1.5}" y="${y - 3.5}" width="${w + 3}" height="${h + 5}" class="r-hit"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" class="r-sfp"/>`;
  if (o.plug) s += `<rect x="${x + 1.4}" y="${y + 1.4}" width="${w - 2.8}" height="${h - 2.8}" rx=".8" fill="#c9cfd4"/><circle cx="${x + 5.3}" cy="${y + 4.6}" r="1.7" fill="#15181b"/><circle cx="${x + 10.7}" cy="${y + 4.6}" r="1.7" fill="#15181b"/><rect x="${x + 1.4}" y="${y + h - 2.6}" width="${w - 2.8}" height="1.3" fill="${o.plug}"/>`;
  return s + `<rect x="${x + w / 2 - 1.5}" y="${y - 2.8}" width="3" height="1.5" rx=".5" fill="${LED[o.st] || LED['']}" class="r-led"/></g>`; }
function boca(cx, cy, o) { let s = gP(o, ' fo') + `<rect x="${cx - 6}" y="${cy - 7}" width="12" height="14" class="r-hit"/>`;
  s += o.plug ? `<rect x="${cx - 3.3}" y="${cy - 3.3}" width="6.6" height="6.6" rx="1.3" fill="${o.plug}" class="r-plug"/><circle cx="${cx}" cy="${cy}" r="1.1" fill="#fff" opacity=".85"/>`
    : o.usado ? `<circle cx="${cx}" cy="${cy}" r="2.7" fill="#0d0f11"/><circle cx="${cx}" cy="${cy}" r="1" fill="#e9ecee"/>` : `<circle cx="${cx}" cy="${cy}" r="2.9" fill="#dfe3e6" opacity=".8"/>`;
  if (o.hilo) s += `<rect x="${cx - 3}" y="${cy + 6.4}" width="6" height="1.8" rx=".6" fill="${o.hilo}"/>`;
  return s + '</g>'; }

function frente(H, V) { const c = H.cabs[V.cid], UH = 56, W = 700, top = 30, HH = top + c.cap * UH + 30, X0 = 46, X1 = 654, F0 = 70, F1 = 630;
  const devs = mapaDevs(H), pos = {}, ch = V.sel && V.sel[1] ? cadena(H, V.cid, V.sel[0], V.sel[1]) : [];
  const hot = new Set(ch.filter(x => x.t === 'p' && x.cid === V.cid).map(x => x.iid + ':' + x.pid));
  let s = `<svg viewBox="0 0 ${W} ${HH}" class="red-svg${ch.length > 1 ? ' sel' : ''}${H.editar() ? ' ed' : ''}" style="${V.fit ? 'height:100%;width:auto' : 'width:' + Math.round((V.zoom || 1) * 100) + '%'}" role="img" aria-label="Frente del rack ${esc(V.cid)}">
    <defs><linearGradient id="rg-plata" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF1F3"/><stop offset="1" stop-color="#CBD1D6"/></linearGradient><linearGradient id="rg-grafito" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A4148"/><stop offset="1" stop-color="#262B30"/></linearGradient><linearGradient id="rg-azul" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C4A60"/><stop offset="1" stop-color="#1D3345"/></linearGradient><linearGradient id="rg-negro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23272B"/><stop offset="1" stop-color="#15181B"/></linearGradient></defs>
    <rect x="4" y="4" width="${W - 8}" height="${HH - 8}" rx="10" class="r-marco"/><rect x="14" y="${top - 10}" width="${W - 28}" height="${c.cap * UH + 20}" rx="3" class="r-fondo"/>
    <rect x="16" y="${top - 6}" width="28" height="${c.cap * UH + 12}" class="r-riel"/><rect x="${W - 44}" y="${top - 6}" width="28" height="${c.cap * UH + 12}" class="r-riel"/>`;
  for (let u = 1; u <= c.cap; u++) { const y = top + (u - 1) * UH; s += `<text x="25" y="${y + UH / 2 + 3}" class="r-u">${u}</text><text x="${W - 25}" y="${y + UH / 2 + 3}" class="r-u">${u}</text>`;
    for (const dy of [9, 28, 47]) s += `<rect x="35" y="${y + dy - 2.5}" width="5" height="5" class="r-ag"/><rect x="${W - 40}" y="${y + dy - 2.5}" width="5" height="5" class="r-ag"/>`; }
  const P = (it, p, extra) => { const id = it.iid + ':' + p.id, inf = pd(c, it.iid, p.id), l = lk(c, it.iid, p.id), st = estadoP(H, devs, V.cid, it.iid, p.id), d = inf.dev && devs[inf.dev];
    const plug = l ? pcCol(H, c, l) : (inf.dev || inf.txt) && !esPP(it) ? (COL[inf.col] || COL.azul)[1] : '';
    let tip = nomIt(it) + ' · ' + nomP(it, p.id); if (inf.cab) tip += ' · cable ' + inf.cab; if (d) tip += ' · ' + nomDev(d); else if (inf.txt) tip += ' · ' + inf.txt; if (inf.fib) tip += ' · ' + inf.fib[0] + ' ' + hiloTxt(inf.fib[1]);
    return Object.assign({ id, st, plug, tip, on: !!(V.sel && V.sel[0] === it.iid && V.sel[1] === p.id), hot: hot.has(id), inf }, extra); };
  for (const it of c.items) { const K = CAT[it.type]; if (!K) continue; const y = top + (it.u - 1) * UH, h = K.U * UH - 3, pl = pielDe(it), claro = pl === 'plata', tx = claro ? '#39424a' : '#d5dbe0', tx2 = claro ? '#6b757d' : '#8f9aa3';
    const PS = puertos(it.type), sel = V.sel && V.sel[0] === it.iid && !V.sel[1];
    s += `<g data-it="${it.iid}" class="r-it${sel ? ' on' : ''}"><rect x="${X0}" y="${y + 1.5}" width="${X1 - X0}" height="${h}" rx="2.5" fill="url(#rg-${pl})" class="r-cara"/>`;
    for (const ex of [X0 + 12, X1 - 12]) for (const ey of [y + 12, y + h - 9]) s += `<ellipse cx="${ex}" cy="${ey}" rx="4.4" ry="2.9" class="r-tor"/>`;
    s += `<line x1="${F0}" x2="${F0}" y1="${y + 3}" y2="${y + h}" class="r-pli"/><line x1="${F1}" x2="${F1}" y1="${y + 3}" y2="${y + h}" class="r-pli"/>`;
    const nombre = (x, yy, n1) => { n1 = n1 || 16; const nm = nomIt(it); let a = nm, b = ''; if (nm.length > n1) { const i = nm.lastIndexOf(' ', n1); a = nm.slice(0, i > 4 ? i : n1); b = nm.slice(a.length).trim(); }
      return (H.editar() ? `<g class="r-pen" data-r="ren" data-v="it:${it.iid}" transform="translate(${x - 15} ${yy - 9})"><title>Cambiar el nombre</title><rect width="12" height="12" rx="2.5"/><path d="M3 9.5h1.8L9.6 4.7 7.8 2.9 3 7.7z"/></g>` : '') + `<text x="${x}" y="${yy}" class="r-n" fill="${tx}" data-nm="${it.iid}">${esc(a)}</text>` + (b ? `<text x="${x}" y="${yy + 10}" class="r-n" fill="${tx}">${esc(corto(b, n1))}</text>` : `<text x="${x}" y="${yy + 10}" class="r-m" fill="${tx2}">${esc(corto(it.modelo || (it.name ? K.n : ''), 22))}</text>`); };
    if (K.pp) { // patchera de cobre: bocas numeradas y tira de etiquetas
      s += `<text x="${F0 + 6}" y="${y + 9.5}" class="r-m" fill="${tx2}">${esc(corto(nomIt(it), 40))}</text>`;
      PS.forEach((p, k) => { const row = Math.floor(k / 24), col = k % 24, x = F0 + 17 + col * 22 + Math.floor(col / 6) * 2.4, yy = y + row * UH + 19, o = P(it, p), et = o.inf.cab || (o.inf.dev ? o.inf.dev : '');
        s += `<text x="${x + 7.5}" y="${yy - 2.2}" class="r-num" fill="${tx2}">${p.n}</text>` + jack(x, yy, 15, true, o) + `<rect x="${x - 2.5}" y="${yy + 15}" width="20" height="9" rx="1" class="r-etq"/><text x="${x + 7.5}" y="${yy + 21.6}" class="r-et">${esc(corto(et, 7))}</text>`;
        pos[o.id] = [x + 7.5, yy + 6]; }); }
    else if (K.fo) { const lc = K.con === 'LC', n = K.fo, pares = lc ? n / 2 : n, paso = Math.min(lc ? 40 : 36, (F1 - F0 - 150) / pares), xa = tb(it) === 'ros' ? F0 + 150 : F0 + 132;
      s += nombre(F0 + 8, y + 22, 18);
      for (let a = 0; a < pares; a++) { const x = xa + a * paso, ids = lc ? [PS[a * 2], PS[a * 2 + 1]] : [PS[a]], w = lc ? 27 : 17, f0 = pd(c, it.iid, ids[0].id).fib, F = f0 && fibDe(H, f0[0]), con = (F && F.con) || '';
        const cuerpo = /apc/.test(con) ? '#2E9E5B' : F && /^om[34]/.test(F.tipo || '') ? '#35C2C1' : F && F.tipo === 'om2' ? '#C9B79A' : '#2F6FD6';
        s += `<rect x="${x}" y="${y + 17}" width="${w}" height="17" rx="1.6" fill="${cuerpo}" class="r-ada"/><text x="${x + w / 2}" y="${y + 14}" class="r-num" fill="${tx2}">${lc ? (a * 2 + 1) + '·' + (a * 2 + 2) : a + 1}</text>`;
        ids.forEach((p, j) => { const o = P(it, p), cx = x + (lc ? 7.5 + j * 12 : w / 2), cy = y + 25.5; o.usado = !!o.inf.fib; o.hilo = o.inf.fib ? hiloCol(o.inf.fib[1])[1] : ''; s += boca(cx, cy, o); pos[o.id] = [cx, cy]; }); } }
    else if (K.rj || K.sfp) { const sw = esSW(it), rj = K.rj || 0, rows = sw && rj >= 16 ? 2 : 1, cols = rj / rows, PA = rj >= 48 ? 15.5 : 17, jw = PA - 3, x0p = sw ? F0 + (rj >= 48 ? 86 : 108) : F1 - 20 - cols * PA;
      s += nombre(F0 + 8, y + 21, rj >= 48 ? 11 : 14) + `<circle cx="${F0 + 10.5}" cy="${y + 42}" r="1.9" fill="#3DDC84"/><text x="${F0 + 15.5}" y="${y + 44}" class="r-num" style="text-anchor:start" fill="${tx2}">PWR</text>`;
      if (tb(it) === 'nvr' || tb(it) === 'srv') { for (let b = 0; b < 4; b++) s += `<rect x="${F0 + 130 + b * 84}" y="${y + 10}" width="76" height="${h - 20}" rx="2" class="r-bahia"/><circle cx="${F0 + 138 + b * 84}" cy="${y + h - 16}" r="1.4" fill="#3DDC84"/>`; }
      if (tb(it) === 'gw' || tb(it) === 'fw') s += `<rect x="${F0 + 96}" y="${y + 14}" width="44" height="24" rx="2.5" class="r-lcd"/><text x="${F0 + 118}" y="${y + 29}" class="r-num" fill="#7fd7e6">${tb(it) === 'fw' ? 'FW' : 'WAN'}</text>`;
      let xr = x0p + (tb(it) === 'gw' || tb(it) === 'fw' ? 56 : 0), xfin = xr;
      PS.filter(p => p.k === 'rj').forEach((p, k) => { const col = rows === 2 ? Math.floor(k / 2) : k, up = rows === 2 ? k % 2 === 0 : true, x = xr + col * PA + (cols >= 12 ? Math.floor(col / 6) * 7 : 0), yy = rows === 2 ? (up ? y + 12 : y + 29) : y + 21, o = P(it, p);
        if (sw) o.poe = o.inf.poe ? 1 : 0;
        s += `<text x="${x + jw / 2}" y="${up ? yy - 2.4 : yy + 18.4}" class="r-num" fill="${tx2}">${p.n}</text>` + jack(x, yy, jw, up, o); pos[o.id] = [x + jw / 2, yy + 6]; xfin = Math.max(xfin, x + jw); });
      const S = PS.filter(p => p.k === 'sfp'), sr = S.length >= 4 ? 2 : 1, xs = rj ? xfin + 14 : F0 + 122;
      S.forEach((p, k) => { const col = sr === 2 ? Math.floor(k / 2) : k, r = sr === 2 ? k % 2 : 0, x = xs + col * (S.length > 4 ? 30 : 21), yy = sr === 2 ? (r ? y + 32 : y + 14) : y + 23, o = P(it, p);
        const f = o.inf.fib || (lk(c, it.iid, p.id) ? (pd(c, otro(lk(c, it.iid, p.id), it.iid, p.id)[0], otro(lk(c, it.iid, p.id), it.iid, p.id)[1]).fib) : null); if (o.plug && f) o.plug = fibCol(fibDe(H, f[0]));
        s += sfp(x, yy, o) + (S.length > 4 ? `<text x="${x + 22}" y="${yy + 7.5}" class="r-num" fill="${tx2}">${p.n}</text>` : ''); pos[o.id] = [x + 8, yy + 5]; });
      if (S.length && S.length <= 4) s += `<text x="${xs + (sr === 2 ? S.length / 2 : S.length) * 10.5 - 2.5}" y="${y + 9.5}" class="r-num" fill="${tx2}">SFP</text>`; }
    else { s += nombre(F0 + 8, y + (K.U > 1 ? 24 : 22), 20);
      if (tb(it) === 'org') for (let k = 0; k < 6; k++) s += `<path d="M${F0 + 150 + k * 76} ${y + 12}h34a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7h-34" class="r-aro"/>`;
      if (tb(it) === 'ups') s += `<rect x="${F0 + 150}" y="${y + 22}" width="92" height="${h - 44}" rx="3" class="r-lcd"/><text x="${F0 + 196}" y="${y + h / 2 + 4}" class="r-n" fill="#7fd7e6" style="text-anchor:middle">230 V · 100%</text>` + Array.from({ length: 22 }, (_, k) => `<rect x="${F0 + 270 + k * 12}" y="${y + 16}" width="5" height="${h - 32}" rx="2" class="r-rej"/>`).join('');
      if (tb(it) === 'pdu') s += Array.from({ length: 8 }, (_, k) => `<circle cx="${F0 + 190 + k * 46}" cy="${y + h / 2 + 1}" r="12" class="r-toma"/><circle cx="${F0 + 185 + k * 46}" cy="${y + h / 2 + 1}" r="1.8" fill="#0d0f11"/><circle cx="${F0 + 195 + k * 46}" cy="${y + h / 2 + 1}" r="1.8" fill="#0d0f11"/>`).join('') + `<rect x="${F0 + 128}" y="${y + 17}" width="18" height="20" rx="2" fill="#D2474B"/>`;
      if (tb(it) === 'odf') s += `<rect x="${F0 + 150}" y="${y + 12}" width="${F1 - F0 - 170}" height="${h - 24}" rx="3" class="r-bahia"/><path d="M${F0 + 190} ${y + h / 2}c40-22 80 22 120 0s80-22 120 0 80 22 120 0" class="r-aro" style="stroke:#E6BE1E"/>`;
      if (tb(it) === 'shelf') s += `<rect x="${F0 + 150}" y="${y + h - 16}" width="${F1 - F0 - 170}" height="6" rx="2" class="r-bahia"/>`; }
    s += '</g>'; }
  c.links.forEach((l, li) => { const a = pos[l[0].join(':')], b = pos[l[1].join(':')]; if (!a || !b) return; const on = hot.has(l[0].join(':')) && hot.has(l[1].join(':')), d = curva(a, b);
    s += `<path d="${d}" class="r-pc0${on ? ' on' : ''}" data-li="${li}"/><path d="${d}" class="r-pc${on ? ' on' : ''}" data-li="${li}" stroke="${pcCol(H, c, l)}"/>`; });
  V._pos = pos; return s + '</svg>'; }
// la curva de un patch cord que cuelga entre dos puertos
const curva = (a, b) => { const my = Math.max(a[1], b[1]) + 15 + Math.min(40, Math.abs(a[0] - b[0]) * 0.1 + Math.abs(a[1] - b[1]) * 0.2); return `M${a[0]} ${a[1]} C ${a[0]} ${my}, ${b[0]} ${my}, ${b[0]} ${b[1]}`; };

/* ---------- panel de la derecha ---------- */
const opt = (v, t, cur) => `<option value="${esc(v)}" ${String(cur || '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
const campo = (t, h, cls) => `<label class="red-f ${cls || ''}"><span>${t}</span>${h}</label>`;
const inp = (o, k, v, extra) => `<input data-r="set" data-o="${o}" data-k="${k}" value="${esc(v == null ? '' : v)}" ${extra || ''}>`;
const sel = (o, k, cur, ops, vacio) => `<select data-r="set" data-o="${o}" data-k="${k}">${vacio != null ? opt('', vacio, cur) : ''}${ops.map(([v, t]) => opt(v, t, cur)).join('')}</select>`;
const fila = (k, v) => `<div class="red-row"><dt>${k}</dt><dd>${v}</dd></div>`;
const colSel = (o, cur) => sel(o, 'col', cur, Object.entries(COL).map(([k, v]) => [k, v[0]]), 'Sin anotar');

function pasos(H, V, ch) { const devs = mapaDevs(H);
  return `<ol class="red-ch">${ch.map(x => {
    if (x.t === 'p') { const c = H.cabs[x.cid], it = itemDe(c, x.iid), yo = V.sel && x.cid === V.cid && x.iid === V.sel[0] && x.pid === V.sel[1];
      return `<li class="p${yo ? ' yo' : ''}"><a href="#" data-r="ver" data-v="${esc(x.cid + '|' + x.iid + '|' + x.pid)}"><small>${esc(x.cid)}</small>${esc(nomIt(it))} · <b>${nomP(it, x.pid)}</b></a></li>`; }
    if (x.t === 'pc') { const c = H.cabs[x.cid], m = x.l[2] && x.l[2].m; return `<li class="e"><i style="background:${pcCol(H, c, x.l)}"></i>patch cord${m ? ' · ' + dec(m) + ' m' : ''}</li>`; }
    if (x.t === 'fo') { const F = x.F, m = F && H.largo ? H.largo(F) : 0, db = F && F.db && F.db[x.hilo]; return `<li class="e"><i style="background:${hiloCol(x.hilo)[1]}"></i>fibra <a href="#" data-r="ir" data-v="${esc(x.id)}">${esc(x.id)}</a> · ${hiloTxt(x.hilo, F)}${F && F.tipo ? ' · ' + esc(FTIPO[F.tipo][0].split(' (')[0].toLowerCase()) : ''}${m ? ' · ' + m + ' m' : ''}${db != null ? ' · ' + String(db).replace('.', ',') + ' dB' : ''}</li>`; }
    if (x.t === 'cb') { const p = x.p; return `<li class="e"><i style="background:${(COL[p.col] || ['', 'var(--muted,#667)'])[1]}"></i>cable${p.cab ? ' <b>' + esc(p.cab) + '</b>' : ''}${p.cat ? ' · ' + esc(p.cat) : ''}${p.m ? ' · ' + esc(p.m) + ' m' : ''}${p.cert ? ` · <span class="${p.cert === 'ok' ? 't-ok' : 't-crit'}">${CERT[p.cert].toLowerCase()}</span>` : ''}</li>`; }
    if (x.t === 'eq') { const d = x.dev && devs[x.dev]; return `<li class="q ${d ? d.estado || 'ok' : ''}">${x.dev ? `<a href="#" data-r="ir" data-v="${esc(x.dev)}">${esc(nomDev(d) || x.dev)}</a>${d && d.lugar ? ' · ' + esc(d.lugar) : ''}${d ? ` · <span class="t-${d.estado || 'ok'}">${EST[d.estado || 'ok']}</span>` : ''}` : esc(x.txt)}</li>`; }
    return `<li class="q off">${esc(x.txt)}</li>`; }).join('')}</ol>`; }

function lado(H, V) { const c = H.cabs[V.cid], ed = H.editar(), devs = mapaDevs(H);
  if (V.sel && V.sel[1]) { const [iid, pid] = V.sel, it = itemDe(c, iid); if (!it) return ''; const p = pd(c, iid, pid), l = lk(c, iid, pid), ch = cadena(H, V.cid, iid, pid), fo = pid[0] === 'f';
    const cable = !fo && (esPP(it) || !l || !esPP(itemDe(c, otro(l, iid, pid)[0])));   // el cable hacia el equipo sale de esta boca
    let h = `<div class="red-h"><small>${esc(nomIt(it))}</small><b>${may(nomP(it, pid))}</b></div><div class="red-sec">Recorrido</div>${ch.length > 1 ? pasos(H, V, ch) : '<p class="red-nada">Libre: todavía no tiene nada conectado.</p>'}`;
    const swn = ch.find(x => x.t === 'p' && esSW(itemDe(H.cabs[x.cid], x.iid))), dosSw = ch.filter(x => x.t === 'p' && esSW(itemDe(H.cabs[x.cid], x.iid))).length > 1, sube = swn && !dosSw ? alPrincipal(H, swn.cid, swn.iid) : [];
    if (sube.length) h += `<div class="red-sec">Sube al rack principal por</div>` + sube.map(s => pasos(H, V, s.ch) + (s.n > 1 ? `<p class="red-ayuda">Este switch tiene ${s.n} enlaces hacia arriba (redundancia).</p>` : '')).join('');
    if (!ed) { const d = []; if (p.desc) d.push(fila('Descripción', esc(p.desc))); if (p.vlan) d.push(fila('VLAN', esc(p.vlan))); if (p.poe) d.push(fila('PoE', POE[p.poe])); if (p.vel) d.push(fila('Velocidad', esc(p.vel))); if (p.nota) d.push(fila('Nota', esc(p.nota))); if (p.certf) d.push(fila('Medido el', esc(p.certf)));
      return h + (d.length ? `<dl class="red-rows">${d.join('')}</dl>` : ''); }
    h += `<div class="red-sec">Patch cord</div><div class="red-g">${V.linking ? '<p class="red-ayuda on">Tocá el otro puerto en el dibujo para conectar el patch cord.</p><button class="red-b" data-r="nolink">Cancelar</button>' : `<p class="red-ayuda">También podés agarrar la punta del cable en el dibujo y soltarla en otro puerto.</p><button class="red-b" data-r="link">${l ? 'Cambiar de puerto' : 'Conectar con otro puerto'}</button>`}${l && !V.linking ? '<button class="red-b" data-r="unlink">Quitar</button>' : ''}</div>`;
    if (l) h += `<div class="red-g2">${campo('Color', colSel('l', l[2] && l[2].col))}${campo('Largo (m)', inp('l', 'm', dec(l[2] && l[2].m), 'inputmode="decimal" maxlength="6" placeholder="Ej.: 0,5"'))}</div>`;
    if (fo) { const F = p.fib && fibDe(H, p.fib[0]);
      h += `<div class="red-sec">Fibra que llega a esta boca</div><div class="red-g2">${campo('Fibra', sel('fo', 'fib', p.fib && p.fib[0], H.fibs.map(f => [f.id, f.id + ' · ' + f.hilos + ' hilos' + (f.nombre ? ' · ' + f.nombre : '')]), 'Ninguna'))}
        ${p.fib ? campo('Hilo', sel('fo', 'hilo', p.fib[1], Array.from({ length: F ? F.hilos : 12 }, (_, i) => [i + 1, (i + 1) + ' · ' + hiloCol(i + 1)[0]]))) : ''}
        ${p.fib && F ? campo('Pérdida medida (dB)', inp('fo', 'db', dec(F.db && F.db[p.fib[1]]), 'inputmode="decimal" maxlength="6" placeholder="Ej.: 0,35"')) : ''}</div>`; }
    if (cable) h += `<div class="red-sec">Cable hacia el equipo</div>${campo('Equipo conectado', sel('p', 'dev', p.dev, H.devs().map(d => [d.id, (d.nombre ? d.nombre + ' · ' : '') + d.id + (d.lugar ? ' · ' + d.lugar : '')]), 'Ninguno'))}
      ${campo('Otro destino <small>(si no está en la maqueta)</small>', inp('p', 'txt', p.txt, 'maxlength="80" placeholder="Ej.: impresora de recepción"'))}
      <div class="red-g2">${campo('Etiqueta', inp('p', 'cab', p.cab, 'maxlength="30" placeholder="Ej.: C-045"'))}${campo('Metros', inp('p', 'm', p.m, 'type="number" min="0" step="1" inputmode="numeric"'))}
      ${campo('Categoría', sel('p', 'cat', p.cat, CATS.map(x => [x, x]), 'Sin anotar'))}${campo('Color', colSel('p', p.col))}
      ${campo('Certificación', sel('p', 'cert', p.cert, Object.entries(CERT), 'Sin medir'))}${campo('Fecha de la medición', inp('p', 'certf', p.certf, 'type="date"'))}</div>
      ${campo('Nota', inp('p', 'nota', p.nota, 'maxlength="120"'))}`;
    if (esSW(it) && !fo) h += `<div class="red-sec">Puerto del switch</div>${campo('Descripción', inp('p', 'desc', p.desc, 'maxlength="60" placeholder="Ej.: Cámaras andén norte"'))}
      <div class="red-g2">${campo('VLAN', inp('p', 'vlan', p.vlan, 'maxlength="30" placeholder="Ej.: 20 · CCTV"'))}${pid[0] === 'p' ? campo('PoE', sel('p', 'poe', p.poe, Object.entries(POE), 'Sin PoE')) : ''}${campo('Velocidad', sel('p', 'vel', p.vel, VEL.map(x => [x, x]), 'Automática'))}</div>`;
    return h; }
  if (V.sel) { const it = itemDe(c, V.sel[0]); if (!it) return ''; const K = CAT[it.type], PS = puertos(it.type), usados = PS.filter(p => cadena(H, V.cid, it.iid, p.id).length > 1).length, real = it.ext && H.reales ? H.reales().find(x => x.uid === it.ext) : null;
    let h = `<div class="red-h"><small>Equipo en ${esc(V.cid)}</small><b>${esc(nomIt(it))}</b></div><dl class="red-rows">${fila('Tipo', K.n)}${fila('Posición', 'U' + it.u + (K.U > 1 ? '–' + (it.u + K.U - 1) : ''))}${PS.length ? fila('Puertos usados', usados + ' de ' + PS.length) : ''}
      ${real ? fila('Estado', `<span class="red-pill ${real.estado}">${EST[real.estado] || 'sin dato'}</span>`) + (real.ip ? fila('IP', esc(real.ip)) : '') + (real.version ? fila('Firmware', esc(real.version)) : '') : ''}
      ${!ed ? (it.modelo ? fila('Modelo', esc(it.modelo)) : '') + (it.serie ? fila('N.º de serie', esc(it.serie)) : '') + (it.mac ? fila('MAC', `<span class="red-mono">${esc(it.mac)}</span>`) : '') + (it.ip ? fila('IP de gestión', esc(it.ip)) : '') + (it.nota ? fila('Nota', esc(it.nota)) : '') : ''}</dl>`;
    if (!ed) return h; const rs = H.reales ? H.reales() : [];
    const swM = esSW(it) && !['gw', 'fw'].includes(it.type);
    return h + `${swM ? `<div class="red-sec">Modelo</div>${K.marca ? `<p class="red-mod"><b>${esc(K.n)}</b><span>${modTxt(K)}</span></p>` : '<p class="red-ayuda">Elegí la marca y el modelo: así quedan los puertos, los SFP y el PoE reales.</p>'}${V.mpick ? modPick(V, 'setm') : `<div class="red-g"><button class="red-b${K.marca ? '' : ' pri'}" data-r="mpick">${K.marca ? 'Cambiar de modelo' : 'Elegir modelo'}</button></div>`}` : ''}
      ${campo('Nombre', inp('it', 'name', it.name, 'maxlength="50" placeholder="' + esc(K.n) + '"'))}
      <div class="red-g2">${campo('Marca y modelo', inp('it', 'modelo', it.modelo, 'maxlength="60" placeholder="Ej.: USW Pro 24 PoE"'))}${campo('N.º de serie', inp('it', 'serie', it.serie, 'maxlength="40"'))}
      ${campo('MAC', inp('it', 'mac', it.mac, 'maxlength="17" placeholder="aa:bb:cc:dd:ee:ff"'))}${campo('IP de gestión', inp('it', 'ip', it.ip, 'maxlength="40" placeholder="Ej.: 10.0.10.2"'))}
      ${campo('Color del frente', sel('it', 'piel', it.piel, Object.entries(PIEL), 'Automático'))}${campo('Posición', `<span class="red-stp"><button class="red-b" data-r="up" title="Subir">↑</button><select data-r="set" data-o="it" data-k="u">${Array.from({ length: c.cap }, (_, i) => i + 1).filter(u => entra(c, it, u)).map(u => opt(u, 'U' + u + (K.U > 1 ? '–' + (u + K.U - 1) : ''), it.u)).join('')}</select><button class="red-b" data-r="dn" title="Bajar">↓</button></span>`)}</div>
      ${rs.length && (esSW(it) || tb(it) === 'nvr') ? campo('Equipo real', sel('it', 'ext', it.ext, rs.map(x => [x.uid, x.nombre + (x.modelo ? ' · ' + x.modelo : '')]), 'Sin enlazar')) : ''}
      ${campo('Nota', inp('it', 'nota', it.nota, 'maxlength="120"'))}<p class="red-ayuda">También podés arrastrarlo arriba o abajo en el dibujo.</p><div class="red-g"><button class="red-b pel" data-r="rm">Quitar del rack</button></div>`; }
  // nada elegido: resumen del rack
  const occ = new Set(); c.items.forEach(it => { for (let k = 0; k < (CAT[it.type] || { U: 1 }).U; k++) occ.add(it.u + k); });
  let rj = 0, rjU = 0, fo = 0, foU = 0; const caidos = [];
  for (const it of c.items) for (const p of puertos(it.type)) { const st = estadoP(H, devs, V.cid, it.iid, p.id); if (p.k === 'fo') { fo++; if (st) foU++; } else if (esSW(it)) { rj++; if (st) rjU++; }
    if (st === 'crit' && (esPP(it) ? !lk(c, it.iid, p.id) : true)) { const eq = cadena(H, V.cid, it.iid, p.id).find(x => x.t === 'eq'); if (eq && !caidos.some(z => z[2] === eq.dev) && esSW(it)) caidos.push([it, p.id, eq.dev]); } }
  const grupos = {}; for (const k in CAT) if (!CAT[k].marca) (grupos[CAT[k].g] = grupos[CAT[k].g] || []).push(k);
  const usoMax = c.items.reduce((m, it) => Math.max(m, it.u + ((CAT[it.type] || { U: 1 }).U) - 1), 0);
  const datos = ed ? `<div class="red-sec">Datos del rack</div><div class="red-g2">${campo('Nombre', inp('cab', 'nombre', c.nombre, 'maxlength="50" placeholder="Ej.: Rack principal"'))}${campo('Lugar', inp('cab', 'lugar', c.lugar, 'maxlength="50" placeholder="Ej.: Sala técnica, planta baja"'))}
      ${campo('Marca y modelo', inp('cab', 'modelo', c.modelo, 'maxlength="70" list="red-rk" placeholder="Elegí o escribí: VF 27U, Furukawa 44U…"') + `<datalist id="red-rk">${RACKS.map(r => `<option value="${esc(r)}">`).join('')}</datalist>`)}${campo('Tamaño', sel('cab', 'cap', c.cap, [6, 9, 12, 15, 18, 20, 24, 27, 32, 36, 42, 45, 48].filter(u => u >= usoMax || u === c.cap).map(u => [u, u + 'U'])))}
      ${campo('Profundidad (mm)', inp('cab', 'prof', c.prof, 'inputmode="numeric" maxlength="4" placeholder="Ej.: 600"'))}${campo('Nota', inp('cab', 'nota', c.nota, 'maxlength="120"'))}</div>`
    : (c.lugar || c.modelo || c.nota ? `<dl class="red-rows">${c.lugar ? fila('Lugar', esc(c.lugar)) : ''}${c.modelo ? fila('Marca y modelo', esc(c.modelo)) : ''}${c.nota ? fila('Nota', esc(c.nota)) : ''}</dl>` : '');
  return `<div class="red-h"><small>Rack ${esc(V.cid)}</small><b>${occ.size} de ${c.cap} U ocupadas</b></div>${datos}
    <dl class="red-rows">${rj ? fila('Puertos de switch', rjU + ' usados · ' + (rj - rjU) + ' libres') : ''}${fo ? fila('Bocas de fibra', foU + ' usadas · ' + (fo - foU) + ' libres') : ''}${fila('Patch cords', String(c.links.length))}</dl>
    ${caidos.length ? `<div class="red-sec">Sin señal</div><ul class="red-l">${caidos.map(([it, pid, dev]) => `<li><a href="#" data-r="ver" data-v="${esc(V.cid + '|' + it.iid + '|' + pid)}"><i class="crit"></i>${esc(nomDev(devs[dev]) || dev)} · ${esc(nomIt(it))} ${nomP(it, pid)}</a></li>`).join('')}</ul>` : ''}
    ${ed ? `<div class="red-sec">Agregar al rack · ${c.cap - occ.size} U libres</div>${compPick(V)}<details class="red-mas"><summary>Elegir de la lista</summary><div class="red-g"><select id="red-tipo">${Object.entries(grupos).map(([g, ks]) => `<optgroup label="${g}">${ks.map(k => `<option value="${k}">${CAT[k].n}${CAT[k].U > 1 ? ' · ' + CAT[k].U + 'U' : ''}</option>`).join('')}</optgroup>`).join('')}</select><button class="red-b pri" data-r="add">Agregar</button></div></details>` : ''}
    <p class="red-ayuda">${ed ? 'Tocá una boca para ver todo su recorrido y documentarla. Tocá el frente de un equipo para ponerle nombre, modelo y serie.' : 'Tocá una boca para ver todo su recorrido, del switch al equipo.'}</p>`; }
function entra(c, it, u) { const U = CAT[it.type].U; if (u < 1 || u + U - 1 > c.cap) return false; const occ = new Set(); c.items.forEach(o => { if (o !== it) for (let k = 0; k < (CAT[o.type] || { U: 1 }).U; k++) occ.add(o.u + k); }); for (let k = 0; k < U; k++) if (occ.has(u + k)) return false; return true; }

/* ---------- planilla de cables y fibras ---------- */
function filas(H, cids) { const out = [], devs = mapaDevs(H);
  for (const cid of cids) { const c = H.cabs[cid]; if (!c) continue;
    for (const it of c.items) for (const P of puertos(it.type)) { const p = pd(c, it.iid, P.id); if (p.fib || !(p.dev || p.txt || p.cab)) continue;
      const l = lk(c, it.iid, P.id), o = l ? otro(l, it.iid, P.id) : null, oi = o && itemDe(c, o[0]), sw = esPP(it) ? (oi ? [oi, o[1]] : null) : [it, P.id], sp = sw ? pd(c, sw[0].iid, sw[1]) : {}, d = p.dev && devs[p.dev];
      out.push({ cid, v: cid + '|' + it.iid + '|' + P.id, et: p.cab || '', sw: sw ? nomIt(sw[0]) + ' · ' + nomP(sw[0], sw[1]) : '', pp: esPP(it) ? nomIt(it) + ' · ' + nomP(it, P.id) : '', cat: p.cat || '', col: p.col && COL[p.col] ? COL[p.col][0] : '', m: p.m || '',
        dst: d ? nomDev(d) + (d.lugar ? ' · ' + d.lugar : '') : p.dev || p.txt || '', est: d ? d.estado || 'ok' : '', vlan: sp.vlan || '', poe: sp.poe ? POE[sp.poe] : '', cert: p.cert ? CERT[p.cert] : '', nota: p.nota || '' }); } }
  return out; }
function hilos(H, F) { const out = Array.from({ length: F.hilos }, (_, i) => ({ h: i + 1, e: [] }));
  for (const cid in H.cabs) { const c = H.cabs[cid]; for (const iid in c.ports) for (const pid in c.ports[iid]) { const f = c.ports[iid][pid].fib, it = itemDe(c, iid); if (f && f[0] === F.id && it && out[f[1] - 1]) out[f[1] - 1].e.push({ cid, it, pid }); } }
  out.forEach(x => x.e.sort((a, b) => (a.cid === F.from ? 0 : 1) - (b.cid === F.from ? 0 : 1))); return out; }
const fibsDe = (H, V) => H.fibs.filter(F => V.todos || F.from === V.cid || F.to === V.cid || Object.values(H.cabs[V.cid].ports).some(ps => Object.values(ps).some(p => p.fib && p.fib[0] === F.id)));
function tablaCables(H, V, imp) { const R = filas(H, V.todos ? Object.keys(H.cabs) : [V.cid]);
  if (!R.length) return '<p class="red-nada">Todavía no hay cables documentados' + (V.todos ? '' : ' en este rack') + '. Tocá una boca en el frente y completá a dónde va.</p>';
  return `<div class="red-tw"><table class="red-t"><thead><tr>${V.todos ? '<th>Rack</th>' : ''}<th>Etiqueta</th><th>Switch · puerto</th><th>Patchera · boca</th><th>Categoría</th><th>Color</th><th class="n">m</th><th>Destino</th><th>Estado</th><th>VLAN</th><th>PoE</th><th>Certif.</th><th>Nota</th></tr></thead><tbody>${R.map(r => `<tr>${V.todos ? `<td>${esc(r.cid)}</td>` : ''}<td><b>${imp ? esc(r.et) : `<a href="#" data-r="ver" data-v="${esc(r.v)}">${esc(r.et || '—')}</a>`}</b></td><td>${esc(r.sw) || '<span class="t-warn">sin patch cord</span>'}</td><td>${esc(r.pp)}</td><td>${esc(r.cat)}</td><td>${esc(r.col)}</td><td class="n">${esc(r.m)}</td><td>${esc(r.dst)}</td><td>${r.est ? `<span class="t-${r.est}">${EST[r.est]}</span>` : ''}</td><td>${esc(r.vlan)}</td><td>${esc(r.poe)}</td><td>${r.cert ? `<span class="${r.cert === 'Aprobado' ? 't-ok' : 't-crit'}">${r.cert}</span>` : ''}</td><td>${esc(r.nota)}</td></tr>`).join('')}</tbody></table></div>`; }
// planilla de cada patchera (boca por boca) o de cada switch (puerto por puerto): se escribe en la misma tabla y es lo mismo que el dibujo
function planilla(H, V, modo) { const ed = H.editar(), cids = V.todos ? Object.keys(H.cabs) : [V.cid], devs = H.devs(), out = [];
  const box = (cid, it, pid, k, v, ph, w) => ed ? `<input data-r="set" data-o="pt" data-id="${esc(cid + '|' + it.iid + '|' + pid)}" data-k="${k}" value="${esc(v == null ? '' : String(v).replace('.', k === 'm' ? ',' : '.'))}" placeholder="${ph || ''}" maxlength="${w || 40}">` : esc(v == null ? '' : v);
  const lista = (cid, it, pid, k, v, ops, vacio) => ed ? `<select data-r="set" data-o="pt" data-id="${esc(cid + '|' + it.iid + '|' + pid)}" data-k="${k}">${opt('', vacio, v)}${ops.map(([a, b]) => opt(a, b, v)).join('')}</select>` : esc((ops.find(o => String(o[0]) === String(v)) || [, ''])[1]);
  for (const cid of cids) { const c = H.cabs[cid]; for (const it of c.items) { const K = CAT[it.type] || {}, PS = puertos(it.type).filter(x => x.k !== 'fo' || modo === 'pp');
      if (!PS.length || (modo === 'pp' ? !esPP(it) : !esSW(it))) continue;
      const filas = PS.map(x => { const p = pd(c, it.iid, x.id) || {}, l = lk(c, it.iid, x.id), o = l ? otro(l, it.iid, x.id) : null, oi = o ? itemDe(c, o[0]) : null, ch = cadena(H, cid, it.iid, x.id), eq = ch.find(z => z.t === 'eq');
        const va = o && oi ? `<a href="#" data-r="ver" data-v="${esc(cid + '|' + o[0] + '|' + o[1])}">${esc(nomIt(oi))} · ${nomP(oi, o[1])}</a>` : '<span class="red-mut">—</span>';
        if (modo === 'pp') return x.k === 'fo' ? `<tr><td>${nomP(it, x.id)}</td><td colspan="2">${p.fib ? esc(p.fib[0] + ' · ' + hiloTxt(p.fib[1])) : '<span class="red-mut">sin fibra</span>'}</td><td>${va}</td><td colspan="4"></td></tr>`
          : `<tr><td><a href="#" data-r="ver" data-v="${esc(cid + '|' + it.iid + '|' + x.id)}">${nomP(it, x.id)}</a></td><td>${box(cid, it, x.id, 'cab', p.cab, 'Etiqueta', 20)}</td><td>${lista(cid, it, x.id, 'dev', p.dev, devs.map(d => [d.id, (d.nombre ? d.nombre + ' · ' : '') + d.id]), 'Ninguno')}</td><td>${va}</td>
            <td>${box(cid, it, x.id, 'txt', p.txt, 'Otro destino', 60)}</td><td>${lista(cid, it, x.id, 'cat', p.cat, CATS.map(z => [z, z]), '—')}</td><td class="n">${box(cid, it, x.id, 'm', p.m, 'm', 6)}</td><td>${box(cid, it, x.id, 'nota', p.nota, '', 120)}</td></tr>`;
        return `<tr><td><a href="#" data-r="ver" data-v="${esc(cid + '|' + it.iid + '|' + x.id)}">${nomP(it, x.id)}</a></td><td>${va}</td><td>${eq ? esc(nomDev(mapaDevs(H)[eq.dev]) || eq.dev) : '<span class="red-mut">—</span>'}</td><td>${box(cid, it, x.id, 'desc', p.desc, 'Descripción', 60)}</td>
          <td>${box(cid, it, x.id, 'vlan', p.vlan, 'VLAN', 20)}</td><td>${lista(cid, it, x.id, 'poe', p.poe, Object.entries(POE), '—')}</td><td>${lista(cid, it, x.id, 'vel', p.vel, VEL.map(z => [z, z]), '—')}</td><td>${box(cid, it, x.id, 'nota', p.nota, '', 120)}</td></tr>`; }).join('');
      out.push(`<section class="red-pl"><header><b>${esc(nomIt(it))}</b><span>${V.todos ? esc(cid) + ' · ' : ''}U${it.u}${K.marca ? ' · ' + esc(modTxt(K)) : ''}</span></header><div class="red-tw"><table class="red-t red-te"><thead><tr>${modo === 'pp' ? '<th>Boca</th><th>Etiqueta</th><th>Equipo conectado</th><th>Patch cord a</th><th>Otro destino</th><th>Categoría</th><th class="n">m</th><th>Nota</th>' : '<th>Puerto</th><th>Patch cord a</th><th>Equipo al final</th><th>Descripción</th><th>VLAN</th><th>PoE</th><th>Velocidad</th><th>Nota</th>'}</tr></thead><tbody>${filas}</tbody></table></div></section>`); } }
  return out.join('') || `<p class="red-nada">${modo === 'pp' ? 'No hay patcheras' : 'No hay switches'} ${V.todos ? 'en ningún rack' : 'en este rack'}. Agregalas en el frente.</p>`; }
function tablaFibras(H, V, imp) { const L = fibsDe(H, V), ed = H.editar() && !imp, racks = H.racks ? H.racks() : Object.keys(H.cabs).map(k => [k, k]);
  const nueva = ed ? `<div class="red-g red-fnew"><button class="red-b pri" data-r="nfib">Nueva fibra desde ${esc(V.cid)}</button><span class="red-ayuda">Después asignás cada hilo a una boca de la patchera tocándola en el frente.</span></div>` : '';
  const punta = (F, k, kt) => `${campo(k === 'from' ? 'Desde' : 'Hasta', `<select data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="${k}">${opt('', 'Otro lugar', F[k])}${(H.puntas ? H.puntas() : racks).map(([r, t]) => opt(r, t, F[k])).join('')}</select>`)}${F[k] ? '' : campo(k === 'from' ? 'Lugar de origen' : 'Lugar de destino', `<input data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="${kt}" value="${esc(F[kt] || '')}" maxlength="60" list="red-cajas" placeholder="Ej.: caja de empalme del portón">`)}`;
  const cajasL = `<datalist id="red-cajas">${CAJAS.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
  if (!L.length) return nueva + cajasL + '<p class="red-nada">Este rack no tiene fibras. Creala acá o dibujala en la maqueta, y después asigná cada hilo a una boca de la patchera.</p>';
  return nueva + cajasL + L.map(F => { const hs = hilos(H, F), m = (H.largo ? H.largo(F) : 0) || F.m || 0, usados = hs.filter(x => x.e.length).length, lado = e => e ? `${esc(e.cid)} · ${esc(nomIt(e.it))} · ${nomP(e.it, e.pid)}` : '<span class="red-mut">—</span>';
    return `<section class="red-fib"><header><b>${imp ? esc(F.id) : `<a href="#" data-r="ir" data-v="${esc(F.id)}">${esc(F.id)}</a>`}${F.nombre ? ' · ' + esc(F.nombre) : ''}</b><span>${esc(F.from || F.fromTxt || '?')} → ${esc(F.to || F.toTxt || '?')} · ${F.hilos} hilos · ${usados} en uso${m ? ' · ' + m + ' m' : ''}${F.tipo ? ' · ' + FTIPO[F.tipo][0] : ''}${F.con ? ' · ' + FCON[F.con] : ''}${F.tend ? ' · ' + esc(F.tend) : ''}</span></header>
      ${ed ? `<div class="red-g4">${punta(F, 'from', 'fromTxt')}${punta(F, 'to', 'toTxt')}${campo('Hilos', `<select data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="hilos">${[2, 4, 6, 8, 12, 24, 48, 72, 96, 144].map(n => opt(n, n + ' hilos', F.hilos)).join('')}</select>`)}${campo('Largo (m)', `<input data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="m" value="${F.m != null ? String(F.m).replace('.', ',') : ''}" inputmode="decimal" maxlength="7" placeholder="${H.largo && H.largo(F) ? 'Medido en la maqueta: ' + H.largo(F) : 'Ej.: 180'}">`)}${campo('Nombre', `<input data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="nombre" value="${esc(F.nombre || '')}" maxlength="40" placeholder="Ej.: Troncal norte">`)}${campo('Tipo', `<select data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="tipo">${opt('', 'Sin anotar', F.tipo)}${Object.entries(FTIPO).map(([k, v]) => opt(k, v[0], F.tipo)).join('')}</select>`)}${campo('Conector', `<select data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="con">${opt('', 'Sin anotar', F.con)}${Object.entries(FCON).map(([k, v]) => opt(k, v, F.con)).join('')}</select>`)}${campo('Tendido', `<select data-r="set" data-o="F" data-id="${esc(F.id)}" data-k="tend">${opt('', 'Sin anotar', F.tend)}${FTEND.map(x => opt(x, x, F.tend)).join('')}</select>`)}</div>` : ''}
      <div class="red-tw"><table class="red-t"><thead><tr><th>Hilo</th><th>Color</th><th>En ${esc(F.from || F.fromTxt || 'una punta')}</th><th>En ${esc(F.to || F.toTxt || 'la otra punta')}</th><th class="n">dB</th><th>Estado</th></tr></thead><tbody>${hs.map(x => { const a = x.e.find(e => e.cid === F.from) || (x.e[0] && x.e[0].cid !== F.to ? x.e[0] : null), b = x.e.find(e => e !== a) || null, db = F.db && F.db[x.h];
        return `<tr class="${x.e.length ? '' : 'lib'}"><td>${x.h}</td><td><i class="red-hc" style="background:${hiloCol(x.h)[1]}"></i>${may(hiloCol(x.h)[0])}</td><td>${lado(a)}</td><td>${lado(b)}</td><td class="n">${db != null ? String(db).replace('.', ',') : ''}</td><td>${x.e.length >= 2 ? '<span class="t-ok">conectado</span>' : x.e.length ? '<span class="t-warn">una sola punta</span>' : '<span class="red-mut">libre</span>'}</td></tr>`; }).join('')}</tbody></table></div></section>`; }).join(''); }
function bajar(H, V) { const q = v => { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, L = [];
  L.push(['Rack', 'Etiqueta', 'Switch y puerto', 'Patchera y boca', 'Categoría', 'Color', 'Metros', 'Destino', 'Estado', 'VLAN', 'PoE', 'Certificación', 'Nota']);
  filas(H, V.todos ? Object.keys(H.cabs) : [V.cid]).forEach(r => L.push([r.cid, r.et, r.sw, r.pp, r.cat, r.col, r.m, r.dst, r.est ? EST[r.est] : '', r.vlan, r.poe, r.cert, r.nota]));
  L.push([], ['Fibra', 'Hilo', 'Color', 'Punta A', 'Punta B', 'Metros', 'Pérdida (dB)', 'Tipo', 'Conector']);
  fibsDe(H, V).forEach(F => hilos(H, F).forEach(x => { const t = e => e ? e.cid + ' · ' + nomIt(e.it) + ' · ' + nomP(e.it, e.pid) : ''; L.push([F.id, x.h, hiloCol(x.h)[0], t(x.e[0]), t(x.e[1]), H.largo ? H.largo(F) : '', F.db && F.db[x.h] != null ? String(F.db[x.h]).replace('.', ',') : '', F.tipo ? FTIPO[F.tipo][0] : '', F.con ? FCON[F.con] : '']); }));
  const blob = new Blob(['﻿' + L.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'conexiones-' + (V.todos ? 'todos-los-racks' : V.cid) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
function imprimir(H, V) { const cids = V.todos ? Object.keys(H.cabs) : [V.cid], hoja = document.createElement('div'); hoja.className = 'red-hoja'; const hoy = new Date().toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' });
  hoja.innerHTML = `<h1>Documentación de conexiones</h1><p class="sub">${esc(H.cliente ? H.cliente() : '')} · ${hoy}</p>` + cids.map(cid => { const T = H.titulo(cid), v = { cid, sel: null, zoom: 1, todos: false };
    return `<section><h2>${esc(T.t)}</h2><p class="sub">${esc(T.s)}</p><div class="fr">${frente(H, v)}</div><h3>Cables</h3>${tablaCables(H, v, true)}</section>`; }).join('') + `<section><h2>Fibras</h2>${tablaFibras(H, { cid: V.cid, todos: V.todos }, true)}</section>`;
  document.querySelectorAll('.red-hoja').forEach(x => x.remove()); document.body.appendChild(hoja); document.documentElement.classList.add('red-imp');
  const fin = () => { document.documentElement.classList.remove('red-imp'); hoja.remove(); window.removeEventListener('afterprint', fin); }; window.addEventListener('afterprint', fin); setTimeout(() => { try { window.print(); } catch (e) { fin(); } }, 60); }
function buscar(H, V) { const q = (V.q || '').trim().toLowerCase(); if (q.length < 2) return ''; const devs = mapaDevs(H), hits = [];
  for (const cid in H.cabs) { const c = H.cabs[cid]; for (const it of c.items) for (const P of puertos(it.type)) { const p = pd(c, it.iid, P.id); if (!(p.dev || p.cab || p.txt || p.nota || p.desc || p.fib)) continue; const d = p.dev && devs[p.dev];
      if ([cid, nomIt(it), p.cab, p.txt, p.nota, p.desc, p.vlan, p.dev, d && d.nombre, d && d.lugar, p.fib && p.fib[0]].filter(Boolean).join(' ').toLowerCase().includes(q)) hits.push(`<li><a href="#" data-r="ver" data-v="${esc(cid + '|' + it.iid + '|' + P.id)}"><small>${esc(cid)}</small>${esc(nomIt(it))} · ${nomP(it, P.id)}${p.cab ? ' · <b>' + esc(p.cab) + '</b>' : ''}${d ? ' · ' + esc(nomDev(d)) : p.txt ? ' · ' + esc(p.txt) : ''}</a></li>`); } }
  return `<ul class="red-l pop">${hits.slice(0, 40).join('') || '<li class="red-mut">Nada con eso.</li>'}</ul>`; }

/* ---------- pantalla ---------- */
const IC = { x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>', imp: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>', csv: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16"/></svg>' };
function pintar(el, H, V) { css(); const c = H.cabs[V.cid]; if (!c) return; V.tab = V.tab || 'frente'; if (V.zoom == null) V.zoom = (el.clientWidth || innerWidth) < 700 ? 2 : 1; if (V.fitDe !== V.cid) { V.fitDe = V.cid; V.fit = c.cap > 12 && (el.clientWidth || innerWidth) >= 700; } el.__red = { H, V }; el.classList.add('red-on');
  if (!el.__redOn) { el.__redOn = 1; for (const t of ['click', 'change', 'input']) el.addEventListener(t, e => evento(el, e), true); soltar(el); el.addEventListener('pointerdown', e => { if (!arrastrarCable(el, e)) arrastrar(el, e); }); }
  const T = H.titulo(V.cid), racks = H.racks ? H.racks() : Object.keys(H.cabs).map(k => [k, k]), nC = filas(H, V.todos ? Object.keys(H.cabs) : [V.cid]).length, nF = fibsDe(H, V).length, sc = el.querySelector('.red-fr'), keep = sc ? [sc.scrollLeft, sc.scrollTop] : null, sl = el.querySelector('.red-lado'), keepL = sl ? sl.scrollTop : 0;
  el.innerHTML = `<div class="red${V.fit && V.tab === 'frente' ? ' fitm' : ''}"><div class="red-top"><div class="red-tt"><div class="red-eb">Documentación de conexiones</div><h3><span>${esc(c.nombre ? V.cid + ' · ' + c.nombre : T.t)}</span>${H.editar() ? `<button class="red-pen" data-r="ren" data-v="rack" aria-label="Cambiar el nombre del rack"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg></button>` : ''}</h3><div class="red-sub">${esc(T.s)}</div></div>
      <div class="red-tools">${H.acciones ? H.acciones(V.cid) : ''}${racks.length > 1 ? `<select data-r="rack" aria-label="Cambiar de rack">${racks.map(([k, t]) => opt(k, t, V.cid)).join('')}</select>` : ''}
        <span class="red-q"><input data-r="q" type="search" placeholder="Buscar cable, equipo o boca" value="${esc(V.q || '')}" aria-label="Buscar en todos los racks"><span class="red-res">${buscar(H, V)}</span></span>
        <span class="red-more"><button class="red-b ico" data-r="more" aria-label="Más opciones" aria-expanded="${!!V.more}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>${V.more ? `<div class="red-menu" role="menu"><button data-r="imp" role="menuitem">${IC.imp}Imprimir o guardar en PDF</button><button data-r="csv" role="menuitem">${IC.csv}Bajar la planilla (Excel)</button>${(H.menu ? H.menu(V.cid) : []).map(([v, t]) => `<button data-r="acc" data-v="${v}" role="menuitem">${t}</button>`).join('')}</div>` : ''}</span><button class="red-x" data-r="cerrar" aria-label="Cerrar">${IC.x}</button></div></div>
    <div class="red-tabs"><button data-r="tab" data-v="frente" class="${V.tab === 'frente' ? 'on' : ''}">Frente</button><button data-r="tab" data-v="cables" class="${V.tab === 'cables' ? 'on' : ''}">Cables <i>${nC}</i></button><button data-r="tab" data-v="fibras" class="${V.tab === 'fibras' ? 'on' : ''}">Fibras <i>${nF}</i></button>
      ${V.tab === 'frente' ? `<span class="red-z"><button data-r="fit" class="${V.fit ? 'on' : ''}" aria-pressed="${!!V.fit}" title="Ver el rack entero">Ver todo</button><button data-r="zoom" data-v="-0.3" aria-label="Alejar">−</button><button data-r="zoom" data-v="0.3" aria-label="Acercar">+</button></span>` : `<button data-r="todos" class="red-chk ${V.todos ? 'on' : ''}">Todos los racks</button>`}</div>
    ${V.tab === 'frente' ? `<div class="red-body"><div class="red-fr${V.fit ? ' fit' : ''}">${frente(H, V)}</div><div class="red-lado">${lado(H, V)}</div></div>` : `<div class="red-body uno"><div class="red-doc">${V.tab === 'cables' ? `<div class="red-mm red-cv">${[['todo', 'Todos los cables'], ['pp', 'Por patchera'], ['sw', 'Por switch']].map(([k, t]) => `<button data-r="cv" data-v="${k}" class="${(V.cv || 'todo') === k ? 'on' : ''}">${t}</button>`).join('')}</div>` + (V.cv === 'pp' ? planilla(H, V, 'pp') : V.cv === 'sw' ? planilla(H, V, 'sw') : tablaCables(H, V)) : tablaFibras(H, V)}</div></div>`}</div>`;
  if (keep) { const s2 = el.querySelector('.red-fr'); if (s2) { s2.scrollLeft = keep[0]; s2.scrollTop = keep[1]; } } const l2 = el.querySelector('.red-lado'); if (l2 && V._mismo) l2.scrollTop = keepL; V._mismo = false; }

function evento(el, e) { const { H, V } = el.__red, t = e.target, c = H.cabs[V.cid]; e.stopPropagation(); if (!c) return;
  if (e.type === 'click' && V.more && !t.closest('.red-more')) { V.more = false; const m = el.querySelector('.red-menu'); if (m) m.remove(); }
  const R = () => pintar(el, H, V), G = () => { H.guardar(); V._mismo = true; R(); };
  if (e.type === 'input') { if (t.dataset.r === 'q') { V.q = t.value; const r = el.querySelector('.red-res'); if (r) r.innerHTML = buscar(H, V); }
    if (t.dataset.r === 'cq') { V.cq = t.value; galG = V.cg || ''; const r = el.querySelector('.red-cres'); if (r) r.innerHTML = compLista(compBusca(V.cq)); return; }
    if (t.dataset.r === 'mq') { V.mq = t.value; const r = el.querySelector('.red-mres'); if (r) r.innerHTML = modLista(modBusca(V.mq, V.mm), r.dataset.mr); } return; }
  if (e.type === 'change') { const k = t.dataset.r; if (k === 'rack') { V.cid = t.value; V.sel = null; V.linking = false; if (H.abrir) H.abrir(V.cid); R(); return; }
    if (k !== 'set' || !H.editar()) return; aplicar(H, V, t.dataset.o, t.dataset.k, t.value.trim(), t.dataset.id); G(); return; }
  const a = t.closest('[data-r]'), p = t.closest('[data-rp]'), it = t.closest('[data-it]');
  if (a && !/^(INPUT|SELECT)$/.test(a.tagName)) { const k = a.dataset.r, v = a.dataset.v || ''; e.preventDefault();
    if (k === 'cerrar') return H.cerrar(); if (k === 'tab') { V.tab = v; return R(); } if (k === 'ir') return H.ir(v); if (k === 'csv') return bajar(H, V); if (k === 'imp') return imprimir(H, V); if (k === 'todos') { V.todos = !V.todos; return R(); }
    if (k === 'cg') { V.cg = v; V._mismo = true; return R(); }
    if (k === 'more') { V.more = !V.more; V._mismo = true; return R(); }
    if (k === 'cv') { V.cv = v; return R(); }
    if (k === 'mm') { V.mm = v; V._mismo = true; R(); const q = el.querySelector('[data-r="mq"]'); if (q) q.focus(); return; }
    if (k === 'fit') { V.fit = !V.fit; return R(); }
    if (k === 'zoom') { if (V.fit) { V.fit = false; V.zoom = 1; } V.zoom = Math.max(1, Math.min(2.5, (V.zoom || 1) + (+v))); return R(); }
    if (k === 'acc') return H.accion && H.accion(v, a, el);
    if (k === 'ren') return renombrar(el, v);
    if (k === 'ver') { const [cid, iid, pid] = v.split('|'); if (!H.cabs[cid]) return; V.cid = cid; V.sel = pid ? [iid, pid] : iid ? [iid] : null; V.tab = 'frente'; V.linking = false; V.q = ''; if (H.abrir) H.abrir(cid); return R(); }
    if (!H.editar()) return; const [iid, pid] = V.sel || [];
    if (k === 'mpick') { V.mpick = true; V._mismo = true; R(); const q = el.querySelector('[data-r="mq"]'); if (q) q.focus(); return; }
    if (k === 'nfib') { let n = 1; while (H.fibs.some(f => f.id === 'FO-' + String(n).padStart(2, '0'))) n++; const id = 'FO-' + String(n).padStart(2, '0'); H.fibs.push({ id, from: V.cid, to: '', hilos: 12, tipo: 'os2', pts: [] }); V.tab = 'fibras'; H.aviso('Fibra ' + id + ' creada: completá hasta dónde llega y asigná los hilos a las bocas.'); return G(); }
    if (k === 'setm' && iid) { const item = itemDe(c, iid), K = CAT[v]; if (!item || !K) return; const quedan = new Set(puertos(v).map(x => x.id)); let fuera = 0;
      c.links = c.links.filter(l => { const ok = !((l[0][0] === iid && !quedan.has(l[0][1])) || (l[1][0] === iid && !quedan.has(l[1][1]))); if (!ok) fuera++; return ok; });
      if (c.ports[iid]) for (const q in c.ports[iid]) if (!quedan.has(q)) delete c.ports[iid][q];
      item.type = v; item.modelo = K.n; V.mpick = false; V.mq = ''; H.aviso(fuera ? `Modelo cambiado. Se quitaron ${fuera} patch cords de puertos que este modelo no tiene.` : 'Modelo: ' + K.n); return G(); }
    if (k === 'link') { V.linking = true; V._mismo = true; return R(); } if (k === 'nolink') { V.linking = false; V._mismo = true; return R(); }
    if (k === 'unlink' && pid) { c.links = c.links.filter(l => l !== lk(c, iid, pid)); return G(); }
    if (k === 'addc') { if (poner(H, V, v, 0)) return G(); return; }
    if (k === 'add' || k === 'addm') { const tp = k === 'addm' ? v : el.querySelector('#red-tipo').value, U = CAT[tp].U; V.mq = ''; let u = 0; for (let x = 1; x + U - 1 <= c.cap && !u; x++) if (entra(c, { type: tp }, x)) u = x; if (!u) return H.aviso('No hay lugar: quitá un equipo o usá un rack más grande');
      let n = 1; while (c.items.some(x => x.iid === tp + n)) n++; c.items.push(Object.assign({ iid: tp + n, type: tp, u }, CAT[tp].marca ? { modelo: CAT[tp].n } : {})); c.items.sort((x, y) => x.u - y.u); V.sel = [tp + n]; V.mpick = false; return G(); }
    const item = itemDe(c, iid);
    if ((k === 'up' || k === 'dn') && item) { let u = item.u + (k === 'dn' ? 1 : -1); while (u >= 1 && u <= c.cap && !entra(c, item, u)) u += k === 'dn' ? 1 : -1; if (entra(c, item, u)) { item.u = u; c.items.sort((x, y) => x.u - y.u); return G(); } return; }
    if (k === 'rm' && item) { if (a.dataset.ok !== '1') { a.dataset.ok = '1'; a.textContent = '¿Seguro? Tocá de nuevo'; return; } c.items = c.items.filter(x => x.iid !== iid); delete c.ports[iid]; c.links = c.links.filter(l => l[0][0] !== iid && l[1][0] !== iid); V.sel = null; return G(); }
    return; }
  if (e.type !== 'click' || V.tab !== 'frente' || V._arr) { V._arr = false; return; }
  if (p) { const [iid, pid] = p.dataset.rp.split(':');
    if (V.linking && V.sel && V.sel[1] && H.editar()) { const s0 = V.sel; const no = noEntra(c, s0, [iid, pid]); if (no) { H.aviso(no); return; } V.linking = false; if (!(s0[0] === iid && s0[1] === pid)) { c.links = c.links.filter(l => l !== lk(c, s0[0], s0[1]) && l !== lk(c, iid, pid)); c.links.push([[s0[0], s0[1]], [iid, pid]]); V.sel = [iid, pid]; H.aviso('Patch cord conectado'); return G(); } }
    V.sel = [iid, pid]; return R(); }
  if (it) { V.sel = [it.dataset.it]; V.linking = false; V.mpick = false; return R(); }
  if (t.closest('.red-svg')) { V.sel = null; V.linking = false; R(); } }

function aplicar(H, V, o, k, v, id) { const c = H.cabs[V.cid], [iid, pid] = V.sel || [], num = x => x === '' ? null : +String(x).replace(',', '.');
  const pon = (obj, key, val) => { if (val === '' || val == null || (typeof val === 'number' && isNaN(val))) delete obj[key]; else obj[key] = val; };
  if (o === 'p' && pid) { const p = pd(c, iid, pid, true);
    if (k === 'dev') { if (v) for (const c2 in H.cabs) for (const i2 in H.cabs[c2].ports) for (const p2 in H.cabs[c2].ports[i2]) if (H.cabs[c2].ports[i2][p2].dev === v) delete H.cabs[c2].ports[i2][p2].dev; pon(p, 'dev', v); }
    else pon(p, k, k === 'm' ? num(v) : v); }
  if (o === 'l' && pid) { const l = lk(c, iid, pid); if (l) { l[2] = l[2] || {}; pon(l[2], k, k === 'm' ? num(v) : v); if (!Object.keys(l[2]).length) l.length = 2; } }
  if (o === 'fo' && pid) { const p = pd(c, iid, pid, true);
    if (k === 'fib') { if (v) p.fib = [v, (p.fib && p.fib[1]) || 1]; else delete p.fib; }
    if (k === 'hilo' && p.fib) p.fib[1] = +v;
    if (k === 'db' && p.fib) { const F = fibDe(H, p.fib[0]); if (F) { F.db = F.db || {}; pon(F.db, p.fib[1], num(v)); } } }
  if (o === 'it' && iid) { const it = itemDe(c, iid); if (!it) return;
    if (k === 'u') { if (entra(c, it, +v)) { it.u = +v; c.items.sort((x, y) => x.u - y.u); } }
    else { pon(it, k, v); if (k === 'ext' && v && H.reales) { const x = H.reales().find(r => r.uid === v); if (x) { if (!it.name) it.name = x.nombre; if (!it.mac && x.mac) it.mac = x.mac; if (!it.modelo && x.modelo) it.modelo = x.modelo; if (!it.ip && x.ip) it.ip = x.ip; } } } }
  if (o === 'cab') { pon(c, k, k === 'cap' || k === 'prof' ? num(v) : v); const m = k === 'modelo' && /(\d+)\s*U\b/i.exec(v || ''), mm = k === 'modelo' && /(\d{3,4})\s*[×x]\s*(\d{3,4})/.exec(v || ''); if (m && +m[1] >= c.items.reduce((a, it) => Math.max(a, it.u + ((CAT[it.type] || { U: 1 }).U) - 1), 0)) c.cap = +m[1]; if (mm && !c.prof) c.prof = +mm[2]; return; }
  if (o === 'pt') { const [cid, i2, p2] = String(id).split('|'), cc = H.cabs[cid]; if (cc) pon(pd(cc, i2, p2, true), k, k === 'm' ? num(v) : v); return; }
  if (o === 'F') { const F = fibDe(H, id); if (F) pon(F, k, k === 'hilos' || k === 'm' ? (v === '' ? '' : +String(v).replace(',', '.')) : v); } }

// agarrar la punta de un patch cord y soltarla en otro puerto (o tirar un cable nuevo desde un puerto libre); con mouse o con el dedo
function arrastrarCable(el, e) { const { H, V } = el.__red || {}; if (!H || !H.editar() || V.tab !== 'frente' || e.button > 0) return false;
  const p = e.target.closest('[data-rp]'), svg = el.querySelector('.red-svg'); if (!p || !svg || !V._pos) return false;
  const c = H.cabs[V.cid], [iid, pid] = p.dataset.rp.split(':'), l = lk(c, iid, pid), li = l ? c.links.indexOf(l) : -1;
  const fijo = l ? (l[0][0] === iid && l[0][1] === pid ? l[1] : l[0]) : [iid, pid], A = V._pos[fijo.join(':')]; if (!A) return false;
  const NS = 'http://www.w3.org/2000/svg', pt = svg.createSVGPoint(), x0 = e.clientX, y0 = e.clientY, col = l ? pcCol(H, c, l) : '#0B5FFF'; let t0 = null, t1 = null, dest = null, movio = false;
  const enSvg = ev => { pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const mv = ev => { if (!movio && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; ev.preventDefault();
    if (!movio) { movio = true; svg.classList.add('arr'); if (li >= 0) svg.querySelectorAll(`[data-li="${li}"]`).forEach(x => x.style.display = 'none');
      t0 = document.createElementNS(NS, 'path'); t0.setAttribute('class', 'r-pc0'); t1 = document.createElementNS(NS, 'path'); t1.setAttribute('class', 'r-pc r-tira'); t1.setAttribute('stroke', col); svg.append(t0, t1); }
    const fr = el.querySelector('.red-fr'); if (fr) { const r = fr.getBoundingClientRect(), m = 36; if (ev.clientX > r.right - m) fr.scrollLeft += 14; else if (ev.clientX < r.left + m) fr.scrollLeft -= 14; if (ev.clientY > r.bottom - m) fr.scrollTop += 14; else if (ev.clientY < r.top + m) fr.scrollTop -= 14; }
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY), t = bajo && bajo.closest ? bajo.closest('[data-rp]') : null;
    if (dest && dest !== t) dest.classList.remove('r-dest', 'r-no'); dest = t && svg.contains(t) && t.dataset.rp !== fijo.join(':') ? t : null;
    if (dest) { const no = noEntra(c, fijo, dest.dataset.rp.split(':')); dest.classList.toggle('r-no', !!no); dest.classList.toggle('r-dest', !no); }
    const q = enSvg(ev), B = dest ? V._pos[dest.dataset.rp] : [q.x, q.y], d = curva(A, B); t0.setAttribute('d', d); t1.setAttribute('d', d); };
  const fin = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', fin); removeEventListener('pointercancel', fin); if (!movio) return;
    V._arr = true; setTimeout(() => { V._arr = false; }, 60);
    if (dest && dest.classList.contains('r-no')) { dest.classList.remove('r-no'); H.aviso(noEntra(c, fijo, dest.dataset.rp.split(':'))); }
    else if (dest) { const [i2, p2] = dest.dataset.rp.split(':'), viejo = lk(c, i2, p2); c.links = c.links.filter(x => x !== l && x !== viejo); const nuevo = [fijo.slice(), [i2, p2]]; if (l && l[2]) nuevo.push(l[2]); c.links.push(nuevo);
      V.sel = [i2, p2]; V.linking = false; H.guardar(); H.aviso(l ? 'Patch cord movido al puerto ' + p2.replace(/^p/, '') : 'Patch cord conectado'); }
    pintar(el, H, V); };
  addEventListener('pointermove', mv, { passive: false }); addEventListener('pointerup', fin); addEventListener('pointercancel', fin); return true; }

// arrastrar un equipo arriba o abajo en el rack
function arrastrar(el, e) { const { H, V } = el.__red || {}; if (!H || !H.editar() || V.tab !== 'frente' || e.target.closest('[data-rp]')) return; const g = e.target.closest('[data-it]'), svg = el.querySelector('.red-svg'); if (!g || !svg) return;
  const c = H.cabs[V.cid], it = itemDe(c, g.dataset.it); if (!it) return; const y0 = e.clientY, esc0 = (30 + c.cap * 56 + 30) / svg.getBoundingClientRect().height; let du = 0;
  const mv = ev => { const d = Math.round((ev.clientY - y0) * esc0 / 56); if (d === du) return; if (entra(c, it, it.u + d)) { du = d; g.setAttribute('transform', `translate(0 ${d * 56})`); g.classList.add('mov'); } };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (du) { it.u += du; c.items.sort((x, y) => x.u - y.u); V._arr = true; V.sel = [it.iid]; H.guardar(); pintar(el, H, V); setTimeout(() => { V._arr = false; }, 50); } };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }

function css() { if (document.getElementById('red-css')) return; const s = document.createElement('style'); s.id = 'red-css'; s.textContent = `.red-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px;max-height:360px;overflow:auto;padding:2px}.red-gal button{display:grid;gap:3px;justify-items:start;text-align:left;border:1px solid var(--line-strong,#c9cfd4);background:var(--glass-strong,#fff);color:inherit;border-radius:10px;padding:8px;cursor:grab;font:inherit}
.red-gal button:hover{border-color:var(--accent,#0B5FFF);box-shadow:0 6px 16px -10px var(--accent,#0B5FFF)}.red-gal button:active{cursor:grabbing}.red-gal svg{width:100%;height:auto;max-height:46px}.red-gal b{font-size:12.5px;font-weight:600;line-height:1.25}.red-gal span{font-size:11.5px;opacity:.7}
.red-top{position:relative;z-index:6}.red-more{position:relative}.red-b.ico{padding:0 8px}.red-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;min-width:240px;display:grid;padding:6px;border:1px solid var(--line-strong,#c9cfd4);border-radius:12px;background:var(--menu-bg,var(--glass-strong,#fff));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 18px 40px -16px rgba(0,0,0,.45)}
.red-menu button{display:flex;gap:9px;align-items:center;border:0;background:transparent;color:inherit;text-align:left;padding:9px 10px;border-radius:8px;font:inherit;cursor:pointer}.red-menu button:hover{background:var(--accent-soft,rgba(11,95,255,.1))}.red-menu svg{width:16px;height:16px}
.red-cv{margin:0 0 12px}.red-pl{margin:0 0 18px}.red-pl header{display:flex;gap:10px;align-items:baseline;margin:0 0 6px}.red-pl header span{font-size:12.5px;opacity:.7}
.red-te input,.red-te select{width:100%;min-width:70px;padding:5px 7px;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:13px}.red-te input:hover,.red-te select:hover{border-color:var(--line-strong,#c9cfd4)}.red-te input:focus,.red-te select:focus{border-color:var(--accent,#0B5FFF);background:var(--glass-strong,#fff);outline:none}
.red-te td{padding:3px 6px;vertical-align:middle}.red-te td:first-child{white-space:nowrap}.red-te td a{font-size:12.5px}.red-te input,.red-te select{border-color:transparent!important;background:transparent!important;box-shadow:none!important}.red-te input:hover,.red-te select:hover{border-color:var(--line-strong,#c9cfd4)!important}.red-te input:focus,.red-te select:focus{border-color:var(--accent,#0B5FFF)!important;background:var(--glass-strong,#fff)!important}.red-te td.n input{width:64px;min-width:0;text-align:right}
.red.fitm{height:calc(100dvh - 104px)}.red.fitm .red-body{grid-template-rows:minmax(0,1fr)}.red-fr.fit{height:100%;box-sizing:border-box;overflow:hidden;display:flex;justify-content:center}.red-fr.fit .red-svg{min-width:0;max-width:100%}
.red-z button[data-r="fit"]{width:auto;padding:0 10px;font-size:12.5px}.red-z button.on{background:var(--accent,#0B5FFF);color:#fff;border-color:var(--accent,#0B5FFF)}
.red-tt h3{display:flex;align-items:center;gap:6px}.red-pen{border:0;background:transparent;color:var(--muted,#5D6973);padding:4px;border-radius:6px;cursor:pointer;opacity:0;transition:opacity .15s}.red-tt:hover .red-pen,.red-pen:focus-visible{opacity:1}.red-pen:hover{color:var(--accent,#0B5FFF);background:var(--accent-soft,rgba(11,95,255,.1))}
.r-pen{opacity:0;cursor:pointer;transition:opacity .15s}.r-pen rect{fill:rgba(11,95,255,.92)}.r-pen path{fill:none;stroke:#fff;stroke-width:1.1;stroke-linejoin:round}.red-svg.ed .r-it:hover .r-pen{opacity:1}
.red-ren{position:absolute;z-index:5;padding:6px 9px;border:1.5px solid var(--accent,#0B5FFF);border-radius:8px;background:var(--glass-strong,#fff);color:var(--ink,#1B242B);font:600 15px var(--f-ui,system-ui);box-shadow:0 10px 30px -10px rgba(0,0,0,.4)}
.red-cl{list-style:none;margin:0;padding:0;display:grid;gap:4px;max-height:300px;overflow:auto}.red-cl button{display:grid;grid-template-columns:auto 1fr;gap:0 9px;width:100%;text-align:left;border:1px solid var(--line-strong,#c9cfd4);background:var(--glass-strong,#fff);color:inherit;border-radius:8px;padding:7px 10px;cursor:grab;font:inherit}
.red-cl button:hover{border-color:var(--accent,#0B5FFF)}.red-cl button:active{cursor:grabbing}.red-cl b{font-weight:600;font-size:13.5px}.red-cl span{grid-column:2;font-size:12px;opacity:.72}
.red-ci{grid-row:1/3;width:10px;height:26px;border-radius:3px;background:#5D6973;align-self:center}.red-ci.g-red{background:#0B5FFF}.red-ci.g-patcheras{background:#E6BE1E}.red-ci.g-switches{background:#0B5FFF}.red-ci.g-equipos{background:#2E9E5B}.red-ci.g-orden{background:#8D979F}
.r-dz{fill:rgba(11,95,255,.22);stroke:#0B5FFF;stroke-width:2;stroke-dasharray:6 4;pointer-events:none}.r-dz.no{fill:rgba(210,71,75,.2);stroke:#D2474B}
.red-mas{margin-top:8px}.red-mas summary{cursor:pointer;font-size:13px;color:var(--muted,#5D6973);margin-bottom:6px}
.red-mp{display:grid;gap:8px}.red-mp input{width:100%;padding:8px 10px;border:1px solid var(--line-strong,#c9cfd4);border-radius:8px;background:var(--glass-strong,#fff);color:inherit;font:inherit}
.red-mm{display:flex;gap:6px;flex-wrap:wrap}.red-mm button{border:1px solid var(--line-strong,#c9cfd4);background:transparent;color:inherit;border-radius:999px;padding:4px 11px;font:500 12.5px var(--f-ui,inherit);cursor:pointer}.red-mm button.on{background:var(--accent,#0B5FFF);border-color:var(--accent,#0B5FFF);color:#fff}
.red-ml{list-style:none;margin:0;padding:0;display:grid;gap:4px;max-height:260px;overflow:auto}.red-ml button{display:grid;gap:1px;width:100%;text-align:left;border:1px solid var(--line-strong,#c9cfd4);background:var(--glass-strong,#fff);color:inherit;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit}
.red-ml button:hover,.red-ml button:focus-visible{border-color:var(--accent,#0B5FFF);outline:none}.red-ml b{font-weight:600;font-size:13.5px}.red-ml span,.red-mod span{font-size:12px;opacity:.72}.red-mod{display:grid;gap:1px;margin:0 0 6px}
.red-fnew{margin:0 0 12px;align-items:center}

.red-on{width:min(1320px,calc(100% - 20px))!important;padding:0!important;overflow:hidden}.red-on:not([hidden]){display:block!important}
.red{display:flex;flex-direction:column;max-height:calc(100dvh - 104px);color:var(--ink,#1B242B);font-family:var(--f-ui,system-ui,sans-serif);font-size:14px}
.red *{box-sizing:border-box}.red-top,.red-tabs{flex:none}
.red-top{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:16px 18px 10px}
.red-eb{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted,#5D6973)}
.red-tt h3{margin:2px 0 1px;font-size:20px;line-height:1.2}.red-sub{color:var(--muted,#5D6973);font-size:13px}
.red-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.red select,.red input{font:inherit;color:inherit;background:var(--glass-strong,#fff);border:1px solid var(--line-strong,rgba(27,36,43,.17));border-radius:10px;padding:8px 10px;min-height:38px;max-width:100%}
.red select:focus-visible,.red input:focus-visible,.red button:focus-visible,.red a:focus-visible{outline:2px solid var(--accent,#0E9DB3);outline-offset:1px}
.red-q{position:relative}.red-q input{width:230px}
.red-b{display:inline-flex;align-items:center;gap:7px;font:inherit;font-weight:600;color:inherit;background:var(--glass-strong,#fff);border:1px solid var(--line-strong,rgba(27,36,43,.17));border-radius:10px;padding:8px 12px;min-height:38px;cursor:pointer}
.red-b:hover{border-color:var(--accent,#0E9DB3)}.red-b.pri{background:var(--accent,#0E9DB3);border-color:transparent;color:#fff}.red-b.pel{color:var(--crit,#D33D43)}
.red-x{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;border:1px solid var(--line-strong,rgba(27,36,43,.17));background:transparent;color:inherit;cursor:pointer}
.red-tabs{display:flex;gap:4px;align-items:center;padding:0 18px;border-bottom:1px solid var(--line,rgba(27,36,43,.09))}
.red-tabs>button[data-r=tab]{font:inherit;font-weight:600;color:var(--muted,#5D6973);background:none;border:0;border-bottom:2px solid transparent;padding:10px 12px;cursor:pointer}
.red-tabs>button.on{color:var(--ink,#1B242B);border-bottom-color:var(--accent,#0E9DB3)}
.red-tabs i{font-style:normal;font-size:12px;font-weight:600;background:var(--accent-soft,rgba(14,157,179,.12));color:var(--accent-ink,#08788A);border-radius:20px;padding:1px 7px;margin-left:4px}
.red-z{margin-left:auto;display:flex;gap:4px}.red-z button,.red-chk{font:inherit;font-weight:600;min-width:34px;height:32px;border-radius:9px;border:1px solid var(--line-strong,rgba(27,36,43,.17));background:var(--glass-strong,#fff);color:inherit;cursor:pointer}
.red-chk{margin-left:auto;padding:0 12px;white-space:nowrap}.red-tabs{overflow-x:auto}.red-tabs>button{white-space:nowrap}.red-chk.on{background:var(--accent,#0E9DB3);color:#fff;border-color:transparent}
.red-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.8fr)}
.red-body.uno{display:block;overflow:auto;padding:14px 18px 18px}
.red-fr{overflow:auto;padding:14px 10px 18px 18px;background:linear-gradient(180deg,rgba(0,0,0,.03),transparent 120px)}
.red-lado{overflow:auto;padding:14px 18px 20px;border-left:1px solid var(--line,rgba(27,36,43,.09))}
.red-svg{display:block;height:auto;min-width:100%;user-select:none;-webkit-user-select:none}
.r-marco{fill:#1a1d21;stroke:#0c0e10;stroke-width:1.5}.r-fondo{fill:#0b0d0f}.r-riel{fill:#2a2f35}.r-ag{fill:#07080a}
.r-u{font:600 9px var(--f-mono,ui-monospace,monospace);fill:#7c8791;text-anchor:middle}
.r-cara{stroke:rgba(0,0,0,.55);stroke-width:.8}.r-tor{fill:#0a0b0d;stroke:rgba(255,255,255,.14);stroke-width:.6}.r-pli{stroke:rgba(0,0,0,.28);stroke-width:.8}
.r-it{cursor:pointer}.r-it.on .r-cara{stroke:#35C2E0;stroke-width:2}.r-it.mov{opacity:.75}
.r-n{font:700 8.6px var(--f-ui,system-ui,sans-serif)}.r-m{font:500 6.4px var(--f-ui,system-ui,sans-serif)}
.r-num{font:600 5.4px var(--f-mono,ui-monospace,monospace);text-anchor:middle}
.r-hit{fill:transparent}.r-jk{fill:#0b0c0e;stroke:#4b535b;stroke-width:.5}.r-sfp{fill:#0b0c0e;stroke:#8d979f;stroke-width:.7}.r-plug{stroke:rgba(0,0,0,.45);stroke-width:.4}
.r-p{cursor:pointer}.r-p:hover .r-jk,.r-p:hover .r-sfp{stroke:#fff;stroke-width:1}.r-p.hot .r-jk,.r-p.hot .r-sfp{stroke:#35C2E0;stroke-width:1.3}.r-p.on .r-jk,.r-p.on .r-sfp{stroke:#fff;stroke-width:1.8}
.r-p.fo:hover circle,.r-p.fo.hot circle,.r-p.fo.on circle{stroke:#fff;stroke-width:1.2}.r-p.fo.on .r-plug{stroke:#fff;stroke-width:1.4}
.r-p.crit .r-led{animation:red-par 1s steps(2) infinite}@keyframes red-par{50%{opacity:.2}}
.r-ada{stroke:rgba(0,0,0,.5);stroke-width:.6}.r-etq{fill:#f3f4f2;stroke:#b9bfc4;stroke-width:.4}.r-et{font:600 4.3px var(--f-mono,ui-monospace,monospace);fill:#20262b;text-anchor:middle}
.r-bahia{fill:rgba(0,0,0,.32);stroke:rgba(255,255,255,.1);stroke-width:.6}.r-lcd{fill:#06181d;stroke:#274a55;stroke-width:.7}.r-rej{fill:rgba(0,0,0,.45)}.r-toma{fill:#1d2125;stroke:#555e66;stroke-width:1}.r-aro{fill:none;stroke:#3a4148;stroke-width:3;stroke-linecap:round}
.red-svg.ed [data-rp]{cursor:grab;touch-action:none}.red-svg.arr,.red-svg.arr *{cursor:grabbing!important}.r-tira{opacity:1!important;stroke-width:3!important}.red-svg [data-rp].r-no{filter:drop-shadow(0 0 4px #E5383B) drop-shadow(0 0 2px #E5383B);cursor:not-allowed}.red-svg [data-rp].r-dest{filter:drop-shadow(0 0 4px #0B5FFF) drop-shadow(0 0 2px #fff)}.r-pc0{fill:none;stroke:rgba(0,0,0,.42);stroke-width:3.4;pointer-events:none}.r-pc{fill:none;stroke-width:2.2;stroke-linecap:round;pointer-events:none;opacity:.74}
.r-pc0.on{stroke:#fff;stroke-width:5.6}.r-pc.on{stroke-width:3.2;opacity:1}.red-svg.sel .r-pc:not(.on){opacity:.3}.red-svg.sel .r-pc0:not(.on){opacity:.25}
.red-h small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#5D6973)}.red-h b{font-size:18px}
.red-sec{margin:16px 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#5D6973);font-weight:700}
.red-ch{list-style:none;margin:0;padding:0}.red-ch li{position:relative;padding:5px 0 5px 22px;line-height:1.35}
.red-ch li::before{content:"";position:absolute;left:7px;top:0;bottom:0;width:2px;background:var(--line-strong,rgba(27,36,43,.17))}.red-ch li:first-child::before{top:14px}.red-ch li:last-child::before{bottom:calc(100% - 14px)}
.red-ch li.p::after,.red-ch li.q::after{content:"";position:absolute;left:3px;top:10px;width:10px;height:10px;border-radius:3px;background:var(--glass-strong,#fff);border:2px solid var(--muted,#5D6973)}
.red-ch li.q::after{border-radius:50%;border-color:var(--ok,#1D9862);background:var(--ok,#1D9862)}.red-ch li.q.warn::after{border-color:var(--warn,#C08208);background:var(--warn,#C08208)}.red-ch li.q.crit::after{border-color:var(--crit,#D33D43);background:var(--crit,#D33D43)}.red-ch li.q.off::after{border-color:var(--muted,#5D6973);background:transparent}
.red-ch li.yo{background:var(--accent-soft,rgba(14,157,179,.12));border-radius:8px}.red-ch li.yo::after{border-color:var(--accent,#0E9DB3)}
.red-ch li.e{color:var(--muted,#5D6973);font-size:13px}.red-ch li.e i{display:inline-block;width:14px;height:5px;border-radius:3px;margin-right:7px;vertical-align:middle;border:1px solid rgba(0,0,0,.25)}
.red-ch a,.red-l a,.red-t a,.red-fib a{color:var(--accent-ink,#08788A);text-decoration:none;font-weight:600}.red-ch small,.red-l small{font:600 11px var(--f-mono,ui-monospace,monospace);color:var(--muted,#5D6973);margin-right:6px}
.red-ch li.p a{color:inherit;font-weight:500}.red-ch li.p a b{font-weight:700}
.red-f{display:block;margin:0 0 10px}.red-f>span{display:block;font-size:12.5px;color:var(--muted,#5D6973);margin-bottom:4px}.red-f small{font-size:11.5px}.red-f input,.red-f select{width:100%}
.red-g{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.red-g select{flex:1;min-width:0}.red-g2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.red-g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 10px;margin-top:10px}
.red-stp{display:flex;gap:4px}.red-stp select{flex:1;min-width:0}.red-stp .red-b{padding:8px 10px}
.red-rows{margin:10px 0}.red-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line,rgba(27,36,43,.09))}.red-row dt{color:var(--muted,#5D6973)}.red-row dd{margin:0;text-align:right;font-weight:600}
.red-ayuda,.red-nada{color:var(--muted,#5D6973);font-size:13px;line-height:1.45;margin:10px 0}.red-ayuda.on{color:var(--accent-ink,#08788A);font-weight:600}
.red-l{list-style:none;margin:0;padding:0}.red-l li{padding:6px 0;border-bottom:1px solid var(--line,rgba(27,36,43,.09))}.red-l i.crit{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--crit,#D33D43);margin-right:8px}
.red-l.pop{position:absolute;right:0;top:calc(100% + 6px);z-index:5;width:min(440px,86vw);max-height:300px;overflow:auto;background:var(--glass-strong,#fff);border:1px solid var(--line-strong,rgba(27,36,43,.17));border-radius:12px;padding:4px 12px;box-shadow:var(--shadow,0 12px 32px rgba(20,32,42,.14))}
.red-pill{font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px;background:var(--ok-soft,rgba(29,152,98,.12));color:var(--ok,#1D9862)}.red-pill.crit{background:var(--crit-soft,rgba(211,61,67,.12));color:var(--crit,#D33D43)}
.t-ok{color:var(--ok,#1D9862);font-weight:600}.t-warn{color:var(--warn,#C08208);font-weight:600}.t-crit{color:var(--crit,#D33D43);font-weight:600}.red-mut{color:var(--muted,#5D6973)}.red-mono{font-family:var(--f-mono,ui-monospace,monospace)}
.red-tw{overflow:auto;border:1px solid var(--line,rgba(27,36,43,.09));border-radius:12px}
.red-t{width:100%;border-collapse:collapse;font-size:13px}.red-t th{position:sticky;top:0;text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#5D6973);background:var(--glass-strong,#fff);padding:9px 10px;white-space:nowrap}
.red-t td{padding:8px 10px;border-top:1px solid var(--line,rgba(27,36,43,.09));vertical-align:top}.red-t .n{text-align:right;font-variant-numeric:tabular-nums}.red-t tr.lib td{color:var(--muted,#5D6973)}
.red-hc{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.3);box-shadow:0 0 0 1px rgba(255,255,255,.35);margin-right:7px;vertical-align:-2px}
.red-fib{margin-bottom:22px}.red-fib header{display:flex;gap:6px 14px;flex-wrap:wrap;align-items:baseline;margin-bottom:8px}.red-fib header b{font-size:16px}.red-fib header span{color:var(--muted,#5D6973);font-size:13px}
.red-hoja{display:none}
@media (max-width:860px){.red{max-height:calc(100dvh - 86px)}.red-top{flex-direction:column;gap:10px;padding:12px 12px 8px}.red-tools{justify-content:flex-start;width:100%}.red-tools>select{flex:1 1 0;min-width:0}.red-q{order:3;flex:1 1 100%}.red-q input{width:100%}.red-l.pop{left:0;right:auto}.red-b span{display:none}.red-x{position:absolute;top:10px;right:10px}
  .red-tabs{padding:0 8px}.red-body{display:block;overflow:auto}.red-fr{padding:10px 8px;overflow-x:auto;overflow-y:visible}.red-lado{border-left:0;border-top:1px solid var(--line,rgba(27,36,43,.09));overflow:visible;padding:14px 12px 24px}.red-body.uno{padding:10px}.red-g4{grid-template-columns:1fr 1fr}.red-tt h3{padding-right:44px}}
@media (prefers-reduced-motion:reduce){.r-p.crit .r-led{animation:none}}
@media print{html.red-imp,html.red-imp body{height:auto!important;overflow:visible!important;position:static!important;background:#fff!important}html.red-imp body>*:not(.red-hoja){display:none!important}
  html.red-imp .red-hoja{display:block!important;color:#111;font:12px/1.4 system-ui,sans-serif;padding:0}.red-hoja h1{font-size:20px;margin:0}.red-hoja h2{font-size:16px;margin:18px 0 2px}.red-hoja h3{font-size:13px;margin:12px 0 6px}.red-hoja .sub{color:#555;margin:2px 0 8px}
  .red-hoja section{break-inside:auto;page-break-inside:auto}.red-hoja .fr{max-width:150mm;break-inside:avoid}.red-hoja .red-svg{width:100%!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .red-hoja .red-tw{border:0;overflow:visible}.red-hoja .red-t{font-size:10px}.red-hoja .red-t th{position:static;background:#eee;color:#222;print-color-adjust:exact;-webkit-print-color-adjust:exact}.red-hoja .red-t td,.red-hoja .red-t th{border:1px solid #bbb;padding:3px 5px}.red-hoja .red-fib header span{color:#444}.red-hoja a{color:inherit;text-decoration:none}}
`; document.head.appendChild(s); }

window.OndiRed = { v: 1, CAT, pintar, cadena, filas, hilos, frente, arbol, alPrincipal };
})();

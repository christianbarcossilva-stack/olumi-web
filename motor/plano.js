// Motor común · el plano compartido entre las apps. Sin dependencias: lo usan el motor y la página de cada app.
// Un plano guardado es { v: 1, motor: 1, escena: { nombre, piezas: [...] }, ext: [...] } y es el mismo en Ondi y Olumi.
// Cada pieza es de un dominio, y eso decide qué app la muestra y cuál es su dueña:
//   base      → el predio: terreno, calles, construcciones, árboles, vehículos. Lo comparten todas.
//   logistica → patio: filas de contenedores, semirremolques, camiones, máquinas de patio.
//   equipos   → Ondi: cámaras, Wi-Fi, switches, racks, grabadores, routers, sensores, UPS, fibra.
//   acceso    → Kliva: puertas con control de acceso (puerta, portón, molinete, barrera), cada una enlazada a una puerta real.
// Un tipo nuevo que no sea del predio se anota acá (una sola vez) y queda bien en las tres apps.
const DE = { fila: 'logistica', chasis: 'logistica', camion: 'logistica', maquina: 'logistica',
  camara: 'equipos', ap: 'equipos', switch: 'equipos', rack: 'equipos', nvr: 'equipos', router: 'equipos', sensor: 'equipos', ups: 'equipos', fibra: 'equipos', acceso: 'acceso' };
export const DOMINIOS = { base: 'el predio', logistica: 'logística', equipos: 'equipos', acceso: 'control de acceso' };
export const dominio = p => DE[p && p.t] || 'base';
// qué muestra cada app. Lo que no muestra no se pierde: queda guardado en el plano para la app que sí lo usa.
export const VE = { ondi: ['base', 'logistica', 'equipos', 'acceso'], olumi: ['base', 'logistica', 'equipos', 'acceso'], kliva: ['base', 'acceso'] };
// lo propio de cada app: al traer un plano de otra, esto es lo que no se pisa
export const MIO = { ondi: 'equipos', kliva: 'acceso' };
export const ve = (app, p) => (VE[app] || VE.ondi).includes(dominio(p));
export const esPlano = s => !!(s && s.v === 1 && s.motor === 1 && s.escena && Array.isArray(s.escena.piezas));
export function cuenta(s) { const c = { base: 0, logistica: 0, equipos: 0, acceso: 0, total: 0 }; for (const p of (s && s.escena && s.escena.piezas) || []) { c[dominio(p)]++; c.total++; } return c; }

// Traer a esta app el plano de otra. De la otra viene todo menos lo que es propio de esta app, que queda como está
// (si esta app todavía no tiene nada propio, viene también lo de la otra). Devuelve el plano nuevo y qué pasó con cada parte.
export function traer(mio, otro, app, origen) {
  if (!esPlano(otro)) throw new Error('Ese plano no está hecho con el motor común.');
  const d = MIO[app], A = (esPlano(mio) ? mio.escena.piezas : []), B = otro.escena.piezas;
  const mias = d ? A.filter(p => dominio(p) === d) : [], ids = new Set(mias.map(p => p.id)), piezas = mias.map(p => ({ ...p }));
  let vienen = 0; for (const p of B) { if (mias.length && dominio(p) === d) continue; const q = JSON.parse(JSON.stringify(p));
    if (!q.id || ids.has(q.id)) { let i = 2; const b = q.id || q.t; while (ids.has(b + '-' + i)) i++; q.id = b + '-' + i; } ids.add(q.id); piezas.push(q); vienen++; }
  const uids = new Set(piezas.filter(p => p.uid).map(p => p.uid)), ext = []; for (const x of [...((mio && mio.ext) || []), ...(otro.ext || [])]) if (x && uids.has(x.uid) && !ext.some(y => y.uid === x.uid)) ext.push(x);
  const escena = { ...otro.escena, nombre: (esPlano(mio) && mio.escena.nombre) || otro.escena.nombre, piezas };
  // si lo mío era de un motor anterior, no se mezcla: queda guardado aparte (anterior) por si hay que volver
  const base = esPlano(mio) ? mio : (mio && Object.keys(mio).length ? { anterior: mio.anterior || mio } : {});
  return { plano: { ...base, v: 1, motor: 1, escena, ext, origen: origen || null }, vienen, quedan: mias.length, propio: d || null, habiaAnterior: !esPlano(mio) && !!(mio && Object.keys(mio).length) };
}

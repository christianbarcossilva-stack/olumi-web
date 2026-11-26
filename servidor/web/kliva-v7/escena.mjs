#!/usr/bin/env node
// La planta de la web de Kliva (v7): una fábrica chica de ejemplo, inventada, con sus puertas con control de acceso.
// uso: node escena.mjs [SALIDA]   · por defecto escribe motor/escenas/kliva-web-v7.json
// Metros. x crece a la derecha (este) y z hacia quien mira (sur, la calle). El edificio va de x −15 a 15 y de z −9 a 6.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const piezas = [], PI = Math.PI;
let n = 0; const id = t => t.slice(0, 3) + (++n).toString(36);
const pon = (t, o) => { const p = { id: o.id || id(t), t, ...o }; piezas.push(p); return p; };

// un muro recto con sus huecos [desde, hasta] medidos sobre el eje que cambia
function muro(x0, z0, x1, z1, huecos = [], o = {}) {
  const horiz = z0 === z1, a = horiz ? x0 : z0, b = horiz ? x1 : z1, tramos = []; let s = a;
  for (const [h0, h1] of [...huecos].sort((p, q) => p[0] - q[0])) { tramos.push([s, h0]); s = h1; } tramos.push([s, b]);
  for (const [t0, t1] of tramos) if (t1 - t0 > 0.05) pon('pared', { tipo: 'maciza', alto: 2.7, grosor: 0.15, color: '#e9e8e4', ...o, pts: horiz ? [[t0, z0], [t1, z0]] : [[x0, t0], [x0, t1]] });
}
const sala = (idp, nombre, x0, z0, x1, z1, piso, o = {}) => pon('recinto', { id: idp, nombre, tipo: 'sin', piso, luz: true, ...o, pts: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] });
const mueble = (modelo, x, z, r = 0, y = 0) => pon('mueble', { modelo, x, z, r, y });
const acc = (idp, nombre, clase, x, z, r = 0, o = {}) => pon('acceso', { id: idp, nombre, clase, x, z, r, puerta: idp, muro: false, ...o });

// ---------- el terreno, la calle y el predio ----------
pon('terreno', { id: 'ter1', nombre: '', mat: 'pasto', pts: [[-80, -60], [90, -60], [90, 70], [-80, 70]] });
pon('terreno', { id: 'ter2', nombre: '', mat: 'hormigon', pts: [[-21, -13], [24.5, -13], [24.5, 16], [-21, 16]] });
pon('calle', { id: 'cal1', nombre: '', ancho: 7, tipo: 'asfalto', linea: 'corta', pts: [[-80, 22], [90, 22]] });
pon('calle', { id: 'cal2', nombre: '', ancho: 6.4, tipo: 'hormigon', linea: 'no', pts: [[14, 18.6], [14, 15.6]] });
pon('vereda', { id: 'ver1', nombre: '', ancho: 1.6, pts: [[-40, 17.4], [9.6, 17.4]] });
pon('vereda', { id: 'ver2', nombre: '', ancho: 1.6, pts: [[18.4, 17.4], [44, 17.4]] });
pon('vereda', { id: 'ver3', nombre: '', ancho: 1.8, pts: [[-11.5, 15.6], [-11.5, 6.1]] });
// el cerco, con el paso de la portería y el del portón
pon('cerco', { id: 'cer1', tipo: 'malla', alto: 2.2, pts: [[-13.2, 16], [-21, 16], [-21, -13], [24.5, -13], [24.5, 16], [18.9, 16]] });
pon('cerco', { id: 'cer2', tipo: 'malla', alto: 2.2, pts: [[-9.8, 16], [3.6, 16]] });
pon('caseta', { id: 'cas1', nombre: 'Portería', estilo: 'vidriada', ancho: 2.4, fondo: 2.4, alto: 2.6, x: -8.2, z: 14.2, r: PI });
pon('cantero', { id: 'can1', nombre: '', ancho: 0.9, alto: 0.5, pts: [[-19.6, 14.9], [-13.6, 14.9]] });
pon('cantero', { id: 'can2', nombre: '', ancho: 0.9, alto: 0.5, pts: [[-5.6, 14.9], [3, 14.9]] });
pon('cantero', { id: 'can3', nombre: '', ancho: 0.8, alto: 0.45, pts: [[-7.4, 6.9], [5.4, 6.9]] });
for (const [x, z, tipo] of [[-17.5, 11.5, 'fronda'], [-2, 11.2, 'fronda'], [3.2, 11.8, 'fronda'], [-30, 14, 'fronda'], [-36, 30, 'pino'], [-24, 30.5, 'fronda'], [-6, 31, 'fronda'], [22, 30.4, 'fronda'], [40, 31, 'pino'], [34, 12, 'fronda'], [34, -4, 'pino'], [-30, -6, 'fronda'], [-12, -22, 'pino'], [8, -23, 'fronda'], [30, -22, 'fronda']])
  pon('arbol', { nombre: '', tipo, alto: tipo === 'pino' ? 0.9 : 0.75, x, z });
for (const [x, z] of [[-14.2, 12], [-8.8, 9.4], [10, 12.5], [21.5, 3], [21.5, -9]]) pon('farol', { nombre: '', alto: 3.6, x, z, r: 0 });
pon('columna', { nombre: '', alto: 8, focos: 1, x: -26, z: 18.6 }); pon('columna', { nombre: '', alto: 8, focos: 1, x: 6.4, z: 18.6 }); pon('columna', { nombre: '', alto: 8, focos: 1, x: 36, z: 18.6 });
pon('cartel', { id: 'crt1', nombre: '', ancho: 3.4, alto: 1.1, texto: 'Planta Ruta 5', fondo: '#1E1F23', tinta: '#9D7CFF', altura: 1.5, x: -3.2, z: 16.5, r: 0 });
// la playa de carga, pintada
pon('pintura', { nombre: '', tipo: 'continua', color: '#E5C35A', ancho: 0.14, pts: [[16.6, 14], [16.6, -11.6], [22.6, -11.6], [22.6, 14]] });
pon('rayado', { nombre: '', paso: 1.2, giro: 45, pts: [[16.9, -1.4], [22.3, -1.4], [22.3, -8.6], [16.9, -8.6]] });

// ---------- el edificio ----------
const F = { tipo: 'panel', alto: 3.4, grosor: 0.2, color: '#d9dde0', corte: 1.2 }, V = { tipo: 'cortina', alto: 3.2, color: '#dedbd5', corte: 'no', losa: true };
muro(-15, -9, 15, -9, [], F);                                   // fondo
muro(-15, -9, -15, 6, [], F);                                   // oeste
muro(15, -9, 15, 6, [[-5.6, -2.4]], F);                         // este, con el portón de la playa de carga
muro(-15, 6, 15, 6, [[-12.5, -10.5], [-8, 6]], { ...F, corte: 1.2 });   // frente: la entrada del hall y el vidriado de las oficinas
pon('pared', { id: 'fac1', ...V, pts: [[-8, 6], [6, 6]] });
// adentro
const I = { corte: 1.2 };
muro(-15, 1, 15, 1, [[-12.83, -10.84], [-1.48, -0.52], [10.02, 10.98]], I);   // hall y oficinas | pasillo y producción (molinetes, oficinas, depósito de repuestos)
muro(-8, -9, -8, 6, [[-2.5, 0.5]], I);                          // el paso del pasillo a producción
muro(-15, -3, -8, -3, [[-11.98, -11.02]], I);                   // vestuarios
muro(6, 1, 6, 6, [], I);                                        // oficinas | depósito de repuestos
sala('sal_hall', 'Hall de molinetes', -15, 1, -8, 6, 'porcelanato');
sala('sal_pas', 'Pasillo', -15, -3, -8, 1, 'porcelanato');
sala('sal_ves', 'Vestuarios', -15, -9, -8, -3, 'ceramica');
sala('sal_ofi', 'Administración', -8, 1, 6, 6, 'madera');
sala('sal_dep', 'Depósito de repuestos', 6, 1, 15, 6, 'hormigon');
sala('sal_pro', 'Producción', -8, -9, 15, 1, 'hormigon');

// ---------- las puertas con control de acceso ----------
acc('acc_port', 'Portería peatonal', 'puerta', -11.5, 16, 0, { muro: true });
acc('acc_min', 'Molinete de entrada', 'molinete', -12.2, 1, 0, { muro: true });
acc('acc_mout', 'Molinete de salida', 'molinete', -11.2, 1, 0, { muro: true });
acc('acc_ves', 'Vestuarios', 'puerta', -11.5, -3, 0);
acc('acc_adm', 'Administración', 'vidrio', -1, 1, PI);
acc('acc_dep', 'Depósito de repuestos', 'puerta', 10.5, 1, PI);
acc('acc_gate', 'Portón 2', 'porton', 14, 16, 0, { muro: true, ancho: 7 });
acc('acc_carga', 'Portón 1', 'doble', 15, -4, PI / 2, { ancho: 3.2 });
pon('panelacc', { id: 'rel1', nombre: 'Reloj de personal', x: 5, z: 0.86, y: 1.4, r: PI, puertas: 1 });   // el reloj de personal, en la pared de producción, camino a los puestos

// ---------- lo de adentro ----------
// hall: recepción
mueble('desk', -9.4, 4.4, -PI / 2); mueble('chairDesk', -8.8, 4.4, PI / 2); mueble('computerScreen', -9.5, 4.4, PI / 2, 0.76);
mueble('pottedPlant', -14.3, 5.3); mueble('loungeChair', -14.1, 3.2, PI / 2);
// vestuarios: los armarios contra el fondo y un banco
for (let i = 0; i < 7; i++) mueble('bookcaseClosedWide', -14.3 + i * 0.86, -8.55, 0);
mueble('table', -11.5, -6, 0); mueble('bathroomSinkSquare', -8.5, -7.6, -PI / 2); mueble('bathroomSinkSquare', -8.5, -6.4, -PI / 2);
// oficinas
for (const [x, z] of [[-5.6, 3.9], [-2.8, 3.9], [0.6, 3.9], [3.4, 3.9]]) { mueble('desk', x, z, 0); mueble('chairDesk', x, z - 0.6, 0); mueble('computerScreen', x, z + 0.18, PI, 0.76); }
mueble('bookcaseOpen', 5.6, 3.4, -PI / 2); mueble('pottedPlant', -7.3, 5.3); mueble('pottedPlant', 5.3, 1.7);
// depósito de repuestos: estantes y cajas
for (const x of [7.4, 9.2, 12.2, 14]) { mueble('bookcaseOpen', x, 5.5, PI); }
for (const z of [2.2, 3.2, 4.2]) mueble('bookcaseOpen', 14.5, z, -PI / 2);
for (const [x, z] of [[7.2, 2], [7.9, 2.1], [7.4, 2.8], [12.6, 3.4], [13.1, 3.9]]) mueble('cardboardBoxClosed', x, z, x);
// producción: tres líneas con sus puestos, las sendas pintadas y el reloj de personal en la entrada
for (const z of [-6.6, -3.6]) for (const x of [-3.6, 1.6, 6.8]) { mueble('tableCross', x, z, 0); mueble('tableCross', x + 1.9, z, 0); mueble('cardboardBoxClosed', x - 1.4, z + 0.2, 0.4); mueble('chair', x + 0.2, z + 0.9, PI); mueble('chair', x + 1.7, z - 0.9, 0); }
pon('pintura', { nombre: '', tipo: 'continua', color: '#E5C35A', ancho: 0.12, pts: [[-7.6, -1.6], [13.4, -1.6]] });
pon('pintura', { nombre: '', tipo: 'continua', color: '#E5C35A', ancho: 0.12, pts: [[-7.6, 0.2], [14.6, 0.2]] });
pon('pintura', { nombre: '', tipo: 'continua', color: '#E5C35A', ancho: 0.12, pts: [[13.4, -1.6], [13.4, -8.4]] });
mueble('trashcan', -7.5, -8.4); mueble('trashcan', 14.4, 0.6);
for (const [x, z, largo] of [[-11.5, 3.4, 2.4], [-11.5, -1, 2.4], [-11.5, -6, 2.8], [-1, 3.4, 3.2], [10.5, 3.4, 3.2], [-1.6, -5, 3.4], [3.6, -5, 3.4], [8.8, -5, 3.4]]) pon('luminaria', { nombre: '', largo, y: 2.5, x, z, r: 0 });

const escena = { nombre: 'Planta Ruta 5', inicio: { tx: -2, tz: 3, yaw: 0.5, pitch: 0.86, d: 52 }, piezas };
const sal = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'motor', 'escenas', 'kliva-web-v7.json');
writeFileSync(sal, JSON.stringify(escena));
console.log('escena en', sal, '·', piezas.length, 'piezas');

// Lo que no es la historia: sin maqueta en el teléfono (queda la foto), el arranque y las secciones en la compu, y «reducir movimiento». OUT=/tmp/k7
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servir } from './srv.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
// el sitio es este mismo repositorio; SITIO=/carpeta pone por delante una copia de trabajo (la página recién armada, una escena o una beta de la app sin publicar)
const RAICES = [...(process.env.SITIO ? [process.env.SITIO] : []), resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')], PAG = process.env.PAG || '/nuevo/kliva/';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
import { mkdirSync } from 'node:fs';
mkdirSync(process.env.OUT || '/tmp/k7', { recursive: true });
const s = await servir(RAICES);
const b = await chromium.launch({ args: GL });
const errs = [];
const oye = (p, n) => { p.on('pageerror', e => errs.push(n + ' pageerror ' + e.message)); p.on('console', m => m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text()) && errs.push(n + ' ' + m.text().slice(0, 200))); };
// 1) sin maqueta en el teléfono: queda la foto
{ const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); oye(p, 'sin3d');
  await p.route('**/motor/beta/index.html*', r => r.abort()); await p.goto(s.url + PAG, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(16000);
  console.log('sin3d', await p.evaluate(() => document.querySelector('#historia').className)); await p.screenshot({ path: (process.env.OUT || '/tmp/k7') + '/v-sin3d.png' });
  await p.evaluate(() => scrollTo(0, window.__klivaHist.y(2))); await p.waitForTimeout(1200); await p.screenshot({ path: (process.env.OUT || '/tmp/k7') + '/v-sin3d-2.png' }); await ctx.close(); }
// 2) arriba de todo y las secciones, en la compu
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); oye(p, 'compu');
  await p.goto(s.url + PAG, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction("document.querySelector('#historia').classList.contains('ready')", null, { timeout: 150000 }); await p.waitForTimeout(5000);
  await p.screenshot({ path: (process.env.OUT || '/tmp/k7') + '/v-arriba.png' });
  for (const q of ['#marcas', '#familia', '#datos', '#preguntas']) { await p.evaluate(q => document.querySelector(q).scrollIntoView(), q); await p.waitForTimeout(1600); await p.screenshot({ path: `${process.env.OUT || '/tmp/k7'}/v-${q.slice(1)}.png` }); }
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(1500); await p.screenshot({ path: (process.env.OUT || '/tmp/k7') + '/v-pie.png' });
  console.log('riel al pie', await p.evaluate(() => document.querySelector('#dia').classList.contains('v')), 'ancho', await p.evaluate(() => [innerWidth, document.documentElement.scrollWidth]));
  await ctx.close(); }
// 3) con «reducir movimiento»
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); oye(p, 'quieto');
  await p.goto(s.url + PAG, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction("document.querySelector('#historia').classList.contains('ready')", null, { timeout: 150000 }); await p.waitForTimeout(3000);
  for (const i of [2, 4]) { await p.evaluate(i => scrollTo(0, window.__klivaHist.y(i)), i); await p.waitForTimeout(2600); await p.screenshot({ path: `${process.env.OUT || '/tmp/k7'}/v-quieto-${i}.png` }); }
  console.log('quieto', await p.evaluate(() => JSON.stringify([window.__klivaHist.camion, window.__klivaHist.chip, window.__klivaHist.puertas.acc_gate])));
  await ctx.close(); }
console.log('errores', errs.length, errs.slice(0, 8));
await b.close(); s.cerrar();

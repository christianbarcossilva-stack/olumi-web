// Recorre la página y saca una foto por escena. env: PAG=/nuevo/kliva/ (o /kliva/) W H TEMA=dia MOVIL=1 REDUCE=1 SOLO=0,2 MID=2.5 SECC='#marcas' ESPERA(ms) OUT=/tmp/k7 SITIO=/copia
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servir } from './srv.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
// el sitio es este mismo repositorio; SITIO=/carpeta pone por delante una copia de trabajo (la página recién armada, una escena o una beta de la app sin publicar)
const RAICES = [...(process.env.SITIO ? [process.env.SITIO] : []), resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')], PAG = process.env.PAG || '/nuevo/kliva/';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
import { mkdirSync } from 'node:fs';
const E = process.env, W = +(E.W || 1440), Hh = +(E.H || 900), OUT = E.OUT || '/tmp/k7', ESPERA = +(E.ESPERA || 2600);
mkdirSync(OUT, { recursive: true });
const s = await servir(RAICES);
const b = await chromium.launch({ args: GL });
const ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1, isMobile: !!E.MOVIL, hasTouch: !!E.MOVIL, reducedMotion: E.REDUCE ? 'reduce' : 'no-preference' });
if (E.TEMA === 'dia') await ctx.addInitScript(() => { try { localStorage.setItem('kliva.web', 'light'); } catch (e) {} });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 240)));
p.on('requestfailed', r => errs.push('falló ' + r.url().slice(0, 120)));
await p.goto(s.url + PAG, { waitUntil: 'domcontentloaded' });
const sin3d = !!E.SIN3D;
if (!sin3d) await p.waitForFunction("document.querySelector('#historia').classList.contains('ready')", null, { timeout: 150000 }).catch(() => errs.push('la maqueta no llegó a estar lista'));
await p.waitForTimeout(4200);
const N = await p.evaluate(() => document.querySelectorAll('#historia .ch').length);
const solo = E.SOLO ? E.SOLO.split(',').map(Number) : [...Array(N).keys()];
const foto = async n => { await p.screenshot({ path: `${OUT}/${n}.png` }); };
for (const i of solo) {
  const y = await p.evaluate(i => window.__klivaHist.y(i), i);
  await p.evaluate(y => scrollTo(0, y), y);
  await p.waitForTimeout(i === 4 || i === 5 ? ESPERA + 5200 : ESPERA);
  await p.waitForFunction('!window.__klivaHist.anda', null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(500); await foto('e' + i);
  if (i === 5) { await p.waitForTimeout(3600); await foto('e5b'); }
}
for (const m of (E.MID ? E.MID.split(',').map(Number) : [])) {
  const [y0, y1] = await p.evaluate(m => [window.__klivaHist.y(Math.floor(m)), window.__klivaHist.y(Math.floor(m) + 1)], m);
  await p.evaluate(y => scrollTo(0, y), y0 + (y1 - y0) * (m % 1)); await p.waitForTimeout(ESPERA);
  await p.waitForFunction('!window.__klivaHist.anda', null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(400); await foto('m' + String(m).replace('.', '_'));
}
for (const q of (E.SECC ? E.SECC.split(',') : [])) { await p.evaluate(q => document.querySelector(q).scrollIntoView(), q); await p.waitForTimeout(1500); await foto('s' + q.replace(/\W/g, '')); }
console.log('estado', await p.evaluate(() => JSON.stringify({ S: window.__klivaHist.S, act: window.__klivaHist.act, r: window.__klivaHist.r, camion: window.__klivaHist.camion, chip: window.__klivaHist.chip, w: innerWidth, sw: document.documentElement.scrollWidth })));
console.log('errores', errs.length, errs.slice(0, 8));
await b.close(); s.cerrar();

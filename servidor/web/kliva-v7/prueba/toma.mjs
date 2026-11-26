// Prueba tomas de cámara sin tocar el guion: node toma.mjs W H "i:x,z,giro,inclinación,distancia,corrimiento;i:..." [esperas en ms, separadas por coma] [dia] [movil]   · deja tW-i-n.png en OUT (/tmp/k7)
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
const [W, Hh, tomas, esperas = '3000', tema = '', movil = ''] = process.argv.slice(2);
const s = await servir(RAICES);
const b = await chromium.launch({ args: GL });
const ctx = await b.newContext({ viewport: { width: +W, height: +Hh }, isMobile: !!movil, hasTouch: !!movil });
if (tema === 'dia') await ctx.addInitScript(() => { try { localStorage.setItem('kliva.web', 'light'); } catch (e) {} });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(s.url + PAG, { waitUntil: 'domcontentloaded' });
await p.waitForFunction("document.querySelector('#historia').classList.contains('ready')", null, { timeout: 150000 });
await p.waitForTimeout(3500);
let n = 0;
for (const t of tomas.split(';')) { const [i, v] = t.split(':'), a = v ? v.split(',').map(Number) : null;
  await p.evaluate(([i, a, ang]) => { const h = window.__klivaHist; if (a) { if (ang) { h.ANG[i] = {}; a.forEach((x, j) => { h.ANG[i][j] = x; }); } else h.T[i] = a; } scrollTo(0, h.y(i)); h.mover(); }, [+i, a, !!movil]);
  for (const e of esperas.split(',')) { await p.waitForTimeout(+e); await p.screenshot({ path: `${process.env.OUT || '/tmp/k7'}/t${W}-${i}-${n++}.png` }); } }
await b.close(); s.cerrar();

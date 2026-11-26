// Las fotos de la planta para cuando no hay maqueta (teléfono con poca memoria o sin 3D): node foto.mjs DESTINO   · DESTINO es kliva/img/ del sitio; salen planta-noche, planta-dia y sus dos «-m» (teléfono)
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servir } from './srv.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
// el sitio es este mismo repositorio; SITIO=/carpeta pone por delante una copia de trabajo (la página recién armada, una escena o una beta de la app sin publicar)
const RAICES = [...(process.env.SITIO ? [process.env.SITIO] : []), resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')], PAG = process.env.PAG || '/nuevo/kliva/';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
import { writeFileSync, mkdirSync } from 'node:fs';
const dest = process.argv[2]; mkdirSync(dest, { recursive: true });
const s = await servir(RAICES);
const b = await chromium.launch({ args: GL });
for (const [nombre, w, h, dsf, tema] of [['planta-noche', 1600, 1000, 1, ''], ['planta-dia', 1600, 1000, 1, 'dia'], ['planta-noche-m', 430, 932, 2, ''], ['planta-dia-m', 430, 932, 2, 'dia']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, reducedMotion: 'reduce' });
  if (tema) await ctx.addInitScript(() => { try { localStorage.setItem('kliva.web', 'light'); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto(s.url + PAG, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction("document.querySelector('#historia').classList.contains('ready')", null, { timeout: 150000 });
  await p.waitForTimeout(5000); await p.waitForFunction('!window.__klivaHist.anda', null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(2500);
  const u = await p.evaluate(() => { const M = document.querySelector('#pla').contentWindow.__maqueta.motor; if (M.post) M.post.dibujar(M.scene, M.cam); else M.renderer.render(M.scene, M.cam); return [M.canvas.toDataURL('image/webp', .84), M.canvas.width, M.canvas.height]; });
  writeFileSync(`${dest}/${nombre}.webp`, Buffer.from(u[0].split(',')[1], 'base64')); console.log(nombre, u[1], u[2], Math.round(u[0].length * .75 / 1024) + ' KB');
  await ctx.close(); }
await b.close(); s.cerrar();

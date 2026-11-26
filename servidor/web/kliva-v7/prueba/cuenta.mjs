// La página de cuenta (/kliva/cuenta/) y la barra de la web con «Entrar»: fotos en OUT (/tmp/k7-cuenta) y prueba de cómo arma las direcciones.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { servir } from './srv.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.env.OUT || '/tmp/k7-cuenta'; mkdirSync(OUT, { recursive: true });
const s = await servir([resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')]);
const b = await chromium.launch(); const errs = [];
for (const [n, w, h, movil, tema] of [['c1440', 1440, 900, 0, ''], ['c1440d', 1440, 900, 0, 'light'], ['t390', 390, 844, 1, ''], ['t390d', 390, 844, 1, 'light']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: !!movil, hasTouch: !!movil });
  if (tema) await ctx.addInitScript(() => localStorage.setItem('kliva.web', 'light'));
  await ctx.addInitScript(() => localStorage.setItem('kliva.servidores', JSON.stringify(['https://kliva.ejemplo.com/', 'http://192.168.1.20:8088/'])));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(n + ' ' + e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_/.test(m.text()) && errs.push(n + ' ' + m.text().slice(0, 160)));
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await p.goto(s.url + '/kliva/cuenta/'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
  if (n === 'c1440') { await p.click('#tabEntra'); await p.fill('#mail', 'x'); await p.fill('#pass', '1'); await p.click('#bCta'); await p.screenshot({ path: `${OUT}/${n}-entra.png` });
    console.log('arma', JSON.stringify(await p.evaluate(() => ['kliva.tuempresa.com', '192.168.1.20', '192.168.1.20:9000', 'servidor', 'https://k.x.com/', 'http://10.0.0.5:8088', 'ftp://x', 'a b'].map(t => [t, window.__klivaCuenta.armar(t)])))); }
  if (movil || n === 'c1440') { await p.goto(s.url + '/kliva/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/${n}-kliva.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 140) } });
    console.log(n, 'desborde', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
  await ctx.close();
}
console.log('errores', errs); await b.close(); s.cerrar();

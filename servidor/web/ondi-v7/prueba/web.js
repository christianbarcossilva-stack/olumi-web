// recorre la historia de nuevo/ondi/ y saca una captura por escena: OUT=/tmp/x W=1440 H=900 TEMA=noche|dia MOVIL=1 node web.js
const { chromium, devices } = require('playwright'), srv = require('./srv.js'), path = require('path'), fs = require('fs');
const WEB = path.resolve(__dirname, '../../../..'), OUT = process.env.OUT || '/tmp/ondiweb', W = +process.env.W || 1440, Hh = +process.env.H || 900, TEMA = process.env.TEMA || 'noche';
(async () => { fs.mkdirSync(OUT, { recursive: true }); const s = await srv([WEB], (+process.env.PUERTO||8792)), br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const opt = process.env.DEV ? { ...devices[process.env.DEV] } : { viewport: { width: W, height: Hh } };
  const ctx = await br.newContext({ ...opt, reducedMotion: process.env.QUIETO ? 'reduce' : 'no-preference' }); await ctx.addInitScript(t => { try { localStorage.setItem('ondi.web.tema', t) } catch (e) {} }, TEMA);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()) });
  await pg.goto('http://127.0.0.1:'+(+process.env.PUERTO||8792)+'/nuevo/ondi/'); const t0 = Date.now();
  await pg.waitForFunction(() => document.querySelector('#cine').classList.contains('ready') || document.querySelector('#cine').classList.contains('sin3d'), null, { timeout: 150000 }).catch(() => {});
  console.log('lista en', ((Date.now() - t0) / 1000).toFixed(0), 's', await pg.evaluate(() => document.querySelector('#cine').className));
  await pg.waitForTimeout(6000);
  const n = await pg.evaluate(() => document.querySelectorAll('#cine .ch').length), sx = [];
  for (let i = 0; i < n; i++) { await pg.evaluate(i => scrollTo({ top: __ondiHist.y(i), behavior: 'instant' }), i); await pg.waitForTimeout(4500); sx.push(await pg.evaluate(() => __ondiHist.est.concat(+__ondiHist.S.toFixed(2)))); await pg.screenshot({ path: `${OUT}/e${i}.png` }); }
  for (const q of (process.env.SECC || '#conexiones,#planes,#probar').split(',')) { await pg.evaluate(q => document.querySelector(q).scrollIntoView({ behavior: 'instant' }), q); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${OUT}/s-${q.slice(1)}.png` }); }
  const ancho = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(JSON.stringify(sx)); console.log('scroll al costado', ancho, 'errores', errs.slice(0, 8)); await br.close(); s.close(); })();

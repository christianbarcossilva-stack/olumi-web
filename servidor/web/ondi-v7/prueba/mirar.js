// mira la escena del parque en el motor beta desde varias tomas: node mirar.js OUT "tx,tz,yaw,pitch,d;..." [hora]
const { chromium } = require('playwright'), srv = require('./srv.js'), path = require('path');
const WEB = path.resolve(__dirname, '../../../..'), OUT = process.argv[2] || '/tmp/ow', TOMAS = (process.argv[3] || '0,4,.72,.78,230').split(';').map(t => t.split(',').map(Number)), HORA = process.argv[4] || 'dia';
(async () => { require('fs').mkdirSync(OUT, { recursive: true }); const s = await srv([WEB], 8791), br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8791/motor/beta/index.html?app=ondi&escena=ondi-web&nuevo=1&ver=1&embebida=1&tema=claro');
  await pg.waitForFunction(() => window.__maqueta && window.__maqueta.motor, null, { timeout: 120000 });
  await pg.addStyleTag({ content: 'body>*:not(#m3d){display:none!important}' });
  await pg.evaluate(h => { const M = __maqueta.motor; try { __maqueta.XT.presentar(false) } catch (e) {} M.ponerHora(h); }, HORA); await pg.waitForTimeout(20000);
  for (let i = 0; i < TOMAS.length; i++) { const [tx, tz, yaw, pitch, d] = TOMAS[i]; await pg.evaluate(c => { const M = __maqueta.motor; M.ir({ tx: c[0], tz: c[1], yaw: c[2], pitch: c[3], d: c[4] }, .001); M.dirty = true; }, TOMAS[i]); await pg.waitForTimeout(2500); await pg.screenshot({ path: `${OUT}/t${i}.png` }); }
  console.log('errores', errs.slice(0, 5)); await br.close(); s.close(); })();

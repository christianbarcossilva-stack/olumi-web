// Revisión de pantallas de Ondi antes de subir un cambio.
// Recorre el ingreso, la demostración y la pantalla de un cliente en compu, tablet y celular, claro y oscuro,
// menú grande y achicado, y avisa: errores de la página, páginas que se salen de costado, cosas que se salen de su
// tarjeta (menú, encabezado, pestañas) y botones del menú del celular más altos de lo normal. Deja las capturas en una carpeta.
// Uso: node servidor/revisar_pantallas.js [http://127.0.0.1:8766] [carpeta]   (con un servidor local sirviendo el repo)
// Necesita playwright. El menú de quien trabaja en una empresa (grupos y «Mis clientes») se simula sobre la demostración.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, ''), OUT = process.argv[3] || 'revision-pantallas';
fs.mkdirSync(OUT, { recursive: true });
const EQUIPOS = [
  { n: 'compu', vp: { width: 1440, height: 900 } }, { n: 'compu-chica', vp: { width: 1180, height: 760 } },
  { n: 'ipad', d: devices['iPad (gen 7)'] }, { n: 'iphone', d: devices['iPhone 13'] }, { n: 'android', d: devices['Pixel 5'] }];
const PANTALLAS = [{ n: 'ingreso', url: '/ondi/beta/' }, { n: 'demo', url: '/ondi/beta/#demo' }, { n: 'cliente', url: '/ondi/beta/#demo', abrir: true }];

// el menú de quien trabaja en una empresa: Panel, Clientes con «Mis clientes», Documentación y los grupos
function simularMenu() {
  for (const nav of document.querySelectorAll('.side .nav, .mnav')) { const b = nav.querySelector('button:not(.navg):not(.tema)'); if (!b) continue;
    const mk = t => { const x = b.cloneNode(true), s = x.querySelector('span'); if (s) s.textContent = t; else x.textContent = t; x.removeAttribute('aria-current'); return x; };
    const sub = document.createElement('button'); sub.className = 'navg sub'; sub.innerHTML = '<span>Mis clientes · 5</span>';
    const cli = document.createElement('div'); cli.className = 'navgb navcli'; for (const t of ['Parque logístico', 'Depósito central', 'Planta 2', 'Oficinas']) cli.appendChild(mk(t));
    const g = document.createElement('button'); g.className = 'navg'; g.innerHTML = '<span>Herramientas</span>'; const gb = document.createElement('div'); gb.className = 'navgb'; gb.append(mk('Simulación'), mk('Pedidos'));
    const g2 = document.createElement('button'); g2.className = 'navg'; g2.innerHTML = '<span>Administración</span>'; const gb2 = document.createElement('div'); gb2.className = 'navgb'; gb2.append(mk('Ajustes'), mk('Unity Tech'));
    const ref = nav.querySelector('.tema') || null; for (const e of [mk('Panel'), mk('Clientes'), sub, cli, mk('Documentación'), g, gb, g2, gb2]) nav.insertBefore(e, ref); } }

// lo que se sale de su lugar
function medir() {
  const P = [], W = innerWidth, vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  if (document.documentElement.scrollWidth > W + 1) P.push(`la página se sale de costado (${document.documentElement.scrollWidth} px en ${W})`);
  for (const caja of document.querySelectorAll('.side, .mtop, .shead, .srow, .card, .maqbar')) { if (!vis(caja)) continue; const R = caja.getBoundingClientRect(), sc = getComputedStyle(caja);
    if (/(auto|scroll|hidden)/.test(sc.overflowX)) continue;
    for (const e of caja.querySelectorAll('button, a, h1, h2, input, select, .navpill')) { if (!vis(e)) continue; const r = e.getBoundingClientRect();
      if (r.right > R.right + 1.5 || r.left < R.left - 1.5) { P.push(`se sale de ${caja.className.split(' ')[0]}: «${(e.textContent || e.value || e.className).trim().slice(0, 30)}»`); break; } } }
  const altos = [...document.querySelectorAll('.mnav button')].filter(vis).map(e => e.getBoundingClientRect().height); if (altos.some(h => h > 52)) P.push(`botones del menú del celular de ${Math.round(Math.max(...altos))} px de alto`);
  for (const e of document.querySelectorAll('.side .nav button span')) { if (!vis(e)) continue; if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).whiteSpace === 'nowrap') { P.push(`texto cortado en el menú: «${e.textContent.trim()}»`); break; } }
  return P;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let total = 0; const filas = [];
  for (const eq of EQUIPOS) for (const tema of ['light', 'dark']) for (const mini of eq.d ? [''] : ['', '1']) for (const pa of PANTALLAS) {
    const ctx = await b.newContext({ ...(eq.d || { viewport: eq.vp }), colorScheme: tema }), p = await ctx.newPage(), err = [];
    p.on('pageerror', e => err.push('error: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|fonts|ERR_/.test(m.text())) err.push('consola: ' + m.text().slice(0, 120)); });
    await p.addInitScript(m => { try { localStorage.setItem('ondi.mini', m); } catch (e) {} }, mini);
    await p.goto(BASE + pa.url, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    if (pa.abrir) { const c = await p.$('[data-sim], .card[data-site], .card'); if (c) { await c.click().catch(() => {}); await p.waitForTimeout(2500); } }
    if (pa.n !== 'ingreso') await p.evaluate(simularMenu).catch(() => {}); await p.waitForTimeout(300);
    const prob = [...err, ...(await p.evaluate(medir).catch(e => ['no se pudo medir: ' + e.message]))];
    const nombre = `${pa.n}-${eq.n}-${tema === 'dark' ? 'oscuro' : 'claro'}${mini ? '-menu-chico' : ''}`;
    await p.screenshot({ path: path.join(OUT, nombre + '.png'), timeout: 60000 }).catch(e => prob.push('no se pudo sacar la captura')); await ctx.close();
    total += prob.length; filas.push((prob.length ? '✗ ' : '✓ ') + nombre + (prob.length ? '\n    ' + prob.join('\n    ') : ''));
  }
  await b.close(); console.log(filas.join('\n')); console.log(total ? `\n${total} problemas. Capturas en ${OUT}/` : `\nSin problemas. Capturas en ${OUT}/`); process.exit(total ? 1 : 0);
})();

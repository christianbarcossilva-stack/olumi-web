// La parte de planes y pago de /kliva/cuenta/ con una sesión y un servidor de mentira: fotos en OUT (/tmp/k7-pago)
// y qué le manda la página a mp-suscribir. No toca Supabase ni Mercado Pago.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { servir } from './srv.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.env.OUT || '/tmp/k7-pago'; mkdirSync(OUT, { recursive: true });
const s = await servir([resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')]);
const b = await chromium.launch(); const errs = [];
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'ana@frigosur.uy', user_metadata: { name: 'Ana Pérez, Frigorífico del Sur' } };
const sesion = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user };
const PLANES = [['basico', 'Básico', 39, 47.58, 1], ['pro', 'Pro', 99, 120.78, 2], ['empresa', 'Empresa', 199, 242.78, 3], ['instaladora', 'Instaladora', 299, 364.78, 4]]
  .map(([id, nombre, precio_usd, monto, orden]) => ({ id, nombre, precio_usd, monto, extra_monto: 6.1, orden }));

async function caso(n, { w = 1440, h = 900, movil = 0, orgs = [], estado = { etapa: 'gratis' }, url = '/kliva/cuenta/', accion }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: !!movil, hasTouch: !!movil });
  await ctx.addInitScript((se) => localStorage.setItem('sb-pgriavmcmscchxdnfglv-auth-token', se), JSON.stringify(sesion));
  const p = await ctx.newPage(); const mandado = [];
  p.on('pageerror', e => errs.push(n + ' ' + e.message)); p.on('console', m => m.type() === 'error' && !/fonts|ERR_|status of 4/.test(m.text()) && errs.push(n + ' ' + m.text().slice(0, 160)));
  await p.route(/supabase\.co/, async (r) => {
    const u = r.request().url(), j = (b, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (/auth\/v1\/user/.test(u)) return j(user);
    if (/cobro_planes/.test(u)) return j(PLANES);
    if (/rest\/v1\/members/.test(u)) return j(orgs.map(o => ({ org_id: o.id, role: 'owner', orgs: { name: o.name } })));
    if (/rpc\/cobro_estado/.test(u)) return j(typeof estado === 'function' ? estado(JSON.parse(r.request().postData())) : estado);
    if (/rpc\/create_org/.test(u)) { mandado.push(['create_org', JSON.parse(r.request().postData())]); return j('org-nueva'); }
    if (/suscripciones/.test(u)) return j({ mp_status: estado.etapa === 'al_dia' ? 'authorized' : null });
    if (/mp-suscribir/.test(u)) { mandado.push(['mp-suscribir', JSON.parse(r.request().postData())]); return j({ url: s.url + '/kliva/?mp=ok' }); }
    return j({});
  });
  await p.goto(s.url + url); await p.waitForTimeout(1500);
  if (accion) await accion(p);
  const fuera = !p.url().includes('/cuenta/');
  if (!fuera) await p.locator('#planes').screenshot({ path: `${OUT}/${n}.png` });
  console.log(n, JSON.stringify({ ...(fuera ? {} : { estado: await p.textContent('#estadoT'), total: await p.textContent('#tot'), iva: await p.textContent('#totIva'), msg: await p.textContent('#mPago') }), mandado, fue: p.url().replace(s.url, ''), desborde: await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) }));
  await ctx.close();
}

// 1. Cuenta nueva sin empresa: pro, anual, 3 extra → crea la empresa y pide el pago
await caso('nueva', { accion: async (p) => { await p.click('#cAno'); await p.click('.plan:nth-child(2)'); for (let i = 0; i < 3; i++) await p.click('#xMas'); await p.screenshot({ path: `${OUT}/nueva-antes.png`, fullPage: true }); await p.click('#bPagar'); await p.waitForTimeout(1200); } });
// 2. Fundador (Phitel): no se puede pagar
await caso('fundador', { orgs: [{ id: 'o1', name: 'Phitel' }], estado: { etapa: 'fundador', plan: 'empresa' } });
// 3. Al día
await caso('aldia', { orgs: [{ id: 'o2', name: 'Frigorífico del Sur' }], estado: { etapa: 'al_dia', plan: 'pro', pago_hasta: '2026-12-28T10:00:00Z' } });
// 4. Vuelta de Mercado Pago, todavía sin confirmar y después confirmado
let vueltas = 0;
await caso('vuelta', { orgs: [{ id: 'o2', name: 'Frigorífico del Sur' }], url: '/kliva/cuenta/?pago=mp', estado: () => (++vueltas > 2 ? { etapa: 'al_dia', plan: 'basico', pago_hasta: '2026-12-28T10:00:00Z' } : { etapa: 'gratis' }),
  accion: async (p) => { console.log('vuelta-espera', await p.textContent('#estadoT')); await p.waitForTimeout(11000); } });
// 5. Atrasado, en el teléfono
await caso('atrasado-390', { w: 390, h: 844, movil: 1, orgs: [{ id: 'o2', name: 'Frigorífico del Sur' }], estado: { etapa: 'atrasado', plan: 'pro', pago_hasta: '2026-11-20T10:00:00Z', suspende_el: '2026-12-04T10:00:00Z' } });
console.log('errores', errs); await b.close(); s.cerrar();

// Unity Tech · crear o cancelar la suscripción de una empresa en Mercado Pago (versión 6).
// Una sola cuenta de Mercado Pago para Olumi, Ondi y Kliva: body.app = 'olumi' | 'ondi' | 'kliva'
// (si no viene, es Olumi, como hasta la versión 5).
// Secretos (Edge Functions → Secrets): MP_ACCESS_TOKEN y SITE_URL (la dirección de Olumi, como antes).
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const ANON_KEY = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

const MP = 'https://api.mercadopago.com';
const APPS = { olumi: 'Olumi', ondi: 'Ondi', kliva: 'Kliva' };
// A dónde vuelve el cliente después de pagar
const VUELTA = {
  olumi: (site) => `${site}/app/?pago=mp`,
  ondi: () => 'https://unitytech.uy/ondi/app/?pago=mp',
  kliva: () => 'https://unitytech.uy/kliva/cuenta/?pago=mp',
};
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const r2 = (n) => Math.round(n * 100) / 100;

// Cotización del dólar: BROU, dólar billete, venta (la de la pizarra). Se guarda en cobro_ajustes.
async function brou() {
  const r = await fetch('https://www.brou.com.uy/cotizaciones', { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) return null;
  const t = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&oacute;/g, 'ó').replace(/\s+/g, ' ');
  const m = t.match(/Dólar\s+([\d.]+,\d+)\s+([\d.]+,\d+)/);   // la primera fila «Dólar» (no la de eBROU)
  const n = m ? Number(m[2].replace(/\./g, '').replace(',', '.')) : NaN;
  return n > 10 && n < 200 ? n : null;
}
async function cotizacion(db) {
  const { data } = await db.from('cobro_ajustes').select('valor').eq('clave', 'cotizacion').maybeSingle();
  const c = data?.valor || {};
  if (c.usd_uyu && c.fecha && Date.now() - Date.parse(c.fecha) < 2 * 86400e3) return Number(c.usd_uyu);
  const v = await brou();
  if (v) { await db.from('cobro_ajustes').update({ valor: { ...c, usd_uyu: v, fecha: new Date().toISOString() } }).eq('clave', 'cotizacion'); return v; }
  return c.usd_uyu ? Number(c.usd_uyu) : null;   // si el BROU no contesta, la última que se guardó
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  const site = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
  if (!token || !site) return json({ error: 'Falta configurar Mercado Pago en el servidor.' }, 500);

  const url = Deno.env.get('SUPABASE_URL');
  const userDb = createClient(url, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const db = createClient(url, SERVICE_KEY);

  const body = await req.json().catch(() => ({}));
  const app = APPS[body.app] ? String(body.app) : 'olumi';
  const org = String(body.org || '');
  const { data: m } = await db.from('members').select('role').eq('org_id', org).eq('user_id', user.id).maybeSingle();
  if (!m || !['owner', 'admin'].includes(m.role)) return json({ error: 'Solo el dueño o un administrador puede cambiar el plan.' }, 403);
  const { data: o } = await db.from('orgs').select('id,name,mp_preapproval_id,founder').eq('id', org).single();
  const { data: s } = app === 'olumi' ? { data: null }
    : await db.from('suscripciones').select('*').eq('org_id', org).eq('app', app).maybeSingle();
  const preId = app === 'olumi' ? o.mp_preapproval_id : s?.mp_preapproval_id;
  const mp = (path, init = {}) => fetch(MP + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });

  if (body.accion === 'cancelar') {
    if (!preId) return json({ error: 'No hay una suscripción activa.' }, 400);
    const r = await mp(`/preapproval/${preId}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    if (!r.ok) return json({ error: 'Mercado Pago no permitió cancelar. Probá de nuevo.' }, 502);
    if (app === 'olumi') await db.from('orgs').update({ mp_status: 'cancelled' }).eq('id', org);
    else await db.from('suscripciones').update({ mp_status: 'cancelled', updated_at: new Date().toISOString() }).eq('org_id', org).eq('app', app);
    await db.from('billing_events').insert({ org_id: org, app, kind: 'cancel', mp_id: preId, status: 'cancelled' });
    return json({ ok: true });
  }

  if (o.founder) return json({ error: 'Tu empresa es cliente fundador: no necesita pagar.' }, 400);
  const plan = String(body.plan || '');
  const ciclo = body.ciclo === 'anual' ? 'anual' : 'mensual';
  const extra = Math.max(0, Math.min(100, Math.round(Number(body.extra) || 0)));
  const cantidad = app === 'ondi' ? Math.max(1, Math.min(50, Math.round(Number(body.cantidad) || 1))) : 1;

  // Precio: Olumi en «plans»; Ondi y Kliva en «cobro_planes» (solo los aprobados)
  let nombre, monto, extraMonto, moneda;
  if (app === 'olumi') {
    const { data: p } = await db.from('plans').select('*').eq('id', plan).maybeSingle();
    if (!p || p.id === 'gratis') return json({ error: 'Plan inválido.' }, 400);
    nombre = p.name; monto = Number(p.charge_amount); extraMonto = Number(p.extra_user_amount); moneda = p.charge_currency;
  } else {
    const { data: p } = await db.from('cobro_planes').select('*').eq('app', app).eq('id', plan).eq('activo', true).maybeSingle();
    if (!p) return json({ error: 'Ese plan todavía no se puede pagar con tarjeta. Escribinos a hola@unitytech.uy.' }, 400);
    nombre = p.nombre; monto = Number(p.monto); extraMonto = Number(p.extra_monto); moneda = p.moneda;
  }

  // Anual = 10 meses (2 de regalo). Montos con IVA incluido.
  const mensual = (monto + extra * extraMonto) * cantidad;
  const amount = r2(ciclo === 'anual' ? mensual * 10 : mensual);
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email || '')) ? String(body.email).trim() : user.email;
  const detalle = [cantidad > 1 ? `${cantidad} sitios` : '', extra ? `+ ${extra} extra` : ''].filter(Boolean).join(' ');
  const pre = {
    reason: `${APPS[app]} ${nombre}${detalle ? ' ' + detalle : ''} · ${o.name}`.slice(0, 120),
    // v2|app|empresa|plan|ciclo|extra|cantidad — el aviso de cobro lo lee para saber qué activar
    external_reference: ['v2', app, org, plan, ciclo, extra, cantidad].join('|'),
    payer_email: email,
    back_url: VUELTA[app](site),
    auto_recurring: { frequency: ciclo === 'anual' ? 12 : 1, frequency_type: 'months', transaction_amount: amount, currency_id: moneda },
    status: 'pending',
  };
  // Moneda: el precio está en dólares. «auto» = se intenta en dólares y, si Mercado Pago no los acepta,
  // se cobra en pesos al dólar BROU del día (cobro-avisos actualiza el monto antes de cada cobro).
  const { data: aj } = await db.from('cobro_ajustes').select('valor').eq('clave', 'cobrar_en').maybeSingle();
  const modo = String(aj?.valor || 'auto');
  const crear = (b) => mp('/preapproval', { method: 'POST', headers: { 'X-Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(b) });
  const enPesos = async () => {
    const tc = await cotizacion(db);
    if (!tc) return null;
    pre.auto_recurring = { ...pre.auto_recurring, transaction_amount: Math.round(amount * tc), currency_id: 'UYU' };
    pre.reason = `${pre.reason.slice(0, 80)} · US$ ${amount} al dólar BROU`;
    return crear(pre);
  };
  let r = modo === 'UYU' && moneda === 'USD' ? await enPesos() : await crear(pre);
  let d = r ? await r.json().catch(() => ({})) : {};
  if (r && !r.ok && modo === 'auto' && moneda === 'USD' && /currency/i.test(JSON.stringify(d))) {
    console.log('Mercado Pago no aceptó dólares; se cobra en pesos', JSON.stringify(d));
    await db.from('billing_events').insert({ org_id: org, app, kind: 'moneda', status: 'usd_rechazado', raw: d });
    await db.from('cobro_ajustes').update({ valor: 'UYU' }).eq('clave', 'cobrar_en');   // las próximas van directo en pesos
    r = await enPesos(); d = r ? await r.json().catch(() => ({})) : {};
  }
  if (!r) return json({ error: 'No se pudo tomar la cotización del dólar. Probá de nuevo en un rato.' }, 502);
  if (!r.ok || !d.init_point) {
    console.error('Mercado Pago', app, r.status, JSON.stringify(d));
    await db.from('billing_events').insert({ org_id: org, app, kind: 'error', status: String(r.status), amount, currency: moneda, raw: d });
    return json({ error: 'Mercado Pago no pudo crear la suscripción. Revisá que el email sea el de tu cuenta de Mercado Pago.' }, 502);
  }
  await db.from('billing_events').insert({ org_id: org, app, kind: 'preapproval', mp_id: String(d.id), status: d.status,
    amount: d.auto_recurring?.transaction_amount ?? amount, currency: d.auto_recurring?.currency_id ?? moneda, raw: d });
  return json({ url: d.init_point });
});

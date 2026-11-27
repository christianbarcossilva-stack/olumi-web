// Unity Tech · avisos de Mercado Pago para Olumi, Ondi y Kliva (versión 8).
// Una sola dirección para las tres apps: en Mercado Pago → Tus integraciones → Webhooks,
// poné la dirección de esta función y marcá «Planes y suscripciones».
// Secretos: MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET. No pide sesión.
//
// Cambio de la versión 8: el plan se activa con el PRIMER COBRO APROBADO, no al autorizar.
// Autorizar solo guarda la suscripción; si la tarjeta rebota, la empresa sigue como estaba.
import { createClient } from 'npm:@supabase/supabase-js@2';

const pickKey = (dict, legacy) => { const l = Deno.env.get(legacy); if (l) return l; try { const d = JSON.parse(Deno.env.get(dict) || '{}'); return d.default || Object.values(d)[0]; } catch (_) { return undefined; } };
const SERVICE_KEY = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

const MP = 'https://api.mercadopago.com';
const db = createClient(Deno.env.get('SUPABASE_URL'), SERVICE_KEY);
const token = Deno.env.get('MP_ACCESS_TOKEN');
const mp = (path, init = {}) => fetch(MP + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
const mpGet = async (path) => { const r = await mp(path); return r.ok ? r.json() : null; };
const cancelar = (id) => mp(`/preapproval/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });

async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
const later = (a, b) => (a && new Date(a) > b ? new Date(a) : b);

// external_reference: «v2|app|empresa|plan|ciclo|extra|cantidad» o, las de antes, «empresa|plan|ciclo|extra» (Olumi)
function leerRef(ref) {
  const p = String(ref || '').split('|');
  if (p[0] === 'v2') return { app: p[1], org: p[2], plan: p[3], ciclo: p[4] === 'anual' ? 'anual' : 'mensual', extra: Number(p[5]) || 0, cantidad: Number(p[6]) || 1 };
  return { app: 'olumi', org: p[0], plan: p[1], ciclo: p[2] === 'anual' ? 'anual' : 'mensual', extra: Number(p[3]) || 0, cantidad: 1 };
}

// Lo que hay guardado de esa empresa en esa app
async function leer(app, org) {
  if (app === 'olumi') {
    const { data: o } = await db.from('orgs').select('paid_until,mp_preapproval_id').eq('id', org).maybeSingle();
    return o ? { hasta: o.paid_until, preId: o.mp_preapproval_id, existe: true } : null;
  }
  const { data: o } = await db.from('orgs').select('id').eq('id', org).maybeSingle();
  if (!o) return null;
  const { data: s } = await db.from('suscripciones').select('pago_hasta,mp_preapproval_id').eq('org_id', org).eq('app', app).maybeSingle();
  return { hasta: s?.pago_hasta || null, preId: s?.mp_preapproval_id || null, existe: !!s };
}
async function guardar(app, org, cambios, plan) {
  if (app === 'olumi') {
    const c = { ...cambios };
    if ('hasta' in c) { c.paid_until = c.hasta; delete c.hasta; }
    if ('preId' in c) { c.mp_preapproval_id = c.preId; delete c.preId; }
    if ('ciclo' in c) { c.billing_cycle = c.ciclo; delete c.ciclo; }
    if ('extra' in c) { c.extra_users = c.extra; delete c.extra; }
    delete c.cantidad;
    return db.from('orgs').update(c).eq('id', org);
  }
  const c = { org_id: org, app, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(cambios)) c[{ hasta: 'pago_hasta', preId: 'mp_preapproval_id' }[k] || k] = v;
  // Si ya existe, solo se cambia lo que viene; si no, se crea con el plan de la suscripción
  const { data: hay } = await db.from('suscripciones').select('org_id').eq('org_id', org).eq('app', app).maybeSingle();
  if (hay) return db.from('suscripciones').update(c).eq('org_id', org).eq('app', app);
  if (!('plan' in c)) c.plan = plan;
  return db.from('suscripciones').insert(c);
}

async function applyPreapproval(pre) {
  const ref = leerRef(pre.external_reference);
  if (!ref.org || !ref.plan || !['olumi', 'ondi', 'kliva'].includes(ref.app)) return;
  const g = await leer(ref.app, ref.org);
  if (!g) return;
  await db.from('billing_events').insert({ org_id: ref.org, app: ref.app, kind: 'preapproval', mp_id: String(pre.id), status: pre.status,
    amount: pre.auto_recurring?.transaction_amount, currency: pre.auto_recurring?.currency_id });
  const esLaActual = g.preId === String(pre.id);
  if (pre.status === 'authorized') {
    // Si no tenía ninguna, queda guardada. Si tenía otra (cambio de plan), se cambia recién con el cobro.
    if (!g.preId) await guardar(ref.app, ref.org, { preId: String(pre.id), mp_status: 'authorized' }, ref.plan);
    else if (esLaActual) await guardar(ref.app, ref.org, { mp_status: 'authorized' }, ref.plan);
  } else if (esLaActual) {
    // pausada o cancelada: el plan sigue hasta la fecha pagada, más los días de gracia
    await guardar(ref.app, ref.org, { mp_status: pre.status }, ref.plan);
  }
}

async function applyPayment(id) {
  const ap = await mpGet(`/authorized_payments/${id}`);
  if (!ap || !ap.preapproval_id) return;
  const pre = await mpGet(`/preapproval/${ap.preapproval_id}`);
  if (!pre) return;
  const ref = leerRef(pre.external_reference);
  if (!ref.org || !['olumi', 'ondi', 'kliva'].includes(ref.app)) return;
  const approved = ap.status === 'processed' && (!ap.payment || ap.payment.status === 'approved');
  const { data: seen } = await db.from('billing_events').select('id').eq('kind', 'payment').eq('mp_id', String(id)).eq('status', 'approved').limit(1);
  await db.from('billing_events').insert({ org_id: ref.org, app: ref.app, kind: 'payment', mp_id: String(id),
    status: approved ? 'approved' : (ap.payment?.status || ap.status), amount: ap.transaction_amount, currency: ap.currency_id, raw: ap });
  if (!approved || (seen && seen.length)) return;
  const g = await leer(ref.app, ref.org);
  if (!g) return;
  // Cambio de plan: con el primer cobro de la nueva se cancela la anterior
  if (g.preId && g.preId !== String(pre.id)) await cancelar(g.preId);
  const desde = new Date(ap.debit_date || ap.date_created || Date.now());
  const hasta = addMonths(desde, ref.ciclo === 'anual' ? 12 : 1);
  await guardar(ref.app, ref.org, {
    plan: ref.plan, ciclo: ref.ciclo, extra: ref.extra, ...(ref.app === 'ondi' ? { cantidad: ref.cantidad } : {}),
    preId: String(pre.id), mp_status: 'authorized', hasta: later(g.hasta, hasta).toISOString(),
  }, ref.plan);
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const raw = await req.text();
  let body = {}; try { body = JSON.parse(raw || '{}'); } catch (_) { /* aviso sin cuerpo */ }
  const type = body.type || u.searchParams.get('type') || u.searchParams.get('topic') || '';
  const id = String(body?.data?.id || u.searchParams.get('data.id') || u.searchParams.get('id') || '');

  // Firma de Mercado Pago: x-signature = "ts=...,v1=..."
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return new Response('falta MP_WEBHOOK_SECRET', { status: 500 });
  {
    const parts = Object.fromEntries((req.headers.get('x-signature') || '').split(',').map((s) => s.trim().split('=')));
    const qid = (u.searchParams.get('data.id') || id).toLowerCase();
    const manifest = `id:${qid};request-id:${req.headers.get('x-request-id') || ''};ts:${parts.ts};`;
    if (!parts.v1 || (await hmacHex(secret, manifest)) !== parts.v1) return new Response('firma inválida', { status: 401 });
  }
  if (!id || !token) return new Response('ok');
  try {
    // Nunca se confía en el aviso: siempre se vuelve a consultar a Mercado Pago
    if (type === 'subscription_preapproval') { const pre = await mpGet(`/preapproval/${id}`); if (pre) await applyPreapproval(pre); }
    else if (type === 'subscription_authorized_payment') await applyPayment(id);
  } catch (e) { console.error('webhook', type, id, e); return new Response('error', { status: 500 }); }
  return new Response('ok');
});
